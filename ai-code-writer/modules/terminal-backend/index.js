/**
 * Terminal Backend Module
 * 
 * Provides cross-platform terminal command execution with streaming support,
 * security validation, and error handling.
 * 
 * Features:
 * - Platform detection (Windows PowerShell, WSL, Unix)
 * - Streaming and full-capture execution modes
 * - Promise-based API
 * - Security checks with blacklist/whitelist
 * - Comprehensive error handling
 * - Timeout management
 * - Process lifecycle management
 */

const TerminalExecutor = require('./terminal-executor');
const WindowsExecutor = require('./windows-executor');
const WSLExecutor = require('./wsl-executor');
const ErrorHandler = require('./error-handler');

module.exports = {
    TerminalExecutor,
    WindowsExecutor,
    WSLExecutor,
    ErrorHandler,
    
    /**
     * Create a new terminal executor with automatic platform detection
     * @param {Object} options - Configuration options
     * @returns {TerminalExecutor} - Configured terminal executor
     */
    create(options = {}) {
        return new TerminalExecutor(options);
    },
    
    /**
     * Create a Windows PowerShell executor
     * @param {Object} options - Configuration options
     * @returns {WindowsExecutor} - Windows executor instance
     */
    createWindowsExecutor(options = {}) {
        return new WindowsExecutor(options);
    },
    
    /**
     * Create a WSL/Unix executor
     * @param {Object} options - Configuration options
     * @returns {WSLExecutor} - WSL/Unix executor instance
     */
    createWSLExecutor(options = {}) {
        return new WSLExecutor(options);
    },
    
    /**
     * Create an error handler
     * @param {Object} options - Configuration options
     * @returns {ErrorHandler} - Error handler instance
     */
    createErrorHandler(options = {}) {
        return new ErrorHandler(options);
    }
};

