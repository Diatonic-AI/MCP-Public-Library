#!/usr/bin/env node

/**
 * Load Environment Variables FIRST
 * This ensures all modules have access to the environment variables from the start.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

/**
 * AI Code Writer MCP Server - Modular Architecture
 * Self-sufficient MCP orchestration server with comprehensive capabilities
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Import modular components
const EnvironmentManager = require('./modules/code-generation/environment-manager');
const CodeAnalyzer = require('./modules/code-generation/code-analyzer');
const CodeGenerator = require('./modules/code-generation/code-generator');
const FileCreator = require('./modules/code-generation/file-creator');
const ServerValidator = require('./modules/code-generation/server-validator');

const ProblemAnalyzer = require('./modules/orchestration/problem-analyzer');
const SolutionPlanner = require('./modules/orchestration/solution-planner');
const SolutionExecutor = require('./modules/orchestration/solution-executor');

const FileOperations = require('./modules/file-operations/file-operations');
const DirectoryManager = require('./modules/file-operations/directory-manager');

const McpDiscovery = require('./modules/mcp-communication/mcp-discovery');
const ToolChainer = require('./modules/mcp-communication/tool-chainer');
const McpCommunicator = require('./modules/mcp-communication/mcp-communicator');

const ParallelExecutor = require('./modules/task-execution/parallel-executor');

const ConversationManager = require('./modules/ai-conversation/conversation-manager');

const VectorDatabase = require('./modules/vector-database/vector-database');
const EmbeddingsToolkit = require('./modules/vector-database/embeddings-toolkit');

const DatabaseMonitorTools = require('./modules/database-monitor/tools');

const Logger = require('./utils/logger');
const { initializeGlobalLogger, closeGlobalLogger } = require('./utils/global-logger');
const ToolRegistry = require('./utils/tool-registry');
const ResponseFormatter = require('./utils/response-formatter');

class AICodeWriterServer {
  constructor() {
    this.server = new Server(
      {
        name: 'ai-code-writer-orchestrator',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.logger = new Logger('AICodeWriter');
    
    // Initialize global MongoDB logger
    try {
      this.globalLogger = initializeGlobalLogger();
      this.logger.info('Global MongoDB logger initialized');
    } catch (error) {
      this.logger.warn('Global MongoDB logger initialization failed:', error.message);
    }
    
    this.toolRegistry = new ToolRegistry();
    this.responseFormatter = new ResponseFormatter();
    
    // Initialize modules
    this.initializeModules();
    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => this.logger.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      this.logger.info('Shutting down AI Code Writer server...');
      await closeGlobalLogger();
      await this.server.close();
      process.exit(0);
    });
  }

  initializeModules() {
    this.logger.info('Initializing modules...');
    
    // Code Generation modules
    this.environmentManager = new EnvironmentManager();
    this.codeAnalyzer = new CodeAnalyzer();
    this.codeGenerator = new CodeGenerator();
    this.fileCreator = new FileCreator();
    this.serverValidator = new ServerValidator();

    // Orchestration modules
    this.problemAnalyzer = new ProblemAnalyzer();
    this.solutionPlanner = new SolutionPlanner();
    this.solutionExecutor = new SolutionExecutor();

    // File Operations modules
    this.fileOperations = new FileOperations();
    this.directoryManager = new DirectoryManager();

    // MCP Communication modules
    this.mcpDiscovery = new McpDiscovery();
    this.toolChainer = new ToolChainer();
    this.mcpCommunicator = new McpCommunicator();

    // Task Execution modules
    this.parallelExecutor = new ParallelExecutor();

    // AI Conversation modules
    this.conversationManager = new ConversationManager();

    // Database modules
    this.vectorDatabase = new VectorDatabase();
    this.embeddingsToolkit = new EmbeddingsToolkit();
    
    // Database Monitoring modules
    this.databaseMonitor = new DatabaseMonitorTools();

    this.logger.info('All modules initialized successfully');
  }

  setupToolHandlers() {
    // Register tools from all modules
    this.toolRegistry.registerModule('environment', this.environmentManager);
    this.toolRegistry.registerModule('codeAnalysis', this.codeAnalyzer);
    this.toolRegistry.registerModule('codeGeneration', this.codeGenerator);
    this.toolRegistry.registerModule('fileCreation', this.fileCreator);
    this.toolRegistry.registerModule('validation', this.serverValidator);
    this.toolRegistry.registerModule('problemAnalysis', this.problemAnalyzer);
    this.toolRegistry.registerModule('solutionPlanning', this.solutionPlanner);
    this.toolRegistry.registerModule('solutionExecution', this.solutionExecutor);
    this.toolRegistry.registerModule('fileOperations', this.fileOperations);
    this.toolRegistry.registerModule('directoryManagement', this.directoryManager);
    this.toolRegistry.registerModule('mcpDiscovery', this.mcpDiscovery);
    this.toolRegistry.registerModule('toolChaining', this.toolChainer);
    this.toolRegistry.registerModule('mcpCommunication', this.mcpCommunicator);
    this.toolRegistry.registerModule('parallelExecution', this.parallelExecutor);
    this.toolRegistry.registerModule('conversation', this.conversationManager);
    this.toolRegistry.registerModule('vectorDatabase', this.vectorDatabase);
    this.toolRegistry.registerModule('embeddings', this.embeddingsToolkit);
    this.toolRegistry.registerModule('databaseMonitor', this.databaseMonitor);

    // Set up MCP handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.toolRegistry.getAllTools()
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        this.logger.info(`Executing tool: ${name}`);
        const result = await this.toolRegistry.executeTool(name, args);
        this.logger.info(`Tool ${name} completed successfully`);
        
        // Tool registry now handles all formatting, return result directly
        return result;
      } catch (error) {
        this.logger.error(`Tool ${name} failed:`, error.message);
        
        // Return a properly formatted error response
        return this.responseFormatter.createErrorResponse(`Tool execution failed: ${error.message}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('AI Code Writer Orchestrator running on stdio');
  }
}

const server = new AICodeWriterServer();
server.run().catch(console.error);

