const fetch = require('node-fetch');
const chalk = require('chalk');

// Call the OpenRouter API (non-streaming)
async function callOpenRouter(messages, config, temperature) {
  if (!config.apiKey) {
    console.error(chalk.red('API key not configured. Run with --setup first.'));
    process.exit(1);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': config.siteUrl,
        'X-Title': config.siteName,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
    }

    return await response.json();
  } catch (error) {
    console.error(chalk.red('Error calling OpenRouter API:'), error.message);
    throw error;
  }
}

// Call the OpenRouter API with streaming
async function callOpenRouterStreaming(messages, config, temperature, onChunk) {
  if (!config.apiKey) {
    console.error(chalk.red('API key not configured. Run with --setup first.'));
    process.exit(1);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': config.siteUrl,
        'X-Title': config.siteName,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
    }

    // Check what version of fetch we're using
    // Newer versions of fetch provide a readable stream via getReader
    // Older versions (like node-fetch v2) provide a traditional Node.js stream
    let fullResponse = '';

    // For older versions of node-fetch that don't have getReader
    if (!response.body.getReader) {
      return new Promise((resolve, reject) => {
        response.body.on('data', (chunk) => {
          const chunkText = chunk.toString();
          
          // Process each line
          chunkText.split('\n').forEach(line => {
            if (!line.trim() || !line.startsWith('data: ')) return;
            
            // Remove 'data: ' prefix
            const data = line.substring(6);
            
            // Skip [DONE] message
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              
              if (content) {
                fullResponse += content;
                if (onChunk) onChunk(content);
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          });
        });
        
        response.body.on('end', () => {
          resolve({
            choices: [
              {
                message: {
                  content: fullResponse
                }
              }
            ]
          });
        });
        
        response.body.on('error', (err) => {
          reject(err);
        });
      });
    }
    
    // For newer versions of fetch that support getReader()
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines from buffer
      let lineEnd;
      while ((lineEnd = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);
        
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          
          // Skip [DONE] message
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            
            if (content) {
              fullResponse += content;
              if (onChunk) onChunk(content);
            }
          } catch (e) {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }
    }

    return {
      choices: [
        {
          message: {
            content: fullResponse
          }
        }
      ]
    };
  } catch (error) {
    console.error(chalk.red('Error calling OpenRouter API:'), error.message);
    throw error;
  }
}

// Get system message for command detection
function getSystemMessage() {
  return {
    role: 'system',
    content: `You are a helpful assistant and shell expert. When asked about shell commands or how to perform system operations, 
    respond with a JSON object that includes an "explanation" field and a "command" field if applicable. 
    The "command" field should contain the shell command that would accomplish the task. 
    If the user's query isn't about executing a command, just respond normally and don't include the JSON format.
    Example format when command is applicable:
    {
      "explanation": "This command lists all running Docker containers",
      "command": "docker ps"
    }
    Only return JSON when a specific command can be executed. Don't force a command if it's not appropriate.`
  };
}

// Prepare messages for API call
function prepareMessages(history) {
  const systemMessage = getSystemMessage();
  
  // Filter out system messages from history to avoid duplicates
  const userAssistantMessages = history.filter(msg => msg.role !== 'system');
  
  return [systemMessage, ...userAssistantMessages.map(entry => ({
    role: entry.role,
    content: entry.content,
  }))];
}

module.exports = {
  callOpenRouter,
  callOpenRouterStreaming,
  getSystemMessage,
  prepareMessages
};