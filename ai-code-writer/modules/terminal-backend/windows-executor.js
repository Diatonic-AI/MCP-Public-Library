const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');

/**
 * Windows PowerShell command executor
 * Uses PowerShell with -NoLogo -NoProfile -Command for clean execution
 */
class WindowsExecutor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            timeout: options.timeout || 30000,
            maxBufferSize: options.maxBufferSize || 1024 * 1024,
            workingDirectory: options.workingDirectory || process.cwd(),
            encoding: options.encoding || 'utf8',
            ...options
        };
        
        this.activeProcesses = new Set();
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
            const powerShellArgs = [
                '-NoLogo',
                '-NoProfile', 
                '-Command',
                command
            ];
            
            const child = spawn('powershell.exe', powerShellArgs, {
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
                        pid: child.pid
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
            streamEmitter.emit('start', { command, pid: child.pid });
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
            const powerShellArgs = [
                '-NoLogo',
                '-NoProfile',
                '-Command',
                command
            ];
            
            const child = spawn('powershell.exe', powerShellArgs, {
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
                        pid: child.pid
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
            shell: 'PowerShell',
            platform: 'windows'
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
     * Cleanup resources
     */
    destroy() {
        this.killAllProcesses();
        this.removeAllListeners();
    }
}

module.exports = WindowsExecutor;

