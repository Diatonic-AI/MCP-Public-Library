/**
 * Tool Registry Adapter Module
 * Provides standardized interfaces and compatibility shims for terminal and navigation tools
 */

const Logger = require('../../utils/logger');
const ResponseFormatter = require('../../utils/response-formatter');

class ToolRegistryAdapter {
  constructor() {
    this.logger = new Logger('ToolRegistryAdapter');
    this.responseFormatter = new ResponseFormatter();
    this.toolMappings = new Map();
    this.initializeToolMappings();
  }

  getTools() {
    return [
      {
        name: 'invoke_terminal_tool',
        description: 'Standardized interface to invoke terminal tools via registry',
        inputSchema: {
          type: 'object',
          properties: {
            tool_name: {
              type: 'string',
              description: 'Name of terminal tool to invoke'
            },
            command: {
              type: 'string',
              description: 'Command to execute'
            },
            options: {
              type: 'object',
              description: 'Tool-specific execution options'
            },
            platform: {
              type: 'string',
              enum: ['windows', 'wsl', 'linux', 'darwin'],
              description: 'Target platform (auto-detected if not specified)'
            }
          },
          required: ['tool_name', 'command']
        }
      },
      {
        name: 'invoke_navigation_tool',
        description: 'Standardized interface to invoke navigation tools via registry',
        inputSchema: {
          type: 'object',
          properties: {
            tool_name: {
              type: 'string',
              description: 'Name of navigation tool to invoke'
            },
            operation: {
              type: 'string',
              enum: ['list', 'tree', 'index', 'search', 'analyze'],
              description: 'Navigation operation to perform'
            },
            path: {
              type: 'string',
              default: '.',
              description: 'Target path for operation'
            },
            options: {
              type: 'object',
              description: 'Tool-specific operation options'
            }
          },
          required: ['tool_name', 'operation']
        }
      },
      {
        name: 'get_available_tools',
        description: 'Get list of available terminal and navigation tools',
        inputSchema: {
          type: 'object',
          properties: {
            tool_type: {
              type: 'string',
              enum: ['terminal', 'navigation', 'all'],
              default: 'all',
              description: 'Type of tools to list'
            },
            platform: {
              type: 'string',
              description: 'Filter by platform compatibility'
            }
          }
        }
      },
      {
        name: 'validate_tool_compatibility',
        description: 'Validate tool compatibility with current environment',
        inputSchema: {
          type: 'object',
          properties: {
            tool_name: {
              type: 'string',
              description: 'Name of tool to validate'
            },
            target_platform: {
              type: 'string',
              description: 'Target platform for validation'
            }
          },
          required: ['tool_name']
        }
      }
    ];
  }

  async invokeTerminalTool(args) {
    try {
      const { tool_name, command, options = {}, platform } = args;
      
      this.logger.info(`Invoking terminal tool: ${tool_name}`);
      
      // Get tool mapping and validate
      const toolMapping = this.getToolMapping('terminal', tool_name);
      if (!toolMapping) {
        throw new Error(`Terminal tool '${tool_name}' not found in registry`);
      }
      
      // Validate platform compatibility
      const targetPlatform = platform || this.detectPlatform();
      if (!this.validatePlatformCompatibility(toolMapping, targetPlatform)) {
        throw new Error(`Tool '${tool_name}' not compatible with platform '${targetPlatform}'`);
      }
      
      // Execute tool via adapter
      const result = await this.executeTerminalTool(toolMapping, command, options, targetPlatform);
      
      const response = {
        operation: 'invoke_terminal_tool',
        tool_name,
        command,
        platform: targetPlatform,
        execution_result: result,
        timestamp: new Date().toISOString()
      };
      
      return this.responseFormatter.formatResponse(response, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Terminal tool invocation failed:', error.message);
      throw new Error(`Terminal tool invocation failed: ${error.message}`);
    }
  }

  async invokeNavigationTool(args) {
    try {
      const { tool_name, operation, path = '.', options = {} } = args;
      
      this.logger.info(`Invoking navigation tool: ${tool_name}`);
      
      // Get tool mapping and validate
      const toolMapping = this.getToolMapping('navigation', tool_name);
      if (!toolMapping) {
        throw new Error(`Navigation tool '${tool_name}' not found in registry`);
      }
      
      // Validate operation support
      if (!this.validateOperationSupport(toolMapping, operation)) {
        throw new Error(`Tool '${tool_name}' does not support operation '${operation}'`);
      }
      
      // Execute tool via adapter
      const result = await this.executeNavigationTool(toolMapping, operation, path, options);
      
      const response = {
        operation: 'invoke_navigation_tool',
        tool_name,
        navigation_operation: operation,
        target_path: path,
        execution_result: result,
        timestamp: new Date().toISOString()
      };
      
      return this.responseFormatter.formatResponse(response, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Navigation tool invocation failed:', error.message);
      throw new Error(`Navigation tool invocation failed: ${error.message}`);
    }
  }

  async getAvailableTools(args) {
    try {
      const { tool_type = 'all', platform } = args;
      
      const availableTools = {
        terminal: [],
        navigation: [],
        total_count: 0
      };
      
      // Get terminal tools
      if (tool_type === 'all' || tool_type === 'terminal') {
        availableTools.terminal = this.getToolsByType('terminal', platform);
      }
      
      // Get navigation tools
      if (tool_type === 'all' || tool_type === 'navigation') {
        availableTools.navigation = this.getToolsByType('navigation', platform);
      }
      
      availableTools.total_count = availableTools.terminal.length + availableTools.navigation.length;
      
      const response = {
        operation: 'get_available_tools',
        filter_criteria: { tool_type, platform },
        available_tools: availableTools,
        current_platform: this.detectPlatform(),
        timestamp: new Date().toISOString()
      };
      
      return this.responseFormatter.formatResponse(response, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Failed to get available tools:', error.message);
      throw new Error(`Failed to get available tools: ${error.message}`);
    }
  }

  async validateToolCompatibility(args) {
    try {
      const { tool_name, target_platform } = args;
      
      const platform = target_platform || this.detectPlatform();
      
      // Find tool in registry
      const terminalTool = this.getToolMapping('terminal', tool_name);
      const navigationTool = this.getToolMapping('navigation', tool_name);
      
      const tool = terminalTool || navigationTool;
      if (!tool) {
        throw new Error(`Tool '${tool_name}' not found in registry`);
      }
      
      const compatibility = {
        tool_name,
        tool_type: terminalTool ? 'terminal' : 'navigation',
        target_platform: platform,
        is_compatible: this.validatePlatformCompatibility(tool, platform),
        supported_platforms: tool.platforms || ['all'],
        required_capabilities: tool.capabilities || [],
        validation_details: {
          platform_check: 'passed',
          dependency_check: 'not_implemented',
          permission_check: 'not_implemented'
        }
      };
      
      const response = {
        operation: 'validate_tool_compatibility',
        validation_result: compatibility,
        timestamp: new Date().toISOString()
      };
      
      return this.responseFormatter.formatResponse(response, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Tool compatibility validation failed:', error.message);
      throw new Error(`Tool compatibility validation failed: ${error.message}`);
    }
  }

  // Helper methods
  
  initializeToolMappings() {
    // Terminal tool mappings
    this.toolMappings.set('terminal', new Map([
      ['terminal_execute', {
        name: 'terminal_execute',
        module_path: './modules/terminal-backend/terminal-executor.js',
        platforms: ['windows', 'wsl', 'linux', 'darwin'],
        capabilities: ['capture', 'streaming', 'batch'],
        method: 'executeCapture'
      }],
      ['terminal_execute_streaming', {
        name: 'terminal_execute_streaming',
        module_path: './modules/terminal-backend/terminal-executor.js',
        platforms: ['windows', 'wsl', 'linux', 'darwin'],
        capabilities: ['streaming'],
        method: 'executeStreaming'
      }],
      ['terminal_execute_batch', {
        name: 'terminal_execute_batch',
        module_path: './modules/terminal-backend/terminal-executor.js',
        platforms: ['windows', 'wsl', 'linux', 'darwin'],
        capabilities: ['batch'],
        method: 'executeBatch'
      }]
    ]));
    
    // Navigation tool mappings
    this.toolMappings.set('navigation', new Map([
      ['directory_list', {
        name: 'directory_list',
        module_path: './modules/file-operations/directory-navigation.js',
        platforms: ['all'],
        capabilities: ['list', 'metadata', 'filtering'],
        supported_operations: ['list'],
        method: 'list'
      }],
      ['directory_tree', {
        name: 'directory_tree',
        module_path: './modules/file-operations/directory-navigation.js',
        platforms: ['all'],
        capabilities: ['tree', 'visualization'],
        supported_operations: ['tree'],
        method: 'tree'
      }],
      ['directory_index', {
        name: 'directory_index',
        module_path: './modules/file-operations/directory-navigation.js',
        platforms: ['all'],
        capabilities: ['index', 'hashing', 'metadata'],
        supported_operations: ['index'],
        method: 'index'
      }],
      ['advanced_file_operations', {
        name: 'advanced_file_operations',
        module_path: './modules/file-operations/file-operations.js',
        platforms: ['all'],
        capabilities: ['crud', 'search', 'analyze'],
        supported_operations: ['create', 'read', 'update', 'delete', 'copy', 'move', 'search', 'analyze'],
        method: 'advancedFileOperations'
      }]
    ]));
  }
  
  getToolMapping(toolType, toolName) {
    const typeMap = this.toolMappings.get(toolType);
    return typeMap ? typeMap.get(toolName) : null;
  }
  
  detectPlatform() {
    const platform = process.platform;
    const release = require('os').release();
    
    if (platform === 'win32') {
      if (process.env.WSL_DISTRO_NAME || release.includes('Microsoft')) {
        return 'wsl';
      }
      return 'windows';
    }
    
    return platform; // linux, darwin, etc.
  }
  
  validatePlatformCompatibility(toolMapping, platform) {
    const supportedPlatforms = toolMapping.platforms || [];
    return supportedPlatforms.includes('all') || supportedPlatforms.includes(platform);
  }
  
  validateOperationSupport(toolMapping, operation) {
    const supportedOps = toolMapping.supported_operations || [];
    return supportedOps.includes(operation);
  }
  
  getToolsByType(toolType, platformFilter) {
    const typeMap = this.toolMappings.get(toolType);
    if (!typeMap) return [];
    
    const tools = [];
    for (const [name, mapping] of typeMap) {
      if (!platformFilter || this.validatePlatformCompatibility(mapping, platformFilter)) {
        tools.push({
          name,
          platforms: mapping.platforms,
          capabilities: mapping.capabilities,
          supported_operations: mapping.supported_operations
        });
      }
    }
    
    return tools;
  }
  
  async executeTerminalTool(toolMapping, command, options, platform) {
    // Compatibility shim - in real implementation, this would
    // dynamically load and execute the actual terminal module
    this.logger.info(`Executing terminal tool: ${toolMapping.name}`);
    
    return {
      tool_executed: toolMapping.name,
      command,
      platform,
      simulated_output: {
        stdout: `Simulated output for: ${command}`,
        stderr: '',
        exitCode: 0,
        executionTime: Math.random() * 1000 + 100
      },
      options_used: options
    };
  }
  
  async executeNavigationTool(toolMapping, operation, path, options) {
    // Compatibility shim - in real implementation, this would
    // dynamically load and execute the actual navigation module
    this.logger.info(`Executing navigation tool: ${toolMapping.name}`);
    
    return {
      tool_executed: toolMapping.name,
      operation,
      path,
      simulated_result: {
        entries_processed: Math.floor(Math.random() * 50) + 1,
        total_size: Math.floor(Math.random() * 1000000),
        operation_time_ms: Math.random() * 500 + 50
      },
      options_used: options
    };
  }
}

module.exports = ToolRegistryAdapter;

