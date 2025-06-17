# MongoDB Tool Execution Logging Integration

This document describes the MongoDB logging integration that automatically tracks all MCP tool executions.

## Overview

The logging system automatically captures:
- Tool execution start/end times
- Tool arguments (sanitized to remove sensitive data)
- Execution success/failure status
- Response data (truncated if too large)
- Error information and stack traces
- Environment metadata (Node version, platform, hostname, PID)
- Session tracking (optional)

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# MongoDB connection for logging (required)
MONGODB_URI=mongodb://localhost:27017/ai-code-writer

# Optional: Customize logging database and collection
MONGODB_LOGGER_DB=mcp_tool_logs
MONGODB_LOGGER_COLLECTION=tool_executions
```

### Database Setup

The logger automatically:
- Creates the database and collection if they don't exist
- Sets up performance indices on commonly queried fields
- Manages connection pooling for efficiency

## Implementation Details

### Automatic Integration

The logging is integrated into the `ToolRegistry` class and automatically:

1. **Logs tool start** - Records tool name, arguments, session ID, and environment
2. **Wraps execution** - Catches all exceptions during tool execution
3. **Logs tool end** - Records success/failure, response/error, and execution duration

### Data Sanitization

- **Sensitive Arguments**: Automatically redacts fields containing 'password', 'token', 'secret', 'key', 'auth', 'credential'
- **Large Responses**: Truncates responses larger than 10KB, storing size and preview
- **Error Stack Traces**: Limits stack traces to 10 lines for readability

### Connection Management

- **Lazy Initialization**: Connects to MongoDB only when needed
- **Shared Pool**: Uses a single connection pool across the entire application
- **Graceful Shutdown**: Properly closes connections on application exit

## Usage

### Automatic Logging

No code changes required! All tool executions are automatically logged:

```javascript
// This is automatically logged
const result = await toolRegistry.executeTool('my_tool', { arg1: 'value' });
```

### Session Tracking

Optionally provide a session ID for tracking related tool calls:

```javascript
// Include session ID for tracking
const result = await toolRegistry.executeTool('my_tool', args, 'session-123');
```

### Global Logger Access

Access the global logger instance if needed:

```javascript
const { getGlobalLogger } = require('./utils/global-logger');
const logger = getGlobalLogger();

// Manual logging (not typically needed)
const executionId = await logger.logStart('custom_tool', args, sessionId);
// ... tool execution ...
await logger.logEnd(executionId, true, response);
```

## Database Schema

### Collection: `tool_executions`

```javascript
{
  _id: "exec_timestamp_random",     // Unique execution ID
  toolName: "string",               // Name of the executed tool
  sessionId: "string" | null,       // Optional session identifier
  args: { /* sanitized arguments */ },
  startTime: Date,                   // Execution start timestamp
  endTime: Date | null,              // Execution end timestamp
  duration: Number | null,           // Execution duration in milliseconds
  success: Boolean | null,           // Whether execution succeeded
  response: { /* tool response */ }, // Response data (if successful)
  error: {                          // Error information (if failed)
    name: "string",
    message: "string",
    stack: "string"
  },
  environment: {
    nodeVersion: "string",          // Node.js version
    platform: "string",             // Operating system
    hostname: "string",             // Machine hostname
    pid: Number                     // Process ID
  }
}
```

### Indices

The following indices are automatically created for performance:

- `{ toolName: 1, startTime: -1 }` - Tool execution history
- `{ sessionId: 1, startTime: -1 }` - Session-based queries
- `{ success: 1, startTime: -1 }` - Success/failure analysis
- `{ startTime: -1 }` - Chronological queries

## Querying Logs

### Recent Tool Executions

```javascript
// Find recent executions
db.tool_executions.find({}).sort({ startTime: -1 }).limit(10)

// Find failed executions
db.tool_executions.find({ success: false }).sort({ startTime: -1 })

// Find executions for specific tool
db.tool_executions.find({ toolName: "my_tool" }).sort({ startTime: -1 })

// Find executions in a session
db.tool_executions.find({ sessionId: "session-123" }).sort({ startTime: 1 })
```

### Performance Analysis

```javascript
// Average execution time by tool
db.tool_executions.aggregate([
  { $match: { duration: { $ne: null } } },
  { $group: {
    _id: "$toolName",
    avgDuration: { $avg: "$duration" },
    count: { $sum: 1 }
  }},
  { $sort: { avgDuration: -1 } }
])

// Success rate by tool
db.tool_executions.aggregate([
  { $match: { success: { $ne: null } } },
  { $group: {
    _id: "$toolName",
    successRate: { $avg: { $cond: ["$success", 1, 0] } },
    total: { $sum: 1 }
  }},
  { $sort: { successRate: 1 } }
])
```

## Testing

Run the test script to verify logging integration:

```bash
node test-logger-integration.js
```

This will:
1. Initialize the MongoDB logger
2. Execute test tools (success and failure cases)
3. Verify logs are written to MongoDB
4. Clean up connections

## Troubleshooting

### Logging Disabled

If `MONGODB_URI` is not set, logging is automatically disabled with a warning message.

### Connection Issues

- Check MongoDB is running and accessible
- Verify connection string format
- Check network connectivity and firewall rules
- Review MongoDB authentication settings

### Performance Considerations

- Logging operations are non-blocking
- Failed logging doesn't affect tool execution
- Connection pooling minimizes overhead
- Large responses are automatically truncated

## Integration with Existing Tools

All existing MCP tools automatically benefit from logging without modification. The integration is:

- **Transparent**: No changes needed to existing tool implementations
- **Non-intrusive**: Logging failures don't affect tool execution
- **Configurable**: Can be disabled by not setting `MONGODB_URI`
- **Performant**: Minimal overhead with connection pooling and async operations

## Future Enhancements

- Dashboard for visualizing tool usage patterns
- Alerting for tool failure rates
- Performance monitoring and optimization suggestions
- Integration with external monitoring systems
- Audit trail for compliance requirements

