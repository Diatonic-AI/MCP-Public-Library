# Terminal Backend Module

A comprehensive Node.js module for cross-platform terminal command execution with streaming support, security validation, and error handling.

## Features

- **Cross-Platform**: Automatic detection and support for Windows PowerShell, WSL, and Unix environments
- **Streaming & Capture Modes**: Real-time output streaming or full output capture
- **Promise-Based API**: Modern async/await support
- **Security First**: Built-in command blacklisting and whitelisting with configurable security policies
- **Error Handling**: Comprehensive error normalization with helpful suggestions
- **Timeout Management**: Configurable timeouts with graceful process termination
- **Process Lifecycle**: Active process tracking and cleanup

## Installation

```javascript
const terminalBackend = require('./modules/terminal-backend');
```

## Quick Start

```javascript
const { create } = require('./modules/terminal-backend');

// Create executor with automatic platform detection
const executor = create({
    timeout: 30000,
    allowDestructive: false,
    strictMode: true
});

// Execute with streaming output
const result = await executor.executeStreaming('ls -la');
result.stream.on('stdout', (data) => {
    console.log('Output:', data);
});

// Execute and capture full output
const result2 = await executor.executeCapture('pwd');
console.log('Working directory:', result2.stdout);
```

## API Reference

### TerminalExecutor

Main class for cross-platform command execution.

#### Constructor Options

```javascript
const executor = create({
    timeout: 30000,              // Command timeout in milliseconds
    allowDestructive: false,     // Allow potentially destructive commands
    maxBufferSize: 1024 * 1024, // Maximum output buffer size
    workingDirectory: '/path',   // Working directory for commands
    strictMode: true,            // Only allow whitelisted commands
    customBlacklist: [],         // Additional blocked commands
    customWhitelist: []          // Additional allowed commands
});
```

#### Methods

##### executeStreaming(command, options)

Execute a command with real-time output streaming.

```javascript
const result = await executor.executeStreaming('npm install');

// Listen to output streams
result.stream.on('stdout', (chunk) => console.log(chunk));
result.stream.on('stderr', (chunk) => console.error(chunk));
result.stream.on('close', ({ exitCode }) => console.log('Finished:', exitCode));
```

**Returns:**
```javascript
{
    command: 'npm install',
    exitCode: 0,
    signal: null,
    stdout: 'complete output',
    stderr: 'error output',
    duration: 1500,
    stream: EventEmitter,
    pid: 12345
}
```

##### executeCapture(command, options)

Execute a command and capture complete output.

```javascript
const result = await executor.executeCapture('git status');
console.log(result.stdout);
```

##### executeBatch(commands, options)

Execute multiple commands in sequence.

```javascript
const results = await executor.executeBatch([
    'git status',
    'npm test',
    'npm run build'
], { stopOnError: true });
```

##### isCommandAvailable(command)

Check if a command is available on the system.

```javascript
const hasGit = await executor.isCommandAvailable('git');
console.log('Git available:', hasGit);
```

##### getSystemInfo()

Get information about the execution environment.

```javascript
const info = executor.getSystemInfo();
console.log(info);
// {
//     platform: 'windows',
//     arch: 'x64',
//     nodeVersion: 'v18.0.0',
//     executor: 'WindowsExecutor',
//     capabilities: { streaming: true, ... }
// }
```

### Platform-Specific Executors

#### WindowsExecutor

Direct PowerShell execution for Windows environments.

```javascript
const { createWindowsExecutor } = require('./modules/terminal-backend');
const winExecutor = createWindowsExecutor();

// Uses: powershell.exe -NoLogo -NoProfile -Command "your-command"
const result = await winExecutor.executeCapture('Get-Process');
```

#### WSLExecutor

WSL and Unix command execution.

```javascript
const { createWSLExecutor } = require('./modules/terminal-backend');
const unixExecutor = createWSLExecutor();

// On Windows: wsl.exe -- bash -c "your-command"
// On Unix: bash -c "your-command"
const result = await unixExecutor.executeCapture('ls -la');
```

### Error Handling

#### ErrorHandler

Provides command validation and error normalization.

```javascript
const { createErrorHandler } = require('./modules/terminal-backend');
const errorHandler = createErrorHandler({
    allowDestructive: false,
    strictMode: true
});

// Validate command before execution
try {
    await errorHandler.validateCommand('rm -rf /');
} catch (error) {
    console.log('Command blocked:', error.message);
}

// Normalize errors with helpful suggestions
const normalizedError = errorHandler.normalizeError(originalError, 'git push');
console.log('Category:', normalizedError.category);
console.log('Suggestions:', normalizedError.suggestions);
```

## Security

### Default Blacklist

The following command patterns are blocked by default:

- File deletion: `rm -rf`, `del /f`, `rmdir /s`
- System modification: `format`, `fdisk`, `chmod 777`
- Network operations: `wget http`, `curl http`, `nc -l`
- Process management: `killall`, `taskkill /f`
- Registry operations: `reg delete`, `regedit`
- Package removal: `npm uninstall -g`, `apt remove`

### Default Whitelist

Safe commands allowed in strict mode:

- Navigation: `ls`, `dir`, `pwd`, `cd`
- File viewing: `cat`, `type`, `head`, `tail`
- System info: `whoami`, `ps`, `df`, `date`
- Version control: `git status`, `git log`, `git diff`
- Package info: `npm list`, `pip list`

### Custom Security Policies

```javascript
const executor = create({
    strictMode: false,           // Allow non-whitelisted commands
    allowDestructive: true,      // Override safety checks
    customBlacklist: ['curl'],   // Block additional commands
    customWhitelist: ['docker']  // Allow additional commands
});

// Runtime security management
executor.errorHandler.addBlacklistPatterns(['custom-dangerous-cmd']);
executor.errorHandler.addWhitelistPatterns(['safe-custom-cmd']);
```

## Event Handling

The TerminalExecutor extends EventEmitter and provides execution events:

```javascript
executor.on('commandStart', ({ command, options }) => {
    console.log('Starting:', command);
});

executor.on('commandComplete', ({ command, result }) => {
    console.log('Completed:', command, 'in', result.duration, 'ms');
});

executor.on('commandError', ({ command, error }) => {
    console.error('Failed:', command, error.message);
});
```

## Examples

### Development Workflow

```javascript
const executor = create({ timeout: 60000 });

// Check project status
const status = await executor.executeCapture('git status --porcelain');
if (status.stdout.trim()) {
    console.log('Uncommitted changes detected');
}

// Run tests with streaming output
const testResult = await executor.executeStreaming('npm test');
testResult.stream.on('stdout', (data) => {
    process.stdout.write(data);
});

// Build project
if (testResult.exitCode === 0) {
    await executor.executeCapture('npm run build');
}
```

### System Monitoring

```javascript
const executor = create();

// Get system information
const commands = [
    'df -h',              // Disk usage
    'free -m',            // Memory usage
    'ps aux | head -20'   // Top processes
];

const results = await executor.executeBatch(commands, {
    stopOnError: false
});

results.forEach(({ command, success, result }) => {
    if (success) {
        console.log(`\n${command}:`);
        console.log(result.stdout);
    }
});
```

### Cross-Platform File Operations

```javascript
const executor = create();
const isWindows = executor.platform === 'windows';

// Platform-specific commands
const listCmd = isWindows ? 'dir' : 'ls -la';
const copyCmd = isWindows ? 'copy src dest' : 'cp src dest';

const files = await executor.executeCapture(listCmd);
console.log('Files:', files.stdout);
```

## Error Categories

Normalized errors include helpful categorization:

- `timeout`: Command exceeded time limit
- `permission`: Access denied errors
- `command_not_found`: Command not available
- `file_not_found`: File/directory missing
- `network`: Connection/network errors
- `syntax`: Command syntax errors
- `executable_not_found`: Missing executable
- `unknown`: Uncategorized errors

Each category includes specific suggestions for resolution.

## Best Practices

1. **Always handle errors**: Use try/catch blocks for command execution
2. **Set appropriate timeouts**: Long-running commands need higher timeout values
3. **Use streaming for large outputs**: Avoid memory issues with large command outputs
4. **Validate commands**: Enable security checks for user-provided commands
5. **Clean up resources**: Call `executor.destroy()` when done
6. **Monitor active processes**: Use `getActiveProcessCount()` to track resource usage

## Contributing

When extending the module:

1. Maintain cross-platform compatibility
2. Add comprehensive error handling
3. Include security considerations
4. Update documentation and examples
5. Add appropriate tests

## License

MIT License - see LICENSE file for details.

