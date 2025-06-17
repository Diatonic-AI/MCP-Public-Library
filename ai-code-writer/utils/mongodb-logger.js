/**
 * MongoDB Tool Execution Logger
 * Logs tool execution with start/end times, success/failure, and response data
 */

const { MongoClient } = require('mongodb');

class MongoDBLogger {
  constructor(config = null) {
    this.client = null;
    this.db = null;
    this.collection = null;
    this.connected = false;
    this.connectionPromise = null;
    
    // Load configuration from bootstrap file if available
    const bootstrapConfig = this._loadBootstrapConfig();
    
    // Get configuration from multiple sources (priority order: constructor > bootstrap > env)
    if (config) {
      this.mongoUri = config.mongoUri || config.mongodb_uri;
      this.dbName = config.dbName || config.database_name;
      this.collectionName = config.collectionName || config.collection_name;
    } else if (bootstrapConfig) {
      this.mongoUri = bootstrapConfig.mongodb_uri;
      this.dbName = bootstrapConfig.database_name;
      this.collectionName = bootstrapConfig.collection_name;
      console.log('[MongoDBLogger] Using bootstrap configuration');
    } else {
      this.mongoUri = process.env.MONGODB_URI;
      this.dbName = process.env.MONGODB_LOGGER_DB || 'mcp_tool_logs';
      this.collectionName = process.env.MONGODB_LOGGER_COLLECTION || 'tool_executions';
    }
    
    if (!this.mongoUri) {
      console.warn('[MongoDBLogger] No MongoDB URI configured, tool logging disabled');
      console.warn('[MongoDBLogger] Run bootstrap_mongo_logger.py or set MONGODB_URI environment variable');
      return;
    }
    
    // Initialize connection lazily
    this.connect();
  }

  /**
   * Load configuration from bootstrap script output
   * @returns {Object|null}
   */
  _loadBootstrapConfig() {
    try {
      const fs = require('fs');
      const configPath = './mongo_logger_config.json';
      
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Validate bootstrap config
        if (config.mongodb_uri && config.database_name && config.collection_name) {
          return config;
        }
      }
    } catch (error) {
      console.warn('[MongoDBLogger] Could not load bootstrap config:', error.message);
    }
    
    return null;
  }

  /**
   * Initialize MongoDB connection
   */
  async connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    if (!this.mongoUri) {
      return Promise.resolve();
    }

    this.connectionPromise = this._performConnection();
    return this.connectionPromise;
  }

  async _performConnection() {
    try {
      this.client = new MongoClient(this.mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        maxIdleTimeMS: 30000
      });
      
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.collection = this.db.collection(this.collectionName);
      
      // Create indices for better query performance
      await this.collection.createIndex({ 'toolName': 1, 'startTime': -1 });
      await this.collection.createIndex({ 'sessionId': 1, 'startTime': -1 });
      await this.collection.createIndex({ 'success': 1, 'startTime': -1 });
      await this.collection.createIndex({ 'startTime': -1 });
      
      this.connected = true;
      console.log(`[MongoDBLogger] Connected to ${this.dbName}.${this.collectionName}`);
    } catch (error) {
      console.error('[MongoDBLogger] Connection failed:', error.message);
      this.connected = false;
    }
  }

  /**
   * Log tool execution start
   * @param {string} toolName - Name of the tool being executed
   * @param {Object} args - Tool arguments
   * @param {string} sessionId - Optional session identifier
   * @returns {string} - Execution ID for tracking
   */
  async logStart(toolName, args = {}, sessionId = null) {
    if (!this.connected) {
      await this.connect();
      if (!this.connected) {
        return null;
      }
    }

    const executionId = this._generateExecutionId();
    const logEntry = {
      _id: executionId,
      toolName,
      sessionId,
      args: this._sanitizeArgs(args),
      startTime: new Date(),
      endTime: null,
      duration: null,
      success: null,
      response: null,
      error: null,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        hostname: require('os').hostname(),
        pid: process.pid
      }
    };

    try {
      await this.collection.insertOne(logEntry);
      return executionId;
    } catch (error) {
      console.error('[MongoDBLogger] Failed to log tool start:', error.message);
      return null;
    }
  }

  /**
   * Log tool execution end
   * @param {string} executionId - Execution ID from logStart
   * @param {boolean} success - Whether tool execution was successful
   * @param {Object|null} response - Tool response (for success)
   * @param {Error|string|null} error - Error information (for failure)
   */
  async logEnd(executionId, success, response = null, error = null) {
    if (!this.connected || !executionId) {
      return;
    }

    const endTime = new Date();
    
    try {
      // Get the start record to calculate duration
      const startRecord = await this.collection.findOne({ _id: executionId });
      if (!startRecord) {
        console.warn(`[MongoDBLogger] Start record not found for execution: ${executionId}`);
        return;
      }

      const duration = endTime - startRecord.startTime;
      
      const updateData = {
        endTime,
        duration,
        success
      };

      if (success) {
        updateData.response = this._sanitizeResponse(response);
      } else {
        updateData.error = this._sanitizeError(error);
      }

      await this.collection.updateOne(
        { _id: executionId },
        { $set: updateData }
      );
    } catch (err) {
      console.error('[MongoDBLogger] Failed to log tool end:', err.message);
    }
  }

  /**
   * Generate unique execution ID
   * @returns {string}
   */
  _generateExecutionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `exec_${timestamp}_${random}`;
  }

  /**
   * Sanitize arguments for logging (remove sensitive data)
   * @param {Object} args
   * @returns {Object}
   */
  _sanitizeArgs(args) {
    if (!args || typeof args !== 'object') {
      return args;
    }

    const sanitized = { ...args };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
    
    const sanitizeRecursive = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          obj[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitizeRecursive(value);
        }
      }
    };

    sanitizeRecursive(sanitized);
    return sanitized;
  }

  /**
   * Sanitize response for logging (limit size and remove sensitive data)
   * @param {Object} response
   * @returns {Object}
   */
  _sanitizeResponse(response) {
    if (!response) {
      return response;
    }

    // Convert to string to check size
    const responseStr = JSON.stringify(response);
    
    // If response is too large, truncate it
    if (responseStr.length > 10000) {
      return {
        _truncated: true,
        _originalSize: responseStr.length,
        _preview: responseStr.substr(0, 1000) + '...'
      };
    }

    return response;
  }

  /**
   * Sanitize error for logging
   * @param {Error|string} error
   * @returns {Object}
   */
  _sanitizeError(error) {
    if (!error) {
      return null;
    }

    if (typeof error === 'string') {
      return { message: error };
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack ? error.stack.split('\n').slice(0, 10).join('\n') : null
      };
    }

    return { message: String(error) };
  }

  /**
   * Close the MongoDB connection
   */
  async close() {
    if (this.client) {
      try {
        await this.client.close();
        this.connected = false;
        console.log('[MongoDBLogger] Connection closed');
      } catch (error) {
        console.error('[MongoDBLogger] Error closing connection:', error.message);
      }
    }
  }
}

module.exports = MongoDBLogger;

