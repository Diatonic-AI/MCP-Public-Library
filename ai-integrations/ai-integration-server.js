#!/usr/bin/env node

// Environment variables will be loaded by Warp MCP configuration
// Fallback values for development
if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
  console.error('[INFO] No API keys found in environment, using development mode');
}

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

class AIIntegrationServer {
  constructor() {
    this.server = new Server(
      {
        name: 'ai-integration-server',
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
          name: 'enhance_text_with_ai',
          description: 'Enhance text using local LM Studio or cloud AI (OpenAI/Gemini)',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Text to enhance',
              },
              enhancement_type: {
                type: 'string',
                enum: ['grammar', 'style', 'clarity', 'professional', 'creative'],
                description: 'Type of enhancement to apply',
                default: 'grammar',
              },
              ai_provider: {
                type: 'string',
                enum: ['lm_studio', 'openai', 'gemini'],
                description: 'AI provider to use',
                default: 'lm_studio',
              },
            },
            required: ['text'],
          },
        },
        {
          name: 'generate_smart_summary',
          description: 'Generate intelligent summaries using AI',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Content to summarize',
              },
              summary_length: {
                type: 'string',
                enum: ['brief', 'medium', 'detailed'],
                description: 'Length of summary',
                default: 'medium',
              },
              focus_area: {
                type: 'string',
                description: 'Specific area to focus on (optional)',
              },
              ai_provider: {
                type: 'string',
                enum: ['lm_studio', 'openai', 'gemini'],
                description: 'AI provider to use',
                default: 'openai',
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'smart_tag_generation',
          description: 'Generate intelligent tags using AI analysis',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Content to analyze for tags',
              },
              max_tags: {
                type: 'number',
                description: 'Maximum number of tags to generate',
                default: 10,
              },
              tag_style: {
                type: 'string',
                enum: ['descriptive', 'categorical', 'technical', 'business'],
                description: 'Style of tags to generate',
                default: 'descriptive',
              },
              ai_provider: {
                type: 'string',
                enum: ['lm_studio', 'openai', 'gemini'],
                description: 'AI provider to use',
                default: 'lm_studio',
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'intelligent_content_analysis',
          description: 'Analyze content for insights, sentiment, and recommendations',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Content to analyze',
              },
              analysis_type: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['sentiment', 'topics', 'key_points', 'recommendations', 'readability'],
                },
                description: 'Types of analysis to perform',
                default: ['sentiment', 'key_points'],
              },
              ai_provider: {
                type: 'string',
                enum: ['lm_studio', 'openai', 'gemini'],
                description: 'AI provider to use',
                default: 'gemini',
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'smart_note_connection',
          description: 'Find intelligent connections between notes using AI',
          inputSchema: {
            type: 'object',
            properties: {
              source_content: {
                type: 'string',
                description: 'Content of the source note',
              },
              vault_files: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of file paths to analyze for connections',
              },
              connection_strength: {
                type: 'string',
                enum: ['weak', 'medium', 'strong'],
                description: 'Minimum connection strength to report',
                default: 'medium',
              },
              ai_provider: {
                type: 'string',
                enum: ['lm_studio', 'openai', 'gemini'],
                description: 'AI provider to use',
                default: 'openai',
              },
            },
            required: ['source_content', 'vault_files'],
          },
        },
        {
          name: 'ai_writing_assistant',
          description: 'AI-powered writing assistance for content creation',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Writing prompt or topic',
              },
              content_type: {
                type: 'string',
                enum: ['meeting_notes', 'project_plan', 'research_summary', 'business_memo', 'technical_doc'],
                description: 'Type of content to generate',
                default: 'business_memo',
              },
              tone: {
                type: 'string',
                enum: ['professional', 'casual', 'technical', 'creative', 'persuasive'],
                description: 'Tone of the content',
                default: 'professional',
              },
              length: {
                type: 'string',
                enum: ['short', 'medium', 'long'],
                description: 'Desired length of content',
                default: 'medium',
              },
              ai_provider: {
                type: 'string',
                enum: ['lm_studio', 'openai', 'gemini'],
                description: 'AI provider to use',
                default: 'openai',
              },
            },
            required: ['prompt'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'enhance_text_with_ai':
          return await this.enhanceTextWithAI(request.params.arguments);
        case 'generate_smart_summary':
          return await this.generateSmartSummary(request.params.arguments);
        case 'smart_tag_generation':
          return await this.smartTagGeneration(request.params.arguments);
        case 'intelligent_content_analysis':
          return await this.intelligentContentAnalysis(request.params.arguments);
        case 'smart_note_connection':
          return await this.smartNoteConnection(request.params.arguments);
        case 'ai_writing_assistant':
          return await this.aiWritingAssistant(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async makeAIRequest(provider, prompt, systemPrompt = '') {
    try {
      switch (provider) {
        case 'lm_studio':
          return await this.callLMStudio(prompt, systemPrompt);
        case 'openai':
          return await this.callOpenAI(prompt, systemPrompt);
        case 'gemini':
          return await this.callGemini(prompt, systemPrompt);
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (error) {
      console.error(`AI request failed for ${provider}:`, error);
      // Fallback to local processing if AI fails
      return this.fallbackProcessing(prompt);
    }
  }

  async callLMStudio(prompt, systemPrompt) {
    const lmStudioUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234';
    const requestData = JSON.stringify({
      model: process.env.LM_STUDIO_MODEL || 'local-model',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: new URL(lmStudioUrl).hostname,
        port: new URL(lmStudioUrl).port || 1234,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response.choices[0].message.content);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(requestData);
      req.end();
    });
  }

  async callOpenAI(prompt, systemPrompt) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const requestData = JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(requestData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response.choices[0].message.content);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(requestData);
      req.end();
    });
  }

  async callGemini(prompt, systemPrompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const requestData = JSON.stringify({
      contents: [{
        parts: [{ text: fullPrompt }]
      }],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7
      }
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response.candidates[0].content.parts[0].text);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(requestData);
      req.end();
    });
  }

  fallbackProcessing(prompt) {
    // Simple fallback processing when AI is unavailable
    return `Processed locally: ${prompt.substring(0, 100)}...`;
  }

  async enhanceTextWithAI({ text, enhancement_type = 'grammar', ai_provider = 'lm_studio' }) {
    try {
      const systemPrompt = `You are a professional editor. Please ${enhancement_type === 'grammar' ? 'correct grammar and spelling' : 
        enhancement_type === 'style' ? 'improve writing style and flow' :
        enhancement_type === 'clarity' ? 'make the text clearer and more concise' :
        enhancement_type === 'professional' ? 'make the text more professional' :
        'make the text more creative and engaging'} in the following text. Return only the improved version.`;
      
      const enhancedText = await this.makeAIRequest(ai_provider, text, systemPrompt);
      
      return {
        content: [{
          type: 'text',
          text: `Enhanced Text (${enhancement_type}):\n\n${enhancedText}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error enhancing text: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async generateSmartSummary({ content, summary_length = 'medium', focus_area, ai_provider = 'openai' }) {
    try {
      const lengthGuide = {
        brief: '2-3 sentences',
        medium: '1-2 paragraphs',
        detailed: '3-4 paragraphs'
      };
      
      const systemPrompt = `Create a ${lengthGuide[summary_length]} summary of the following content.${focus_area ? ` Focus particularly on: ${focus_area}.` : ''} Be concise but comprehensive.`;
      
      const summary = await this.makeAIRequest(ai_provider, content, systemPrompt);
      
      return {
        content: [{
          type: 'text',
          text: `Smart Summary (${summary_length}):\n\n${summary}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error generating summary: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async smartTagGeneration({ content, max_tags = 10, tag_style = 'descriptive', ai_provider = 'lm_studio' }) {
    try {
      const styleGuide = {
        descriptive: 'descriptive and specific tags',
        categorical: 'broad category tags',
        technical: 'technical and domain-specific tags',
        business: 'business and workflow-related tags'
      };
      
      const systemPrompt = `Analyze the following content and generate ${max_tags} ${styleGuide[tag_style]} that would be useful for organizing and finding this content. Return only the tags as a comma-separated list.`;
      
      const tagsResponse = await this.makeAIRequest(ai_provider, content, systemPrompt);
      const tags = tagsResponse.split(',').map(tag => tag.trim()).slice(0, max_tags);
      
      return {
        content: [{
          type: 'text',
          text: `Generated Tags (${tag_style}):\n\n${tags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ')}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error generating tags: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async intelligentContentAnalysis({ content, analysis_type = ['sentiment', 'key_points'], ai_provider = 'gemini' }) {
    try {
      const analysisPrompts = {
        sentiment: 'Analyze the sentiment and emotional tone of this content.',
        topics: 'Identify the main topics and themes in this content.',
        key_points: 'Extract the most important key points and insights.',
        recommendations: 'Provide actionable recommendations based on this content.',
        readability: 'Assess the readability and suggest improvements.'
      };
      
      const analyses = [];
      
      for (const analysisType of analysis_type) {
        if (analysisPrompts[analysisType]) {
          const result = await this.makeAIRequest(ai_provider, content, analysisPrompts[analysisType]);
          analyses.push(`## ${analysisType.replace('_', ' ').toUpperCase()}\n${result}`);
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: `Content Analysis:\n\n${analyses.join('\n\n')}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error analyzing content: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async smartNoteConnection({ source_content, vault_files, connection_strength = 'medium', ai_provider = 'openai' }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const connections = [];
      
      // Sample a subset of files to avoid overwhelming the AI
      const sampleFiles = vault_files.slice(0, 10);
      
      for (const filePath of sampleFiles) {
        try {
          const fullPath = path.isAbsolute(filePath) ? filePath : path.join(vaultPath, filePath);
          const fileContent = await fs.readFile(fullPath, 'utf8');
          const fileName = path.basename(filePath, '.md');
          
          const systemPrompt = `Analyze the connection between the source content and the target content. Rate the connection strength as weak, medium, or strong. If the connection is ${connection_strength} or stronger, explain the relationship. If weak, just respond with "weak".`;
          const prompt = `Source Content:\n${source_content}\n\nTarget Content (${fileName}):\n${fileContent.substring(0, 1000)}`;
          
          const connectionAnalysis = await this.makeAIRequest(ai_provider, prompt, systemPrompt);
          
          if (!connectionAnalysis.toLowerCase().includes('weak')) {
            connections.push({
              file: fileName,
              path: filePath,
              analysis: connectionAnalysis
            });
          }
        } catch (error) {
          console.error(`Error analyzing ${filePath}:`, error);
        }
      }
      
      const connectionText = connections.length > 0 ? 
        connections.map(conn => `**${conn.file}**: ${conn.analysis}`).join('\n\n') :
        'No significant connections found.';
      
      return {
        content: [{
          type: 'text',
          text: `Smart Note Connections (${connection_strength}+):\n\n${connectionText}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error finding connections: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async aiWritingAssistant({ prompt, content_type = 'business_memo', tone = 'professional', length = 'medium', ai_provider = 'openai' }) {
    try {
      const lengthGuide = {
        short: '200-300 words',
        medium: '400-600 words',
        long: '800-1200 words'
      };
      
      const systemPrompt = `You are a professional writing assistant. Create ${content_type.replace('_', ' ')} content with a ${tone} tone. The content should be approximately ${lengthGuide[length]}. Use proper markdown formatting with headers, bullet points, and emphasis where appropriate.`;
      
      const generatedContent = await this.makeAIRequest(ai_provider, prompt, systemPrompt);
      
      return {
        content: [{
          type: 'text',
          text: `AI-Generated Content (${content_type}, ${tone} tone):\n\n${generatedContent}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error generating content: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AI Integration MCP server running on stdio');
  }
}

const server = new AIIntegrationServer();
server.run().catch(console.error);

