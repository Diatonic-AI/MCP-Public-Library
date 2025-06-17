/**
 * Terminal Session Integration Module
 * 
 * Provides hooks and integration between terminal commands and session directory manager.
 * Automatically tracks and updates session working directories when cd commands are executed.
 * 
 * Features:
 * - Automatic cd command detection and tracking
 * - Terminal output parsing for directory changes
 * - Session-aware command execution
 * - Path synchronization between terminal and session manager
 */

const path = require('path');
const Logger = require('../../utils/logger');
const ResponseFormatter = require('../../utils/response-formatter');

class TerminalSessionIntegration {
  constructor(sessionDirectoryManager, terminalExecutor, options = {}) {
    this.logger = new Logger('TerminalSessionIntegration');
    this.responseFormatter = new ResponseFormatter();
    
    this.sessionManager = sessionDirectoryManager;
    this.terminalExecutor = terminalExecutor;
    
    this.config = {
      enableAutoCdTracking: options.enableAutoCdTracking !== false,
      cdCommandPatterns: options.cdCommandPatterns || [
        /^cd\s+(.+)$/i,
        /^chdir\s+(.+)$/i,
        /^Set-Location\s+(.+)$/i,  // PowerShell
        /^sl\s+(.+)$/i            // PowerShell alias
      ],
      pwdCommandPatterns: options.pwdCommandPatterns || [
        /^pwd$/i,
        /^Get-Location$/i,        // PowerShell
        /^gl$/i                   // PowerShell alias
      ],
      ...options
    };
    
    this.logger.info('TerminalSessionIntegration initialized', {
      enableAutoCdTracking: this.config.enableAutoCdTracking
    });
    
    // Register hooks with session manager if auto tracking is enabled
    if (this.config.enableAutoCdTracking) {
      this.setupAutoTracking();
    }
  }
  
  /**
   * Set up automatic directory change tracking
   */
  setupAutoTracking() {
    // Register hook with session manager for directory changes
    this.sessionManager.registerCdHook(this.onDirectoryChange.bind(this));
    this.logger.info('Auto cd tracking enabled');
  }
  
  /**
   * Hook called when directory changes in session manager
   */
  async onDirectoryChange(sessionId, oldCwd, newCwd) {
    this.logger.debug(`Directory changed for session ${sessionId}`, {
      from: oldCwd,
      to: newCwd
    });
    
    // Additional logic can be added here, such as:
    // - Notifying other components
    // - Updating environment variables
    // - Logging directory changes
  }
  
  /**
   * Execute command with session-aware working directory
   */
  async executeSessionCommand(sessionId, command, options = {}) {
    try {
      // Get current working directory for session
      let currentCwd;
      if (this.sessionManager.hasSession(sessionId)) {
        currentCwd = this.sessionManager.getCurrentDirectory(sessionId);
      } else {
        // Create session if it doesn't exist
        await this.sessionManager.createSessionDirectory({ sessionId });
        currentCwd = this.sessionManager.getCurrentDirectory(sessionId);
      }
      
      this.logger.debug(`Executing command in session ${sessionId}`, {
        command,
        cwd: currentCwd
      });
      
      // Check if this is a cd command
      const cdMatch = this.detectCdCommand(command);
      if (cdMatch) {
        return await this.handleCdCommand(sessionId, cdMatch.targetPath, options);
      }
      
      // Check if this is a pwd command
      if (this.isPwdCommand(command)) {
        return await this.handlePwdCommand(sessionId);
      }
      
      // Execute regular command with session's working directory
      const executionOptions = {
        cwd: currentCwd,
        ...options
      };
      
      const result = await this.terminalExecutor.execute(command, executionOptions);
      
      // Parse output for potential directory changes (some commands change pwd implicitly)
      await this.parseOutputForDirectoryChanges(sessionId, command, result);
      
      return {
        ...result,
        sessionId,
        sessionCwd: this.sessionManager.getCurrentDirectory(sessionId)
      };
      
    } catch (error) {
      this.logger.error(`Command execution failed for session ${sessionId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Handle cd command execution
   */
  async handleCdCommand(sessionId, targetPath, options = {}) {
    try {
      this.logger.info(`Handling cd command for session ${sessionId}`, { targetPath });
      
      // Use session manager's changeDirectory method
      const result = await this.sessionManager.changeDirectory({
        sessionId,
        targetPath,
        createIfNotExists: options.createIfNotExists || false
      });
      
      // Get the new working directory
      const newCwd = this.sessionManager.getCurrentDirectory(sessionId);
      
      // Format response similar to terminal output
      return this.responseFormatter.formatResponse({
        success: true,
        command: `cd ${targetPath}`,
        sessionId,
        oldCwd: result.oldCwd || newCwd,
        newCwd: newCwd,
        output: options.platform === 'windows' ? '' : newCwd, // Unix cd typically has no output
        exitCode: 0
      });
      
    } catch (error) {
      this.logger.error(`cd command failed for session ${sessionId}:`, error.message);
      return this.responseFormatter.formatResponse({
        success: false,
        command: `cd ${targetPath}`,
        sessionId,
        error: error.message,
        exitCode: 1
      });
    }
  }
  
  /**
   * Handle pwd command execution
   */
  async handlePwdCommand(sessionId) {
    try {
      const currentCwd = this.sessionManager.getCurrentDirectory(sessionId);
      
      return this.responseFormatter.formatResponse({
        success: true,
        command: 'pwd',
        sessionId,
        output: currentCwd,
        exitCode: 0
      });
      
    } catch (error) {
      this.logger.error(`pwd command failed for session ${sessionId}:`, error.message);
      return this.responseFormatter.formatResponse({
        success: false,
        command: 'pwd',
        sessionId,
        error: error.message,
        exitCode: 1
      });
    }
  }
  
  /**
   * Detect if command is a cd command and extract target path
   */
  detectCdCommand(command) {
    for (const pattern of this.config.cdCommandPatterns) {
      const match = command.trim().match(pattern);
      if (match) {
        return {
          isMatch: true,
          targetPath: match[1].trim().replace(/["']/g, '') // Remove quotes
        };
      }
    }
    return null;
  }
  
  /**
   * Detect if command is a pwd command
   */
  isPwdCommand(command) {
    return this.config.pwdCommandPatterns.some(pattern => pattern.test(command.trim()));
  }
  
  /**
   * Parse command output for implicit directory changes
   */
  async parseOutputForDirectoryChanges(sessionId, command, result) {
    try {
      // This method can be extended to detect directory changes from:
      // - Commands that change directory implicitly
      // - Output that contains new working directory information
      // - Error messages that indicate directory changes
      
      // Example: Some build tools or scripts might change directory
      // You can add logic here to detect and update session directory
      
    } catch (error) {
      this.logger.error('Error parsing output for directory changes:', error.message);
    }
  }
  
  /**
   * Synchronize session directory with actual filesystem
   */
  async synchronizeSessionDirectory(sessionId) {
    try {
      // Execute pwd command to get actual current directory
      const actualCwd = await this.getActualWorkingDirectory();
      const sessionCwd = this.sessionManager.getCurrentDirectory(sessionId);
      
      if (actualCwd !== sessionCwd) {
        this.logger.info(`Synchronizing session ${sessionId} directory`, {
          sessionCwd,
          actualCwd
        });
        
        await this.sessionManager.updateSessionDirectory({
          sessionId,
          newCwd: actualCwd,
          validate: false
        });
      }
      
      return {
        synchronized: actualCwd !== sessionCwd,
        sessionCwd,
        actualCwd
      };
      
    } catch (error) {
      this.logger.error(`Failed to synchronize session directory: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get actual working directory from system
   */
  async getActualWorkingDirectory() {
    try {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'cd' : 'pwd';
      
      const result = await this.terminalExecutor.execute(command, {
        timeout: 5000
      });
      
      if (result.success) {
        return result.output.trim();
      } else {
        throw new Error(`Failed to get working directory: ${result.error}`);
      }
      
    } catch (error) {
      this.logger.error('Failed to get actual working directory:', error.message);
      return process.cwd(); // Fallback to process cwd
    }
  }
  
  /**
   * Batch execute commands in session context
   */
  async executeSessionCommandBatch(sessionId, commands, options = {}) {
    const results = [];
    let sessionFailed = false;
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      try {
        const result = await this.executeSessionCommand(sessionId, command, {
          ...options,
          continueOnError: options.continueOnError || false
        });
        
        results.push({
          index: i,
          command,
          result
        });
        
        // Stop execution if command failed and continueOnError is false
        if (!result.success && !options.continueOnError) {
          sessionFailed = true;
          break;
        }
        
      } catch (error) {
        results.push({
          index: i,
          command,
          error: error.message
        });
        
        if (!options.continueOnError) {
          sessionFailed = true;
          break;
        }
      }
    }
    
    return this.responseFormatter.formatResponse({
      success: !sessionFailed,
      sessionId,
      totalCommands: commands.length,
      executedCommands: results.length,
      results,
      finalCwd: this.sessionManager.getCurrentDirectory(sessionId)
    });
  }
  
  /**
   * Get session execution context
   */
  getSessionContext(sessionId) {
    return {
      sessionId,
      currentDirectory: this.sessionManager.getCurrentDirectory(sessionId),
      sessionExists: this.sessionManager.hasSession(sessionId),
      sessionInfo: this.sessionManager.getSessionInfo(sessionId)
    };
  }
  
  /**
   * Clean up integration resources
   */
  cleanup() {
    if (this.config.enableAutoCdTracking) {
      // Unregister hooks if needed
      this.logger.info('Cleaning up terminal session integration');
    }
  }
}

module.exports = TerminalSessionIntegration;

