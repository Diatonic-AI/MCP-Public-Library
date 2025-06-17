#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');

class TagHelperServer {
  constructor() {
    this.server = new Server(
      {
        name: 'tag-helper-server',
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
          name: 'add_tags',
          description: 'Add tags to a markdown file',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the markdown file',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of tags to add',
              },
            },
            required: ['filePath', 'tags'],
          },
        },
        {
          name: 'find_files_by_tag',
          description: 'Find all files containing specific tags',
          inputSchema: {
            type: 'object',
            properties: {
              tag: {
                type: 'string',
                description: 'Tag to search for',
              },
              directory: {
                type: 'string',
                description: 'Directory to search in',
                default: '.',
              },
            },
            required: ['tag'],
          },
        },
        {
          name: 'list_all_tags',
          description: 'List all tags found in markdown files',
          inputSchema: {
            type: 'object',
            properties: {
              directory: {
                type: 'string',
                description: 'Directory to search in',
                default: '.',
              },
            },
            required: [],
          },
        },
        {
          name: 'suggest_tags',
          description: 'Suggest tags based on file content',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the file to analyze',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'create_tag_index',
          description: 'Create an index of all tags and their associated files',
          inputSchema: {
            type: 'object',
            properties: {
              directory: {
                type: 'string',
                description: 'Directory to index',
                default: '.',
              },
            },
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'add_tags':
          return await this.addTags(request.params.arguments);
        case 'find_files_by_tag':
          return await this.findFilesByTag(request.params.arguments);
        case 'list_all_tags':
          return await this.listAllTags(request.params.arguments);
        case 'suggest_tags':
          return await this.suggestTags(request.params.arguments);
        case 'create_tag_index':
          return await this.createTagIndex(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async addTags({ filePath, tags }) {
    try {
      // Resolve file path relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedFilePath = path.isAbsolute(filePath) ? filePath : path.join(vaultPath, filePath);
      
      const content = await fs.readFile(resolvedFilePath, 'utf8');
      const lines = content.split('\n');
      
      // Check if file already has tags
      const tagLineIndex = lines.findIndex(line => line.startsWith('tags:'));
      const formattedTags = tags.map(tag => tag.startsWith('#') ? tag : `#${tag}`);
      
      if (tagLineIndex !== -1) {
        // Update existing tags line
        const existingTags = lines[tagLineIndex].replace('tags:', '').trim();
        const allTags = existingTags ? `${existingTags} ${formattedTags.join(' ')}` : formattedTags.join(' ');
        lines[tagLineIndex] = `tags: ${allTags}`;
      } else {
        // Add tags after frontmatter or at the beginning
        const frontmatterEnd = lines.findIndex((line, index) => index > 0 && line === '---');
        const insertIndex = frontmatterEnd !== -1 ? frontmatterEnd + 1 : 0;
        lines.splice(insertIndex, 0, `tags: ${formattedTags.join(' ')}`, '');
      }
      
      await fs.writeFile(resolvedFilePath, lines.join('\n'), 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully added tags ${formattedTags.join(', ')} to ${filePath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error adding tags: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async findFilesByTag({ tag, directory = '.' }) {
    try {
      // Resolve directory relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedDirectory = path.isAbsolute(directory) ? directory : path.join(vaultPath, directory);
      
      const files = await this.getMarkdownFiles(resolvedDirectory);
      const filesWithTag = [];
      const searchTag = tag.startsWith('#') ? tag : `#${tag}`;
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          if (content.includes(searchTag)) {
            filesWithTag.push(file);
          }
        } catch (err) {
          continue;
        }
      }
      
      if (filesWithTag.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No files found with tag ${searchTag}`,
            },
          ],
        };
      }
      
      const fileList = filesWithTag.map(file => `- [[${path.basename(file, '.md')}]]`).join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Files with tag ${searchTag}:\n\n${fileList}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error finding files by tag: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async listAllTags({ directory = '.' }) {
    try {
      // Resolve directory relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedDirectory = path.isAbsolute(directory) ? directory : path.join(vaultPath, directory);
      
      const files = await this.getMarkdownFiles(resolvedDirectory);
      const tagCounts = new Map();
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const tags = this.extractTags(content);
          
          tags.forEach(tag => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          });
        } catch (err) {
          continue;
        }
      }
      
      if (tagCounts.size === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No tags found in any files',
            },
          ],
        };
      }
      
      const sortedTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => `${tag} (${count} files)`)
        .join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `All tags found:\n\n${sortedTags}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing tags: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async suggestTags({ filePath }) {
    try {
      // Resolve file path relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedFilePath = path.isAbsolute(filePath) ? filePath : path.join(vaultPath, filePath);
      
      const content = await fs.readFile(resolvedFilePath, 'utf8');
      const words = content
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 4); // Only longer words
      
      const wordCount = {};
      words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
      });
      
      const suggestedTags = Object.entries(wordCount)
        .filter(([word, count]) => count >= 2) // Appears at least twice
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => `#${word}`);
      
      if (suggestedTags.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No suitable tags could be suggested based on content',
            },
          ],
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Suggested tags for ${path.basename(filePath)}:\n\n${suggestedTags.join('\n')}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error suggesting tags: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async createTagIndex({ directory = '.' }) {
    try {
      // Resolve directory relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedDirectory = path.isAbsolute(directory) ? directory : path.join(vaultPath, directory);
      
      const files = await this.getMarkdownFiles(resolvedDirectory);
      const tagIndex = new Map();
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const tags = this.extractTags(content);
          const fileName = path.basename(file, '.md');
          
          tags.forEach(tag => {
            if (!tagIndex.has(tag)) {
              tagIndex.set(tag, []);
            }
            tagIndex.get(tag).push(fileName);
          });
        } catch (err) {
          continue;
        }
      }
      
      let indexContent = '# Tag Index\n\n';
      
      for (const [tag, fileNames] of Array.from(tagIndex.entries()).sort()) {
        indexContent += `## ${tag}\n\n`;
        fileNames.forEach(fileName => {
          indexContent += `- [[${fileName}]]\n`;
        });
        indexContent += '\n';
      }
      
      const indexPath = path.join(resolvedDirectory, 'Tag-Index.md');
      await fs.writeFile(indexPath, indexContent, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully created tag index at ${indexPath}\n\nFound ${tagIndex.size} unique tags across ${files.length} files`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating tag index: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  extractTags(content) {
    const tagRegex = /#\w+/g;
    const matches = content.match(tagRegex) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  async getMarkdownFiles(dir) {
    const files = [];
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        const subFiles = await this.getMarkdownFiles(itemPath);
        files.push(...subFiles);
      } else if (item.endsWith('.md')) {
        files.push(itemPath);
      }
    }
    
    return files;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Tag Helper MCP server running on stdio');
  }
}

const server = new TagHelperServer();
server.run().catch(console.error);

