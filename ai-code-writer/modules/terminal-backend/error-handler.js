/**
 * Error handler for terminal backend
 * Provides error normalization, timeout handling, and security checks
 */
class ErrorHandler {
    constructor(options = {}) {
        this.options = {
            allowDestructive: options.allowDestructive || false,
            customBlacklist: options.customBlacklist || [],
            customWhitelist: options.customWhitelist || [],
            strictMode: options.strictMode !== false, // Default to true
            ...options
        };
        
        // Default blacklisted commands (destructive operations)
        this.defaultBlacklist = [
            // File system destructive commands
            'rm -rf',
            'rm -r',
            'rmdir /s',
            'del /f',
            'del /q',
            'format',
            'fdisk',
            'mkfs',
            'dd if=',
            
            // System modification commands
            'sudo rm',
            'sudo rmdir',
            'sudo del',
            'sudo format',
            'chown -R',
            'chmod -R 777',
            'chmod 777',
            
            // Network/security sensitive
            'wget http',
            'curl http',
            'nc -l',
            'netcat -l',
            'ssh-keygen',
            'openssl',
            
            // Process management
            'killall',
            'pkill -9',
            'taskkill /f',
            
            // Registry/system config (Windows)
            'reg delete',
            'reg add',
            'regedit',
            'bcdedit',
            
            // Package managers (potentially destructive)
            'npm uninstall -g',
            'pip uninstall',
            'apt-get remove',
            'apt remove',
            'yum remove',
            'dnf remove',
            
            // Disk operations
            'fsck',
            'chkdsk',
            'defrag',
            
            // Database operations
            'drop database',
            'drop table',
            'truncate table',
            'delete from'
        ];
        
        // Commands that should be allowed even in strict mode
        this.defaultWhitelist = [
            'ls',
            'dir',
            'pwd',
            'cd',
            'cat',
            'type',
            'echo',
            'whoami',
            'id',
            'ps',
            'top',
            'htop',
            'df',
            'free',
            'uptime',
            'date',
            'which',
            'where',
            'find',
            'grep',
            'awk',
            'sed',
            'sort',
            'uniq',
            'head',
            'tail',
            'wc',
            'git status',
            'git log',
            'git diff',
            'git branch',
            'npm list',
            'pip list',
            'node --version',
            'npm --version',
            'python --version'
        ];
    }

    /**
     * Validate a command before execution
     * @param {string} command - Command to validate
     * @param {Object} options - Validation options
     * @returns {Promise<boolean>} - True if command is safe
     * @throws {Error} - If command is not allowed
     */
    async validateCommand(command, options = {}) {
        const mergedOptions = { ...this.options, ...options };
        const normalizedCommand = command.toLowerCase().trim();
        
        // Skip validation if destructive commands are explicitly allowed
        if (mergedOptions.allowDestructive) {
            return true;
        }
        
        // Check custom whitelist first
        if (this._isInWhitelist(normalizedCommand, mergedOptions.customWhitelist)) {
            return true;
        }
        
        // Check default whitelist
        if (this._isInWhitelist(normalizedCommand, this.defaultWhitelist)) {
            return true;
        }
        
        // Check custom blacklist
        if (this._isInBlacklist(normalizedCommand, mergedOptions.customBlacklist)) {
            throw new Error(`Command blocked by custom security policy: ${command}`);
        }
        
        // Check default blacklist
        if (this._isInBlacklist(normalizedCommand, this.defaultBlacklist)) {
            throw new Error(`Potentially destructive command blocked: ${command}. Use allowDestructive option to override.`);
        }
        
        // In strict mode, only whitelisted commands are allowed
        if (mergedOptions.strictMode) {
            throw new Error(`Command not in whitelist (strict mode): ${command}. Add to customWhitelist or disable strictMode.`);
        }
        
        // Additional security checks
        await this._performAdditionalSecurityChecks(normalizedCommand, mergedOptions);
        
        return true;
    }

    /**
     * Normalize different types of errors into a consistent format
     * @param {Error|Object} error - Original error
     * @param {string} command - Command that caused the error
     * @returns {Error} - Normalized error
     */
    normalizeError(error, command) {
        const normalizedError = new Error();
        
        // Preserve original error properties
        if (error instanceof Error) {
            normalizedError.message = error.message;
            normalizedError.stack = error.stack;
            normalizedError.name = error.name;
        } else {
            normalizedError.message = String(error);
            normalizedError.name = 'TerminalError';
        }
        
        // Add context information
        normalizedError.command = command;
        normalizedError.timestamp = new Date().toISOString();
        normalizedError.originalError = error;
        
        // Categorize error types
        normalizedError.category = this._categorizeError(error, command);
        
        // Add helpful suggestions
        normalizedError.suggestions = this._generateErrorSuggestions(error, command);
        
        return normalizedError;
    }

    /**
     * Check if command is in whitelist
     * @private
     * @param {string} command - Normalized command
     * @param {Array} whitelist - Whitelist array
     * @returns {boolean} - True if whitelisted
     */
    _isInWhitelist(command, whitelist = []) {
        return [...this.defaultWhitelist, ...whitelist].some(whitelistItem => {
            const normalizedItem = whitelistItem.toLowerCase();
            return command.startsWith(normalizedItem) || command === normalizedItem;
        });
    }

    /**
     * Check if command is in blacklist
     * @private
     * @param {string} command - Normalized command
     * @param {Array} blacklist - Blacklist array
     * @returns {boolean} - True if blacklisted
     */
    _isInBlacklist(command, blacklist = []) {
        return [...this.defaultBlacklist, ...blacklist].some(blacklistItem => {
            const normalizedItem = blacklistItem.toLowerCase();
            return command.includes(normalizedItem);
        });
    }

    /**
     * Perform additional security checks
     * @private
     * @param {string} command - Normalized command
     * @param {Object} options - Options
     */
    async _performAdditionalSecurityChecks(command, options) {
        // Check for suspicious patterns
        const suspiciousPatterns = [
            /[;&|`$\(\)]/,  // Command chaining/injection
            /\.\.\/\.\./,     // Directory traversal
            /\${.*}/,       // Variable expansion
            /eval|exec/,    // Code execution
            /base64|decode/, // Encoding obfuscation
            /\bsu\b|\bsudo\b/, // Privilege escalation
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(command)) {
                throw new Error(`Suspicious command pattern detected: ${command}`);
            }
        }
        
        // Check command length (prevent buffer overflow attempts)
        if (command.length > 1000) {
            throw new Error(`Command too long (${command.length} characters). Maximum allowed: 1000`);
        }
        
        // Check for multiple commands
        if (command.includes(';') || command.includes('&&') || command.includes('||')) {
            throw new Error(`Multiple commands detected: ${command}. Execute commands separately for security.`);
        }
    }

    /**
     * Categorize error types for better handling
     * @private
     * @param {Error|Object} error - Original error
     * @param {string} command - Command that caused error
     * @returns {string} - Error category
     */
    _categorizeError(error, command) {
        const message = String(error.message || error).toLowerCase();
        
        if (message.includes('timeout') || message.includes('timed out')) {
            return 'timeout';
        }
        
        if (message.includes('permission denied') || message.includes('access denied')) {
            return 'permission';
        }
        
        if (message.includes('command not found') || message.includes('not recognized')) {
            return 'command_not_found';
        }
        
        if (message.includes('no such file') || message.includes('file not found')) {
            return 'file_not_found';
        }
        
        if (message.includes('connection') || message.includes('network')) {
            return 'network';
        }
        
        if (message.includes('syntax error') || message.includes('invalid')) {
            return 'syntax';
        }
        
        if (error.code === 'ENOENT') {
            return 'executable_not_found';
        }
        
        if (error.code === 'EACCES') {
            return 'permission';
        }
        
        return 'unknown';
    }

    /**
     * Generate helpful error suggestions
     * @private
     * @param {Error|Object} error - Original error
     * @param {string} command - Command that caused error
     * @returns {Array<string>} - Array of suggestions
     */
    _generateErrorSuggestions(error, command) {
        const suggestions = [];
        const category = this._categorizeError(error, command);
        
        switch (category) {
            case 'timeout':
                suggestions.push('Try increasing the timeout value');
                suggestions.push('Check if the command is hanging or requires user input');
                break;
                
            case 'permission':
                suggestions.push('Check file/directory permissions');
                suggestions.push('Try running with appropriate privileges');
                break;
                
            case 'command_not_found':
                suggestions.push('Verify the command is installed and in PATH');
                suggestions.push('Check for typos in the command name');
                break;
                
            case 'file_not_found':
                suggestions.push('Verify the file path exists');
                suggestions.push('Check current working directory');
                suggestions.push('Use absolute paths if needed');
                break;
                
            case 'network':
                suggestions.push('Check network connectivity');
                suggestions.push('Verify firewall settings');
                suggestions.push('Check if the service is running');
                break;
                
            case 'syntax':
                suggestions.push('Check command syntax and parameters');
                suggestions.push('Refer to command documentation');
                break;
                
            case 'executable_not_found':
                suggestions.push('Install the required executable');
                suggestions.push('Add executable to system PATH');
                break;
        }
        
        return suggestions;
    }

    /**
     * Add custom blacklist patterns
     * @param {Array<string>} patterns - Patterns to add
     */
    addBlacklistPatterns(patterns) {
        this.options.customBlacklist.push(...patterns);
    }

    /**
     * Add custom whitelist patterns
     * @param {Array<string>} patterns - Patterns to add
     */
    addWhitelistPatterns(patterns) {
        this.options.customWhitelist.push(...patterns);
    }

    /**
     * Clear custom patterns
     */
    clearCustomPatterns() {
        this.options.customBlacklist = [];
        this.options.customWhitelist = [];
    }

    /**
     * Get current configuration
     * @returns {Object} - Current configuration
     */
    getConfiguration() {
        return {
            allowDestructive: this.options.allowDestructive,
            strictMode: this.options.strictMode,
            customBlacklistCount: this.options.customBlacklist.length,
            customWhitelistCount: this.options.customWhitelist.length,
            defaultBlacklistCount: this.defaultBlacklist.length,
            defaultWhitelistCount: this.defaultWhitelist.length
        };
    }
}

module.exports = ErrorHandler;

