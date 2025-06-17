/**
 * Conversation Manager Module
 * Manages AI conversations with Redis caching for evolving context
 */

const redis = require('redis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Logger = require('../../utils/logger');
const logger = new Logger('ConversationManager');

class ConversationManager {
  constructor() {
    this.logger = logger;
    this.redisClient = null;
    this.geminiClient = null;
    this.isInitialized = false;
    this.conversationTTL = 7 * 24 * 60 * 60; // 7 days in seconds
    this.maxContextLength = 32000; // Maximum context length for Gemini
    this.compressionThreshold = 0.8; // Compress when context reaches 80% of max
  }

  /**
   * Initialize Redis client and Gemini AI
   */
  async initialize() {
    try {
      this.logger.info('Initializing Conversation Manager...');
      
      // Initialize Redis client
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error('REDIS_URL environment variable not set');
      }
      
      this.redisClient = redis.createClient({ url: redisUrl });
      await this.redisClient.connect();
      
      this.redisClient.on('error', (error) => {
        this.logger.error('Redis client error:', error);
      });
      
      // Initialize Gemini AI client
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY environment variable not set');
      }
      
      this.geminiClient = new GoogleGenerativeAI(geminiApiKey);
      
      this.isInitialized = true;
      this.logger.info('Conversation Manager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Conversation Manager:', error.message);
      throw error;
    }
  }

  /**
   * Create a new conversation session
   */
  async createConversation(sessionId, metadata = {}) {
    try {
      const conversationKey = `conversation:${sessionId}`;
      const conversation = {
        sessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata,
        messages: [],
        statistics: {
          totalMessages: 0,
          clientMessages: 0,
          serviceMessages: 0,
          totalTokens: 0,
          avgResponseTime: 0
        }
      };
      
      await this.redisClient.setEx(
        conversationKey, 
        this.conversationTTL, 
        JSON.stringify(conversation)
      );
      
      // Create conversation timeline key for chronological access
      const timelineKey = `timeline:${sessionId}`;
      await this.redisClient.expire(timelineKey, this.conversationTTL);
      
      this.logger.info(`Created conversation session: ${sessionId}`);
      return conversation;
    } catch (error) {
      this.logger.error(`Failed to create conversation ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Add message to conversation with timestamp
   */
  async addMessage(sessionId, message, type = 'user', source = 'client') {
    try {
      const conversationKey = `conversation:${sessionId}`;
      const timelineKey = `timeline:${sessionId}`;
      const timestamp = new Date().toISOString();
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get existing conversation
      const conversationData = await this.redisClient.get(conversationKey);
      if (!conversationData) {
        throw new Error(`Conversation ${sessionId} not found`);
      }
      
      const conversation = JSON.parse(conversationData);
      
      // Create message object
      const messageObj = {
        id: messageId,
        type, // 'user', 'assistant', 'system'
        source, // 'client', 'service'
        content: message,
        timestamp,
        metadata: {
          tokenCount: this.estimateTokenCount(message),
          contentLength: message.length
        }
      };
      
      // Add to conversation
      conversation.messages.push(messageObj);
      conversation.updatedAt = timestamp;
      
      // Update statistics
      conversation.statistics.totalMessages++;
      if (source === 'client') {
        conversation.statistics.clientMessages++;
      } else {
        conversation.statistics.serviceMessages++;
      }
      conversation.statistics.totalTokens += messageObj.metadata.tokenCount;
      
      // Save updated conversation
      await this.redisClient.setEx(
        conversationKey, 
        this.conversationTTL, 
        JSON.stringify(conversation)
      );
      
      // Add to timeline for chronological order
      await this.redisClient.zAdd(timelineKey, {
        score: Date.now(),
        value: JSON.stringify({
          messageId,
          sessionId,
          timestamp,
          type,
          source,
          preview: message.substring(0, 100)
        })
      });
      
      // Extend timeline TTL
      await this.redisClient.expire(timelineKey, this.conversationTTL);
      
      this.logger.debug(`Added ${type} message from ${source} to session ${sessionId}`);
      
      // Check if context compression is needed
      await this.checkContextCompression(sessionId, conversation);
      
      return messageObj;
    } catch (error) {
      this.logger.error(`Failed to add message to conversation ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get conversation with evolving context
   */
  async getConversation(sessionId, includeTimeline = false) {
    try {
      const conversationKey = `conversation:${sessionId}`;
      const conversationData = await this.redisClient.get(conversationKey);
      
      if (!conversationData) {
        throw new Error(`Conversation ${sessionId} not found`);
      }
      
      const conversation = JSON.parse(conversationData);
      
      if (includeTimeline) {
        const timelineKey = `timeline:${sessionId}`;
        const timeline = await this.redisClient.zRange(timelineKey, 0, -1, {
          REV: true,
          WITHSCORES: true
        });
        
        conversation.timeline = timeline;
      }
      
      return conversation;
    } catch (error) {
      this.logger.error(`Failed to get conversation ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get conversation context for AI completion
   */
  async getContextForCompletion(sessionId, maxMessages = 20) {
    try {
      const conversation = await this.getConversation(sessionId);
      
      // Get recent messages for context (format for Gemini API)
      const recentMessages = conversation.messages
        .slice(-maxMessages)
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));
      
      // Calculate total context length
      const totalLength = recentMessages.reduce(
        (sum, msg) => sum + msg.parts[0].text.length, 
        0
      );
      
      return {
        messages: recentMessages,
        totalLength,
        messageCount: recentMessages.length,
        sessionMetadata: {
          sessionId: conversation.sessionId,
          totalMessages: conversation.statistics.totalMessages,
          conversationAge: new Date() - new Date(conversation.createdAt)
        }
      };
    } catch (error) {
      this.logger.error(`Failed to get context for completion ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate AI response with conversation context
   */
  async generateResponse(sessionId, prompt, source = 'service', options = {}) {
    try {
      const startTime = Date.now();
      
      // Add user message to conversation
      await this.addMessage(sessionId, prompt, 'user', source);
      
      // Get conversation context
      const context = await this.getContextForCompletion(sessionId);
      
      // Prepare Gemini model
      const model = this.geminiClient.getGenerativeModel({ 
        model: options.model || 'gemini-pro' 
      });
      
      // Create chat with history
      const chat = model.startChat({
        history: context.messages.slice(0, -1), // Exclude the latest message as it will be sent as prompt
        generationConfig: {
          maxOutputTokens: options.maxTokens || 2048,
          temperature: options.temperature || 0.7,
        }
      });
      
      // Generate response
      const result = await chat.sendMessage(prompt);
      const response = result.response.text();
      
      // Add AI response to conversation
      const responseMessage = await this.addMessage(
        sessionId, 
        response, 
        'assistant', 
        source
      );
      
      // Update response time statistics
      const responseTime = Date.now() - startTime;
      await this.updateResponseTimeStats(sessionId, responseTime);
      
      this.logger.info(`Generated AI response for session ${sessionId} in ${responseTime}ms`);
      
      return {
        message: responseMessage,
        response,
        responseTime,
        contextUsed: {
          messageCount: context.messageCount,
          totalLength: context.totalLength
        },
        metadata: {
          model: options.model || 'gemini-pro',
          source,
          sessionId
        }
      };
    } catch (error) {
      this.logger.error(`Failed to generate response for session ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get conversation history timeline
   */
  async getConversationTimeline(sessionId, limit = 50) {
    try {
      const timelineKey = `timeline:${sessionId}`;
      const timeline = await this.redisClient.zRange(timelineKey, 0, limit - 1, {
        REV: true,
        WITHSCORES: true
      });
      
      // Handle different Redis client API formats
      let timelineData = [];
      
      if (Array.isArray(timeline)) {
        // Newer Redis client format: alternating values and scores
        for (let i = 0; i < timeline.length; i += 2) {
          const value = timeline[i];
          const score = timeline[i + 1];
          if (value) {
            timelineData.push({ value, score });
          }
        }
      } else if (timeline && typeof timeline === 'object') {
        // Object format with value/score properties
        timelineData = Array.isArray(timeline) ? timeline : [timeline];
      }
      
      return timelineData
        .filter(item => item.value) // Filter out undefined values
        .map(item => {
          try {
            return {
              ...JSON.parse(item.value),
              score: item.score
            };
          } catch (error) {
            this.logger.warn(`Failed to parse timeline item: ${item.value}`);
            return null;
          }
        })
        .filter(item => item !== null); // Remove null items
    } catch (error) {
      this.logger.error(`Failed to get timeline for session ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Search conversations by content
   */
  async searchConversations(query, limit = 10) {
    try {
      const searchKey = `search:conversations`;
      const pattern = `conversation:*`;
      
      // Get all conversation keys
      const keys = await this.redisClient.keys(pattern);
      const results = [];
      
      for (const key of keys.slice(0, limit)) {
        const conversationData = await this.redisClient.get(key);
        if (conversationData) {
          const conversation = JSON.parse(conversationData);
          
          // Simple text search in messages
          const hasMatch = conversation.messages.some(msg => 
            msg.content.toLowerCase().includes(query.toLowerCase())
          );
          
          if (hasMatch) {
            results.push({
              sessionId: conversation.sessionId,
              createdAt: conversation.createdAt,
              updatedAt: conversation.updatedAt,
              messageCount: conversation.statistics.totalMessages,
              preview: this.getConversationPreview(conversation)
            });
          }
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to search conversations:', error.message);
      throw error;
    }
  }

  /**
   * Compress conversation context when it gets too long
   */
  async checkContextCompression(sessionId, conversation) {
    try {
      const totalLength = conversation.messages.reduce(
        (sum, msg) => sum + msg.content.length, 
        0
      );
      
      if (totalLength > this.maxContextLength * this.compressionThreshold) {
        this.logger.info(`Compressing context for session ${sessionId}`);
        await this.compressConversationContext(sessionId, conversation);
      }
    } catch (error) {
      this.logger.error(`Failed to check compression for session ${sessionId}:`, error.message);
    }
  }

  /**
   * Compress conversation context using AI summarization
   */
  async compressConversationContext(sessionId, conversation) {
    try {
      const oldMessages = conversation.messages.slice(0, -10); // Keep last 10 messages
      const recentMessages = conversation.messages.slice(-10);
      
      if (oldMessages.length === 0) return;
      
      // Create summary of old messages
      const summaryPrompt = `Summarize the following conversation history concisely, preserving key context and decisions:\n\n${oldMessages.map(msg => `${msg.type}: ${msg.content}`).join('\n')}`;
      
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(summaryPrompt);
      const summary = result.response.text();
      
      // Create summary message
      const summaryMessage = {
        id: `summary_${Date.now()}`,
        type: 'system',
        source: 'service',
        content: `[Conversation Summary]: ${summary}`,
        timestamp: new Date().toISOString(),
        metadata: {
          tokenCount: this.estimateTokenCount(summary),
          contentLength: summary.length,
          originalMessages: oldMessages.length,
          compressionRatio: oldMessages.length > 0 ? 1 / oldMessages.length : 0
        }
      };
      
      // Update conversation with compressed context
      conversation.messages = [summaryMessage, ...recentMessages];
      conversation.metadata.compressed = true;
      conversation.metadata.lastCompression = new Date().toISOString();
      
      // Save compressed conversation
      const conversationKey = `conversation:${sessionId}`;
      await this.redisClient.setEx(
        conversationKey, 
        this.conversationTTL, 
        JSON.stringify(conversation)
      );
      
      this.logger.info(`Compressed ${oldMessages.length} messages into summary for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to compress context for session ${sessionId}:`, error.message);
    }
  }

  /**
   * Update response time statistics
   */
  async updateResponseTimeStats(sessionId, responseTime) {
    try {
      const conversation = await this.getConversation(sessionId);
      const stats = conversation.statistics;
      
      // Calculate running average
      const totalResponses = stats.serviceMessages;
      if (totalResponses > 0) {
        stats.avgResponseTime = ((stats.avgResponseTime * (totalResponses - 1)) + responseTime) / totalResponses;
      } else {
        stats.avgResponseTime = responseTime;
      }
      
      // Save updated statistics
      const conversationKey = `conversation:${sessionId}`;
      await this.redisClient.setEx(
        conversationKey, 
        this.conversationTTL, 
        JSON.stringify(conversation)
      );
    } catch (error) {
      this.logger.error(`Failed to update response time stats for session ${sessionId}:`, error.message);
    }
  }

  /**
   * Get conversation preview for search results
   */
  getConversationPreview(conversation) {
    if (conversation.messages.length === 0) return 'Empty conversation';
    
    const firstMessage = conversation.messages[0];
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    
    return {
      first: firstMessage.content.substring(0, 100),
      last: lastMessage.content.substring(0, 100),
      messageCount: conversation.messages.length
    };
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  estimateTokenCount(text) {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Clean up old conversations
   */
  async cleanupOldConversations(olderThanDays = 30) {
    try {
      this.logger.info(`Cleaning up conversations older than ${olderThanDays} days`);
      
      const pattern = 'conversation:*';
      const keys = await this.redisClient.keys(pattern);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      let cleanedCount = 0;
      
      for (const key of keys) {
        const conversationData = await this.redisClient.get(key);
        if (conversationData) {
          const conversation = JSON.parse(conversationData);
          const conversationDate = new Date(conversation.updatedAt);
          
          if (conversationDate < cutoffDate) {
            const sessionId = conversation.sessionId;
            
            // Delete conversation and timeline
            await this.redisClient.del(key);
            await this.redisClient.del(`timeline:${sessionId}`);
            
            cleanedCount++;
          }
        }
      }
      
      this.logger.info(`Cleaned up ${cleanedCount} old conversations`);
      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old conversations:', error.message);
      throw error;
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats() {
    try {
      const pattern = 'conversation:*';
      const keys = await this.redisClient.keys(pattern);
      
      let totalConversations = 0;
      let totalMessages = 0;
      let totalTokens = 0;
      let avgResponseTime = 0;
      
      for (const key of keys) {
        const conversationData = await this.redisClient.get(key);
        if (conversationData) {
          const conversation = JSON.parse(conversationData);
          totalConversations++;
          totalMessages += conversation.statistics.totalMessages;
          totalTokens += conversation.statistics.totalTokens;
          avgResponseTime += conversation.statistics.avgResponseTime;
        }
      }
      
      return {
        totalConversations,
        totalMessages,
        totalTokens,
        avgResponseTime: totalConversations > 0 ? avgResponseTime / totalConversations : 0,
        avgMessagesPerConversation: totalConversations > 0 ? totalMessages / totalConversations : 0
      };
    } catch (error) {
      this.logger.error('Failed to get conversation stats:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    try {
      if (this.redisClient) {
        await this.redisClient.disconnect();
        this.logger.info('Disconnected from Redis');
      }
    } catch (error) {
      this.logger.error('Error disconnecting from Redis:', error.message);
    }
  }

  getTools() {
    return [
      {
        name: 'create_conversation',
        description: 'Create a new conversation session with Redis caching',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Unique session identifier' },
            metadata: { type: 'object', description: 'Optional conversation metadata' }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'add_message',
        description: 'Add message to conversation with timestamp',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session identifier' },
            message: { type: 'string', description: 'Message content' },
            type: { type: 'string', enum: ['user', 'assistant', 'system'], default: 'user' },
            source: { type: 'string', enum: ['client', 'service'], default: 'client' }
          },
          required: ['sessionId', 'message']
        }
      },
      {
        name: 'generate_ai_response',
        description: 'Generate AI response with evolving context',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session identifier' },
            prompt: { type: 'string', description: 'User prompt for AI response' },
            source: { type: 'string', enum: ['client', 'service'], default: 'service' },
            options: {
              type: 'object',
              properties: {
                model: { type: 'string', default: 'gemini-pro' },
                maxTokens: { type: 'number', default: 2048 },
                temperature: { type: 'number', default: 0.7 }
              }
            }
          },
          required: ['sessionId', 'prompt']
        }
      },
      {
        name: 'get_conversation',
        description: 'Retrieve conversation with full context',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session identifier' },
            includeTimeline: { type: 'boolean', default: false }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'get_conversation_timeline',
        description: 'Get timestamped conversation timeline',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session identifier' },
            limit: { type: 'number', default: 50 }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'search_conversations',
        description: 'Search conversations by content',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', default: 10 }
          },
          required: ['query']
        }
      },
      {
        name: 'get_conversation_stats',
        description: 'Get overall conversation statistics',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'cleanup_old_conversations',
        description: 'Clean up conversations older than specified days',
        inputSchema: {
          type: 'object',
          properties: {
            olderThanDays: { type: 'number', default: 30 }
          },
          required: []
        }
      }
    ];
  }

  // Tool method implementations
  async createConversationTool(args) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      const { sessionId, metadata = {} } = args;
      const conversation = await this.createConversation(sessionId, metadata);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            conversation,
            message: `Created conversation session: ${sessionId}`
          }, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Create conversation tool failed:', error.message);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }]
      };
    }
  }

  async addMessageTool(args) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      const { sessionId, message, type = 'user', source = 'client' } = args;
      const messageObj = await this.addMessage(sessionId, message, type, source);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: messageObj,
            info: `Added ${type} message from ${source} to session ${sessionId}`
          }, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Add message tool failed:', error.message);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }]
      };
    }
  }

  async generateAiResponse(args) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      const { sessionId, prompt, source = 'service', options = {} } = args;
      const result = await this.generateResponse(sessionId, prompt, source, options);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            result,
            info: `Generated AI response for session ${sessionId}`
          }, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Generate AI response tool failed:', error.message);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }]
      };
    }
  }

  async getConversationTool(args) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      const { sessionId, includeTimeline = false } = args;
      const conversation = await this.getConversation(sessionId, includeTimeline);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            conversation,
            info: `Retrieved conversation ${sessionId}`
          }, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Get conversation tool failed:', error.message);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }]
      };
    }
  }

  async getConversationTimelineTool(args) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      const { sessionId, limit = 50 } = args;
      const timeline = await this.getConversationTimeline(sessionId, limit);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            timeline,
            info: `Retrieved timeline for session ${sessionId}`
          }, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Get conversation timeline tool failed:', error.message);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }]
      };
    }
  }

  async searchConversationsTool(args) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      const { query, limit = 10 } = args;
      const results = await this.searchConversations(query, limit);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            results,
            info: `Found ${results.length} conversations matching: ${query}`
          }, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Search conversations tool failed:', error.message);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }]
      };
    }
  }

  async getConversationStatsTool(args) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      const stats = await this.getConversationStats();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            stats,
            info: 'Retrieved conversation statistics'
          }, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Get conversation stats tool failed:', error.message);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }]
      };
    }
  }

  async cleanupOldConversationsTool(args) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      const { olderThanDays = 30 } = args;
      const cleanedCount = await this.cleanupOldConversations(olderThanDays);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            cleanedCount,
            info: `Cleaned up ${cleanedCount} conversations older than ${olderThanDays} days`
          }, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Cleanup conversations tool failed:', error.message);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }]
      };
    }
  }
}

module.exports = ConversationManager;
