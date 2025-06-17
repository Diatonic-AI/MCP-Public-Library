/**
 * Filesystem Analysis Module
 * Provides comprehensive filesystem analysis utilities for AI context generation
 */

const fs = require('fs').promises;
const path = require('path');
const Logger = require('../../utils/logger');
const ResponseFormatter = require('../../utils/response-formatter');

class FilesystemAnalysis {
  constructor() {
    this.logger = new Logger('FilesystemAnalysis');
    this.responseFormatter = new ResponseFormatter();
    
    // File type categories for analysis
    this.fileCategories = {
      code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.rb', '.go', '.rs', '.php', '.swift', '.kt'],
      markup: ['.html', '.xml', '.jsx', '.tsx', '.vue', '.svelte'],
      styles: ['.css', '.scss', '.sass', '.less', '.styl'],
      config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.cfg', '.env'],
      docs: ['.md', '.txt', '.rst', '.adoc', '.tex'],
      images: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.bmp', '.webp', '.ico'],
      archives: ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2'],
      executables: ['.exe', '.msi', '.app', '.deb', '.rpm', '.dmg', '.bin'],
      data: ['.csv', '.tsv', '.xlsx', '.xls', '.db', '.sqlite', '.json', '.xml']
    };
    
    // Size categories in bytes
    this.sizeCategories = {
      tiny: 1024,           // < 1KB
      small: 10240,         // 1KB - 10KB
      medium: 1048576,      // 10KB - 1MB
      large: 104857600,     // 1MB - 100MB
      huge: Infinity        // > 100MB
    };
  }

  getTools() {
    return [
      {
        name: 'analyze_structure',
        description: 'Analyze directory structure with file counts by type and size distribution',
        inputSchema: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory path to analyze'
            },
            max_depth: {
              type: 'number',
              description: 'Maximum depth to traverse (default: 5)',
              default: 5
            },
            include_hidden: {
              type: 'boolean',
              description: 'Include hidden files and directories (default: false)',
              default: false
            }
          },
          required: ['directory']
        }
      },
      {
        name: 'detect_large_files',
        description: 'Find files larger than specified threshold',
        inputSchema: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory path to search'
            },
            size_threshold: {
              type: 'number',
              description: 'Size threshold in bytes (default: 10MB)',
              default: 10485760
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of results to return (default: 50)',
              default: 50
            }
          },
          required: ['directory']
        }
      },
      {
        name: 'find_executables',
        description: 'Find executable files in directory tree',
        inputSchema: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory path to search'
            },
            include_scripts: {
              type: 'boolean',
              description: 'Include script files (.sh, .bat, .ps1) (default: true)',
              default: true
            }
          },
          required: ['directory']
        }
      },
      {
        name: 'summarize_permissions',
        description: 'Analyze file and directory permissions',
        inputSchema: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory path to analyze'
            },
            check_writable: {
              type: 'boolean',
              description: 'Check for writable files (default: true)',
              default: true
            },
            check_executable: {
              type: 'boolean',
              description: 'Check for executable files (default: true)',
              default: true
            }
          },
          required: ['directory']
        }
      }
    ];
  }

  /**
   * Analyze directory structure with comprehensive statistics
   */
  async analyzeStructure(args) {
    try {
      const { directory, max_depth = 5, include_hidden = false } = args;
      
      this.logger.info(`Analyzing structure of ${directory}`);
      
      const analysis = {
        directory: path.resolve(directory),
        timestamp: new Date().toISOString(),
        total_files: 0,
        total_directories: 0,
        total_size: 0,
        file_types: {},
        size_distribution: {
          tiny: 0,
          small: 0,
          medium: 0,
          large: 0,
          huge: 0
        },
        depth_analysis: {},
        largest_files: [],
        extensions: {},
        summary: {}
      };
      
      await this._traverseDirectory(directory, analysis, 0, max_depth, include_hidden);
      
      // Generate summary statistics
      analysis.summary = this._generateSummary(analysis);
      
      return this.responseFormatter.formatResponse(analysis, {
        type: 'structured',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Structure analysis failed:', error.message);
      throw new Error(`Structure analysis failed: ${error.message}`);
    }
  }

  /**
   * Detect files larger than specified threshold
   */
  async detectLargeFiles(args) {
    try {
      const { directory, size_threshold = 10485760, max_results = 50 } = args;
      
      this.logger.info(`Detecting large files (>${this._formatBytes(size_threshold)}) in ${directory}`);
      
      const largeFiles = [];
      await this._findLargeFiles(directory, size_threshold, largeFiles, max_results);
      
      // Sort by size descending
      largeFiles.sort((a, b) => b.size - a.size);
      
      const result = {
        directory: path.resolve(directory),
        threshold: size_threshold,
        threshold_formatted: this._formatBytes(size_threshold),
        found_count: largeFiles.length,
        total_size: largeFiles.reduce((sum, file) => sum + file.size, 0),
        files: largeFiles.map(file => ({
          ...file,
          size_formatted: this._formatBytes(file.size),
          relative_path: path.relative(directory, file.path)
        })),
        summary: {
          largest_file: largeFiles[0] ? {
            path: largeFiles[0].path,
            size: this._formatBytes(largeFiles[0].size)
          } : null,
          total_size_formatted: this._formatBytes(largeFiles.reduce((sum, file) => sum + file.size, 0))
        }
      };
      
      return this.responseFormatter.formatResponse(result, {
        type: 'structured',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Large file detection failed:', error.message);
      throw new Error(`Large file detection failed: ${error.message}`);
    }
  }

  /**
   * Find executable files in directory tree
   */
  async findExecutables(args) {
    try {
      const { directory, include_scripts = true } = args;
      
      this.logger.info(`Finding executables in ${directory}`);
      
      const executables = [];
      await this._findExecutableFiles(directory, executables, include_scripts);
      
      const result = {
        directory: path.resolve(directory),
        include_scripts,
        found_count: executables.length,
        executables: executables.map(exec => ({
          ...exec,
          relative_path: path.relative(directory, exec.path),
          size_formatted: this._formatBytes(exec.size)
        })),
        by_type: this._groupExecutablesByType(executables),
        summary: {
          binary_executables: executables.filter(e => e.type === 'binary').length,
          script_files: executables.filter(e => e.type === 'script').length,
          total_size: this._formatBytes(executables.reduce((sum, e) => sum + e.size, 0))
        }
      };
      
      return this.responseFormatter.formatResponse(result, {
        type: 'structured',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Executable detection failed:', error.message);
      throw new Error(`Executable detection failed: ${error.message}`);
    }
  }

  /**
   * Analyze file and directory permissions
   */
  async summarizePermissions(args) {
    try {
      const { directory, check_writable = true, check_executable = true } = args;
      
      this.logger.info(`Analyzing permissions in ${directory}`);
      
      const permissions = {
        directory: path.resolve(directory),
        timestamp: new Date().toISOString(),
        total_items: 0,
        readable_files: 0,
        writable_files: 0,
        executable_files: 0,
        permission_issues: [],
        security_concerns: [],
        details: {
          by_permission: {},
          writable_files: [],
          executable_files: [],
          restricted_files: []
        }
      };
      
      await this._analyzePermissions(directory, permissions, check_writable, check_executable);
      
      // Generate security assessment
      permissions.security_assessment = this._assessSecurity(permissions);
      
      return this.responseFormatter.formatResponse(permissions, {
        type: 'structured',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Permission analysis failed:', error.message);
      throw new Error(`Permission analysis failed: ${error.message}`);
    }
  }

  // Private helper methods

  async _traverseDirectory(dirPath, analysis, currentDepth, maxDepth, includeHidden) {
    if (currentDepth > maxDepth) return;
    
    try {
      const items = await fs.readdir(dirPath);
      
      if (!analysis.depth_analysis[currentDepth]) {
        analysis.depth_analysis[currentDepth] = { files: 0, directories: 0 };
      }
      
      for (const item of items) {
        if (!includeHidden && item.startsWith('.')) continue;
        
        const itemPath = path.join(dirPath, item);
        
        try {
          const stats = await fs.stat(itemPath);
          
          if (stats.isDirectory()) {
            analysis.total_directories++;
            analysis.depth_analysis[currentDepth].directories++;
            await this._traverseDirectory(itemPath, analysis, currentDepth + 1, maxDepth, includeHidden);
          } else {
            analysis.total_files++;
            analysis.depth_analysis[currentDepth].files++;
            analysis.total_size += stats.size;
            
            this._categorizeFile(itemPath, stats, analysis);
          }
        } catch (statError) {
          // Skip files that can't be accessed
          this.logger.warn(`Cannot access ${itemPath}: ${statError.message}`);
        }
      }
    } catch (readError) {
      this.logger.warn(`Cannot read directory ${dirPath}: ${readError.message}`);
    }
  }

  _categorizeFile(filePath, stats, analysis) {
    const ext = path.extname(filePath).toLowerCase();
    const size = stats.size;
    
    // Track extensions
    analysis.extensions[ext] = (analysis.extensions[ext] || 0) + 1;
    
    // Categorize by file type
    let category = 'other';
    for (const [cat, extensions] of Object.entries(this.fileCategories)) {
      if (extensions.includes(ext)) {
        category = cat;
        break;
      }
    }
    
    analysis.file_types[category] = (analysis.file_types[category] || 0) + 1;
    
    // Categorize by size
    let sizeCategory = 'huge';
    for (const [sizeCat, threshold] of Object.entries(this.sizeCategories)) {
      if (size < threshold) {
        sizeCategory = sizeCat;
        break;
      }
    }
    
    analysis.size_distribution[sizeCategory]++;
    
    // Track largest files
    analysis.largest_files.push({
      path: filePath,
      size: size,
      modified: stats.mtime
    });
    
    // Keep only top 10 largest files
    if (analysis.largest_files.length > 10) {
      analysis.largest_files.sort((a, b) => b.size - a.size);
      analysis.largest_files = analysis.largest_files.slice(0, 10);
    }
  }

  async _findLargeFiles(dirPath, threshold, results, maxResults) {
    if (results.length >= maxResults) return;
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        if (results.length >= maxResults) break;
        
        const itemPath = path.join(dirPath, item);
        
        try {
          const stats = await fs.stat(itemPath);
          
          if (stats.isDirectory()) {
            await this._findLargeFiles(itemPath, threshold, results, maxResults);
          } else if (stats.size > threshold) {
            results.push({
              path: itemPath,
              size: stats.size,
              modified: stats.mtime,
              extension: path.extname(itemPath)
            });
          }
        } catch (statError) {
          // Skip files that can't be accessed
        }
      }
    } catch (readError) {
      // Skip directories that can't be read
    }
  }

  async _findExecutableFiles(dirPath, results, includeScripts) {
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        
        try {
          const stats = await fs.stat(itemPath);
          
          if (stats.isDirectory()) {
            await this._findExecutableFiles(itemPath, results, includeScripts);
          } else {
            const ext = path.extname(itemPath).toLowerCase();
            const isExecutable = this.fileCategories.executables.includes(ext);
            const isScript = includeScripts && ['.sh', '.bat', '.ps1', '.cmd', '.py', '.pl', '.rb'].includes(ext);
            
            if (isExecutable || isScript) {
              results.push({
                path: itemPath,
                size: stats.size,
                modified: stats.mtime,
                extension: ext,
                type: isExecutable ? 'binary' : 'script'
              });
            }
          }
        } catch (statError) {
          // Skip files that can't be accessed
        }
      }
    } catch (readError) {
      // Skip directories that can't be read
    }
  }

  async _analyzePermissions(dirPath, permissions, checkWritable, checkExecutable) {
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        
        try {
          const stats = await fs.stat(itemPath);
          permissions.total_items++;
          
          // Check basic permissions
          try {
            await fs.access(itemPath, fs.constants.R_OK);
            permissions.readable_files++;
          } catch (e) {
            permissions.permission_issues.push({
              path: itemPath,
              issue: 'not_readable'
            });
          }
          
          if (checkWritable) {
            try {
              await fs.access(itemPath, fs.constants.W_OK);
              permissions.writable_files++;
              permissions.details.writable_files.push({
                path: itemPath,
                size: stats.size,
                type: stats.isDirectory() ? 'directory' : 'file'
              });
            } catch (e) {
              // Not writable - this is often normal
            }
          }
          
          if (checkExecutable && !stats.isDirectory()) {
            try {
              await fs.access(itemPath, fs.constants.X_OK);
              permissions.executable_files++;
              permissions.details.executable_files.push({
                path: itemPath,
                size: stats.size,
                extension: path.extname(itemPath)
              });
            } catch (e) {
              // Not executable - this is often normal
            }
          }
          
          if (stats.isDirectory()) {
            await this._analyzePermissions(itemPath, permissions, checkWritable, checkExecutable);
          }
        } catch (statError) {
          permissions.permission_issues.push({
            path: itemPath,
            issue: 'cannot_stat',
            error: statError.message
          });
        }
      }
    } catch (readError) {
      permissions.permission_issues.push({
        path: dirPath,
        issue: 'cannot_read_directory',
        error: readError.message
      });
    }
  }

  _generateSummary(analysis) {
    const totalFiles = analysis.total_files;
    const totalSize = analysis.total_size;
    
    return {
      overview: {
        total_files: totalFiles,
        total_directories: analysis.total_directories,
        total_size_formatted: this._formatBytes(totalSize),
        average_file_size: totalFiles > 0 ? this._formatBytes(totalSize / totalFiles) : '0 B'
      },
      dominant_file_types: this._getTopCategories(analysis.file_types, 3),
      size_breakdown: {
        small_files: analysis.size_distribution.tiny + analysis.size_distribution.small,
        medium_files: analysis.size_distribution.medium,
        large_files: analysis.size_distribution.large + analysis.size_distribution.huge
      },
      most_common_extensions: this._getTopCategories(analysis.extensions, 5)
    };
  }

  _groupExecutablesByType(executables) {
    const grouped = {};
    
    for (const exec of executables) {
      const ext = exec.extension || 'no_extension';
      if (!grouped[ext]) {
        grouped[ext] = {
          count: 0,
          total_size: 0,
          files: []
        };
      }
      
      grouped[ext].count++;
      grouped[ext].total_size += exec.size;
      grouped[ext].files.push(exec.path);
    }
    
    // Format sizes
    for (const group of Object.values(grouped)) {
      group.total_size_formatted = this._formatBytes(group.total_size);
    }
    
    return grouped;
  }

  _assessSecurity(permissions) {
    const assessment = {
      risk_level: 'low',
      concerns: [],
      recommendations: []
    };
    
    const writableRatio = permissions.writable_files / permissions.total_items;
    const executableRatio = permissions.executable_files / permissions.total_items;
    
    if (writableRatio > 0.5) {
      assessment.concerns.push('High percentage of writable files');
      assessment.risk_level = 'medium';
    }
    
    if (executableRatio > 0.1) {
      assessment.concerns.push('High percentage of executable files');
      assessment.risk_level = 'medium';
    }
    
    if (permissions.permission_issues.length > permissions.total_items * 0.1) {
      assessment.concerns.push('Many permission-related issues detected');
      assessment.risk_level = 'high';
    }
    
    // Generate recommendations
    if (assessment.concerns.length === 0) {
      assessment.recommendations.push('File permissions appear to be properly configured');
    } else {
      assessment.recommendations.push('Review file permissions for security compliance');
      assessment.recommendations.push('Consider restricting write access to sensitive files');
    }
    
    return assessment;
  }

  _getTopCategories(obj, limit) {
    return Object.entries(obj)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([key, value]) => ({ category: key, count: value }));
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = FilesystemAnalysis;

