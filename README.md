# Replicate Designer MCP

An MCP server for generating images using Replicate's Flux 1.1 Pro model.

## Installation

### Using Directly from GitHub

You can use the MCP server directly from GitHub in several ways:

#### Option 1: Install directly with pip

```bash
pip install git+https://github.com/yourusername/replicate-designer.git
```

Then run it with:
```bash
mcp-replicate-designer
```

#### Option 2: Use npx with GitHub repository

Create a configuration file (e.g., `mcps.json`):

```json
{
  "mcpServers": {
    "replicateDesigner": {
      "command": "npx",
      "args": [
        "-y", 
        "github:yourusername/replicate-designer"
      ],
      "env": {
        "REPLICATE_API_TOKEN": "your_replicate_api_token_here"
      }
    }
  }
}
```

Then use it with Claude or another assistant:
```bash
npx @anthropic-ai/assistant --mcps-json mcps.json
```

This method allows you to include your Replicate API token directly in the configuration file, which is more convenient than setting environment variables separately.

#### Option 3: Local Installation

Clone the repository and install from the local directory:

```bash
git clone https://github.com/yourusername/replicate-designer.git
cd replicate-designer
pip install -e .
```

### Publishing and Using via npm

To make your MCP available via npm (for easier distribution):

1. Package and publish your MCP:
```bash
# Build a wheel
pip install build
python -m build

# Publish to npm (after setting up an npm account)
npm init
npm publish
```

2. Then users can install and use it directly:
```bash
npx -y mcp-replicate-designer
```

## Usage

### Setting the API Token

There are several ways to provide your Replicate API token:

1. **Environment variable** (for command line usage):
   ```bash
   export REPLICATE_API_TOKEN=your_api_token_here
   ```

2. **In the MCP configuration file** (as shown in Option 2 above):
   ```json
   {
     "mcpServers": {
       "replicateDesigner": {
         "command": "...",
         "args": ["..."],
         "env": {
           "REPLICATE_API_TOKEN": "your_replicate_api_token_here"
         }
       }
     }
   }
   ```

3. **Using a .env file** in your project directory:
   ```
   REPLICATE_API_TOKEN=your_api_token_here
   ```
   
   Then, install the python-dotenv package:
   ```bash
   pip install python-dotenv
   ```

> **Security Note**: Be careful with your API tokens. Never commit them to public repositories, and use environment variables or secure secret management when possible.

### Running the MCP server

```bash
mcp-replicate-designer
```

By default, it runs in stdio mode which is compatible with npx use. You can also run it in SSE mode:

```bash
mcp-replicate-designer --transport sse --port 8000
```

## Using with npx

This MCP can be used with an AI agent using npx in two ways:

### Direct command line

```bash
npx @anthropic-ai/assistant --mcp mcp-replicate-designer
```

### As a configuration object

In your configuration JSON:

```json
{
  "mcpServers": {
    "replicateDesigner": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-replicate-designer"
      ]
    }
  }
}
```

Then use it with:

```bash
npx @anthropic-ai/assistant --mcps-json /path/to/your/config.json
```

## Tool

This MCP exposes a single tool:

### generate_image

Generates an image using Replicate's Flux 1.1 Pro model.

**Parameters:**

- `prompt` (string, required): Text description of the image to generate
- `aspect_ratio` (string, optional, default: "1:1"): Aspect ratio for the generated image
- `output_format` (string, optional, default: "webp"): Format of the output image
- `output_quality` (integer, optional, default: 80): Quality of the output image (1-100)
- `safety_tolerance` (integer, optional, default: 2): Safety tolerance level (0-3)
- `prompt_upsampling` (boolean, optional, default: true): Whether to use prompt upsampling

**Example:**

```json
{
  "prompt": "A photograph of an humanoid AI agent looking sad and in disrepair, the agent is sat at a workbench getting fixed by a human male",
  "aspect_ratio": "1:1",
  "output_format": "webp"
}
```