const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const util = require('util');
const readFileAsync = util.promisify(fs.readFile);
const { fileExists } = require('./utils');

// Load a single file as context
async function loadFileContext(filePath) {
  try {
    if (!fileExists(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    
    // Check if file is too large (> 1MB)
    if (stats.size > 1024 * 1024) {
      console.warn(chalk.yellow(`Warning: File ${filePath} is large (${Math.round(stats.size / 1024)}KB). This may consume a significant portion of the context window.`));
    }
    
    const content = await readFileAsync(filePath, 'utf8');
    return content;
  } catch (error) {
    throw new Error(`Error loading file ${filePath}: ${error.message}`);
  }
}

// Load multiple files as context
async function loadFileContexts(filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return '';
  }

  let combinedContext = '';
  
  for (const filePath of filePaths) {
    try {
      // Skip paths that look like they might be part of the query
      if (filePath.startsWith('"') || filePath.includes('?')) {
        // console.warn(chalk.yellow(`Skipping possible query text as file path: ${filePath}`));
        continue;
      }
      
      const content = await loadFileContext(filePath);
      combinedContext += `--- File: ${filePath} ---\n\n${content}\n\n`;
      console.log(chalk.green(`Loaded file as context: ${filePath}`));
    } catch (error) {
      console.error(chalk.red(error.message));
    }
  }

  return combinedContext;
}

// Determine file type from extension
function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  const fileTypes = {
    '.js': 'JavaScript',
    '.jsx': 'React JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'React TypeScript',
    '.py': 'Python',
    '.java': 'Java',
    '.c': 'C',
    '.cpp': 'C++',
    '.cs': 'C#',
    '.go': 'Go',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.html': 'HTML',
    '.css': 'CSS',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.txt': 'Text',
    '.yml': 'YAML',
    '.yaml': 'YAML',
    '.xml': 'XML',
    '.csv': 'CSV',
    '.sql': 'SQL'
  };
  
  return fileTypes[ext] || 'Unknown';
}

// Format file content with appropriate context
function formatFileContext(filePath, content) {
  const fileType = getFileType(filePath);
  const fileName = path.basename(filePath);
  
  return `File: ${fileName} (${fileType})\n\n${content}\n`;
}

module.exports = {
  loadFileContext,
  loadFileContexts,
  getFileType,
  formatFileContext
};