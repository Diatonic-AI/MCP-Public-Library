/**
 * Directory Manager Module
 */

const Logger = require('../../utils/logger');
const ResponseFormatter = require('../../utils/response-formatter');
const SessionDirectoryManager = require('./session-directory-manager');

class DirectoryManager {
  constructor(options = {}) {
    this.logger = new Logger('DirectoryManager');
    this.responseFormatter = new ResponseFormatter();
    
    // Initialize session directory manager if enabled
    this.enableSessionTracking = options.enableSessionTracking !== false;
    if (this.enableSessionTracking) {
      this.sessionManager = new SessionDirectoryManager(options.sessionOptions || {});
      this.logger.info('Session directory tracking enabled');
    }
  }

  getTools() {
    const baseTools = [
      {
        name: 'directory_structure_manager',
        description: 'Create and manage complex directory structures',
        inputSchema: {
          type: 'object',
          properties: {
            base_path: { type: 'string' },
            structure_definition: { type: 'object' },
            template_files: { type: 'object' },
            permissions: { type: 'object' }
          },
          required: ['base_path', 'structure_definition']
        }
      }
    ];
    
    // Add session management tools if enabled
    if (this.enableSessionTracking && this.sessionManager) {
      baseTools.push(...this.sessionManager.getTools());
      
      // Add terminal integration tools
      baseTools.push({
        name: 'execute_session_command',
        description: 'Execute command in session context with automatic directory tracking',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session identifier' },
            command: { type: 'string', description: 'Command to execute' },
            createIfNotExists: { type: 'boolean', description: 'Create session if it does not exist' },
            options: { type: 'object', description: 'Execution options' }
          },
          required: ['sessionId', 'command']
        }
      });
      
      baseTools.push({
        name: 'sync_session_directory',
        description: 'Synchronize session directory with actual filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session identifier' }
          },
          required: ['sessionId']
        }
      });
    }
    
    return baseTools;
  }

  async directoryStructureManager(args) {
    const { base_path, structure_definition, template_files = {}, permissions = {} } = args;
    
    try {
      this.logger.info(`Creating directory structure at: ${base_path}`);
      
      const result = {
        operation: 'directory_structure_creation',
        success: true,
        base_path,
        directories_created: [],
        files_created: [],
        timestamp: new Date().toISOString()
      };
      
      // Create the base directory
      const fs = require('fs').promises;
      const path = require('path');
      await fs.mkdir(base_path, { recursive: true });
      result.directories_created.push(base_path);
      
      // Process structure definition
      await this.processStructureDefinition(base_path, structure_definition, template_files, result);
      
      return this.responseFormatter.formatResponse(result, {
        type: 'text',
        prettify: true
      });
    } catch (error) {
      this.logger.error('Directory structure creation failed:', error.message);
      throw new Error(`Directory structure creation failed: ${error.message}`);
    }
  }
  
  async processStructureDefinition(basePath, definition, templateFiles, result) {
    const fs = require('fs').promises;
    const path = require('path');
    
    for (const [name, config] of Object.entries(definition)) {
      const fullPath = path.join(basePath, name);
      
      if (typeof config === 'object' && config.type === 'directory') {
        // Create directory
        await fs.mkdir(fullPath, { recursive: true });
        result.directories_created.push(fullPath);
        
        // Process subdirectories
        if (config.children) {
          await this.processStructureDefinition(fullPath, config.children, templateFiles, result);
        }
      } else if (typeof config === 'object' && config.type === 'file') {
        // Create file
        const content = templateFiles[config.template] || config.content || '';
        await fs.writeFile(fullPath, content, 'utf8');
        result.files_created.push(fullPath);
      } else if (typeof config === 'string') {
        // Simple directory
        await fs.mkdir(fullPath, { recursive: true });
        result.directories_created.push(fullPath);
      }
    }
  }
  
  // Session management methods
  async createSessionDirectory(args) {
    if (!this.enableSessionTracking) {
      throw new Error('Session tracking is not enabled');
    }
    return await this.sessionManager.createSessionDirectory(args);
  }
  
  async getSessionDirectory(args) {
    if (!this.enableSessionTracking) {
      throw new Error('Session tracking is not enabled');
    }
    return await this.sessionManager.getSessionDirectory(args);
  }
  
  async updateSessionDirectory(args) {
    if (!this.enableSessionTracking) {
      throw new Error('Session tracking is not enabled');
    }
    return await this.sessionManager.updateSessionDirectory(args);
  }
  
  async deleteSessionDirectory(args) {
    if (!this.enableSessionTracking) {
      throw new Error('Session tracking is not enabled');
    }
    return await this.sessionManager.deleteSessionDirectory(args);
  }
  
  async listSessionDirectories(args) {
    if (!this.enableSessionTracking) {
      throw new Error('Session tracking is not enabled');
    }
    return await this.sessionManager.listSessionDirectories(args);
  }
  
  async changeDirectory(args) {
    if (!this.enableSessionTracking) {
      throw new Error('Session tracking is not enabled');
    }
    return await this.sessionManager.changeDirectory(args);
  }
  
  async executeSessionCommand(args) {
    if (!this.enableSessionTracking) {
      throw new Error('Session tracking is not enabled');
    }
    
    const { sessionId, command, createIfNotExists = true, options = {} } = args;
    
    // Create terminal integration if not exists
    if (!this.terminalIntegration) {
      const TerminalSessionIntegration = require('../terminal-backend/terminal-session-integration');
      const TerminalExecutor = require('../terminal-backend/terminal-executor');
      
      const terminalExecutor = new TerminalExecutor();
      this.terminalIntegration = new TerminalSessionIntegration(
        this.sessionManager,
        terminalExecutor
      );
    }
    
    return await this.terminalIntegration.executeSessionCommand(sessionId, command, {
      createIfNotExists,
      ...options
    });
  }
  
  async syncSessionDirectory(args) {
    if (!this.enableSessionTracking) {
      throw new Error('Session tracking is not enabled');
    }
    
    const { sessionId } = args;
    
    // Create terminal integration if not exists
    if (!this.terminalIntegration) {
      const TerminalSessionIntegration = require('../terminal-backend/terminal-session-integration');
      const TerminalExecutor = require('../terminal-backend/terminal-executor');
      
      const terminalExecutor = new TerminalExecutor();
      this.terminalIntegration = new TerminalSessionIntegration(
        this.sessionManager,
        terminalExecutor
      );
    }
    
    return await this.terminalIntegration.synchronizeSessionDirectory(sessionId);
  }
  
  /**
   * Initialize Redis for session persistence
   */
  async initializeRedis(redisClient) {
    if (this.enableSessionTracking && this.sessionManager) {
      await this.sessionManager.initializeRedis(redisClient);
    }
  }
  
  /**
   * Get session manager instance
   */
  getSessionManager() {
    return this.sessionManager;
  }
  
  /**
   * Check if session tracking is enabled
   */
  isSessionTrackingEnabled() {
    return this.enableSessionTracking;
  }
  
  /**
   * Clean shutdown
   */
  async shutdown() {
    if (this.sessionManager) {
      await this.sessionManager.shutdown();
    }
    
    if (this.terminalIntegration) {
      this.terminalIntegration.cleanup();
    }
    
    this.logger.info('DirectoryManager shutdown complete');
  }
}

module.exports = DirectoryManager;
