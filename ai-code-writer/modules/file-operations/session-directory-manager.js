/**
 * Session Directory Manager Module
 * 
 * Tracks current working directory (cwd) per session/context in memory
 * with optional Redis persistence for multi-agent scenarios.
 * 
 * Features:
 * - Session-based directory tracking
 * - In-memory storage with Redis fallback
 * - CRUD operations for session directories
 * - Hooks for terminal backend integration
 * - Automatic path validation and normalization
 * - Context isolation per session
 */

const path = require('path');
const fs = require('fs').promises;
const Logger = require('../../utils/logger');
const ResponseFormatter = require('../../utils/response-formatter');

class SessionDirectoryManager {
  constructor(options = {}) {
    this.logger = new Logger('SessionDirectoryManager');
    this.responseFormatter = new ResponseFormatter();
    
    // Configuration
    this.config = {
      useRedis: options.useRedis || false,
      redisPrefix: options.redisPrefix || 'session:cwd:',
      defaultCwd: options.defaultCwd || process.cwd(),
      sessionTimeout: options.sessionTimeout || 3600000, // 1 hour
      enableValidation: options.enableValidation !== false,
      ...options
    };
    
    // In-memory storage for session directories
    this.sessionDirectories = new Map();
    this.sessionTimestamps = new Map();
    
    // Redis client (optional)
    this.redisClient = null;
    
    // Terminal backend hooks
    this.cdHooks = new Set();
    
    this.logger.info('SessionDirectoryManager initialized', {
      useRedis: this.config.useRedis,
      defaultCwd: this.config.defaultCwd
    });
    
    // Start cleanup timer
    this.startCleanupTimer();
  }
  
  /**
   * Initialize Redis connection if configured
   */
  async initializeRedis(redisClient) {
    if (this.config.useRedis && redisClient) {
      this.redisClient = redisClient;
      this.logger.info('Redis client initialized for session persistence');
      
      try {
        await this.redisClient.ping();
        this.logger.info('Redis connection verified');
      } catch (error) {
        this.logger.error('Redis connection failed:', error.message);
        this.config.useRedis = false;
      }
    }
  }
  
  /**
   * Get MCP tools for this module
   */
  getTools() {
    return [
      {
        name: 'create_session_directory',
        description: 'Create a new session with initial working directory',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Unique session identifier' },
            initialCwd: { type: 'string', description: 'Initial working directory (optional)' },
            metadata: { type: 'object', description: 'Additional session metadata' }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'get_session_directory',
        description: 'Get current working directory for a session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session identifier' }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'update_session_directory',
        description: 'Update current working directory for a session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session identifier' },
            newCwd: { type: 'string', description: 'New working directory path' },
            validate: { type: 'boolean', description: 'Validate directory exists (default: true)' }
          },
          required: ['sessionId', 'newCwd']
        }
      },
      {
        name: 'delete_session_directory',
        description: 'Remove session directory tracking',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session identifier' }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'list_session_directories',
        description: 'List all active session directories',
        inputSchema: {
          type: 'object',
          properties: {
            includeMetadata: { type: 'boolean', description: 'Include session metadata' }
          }
        }
      },
      {
        name: 'change_directory',
        description: 'Change directory for a session (cd command equivalent)',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session identifier' },
            targetPath: { type: 'string', description: 'Target directory path (relative or absolute)' },
            createIfNotExists: { type: 'boolean', description: 'Create directory if it does not exist' }
          },
          required: ['sessionId', 'targetPath']
        }
      }
    ];
  }
  
  /**
   * Create a new session with initial working directory
   */
  async createSessionDirectory(args) {
    const { sessionId, initialCwd, metadata = {} } = args;
    
    try {
      if (this.sessionDirectories.has(sessionId)) {
        throw new Error(`Session ${sessionId} already exists`);
      }
      
      const cwd = initialCwd || this.config.defaultCwd;
      
      // Validate directory if enabled
      if (this.config.enableValidation) {
        await this.validateDirectory(cwd);
      }
      
      const normalizedCwd = path.resolve(cwd);
      const sessionData = {
        cwd: normalizedCwd,
        created: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        metadata: metadata
      };
      
      // Store in memory
      this.sessionDirectories.set(sessionId, sessionData);
      this.sessionTimestamps.set(sessionId, Date.now());
      
      // Store in Redis if configured
      if (this.config.useRedis && this.redisClient) {
        await this.redisClient.setEx(
          `${this.config.redisPrefix}${sessionId}`,
          this.config.sessionTimeout / 1000,
          JSON.stringify(sessionData)
        );
      }
      
      this.logger.info(`Session directory created: ${sessionId}`, { cwd: normalizedCwd });
      
      return this.responseFormatter.formatResponse({
        success: true,
        sessionId,
        cwd: normalizedCwd,
        created: sessionData.created,
        metadata: sessionData.metadata
      });
      
    } catch (error) {
      this.logger.error(`Failed to create session directory: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get current working directory for a session
   */
  async getSessionDirectory(args) {
    const { sessionId } = args;
    
    try {
      let sessionData = this.sessionDirectories.get(sessionId);
      
      // Try Redis if not in memory and Redis is configured
      if (!sessionData && this.config.useRedis && this.redisClient) {
        const redisData = await this.redisClient.get(`${this.config.redisPrefix}${sessionId}`);
        if (redisData) {
          sessionData = JSON.parse(redisData);
          // Cache in memory
          this.sessionDirectories.set(sessionId, sessionData);
          this.sessionTimestamps.set(sessionId, Date.now());
        }
      }
      
      if (!sessionData) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      // Update last accessed
      sessionData.lastAccessed = new Date().toISOString();
      this.sessionTimestamps.set(sessionId, Date.now());
      
      return this.responseFormatter.formatResponse({
        success: true,
        sessionId,
        cwd: sessionData.cwd,
        created: sessionData.created,
        lastAccessed: sessionData.lastAccessed,
        metadata: sessionData.metadata
      });
      
    } catch (error) {
      this.logger.error(`Failed to get session directory: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update current working directory for a session
   */
  async updateSessionDirectory(args) {
    const { sessionId, newCwd, validate = true } = args;
    
    try {
      let sessionData = this.sessionDirectories.get(sessionId);
      
      // Try Redis if not in memory
      if (!sessionData && this.config.useRedis && this.redisClient) {
        const redisData = await this.redisClient.get(`${this.config.redisPrefix}${sessionId}`);
        if (redisData) {
          sessionData = JSON.parse(redisData);
        }
      }
      
      if (!sessionData) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      // Resolve path relative to current session cwd
      const resolvedPath = path.isAbsolute(newCwd) 
        ? newCwd 
        : path.resolve(sessionData.cwd, newCwd);
      
      // Validate directory if requested
      if (validate && this.config.enableValidation) {
        await this.validateDirectory(resolvedPath);
      }
      
      const normalizedCwd = path.resolve(resolvedPath);
      const oldCwd = sessionData.cwd;
      
      // Update session data
      sessionData.cwd = normalizedCwd;
      sessionData.lastAccessed = new Date().toISOString();
      sessionData.lastChanged = new Date().toISOString();
      
      // Update in memory
      this.sessionDirectories.set(sessionId, sessionData);
      this.sessionTimestamps.set(sessionId, Date.now());
      
      // Update in Redis if configured
      if (this.config.useRedis && this.redisClient) {
        await this.redisClient.setEx(
          `${this.config.redisPrefix}${sessionId}`,
          this.config.sessionTimeout / 1000,
          JSON.stringify(sessionData)
        );
      }
      
      // Trigger cd hooks
      await this.triggerCdHooks(sessionId, oldCwd, normalizedCwd);
      
      this.logger.info(`Session directory updated: ${sessionId}`, {
        oldCwd,
        newCwd: normalizedCwd
      });
      
      return this.responseFormatter.formatResponse({
        success: true,
        sessionId,
        oldCwd,
        newCwd: normalizedCwd,
        changed: sessionData.lastChanged
      });
      
    } catch (error) {
      this.logger.error(`Failed to update session directory: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Remove session directory tracking
   */
  async deleteSessionDirectory(args) {
    const { sessionId } = args;
    
    try {
      const existed = this.sessionDirectories.has(sessionId);
      
      // Remove from memory
      this.sessionDirectories.delete(sessionId);
      this.sessionTimestamps.delete(sessionId);
      
      // Remove from Redis if configured
      if (this.config.useRedis && this.redisClient) {
        await this.redisClient.del(`${this.config.redisPrefix}${sessionId}`);
      }
      
      this.logger.info(`Session directory deleted: ${sessionId}`);
      
      return this.responseFormatter.formatResponse({
        success: true,
        sessionId,
        existed
      });
      
    } catch (error) {
      this.logger.error(`Failed to delete session directory: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * List all active session directories
   */
  async listSessionDirectories(args = {}) {
    const { includeMetadata = false } = args;
    
    try {
      const sessions = [];
      
      // Get from memory
      for (const [sessionId, sessionData] of this.sessionDirectories.entries()) {
        const session = {
          sessionId,
          cwd: sessionData.cwd,
          created: sessionData.created,
          lastAccessed: sessionData.lastAccessed
        };
        
        if (includeMetadata) {
          session.metadata = sessionData.metadata;
        }
        
        sessions.push(session);
      }
      
      // If Redis is configured, also check for sessions only in Redis
      if (this.config.useRedis && this.redisClient) {
        const redisKeys = await this.redisClient.keys(`${this.config.redisPrefix}*`);
        
        for (const key of redisKeys) {
          const sessionId = key.replace(this.config.redisPrefix, '');
          
          // Skip if already in memory
          if (this.sessionDirectories.has(sessionId)) {
            continue;
          }
          
          const redisData = await this.redisClient.get(key);
          if (redisData) {
            const sessionData = JSON.parse(redisData);
            const session = {
              sessionId,
              cwd: sessionData.cwd,
              created: sessionData.created,
              lastAccessed: sessionData.lastAccessed,
              source: 'redis'
            };
            
            if (includeMetadata) {
              session.metadata = sessionData.metadata;
            }
            
            sessions.push(session);
          }
        }
      }
      
      return this.responseFormatter.formatResponse({
        success: true,
        totalSessions: sessions.length,
        sessions
      });
      
    } catch (error) {
      this.logger.error(`Failed to list session directories: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Change directory for a session (cd command equivalent)
   */
  async changeDirectory(args) {
    const { sessionId, targetPath, createIfNotExists = false } = args;
    
    try {
      // Get current session data
      let sessionData = this.sessionDirectories.get(sessionId);
      
      if (!sessionData && this.config.useRedis && this.redisClient) {
        const redisData = await this.redisClient.get(`${this.config.redisPrefix}${sessionId}`);
        if (redisData) {
          sessionData = JSON.parse(redisData);
          this.sessionDirectories.set(sessionId, sessionData);
        }
      }
      
      if (!sessionData) {
        // Create session with default cwd if it doesn't exist
        await this.createSessionDirectory({ sessionId, initialCwd: this.config.defaultCwd });
        sessionData = this.sessionDirectories.get(sessionId);
      }
      
      // Handle special path cases
      let resolvedPath;
      if (targetPath === '~') {
        resolvedPath = require('os').homedir();
      } else if (targetPath === '.') {
        resolvedPath = sessionData.cwd;
      } else if (targetPath === '..') {
        resolvedPath = path.dirname(sessionData.cwd);
      } else if (path.isAbsolute(targetPath)) {
        resolvedPath = targetPath;
      } else {
        resolvedPath = path.resolve(sessionData.cwd, targetPath);
      }
      
      const normalizedPath = path.resolve(resolvedPath);
      
      // Check if directory exists
      try {
        const stats = await fs.stat(normalizedPath);
        if (!stats.isDirectory()) {
          throw new Error(`${normalizedPath} is not a directory`);
        }
      } catch (error) {
        if (createIfNotExists && error.code === 'ENOENT') {
          await fs.mkdir(normalizedPath, { recursive: true });
          this.logger.info(`Created directory: ${normalizedPath}`);
        } else {
          throw new Error(`Directory ${normalizedPath} does not exist`);
        }
      }
      
      // Update session directory
      return await this.updateSessionDirectory({
        sessionId,
        newCwd: normalizedPath,
        validate: false // Already validated above
      });
      
    } catch (error) {
      this.logger.error(`Failed to change directory: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Register a hook to be called when directory changes
   */
  registerCdHook(hookFunction) {
    this.cdHooks.add(hookFunction);
    this.logger.debug('Registered cd hook');
  }
  
  /**
   * Unregister a cd hook
   */
  unregisterCdHook(hookFunction) {
    this.cdHooks.delete(hookFunction);
    this.logger.debug('Unregistered cd hook');
  }
  
  /**
   * Trigger all registered cd hooks
   */
  async triggerCdHooks(sessionId, oldCwd, newCwd) {
    for (const hook of this.cdHooks) {
      try {
        await hook(sessionId, oldCwd, newCwd);
      } catch (error) {
        this.logger.error(`Cd hook failed: ${error.message}`);
      }
    }
  }
  
  /**
   * Validate that a directory exists and is accessible
   */
  async validateDirectory(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`${dirPath} is not a directory`);
      }
      
      // Test read access
      await fs.access(dirPath, fs.constants.R_OK);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory ${dirPath} does not exist`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Access denied to directory ${dirPath}`);
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Start cleanup timer for expired sessions
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Run every minute
  }
  
  /**
   * Clean up expired sessions from memory
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];
    
    for (const [sessionId, timestamp] of this.sessionTimestamps.entries()) {
      if (now - timestamp > this.config.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }
    
    for (const sessionId of expiredSessions) {
      this.sessionDirectories.delete(sessionId);
      this.sessionTimestamps.delete(sessionId);
      this.logger.debug(`Cleaned up expired session: ${sessionId}`);
    }
    
    if (expiredSessions.length > 0) {
      this.logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }
  
  /**
   * Get session info without updating timestamps
   */
  getSessionInfo(sessionId) {
    const sessionData = this.sessionDirectories.get(sessionId);
    return sessionData ? { ...sessionData } : null;
  }
  
  /**
   * Check if session exists
   */
  hasSession(sessionId) {
    return this.sessionDirectories.has(sessionId);
  }
  
  /**
   * Get current working directory for session (sync)
   */
  getCurrentDirectory(sessionId) {
    const sessionData = this.sessionDirectories.get(sessionId);
    return sessionData ? sessionData.cwd : this.config.defaultCwd;
  }
  
  /**
   * Clean shutdown
   */
  async shutdown() {
    this.logger.info('Shutting down SessionDirectoryManager');
    
    // Clear all sessions from memory
    this.sessionDirectories.clear();
    this.sessionTimestamps.clear();
    
    // Close Redis connection if exists
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch (error) {
        this.logger.error('Error closing Redis connection:', error.message);
      }
    }
  }
}

module.exports = SessionDirectoryManager;

