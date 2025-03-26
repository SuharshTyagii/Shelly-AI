const readline = require('readline');
const chalk = require('chalk');
const { PREDEFINED_MODELS, saveConfig } = require('./config');

// Setup wizard
async function setupWizard(config) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  console.log(chalk.blue('Shelly-AI Setup Wizard'));
  console.log(chalk.blue('----------------------'));

  config.apiKey = await question(`OpenRouter API Key , obtain from https://openrouter.ai/settings/keys [${config.apiKey}]: `) || config.apiKey;
  
  // Display predefined models
  console.log(chalk.green('\nAvailable models:'));
  PREDEFINED_MODELS.forEach((model, index) => {
    const freeStatus = model.isFree ? chalk.green('[FREE]') : chalk.yellow('[PAID]');
    console.log(`${chalk.blue(index + 1)}. ${model.id} ${freeStatus}`);
    console.log(`   ${model.description}`);
  });
  
  // Let user select a model
  const modelSelection = await question(chalk.green(`Select model by number (1-${PREDEFINED_MODELS.length}) or enter custom model ID [Default: keep current]: `));
  
  if (modelSelection && !isNaN(parseInt(modelSelection)) && 
      parseInt(modelSelection) >= 1 && 
      parseInt(modelSelection) <= PREDEFINED_MODELS.length) {
    const selectedModel = PREDEFINED_MODELS[parseInt(modelSelection) - 1];
    config.model = selectedModel.id;
    console.log(chalk.green(`Selected model: ${config.model}`));
  } else if (modelSelection && modelSelection.trim()) {
    // User entered a custom model ID
    config.model = modelSelection.trim();
    console.log(chalk.green(`Custom model set: ${config.model}`));
  } else {
    console.log(chalk.yellow(`Keeping current model: ${config.model}`));
  }
  
  config.siteUrl = await question(`Site URL [${config.siteUrl}]: `) || config.siteUrl;
  config.siteName = await question(`Site Name [${config.siteName}]: `) || config.siteName;
  
  const maxHistoryInput = await question(`Maximum conversation turns to remember [${config.maxHistoryLength}]: `);
  if (maxHistoryInput && !isNaN(parseInt(maxHistoryInput))) {
    config.maxHistoryLength = parseInt(maxHistoryInput);
  }

  saveConfig(config);
  console.log(chalk.green('Configuration saved successfully'));

  rl.close();
  return config;
}

// List available models
function listModels(config) {
  console.log(chalk.green('\nAvailable models:'));
  PREDEFINED_MODELS.forEach((model, index) => {
    const freeStatus = model.isFree ? chalk.green('[FREE]') : chalk.yellow('[PAID]');
    console.log(`${chalk.blue(index + 1)}. ${model.id} ${freeStatus}`);
    console.log(`   ${model.description}`);
  });
  
  console.log(chalk.yellow(`\nCurrent model: ${config.model}`));
  console.log(chalk.cyan('You can use any model ID from OpenRouter, not just the ones listed above.'));
}

// Execute a shell command
async function executeCommand(command) {
  const { execSync } = require('child_process');
  try {
    const output = execSync(command, { encoding: 'utf8' });
    console.log(chalk.cyan('\nCommand output:'));
    console.log(output);
    return true;
  } catch (error) {
    console.error(chalk.red('\nCommand execution failed:'), error.message);
    return false;
  }
}

// Ask user if they want to execute a command
async function promptExecuteCommand(command) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log(chalk.green('\nExecute this command? [Y/n]'));
    rl.question('', async (answer) => {
      rl.close();
      if (answer.toLowerCase() !== 'n') {
        const result = await executeCommand(command);
        resolve(result);
      } else {
        resolve(false);
      }
    });
  });
}

// Display help for chat commands
function showChatHelp() {
  console.log(chalk.cyan('\nShelly-AI Commands:'));
  console.log(chalk.cyan('  .exit           - Exit the chat'));
  console.log(chalk.cyan('  .clear          - Clear conversation history'));
  console.log(chalk.cyan('  .help           - Show this help message'));
  console.log(chalk.cyan('  .model [modelId]- Change model (leave blank to list available models)'));
  console.log(chalk.cyan('  .temp [0-1]     - Change temperature (0 = deterministic, 1 = creative)'));
  console.log(chalk.cyan('  .save [filename]- Save conversation to file'));
  console.log(chalk.cyan('  .continue       - Continue generating from last response'));
  console.log(chalk.cyan('  .history        - Show conversation history'));
  console.log(chalk.cyan('  .file [path]    - Load a file as context'));
}

module.exports = {
  setupWizard,
  listModels,
  executeCommand,
  promptExecuteCommand,
  showChatHelp
};