#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');

class LinkBuilderServer {
  constructor() {
    this.server = new Server(
      {
        name: 'link-builder-server',
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
          name: 'create_wikilink',
          description: 'Create internal wikilinks to other notes',
          inputSchema: {
            type: 'object',
            properties: {
              noteName: {
                type: 'string',
                description: 'Name of the note to link to',
              },
              displayText: {
                type: 'string',
                description: 'Optional display text for the link',
              },
            },
            required: ['noteName'],
          },
        },
        {
          name: 'find_backlinks',
          description: 'Find all files that link to a specific note',
          inputSchema: {
            type: 'object',
            properties: {
              noteName: {
                type: 'string',
                description: 'Name of the note to find backlinks for',
              },
              directory: {
                type: 'string',
                description: 'Directory to search in',
                default: '.',
              },
            },
            required: ['noteName'],
          },
        },
        {
          name: 'create_table_of_contents',
          description: 'Generate a table of contents for a markdown file',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the markdown file',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'create_note_graph',
          description: 'Create a visual representation of note connections',
          inputSchema: {
            type: 'object',
            properties: {
              directory: {
                type: 'string',
                description: 'Directory to analyze',
                default: '.',
              },
            },
            required: [],
          },
        },
        {
          name: 'suggest_links',
          description: 'Suggest potential links based on content similarity',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the file to analyze for link suggestions',
              },
              directory: {
                type: 'string',
                description: 'Directory to search for potential links',
                default: '.',
              },
            },
            required: ['filePath'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'create_wikilink':
          return await this.createWikilink(request.params.arguments);
        case 'find_backlinks':
          return await this.findBacklinks(request.params.arguments);
        case 'create_table_of_contents':
          return await this.createTableOfContents(request.params.arguments);
        case 'create_note_graph':
          return await this.createNoteGraph(request.params.arguments);
        case 'suggest_links':
          return await this.suggestLinks(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async createWikilink({ noteName, displayText }) {
    try {
      const link = displayText 
        ? `[[${noteName}|${displayText}]]`
        : `[[${noteName}]]`;
      
      return {
        content: [
          {
            type: 'text',
            text: `Created wikilink: ${link}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating wikilink: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async findBacklinks({ noteName, directory = '.' }) {
    try {
      // Resolve directory relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedDirectory = path.isAbsolute(directory) ? directory : path.join(vaultPath, directory);
      
      const files = await this.getMarkdownFiles(resolvedDirectory);
      const backlinks = [];
      
      // Look for both [[NoteName]] and [[NoteName|display text]] patterns
      const linkPatterns = [
        new RegExp(`\\[\\[${noteName}\\]\\]`, 'gi'),
        new RegExp(`\\[\\[${noteName}\\|[^\\]]+\\]\\]`, 'gi')
      ];
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const fileName = path.basename(file, '.md');
          
          // Skip the file itself
          if (fileName === noteName) continue;
          
          const hasLink = linkPatterns.some(pattern => pattern.test(content));
          if (hasLink) {
            backlinks.push({
              file: fileName,
              path: file
            });
          }
        } catch (err) {
          continue;
        }
      }
      
      if (backlinks.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No backlinks found for "${noteName}"`,
            },
          ],
        };
      }
      
      const backlinkList = backlinks
        .map(({ file }) => `- [[${file}]]`)
        .join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Backlinks to "${noteName}":\n\n${backlinkList}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error finding backlinks: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async createTableOfContents({ filePath }) {
    try {
      // Resolve file path relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedFilePath = path.isAbsolute(filePath) ? filePath : path.join(vaultPath, filePath);
      
      const content = await fs.readFile(resolvedFilePath, 'utf8');
      const lines = content.split('\n');
      const headers = [];
      
      lines.forEach(line => {
        const match = line.match(/^(#{1,6})\s+(.+)$/);
        if (match) {
          const level = match[1].length;
          const title = match[2].trim();
          const anchor = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
          
          headers.push({
            level,
            title,
            anchor
          });
        }
      });
      
      if (headers.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No headers found in the file to create table of contents',
            },
          ],
        };
      }
      
      const toc = headers
        .map(({ level, title, anchor }) => {
          const indent = '  '.repeat(level - 1);
          return `${indent}- [${title}](#${anchor})`;
        })
        .join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Table of Contents:\n\n${toc}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating table of contents: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async createNoteGraph({ directory = '.' }) {
    try {
      // Resolve directory relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedDirectory = path.isAbsolute(directory) ? directory : path.join(vaultPath, directory);
      
      const files = await this.getMarkdownFiles(resolvedDirectory);
      const graph = new Map();
      
      // Build the graph
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const fileName = path.basename(file, '.md');
          
          // Find all wikilinks in this file
          const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
          const links = [];
          let match;
          
          while ((match = linkRegex.exec(content)) !== null) {
            links.push(match[1]);
          }
          
          graph.set(fileName, links);
        } catch (err) {
          continue;
        }
      }
      
      // Create a simple text representation
      let graphText = '# Note Graph\n\n';
      
      for (const [note, links] of graph.entries()) {
        graphText += `## ${note}\n`;
        if (links.length > 0) {
          graphText += 'Links to:\n';
          links.forEach(link => {
            graphText += `- [[${link}]]\n`;
          });
        } else {
          graphText += 'No outgoing links\n';
        }
        graphText += '\n';
      }
      
      const graphPath = path.join(resolvedDirectory, 'Note-Graph.md');
      await fs.writeFile(graphPath, graphText, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully created note graph at ${graphPath}\n\nAnalyzed ${graph.size} notes`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating note graph: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async suggestLinks({ filePath, directory = '.' }) {
    try {
      // Resolve file path relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const resolvedFilePath = path.isAbsolute(filePath) ? filePath : path.join(vaultPath, filePath);
      const resolvedDirectory = path.isAbsolute(directory) ? directory : path.join(vaultPath, directory);
      
      const targetContent = await fs.readFile(resolvedFilePath, 'utf8');
      const targetWords = this.extractKeywords(targetContent);
      const files = await this.getMarkdownFiles(resolvedDirectory);
      const suggestions = [];
      
      for (const file of files) {
        try {
          // Skip the target file itself
          if (file === filePath) continue;
          
          const content = await fs.readFile(file, 'utf8');
          const fileName = path.basename(file, '.md');
          const fileWords = this.extractKeywords(content);
          
          // Calculate similarity (simple word overlap)
          const commonWords = targetWords.filter(word => fileWords.includes(word));
          const similarity = commonWords.length / Math.max(targetWords.length, fileWords.length);
          
          if (similarity > 0.1 && commonWords.length >= 2) { // Threshold for suggestion
            suggestions.push({
              fileName,
              similarity,
              commonWords: commonWords.slice(0, 3) // Show top 3 common words
            });
          }
        } catch (err) {
          continue;
        }
      }
      
      if (suggestions.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No potential links found based on content similarity',
            },
          ],
        };
      }
      
      // Sort by similarity and take top 5
      suggestions.sort((a, b) => b.similarity - a.similarity);
      const topSuggestions = suggestions.slice(0, 5);
      
      const suggestionText = topSuggestions
        .map(({ fileName, commonWords }) => {
          return `- [[${fileName}]] (common topics: ${commonWords.join(', ')})`;
        })
        .join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Suggested links for ${path.basename(filePath)}:\n\n${suggestionText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error suggesting links: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  extractKeywords(content) {
    return content
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 4)
      .filter(word => !this.isStopWord(word));
  }

  isStopWord(word) {
    const stopWords = ['that', 'with', 'have', 'this', 'will', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were'];
    return stopWords.includes(word);
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
    console.error('Link Builder MCP server running on stdio');
  }
}

const server = new LinkBuilderServer();
server.run().catch(console.error);

