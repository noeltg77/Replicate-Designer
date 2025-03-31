import anyio
import click
import httpx
import mcp.types as types
import os
import json
import base64
from mcp.server.lowlevel import Server

# Try to load environment variables from .env file if available
try:
    from dotenv import load_dotenv
    load_dotenv()  # take environment variables from .env file if present
except ImportError:
    # dotenv is optional, so we don't raise an error if it's not available
    pass


async def generate_image(
    prompt: str,
    aspect_ratio: str = "1:1",
    output_format: str = "webp",
    output_quality: int = 80,
    safety_tolerance: int = 2,
    prompt_upsampling: bool = True,
) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """Generate an image using Replicate's Flux model"""
    
    # Get API token from environment
    api_token = os.environ.get("REPLICATE_API_TOKEN")
    if not api_token:
        return [types.TextContent(
            type="text", 
            text="Error: REPLICATE_API_TOKEN environment variable not set"
        )]
    
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
        "Prefer": "wait"
    }
    
    payload = {
        "input": {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "output_format": output_format,
            "output_quality": output_quality,
            "safety_tolerance": safety_tolerance,
            "prompt_upsampling": prompt_upsampling
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
                headers=headers,
                json=payload
            )
            
            response.raise_for_status()
            result = response.json()
            
            # Replicate returns URLs to the generated images
            if "output" in result and result["output"]:
                image_url = result["output"][0]
                # Fetch the image
                img_response = await client.get(image_url)
                img_response.raise_for_status()
                
                # Return the image content
                return [types.ImageContent(
                    type="image",
                    data=base64.b64encode(img_response.content).decode("utf-8"),
                    mime_type=f"image/{output_format}"
                )]
            else:
                # Return error message if no output
                return [types.TextContent(
                    type="text",
                    text=f"Error: No image generated. Full response: {json.dumps(result, indent=2)}"
                )]
    
    except httpx.HTTPStatusError as e:
        return [types.TextContent(
            type="text",
            text=f"HTTP error: {e.response.status_code} - {e.response.text}"
        )]
    except httpx.RequestError as e:
        return [types.TextContent(
            type="text",
            text=f"Request error: {str(e)}"
        )]
    except Exception as e:
        return [types.TextContent(
            type="text",
            text=f"Unexpected error: {str(e)}"
        )]


@click.command()
@click.option("--port", default=8000, help="Port to listen on for SSE")
@click.option(
    "--transport",
    type=click.Choice(["stdio", "sse"]),
    default="stdio",
    help="Transport type",
)
def main(port: int, transport: str) -> int:
    app = Server("replicate-designer")

    @app.call_tool()
    async def call_tool(
        name: str, arguments: dict
    ) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
        if name != "generate_image":
            raise ValueError(f"Unknown tool: {name}")
        
        # Extract required argument
        if "prompt" not in arguments:
            raise ValueError("Missing required argument 'prompt'")
        
        # Extract optional arguments with defaults
        aspect_ratio = arguments.get("aspect_ratio", "1:1")
        output_format = arguments.get("output_format", "webp")
        output_quality = int(arguments.get("output_quality", 80))
        safety_tolerance = int(arguments.get("safety_tolerance", 2))
        prompt_upsampling = bool(arguments.get("prompt_upsampling", True))
        
        return await generate_image(
            prompt=arguments["prompt"],
            aspect_ratio=aspect_ratio,
            output_format=output_format,
            output_quality=output_quality,
            safety_tolerance=safety_tolerance,
            prompt_upsampling=prompt_upsampling
        )

    @app.list_tools()
    async def list_tools() -> list[types.Tool]:
        return [
            types.Tool(
                name="generate_image",
                description="Generates an image using Replicate's Flux 1.1 Pro model",
                inputSchema={
                    "type": "object",
                    "required": ["prompt"],
                    "properties": {
                        "prompt": {
                            "type": "string",
                            "description": "Text description of the image to generate",
                        },
                        "aspect_ratio": {
                            "type": "string",
                            "description": "Aspect ratio for the generated image (e.g. '1:1', '16:9', '4:3')",
                            "default": "1:1",
                        },
                        "output_format": {
                            "type": "string",
                            "description": "Format of the output image (e.g. 'webp', 'png', 'jpeg')",
                            "default": "webp",
                        },
                        "output_quality": {
                            "type": "integer",
                            "description": "Quality of the output image (1-100)",
                            "default": 80,
                        },
                        "safety_tolerance": {
                            "type": "integer",
                            "description": "Safety tolerance level (0-3)",
                            "default": 2,
                        },
                        "prompt_upsampling": {
                            "type": "boolean",
                            "description": "Whether to use prompt upsampling",
                            "default": True,
                        },
                    },
                },
            )
        ]

    if transport == "sse":
        from mcp.server.sse import SseServerTransport
        from starlette.applications import Starlette
        from starlette.routing import Mount, Route

        sse = SseServerTransport("/messages/")

        async def handle_sse(request):
            async with sse.connect_sse(
                request.scope, request.receive, request._send
            ) as streams:
                await app.run(
                    streams[0], streams[1], app.create_initialization_options()
                )

        starlette_app = Starlette(
            debug=True,
            routes=[
                Route("/sse", endpoint=handle_sse),
                Mount("/messages/", app=sse.handle_post_message),
            ],
        )

        import uvicorn

        uvicorn.run(starlette_app, host="0.0.0.0", port=port)
    else:
        from mcp.server.stdio import stdio_server

        async def arun():
            async with stdio_server() as streams:
                await app.run(
                    streams[0], streams[1], app.create_initialization_options()
                )

        anyio.run(arun)

    return 0