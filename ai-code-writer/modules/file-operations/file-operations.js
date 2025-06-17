/**
 * File Operations Module
 * Provides comprehensive file and directory operations
 */

const fs = require('fs');
const path = require('path');
const Logger = require('../../utils/logger');
const ResponseFormatter = require('../../utils/response-formatter');

class FileOperations {
  constructor() {
    this.logger = new Logger('FileOperations');
    this.responseFormatter = new ResponseFormatter();
  }

  getTools() {
    return [
      {
        name: 'advanced_file_operations',
        description: 'Comprehensive file and directory operations',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['create', 'read', 'update', 'delete', 'copy', 'move', 'search', 'analyze'],
              description: 'Type of file operation'
            },
            target_path: {
              type: 'string',
              description: 'Path to target file or directory'
            },
            content: {
              type: 'string',
              description: 'Content for create/update operations'
            },
            options: {
              type: 'object',
              description: 'Additional options for the operation'
            }
          },
          required: ['operation', 'target_path']
        }
      }
    ];
  }

  async advancedFileOperations(args) {
    try {
      const { operation, target_path, content, options = {} } = args;
      
      this.logger.info(`Performing ${operation} operation on ${target_path}`);
      
      switch (operation) {
        case 'create':
          return await this.createFile(target_path, content, options);
        case 'read':
          return await this.readFile(target_path, options);
        case 'update':
          return await this.updateFile(target_path, content, options);
        case 'delete':
          return await this.deleteFile(target_path, options);
        case 'copy':
          return await this.copyFile(target_path, options.destination, options);
        case 'move':
          return await this.moveFile(target_path, options.destination, options);
        case 'search':
          return await this.searchFiles(target_path, options);
        case 'analyze':
          return await this.analyzeFile(target_path, options);
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      this.logger.error(`File operation failed:`, error.message);
      throw new Error(`File operation failed: ${error.message}`);
    }
  }

  async createFile(filePath, content, options) {
    const resolvedPath = path.resolve(filePath);
    const directory = path.dirname(resolvedPath);
    
    // Create directory if it doesn't exist
    await fs.mkdir(directory, { recursive: true });
    
    // Write file
    await fs.writeFile(resolvedPath, content || '', 'utf8');
    
    const stats = await fs.stat(resolvedPath);
    
    const result = {
      operation: 'create',
      success: true,
      path: resolvedPath,
      size: stats.size,
      created_at: stats.birthtime,
      content_preview: content ? content.substring(0, 200) + (content.length > 200 ? '...' : '') : ''
    };
    
    return this.responseFormatter.formatResponse(result, {
      type: 'text',
      prettify: true
    });
  }

  async readFile(filePath, options) {
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf8');
    const stats = await fs.stat(resolvedPath);
    
    // Apply options
    let processedContent = content;
    if (options.lines) {
      const lines = content.split('\n');
      const { start = 0, end = lines.length } = options.lines;
      processedContent = lines.slice(start, end).join('\n');
    }
    
    if (options.maxLength && processedContent.length > options.maxLength) {
      processedContent = processedContent.substring(0, options.maxLength) + '... [truncated]';
    }
    
    const result = {
      operation: 'read',
      success: true,
      path: resolvedPath,
      size: stats.size,
      modified_at: stats.mtime,
      content: processedContent,
      truncated: content.length !== processedContent.length
    };
    
    return this.responseFormatter.formatResponse(result, {
      type: 'text',
      prettify: true
    });
  }

  async updateFile(filePath, content, options) {
    const resolvedPath = path.resolve(filePath);
    
    // Backup original if requested
    if (options.backup) {
      const backupPath = `${resolvedPath}.backup.${Date.now()}`;
      await fs.copyFile(resolvedPath, backupPath);
    }
    
    await fs.writeFile(resolvedPath, content, 'utf8');
    const stats = await fs.stat(resolvedPath);
    
    const result = {
      operation: 'update',
      success: true,
      path: resolvedPath,
      size: stats.size,
      modified_at: stats.mtime,
      backup_created: !!options.backup
    };
    
    return this.responseFormatter.formatResponse(result, {
      type: 'text',
      prettify: true
    });
  }

  async deleteFile(filePath, options) {
    const resolvedPath = path.resolve(filePath);
    const stats = await fs.stat(resolvedPath);
    
    if (stats.isDirectory()) {
      await fs.rmdir(resolvedPath, { recursive: options.recursive || false });
    } else {
      await fs.unlink(resolvedPath);
    }
    
    const result = {
      operation: 'delete',
      success: true,
      path: resolvedPath,
      was_directory: stats.isDirectory(),
      deleted_at: new Date().toISOString()
    };
    
    return this.responseFormatter.formatResponse(result, {
      type: 'text',
      prettify: true
    });
  }

  async copyFile(sourcePath, destPath, options) {
    const resolvedSource = path.resolve(sourcePath);
    const resolvedDest = path.resolve(destPath);
    
    await fs.copyFile(resolvedSource, resolvedDest);
    const stats = await fs.stat(resolvedDest);
    
    const result = {
      operation: 'copy',
      success: true,
      source: resolvedSource,
      destination: resolvedDest,
      size: stats.size,
      copied_at: new Date().toISOString()
    };
    
    return this.responseFormatter.formatResponse(result, {
      type: 'text',
      prettify: true
    });
  }

  async moveFile(sourcePath, destPath, options) {
    const resolvedSource = path.resolve(sourcePath);
    const resolvedDest = path.resolve(destPath);
    
    await fs.rename(resolvedSource, resolvedDest);
    const stats = await fs.stat(resolvedDest);
    
    const result = {
      operation: 'move',
      success: true,
      source: resolvedSource,
      destination: resolvedDest,
      size: stats.size,
      moved_at: new Date().toISOString()
    };
    
    return this.responseFormatter.formatResponse(result, {
      type: 'text',
      prettify: true
    });
  }

  async searchFiles(searchPath, options) {
    const { pattern, content_search, file_types, max_results = 100 } = options;
    const resolvedPath = path.resolve(searchPath);
    const results = [];
    
    await this.searchRecursive(resolvedPath, pattern, content_search, file_types, results, max_results);
    
    const result = {
      operation: 'search',
      success: true,
      search_path: resolvedPath,
      pattern,
      content_search,
      results_count: results.length,
      results: results.slice(0, max_results)
    };
    
    return this.responseFormatter.formatResponse(result, {
      type: 'text',
      prettify: true
    });
  }

  async searchRecursive(dir, pattern, contentSearch, fileTypes, results, maxResults) {
    if (results.length >= maxResults) return;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (results.length >= maxResults) break;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this.searchRecursive(fullPath, pattern, contentSearch, fileTypes, results, maxResults);
        } else if (entry.isFile()) {
          // Check file type filter
          if (fileTypes && fileTypes.length > 0) {
            const ext = path.extname(entry.name);
            if (!fileTypes.includes(ext)) continue;
          }
          
          // Check filename pattern
          let matches = true;
          if (pattern) {
            const regex = new RegExp(pattern, 'i');
            matches = regex.test(entry.name);
          }
          
          // Check content if needed
          let contentMatch = false;
          if (matches && contentSearch) {
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const contentRegex = new RegExp(contentSearch, 'i');
              contentMatch = contentRegex.test(content);
            } catch (error) {
              // Skip files that can't be read
              continue;
            }
          }
          
          if (matches && (!contentSearch || contentMatch)) {
            const stats = await fs.stat(fullPath);
            results.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
              modified: stats.mtime,
              content_match: contentMatch
            });
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  async analyzeFile(filePath, options) {
    const resolvedPath = path.resolve(filePath);
    const stats = await fs.stat(resolvedPath);
    const content = await fs.readFile(resolvedPath, 'utf8');
    
    const analysis = {
      path: resolvedPath,
      name: path.basename(resolvedPath),
      extension: path.extname(resolvedPath),
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      lines: content.split('\n').length,
      characters: content.length,
      words: content.split(/\s+/).filter(word => word.length > 0).length,
      encoding: 'utf8',
      is_binary: this.isBinary(content),
      language: this.detectLanguage(resolvedPath, content)
    };
    
    const result = {
      operation: 'analyze',
      success: true,
      analysis
    };
    
    return this.responseFormatter.formatResponse(result, {
      type: 'text',
      prettify: true
    });
  }

  isBinary(content) {
    // Simple binary detection
    for (let i = 0; i < Math.min(1000, content.length); i++) {
      const code = content.charCodeAt(i);
      if (code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
        return true;
      }
    }
    return false;
  }

  detectLanguage(filePath, content) {
    const ext = path.extname(filePath).toLowerCase();
    const languages = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.c': 'C',
      '.cpp': 'C++',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.json': 'JSON',
      '.xml': 'XML',
      '.html': 'HTML',
      '.css': 'CSS',
      '.md': 'Markdown',
      '.txt': 'Text',
      '.yml': 'YAML',
      '.yaml': 'YAML'
    };
    
    return languages[ext] || 'Unknown';
  }
}

module.exports = FileOperations;

