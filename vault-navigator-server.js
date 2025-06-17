#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');

class VaultNavigatorServer {
  constructor() {
    this.server = new Server(
      {
        name: 'vault-navigator-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_vault_structure',
          description: 'Get complete vault directory structure with file counts',
          inputSchema: {
            type: 'object',
            properties: {
              maxDepth: {
                type: 'number',
                description: 'Maximum directory depth to traverse',
                default: 5,
              },
              includeFiles: {
                type: 'boolean',
                description: 'Include individual files in output',
                default: false,
              },
            },
            required: [],
          },
        },
        {
          name: 'suggest_file_paths',
          description: 'Suggest file paths based on partial input or content similarity',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Partial filename or content to search for',
              },
              maxSuggestions: {
                type: 'number',
                description: 'Maximum number of suggestions to return',
                default: 10,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'create_directory_structure',
          description: 'Create multiple directories with optional template files',
          inputSchema: {
            type: 'object',
            properties: {
              structure: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' },
                    template: { type: 'string' },
                  },
                  required: ['path'],
                },
                description: 'Array of directory/file structures to create',
              },
            },
            required: ['structure'],
          },
        },
        {
          name: 'index_vault_content',
          description: 'Create comprehensive index of all vault content with metadata',
          inputSchema: {
            type: 'object',
            properties: {
              includeContent: {
                type: 'boolean',
                description: 'Include file content excerpts in index',
                default: false,
              },
              sortBy: {
                type: 'string',
                enum: ['name', 'size', 'modified', 'created'],
                description: 'Sort files by specified criteria',
                default: 'name',
              },
            },
            required: [],
          },
        },
        {
          name: 'find_orphaned_files',
          description: 'Find files with no incoming or outgoing links',
          inputSchema: {
            type: 'object',
            properties: {
              includeImages: {
                type: 'boolean',
                description: 'Include image files in orphan search',
                default: false,
              },
            },
            required: [],
          },
        },
        {
          name: 'analyze_vault_metrics',
          description: 'Generate comprehensive vault analytics and metrics',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'smart_path_resolver',
          description: 'Intelligently resolve relative paths with suggestions',
          inputSchema: {
            type: 'object',
            properties: {
              partialPath: {
                type: 'string',
                description: 'Partial or ambiguous file path',
              },
            },
            required: ['partialPath'],
          },
        },
        {
          name: 'create_vault_backup_index',
          description: 'Create backup index with file checksums and metadata',
          inputSchema: {
            type: 'object',
            properties: {
              includeChecksums: {
                type: 'boolean',
                description: 'Include file checksums for integrity verification',
                default: true,
              },
            },
            required: [],
          },
        },
        {
          name: 'search_by_file_properties',
          description: 'Advanced search by file size, date, extension, etc.',
          inputSchema: {
            type: 'object',
            properties: {
              minSize: { type: 'number', description: 'Minimum file size in bytes' },
              maxSize: { type: 'number', description: 'Maximum file size in bytes' },
              extension: { type: 'string', description: 'File extension filter' },
              modifiedAfter: { type: 'string', description: 'ISO date string' },
              modifiedBefore: { type: 'string', description: 'ISO date string' },
            },
            required: [],
          },
        },
        {
          name: 'generate_sitemap',
          description: 'Generate hierarchical sitemap of vault structure',
          inputSchema: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                enum: ['markdown', 'json', 'xml'],
                description: 'Output format for sitemap',
                default: 'markdown',
              },
            },
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_vault_structure':
          return await this.getVaultStructure(request.params.arguments);
        case 'suggest_file_paths':
          return await this.suggestFilePaths(request.params.arguments);
        case 'create_directory_structure':
          return await this.createDirectoryStructure(request.params.arguments);
        case 'index_vault_content':
          return await this.indexVaultContent(request.params.arguments);
        case 'find_orphaned_files':
          return await this.findOrphanedFiles(request.params.arguments);
        case 'analyze_vault_metrics':
          return await this.analyzeVaultMetrics(request.params.arguments);
        case 'smart_path_resolver':
          return await this.smartPathResolver(request.params.arguments);
        case 'create_vault_backup_index':
          return await this.createVaultBackupIndex(request.params.arguments);
        case 'search_by_file_properties':
          return await this.searchByFileProperties(request.params.arguments);
        case 'generate_sitemap':
          return await this.generateSitemap(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  getVaultPath() {
    const vaultPath = process.env.VAULT_PATH || 'G:\\SmartGrowth';
    console.error(`[DEBUG] VAULT_PATH: ${vaultPath}`);
    console.error(`[DEBUG] Current working directory: ${process.cwd()}`);
    console.error(`[DEBUG] Environment variables: NODE_ENV=${process.env.NODE_ENV}, MCP_SERVER_NAME=${process.env.MCP_SERVER_NAME}`);
    return vaultPath;
  }

  resolvePath(inputPath) {
    const vaultPath = this.getVaultPath();
    return path.isAbsolute(inputPath) ? inputPath : path.join(vaultPath, inputPath);
  }

  async getVaultStructure({ maxDepth = 5, includeFiles = false }) {
    try {
      const vaultPath = this.getVaultPath();
      const structure = await this.buildDirectoryTree(vaultPath, 0, maxDepth, includeFiles);
      
      return {
        content: [
          {
            type: 'text',
            text: `Vault Structure (${vaultPath}):\n\n${this.formatDirectoryTree(structure)}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Error getting vault structure: ${error.message}`);
    }
  }

  async buildDirectoryTree(dirPath, currentDepth, maxDepth, includeFiles) {
    if (currentDepth >= maxDepth) return null;
    
    const items = await fs.readdir(dirPath);
    const tree = { name: path.basename(dirPath), type: 'directory', children: [], fileCount: 0 };
    
    for (const item of items) {
      if (item.startsWith('.')) continue; // Skip hidden files
      
      const itemPath = path.join(dirPath, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        const subtree = await this.buildDirectoryTree(itemPath, currentDepth + 1, maxDepth, includeFiles);
        if (subtree) {
          tree.children.push(subtree);
          tree.fileCount += subtree.fileCount;
        }
      } else if (includeFiles) {
        tree.children.push({
          name: item,
          type: 'file',
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
        tree.fileCount++;
      } else {
        tree.fileCount++;
      }
    }
    
    return tree;
  }

  formatDirectoryTree(tree, indent = '') {
    if (!tree) return '';
    
    let result = `${indent}📁 ${tree.name}/`;
    if (tree.fileCount > 0) {
      result += ` (${tree.fileCount} files)`;
    }
    result += '\n';
    
    tree.children.forEach((child, index) => {
      const isLast = index === tree.children.length - 1;
      const childIndent = indent + (isLast ? '    ' : '│   ');
      const prefix = isLast ? '└── ' : '├── ';
      
      if (child.type === 'directory') {
        result += `${indent}${prefix}`;
        result += this.formatDirectoryTree(child, childIndent).slice(indent.length + prefix.length);
      } else {
        result += `${indent}${prefix}📄 ${child.name} (${child.size} bytes)\n`;
      }
    });
    
    return result;
  }

  async suggestFilePaths({ query, maxSuggestions = 10 }) {
    try {
      const vaultPath = this.getVaultPath();
      const allFiles = await this.getAllFiles(vaultPath);
      const suggestions = [];
      
      for (const file of allFiles) {
        const relativePath = path.relative(vaultPath, file);
        const fileName = path.basename(file);
        
        // Score based on filename match
        let score = 0;
        if (fileName.toLowerCase().includes(query.toLowerCase())) {
          score += 10;
        }
        if (relativePath.toLowerCase().includes(query.toLowerCase())) {
          score += 5;
        }
        
        // Boost score for exact matches
        if (fileName.toLowerCase() === query.toLowerCase()) {
          score += 20;
        }
        
        if (score > 0) {
          suggestions.push({ path: relativePath, score, fileName });
        }
      }
      
      suggestions.sort((a, b) => b.score - a.score);
      const topSuggestions = suggestions.slice(0, maxSuggestions);
      
      if (topSuggestions.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No file paths found matching "${query}"`,
            },
          ],
        };
      }
      
      const suggestionText = topSuggestions
        .map(({ path, fileName }) => `- ${path} (${fileName})`)
        .join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `File path suggestions for "${query}":\n\n${suggestionText}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Error suggesting file paths: ${error.message}`);
    }
  }

  async createDirectoryStructure({ structure }) {
    try {
      const vaultPath = this.getVaultPath();
      const created = [];
      
      for (const item of structure) {
        const fullPath = this.resolvePath(item.path);
        
        if (item.path.endsWith('/') || !path.extname(item.path)) {
          // It's a directory
          await fs.mkdir(fullPath, { recursive: true });
          created.push(`📁 ${item.path}`);
        } else {
          // It's a file
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          const content = item.template || `# ${path.basename(item.path, path.extname(item.path))}\n\nCreated: ${new Date().toISOString()}`;
          await fs.writeFile(fullPath, content, 'utf8');
          created.push(`📄 ${item.path}`);
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully created directory structure:\n\n${created.join('\n')}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Error creating directory structure: ${error.message}`);
    }
  }

  async indexVaultContent({ includeContent = false, sortBy = 'name' }) {
    try {
      const vaultPath = this.getVaultPath();
      const allFiles = await this.getAllFiles(vaultPath);
      const index = [];
      
      for (const file of allFiles) {
        const stat = await fs.stat(file);
        const relativePath = path.relative(vaultPath, file);
        
        const fileInfo = {
          path: relativePath,
          name: path.basename(file),
          extension: path.extname(file),
          size: stat.size,
          modified: stat.mtime,
          created: stat.birthtime,
        };
        
        if (includeContent && file.endsWith('.md')) {
          try {
            const content = await fs.readFile(file, 'utf8');
            fileInfo.preview = content.slice(0, 200) + (content.length > 200 ? '...' : '');
            fileInfo.wordCount = content.split(/\s+/).length;
          } catch (err) {
            fileInfo.preview = '[Could not read content]';
          }
        }
        
        index.push(fileInfo);
      }
      
      // Sort the index
      index.sort((a, b) => {
        switch (sortBy) {
          case 'size':
            return b.size - a.size;
          case 'modified':
            return new Date(b.modified) - new Date(a.modified);
          case 'created':
            return new Date(b.created) - new Date(a.created);
          default:
            return a.name.localeCompare(b.name);
        }
      });
      
      // Create index content
      let indexContent = `# Vault Content Index\n\nGenerated: ${new Date().toISOString()}\nTotal Files: ${index.length}\nSorted by: ${sortBy}\n\n`;
      
      index.forEach(file => {
        indexContent += `## ${file.name}\n`;
        indexContent += `- **Path:** ${file.path}\n`;
        indexContent += `- **Size:** ${file.size} bytes\n`;
        indexContent += `- **Modified:** ${file.modified.toISOString()}\n`;
        if (file.wordCount) {
          indexContent += `- **Words:** ${file.wordCount}\n`;
        }
        if (file.preview) {
          indexContent += `- **Preview:** ${file.preview}\n`;
        }
        indexContent += '\n';
      });
      
      const indexPath = path.join(vaultPath, 'Vault-Content-Index.md');
      await fs.writeFile(indexPath, indexContent, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully created vault content index at ${indexPath}\n\nIndexed ${index.length} files, sorted by ${sortBy}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Error indexing vault content: ${error.message}`);
    }
  }

  async findOrphanedFiles({ includeImages = false }) {
    try {
      const vaultPath = this.getVaultPath();
      const allFiles = await this.getAllFiles(vaultPath);
      const markdownFiles = allFiles.filter(f => f.endsWith('.md'));
      const allLinks = new Set();
      const orphans = [];
      
      // Collect all links from all files
      for (const file of markdownFiles) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const wikiLinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
          const markdownLinks = content.match(/\[.*?\]\(([^)]+)\)/g) || [];
          
          wikiLinks.forEach(link => {
            const cleanLink = link.replace(/\[\[|\]\]/g, '').split('|')[0];
            allLinks.add(cleanLink);
          });
          
          markdownLinks.forEach(link => {
            const url = link.match(/\[.*?\]\(([^)]+)\)/)[1];
            if (!url.startsWith('http')) {
              allLinks.add(url);
            }
          });
        } catch (err) {
          continue;
        }
      }
      
      // Check each file for links
      const filesToCheck = includeImages ? allFiles : markdownFiles;
      
      for (const file of filesToCheck) {
        const fileName = path.basename(file, path.extname(file));
        const relativePath = path.relative(vaultPath, file);
        
        let hasIncomingLinks = false;
        for (const link of allLinks) {
          if (link.includes(fileName) || link.includes(relativePath)) {
            hasIncomingLinks = true;
            break;
          }
        }
        
        if (!hasIncomingLinks) {
          // Check if file has outgoing links (for markdown files)
          let hasOutgoingLinks = false;
          if (file.endsWith('.md')) {
            try {
              const content = await fs.readFile(file, 'utf8');
              hasOutgoingLinks = /\[\[.*?\]\]|\[.*?\]\(.*?\)/.test(content);
            } catch (err) {
              // Continue
            }
          }
          
          if (!hasOutgoingLinks) {
            orphans.push(relativePath);
          }
        }
      }
      
      if (orphans.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No orphaned files found in the vault! All files are well connected.',
            },
          ],
        };
      }
      
      const orphanList = orphans.map(file => `- ${file}`).join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${orphans.length} orphaned files:\n\n${orphanList}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Error finding orphaned files: ${error.message}`);
    }
  }

  async analyzeVaultMetrics() {
    try {
      const vaultPath = this.getVaultPath();
      const allFiles = await this.getAllFiles(vaultPath);
      
      const metrics = {
        totalFiles: allFiles.length,
        markdownFiles: 0,
        imageFiles: 0,
        otherFiles: 0,
        totalSize: 0,
        totalWords: 0,
        averageFileSize: 0,
        largestFile: { name: '', size: 0 },
        oldestFile: { name: '', date: new Date() },
        newestFile: { name: '', date: new Date(0) },
        filesByExtension: {},
        directories: 0,
      };
      
      for (const file of allFiles) {
        const stat = await fs.stat(file);
        const ext = path.extname(file).toLowerCase();
        const fileName = path.basename(file);
        
        metrics.totalSize += stat.size;
        
        // Track by extension
        metrics.filesByExtension[ext] = (metrics.filesByExtension[ext] || 0) + 1;
        
        // Categorize files
        if (ext === '.md') {
          metrics.markdownFiles++;
          try {
            const content = await fs.readFile(file, 'utf8');
            metrics.totalWords += content.split(/\s+/).length;
          } catch (err) {
            // Continue
          }
        } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
          metrics.imageFiles++;
        } else {
          metrics.otherFiles++;
        }
        
        // Track largest file
        if (stat.size > metrics.largestFile.size) {
          metrics.largestFile = { name: fileName, size: stat.size };
        }
        
        // Track oldest/newest files
        if (stat.mtime < metrics.oldestFile.date) {
          metrics.oldestFile = { name: fileName, date: stat.mtime };
        }
        if (stat.mtime > metrics.newestFile.date) {
          metrics.newestFile = { name: fileName, date: stat.mtime };
        }
      }
      
      // Count directories
      const allItems = await this.getAllDirectories(vaultPath);
      metrics.directories = allItems.length;
      
      metrics.averageFileSize = metrics.totalFiles > 0 ? Math.round(metrics.totalSize / metrics.totalFiles) : 0;
      
      // Format metrics report
      let report = `# Vault Analytics Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
      report += `## Overview\n`;
      report += `- **Total Files:** ${metrics.totalFiles}\n`;
      report += `- **Directories:** ${metrics.directories}\n`;
      report += `- **Total Size:** ${this.formatBytes(metrics.totalSize)}\n`;
      report += `- **Average File Size:** ${this.formatBytes(metrics.averageFileSize)}\n\n`;
      
      report += `## File Types\n`;
      report += `- **Markdown Files:** ${metrics.markdownFiles}\n`;
      report += `- **Image Files:** ${metrics.imageFiles}\n`;
      report += `- **Other Files:** ${metrics.otherFiles}\n\n`;
      
      report += `## Content Statistics\n`;
      report += `- **Total Words:** ${metrics.totalWords.toLocaleString()}\n`;
      report += `- **Average Words per MD File:** ${metrics.markdownFiles > 0 ? Math.round(metrics.totalWords / metrics.markdownFiles) : 0}\n\n`;
      
      report += `## File Records\n`;
      report += `- **Largest File:** ${metrics.largestFile.name} (${this.formatBytes(metrics.largestFile.size)})\n`;
      report += `- **Oldest File:** ${metrics.oldestFile.name} (${metrics.oldestFile.date.toLocaleDateString()})\n`;
      report += `- **Newest File:** ${metrics.newestFile.name} (${metrics.newestFile.date.toLocaleDateString()})\n\n`;
      
      report += `## Extensions Breakdown\n`;
      Object.entries(metrics.filesByExtension)
        .sort((a, b) => b[1] - a[1])
        .forEach(([ext, count]) => {
          report += `- **${ext || '[no extension]'}:** ${count} files\n`;
        });
      
      const reportPath = path.join(vaultPath, 'Vault-Analytics-Report.md');
      await fs.writeFile(reportPath, report, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: report,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Error analyzing vault metrics: ${error.message}`);
    }
  }

  async smartPathResolver({ partialPath }) {
    try {
      const vaultPath = this.getVaultPath();
      const allFiles = await this.getAllFiles(vaultPath);
      const matches = [];
      
      for (const file of allFiles) {
        const relativePath = path.relative(vaultPath, file);
        const fileName = path.basename(file);
        
        // Different matching strategies
        if (relativePath.toLowerCase().includes(partialPath.toLowerCase())) {
          matches.push({
            path: relativePath,
            type: 'path_contains',
            confidence: 0.8,
          });
        } else if (fileName.toLowerCase().includes(partialPath.toLowerCase())) {
          matches.push({
            path: relativePath,
            type: 'filename_contains',
            confidence: 0.6,
          });
        } else if (this.fuzzyMatch(fileName, partialPath)) {
          matches.push({
            path: relativePath,
            type: 'fuzzy_match',
            confidence: 0.4,
          });
        }
      }
      
      // Sort by confidence
      matches.sort((a, b) => b.confidence - a.confidence);
      const topMatches = matches.slice(0, 10);
      
      if (topMatches.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No matches found for "${partialPath}". Try a different search term or check the spelling.`,
            },
          ],
        };
      }
      
      const matchText = topMatches
        .map(({ path, type, confidence }) => 
          `- ${path} (${type}, ${Math.round(confidence * 100)}% confidence)`
        )
        .join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Smart path resolution for "${partialPath}":\n\n${matchText}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Error resolving path: ${error.message}`);
    }
  }

  async createVaultBackupIndex({ includeChecksums = true }) {
    try {
      const vaultPath = this.getVaultPath();
      const allFiles = await this.getAllFiles(vaultPath);
      const crypto = require('crypto');
      
      const backupIndex = {
        timestamp: new Date().toISOString(),
        vaultPath: vaultPath,
        totalFiles: allFiles.length,
        files: [],
      };
      
      for (const file of allFiles) {
        const stat = await fs.stat(file);
        const relativePath = path.relative(vaultPath, file);
        
        const fileInfo = {
          path: relativePath,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          created: stat.birthtime.toISOString(),
        };
        
        if (includeChecksums) {
          try {
            const content = await fs.readFile(file);
            fileInfo.checksum = crypto.createHash('sha256').update(content).digest('hex');
          } catch (err) {
            fileInfo.checksum = 'ERROR';
          }
        }
        
        backupIndex.files.push(fileInfo);
      }
      
      const indexPath = path.join(vaultPath, 'Vault-Backup-Index.json');
      await fs.writeFile(indexPath, JSON.stringify(backupIndex, null, 2), 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully created backup index at ${indexPath}\n\nIndexed ${backupIndex.totalFiles} files${includeChecksums ? ' with checksums' : ''}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Error creating backup index: ${error.message}`);
    }
  }

  async searchByFileProperties({ minSize, maxSize, extension, modifiedAfter, modifiedBefore }) {
    try {
      const vaultPath = this.getVaultPath();
      const allFiles = await this.getAllFiles(vaultPath);
      const matches = [];
      
      for (const file of allFiles) {
        const stat = await fs.stat(file);
        const relativePath = path.relative(vaultPath, file);
        const fileExt = path.extname(file);
        
        let matchesCriteria = true;
        
        if (minSize !== undefined && stat.size < minSize) matchesCriteria = false;
        if (maxSize !== undefined && stat.size > maxSize) matchesCriteria = false;
        if (extension && fileExt !== extension) matchesCriteria = false;
        if (modifiedAfter && stat.mtime < new Date(modifiedAfter)) matchesCriteria = false;
        if (modifiedBefore && stat.mtime > new Date(modifiedBefore)) matchesCriteria = false;
        
        if (matchesCriteria) {
          matches.push({
            path: relativePath,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            extension: fileExt,
          });
        }
      }
      
      if (matches.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No files found matching the specified criteria.',
            },
          ],
        };
      }
      
      const resultText = matches
        .map(({ path, size, modified, extension }) => 
          `- ${path} (${this.formatBytes(size)}, ${extension}, modified: ${new Date(modified).toLocaleDateString()})`
        )
        .join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${matches.length} files matching criteria:\n\n${resultText}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Error searching by file properties: ${error.message}`);
    }
  }

  async generateSitemap({ format = 'markdown' }) {
    try {
      const vaultPath = this.getVaultPath();
      const structure = await this.buildDirectoryTree(vaultPath, 0, 10, true);
      
      let sitemap;
      let fileName;
      
      switch (format) {
        case 'json':
          sitemap = JSON.stringify(structure, null, 2);
          fileName = 'Vault-Sitemap.json';
          break;
        case 'xml':
          sitemap = this.convertToXML(structure);
          fileName = 'Vault-Sitemap.xml';
          break;
        default:
          sitemap = this.convertToMarkdownSitemap(structure);
          fileName = 'Vault-Sitemap.md';
      }
      
      const sitemapPath = path.join(vaultPath, fileName);
      await fs.writeFile(sitemapPath, sitemap, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully generated ${format} sitemap at ${sitemapPath}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Error generating sitemap: ${error.message}`);
    }
  }

  // Helper methods
  async getAllFiles(dir) {
    const files = [];
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      if (item.startsWith('.')) continue;
      
      const itemPath = path.join(dir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        const subFiles = await this.getAllFiles(itemPath);
        files.push(...subFiles);
      } else {
        files.push(itemPath);
      }
    }
    
    return files;
  }

  async getAllDirectories(dir) {
    const directories = [];
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      if (item.startsWith('.')) continue;
      
      const itemPath = path.join(dir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        directories.push(itemPath);
        const subDirs = await this.getAllDirectories(itemPath);
        directories.push(...subDirs);
      }
    }
    
    return directories;
  }

  fuzzyMatch(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length > 0.6;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  convertToMarkdownSitemap(tree, depth = 0) {
    if (!tree) return '';
    
    let result = `# Vault Sitemap\n\nGenerated: ${new Date().toISOString()}\n\n`;
    result += this.formatSitemapTree(tree, '');
    return result;
  }

  formatSitemapTree(tree, indent) {
    let result = `${indent}- **${tree.name}/**\n`;
    
    tree.children.forEach(child => {
      if (child.type === 'directory') {
        result += this.formatSitemapTree(child, indent + '  ');
      } else {
        result += `${indent}  - ${child.name}\n`;
      }
    });
    
    return result;
  }

  convertToXML(tree) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemap>\n';
    xml += this.formatXMLTree(tree, '  ');
    xml += '</sitemap>';
    return xml;
  }

  formatXMLTree(tree, indent) {
    let result = `${indent}<directory name="${tree.name}">\n`;
    
    tree.children.forEach(child => {
      if (child.type === 'directory') {
        result += this.formatXMLTree(child, indent + '  ');
      } else {
        result += `${indent}  <file name="${child.name}" size="${child.size}" />\n`;
      }
    });
    
    result += `${indent}</directory>\n`;
    return result;
  }

  errorResponse(message) {
    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
      isError: true,
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Vault Navigator MCP server running on stdio');
  }
}

const server = new VaultNavigatorServer();
server.run().catch(console.error);

