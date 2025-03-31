#!/usr/bin/env node

const { StdioTransport, McpServer } = require('@modelcontextprotocol/sdk');
const Replicate = require('replicate');

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Create MCP server
const server = new McpServer({
  name: "Replicate Designer",
  version: "1.0.0",
  transport: new StdioTransport()
});

// Define the image generation tool
server.tool({
  name: 'generate_image',
  description: 'Generates an image using Replicate\'s Flux 1.1 Pro model.',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'A detailed description of the image to generate'
      },
      aspect_ratio: {
        type: 'string',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        default: '1:1',
        description: 'The aspect ratio of the output image'
      },
      output_format: {
        type: 'string',
        default: 'webp',
        description: 'Format of the output image'
      },
      output_quality: {
        type: 'integer',
        default: 80,
        description: 'Quality of the output image (1-100)'
      },
      safety_tolerance: {
        type: 'integer',
        default: 2,
        description: 'Safety tolerance level (0-3)'
      },
      prompt_upsampling: {
        type: 'boolean',
        default: true,
        description: 'Whether to use prompt upsampling'
      }
    },
    required: ['prompt']
  },
  handler: async (params) => {
    console.log('Generating image with params:', params);

    try {
      const output = await replicate.run(
        "black-forest-labs/flux-1.1-pro:1d0c7f00f7ab62aa5871a9a7806cb99061727ff09fb2acc31fbe98ce7cb7fe99",
        {
          input: {
            prompt: params.prompt,
            aspect_ratio: params.aspect_ratio || '1:1',
            output_format: params.output_format || 'webp',
            output_quality: params.output_quality || 80,
            safety_tolerance: params.safety_tolerance || 2,
            prompt_upsampling: params.prompt_upsampling !== false
          }
        }
      );

      return output;
    } catch (error) {
      console.error('Error generating image:', error);
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }
});

// Start the server
server.start().catch(error => {
  console.error('Error starting MCP server:', error);
  process.exit(1);
});
