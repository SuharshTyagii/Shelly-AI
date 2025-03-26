const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Default configuration
const DEFAULT_CONFIG = {
  apiKey: process.env.OPENROUTER_API_KEY || '',
  model: 'cognitivecomputations/dolphin3.0-mistral-24b:free',
  siteUrl: 'https://shelly-ai.local',
  siteName: 'Shelly-AI CLI',
  maxHistoryLength: 10,
};

// Predefined models list
const PREDEFINED_MODELS = [
  { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', isFree: true, description: 'Google\'s Gemini Flash Lite - Fast and efficient' },
  { id: 'deepseek/deepseek-r1:free', isFree: true, description: 'DeepSeek\'s reasoning and problem-solving model' },
  { id: 'anthropic/claude-3.5-sonnet', isFree: false, description: 'Advanced Anthropic Claude model with strong reasoning' },
  { id: 'openai/gpt-4o-mini', isFree: false, description: 'Smaller variant of GPT-4o with lower latency' },
  { id: 'mistralai/mistral-nemo', isFree: false, description: 'Mistral AI\'s powerful NeMo model' },
  { id: 'cognitivecomputations/dolphin3.0-mistral-24b:free', isFree: true, description: 'Dolphin Mistral 24B tuning - free tier' }
];

// Config file paths
const configDir = path.join(os.homedir(), '.shelly-ai');
const defaultConfigPath = path.join(configDir, 'config.json');
const historyPath = path.join(configDir, 'history.json');

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// Load configuration
function loadConfig(configPath) {
  ensureConfigDir();
  
  // Use default or specified config path
  const actualConfigPath = configPath || defaultConfigPath;
  
  // Read or create config
  let config = DEFAULT_CONFIG;
  try {
    if (fs.existsSync(actualConfigPath)) {
      config = { ...config, ...JSON.parse(fs.readFileSync(actualConfigPath, 'utf8')) };
    }
  } catch (error) {
    console.error(chalk.red('Error reading config file, using defaults.'));
  }
  
  return config;
}

// Save configuration
function saveConfig(config, configPath) {
  const actualConfigPath = configPath || defaultConfigPath;
  try {
    fs.writeFileSync(actualConfigPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(chalk.red('Error saving config file:'), error.message);
    return false;
  }
}

// Load conversation history
function loadHistory() {
  try {
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    }
  } catch (error) {
    console.error(chalk.red('Error reading history file, starting fresh.'));
  }
  return [];
}

// Save conversation history
function saveHistory(history) {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(history), 'utf8');
    return true;
  } catch (error) {
    console.error(chalk.red('Error saving history:'), error.message);
    return false;
  }
}

module.exports = {
  DEFAULT_CONFIG,
  PREDEFINED_MODELS,
  configDir,
  historyPath,
  loadConfig,
  saveConfig,
  loadHistory,
  saveHistory
};