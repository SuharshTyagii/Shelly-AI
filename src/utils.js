const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { historyPath } = require('./config');

// Clear conversation history
function clearHistory() {
  try {
    fs.writeFileSync(historyPath, JSON.stringify([]), 'utf8');
    return true;
  } catch (error) {
    console.error(chalk.red('Error clearing history:'), error.message);
    return false;
  }
}

// Save conversation to file
function saveConversationToFile(history, filename) {
  try {
    let content = '';
    history.forEach(msg => {
      const role = msg.role === 'user' ? 'You: ' : 'Assistant: ';
      content += `${role}${msg.content}\n\n`;
    });
    
    fs.writeFileSync(filename, content, 'utf8');
    console.log(chalk.green(`Conversation saved to ${filename}`));
    return true;
  } catch (error) {
    console.error(chalk.red('Error saving conversation:'), error.message);
    return false;
  }
}

// Truncate string for display
function truncateString(str, maxLength = 100) {
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}...`;
}

// Check if a file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

// Format timestamp to human readable
function formatTimestamp(timestamp = Date.now()) {
  return new Date(timestamp).toLocaleString();
}

module.exports = {
  clearHistory,
  saveConversationToFile,
  truncateString,
  fileExists,
  formatTimestamp
};