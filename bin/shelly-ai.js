#!/usr/bin/env node

const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const { loadConfig } = require('../src/config');
const { setupWizard, listModels } = require('../src/commands');
const { startChat } = require('../src/chat');
const { processOneTimeQuery } = require('../src/chat');
const { loadFileContexts } = require('../src/file-context');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('model', {
    alias: 'm',
    type: 'string',
    description: 'Model to use for chat',
  })
  .option('key', {
    alias: 'k',
    type: 'string',
    description: 'OpenRouter API key',
  })
  .option('temperature', {
    alias: 't',
    type: 'number',
    description: 'Temperature for response generation (0-1)',
    default: 0.7,
  })
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to config file',
  })
  .option('list-models', {
    alias: 'l',
    type: 'boolean',
    description: 'List available models',
  })
  .option('setup', {
    type: 'boolean',
    description: 'Run the setup wizard',
  })
  .option('clear', {
    type: 'boolean',
    description: 'Clear conversation history',
  })
  .option('continue', {
    alias: 'n',
    type: 'boolean',
    description: 'Continue the conversation after one-time query',
  })
  .option('execute', {
    alias: 'e',
    type: 'boolean',
    description: 'Auto-execute commands returned by the assistant',
  })
  .option('file', {
    alias: 'f',
    type: 'array',
    description: 'Include file(s) as context for the query',
  })
  .option('stream', {
    alias: 's',
    type: 'boolean',
    description: 'Stream the response in real-time',
    default: true,
  })
  .option('no-stream', {
    type: 'boolean',
    description: 'Disable response streaming',
  })
  .strict(false) // Allow non-option arguments after options
  .help()
  .alias('help', 'h')
  .argv;

// If --no-stream is specified, override stream setting
if (argv['no-stream']) {
  argv.stream = false;
}

// Main function
async function main() {
  // Load config
  const config = loadConfig(argv.config);
  
  // Override config with command line arguments
  if (argv.key) config.apiKey = argv.key;
  if (argv.model) config.model = argv.model;
  
  // Clear history if requested
  if (argv.clear) {
    const { clearHistory } = require('../src/utils');
    clearHistory();
    console.log(chalk.green('Conversation history cleared.'));
    process.exit(0);
  }
  
  if (argv.setup) {
    await setupWizard(config);
  } else if (argv['list-models']) {
    listModels(config);
  } else {
    // Process files first if provided
    let fileContext = '';
    if (argv.file && argv.file.length > 0) {
      // Make sure file paths are valid (not part of the query)
      const validFilePaths = argv.file.filter(path => {
        try {
          return fs.existsSync(path);
        } catch(e) {
          return false;
        }
      });
      
      if (validFilePaths.length > 0) {
        fileContext = await loadFileContexts(validFilePaths);
      }
    }
    
    // Get the query from remaining arguments
    const query = argv._.join(' ');
    
    if (fileContext || query) {
      // Build the full query with file context
      const fullQuery = fileContext ? 
        `${fileContext}\n\n${query || 'Please analyze the provided files.'}` :
        query;
        
      await processOneTimeQuery(fullQuery, config, argv);
    } else {
      // No arguments, start interactive chat
      await startChat(config, argv);
    }
  }
}

main().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});