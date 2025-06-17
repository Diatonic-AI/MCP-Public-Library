#!/usr/bin/env node

/**
 * AI Code Writing MCP Server
 * Receives technical specifications and generates complete MCP servers using Gemini AI
 * Reviews existing servers for reference formatting and structure
 */

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AICodeWriterServer {
  constructor() {
    this.server = new Server(
      {
        name: 'ai-code-writer-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Initialize Gemini AI
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'load_environment',
          description: 'Load environment variables from .env file and initialize AI services',
          inputSchema: {
            type: 'object',
            properties: {
              env_file_path: {
                type: 'string',
                description: 'Path to .env file',
                default: './.env'
              }
            },
            required: []
          }
        },
        {
          name: 'analyze_existing_servers',
          description: 'Analyze existing MCP servers for reference patterns and structure',
          inputSchema: {
            type: 'object',
            properties: {
              reference_directories: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of directories containing reference MCP servers'
              },
              analysis_focus: {
                type: 'string',
                description: 'Specific aspects to analyze (structure, tools, config, etc.)',
                default: 'all'
              }
            },
            required: ['reference_directories']
          }
        },
        {
          name: 'generate_code_context',
          description: 'Generate comprehensive context for AI code generation',
          inputSchema: {
            type: 'object',
            properties: {
              technical_spec: {
                type: 'string',
                description: 'Technical specification of what needs to be created'
              },
              target_directory: {
                type: 'string',
                description: 'Target directory for the new server'
              },
              reference_analysis: {
                type: 'object',
                description: 'Analysis results from existing servers'
              },
              additional_requirements: {
                type: 'array',
                items: { type: 'string' },
                description: 'Additional specific requirements'
              }
            },
            required: ['technical_spec', 'target_directory']
          }
        },
        {
          name: 'generate_server_code',
          description: 'Generate complete MCP server code using Gemini AI',
          inputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                description: 'Generated context for code creation'
              },
              code_type: {
                type: 'string',
                enum: ['main_server', 'config_file', 'package_json', 'readme'],
                description: 'Type of code to generate'
              },
              custom_prompt_additions: {
                type: 'string',
                description: 'Additional prompt instructions for AI'
              }
            },
            required: ['context', 'code_type']
          }
        },
        {
          name: 'create_server_files',
          description: 'Create all necessary files for the MCP server',
          inputSchema: {
            type: 'object',
            properties: {
              target_directory: {
                type: 'string',
                description: 'Target directory for the new server'
              },
              generated_code: {
                type: 'object',
                properties: {
                  main_server: { type: 'string' },
                  config_file: { type: 'string' },
                  package_json: { type: 'string' },
                  readme: { type: 'string' }
                },
                description: 'Generated code for different file types'
              },
              server_name: {
                type: 'string',
                description: 'Name of the server (for file naming)'
              }
            },
            required: ['target_directory', 'generated_code', 'server_name']
          }
        },
        {
          name: 'validate_generated_server',
          description: 'Validate the generated server structure and syntax',
          inputSchema: {
            type: 'object',
            properties: {
              server_directory: {
                type: 'string',
                description: 'Directory containing the generated server'
              },
              validation_level: {
                type: 'string',
                enum: ['basic', 'comprehensive'],
                default: 'basic',
                description: 'Level of validation to perform'
              }
            },
            required: ['server_directory']
          }
        },
        {
          name: 'generate_completion_summary',
          description: 'Generate summary of what was completed for the client agent',
          inputSchema: {
            type: 'object',
            properties: {
              project_details: {
                type: 'object',
                description: 'Details about the completed project'
              },
              files_created: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of files that were created'
              },
              validation_results: {
                type: 'object',
                description: 'Results from server validation'
              },
              next_steps: {
                type: 'array',
                items: { type: 'string' },
                description: 'Suggested next steps'
              }
            },
            required: ['project_details', 'files_created']
          }
        },
        // === ORCHESTRATION & PROBLEM SOLVING TOOLS ===
        {
          name: 'analyze_problem',
          description: 'AI-powered problem analysis and solution generation',
          inputSchema: {
            type: 'object',
            properties: {
              problem_description: {
                type: 'string',
                description: 'Description of the problem to analyze'
              },
              context: {
                type: 'object',
                description: 'Additional context about the problem'
              },
              analysis_depth: {
                type: 'string',
                enum: ['quick', 'detailed', 'comprehensive'],
                default: 'detailed',
                description: 'Level of analysis to perform'
              }
            },
            required: ['problem_description']
          }
        },
        {
          name: 'generate_solution_plan',
          description: 'Create detailed solution plan with steps and tool chains',
          inputSchema: {
            type: 'object',
            properties: {
              problem_analysis: {
                type: 'object',
                description: 'Results from problem analysis'
              },
              available_tools: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of available MCP tools'
              },
              constraints: {
                type: 'object',
                description: 'Any constraints or limitations'
              }
            },
            required: ['problem_analysis']
          }
        },
        {
          name: 'execute_solution_plan',
          description: 'Execute solution plan with parallel task coordination',
          inputSchema: {
            type: 'object',
            properties: {
              solution_plan: {
                type: 'object',
                description: 'Solution plan to execute'
              },
              execution_mode: {
                type: 'string',
                enum: ['sequential', 'parallel', 'adaptive'],
                default: 'adaptive',
                description: 'How to execute the plan'
              },
              monitoring_enabled: {
                type: 'boolean',
                default: true,
                description: 'Enable real-time monitoring'
              }
            },
            required: ['solution_plan']
          }
        },
        // === FILE & DIRECTORY OPERATIONS ===
        {
          name: 'advanced_file_operations',
          description: 'Comprehensive file and directory operations',
          inputSchema: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                enum: ['create', 'read', 'update', 'delete', 'copy', 'move', 'search', 'analyze'],
                description: 'Type of file operation'
              },
              target_path: {
                type: 'string',
                description: 'Path to target file or directory'
              },
              content: {
                type: 'string',
                description: 'Content for create/update operations'
              },
              options: {
                type: 'object',
                description: 'Additional options for the operation'
              }
            },
            required: ['operation', 'target_path']
          }
        },
        {
          name: 'directory_structure_manager',
          description: 'Create and manage complex directory structures',
          inputSchema: {
            type: 'object',
            properties: {
              base_path: {
                type: 'string',
                description: 'Base directory path'
              },
              structure_definition: {
                type: 'object',
                description: 'Hierarchical structure definition'
              },
              template_files: {
                type: 'object',
                description: 'Template files to create in directories'
              },
              permissions: {
                type: 'object',
                description: 'Directory and file permissions'
              }
            },
            required: ['base_path', 'structure_definition']
          }
        },
        // === MCP TOOL CHAINING & COMMUNICATION ===
        {
          name: 'discover_mcp_tools',
          description: 'Discover and catalog available MCP tools across servers',
          inputSchema: {
            type: 'object',
            properties: {
              server_directories: {
                type: 'array',
                items: { type: 'string' },
                description: 'Directories containing MCP servers'
              },
              include_configs: {
                type: 'boolean',
                default: true,
                description: 'Include configuration analysis'
              }
            },
            required: ['server_directories']
          }
        },
        {
          name: 'chain_mcp_tools',
          description: 'Chain multiple MCP tools for complex workflows',
          inputSchema: {
            type: 'object',
            properties: {
              workflow_definition: {
                type: 'object',
                description: 'Definition of the tool chain workflow'
              },
              input_data: {
                type: 'object',
                description: 'Initial input data for the chain'
              },
              error_handling: {
                type: 'string',
                enum: ['stop', 'skip', 'retry', 'alternative'],
                default: 'retry',
                description: 'How to handle errors in the chain'
              }
            },
            required: ['workflow_definition']
          }
        },
        {
          name: 'communicate_with_mcp_server',
          description: 'Direct communication with other MCP servers',
          inputSchema: {
            type: 'object',
            properties: {
              server_name: {
                type: 'string',
                description: 'Name of the target MCP server'
              },
              tool_name: {
                type: 'string',
                description: 'Name of the tool to call'
              },
              parameters: {
                type: 'object',
                description: 'Parameters to pass to the tool'
              },
              timeout: {
                type: 'number',
                default: 30000,
                description: 'Timeout in milliseconds'
              }
            },
            required: ['server_name', 'tool_name']
          }
        },
        // === PARALLEL TASK EXECUTION ===
        {
          name: 'parallel_task_executor',
          description: 'Execute multiple tasks in parallel with coordination',
          inputSchema: {
            type: 'object',
            properties: {
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    parameters: { type: 'object' },
                    dependencies: { type: 'array', items: { type: 'string' } }
                  }
                },
                description: 'Array of tasks to execute'
              },
              max_concurrent: {
                type: 'number',
                default: 5,
                description: 'Maximum number of concurrent tasks'
              },
              dependency_resolution: {
                type: 'boolean',
                default: true,
                description: 'Automatically resolve task dependencies'
              }
            },
            required: ['tasks']
          }
        },
        // === SELF-CONVERSATIONAL AI ===
        {
          name: 'ai_conversation_manager',
          description: 'Manage self-conversational problem solving with Gemini',
          inputSchema: {
            type: 'object',
            properties: {
              conversation_type: {
                type: 'string',
                enum: ['problem_solving', 'creative_thinking', 'analysis', 'planning'],
                description: 'Type of AI conversation'
              },
              context: {
                type: 'object',
                description: 'Context for the conversation'
              },
              max_iterations: {
                type: 'number',
                default: 10,
                description: 'Maximum conversation iterations'
              },
              goals: {
                type: 'array',
                items: { type: 'string' },
                description: 'Goals for the conversation'
              }
            },
            required: ['conversation_type', 'context']
          }
        },
        // === SYSTEM MONITORING & DIAGNOSTICS ===
        {
          name: 'system_diagnostics',
          description: 'Comprehensive system and MCP server diagnostics',
          inputSchema: {
            type: 'object',
            properties: {
              diagnostic_type: {
                type: 'string',
                enum: ['health_check', 'performance', 'connectivity', 'comprehensive'],
                default: 'health_check',
                description: 'Type of diagnostic to run'
              },
              target_servers: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific servers to diagnose'
              }
            },
            required: []
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'load_environment':
          return await this.loadEnvironment(request.params.arguments);
        case 'analyze_existing_servers':
          return await this.analyzeExistingServers(request.params.arguments);
        case 'generate_code_context':
          return await this.generateCodeContext(request.params.arguments);
        case 'generate_server_code':
          return await this.generateServerCode(request.params.arguments);
        case 'create_server_files':
          return await this.createServerFiles(request.params.arguments);
        case 'validate_generated_server':
          return await this.validateGeneratedServer(request.params.arguments);
        case 'generate_completion_summary':
          return await this.generateCompletionSummary(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async loadEnvironment(args) {
    try {
      const { env_file_path = './.env' } = args;
      
      // Force reload environment variables
      const envPath = path.resolve(env_file_path);
      
      try {
        await fs.access(envPath);
        require('dotenv').config({ path: envPath, override: true });
        
        // Reinitialize Gemini AI with new environment
        if (process.env.GEMINI_API_KEY) {
          this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              env_file_loaded: envPath,
              gemini_api_configured: !!process.env.GEMINI_API_KEY,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Could not load .env file from ${envPath}: ${error.message}`,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
    } catch (error) {
      throw new Error(`Environment loading failed: ${error.message}`);
    }
  }

  async analyzeExistingServers(args) {
    try {
      const { reference_directories, analysis_focus = 'all' } = args;
      const analysis = {
        structure_patterns: [],
        tool_patterns: [],
        config_patterns: [],
        dependency_patterns: [],
        environment_variables: [],
        common_imports: [],
        error_handling_patterns: []
      };

      for (const dir of reference_directories) {
        const serverPath = path.resolve(dir);
        
        try {
          const files = await fs.readdir(serverPath);
          
          for (const file of files) {
            const filePath = path.join(serverPath, file);
            const stat = await fs.stat(filePath);
            
            if (stat.isFile() && file.endsWith('.js')) {
              const content = await fs.readFile(filePath, 'utf8');
              await this.analyzeServerFile(content, file, analysis);
            } else if (stat.isFile() && file.endsWith('.json')) {
              const content = await fs.readFile(filePath, 'utf8');
              await this.analyzeConfigFile(content, file, analysis);
            }
          }
        } catch (error) {
          console.warn(`Could not analyze directory ${dir}: ${error.message}`);
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(analysis, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  async analyzeServerFile(content, filename, analysis) {
    // Extract imports
    const importMatches = content.match(/(?:const|import).*?require\(['"]([^'"]+)['"]\)|import.*?from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      importMatches.forEach(match => {
        const moduleMatch = match.match(/['"]([^'"]+)['"]/g);
        if (moduleMatch) {
          analysis.common_imports.push(...moduleMatch.map(m => m.replace(/['"`]/g, '')));
        }
      });
    }

    // Extract tool definitions
    const toolMatches = content.match(/name:\s*['"]([^'"]+)['"],?\s*description:\s*['"]([^'"]*)['"],?/g);
    if (toolMatches) {
      toolMatches.forEach(match => {
        const nameMatch = match.match(/name:\s*['"]([^'"]+)['"]/);        const descMatch = match.match(/description:\s*['"]([^'"]*)['"]/);
        if (nameMatch && descMatch) {
          analysis.tool_patterns.push({
            name: nameMatch[1],
            description: descMatch[1],
            source_file: filename
          });
        }
      });
    }

    // Extract environment variable usage
    const envMatches = content.match(/process\.env\.[A-Z_]+/g);
    if (envMatches) {
      analysis.environment_variables.push(...envMatches.map(match => match.replace('process.env.', '')));
    }

    // Extract error handling patterns
    const errorMatches = content.match(/catch\s*\([^)]*\)\s*{[^}]*}/g);
    if (errorMatches) {
      analysis.error_handling_patterns.push(...errorMatches);
    }

    // Extract class/server structure patterns
    const classMatches = content.match(/class\s+\w+\s*{[^}]*constructor[^}]*}/g);
    if (classMatches) {
      analysis.structure_patterns.push(...classMatches);
    }
  }

  async analyzeConfigFile(content, filename, analysis) {
    try {
      const config = JSON.parse(content);
      analysis.config_patterns.push({
        filename,
        structure: Object.keys(config),
        sample: config
      });

      if (config.dependencies) {
        analysis.dependency_patterns.push(...Object.keys(config.dependencies));
      }
      if (config.devDependencies) {
        analysis.dependency_patterns.push(...Object.keys(config.devDependencies));
      }
    } catch (error) {
      // Not a valid JSON file
    }
  }

  async generateCodeContext(args) {
    try {
      const { technical_spec, target_directory, reference_analysis, additional_requirements = [] } = args;
      
      const context = {
        specification: technical_spec,
        target: {
          directory: target_directory,
          server_name: path.basename(target_directory)
        },
        reference_patterns: reference_analysis || {},
        requirements: additional_requirements,
        generated_at: new Date().toISOString(),
        ai_instructions: {
          style: 'Follow MCP server patterns found in reference analysis',
          structure: 'Use standard MCP server structure with proper error handling',
          dependencies: 'Include necessary dependencies based on functionality',
          config: 'Generate appropriate configuration files',
          documentation: 'Include comprehensive documentation'
        }
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(context, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Context generation failed: ${error.message}`);
    }
  }

  async generateServerCode(args) {
    try {
      const { context, code_type, custom_prompt_additions = '' } = args;
      
      if (!this.genAI || !process.env.GEMINI_API_KEY) {
        throw new Error('Gemini AI not configured. Please set GEMINI_API_KEY environment variable.');
      }

      const prompts = {
        main_server: this.buildMainServerPrompt(context, custom_prompt_additions),
        config_file: this.buildConfigPrompt(context, custom_prompt_additions),
        package_json: this.buildPackageJsonPrompt(context, custom_prompt_additions),
        readme: this.buildReadmePrompt(context, custom_prompt_additions)
      };

      const prompt = prompts[code_type];
      if (!prompt) {
        throw new Error(`Unknown code type: ${code_type}`);
      }

      const result = await this.model.generateContent(prompt);
      const generatedCode = result.response.text();

      return {
        content: [{
          type: 'text',
          text: generatedCode
        }]
      };
    } catch (error) {
      throw new Error(`Code generation failed: ${error.message}`);
    }
  }

  buildMainServerPrompt(context, additions) {
    return `
Create a complete MCP server implementation based on the following specification:

TECHNICAL SPECIFICATION:
${context.specification}

TARGET SERVER NAME: ${context.target.server_name}

REFERENCE PATTERNS (use these as examples):
${JSON.stringify(context.reference_patterns, null, 2)}

REQUIREMENTS:
${context.requirements.map(req => `- ${req}`).join('\n')}

ADDITIONAL INSTRUCTIONS:
${additions}

Please generate a complete MCP server .js file that:
1. Follows the MCP server patterns shown in the reference analysis
2. Implements all required tools based on the specification
3. Includes proper error handling and validation
4. Uses appropriate dependencies and imports
5. Follows JavaScript best practices
6. Includes comprehensive JSDoc comments
7. Handles environment variables properly
8. Implements proper tool schemas with validation

Return ONLY the JavaScript code, no explanation or markdown formatting.
`;
  }

  buildConfigPrompt(context, additions) {
    return `
Create a configuration JSON file for the MCP server: ${context.target.server_name}

Based on specification: ${context.specification}

Reference config patterns:
${JSON.stringify(context.reference_patterns.config_patterns, null, 2)}

Generate a complete configuration file that includes:
1. Server metadata (name, version, description)
2. Tool configurations
3. Environment variable mappings
4. Default settings
5. Capability definitions

Return ONLY the JSON configuration, no explanation.
`;
  }

  buildPackageJsonPrompt(context, additions) {
    return `
Create a package.json file for the MCP server: ${context.target.server_name}

Based on specification: ${context.specification}

Reference dependency patterns:
${JSON.stringify(context.reference_patterns.dependency_patterns, null, 2)}

Generate a complete package.json that includes:
1. Proper metadata (name, version, description)
2. All necessary dependencies
3. Scripts for running the server
4. Proper entry point
5. Keywords and repository information

Return ONLY the JSON package file, no explanation.
`;
  }

  buildReadmePrompt(context, additions) {
    return `
Create a comprehensive README.md file for the MCP server: ${context.target.server_name}

Based on specification: ${context.specification}

Generate a complete README that includes:
1. Server description and purpose
2. Installation instructions
3. Configuration setup
4. Available tools and their usage
5. Environment variables needed
6. Examples of how to use each tool
7. Troubleshooting section
8. Contributing guidelines

Return ONLY the markdown content, no code blocks or explanations.
`;
  }

  async createServerFiles(args) {
    try {
      const { target_directory, generated_code, server_name } = args;
      
      // Ensure target directory exists
      await fs.mkdir(target_directory, { recursive: true });
      
      const createdFiles = [];
      
      // Create main server file
      if (generated_code.main_server) {
        const serverPath = path.join(target_directory, `${server_name}-server.js`);
        await fs.writeFile(serverPath, generated_code.main_server, 'utf8');
        createdFiles.push(serverPath);
      }
      
      // Create config file
      if (generated_code.config_file) {
        const configPath = path.join(target_directory, `${server_name}-config.json`);
        await fs.writeFile(configPath, generated_code.config_file, 'utf8');
        createdFiles.push(configPath);
      }
      
      // Create package.json
      if (generated_code.package_json) {
        const packagePath = path.join(target_directory, 'package.json');
        await fs.writeFile(packagePath, generated_code.package_json, 'utf8');
        createdFiles.push(packagePath);
      }
      
      // Create README.md
      if (generated_code.readme) {
        const readmePath = path.join(target_directory, 'README.md');
        await fs.writeFile(readmePath, generated_code.readme, 'utf8');
        createdFiles.push(readmePath);
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            created_files: createdFiles,
            target_directory,
            server_name
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`File creation failed: ${error.message}`);
    }
  }

  async validateGeneratedServer(args) {
    try {
      const { server_directory, validation_level = 'basic' } = args;
      
      const validation = {
        syntax_check: { passed: false, issues: [] },
        structure_check: { passed: false, issues: [] },
        dependency_check: { passed: false, issues: [] },
        config_check: { passed: false, issues: [] }
      };
      
      // Check if directory exists
      const dirExists = await fs.access(server_directory).then(() => true).catch(() => false);
      if (!dirExists) {
        throw new Error(`Server directory does not exist: ${server_directory}`);
      }
      
      const files = await fs.readdir(server_directory);
      
      // Basic syntax validation
      const jsFiles = files.filter(f => f.endsWith('.js'));
      for (const jsFile of jsFiles) {
        const filePath = path.join(server_directory, jsFile);
        const content = await fs.readFile(filePath, 'utf8');
        
        try {
          // Basic syntax check (this is simplified)
          if (content.includes('require(') && content.includes('exports')) {
            validation.syntax_check.passed = true;
          } else {
            validation.syntax_check.issues.push(`${jsFile}: Missing required structure`);
          }
        } catch (error) {
          validation.syntax_check.issues.push(`${jsFile}: ${error.message}`);
        }
      }
      
      // Check for required files
      const requiredFiles = ['.js', 'package.json'];
      const hasRequired = requiredFiles.every(ext => 
        files.some(f => f.endsWith(ext))
      );
      
      if (hasRequired) {
        validation.structure_check.passed = true;
      } else {
        validation.structure_check.issues.push('Missing required files');
      }
      
      // Check package.json dependencies
      const packageJsonPath = path.join(server_directory, 'package.json');
      try {
        const packageContent = await fs.readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageContent);
        
        if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) {
          validation.dependency_check.passed = true;
        } else {
          validation.dependency_check.issues.push('No dependencies defined');
        }
      } catch (error) {
        validation.dependency_check.issues.push(`Package.json error: ${error.message}`);
      }
      
      // Check for config files
      const configFiles = files.filter(f => f.includes('config') && f.endsWith('.json'));
      if (configFiles.length > 0) {
        validation.config_check.passed = true;
      } else {
        validation.config_check.issues.push('No configuration files found');
      }
      
      const overallPassed = Object.values(validation).every(check => check.passed);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            overall_passed: overallPassed,
            validation_details: validation,
            validation_level,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  async generateCompletionSummary(args) {
    try {
      const { project_details, files_created, validation_results, next_steps = [] } = args;
      
      const summary = {
        completion_status: 'SUCCESS',
        project_summary: {
          name: project_details.name || 'MCP Server',
          description: project_details.description || 'Generated MCP Server',
          target_directory: project_details.target_directory,
          completion_time: new Date().toISOString()
        },
        deliverables: {
          files_created: files_created.length,
          file_list: files_created,
          total_size: 0 // Could calculate if needed
        },
        validation_summary: validation_results ? {
          passed: validation_results.overall_passed,
          issues_count: validation_results.validation_details ? 
            Object.values(validation_results.validation_details)
              .reduce((count, check) => count + check.issues.length, 0) : 0
        } : null,
        recommendations: [
          'Test the generated server with the test-tools.js script',
          'Install dependencies with npm install',
          'Configure environment variables as needed',
          'Add the server to your MCP configuration',
          ...next_steps
        ],
        usage_instructions: {
          installation: `cd ${project_details.target_directory} && npm install`,
          testing: 'node ../test-tools.js --server-name ' + (project_details.name || 'new-server'),
          configuration: 'Add server configuration to your MCP client setup'
        }
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(summary, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Summary generation failed: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AI Code Writer MCP server running on stdio');
  }
}

const server = new AICodeWriterServer();
server.run().catch(console.error);

