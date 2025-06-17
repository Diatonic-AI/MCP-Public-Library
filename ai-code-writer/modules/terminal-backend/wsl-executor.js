const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');
const os = require('os');

/**
 * WSL and Unix command executor
 * Supports both WSL (wsl.exe) and native Unix environments (bash/sh)
 */
class WSLExecutor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            timeout: options.timeout || 30000,
            maxBufferSize: options.maxBufferSize || 1024 * 1024,
            workingDirectory: options.workingDirectory || process.cwd(),
            encoding: options.encoding || 'utf8',
            shell: options.shell || this._detectShell(),
            ...options
        };
        
        this.activeProcesses = new Set();
        this.isWSL = this._isWSLEnvironment();
    }

    /**
     * Execute command with streaming output
     * @param {string} command - Command to execute
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} - Stream-enabled execution result
     */
    async executeStreaming(command, options = {}) {
        const mergedOptions = { ...this.options, ...options };
        const streamEmitter = new EventEmitter();
        
        return new Promise((resolve, reject) => {
            const { executable, args } = this._prepareCommand(command, mergedOptions);
            
            const child = spawn(executable, args, {
                cwd: mergedOptions.workingDirectory,
                env: { ...process.env, ...mergedOptions.env },
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });
            
            this.activeProcesses.add(child);
            
            let stdout = '';
            let stderr = '';
            let isResolved = false;
            
            // Set up timeout
            const timeoutId = setTimeout(() => {
                if (!isResolved) {
                    child.kill('SIGTERM');
                    setTimeout(() => {
                        if (!child.killed) {
                            child.kill('SIGKILL');
                        }
                    }, 5000);
                    
                    reject(new Error(`Command timed out after ${mergedOptions.timeout}ms: ${command}`));
                    isResolved = true;
                }
            }, mergedOptions.timeout);
            
            // Handle stdout streaming
            child.stdout.on('data', (data) => {
                const chunk = data.toString(mergedOptions.encoding);
                stdout += chunk;
                streamEmitter.emit('stdout', chunk);
                
                // Check buffer size limit
                if (stdout.length > mergedOptions.maxBufferSize) {
                    child.kill('SIGTERM');
                    reject(new Error(`Output exceeded maximum buffer size: ${mergedOptions.maxBufferSize} bytes`));
                    isResolved = true;
                }
            });
            
            // Handle stderr streaming
            child.stderr.on('data', (data) => {
                const chunk = data.toString(mergedOptions.encoding);
                stderr += chunk;
                streamEmitter.emit('stderr', chunk);
            });
            
            // Handle process completion
            child.on('close', (exitCode, signal) => {
                clearTimeout(timeoutId);
                this.activeProcesses.delete(child);
                
                if (!isResolved) {
                    const result = {
                        command,
                        exitCode,
                        signal,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        duration: Date.now() - startTime,
                        stream: streamEmitter,
                        pid: child.pid,
                        shell: executable
                    };
                    
                    // Emit final stream events
                    streamEmitter.emit('close', { exitCode, signal });
                    
                    if (exitCode === 0) {
                        resolve(result);
                    } else {
                        const error = new Error(`Command failed with exit code ${exitCode}: ${command}`);
                        error.result = result;
                        reject(error);
                    }
                    isResolved = true;
                }
            });
            
            // Handle process errors
            child.on('error', (error) => {
                clearTimeout(timeoutId);
                this.activeProcesses.delete(child);
                
                if (!isResolved) {
                    error.command = command;
                    reject(error);
                    isResolved = true;
                }
            });
            
            const startTime = Date.now();
            streamEmitter.emit('start', { command, pid: child.pid, shell: executable });
        });
    }

    /**
     * Execute command and capture full output
     * @param {string} command - Command to execute
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} - Complete execution result
     */
    async executeCapture(command, options = {}) {
        const mergedOptions = { ...this.options, ...options };
        
        return new Promise((resolve, reject) => {
            const { executable, args } = this._prepareCommand(command, mergedOptions);
            
            const child = spawn(executable, args, {
                cwd: mergedOptions.workingDirectory,
                env: { ...process.env, ...mergedOptions.env },
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });
            
            this.activeProcesses.add(child);
            
            let stdout = '';
            let stderr = '';
            let isResolved = false;
            
            // Set up timeout
            const timeoutId = setTimeout(() => {
                if (!isResolved) {
                    child.kill('SIGTERM');
                    setTimeout(() => {
                        if (!child.killed) {
                            child.kill('SIGKILL');
                        }
                    }, 5000);
                    
                    reject(new Error(`Command timed out after ${mergedOptions.timeout}ms: ${command}`));
                    isResolved = true;
                }
            }, mergedOptions.timeout);
            
            // Collect stdout
            child.stdout.on('data', (data) => {
                stdout += data.toString(mergedOptions.encoding);
                
                // Check buffer size limit
                if (stdout.length > mergedOptions.maxBufferSize) {
                    child.kill('SIGTERM');
                    reject(new Error(`Output exceeded maximum buffer size: ${mergedOptions.maxBufferSize} bytes`));
                    isResolved = true;
                }
            });
            
            // Collect stderr
            child.stderr.on('data', (data) => {
                stderr += data.toString(mergedOptions.encoding);
            });
            
            // Handle process completion
            child.on('close', (exitCode, signal) => {
                clearTimeout(timeoutId);
                this.activeProcesses.delete(child);
                
                if (!isResolved) {
                    const result = {
                        command,
                        exitCode,
                        signal,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        duration: Date.now() - startTime,
                        pid: child.pid,
                        shell: executable
                    };
                    
                    if (exitCode === 0 || mergedOptions.ignoreExitCode) {
                        resolve(result);
                    } else {
                        const error = new Error(`Command failed with exit code ${exitCode}: ${command}`);
                        error.result = result;
                        reject(error);
                    }
                    isResolved = true;
                }
            });
            
            // Handle process errors
            child.on('error', (error) => {
                clearTimeout(timeoutId);
                this.activeProcesses.delete(child);
                
                if (!isResolved) {
                    error.command = command;
                    reject(error);
                    isResolved = true;
                }
            });
            
            const startTime = Date.now();
        });
    }

    /**
     * Get executor capabilities
     * @returns {Object} - Capability information
     */
    getCapabilities() {
        return {
            streaming: true,
            capture: true,
            timeout: true,
            workingDirectory: true,
            environment: true,
            encoding: true,
            shell: this.options.shell,
            platform: this.isWSL ? 'wsl' : os.platform(),
            isWSL: this.isWSL
        };
    }

    /**
     * Set working directory
     * @param {string} directory - Directory path
     */
    setWorkingDirectory(directory) {
        this.options.workingDirectory = path.resolve(directory);
    }

    /**
     * Kill all active processes
     */
    killAllProcesses() {
        for (const child of this.activeProcesses) {
            try {
                child.kill('SIGTERM');
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGKILL');
                    }
                }, 5000);
            } catch (error) {
                // Process might already be dead
            }
        }
        this.activeProcesses.clear();
    }

    /**
     * Get active process count
     * @returns {number} - Number of active processes
     */
    getActiveProcessCount() {
        return this.activeProcesses.size;
    }

    /**
     * Prepare command for execution based on environment
     * @private
     * @param {string} command - Original command
     * @param {Object} options - Execution options
     * @returns {Object} - Prepared executable and arguments
     */
    _prepareCommand(command, options) {
        if (this.isWSL && os.platform() === 'win32') {
            // Running in Windows, use wsl.exe
            return {
                executable: 'wsl.exe',
                args: ['--', 'bash', '-c', command]
            };
        } else {
            // Native Unix environment or already in WSL
            const shell = options.shell || this.options.shell;
            return {
                executable: shell,
                args: ['-c', command]
            };
        }
    }

    /**
     * Detect if we're in a WSL environment
     * @private
     * @returns {boolean} - True if in WSL
     */
    _isWSLEnvironment() {
        // Check for WSL environment variables
        if (process.env.WSL_DISTRO_NAME) {
            return true;
        }
        
        // Check if running on Windows but want to use WSL
        if (os.platform() === 'win32' && process.env.FORCE_WSL) {
            return true;
        }
        
        // Check if wsl.exe is available and we're on Windows
        return os.platform() === 'win32';
    }

    /**
     * Detect available shell
     * @private
     * @returns {string} - Shell executable path
     */
    _detectShell() {
        if (os.platform() === 'win32') {
            return 'bash'; // Will be used with wsl.exe
        }
        
        // For Unix-like systems, prefer bash, fallback to sh
        return process.env.SHELL || '/bin/bash';
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.killAllProcesses();
        this.removeAllListeners();
    }
}

module.exports = WSLExecutor;

