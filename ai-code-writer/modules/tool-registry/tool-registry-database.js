/**
 * Tool Registry Database Module
 * MongoDB-based persistent storage for tool metadata and performance tracking
 */

const { MongoClient } = require('mongodb');
const Logger = require('../../utils/logger');
const ResponseFormatter = require('../../utils/response-formatter');

class ToolRegistryDatabase {
  constructor() {
    this.logger = new Logger('ToolRegistryDB');
    this.responseFormatter = new ResponseFormatter();
    this.client = null;
    this.db = null;
    this.collections = {
      tools: null,
      servers: null,
      performance: null,
      usage_logs: null
    };
    this.isConnected = false;
  }

  getTools() {
    return [
      {
        name: 'initialize_tool_registry_db',
        description: 'Initialize MongoDB tool registry database',
        inputSchema: {
          type: 'object',
          properties: {
            connection_string: {
              type: 'string',
              description: 'MongoDB connection string',
              default: 'mongodb://localhost:27017'
            },
            database_name: {
              type: 'string',
              description: 'Database name for tool registry',
              default: 'mcp_tool_registry'
            }
          }
        }
      },
      {
        name: 'register_terminal_tools',
        description: 'Register terminal execution and command tools',
        inputSchema: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              enum: ['windows', 'wsl', 'linux', 'darwin'],
              description: 'Target platform for terminal tools'
            },
            capabilities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Terminal capabilities (streaming, capture, batch, etc.)'
            }
          }
        }
      },
      {
        name: 'register_navigation_tools', 
        description: 'Register file system navigation and directory tools',
        inputSchema: {
          type: 'object',
          properties: {
            supported_operations: {
              type: 'array',
              items: { type: 'string' },
              description: 'Supported navigation operations (list, tree, index, etc.)'
            },
            cross_platform: {
              type: 'boolean',
              default: true,
              description: 'Whether tools support cross-platform paths'
            }
          }
        }
      },
      {
        name: 'register_discovered_tools',
        description: 'Register discovered tools in database',
        inputSchema: {
          type: 'object',
          properties: {
            discovery_results: {
              type: 'object',
              description: 'Results from tool discovery process'
            },
            update_existing: {
              type: 'boolean',
              default: true,
              description: 'Update existing tool records'
            }
          },
          required: ['discovery_results']
        }
      },
      {
        name: 'record_tool_usage',
        description: 'Record tool usage for performance tracking',
        inputSchema: {
          type: 'object',
          properties: {
            tool_id: {
              type: 'string',
              description: 'Unique tool identifier'
            },
            execution_time: {
              type: 'number',
              description: 'Execution time in milliseconds'
            },
            success: {
              type: 'boolean',
              description: 'Whether execution was successful'
            },
            error_message: {
              type: 'string',
              description: 'Error message if execution failed'
            },
            user_rating: {
              type: 'number',
              description: 'User rating (1-5)',
              minimum: 1,
              maximum: 5
            },
            task_description: {
              type: 'string',
              description: 'Description of task performed'
            }
          },
          required: ['tool_id', 'execution_time', 'success']
        }
      },
      {
        name: 'get_tool_performance',
        description: 'Get performance metrics for tools',
        inputSchema: {
          type: 'object',
          properties: {
            tool_id: {
              type: 'string',
              description: 'Specific tool ID to get metrics for'
            },
            server_name: {
              type: 'string',
              description: 'Filter by server name'
            },
            time_range: {
              type: 'string',
              description: 'Time range for metrics (24h, 7d, 30d)',
              default: '7d'
            }
          }
        }
      },
      {
        name: 'get_tool_recommendations',
        description: 'Get tool recommendations based on usage patterns',
        inputSchema: {
          type: 'object',
          properties: {
            current_tool: {
              type: 'string',
              description: 'Current tool being used'
            },
            task_context: {
              type: 'string',
              description: 'Context of current task'
            },
            max_recommendations: {
              type: 'number',
              default: 5,
              description: 'Maximum number of recommendations'
            }
          }
        }
      }
    ];
  }

  async initializeToolRegistryDb(args) {
    try {
      const { 
        connection_string = process.env.MONGODB_URI || 'mongodb://localhost:27017',
        database_name = 'mcp_tool_registry'
      } = args;

      this.logger.info('Initializing tool registry database...');

      // Connect to MongoDB
      this.client = new MongoClient(connection_string);
      await this.client.connect();
      
      this.db = this.client.db(database_name);
      
      // Initialize collections
      this.collections.tools = this.db.collection('tools');
      this.collections.servers = this.db.collection('servers');
      this.collections.performance = this.db.collection('performance');
      this.collections.usage_logs = this.db.collection('usage_logs');
      
      // Create indexes for better performance
      await this.createIndexes();
      
      this.isConnected = true;
      
      const result = {
        operation: 'initialize_database',
        success: true,
        database_name,
        connection_string: connection_string.replace(/\/\/.*@/, '//***:***@'), // Hide credentials
        collections_created: Object.keys(this.collections),
        indexes_created: await this.getIndexInfo(),
        timestamp: new Date().toISOString()
      };
      
      this.logger.info('Tool registry database initialized successfully');
      
      return this.responseFormatter.formatResponse(result, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Database initialization failed:', error.message);
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  async registerDiscoveredTools(args) {
    try {
      const { discovery_results, update_existing = true } = args;
      
      if (!this.isConnected) {
        throw new Error('Database not initialized. Please run initialize_tool_registry_db first.');
      }
      
      this.logger.info('Registering discovered tools in database...');
      
      const registrationResults = {
        operation: 'register_tools',
        timestamp: new Date().toISOString(),
        servers_processed: 0,
        tools_registered: 0,
        tools_updated: 0,
        tools_skipped: 0,
        errors: []
      };
      
      // Register servers first
      if (discovery_results.servers_found) {
        for (const server of discovery_results.servers_found) {
          try {
            await this.registerServer(server, update_existing);
            registrationResults.servers_processed++;
          } catch (error) {
            this.logger.warn(`Failed to register server ${server.name}:`, error.message);
            registrationResults.errors.push(`Server ${server.name}: ${error.message}`);
          }
        }
      }
      
      // Register tools
      if (discovery_results.tools_discovered) {
        for (const tool of discovery_results.tools_discovered) {
          try {
            const result = await this.registerTool(tool, update_existing);
            if (result.created) {
              registrationResults.tools_registered++;
            } else if (result.updated) {
              registrationResults.tools_updated++;
            } else {
              registrationResults.tools_skipped++;
            }
          } catch (error) {
            this.logger.warn(`Failed to register tool ${tool.name}:`, error.message);
            registrationResults.errors.push(`Tool ${tool.name}: ${error.message}`);
          }
        }
      }
      
      this.logger.info(`Registration complete: ${registrationResults.tools_registered} new, ${registrationResults.tools_updated} updated`);
      
      return this.responseFormatter.formatResponse(registrationResults, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Tool registration failed:', error.message);
      throw new Error(`Tool registration failed: ${error.message}`);
    }
  }

  async recordToolUsage(args) {
    try {
      const {
        tool_id,
        execution_time,
        success,
        error_message,
        user_rating,
        task_description
      } = args;
      
      if (!this.isConnected) {
        throw new Error('Database not initialized.');
      }
      
      const usageRecord = {
        tool_id,
        timestamp: new Date(),
        execution_time,
        success,
        error_message: error_message || null,
        user_rating: user_rating || null,
        task_description: task_description || null,
        session_id: this.generateSessionId()
      };
      
      // Insert usage log
      await this.collections.usage_logs.insertOne(usageRecord);
      
      // Update tool performance metrics
      await this.updateToolPerformance(tool_id, usageRecord);
      
      const result = {
        operation: 'record_usage',
        success: true,
        tool_id,
        recorded_at: usageRecord.timestamp,
        performance_updated: true
      };
      
      return this.responseFormatter.formatResponse(result, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Failed to record tool usage:', error.message);
      throw new Error(`Failed to record tool usage: ${error.message}`);
    }
  }

  async getToolPerformance(args) {
    try {
      const { tool_id, server_name, time_range = '7d' } = args;
      
      if (!this.isConnected) {
        throw new Error('Database not initialized.');
      }
      
      const timeRangeMs = this.parseTimeRange(time_range);
      const startDate = new Date(Date.now() - timeRangeMs);
      
      let query = { timestamp: { $gte: startDate } };
      
      if (tool_id) {
        query.tool_id = tool_id;
      }
      
      // Get usage logs
      const usageLogs = await this.collections.usage_logs.find(query).toArray();
      
      // Get tool performance records
      let performanceQuery = {};
      if (tool_id) {
        performanceQuery.tool_id = tool_id;
      }
      if (server_name) {
        performanceQuery.server_name = server_name;
      }
      
      const performanceRecords = await this.collections.performance.find(performanceQuery).toArray();
      
      // Calculate aggregated metrics
      const metrics = this.calculateAggregatedMetrics(usageLogs, performanceRecords);
      
      const result = {
        operation: 'get_performance',
        time_range,
        query_criteria: { tool_id, server_name },
        total_usages: usageLogs.length,
        metrics,
        top_performing_tools: await this.getTopPerformingTools(5),
        recent_usage_trends: this.calculateUsageTrends(usageLogs)
      };
      
      return this.responseFormatter.formatResponse(result, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Failed to get tool performance:', error.message);
      throw new Error(`Failed to get tool performance: ${error.message}`);
    }
  }

  async getToolRecommendations(args) {
    try {
      const { current_tool, task_context, max_recommendations = 5 } = args;
      
      if (!this.isConnected) {
        throw new Error('Database not initialized.');
      }
      
      // Get tool chains and recommendations based on usage patterns
      const recommendations = await this.generateRecommendations(
        current_tool, 
        task_context, 
        max_recommendations
      );
      
      const result = {
        operation: 'get_recommendations',
        current_tool,
        task_context,
        recommendations,
        recommendation_score_explanation: {
          usage_frequency: 'How often tools are used together',
          success_rate: 'Historical success rate of tool chains',
          context_similarity: 'Similarity to current task context',
          user_ratings: 'Average user ratings for tool combinations'
        }
      };
      
      return this.responseFormatter.formatResponse(result, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Failed to get tool recommendations:', error.message);
      throw new Error(`Failed to get tool recommendations: ${error.message}`);
    }
  }

  async registerTerminalTools(args) {
    try {
      const { platform, capabilities = [] } = args;
      
      if (!this.isConnected) {
        throw new Error('Database not initialized.');
      }
      
      this.logger.info(`Registering terminal tools for platform: ${platform}`);
      
      const terminalTools = this.generateTerminalToolDefinitions(platform, capabilities);
      
      const registrationResults = {
        operation: 'register_terminal_tools',
        platform,
        capabilities,
        tools_registered: 0,
        tools_updated: 0,
        timestamp: new Date().toISOString()
      };
      
      for (const toolDef of terminalTools) {
        const result = await this.registerTool(toolDef, true);
        if (result.created) {
          registrationResults.tools_registered++;
        } else if (result.updated) {
          registrationResults.tools_updated++;
        }
      }
      
      this.logger.info(`Terminal tools registration complete: ${registrationResults.tools_registered} new, ${registrationResults.tools_updated} updated`);
      
      return this.responseFormatter.formatResponse(registrationResults, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Failed to register terminal tools:', error.message);
      throw new Error(`Failed to register terminal tools: ${error.message}`);
    }
  }

  async registerNavigationTools(args) {
    try {
      const { supported_operations = [], cross_platform = true } = args;
      
      if (!this.isConnected) {
        throw new Error('Database not initialized.');
      }
      
      this.logger.info('Registering file navigation and directory tools');
      
      const navigationTools = this.generateNavigationToolDefinitions(supported_operations, cross_platform);
      
      const registrationResults = {
        operation: 'register_navigation_tools',
        supported_operations,
        cross_platform,
        tools_registered: 0,
        tools_updated: 0,
        timestamp: new Date().toISOString()
      };
      
      for (const toolDef of navigationTools) {
        const result = await this.registerTool(toolDef, true);
        if (result.created) {
          registrationResults.tools_registered++;
        } else if (result.updated) {
          registrationResults.tools_updated++;
        }
      }
      
      this.logger.info(`Navigation tools registration complete: ${registrationResults.tools_registered} new, ${registrationResults.tools_updated} updated`);
      
      return this.responseFormatter.formatResponse(registrationResults, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Failed to register navigation tools:', error.message);
      throw new Error(`Failed to register navigation tools: ${error.message}`);
    }
  }

  // Helper methods
  
  async createIndexes() {
    // Tools collection indexes
    await this.collections.tools.createIndex({ tool_id: 1 }, { unique: true });
    await this.collections.tools.createIndex({ server_name: 1 });
    await this.collections.tools.createIndex({ category: 1 });
    await this.collections.tools.createIndex({ 'performance_data.usage_count': -1 });
    
    // Servers collection indexes
    await this.collections.servers.createIndex({ name: 1 }, { unique: true });
    await this.collections.servers.createIndex({ type: 1 });
    
    // Performance collection indexes
    await this.collections.performance.createIndex({ tool_id: 1 });
    await this.collections.performance.createIndex({ last_updated: -1 });
    
    // Usage logs collection indexes
    await this.collections.usage_logs.createIndex({ tool_id: 1 });
    await this.collections.usage_logs.createIndex({ timestamp: -1 });
    await this.collections.usage_logs.createIndex({ success: 1 });
    await this.collections.usage_logs.createIndex({ session_id: 1 });
  }

  async getIndexInfo() {
    const indexes = {};
    for (const [name, collection] of Object.entries(this.collections)) {
      indexes[name] = await collection.listIndexes().toArray();
    }
    return indexes;
  }

  async registerServer(server, updateExisting) {
    const serverDoc = {
      ...server,
      registered_at: new Date(),
      last_scanned: new Date()
    };
    
    if (updateExisting) {
      await this.collections.servers.replaceOne(
        { name: server.name },
        serverDoc,
        { upsert: true }
      );
    } else {
      await this.collections.servers.insertOne(serverDoc);
    }
  }

  async registerTool(tool, updateExisting) {
    const toolDoc = {
      tool_id: tool.id,
      name: tool.name,
      description: tool.description,
      server_name: tool.server_name,
      server_path: tool.server_path,
      file_path: tool.file_path,
      category: tool.category,
      suggested_chains: tool.suggested_chains,
      input_schema: tool.input_schema,
      discovered_at: new Date(tool.discovered_at),
      registered_at: new Date(),
      last_updated: new Date(),
      performance_summary: {
        usage_count: 0,
        success_rate: 0,
        average_duration: 0,
        average_rating: 0,
        last_used: null
      }
    };
    
    const existing = await this.collections.tools.findOne({ tool_id: tool.id });
    
    if (existing) {
      if (updateExisting) {
        await this.collections.tools.updateOne(
          { tool_id: tool.id },
          { $set: { ...toolDoc, performance_summary: existing.performance_summary } }
        );
        return { updated: true };
      } else {
        return { skipped: true };
      }
    } else {
      await this.collections.tools.insertOne(toolDoc);
      return { created: true };
    }
  }

  async updateToolPerformance(toolId, usageRecord) {
    // Get current performance record
    let performance = await this.collections.performance.findOne({ tool_id: toolId });
    
    if (!performance) {
      performance = {
        tool_id: toolId,
        total_usage_count: 0,
        success_count: 0,
        total_execution_time: 0,
        total_ratings: 0,
        ratings_count: 0,
        first_used: usageRecord.timestamp,
        last_used: usageRecord.timestamp,
        last_updated: new Date()
      };
    }
    
    // Update metrics
    performance.total_usage_count++;
    if (usageRecord.success) {
      performance.success_count++;
    }
    performance.total_execution_time += usageRecord.execution_time;
    
    if (usageRecord.user_rating) {
      performance.total_ratings += usageRecord.user_rating;
      performance.ratings_count++;
    }
    
    performance.last_used = usageRecord.timestamp;
    performance.last_updated = new Date();
    
    // Calculate derived metrics
    performance.success_rate = performance.success_count / performance.total_usage_count;
    performance.average_duration = performance.total_execution_time / performance.total_usage_count;
    performance.average_rating = performance.ratings_count > 0 ? 
      performance.total_ratings / performance.ratings_count : 0;
    
    // Upsert performance record
    await this.collections.performance.replaceOne(
      { tool_id: toolId },
      performance,
      { upsert: true }
    );
    
    // Update tool summary
    await this.collections.tools.updateOne(
      { tool_id: toolId },
      {
        $set: {
          'performance_summary.usage_count': performance.total_usage_count,
          'performance_summary.success_rate': performance.success_rate,
          'performance_summary.average_duration': performance.average_duration,
          'performance_summary.average_rating': performance.average_rating,
          'performance_summary.last_used': performance.last_used,
          last_updated: new Date()
        }
      }
    );
  }

  parseTimeRange(timeRange) {
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return ranges[timeRange] || ranges['7d'];
  }

  calculateAggregatedMetrics(usageLogs, performanceRecords) {
    if (usageLogs.length === 0) {
      return {
        total_executions: 0,
        success_rate: 0,
        average_duration: 0,
        average_rating: 0
      };
    }
    
    const successCount = usageLogs.filter(log => log.success).length;
    const totalDuration = usageLogs.reduce((sum, log) => sum + log.execution_time, 0);
    const ratingsLogs = usageLogs.filter(log => log.user_rating);
    const totalRating = ratingsLogs.reduce((sum, log) => sum + log.user_rating, 0);
    
    return {
      total_executions: usageLogs.length,
      success_rate: successCount / usageLogs.length,
      average_duration: totalDuration / usageLogs.length,
      average_rating: ratingsLogs.length > 0 ? totalRating / ratingsLogs.length : 0,
      unique_tools_used: [...new Set(usageLogs.map(log => log.tool_id))].length
    };
  }

  async getTopPerformingTools(limit) {
    return await this.collections.performance.find({})
      .sort({ 
        success_rate: -1, 
        average_rating: -1, 
        total_usage_count: -1 
      })
      .limit(limit)
      .toArray();
  }

  calculateUsageTrends(usageLogs) {
    // Group usage by day for trend analysis
    const dailyUsage = {};
    
    usageLogs.forEach(log => {
      const day = log.timestamp.toISOString().split('T')[0];
      if (!dailyUsage[day]) {
        dailyUsage[day] = { total: 0, successful: 0 };
      }
      dailyUsage[day].total++;
      if (log.success) {
        dailyUsage[day].successful++;
      }
    });
    
    return Object.keys(dailyUsage)
      .sort()
      .map(day => ({
        date: day,
        total_usage: dailyUsage[day].total,
        successful_usage: dailyUsage[day].successful,
        success_rate: dailyUsage[day].successful / dailyUsage[day].total
      }));
  }

  async generateRecommendations(currentTool, taskContext, maxRecommendations) {
    // Get tools frequently used with current tool
    const toolChains = await this.collections.usage_logs.aggregate([
      {
        $match: {
          timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }
      },
      {
        $group: {
          _id: '$session_id',
          tools_used: { $push: '$tool_id' }
        }
      },
      {
        $match: {
          tools_used: currentTool
        }
      }
    ]).toArray();
    
    // Count tool co-occurrences
    const coOccurrences = {};
    toolChains.forEach(session => {
      session.tools_used.forEach(tool => {
        if (tool !== currentTool) {
          coOccurrences[tool] = (coOccurrences[tool] || 0) + 1;
        }
      });
    });
    
    // Get top tools and their performance
    const recommendedTools = [];
    for (const [toolId, count] of Object.entries(coOccurrences)) {
      const toolInfo = await this.collections.tools.findOne({ tool_id: toolId });
      const performance = await this.collections.performance.findOne({ tool_id: toolId });
      
      if (toolInfo && performance) {
        recommendedTools.push({
          tool_id: toolId,
          name: toolInfo.name,
          description: toolInfo.description,
          category: toolInfo.category,
          usage_frequency: count,
          success_rate: performance.success_rate,
          average_rating: performance.average_rating,
          recommendation_score: this.calculateRecommendationScore(
            count, 
            performance.success_rate, 
            performance.average_rating,
            toolInfo.description,
            taskContext
          )
        });
      }
    }
    
    // Sort by recommendation score and return top N
    return recommendedTools
      .sort((a, b) => b.recommendation_score - a.recommendation_score)
      .slice(0, maxRecommendations);
  }

  calculateRecommendationScore(usageFreq, successRate, avgRating, description, taskContext) {
    let score = 0;
    
    // Usage frequency (normalized to 0-1)
    score += Math.min(usageFreq / 10, 1) * 0.3;
    
    // Success rate
    score += successRate * 0.4;
    
    // Average rating (normalized from 1-5 to 0-1)
    score += (avgRating - 1) / 4 * 0.2;
    
    // Context similarity (simple keyword matching)
    if (taskContext && description) {
      const contextWords = taskContext.toLowerCase().split(' ');
      const descWords = description.toLowerCase().split(' ');
      const commonWords = contextWords.filter(word => descWords.includes(word));
      score += (commonWords.length / contextWords.length) * 0.1;
    }
    
    return score;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateTerminalToolDefinitions(platform, capabilities) {
    const terminalTools = [
      {
        id: `terminal_execute_${platform}`,
        name: 'terminal_execute',
        description: `Execute terminal commands on ${platform} platform`,
        server_name: 'terminal-backend',
        server_path: './modules/terminal-backend',
        file_path: './modules/terminal-backend/terminal-executor.js',
        category: 'terminal',
        suggested_chains: ['file_operations', 'directory_navigation'],
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            options: { 
              type: 'object',
              properties: {
                timeout: { type: 'number', default: 30000 },
                workingDirectory: { type: 'string' },
                streaming: { type: 'boolean', default: false }
              }
            }
          },
          required: ['command']
        },
        parameters: {
          command: 'string - Terminal command to execute',
          options: 'object - Execution options (timeout, workingDirectory, streaming)'
        },
        returns: 'object - Execution result with stdout, stderr, exitCode',
        contexts: ['development', 'system_administration', 'file_management', 'automation'],
        discovered_at: new Date().toISOString()
      }
    ];

    // Add streaming capability if supported
    if (capabilities.includes('streaming')) {
      terminalTools.push({
        id: `terminal_execute_streaming_${platform}`,
        name: 'terminal_execute_streaming',
        description: `Execute terminal commands with streaming output on ${platform}`,
        server_name: 'terminal-backend',
        server_path: './modules/terminal-backend',
        file_path: './modules/terminal-backend/terminal-executor.js',
        category: 'terminal',
        suggested_chains: ['log_monitoring', 'real_time_output'],
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            options: { 
              type: 'object',
              properties: {
                timeout: { type: 'number', default: 30000 },
                workingDirectory: { type: 'string' },
                maxBufferSize: { type: 'number', default: 1048576 }
              }
            }
          },
          required: ['command']
        },
        parameters: {
          command: 'string - Terminal command to execute',
          options: 'object - Streaming execution options'
        },
        returns: 'object - Streaming execution result with real-time output',
        contexts: ['monitoring', 'long_running_processes', 'real_time_feedback'],
        discovered_at: new Date().toISOString()
      });
    }

    // Add batch execution capability if supported
    if (capabilities.includes('batch')) {
      terminalTools.push({
        id: `terminal_execute_batch_${platform}`,
        name: 'terminal_execute_batch',
        description: `Execute multiple terminal commands in sequence on ${platform}`,
        server_name: 'terminal-backend',
        server_path: './modules/terminal-backend',
        file_path: './modules/terminal-backend/terminal-executor.js',
        category: 'terminal',
        suggested_chains: ['automation', 'deployment_scripts'],
        input_schema: {
          type: 'object',
          properties: {
            commands: { 
              type: 'array',
              items: { type: 'string' },
              description: 'Array of commands to execute'
            },
            options: { 
              type: 'object',
              properties: {
                stopOnError: { type: 'boolean', default: true },
                timeout: { type: 'number', default: 30000 },
                workingDirectory: { type: 'string' }
              }
            }
          },
          required: ['commands']
        },
        parameters: {
          commands: 'array - List of terminal commands to execute',
          options: 'object - Batch execution options'
        },
        returns: 'array - Array of execution results for each command',
        contexts: ['automation', 'batch_processing', 'deployment', 'testing'],
        discovered_at: new Date().toISOString()
      });
    }

    return terminalTools;
  }

  generateNavigationToolDefinitions(supportedOperations, crossPlatform) {
    const navigationTools = [
      {
        id: 'directory_list',
        name: 'directory_list',
        description: 'List directory contents with extended metadata',
        server_name: 'file-operations',
        server_path: './modules/file-operations',
        file_path: './modules/file-operations/directory-navigation.js',
        category: 'navigation',
        suggested_chains: ['file_search', 'directory_tree'],
        input_schema: {
          type: 'object',
          properties: {
            directory: { type: 'string', default: '.', description: 'Directory path to list' },
            depth: { type: 'number', default: 0, description: 'Maximum depth to traverse' },
            options: {
              type: 'object',
              properties: {
                includeHidden: { type: 'boolean', default: false },
                includeHashes: { type: 'boolean', default: false },
                sortBy: { type: 'string', enum: ['name', 'size', 'mtime', 'type'], default: 'name' },
                sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' }
              }
            }
          }
        },
        parameters: {
          directory: 'string - Directory path to list',
          depth: 'number - Maximum depth to traverse',
          options: 'object - Listing options (sorting, filtering, etc.)'
        },
        returns: 'array - Array of directory entries with metadata',
        contexts: ['file_management', 'exploration', 'analysis', 'development'],
        discovered_at: new Date().toISOString()
      }
    ];

    // Add tree visualization if supported
    if (supportedOperations.includes('tree')) {
      navigationTools.push({
        id: 'directory_tree',
        name: 'directory_tree',
        description: 'Generate ASCII/UTF tree visualization of directory structure',
        server_name: 'file-operations',
        server_path: './modules/file-operations',
        file_path: './modules/file-operations/directory-navigation.js',
        category: 'navigation',
        suggested_chains: ['documentation', 'project_overview'],
        input_schema: {
          type: 'object',
          properties: {
            directory: { type: 'string', default: '.', description: 'Directory path to visualize' },
            maxDepth: { type: 'number', default: 3, description: 'Maximum depth to traverse' }
          }
        },
        parameters: {
          directory: 'string - Directory path to visualize',
          maxDepth: 'number - Maximum depth for tree generation'
        },
        returns: 'string - ASCII tree representation of directory structure',
        contexts: ['documentation', 'project_structure', 'visualization'],
        discovered_at: new Date().toISOString()
      });
    }

    // Add indexing capability if supported
    if (supportedOperations.includes('index')) {
      navigationTools.push({
        id: 'directory_index',
        name: 'directory_index',
        description: 'Generate comprehensive JSON index with file hashes for change detection',
        server_name: 'file-operations',
        server_path: './modules/file-operations',
        file_path: './modules/file-operations/directory-navigation.js',
        category: 'navigation',
        suggested_chains: ['change_detection', 'backup_verification'],
        input_schema: {
          type: 'object',
          properties: {
            directory: { type: 'string', default: '.', description: 'Directory path to index' }
          }
        },
        parameters: {
          directory: 'string - Directory path to index'
        },
        returns: 'object - JSON index with file metadata and hashes',
        contexts: ['backup', 'version_control', 'change_detection', 'archival'],
        discovered_at: new Date().toISOString()
      });
    }

    // Add advanced file operations if supported
    if (supportedOperations.includes('file_ops')) {
      navigationTools.push({
        id: 'advanced_file_operations',
        name: 'advanced_file_operations',
        description: 'Comprehensive file and directory operations',
        server_name: 'file-operations',
        server_path: './modules/file-operations',
        file_path: './modules/file-operations/file-operations.js',
        category: 'file_operations',
        suggested_chains: ['backup', 'content_analysis', 'file_search'],
        input_schema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['create', 'read', 'update', 'delete', 'copy', 'move', 'search', 'analyze'],
              description: 'Type of file operation'
            },
            target_path: { type: 'string', description: 'Path to target file or directory' },
            content: { type: 'string', description: 'Content for create/update operations' },
            options: { type: 'object', description: 'Additional options for the operation' }
          },
          required: ['operation', 'target_path']
        },
        parameters: {
          operation: 'string - Type of file operation to perform',
          target_path: 'string - Path to target file or directory',
          content: 'string - Content for create/update operations',
          options: 'object - Additional operation options'
        },
        returns: 'object - Operation result with status and metadata',
        contexts: ['file_management', 'content_creation', 'backup', 'analysis'],
        discovered_at: new Date().toISOString()
      });
    }

    return navigationTools;
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
    }
  }
}

module.exports = ToolRegistryDatabase;

