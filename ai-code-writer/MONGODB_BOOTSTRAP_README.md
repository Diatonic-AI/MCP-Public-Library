# MongoDB Logger Bootstrap Setup

This document explains how to set up MongoDB logging for MCP tool execution tracking using the bootstrap script.

## Overview

The MongoDB Logger Bootstrap system provides:

1. **Automated MongoDB Setup**: Creates databases, collections, and indexes
2. **Configuration Management**: Generates configuration files for Node.js integration
3. **Test Mode**: Creates unique timestamped databases for testing
4. **Environment Integration**: Works with Docker, localhost, or remote MongoDB

## Prerequisites

### Python Requirements
```bash
pip install pymongo
```

### MongoDB Requirements
Either:
- MongoDB running locally (default: `mongodb://localhost:27017`)
- MongoDB running in Docker (see Docker Compose section)
- Remote MongoDB instance with connection string

## Quick Start

### 1. Test MongoDB Connection
```bash
python bootstrap_mongo_logger.py --test-connection-only
```

### 2. Run Bootstrap (Test Mode)
```bash
python bootstrap_mongo_logger.py
```

### 3. Test Integration
```bash
node test-bootstrap-integration.js
```

## Configuration Options

### Environment Variables
The bootstrap script reads configuration from:

```bash
# MongoDB connection (required)
MONGODB_URI=mongodb://localhost:27017

# Database and collection names (optional)
MONGODB_LOGGER_DB=mcp_tool_logs
MONGODB_LOGGER_COLLECTION=tool_executions
```

### Command Line Options

```bash
# Use production database names (no timestamp)
python bootstrap_mongo_logger.py --production

# Specify custom MongoDB URI
python bootstrap_mongo_logger.py --mongo-uri "mongodb://user:pass@host:port/db"

# Test connection only
python bootstrap_mongo_logger.py --test-connection-only
```

## Docker Setup

If using the included Docker Compose:

```bash
# Start MongoDB in Docker
docker-compose up -d mongo

# Wait for MongoDB to be ready
sleep 10

# Run bootstrap
python bootstrap_mongo_logger.py
```

## Generated Files

The bootstrap script creates:

### `mongo_logger_config.json`
```json
{
  "mongodb_uri": "mongodb://localhost:27017",
  "database_name": "mcp_test_logs_20240617_143052",
  "collection_name": "tool_executions_20240617_143052",
  "connection_info": {
    "status": "connected",
    "server_version": "7.0.0"
  },
  "bootstrap_timestamp": "2024-06-17T14:30:52.123456",
  "test_mode": true
}
```

### `mongo_logger_env.sh`
```bash
# MongoDB Logger Configuration (generated by bootstrap_mongo_logger.py)
export MONGODB_URI="mongodb://localhost:27017"
export MONGODB_LOGGER_DB="mcp_test_logs_20240617_143052"
export MONGODB_LOGGER_COLLECTION="tool_executions_20240617_143052"
```

## Using the MongoDB Logger

### Automatic Configuration Loading
The `MongoDBLogger` class automatically detects and uses bootstrap configuration:

```javascript
const MongoDBLogger = require('./utils/mongodb-logger');

// Automatically uses bootstrap config if available
const logger = new MongoDBLogger();

// Log a tool execution
const execId = await logger.logStart('my_tool', { param: 'value' }, 'session_123');
if (execId) {
  // Tool execution...
  await logger.logEnd(execId, true, { result: 'success' });
}
```

### Manual Configuration
```javascript
// Override with manual configuration
const logger = new MongoDBLogger({
  mongodb_uri: 'mongodb://localhost:27017',
  database_name: 'my_custom_db',
  collection_name: 'my_custom_collection'
});
```

### Configuration Priority
1. Constructor parameters (highest)
2. Bootstrap configuration file
3. Environment variables (lowest)

## Database Schema

The bootstrap script creates collections with this document structure:

```javascript
{
  _id: "exec_abc123_def456",           // Unique execution ID
  toolName: "generate_code",            // Name of the executed tool
  sessionId: "session_789",            // Optional session identifier
  args: {                              // Tool arguments (sanitized)
    prompt: "Create a function",
    language: "javascript"
  },
  startTime: ISODate("2024-06-17T14:30:52.123Z"),
  endTime: ISODate("2024-06-17T14:30:53.456Z"),
  duration: 1333,                      // Duration in milliseconds
  success: true,                       // Execution success status
  response: {                          // Tool response (truncated if large)
    result: "function myFunc() { ... }"
  },
  error: null,                         // Error info (if success=false)
  environment: {                       // Execution environment
    nodeVersion: "v18.17.0",
    platform: "win32",
    hostname: "dev-machine",
    pid: 12345
  }
}
```

## Database Indexes

The bootstrap script creates these indexes for optimal query performance:

```javascript
// Single field indexes
{ "toolName": 1 }
{ "startTime": -1 }
{ "sessionId": 1 }
{ "success": 1 }

// Compound indexes
{ "toolName": 1, "startTime": -1 }     // Tool + time queries
{ "sessionId": 1, "startTime": -1 }    // Session + time queries
{ "success": 1, "startTime": -1 }      // Success + time queries
```

## Production vs Test Mode

### Test Mode (Default)
- Creates unique database names with timestamps
- Safe for development and testing
- Can be safely deleted after testing
- Example: `mcp_test_logs_20240617_143052`

### Production Mode
```bash
python bootstrap_mongo_logger.py --production
```
- Uses configured database names (no timestamp)
- Intended for production deployments
- Example: `mcp_tool_logs`

## Troubleshooting

### Connection Issues
```bash
# Check if MongoDB is running
python bootstrap_mongo_logger.py --test-connection-only

# Check Docker services
docker-compose ps

# Check MongoDB logs
docker-compose logs mongo
```

### Permission Issues
```bash
# If running with authentication
export MONGODB_URI="mongodb://username:password@localhost:27017/database"
python bootstrap_mongo_logger.py
```

### Environment Loading
```bash
# Load generated environment variables
source mongo_logger_env.sh

# Verify environment
echo $MONGODB_LOGGER_DB
```

### Configuration Issues
```javascript
// Debug logger configuration
const logger = new MongoDBLogger();
console.log('MongoDB URI:', logger.mongoUri);
console.log('Database:', logger.dbName);
console.log('Collection:', logger.collectionName);
```

## Security Considerations

### Sensitive Data Handling
The MongoDB logger automatically sanitizes:
- Passwords, tokens, secrets, keys in arguments
- Large responses (>10KB) are truncated
- Stack traces are limited to 10 lines

### Network Security
- Use TLS/SSL for production MongoDB connections
- Configure MongoDB authentication
- Use connection string with credentials for remote instances

### Example Production Connection
```bash
export MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/production_logs?retryWrites=true&w=majority"
python bootstrap_mongo_logger.py --production
```

## Integration with MCP Server

The MongoDB logger integrates seamlessly with the MCP server architecture:

```javascript
// In your MCP server
const MongoDBLogger = require('./utils/mongodb-logger');
const logger = new MongoDBLogger();

// Wrap tool execution with logging
async function executeToolWithLogging(toolName, args, sessionId) {
  const execId = await logger.logStart(toolName, args, sessionId);
  
  try {
    const result = await executeTool(toolName, args);
    await logger.logEnd(execId, true, result);
    return result;
  } catch (error) {
    await logger.logEnd(execId, false, null, error);
    throw error;
  }
}
```

## Next Steps

1. **Run Bootstrap**: `python bootstrap_mongo_logger.py`
2. **Test Integration**: `node test-bootstrap-integration.js`
3. **Integrate with Your Tools**: Add logging to your MCP tool handlers
4. **Monitor Execution**: Query the MongoDB collection for analytics
5. **Set Up Production**: Use `--production` flag for deployment

For questions or issues, check the troubleshooting section or review the generated configuration files.

