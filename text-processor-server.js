#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

class TextProcessorServer {
  constructor() {
    this.server = new Server(
      {
        name: 'text-processor-server',
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
          name: 'format_markdown',
          description: 'Format text as markdown with proper headers and structure',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Text to format as markdown',
              },
              title: {
                type: 'string',
                description: 'Title for the markdown document',
              },
            },
            required: ['text'],
          },
        },
        {
          name: 'create_bullet_list',
          description: 'Convert text into a markdown bullet list',
          inputSchema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of items to convert to bullet list',
              },
            },
            required: ['items'],
          },
        },
        {
          name: 'extract_keywords',
          description: 'Extract keywords from text for tagging',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Text to extract keywords from',
              },
              maxKeywords: {
                type: 'number',
                description: 'Maximum number of keywords to extract',
                default: 10,
              },
            },
            required: ['text'],
          },
        },
        {
          name: 'word_count',
          description: 'Count words, characters, and paragraphs in text',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Text to analyze',
              },
            },
            required: ['text'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'format_markdown':
          return await this.formatMarkdown(request.params.arguments);
        case 'create_bullet_list':
          return await this.createBulletList(request.params.arguments);
        case 'extract_keywords':
          return await this.extractKeywords(request.params.arguments);
        case 'word_count':
          return await this.wordCount(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async formatMarkdown({ text, title }) {
    try {
      let formatted = '';
      
      if (title) {
        formatted += `# ${title}\n\n`;
      }
      
      // Split text into paragraphs and format
      const paragraphs = text.split(/\n\s*\n/);
      
      formatted += paragraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .join('\n\n');
      
      return {
        content: [
          {
            type: 'text',
            text: formatted,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error formatting markdown: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async createBulletList({ items }) {
    try {
      const bulletList = items
        .map(item => `- ${item.trim()}`)
        .join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: bulletList,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating bullet list: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async extractKeywords({ text, maxKeywords = 10 }) {
    try {
      // Simple keyword extraction (in practice, you might use a more sophisticated algorithm)
      const words = text
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3); // Filter out short words
      
      // Count word frequency
      const wordCount = {};
      words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
      });
      
      // Sort by frequency and take top keywords
      const keywords = Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKeywords)
        .map(([word]) => word);
      
      const keywordTags = keywords.map(keyword => `#${keyword}`).join(' ');
      
      return {
        content: [
          {
            type: 'text',
            text: `Keywords: ${keywordTags}\n\nSuggested tags: ${keywords.join(', ')}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error extracting keywords: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async wordCount({ text }) {
    try {
      const words = text.trim().split(/\s+/).filter(word => word.length > 0);
      const characters = text.length;
      const charactersNoSpaces = text.replace(/\s/g, '').length;
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      
      const stats = {
        words: words.length,
        characters,
        charactersNoSpaces,
        paragraphs: paragraphs.length,
      };
      
      return {
        content: [
          {
            type: 'text',
            text: `Text Statistics:\n- Words: ${stats.words}\n- Characters: ${stats.characters}\n- Characters (no spaces): ${stats.charactersNoSpaces}\n- Paragraphs: ${stats.paragraphs}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error counting words: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Text Processor MCP server running on stdio');
  }
}

const server = new TextProcessorServer();
server.run().catch(console.error);

