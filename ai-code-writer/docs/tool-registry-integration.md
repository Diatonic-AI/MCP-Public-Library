# Tool Registry Integration: Terminal and Navigation Tools

This document describes the integration of terminal execution and file navigation capabilities with the MCP tool registry system, including compatibility shims for existing orchestration components.

## Overview

The tool registry now supports automatic registration and discovery of:
- **Terminal Tools**: Cross-platform command execution with streaming, batch, and capture modes
- **Navigation Tools**: File system exploration, directory analysis, and advanced file operations

## Registered Tool Categories

### Terminal Tools

#### `terminal_execute`
- **Description**: Execute terminal commands with output capture
- **Platforms**: Windows, WSL, Linux, macOS
- **Parameters**:
  - `command` (string): Command to execute
  - `options` (object): Execution options (timeout, workingDirectory, etc.)
- **Returns**: Execution result with stdout, stderr, exitCode
- **Contexts**: Development, system administration, automation

#### `terminal_execute_streaming`
- **Description**: Execute commands with real-time streaming output
- **Platforms**: Windows, WSL, Linux, macOS
- **Parameters**:
  - `command` (string): Command to execute
  - `options` (object): Streaming options (maxBufferSize, etc.)
- **Returns**: Streaming execution result
- **Contexts**: Monitoring, long-running processes, real-time feedback

#### `terminal_execute_batch`
- **Description**: Execute multiple commands in sequence
- **Platforms**: Windows, WSL, Linux, macOS
- **Parameters**:
  - `commands` (array): List of commands to execute
  - `options` (object): Batch execution options (stopOnError, etc.)
- **Returns**: Array of execution results
- **Contexts**: Automation, deployment, batch processing

### Navigation Tools

#### `directory_list`
- **Description**: List directory contents with extended metadata
- **Platforms**: All
- **Parameters**:
  - `directory` (string): Directory path to list
  - `depth` (number): Maximum traversal depth
  - `options` (object): Listing options (sorting, filtering, etc.)
- **Returns**: Array of directory entries with metadata
- **Contexts**: File management, exploration, analysis

#### `directory_tree`
- **Description**: Generate ASCII tree visualization of directory structure
- **Platforms**: All
- **Parameters**:
  - `directory` (string): Directory path to visualize
  - `maxDepth` (number): Maximum depth for tree generation
- **Returns**: ASCII tree representation
- **Contexts**: Documentation, project structure visualization

#### `directory_index`
- **Description**: Generate comprehensive JSON index with file hashes
- **Platforms**: All
- **Parameters**:
  - `directory` (string): Directory path to index
- **Returns**: JSON index with metadata and hashes
- **Contexts**: Backup, version control, change detection

#### `advanced_file_operations`
- **Description**: Comprehensive file and directory operations
- **Platforms**: All
- **Parameters**:
  - `operation` (string): Type of operation (create, read, update, delete, etc.)
  - `target_path` (string): Path to target file or directory
  - `content` (string): Content for create/update operations
  - `options` (object): Additional operation options
- **Returns**: Operation result with status and metadata
- **Contexts**: File management, content creation, backup

## Registration API

### Register Terminal Tools

```javascript
// Register terminal tools for a specific platform
const registrationResult = await toolRegistry.registerTerminalTools({
  platform: 'windows', // or 'wsl', 'linux', 'darwin'
  capabilities: ['streaming', 'batch', 'capture']
});
```

### Register Navigation Tools

```javascript
// Register navigation and file operation tools
const registrationResult = await toolRegistry.registerNavigationTools({
  supported_operations: ['list', 'tree', 'index', 'file_ops'],
  cross_platform: true
});
```

## Compatibility Shims

### Solution Executor Integration

The solution executor now automatically detects terminal and navigation requirements in solution plans:

```javascript
// Solution plan with terminal and navigation tasks
const solutionPlan = {
  implementation_plan: {
    phases: [
      {
        name: 'setup',
        tools_required: [
          { command: 'npm install', phase: 'dependency_install' },
          { operation: 'list', path: './src', phase: 'source_analysis' }
        ]
      }
    ]
  }
};

// Execute with automatic tool routing
const result = await solutionExecutor.executeSolutionPlan({ solution_plan: solutionPlan });
```

### Tool Chainer Integration

The tool chainer supports terminal and navigation tools in workflow definitions:

```javascript
// Workflow with mixed tool types
const workflow = {
  steps: [
    {
      id: 'scan_directory',
      tool_name: 'directory_list',
      tool_type: 'navigation',
      parameters: { directory: './project', depth: 2 }
    },
    {
      id: 'run_tests',
      tool_name: 'terminal_execute',
      tool_type: 'terminal',
      parameters: { command: 'npm test' }
    }
  ]
};

const result = await toolChainer.chainMcpTools({ workflow_definition: workflow });
```

## Tool Registry Adapter

The adapter provides standardized interfaces for tool invocation:

### Invoke Terminal Tool

```javascript
const result = await adapter.invokeTerminalTool({
  tool_name: 'terminal_execute',
  command: 'git status',
  options: { timeout: 10000 },
  platform: 'linux' // optional, auto-detected if not specified
});
```

### Invoke Navigation Tool

```javascript
const result = await adapter.invokeNavigationTool({
  tool_name: 'directory_tree',
  operation: 'tree',
  path: './src',
  options: { maxDepth: 3 }
});
```

### Get Available Tools

```javascript
// List all available tools
const allTools = await adapter.getAvailableTools({ tool_type: 'all' });

// List only terminal tools for current platform
const terminalTools = await adapter.getAvailableTools({
  tool_type: 'terminal',
  platform: 'windows'
});
```

### Validate Tool Compatibility

```javascript
const compatibility = await adapter.validateToolCompatibility({
  tool_name: 'terminal_execute_batch',
  target_platform: 'linux'
});
```

## Tool Metadata Schema

Each registered tool includes comprehensive metadata:

```javascript
{
  id: 'unique_tool_identifier',
  name: 'tool_name',
  description: 'Human-readable description',
  server_name: 'hosting_server_name',
  server_path: './path/to/server',
  file_path: './path/to/implementation',
  category: 'terminal|navigation|file_operations',
  suggested_chains: ['related_tool_categories'],
  input_schema: {
    // JSON Schema definition
  },
  parameters: {
    // Parameter descriptions
  },
  returns: 'Description of return value',
  contexts: ['usage_contexts'],
  discovered_at: 'ISO_timestamp'
}
```

## Performance Tracking

The tool registry automatically tracks performance metrics:

- **Usage Count**: Number of times tool has been invoked
- **Success Rate**: Percentage of successful executions
- **Average Duration**: Mean execution time in milliseconds
- **User Ratings**: Average user rating (1-5 scale)
- **Last Used**: Timestamp of most recent usage

### Record Tool Usage

```javascript
const usageResult = await toolRegistry.recordToolUsage({
  tool_id: 'terminal_execute_linux',
  execution_time: 1500,
  success: true,
  user_rating: 4,
  task_description: 'Running project build'
});
```

### Get Performance Metrics

```javascript
const metrics = await toolRegistry.getToolPerformance({
  tool_id: 'directory_list',
  time_range: '7d'
});
```

## Tool Recommendations

The system provides intelligent tool recommendations based on usage patterns:

```javascript
const recommendations = await toolRegistry.getToolRecommendations({
  current_tool: 'terminal_execute',
  task_context: 'building and testing a Node.js project',
  max_recommendations: 5
});
```

## Best Practices

### 1. Platform-Specific Registration

Register tools for each target platform to ensure optimal compatibility:

```javascript
// Register for multiple platforms
const platforms = ['windows', 'linux', 'darwin'];
for (const platform of platforms) {
  await toolRegistry.registerTerminalTools({ platform, capabilities: ['streaming', 'batch'] });
}
```

### 2. Capability-Based Tool Selection

Choose tools based on required capabilities:

```javascript
// For real-time monitoring, use streaming tools
if (requiresRealTimeOutput) {
  toolName = 'terminal_execute_streaming';
} else {
  toolName = 'terminal_execute';
}
```

### 3. Error Handling in Tool Chains

Configure appropriate error handling strategies:

```javascript
const workflow = {
  error_handling: 'retry', // 'stop', 'skip', 'retry', 'alternative'
  steps: [
    // workflow steps
  ]
};
```

### 4. Performance Monitoring

Regularly review tool performance metrics:

```javascript
// Get top performing tools
const topTools = await toolRegistry.getToolPerformance({ time_range: '30d' });

// Monitor success rates and optimize problematic tools
const lowPerformers = topTools.filter(tool => tool.success_rate < 0.8);
```

## Troubleshooting

### Common Issues

1. **Tool Not Found**: Ensure tools are properly registered before use
2. **Platform Incompatibility**: Verify tool supports target platform
3. **Permission Errors**: Check file system permissions for navigation tools
4. **Timeout Issues**: Adjust timeout settings for long-running commands

### Debug Mode

Enable debug logging for detailed execution information:

```javascript
const toolRegistry = new ToolRegistryDatabase();
toolRegistry.logger.setLevel('debug');
```

## Migration Guide

For existing projects using legacy tool invocation:

1. **Update Tool Calls**: Replace direct module imports with registry adapter calls
2. **Add Metadata**: Register existing tools with proper metadata
3. **Update Error Handling**: Utilize new error handling strategies
4. **Performance Tracking**: Implement usage recording for monitoring

### Before (Legacy)

```javascript
const terminalExecutor = require('./terminal-executor');
const result = await terminalExecutor.executeCapture(command);
```

### After (Registry-Based)

```javascript
const adapter = new ToolRegistryAdapter();
const result = await adapter.invokeTerminalTool({
  tool_name: 'terminal_execute',
  command: command
});
```

## Future Enhancements

- **Dynamic Tool Discovery**: Automatic detection of new tools
- **Load Balancing**: Distribute tool execution across multiple instances
- **Caching**: Cache frequently used navigation results
- **Security**: Enhanced security validation for terminal commands
- **Metrics Dashboard**: Web-based performance monitoring interface

