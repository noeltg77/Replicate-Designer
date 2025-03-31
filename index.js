#!/usr/bin/env node

const Replicate = require('replicate');
const readline = require('readline');

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// MCP Protocol implementation
const MCP_VERSION = "0.9.0";

// Define the image generation tool
const generateImageTool = {
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
  }
};

// Define available tools
const tools = [generateImageTool];

// Create readline interface for stdin/stdout
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Handle incoming messages
rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    console.error('Received message:', message);

    // Handle different message types
    switch (message.type) {
      case 'hello':
        handleHello(message);
        break;
      case 'list_tools':
        handleListTools(message);
        break;
      case 'run_tool':
        await handleRunTool(message);
        break;
      default:
        sendError(message.id, 'not_supported', `Unsupported message type: ${message.type}`);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    try {
      const message = JSON.parse(line);
      sendError(message.id, 'internal_error', `Error: ${error.message}`);
    } catch (parseError) {
      console.error('Failed to parse message:', parseError);
    }
  }
});

// Handle hello message
function handleHello(message) {
  sendResponse(message.id, {
    type: 'hello_response',
    version: MCP_VERSION,
    capabilities: ['tools']
  });
}

// Handle list_tools message
function handleListTools(message) {
  sendResponse(message.id, {
    type: 'list_tools_response',
    tools: tools
  });
}

// Handle run_tool message
async function handleRunTool(message) {
  const { tool_name, parameters } = message;
  
  // Find the tool
  const tool = tools.find(t => t.name === tool_name);
  if (!tool) {
    return sendError(message.id, 'not_found', `Tool not found: ${tool_name}`);
  }

  try {
    console.error(`Running tool ${tool_name} with parameters:`, parameters);
    
    // Run the Replicate model
    const output = await replicate.run(
      "black-forest-labs/flux-1.1-pro:1d0c7f00f7ab62aa5871a9a7806cb99061727ff09fb2acc31fbe98ce7cb7fe99",
      {
        input: {
          prompt: parameters.prompt,
          aspect_ratio: parameters.aspect_ratio || '1:1',
          output_format: parameters.output_format || 'webp',
          output_quality: parameters.output_quality || 80,
          safety_tolerance: parameters.safety_tolerance || 2,
          prompt_upsampling: parameters.prompt_upsampling !== false
        }
      }
    );

    console.error('Tool output:', output);
    
    sendResponse(message.id, {
      type: 'run_tool_response',
      result: output
    });
  } catch (error) {
    console.error(`Error running tool ${tool_name}:`, error);
    sendError(message.id, 'tool_error', `Error running tool: ${error.message}`);
  }
}

// Send a response message
function sendResponse(id, content) {
  const response = {
    id,
    status: 'success',
    ...content
  };
  console.log(JSON.stringify(response));
}

// Send an error message
function sendError(id, code, message) {
  const error = {
    id,
    status: 'error',
    error: {
      code,
      message
    }
  };
  console.log(JSON.stringify(error));
}

console.error('Replicate Designer MCP Server started');
