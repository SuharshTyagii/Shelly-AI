const readline = require('readline');
const fs = require('fs');
const chalk = require('chalk');
const { callOpenRouter, callOpenRouterStreaming, prepareMessages } = require('./api');
const { loadHistory, saveHistory, PREDEFINED_MODELS, saveConfig } = require('./config');
const { showChatHelp, listModels, executeCommand, promptExecuteCommand } = require('./commands');
const { loadFileContext } = require('./file-context');

// Interactive chat mode
async function startChat(config, argv, initialHistory = null) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

console.log(chalk.blue(String.raw`
    
  _________.__           .__  .__                     _____  .___ 
 /   _____/|  |__   ____ |  | |  | ___.__.           /  _  \ |   |
 \_____  \ |  |  \_/ __ \|  | |  |<   |  |  ______  /  /_\  \|   |
 /        \|   Y  \  ___/|  |_|  |_\\___  | /_____/ /    |    \   |
/_______  /|___|  /\___  >____/____/ ____|         \____|__  /___|
        \/      \/     \/          \/                      \/     

    -> Using model: ${config.model}
`));
  console.log(chalk.blue('Type .exit or Ctrl+C to quit, .clear to clear history'));
  console.log(chalk.blue('Use .help to see all commands\n'));

  // Load conversation history, prioritizing passed-in history if available
  let history = initialHistory || loadHistory();
  
  // Log the current history state (for debugging)
  if (process.env.DEBUG_HISTORY) {
    console.log(chalk.gray(`[DEBUG] Current history (${history.length} messages):`));
    history.forEach((msg, i) => {
      console.log(chalk.gray(`[${i}] ${msg.role}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`));
    });
  }

  const askQuestion = () => {
    rl.question(chalk.green('You: '), async (input) => {
      const trimmedInput = input.trim();
      
      // Handle special commands
      if (trimmedInput === '.exit') {
        rl.close();
        return;
      }
      
      if (trimmedInput === '.clear') {
        history = [];
        saveHistory(history);
        console.log(chalk.yellow('Conversation history cleared.'));
        askQuestion();
        return;
      }
      
      if (trimmedInput === '.help') {
        showChatHelp();
        askQuestion();
        return;
      }
      
      if (trimmedInput === '.history') {
        console.log(chalk.cyan('\nConversation History:'));
        if (history.length === 0) {
          console.log(chalk.yellow('No history yet.'));
        } else {
          history.forEach((msg, i) => {
            const role = msg.role === 'user' ? chalk.green('You: ') : chalk.blue('Assistant: ');
            // Truncate very long messages in history display
            const content = msg.content.length > 100 ? 
              `${msg.content.substring(0, 100)}...` : msg.content;
            console.log(`${role}${content}`);
          });
        }
        console.log();
        askQuestion();
        return;
      }
      
      if (trimmedInput === '.debug') {
        console.log(chalk.cyan('\nDebug Information:'));
        console.log(chalk.cyan('Current history state:'));
        if (history.length === 0) {
          console.log(chalk.yellow('No history.'));
        } else {
          history.forEach((msg, i) => {
            console.log(chalk.cyan(`[${i}] ${msg.role}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`));
          });
        }
        console.log(chalk.cyan(`\nTotal messages: ${history.length}`));
        console.log(chalk.cyan(`Config: ${JSON.stringify(config, null, 2)}`));
        askQuestion();
        return;
      }

      if (trimmedInput.startsWith('.file ')) {
        const filePath = trimmedInput.slice(6).trim();
        try {
          const fileContent = await loadFileContext(filePath);
          history.push({ 
            role: 'user', 
            content: `Here's the content of the file ${filePath}:\n\n${fileContent}\n\nPlease analyze this file.` 
          });
          console.log(chalk.yellow(`File loaded: ${filePath}`));
          
          // Save history
          saveHistory(history);
          
          // Start asking the model about the file
          await handleApiCall(history, config, argv);
          askQuestion();
        } catch (error) {
          console.error(chalk.red('Error loading file:'), error.message);
          askQuestion();
        }
        return;
      }
      
      if (trimmedInput.startsWith('.model')) {
        const modelArg = trimmedInput.split(' ')[1];
        
        if (!modelArg) {
          // List predefined models
          listModels(config);
          console.log(chalk.yellow('To change model: .model <model_id> or .model <number>'));
        } else if (!isNaN(parseInt(modelArg)) && 
                  parseInt(modelArg) >= 1 && 
                  parseInt(modelArg) <= PREDEFINED_MODELS.length) {
          // Handle model selection by number
          const oldModel = config.model;
          config.model = PREDEFINED_MODELS[parseInt(modelArg) - 1].id;
          console.log(chalk.yellow(`Model changed from ${oldModel} to ${config.model}`));
          
          // Save config
          saveConfig(config);
        } else {
          // Change model by direct ID
          const oldModel = config.model;
          config.model = modelArg;
          console.log(chalk.yellow(`Model changed from ${oldModel} to ${config.model}`));
          
          // Save config
          saveConfig(config);
        }
        
        askQuestion();
        return;
      }
      
      if (trimmedInput.startsWith('.temp')) {
        const tempArg = trimmedInput.split(' ')[1];
        
        if (!tempArg || isNaN(parseFloat(tempArg)) || parseFloat(tempArg) < 0 || parseFloat(tempArg) > 1) {
          console.log(chalk.yellow(`Current temperature: ${argv.temperature}`));
          console.log(chalk.yellow('Usage: .temp <value 0-1>'));
        } else {
          argv.temperature = parseFloat(tempArg);
          console.log(chalk.yellow(`Temperature set to ${argv.temperature}`));
        }
        
        askQuestion();
        return;
      }
      
      if (trimmedInput.startsWith('.save')) {
        const filename = trimmedInput.split(' ')[1] || `chat_${Date.now()}.txt`;
        
        try {
          let content = '';
          history.forEach(msg => {
            const role = msg.role === 'user' ? 'You: ' : 'Assistant: ';
            content += `${role}${msg.content}\n\n`;
          });
          
          fs.writeFileSync(filename, content, 'utf8');
          console.log(chalk.green(`Conversation saved to ${filename}`));
        } catch (error) {
          console.error(chalk.red('Error saving conversation:'), error.message);
        }
        
        askQuestion();
        return;
      }
      
      if (trimmedInput === '.continue') {
        // Find the last assistant message
        const lastAssistantIndex = [...history].reverse().findIndex(msg => msg.role === 'assistant');
        
        if (lastAssistantIndex === -1) {
          console.log(chalk.yellow('No previous assistant message to continue from.'));
          askQuestion();
          return;
        }
        
        // Add a special user message requesting continuation
        history.push({ 
          role: 'user', 
          content: 'Please continue from your last response.' 
        });
        
        // Save history
        saveHistory(history);
        
        // Call API
        await handleApiCall(history, config, argv);
        askQuestion();
        return;
      } else if (trimmedInput !== '') {
        // Normal message - add to history
        history.push({ role: 'user', content: input });
        
        // Ensure history doesn't exceed maximum length
        if (history.length > config.maxHistoryLength * 2) {
          history = history.slice(-config.maxHistoryLength * 2);
        }
        
        // Save history
        saveHistory(history);
        
        // Call API
        await handleApiCall(history, config, argv);
        askQuestion();
      } else {
        // Empty input
        askQuestion();
      }
    });
  };

  askQuestion();
}

// Handle API call and response
async function handleApiCall(history, config, argv) {
  try {
    // Debug history if needed
    if (process.env.DEBUG_HISTORY) {
      console.log(chalk.gray(`[DEBUG] Sending ${history.length} messages to API:`));
      history.forEach((msg, i) => {
        console.log(chalk.gray(`[${i}] ${msg.role}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`));
      });
    }
    
    console.log(chalk.yellow('Assistant: (thinking...)'));
    
    // Prepare API messages
    const apiMessages = prepareMessages(history);
    
    // Check if streaming is enabled
    if (argv.stream) {
      // Clear the "thinking" line
      process.stdout.write('\x1b[1A'); // Move cursor up one line
      process.stdout.write('\x1b[2K'); // Clear the entire line
      
      // Print initial prompt
      process.stdout.write(chalk.blue('Assistant: '));
      
      // Streaming response handling
      let fullResponse = '';
      
      const result = await callOpenRouterStreaming(
        apiMessages, 
        config, 
        argv.temperature, 
        (chunk) => {
          // Print each chunk as it arrives
          process.stdout.write(chunk);
          fullResponse += chunk;
        }
      );
      
      // Add a newline after the streaming is complete
      console.log('');
      
      // Process command response if applicable
      await processCommandResponse(fullResponse, history, argv);
      
      // Save to history
      history.push({ role: 'assistant', content: fullResponse });
      saveHistory(history);
    } else {
      // Non-streaming response
      const result = await callOpenRouter(apiMessages, config, argv.temperature);
      let assistantResponse = result.choices[0].message.content;
      
      // Clear the "thinking" line
      process.stdout.write('\x1b[1A'); // Move cursor up one line
      process.stdout.write('\x1b[2K'); // Clear the entire line
      
      // Process command response if applicable
      await processCommandResponse(assistantResponse, history, argv);
      
      // Save to history
      history.push({ role: 'assistant', content: assistantResponse });
      saveHistory(history);
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }
}

// Process command response (extract and execute command if applicable)
async function processCommandResponse(assistantResponse, history, argv) {
  // Try to parse as JSON to check if it's a command response
  let commandObject = null;
  try {
    // Try to extract JSON if it's embedded in text
    const jsonMatch = assistantResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      commandObject = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Not JSON or not properly formatted, treat as regular response
  }
  
  // Check if we have a valid command response
  if (commandObject && commandObject.explanation && commandObject.command) {
    // In streaming mode, we've already printed the response, so just highlight the command
    if (argv.stream) {
      console.log(chalk.green('\nCommand detected:'), chalk.yellow(commandObject.command));
    } else {
      // In non-streaming mode, print the full response and command
      console.log(chalk.blue('Assistant:'), assistantResponse);
      console.log(chalk.green('\nCommand:'), chalk.yellow(commandObject.command));
    }
    
    // If auto-execute flag is set
    if (argv.execute) {
      console.log(chalk.green('\nAuto-executing command...'));
      await executeCommand(commandObject.command);
    } else {
      // Otherwise prompt for execution
      await promptExecuteCommand(commandObject.command);
    }
    
    return true;
  } else if (!argv.stream) {
    // Normal response (only in non-streaming mode, as streaming already printed)
    console.log(chalk.blue('Assistant:'), assistantResponse);
  }
  
  return false;
}

// Process a single query
async function processOneTimeQuery(query, config, argv) {
  if (!config.apiKey) {
    console.error(chalk.red('API key not configured. Run with --setup first.'));
    process.exit(1);
  }

  // Load conversation history from disk only if not continuing from a previous session
  let history = loadHistory();

  // Add query to history
  if (query && query.trim() !== '') {
    history.push({ role: 'user', content: query });
  } else {
    console.error(chalk.red('Empty query. Please provide a question or prompt.'));
    process.exit(1);
  }
  
  // Ensure history doesn't exceed maximum length
  if (history.length > config.maxHistoryLength * 2) {
    history = history.slice(-config.maxHistoryLength * 2);
  }
  
  // Save history
  saveHistory(history);

  // Call API
  await handleApiCall(history, config, argv);
  
  // If continuing in interactive mode
  if (argv.continue) {
    // Continue in interactive mode
    console.log(chalk.yellow('\nContinuing in interactive mode. Type .exit to quit.\n'));
    await startChat(config, argv, history);
  } else {
    // Prompt user to continue or exit
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(chalk.yellow('\nContinue chatting? [Y/n] '), (answer) => {
      rl.close();
      if (answer.toLowerCase() !== 'n') {
        console.log(chalk.yellow('\nContinuing in interactive mode. Type .exit to quit.\n'));
        startChat(config, argv, history);
      } else {
        process.exit(0);
      }
    });
  }
}

module.exports = {
  startChat,
  processOneTimeQuery,
  handleApiCall,
  processCommandResponse
};