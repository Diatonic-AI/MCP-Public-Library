/**
 * Tool Registry for managing and executing tools from multiple modules
 */

const Logger = require('./logger');
const { getGlobalLogger } = require('./global-logger');
const ResponseFormatter = require('./response-formatter');

class ToolRegistry {
  constructor() {
    this.modules = new Map();
    this.tools = new Map();
    this.logger = new Logger('ToolRegistry');
    this.mongoLogger = getGlobalLogger();
  }

  registerModule(name, moduleInstance) {
    this.logger.debug(`Registering module: ${name}`);
    this.modules.set(name, moduleInstance);
    
    // Register tools from module
    if (moduleInstance.getTools && typeof moduleInstance.getTools === 'function') {
      const tools = moduleInstance.getTools();
      tools.forEach(tool => {
        this.tools.set(tool.name, {
          module: name,
          instance: moduleInstance,
          tool: tool
        });
        this.logger.debug(`Registered tool: ${tool.name} from module ${name}`);
      });
    }
  }

  getAllTools() {
    const tools = [];
    for (const [toolName, toolData] of this.tools) {
      tools.push(toolData.tool);
    }
    return tools;
  }

  async executeTool(toolName, args, sessionId = null) {
    const toolData = this.tools.get(toolName);
    if (!toolData) {
      const formatter = new ResponseFormatter();
      return formatter.createErrorResponse(`Tool not found: ${toolName}`);
    }

    const { instance, tool } = toolData;
    let executionId = null;
    
    try {
      // 1. Log tool execution start
      executionId = await this.mongoLogger.logStart(toolName, args, sessionId);
      
      // Execute tool method if it exists on the module
      const methodName = this.camelCase(toolName);
      if (instance[methodName] && typeof instance[methodName] === 'function') {
        
        // 2. Wrap the tool execution in try/catch
        let result;
        try {
          result = await instance[methodName](args);
          
          // 3. Log successful execution
          await this.mongoLogger.logEnd(executionId, true, result);
          
        } catch (toolError) {
          // 3. Log failed execution with error details
          await this.mongoLogger.logEnd(executionId, false, null, toolError);
          throw toolError; // Re-throw to be handled by outer catch
        }
        
        // If result is already formatted (has content array), return as-is
        if (result && result.content && Array.isArray(result.content)) {
          return result;
        }
        
        // Otherwise, format the result
        const formatter = new ResponseFormatter();
        return formatter.formatResponse(result, {
          type: 'text',
          prettify: true
        });
      } else {
        const error = new Error(`Method ${methodName} not found on module for tool ${toolName}`);
        await this.mongoLogger.logEnd(executionId, false, null, error);
        throw error;
      }
    } catch (error) {
      // Log the error if we haven't already
      if (executionId && error.message.includes('not found on module')) {
        // This was already logged above
      } else if (executionId) {
        // Log unexpected errors
        await this.mongoLogger.logEnd(executionId, false, null, error);
      }
      
      this.logger.error(`Tool execution failed for ${toolName}:`, error.message);
      const formatter = new ResponseFormatter();
      return formatter.createErrorResponse(`Tool execution failed: ${error.message}`);
    }
  }

  camelCase(str) {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  getModuleNames() {
    return Array.from(this.modules.keys());
  }

  getToolNames() {
    return Array.from(this.tools.keys());
  }
}

module.exports = ToolRegistry;

