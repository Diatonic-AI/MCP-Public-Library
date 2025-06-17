const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const WindowsExecutor = require('./windows-executor');
const WSLExecutor = require('./wsl-executor');
const ErrorHandler = require('./error-handler');

/**
 * High-level terminal command executor dispatcher
 * Automatically detects platform and routes to appropriate executor
 */
class TerminalExecutor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            timeout: options.timeout || 30000,
            allowDestructive: options.allowDestructive || false,
            maxBufferSize: options.maxBufferSize || 1024 * 1024, // 1MB
            workingDirectory: options.workingDirectory || process.cwd(),
            ...options
        };
        
        this.errorHandler = new ErrorHandler(this.options);
        this.platform = this._detectPlatform();
        this.executor = this._createExecutor();
    }

    /**
     * Execute a command with streaming output
     * @param {string} command - Command to execute
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} - Execution result with streaming capability
     */
    async executeStreaming(command, options = {}) {
        const mergedOptions = { ...this.options, ...options };
        
        try {
            // Security check
            await this.errorHandler.validateCommand(command, mergedOptions);
            
            this.emit('commandStart', { command, options: mergedOptions });
            
            const result = await this.executor.executeStreaming(command, mergedOptions);
            
            this.emit('commandComplete', { command, result });
            return result;
            
        } catch (error) {
            const normalizedError = this.errorHandler.normalizeError(error, command);
            this.emit('commandError', { command, error: normalizedError });
            throw normalizedError;
        }
    }

    /**
     * Execute a command and capture full output
     * @param {string} command - Command to execute
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} - Execution result with complete output
     */
    async executeCapture(command, options = {}) {
        const mergedOptions = { ...this.options, ...options };
        
        try {
            // Security check
            await this.errorHandler.validateCommand(command, mergedOptions);
            
            this.emit('commandStart', { command, options: mergedOptions });
            
            const result = await this.executor.executeCapture(command, mergedOptions);
            
            this.emit('commandComplete', { command, result });
            return result;
            
        } catch (error) {
            const normalizedError = this.errorHandler.normalizeError(error, command);
            this.emit('commandError', { command, error: normalizedError });
            throw normalizedError;
        }
    }

    /**
     * Execute multiple commands in sequence
     * @param {Array<string>} commands - Array of commands to execute
     * @param {Object} options - Execution options
     * @returns {Promise<Array>} - Array of execution results
     */
    async executeBatch(commands, options = {}) {
        const results = [];
        const mergedOptions = { ...this.options, ...options };
        
        for (const command of commands) {
            try {
                const result = await this.executeCapture(command, mergedOptions);
                results.push({ command, success: true, result });
            } catch (error) {
                results.push({ command, success: false, error });
                if (mergedOptions.stopOnError !== false) {
                    break;
                }
            }
        }
        
        return results;
    }

    /**
     * Check if a command is available on the system
     * @param {string} command - Command to check
     * @returns {Promise<boolean>} - True if command is available
     */
    async isCommandAvailable(command) {
        try {
            const checkCommand = this.platform.startsWith('win') 
                ? `where ${command}` 
                : `which ${command}`;
            
            const result = await this.executeCapture(checkCommand, { 
                timeout: 5000,
                allowDestructive: true // This is safe
            });
            
            return result.exitCode === 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get system information
     * @returns {Object} - System information
     */
    getSystemInfo() {
        return {
            platform: this.platform,
            arch: os.arch(),
            nodeVersion: process.version,
            executor: this.executor.constructor.name,
            capabilities: this.executor.getCapabilities()
        };
    }

    /**
     * Set working directory for commands
     * @param {string} directory - Directory path
     */
    setWorkingDirectory(directory) {
        this.options.workingDirectory = path.resolve(directory);
        if (this.executor.setWorkingDirectory) {
            this.executor.setWorkingDirectory(directory);
        }
    }

    /**
     * Detect the current platform
     * @private
     * @returns {string} - Platform identifier
     */
    _detectPlatform() {
        const platform = os.platform();
        const release = os.release();
        
        if (platform === 'win32') {
            // Check if running in WSL
            if (process.env.WSL_DISTRO_NAME || release.includes('Microsoft')) {
                return 'wsl';
            }
            return 'windows';
        }
        
        return platform; // linux, darwin, etc.
    }

    /**
     * Create appropriate executor based on platform
     * @private
     * @returns {Object} - Platform-specific executor
     */
    _createExecutor() {
        switch (this.platform) {
            case 'windows':
                return new WindowsExecutor(this.options);
            case 'wsl':
                return new WSLExecutor(this.options);
            case 'linux':
            case 'darwin':
            default:
                // For Unix-like systems, we can use a basic executor
                // or create specific executors if needed
                return new WSLExecutor(this.options); // WSL executor works for Unix too
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.executor && this.executor.destroy) {
            this.executor.destroy();
        }
        this.removeAllListeners();
    }
}

module.exports = TerminalExecutor;

