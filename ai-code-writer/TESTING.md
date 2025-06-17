# Testing and Automated Cleanup System

This document describes the comprehensive testing infrastructure with automated cleanup capabilities implemented for the AI Code Writer MCP server.

## Overview

The testing system provides:
- **Comprehensive Integration Tests**: Full system testing across MongoDB, Redis, Qdrant, and file operations
- **Automated Resource Cleanup**: Intelligent cleanup of test databases, connections, and temporary files
- **Manual Debug Mode**: `--keep-logs` flag to preserve test resources for manual inspection
- **Flexible Test Runner**: Support for different test types and execution modes

## Architecture

### Core Components

1. **TestCleanupManager** (`test-setup.js`)
   - Tracks all test resources (databases, connections, files)
   - Provides comprehensive cleanup functionality
   - Supports selective cleanup based on flags

2. **ComprehensiveLoggingTest** (`test-comprehensive-logging.js`)
   - Full integration test covering all major components
   - Tests MongoDB logging, Redis queues, Qdrant vector DB, and file operations
   - Demonstrates real-world usage patterns

3. **TestRunner** (`test/test-runner.js`)
   - Unified interface for running different test types
   - Handles command-line arguments and test orchestration

## Test Types

### Comprehensive Test (Default)

The comprehensive test validates:

#### MongoDB Logging
- Database and collection creation
- Document insertion and indexing
- Aggregation queries and statistics
- Connection management

#### Redis Task Queue
- Queue initialization and connection
- Task creation, retrieval, and completion
- Priority queue functionality
- Statistics and monitoring

#### Qdrant Vector Database
- Collection creation and management
- Vector storage and search operations
- Similarity search functionality
- Collection statistics

#### File Operations
- Temporary file creation and management
- File reading and validation
- Directory operations

#### Automated Cleanup
- Resource tracking and cleanup
- Database and collection removal
- Connection closure
- Temporary file deletion

## Usage

### Quick Start

```bash
# Run comprehensive test with automatic cleanup
npm run test:logging

# Run comprehensive test keeping logs for debugging
npm run test:logging -- --keep-logs

# Run using Jest
npm test

# Run using test runner
node test/test-runner.js
```

### Command Line Options

```bash
# Test runner options
node test/test-runner.js [options]

Options:
  --comprehensive, --all    Run comprehensive logging test (default)
  --unit                    Run unit tests only
  --integration             Run integration tests only
  --keep-logs               Preserve logs and databases for debugging
  --verbose                 Show detailed output
  --help                    Show help message
```

### Examples

```bash
# Basic comprehensive test
node test/test-runner.js

# Keep test data for manual inspection
node test/test-runner.js --keep-logs

# Run with verbose output
node test/test-runner.js --verbose

# Run unit tests only
node test/test-runner.js --unit

# Direct Jest execution
jest test-comprehensive-logging.js --verbose

# Direct comprehensive test execution
node test-comprehensive-logging.js --keep-logs
```

## Cleanup System

### Automatic Cleanup

By default, the system automatically cleans up:

#### MongoDB Resources
- Test databases (prefixed with `mcp_test_` or `mcp_comprehensive_test_`)
- All collections within test databases
- MongoDB client connections

#### Redis Resources
- Test-related keys (patterns: `*test*`, `embeddings_*`, `task_*`)
- Redis client connections (main, subscriber, publisher)

#### Qdrant Resources
- Test collections (containing 'test' in name or explicitly registered)
- Collection cleanup via Qdrant REST API

#### File System Resources
- Temporary files created during tests
- Log files and configuration files
- Test output directories

### Manual Debug Mode

Use the `--keep-logs` flag to preserve resources for debugging:

```bash
# This will skip cleanup of databases and files
node test/test-runner.js --keep-logs
```

In debug mode:
- MongoDB test databases are preserved
- Redis test keys remain
- Qdrant test collections are kept
- Temporary files are not deleted
- Log files are preserved

### Resource Registration

The TestCleanupManager automatically tracks resources:

```javascript
// Register a temporary database
cleanupManager.registerTemporaryDatabase('test_db_name', client);

// Register a temporary file
cleanupManager.registerTemporaryFile('./temp_file.txt');

// Register a Redis connection
cleanupManager.registerRedisConnection(redisClient);

// Register a Qdrant collection
cleanupManager.registerQdrantCollection('test_collection');
```

## Environment Setup

### Required Environment Variables

```bash
# MongoDB connection
MONGODB_URI=mongodb://localhost:27017

# Redis connection
REDIS_URL=redis://localhost:6379

# Qdrant connection
QDRANT_URL=http://localhost:6333
```

### Default Values

If environment variables are not set, the system uses these defaults:
- MongoDB: `mongodb://localhost:27017`
- Redis: `redis://localhost:6379`
- Qdrant: `http://localhost:6333`

## Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  testEnvironment: 'node',
  testTimeout: 120000, // 2 minutes for comprehensive tests
  globalSetup: '<rootDir>/test-setup.js',
  globalTeardown: '<rootDir>/test-setup.js',
  setupFilesAfterEnv: ['<rootDir>/test-setup.js'],
  maxWorkers: 1, // Prevent test interference
  forceExit: true,
  detectOpenHandles: true
};
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "node test/test-runner.js",
    "test:logging": "jest test-comprehensive-logging.js --verbose",
    "test:keep-logs": "node test-comprehensive-logging.js --keep-logs",
    "test:verbose": "node test/test-runner.js --verbose"
  }
}
```

## Test Output

### Successful Test Output

```
🧪 COMPREHENSIVE LOGGING TEST REPORT
================================================================================

📊 Test Results Summary:

🍃 MongoDB Logging: ✅ SUCCESS
   Database: mcp_comprehensive_test_2024-06-17T12-30-45
   Documents: 3 (2 successful, 1 failed)

🔴 Redis Task Queue: ✅ SUCCESS
   Tasks Processed: 3/3
   Queue Stats: {"total":0,"completed":3,"failed":0}

🔍 Qdrant Vector DB: ✅ SUCCESS
   Collection: test_collection_1718630445123
   Embeddings: 3
   Search Results: 3

📁 File Operations: ✅ SUCCESS
   Files Created: 3
   Files Read: 3

🧹 Automated Cleanup: ✅ SUCCESS
   MongoDB: 1 databases, 1 connections
   Redis: 3 connections, 15 keys
   Qdrant: 1 collections
   Files: 3 temporary, 2 logs

================================================================================
🎉 ALL TESTS PASSED! Comprehensive logging system is working correctly.
✨ All test resources have been automatically cleaned up.
================================================================================
```

### Cleanup Summary

```
🧹 Test Cleanup Summary
================================================================================
⏱️  Duration: 1250ms

📊 Resources cleaned:
   MongoDB:
     - Databases: 1
     - Collections: 0
     - Connections: 1
   Redis:
     - Connections: 3
     - Keys: 15
   Qdrant:
     - Collections: 1
   Files:
     - Temporary: 3
     - Logs: 2
================================================================================
```

## Error Handling

The system includes comprehensive error handling:

### Test Failures
- Tests continue running even if individual components fail
- Cleanup is attempted even after test failures
- Detailed error reporting for debugging

### Cleanup Failures
- Individual cleanup failures don't stop overall cleanup
- Warning messages for failed cleanup operations
- Graceful degradation when services are unavailable

### Connection Issues
- Automatic fallback to default configurations
- Service availability checks before cleanup
- Timeout handling for external services

## Best Practices

### For Development
1. Always run tests with `--keep-logs` when debugging
2. Use verbose mode for detailed troubleshooting
3. Check test output directories after failed tests
4. Verify environment variables before running tests

### For CI/CD
1. Use default cleanup mode (no `--keep-logs`)
2. Set appropriate timeouts for test environments
3. Ensure all required services are available
4. Monitor cleanup completion in logs

### For Production
1. Never run tests against production databases
2. Use isolated test environments
3. Implement proper access controls for test resources
4. Regular cleanup of orphaned test resources

## Troubleshooting

### Common Issues

#### Connection Failures
```bash
# Check service availability
mongosh mongodb://localhost:27017
redis-cli ping
curl http://localhost:6333/collections
```

#### Cleanup Issues
```bash
# Manual cleanup if needed
# MongoDB
mongosh --eval "db.adminCommand('listDatabases').databases.filter(d => d.name.includes('test')).forEach(d => db.getSiblingDB(d.name).dropDatabase())"

# Redis
redis-cli --scan --pattern "*test*" | xargs redis-cli del

# Qdrant
curl -X GET http://localhost:6333/collections | jq '.result.collections[] | select(.name | contains("test"))'
```

#### Test Timeouts
- Increase Jest timeout in `jest.config.js`
- Check service performance and load
- Use `--verbose` flag to identify slow operations

### Debug Mode

When using `--keep-logs`:
1. Inspect test databases manually
2. Check Redis keys for test data
3. Examine temporary files in test directories
4. Review Qdrant collections for test data

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017
      redis:
        image: redis:latest
        ports:
          - 6379:6379
      qdrant:
        image: qdrant/qdrant:latest
        ports:
          - 6333:6333
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
        env:
          MONGODB_URI: mongodb://localhost:27017
          REDIS_URL: redis://localhost:6379
          QDRANT_URL: http://localhost:6333
```

This comprehensive testing and cleanup system ensures reliable, repeatable tests while maintaining clean development and CI/CD environments.

