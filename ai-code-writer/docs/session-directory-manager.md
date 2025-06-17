# Session Directory Manager

The Session Directory Manager provides session-based current working directory (cwd) tracking with in-memory storage and optional Redis persistence for multi-agent scenarios.

## Features

- **Session-based directory tracking**: Each session/context maintains its own working directory
- **In-memory storage**: Fast access with automatic cleanup of expired sessions
- **Redis persistence**: Optional Redis backend for multi-agent persistence and scalability
- **CRUD operations**: Complete set of operations for managing session directories
- **Terminal integration**: Hooks for automatic directory updates from terminal commands
- **Path validation**: Automatic validation and normalization of directory paths
- **Context isolation**: Complete isolation between different sessions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Session Directory Manager                │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │  In-Memory      │  │  Redis Storage  │  │   Hooks     │  │
│  │  Storage        │  │  (Optional)     │  │  System     │  │
│  │                 │  │                 │  │             │  │
│  │ • Fast access   │  │ • Persistence   │  │ • CD hooks  │  │
│  │ • Auto cleanup  │  │ • Multi-agent   │  │ • Callbacks │  │
│  │ • Session TTL   │  │ • Scalability   │  │ • Events    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │                        │                     │
           ▼                        ▼                     ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Terminal       │      │  File           │      │  External       │
│  Integration    │      │  Operations     │      │  Hooks          │
│                 │      │                 │      │                 │
│ • Auto cd track │      │ • Path resolve  │      │ • Notifications │
│ • Command parse │      │ • Validation    │      │ • Logging       │
│ • Synchronize   │      │ • Normalization │      │ • Custom logic  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Components

### 1. SessionDirectoryManager

Core component that manages session-based directory tracking.

```javascript
const SessionDirectoryManager = require('./modules/file-operations/session-directory-manager');

const sessionManager = new SessionDirectoryManager({
  useRedis: true,
  redisPrefix: 'session:cwd:',
  defaultCwd: process.cwd(),
  sessionTimeout: 3600000, // 1 hour
  enableValidation: true
});
```

### 2. TerminalSessionIntegration

Provides automatic terminal command tracking and session integration.

```javascript
const TerminalSessionIntegration = require('./modules/terminal-backend/terminal-session-integration');

const terminalIntegration = new TerminalSessionIntegration(
  sessionManager,
  terminalExecutor
);
```

### 3. DirectoryManager (Extended)

Extended directory manager with built-in session support.

```javascript
const DirectoryManager = require('./modules/file-operations/directory-manager');

const dirManager = new DirectoryManager({
  enableSessionTracking: true,
  sessionOptions: {
    useRedis: true,
    sessionTimeout: 3600000
  }
});
```

## API Reference

### Core Methods

#### `createSessionDirectory(args)`
Create a new session with initial working directory.

```javascript
const result = await sessionManager.createSessionDirectory({
  sessionId: 'user-session-1',
  initialCwd: '/path/to/directory',
  metadata: { userId: 'user123', type: 'development' }
});
```

#### `getSessionDirectory(args)`
Get current working directory for a session.

```javascript
const sessionInfo = await sessionManager.getSessionDirectory({
  sessionId: 'user-session-1'
});
console.log('Current directory:', sessionInfo.cwd);
```

#### `updateSessionDirectory(args)`
Update current working directory for a session.

```javascript
const result = await sessionManager.updateSessionDirectory({
  sessionId: 'user-session-1',
  newCwd: '/new/directory/path',
  validate: true
});
```

#### `changeDirectory(args)`
Change directory (cd command equivalent).

```javascript
const result = await sessionManager.changeDirectory({
  sessionId: 'user-session-1',
  targetPath: '../parent-directory',
  createIfNotExists: false
});
```

#### `deleteSessionDirectory(args)`
Remove session directory tracking.

```javascript
const result = await sessionManager.deleteSessionDirectory({
  sessionId: 'user-session-1'
});
```

#### `listSessionDirectories(args)`
List all active session directories.

```javascript
const sessions = await sessionManager.listSessionDirectories({
  includeMetadata: true
});
```

### Terminal Integration Methods

#### `executeSessionCommand(sessionId, command, options)`
Execute command with session-aware working directory.

```javascript
const result = await terminalIntegration.executeSessionCommand(
  'user-session-1',
  'ls -la',
  { createIfNotExists: true }
);
```

#### `executeSessionCommandBatch(sessionId, commands, options)`
Execute multiple commands in session context.

```javascript
const commands = ['pwd', 'cd ..', 'pwd', 'ls'];
const result = await terminalIntegration.executeSessionCommandBatch(
  'user-session-1',
  commands,
  { continueOnError: true }
);
```

#### `synchronizeSessionDirectory(sessionId)`
Synchronize session directory with actual filesystem.

```javascript
const syncResult = await terminalIntegration.synchronizeSessionDirectory(
  'user-session-1'
);
```

### Hooks System

#### `registerCdHook(hookFunction)`
Register a hook to be called when directory changes.

```javascript
sessionManager.registerCdHook(async (sessionId, oldCwd, newCwd) => {
  console.log(`Session ${sessionId} moved from ${oldCwd} to ${newCwd}`);
  // Custom logic here
});
```

#### `unregisterCdHook(hookFunction)`
Unregister a previously registered hook.

```javascript
sessionManager.unregisterCdHook(myHookFunction);
```

## Configuration Options

### SessionDirectoryManager Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useRedis` | boolean | `false` | Enable Redis persistence |
| `redisPrefix` | string | `'session:cwd:'` | Redis key prefix |
| `defaultCwd` | string | `process.cwd()` | Default working directory |
| `sessionTimeout` | number | `3600000` | Session timeout in milliseconds |
| `enableValidation` | boolean | `true` | Enable directory validation |

### TerminalSessionIntegration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableAutoCdTracking` | boolean | `true` | Auto-track cd commands |
| `cdCommandPatterns` | RegExp[] | See code | Patterns for cd command detection |
| `pwdCommandPatterns` | RegExp[] | See code | Patterns for pwd command detection |

## Usage Examples

### Basic Session Management

```javascript
const SessionDirectoryManager = require('./modules/file-operations/session-directory-manager');

// Initialize
const sessionManager = new SessionDirectoryManager({
  useRedis: true,
  sessionTimeout: 3600000
});

// Create session
const session = await sessionManager.createSessionDirectory({
  sessionId: 'my-session',
  initialCwd: '/home/user/project'
});

// Navigate directories
await sessionManager.changeDirectory({
  sessionId: 'my-session',
  targetPath: 'src'
});

// Get current directory
const current = await sessionManager.getSessionDirectory({
  sessionId: 'my-session'
});
console.log('Current directory:', current.cwd);
```

### Terminal Integration

```javascript
const TerminalSessionIntegration = require('./modules/terminal-backend/terminal-session-integration');
const TerminalExecutor = require('./modules/terminal-backend/terminal-executor');

// Setup
const terminalExecutor = new TerminalExecutor();
const terminalIntegration = new TerminalSessionIntegration(
  sessionManager,
  terminalExecutor
);

// Execute commands with automatic directory tracking
const result = await terminalIntegration.executeSessionCommand(
  'my-session',
  'cd /path/to/project && npm install'
);

// The session directory is automatically updated
```

### Redis Persistence

```javascript
const redis = require('redis');

// Setup Redis
const redisClient = redis.createClient({
  host: 'localhost',
  port: 6379
});
await redisClient.connect();

// Initialize session manager with Redis
const sessionManager = new SessionDirectoryManager({
  useRedis: true,
  redisPrefix: 'myapp:sessions:'
});

await sessionManager.initializeRedis(redisClient);

// Sessions are now persisted in Redis
```

### Custom Hooks

```javascript
// Register custom hook for directory changes
sessionManager.registerCdHook(async (sessionId, oldCwd, newCwd) => {
  // Log directory changes
  console.log(`Directory changed: ${oldCwd} → ${newCwd}`);
  
  // Update environment variables
  process.env.CURRENT_SESSION_DIR = newCwd;
  
  // Notify other components
  eventEmitter.emit('directoryChanged', {
    sessionId,
    oldCwd,
    newCwd
  });
});
```

## MCP Tools Integration

The session directory manager provides MCP tools that can be used in MCP servers:

```javascript
const tools = sessionManager.getTools();
// Returns array of MCP tool definitions:
// - create_session_directory
// - get_session_directory
// - update_session_directory
// - delete_session_directory
// - list_session_directories
// - change_directory
```

## Error Handling

The module provides comprehensive error handling:

```javascript
try {
  await sessionManager.changeDirectory({
    sessionId: 'my-session',
    targetPath: '/nonexistent/path'
  });
} catch (error) {
  if (error.message.includes('does not exist')) {
    // Handle directory not found
  } else if (error.message.includes('Session')) {
    // Handle session not found
  }
}
```

## Performance Considerations

1. **Memory Usage**: Sessions are stored in memory for fast access with automatic cleanup
2. **Redis Persistence**: Optional Redis backend for persistence and multi-agent scenarios
3. **Session Timeout**: Configurable session timeout to prevent memory leaks
4. **Validation**: Optional directory validation can be disabled for performance

## Best Practices

1. **Session IDs**: Use unique, meaningful session identifiers
2. **Cleanup**: Always clean up sessions when done
3. **Error Handling**: Implement proper error handling for all operations
4. **Hooks**: Use hooks for custom behavior and integrations
5. **Redis**: Use Redis for multi-agent or persistent scenarios

## Testing

Run the example to test the functionality:

```bash
node examples/session-directory-usage.js
```

## Dependencies

- `redis`: For optional Redis persistence
- `path`: For path manipulation
- `fs`: For filesystem operations
- `os`: For system information

## License

MIT License - see project root for details.

