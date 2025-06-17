#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');

class FileManagerServer {
  constructor() {
    this.server = new Server(
      {
        name: 'file-manager-server',
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
          name: 'list_files',
          description: 'List files in a directory with optional filtering',
          inputSchema: {
            type: 'object',
            properties: {
              directory: {
                type: 'string',
                description: 'Directory path to list files from',
                default: '.',
              },
              extension: {
                type: 'string',
                description: 'Filter by file extension (e.g., .md, .txt)',
              },
            },
            required: [],
          },
        },
        {
          name: 'read_file_content',
          description: 'Read the content of a specific file',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the file to read',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'search_files',
          description: 'Search for files containing specific text',
          inputSchema: {
            type: 'object',
            properties: {
              searchTerm: {
                type: 'string',
                description: 'Text to search for in files',
              },
              directory: {
                type: 'string',
                description: 'Directory to search in',
                default: '.',
              },
              fileExtension: {
                type: 'string',
                description: 'File extension to limit search to',
                default: '.md',
              },
            },
            required: ['searchTerm'],
          },
        },
        {
          name: 'create_folder',
          description: 'Create a new folder/directory',
          inputSchema: {
            type: 'object',
            properties: {
              folderPath: {
                type: 'string',
                description: 'Path of the folder to create',
              },
            },
            required: ['folderPath'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'list_files':
          return await this.listFiles(request.params.arguments);
        case 'read_file_content':
          return await this.readFileContent(request.params.arguments);
        case 'search_files':
          return await this.searchFiles(request.params.arguments);
        case 'create_folder':
          return await this.createFolder(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async listFiles({ directory = '.', extension }) {
    try {
      // Resolve directory relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedDirectory = path.isAbsolute(directory) ? directory : path.join(vaultPath, directory);
      
      const files = await fs.readdir(resolvedDirectory);
      let filteredFiles = [];
      
      for (const file of files) {
        const filePath = path.join(resolvedDirectory, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile()) {
          if (!extension || file.endsWith(extension)) {
            filteredFiles.push({
              name: file,
              path: filePath,
              size: stat.size,
              modified: stat.mtime.toISOString(),
            });
          }
        }
      }
      
      const fileList = filteredFiles
        .map(file => `📄 ${file.name} (${file.size} bytes, modified: ${file.modified})`)
        .join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Files in ${directory}${extension ? ` (${extension} files)` : ''}:\n\n${fileList || 'No files found'}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing files: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async readFileContent({ filePath }) {
    try {
      // Resolve file path relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedFilePath = path.isAbsolute(filePath) ? filePath : path.join(vaultPath, filePath);
      
      const content = await fs.readFile(resolvedFilePath, 'utf8');
      const lines = content.split('\n').length;
      const chars = content.length;
      
      return {
        content: [
          {
            type: 'text',
            text: `Content of ${filePath} (${lines} lines, ${chars} characters):\n\n${content}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error reading file: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async searchFiles({ searchTerm, directory = '.', fileExtension = '.md' }) {
    try {
      // Resolve directory relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedDirectory = path.isAbsolute(directory) ? directory : path.join(vaultPath, directory);
      
      const results = [];
      const files = await this.getFilesRecursively(resolvedDirectory, fileExtension);
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          if (content.toLowerCase().includes(searchTerm.toLowerCase())) {
            const lines = content.split('\n');
            const matchingLines = lines
              .map((line, index) => ({ line, number: index + 1 }))
              .filter(({ line }) => line.toLowerCase().includes(searchTerm.toLowerCase()))
              .slice(0, 3); // Limit to first 3 matches per file
            
            results.push({
              file,
              matches: matchingLines,
            });
          }
        } catch (err) {
          // Skip files that can't be read
          continue;
        }
      }
      
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No files found containing "${searchTerm}" in ${directory}`,
            },
          ],
        };
      }
      
      const resultsText = results
        .map(({ file, matches }) => {
          const matchText = matches
            .map(({ line, number }) => `  Line ${number}: ${line.trim()}`)
            .join('\n');
          return `📁 ${file}:\n${matchText}`;
        })
        .join('\n\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Search results for "${searchTerm}":\n\n${resultsText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error searching files: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getFilesRecursively(dir, extension) {
    const files = [];
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        const subFiles = await this.getFilesRecursively(itemPath, extension);
        files.push(...subFiles);
      } else if (item.endsWith(extension)) {
        files.push(itemPath);
      }
    }
    
    return files;
  }

  async createFolder({ folderPath }) {
    try {
      // Resolve folder path relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedFolderPath = path.isAbsolute(folderPath) ? folderPath : path.join(vaultPath, folderPath);
      
      await fs.mkdir(resolvedFolderPath, { recursive: true });
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully created folder: ${folderPath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating folder: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('File Manager MCP server running on stdio');
  }
}

const server = new FileManagerServer();
server.run().catch(console.error);

