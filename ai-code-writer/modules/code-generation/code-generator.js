/**
 * Code Generator Module
 * AI-powered comprehensive code generation using Gemini
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const Logger = require('../../utils/logger');

class CodeGenerator {
  constructor() {
    this.logger = new Logger('CodeGenerator');
    this.genAI = null;
    this.model = null;
    this.initializeAI();
  }

  initializeAI() {
    if (process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    }
  }

  getTools() {
    return [
      {
        name: 'generate_code_context',
        description: 'Generate comprehensive context for AI code generation',
        inputSchema: {
          type: 'object',
          properties: {
            technical_spec: { 
              type: 'string', 
              description: 'Technical specification or problem description' 
            },
            target_directory: { 
              type: 'string', 
              description: 'Target directory for generated code' 
            },
            additional_requirements: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Additional requirements and constraints'
            },
            solution_plan: {
              type: 'object',
              description: 'Solution plan from solution planner'
            },
            target_platform: {
              type: 'string',
              default: 'node.js',
              description: 'Target platform/framework'
            },
            architecture_type: {
              type: 'string',
              default: 'mcp-server',
              enum: ['mcp-server', 'api-server', 'cli-tool', 'library', 'web-app'],
              description: 'Type of application architecture'
            }
          },
          required: ['technical_spec', 'target_directory']
        }
      },
      {
        name: 'generate_server_code',
        description: 'Generate complete production-ready code using Gemini AI',
        inputSchema: {
          type: 'object',
          properties: {
            context: { 
              type: 'object', 
              description: 'Generated context from generate_code_context' 
            },
            code_type: { 
              type: 'string', 
              enum: ['main_server', 'config_file', 'package_json', 'readme', 'tests', 'utils', 'complete_project'],
              description: 'Type of code to generate'
            },
            custom_prompt_additions: { 
              type: 'string', 
              description: 'Additional custom instructions' 
            },
            quality_level: {
              type: 'string',
              enum: ['basic', 'production', 'enterprise'],
              default: 'production',
              description: 'Quality level of generated code'
            }
          },
          required: ['context', 'code_type']
        }
      }
    ];
  }

  async generateCodeContext(args) {
    try {
      const { 
        technical_spec, 
        target_directory, 
        additional_requirements = [],
        solution_plan,
        target_platform = 'node.js',
        architecture_type = 'mcp-server'
      } = args;
      
      this.logger.info('Generating comprehensive code context...');
      
      const serverName = this.generateServerName(target_directory, technical_spec);
      const analysisData = await this.analyzeRequirements(technical_spec, additional_requirements, solution_plan);
      const architecturalSpec = this.generateArchitecturalSpec(architecture_type, analysisData);
      const technologyStack = this.selectTechnologyStack(target_platform, architecturalSpec, solution_plan);
      const projectStructure = this.designProjectStructure(architecture_type, serverName, technologyStack);
      const apiSpec = await this.generateAPISpecification(technical_spec, architecturalSpec);
      
      const comprehensiveContext = {
        // Basic Information
        specification: technical_spec,
        target: {
          directory: target_directory,
          server_name: serverName,
          platform: target_platform,
          architecture: architecture_type
        },
        requirements: {
          functional: additional_requirements,
          non_functional: this.extractNonFunctionalRequirements(technical_spec),
          constraints: this.extractConstraints(technical_spec, solution_plan)
        },
        
        // Technical Specifications
        analysis: analysisData,
        architecture: architecturalSpec,
        technology_stack: technologyStack,
        project_structure: projectStructure,
        api_specification: apiSpec,
        
        // Implementation Details
        implementation_strategy: this.defineImplementationStrategy(architecturalSpec, solution_plan),
        code_patterns: this.selectCodePatterns(architecture_type, technologyStack),
        error_handling_strategy: this.designErrorHandling(architecturalSpec),
        testing_strategy: this.designTestingStrategy(architecturalSpec, technologyStack),
        security_considerations: this.defineSecurityRequirements(architecturalSpec),
        performance_requirements: this.definePerformanceRequirements(technical_spec),
        
        // Quality & Standards
        coding_standards: this.defineCodingStandards(target_platform),
        documentation_requirements: this.defineDocumentationRequirements(),
        deployment_considerations: this.defineDeploymentStrategy(architecture_type),
        
        // Metadata
        generated_at: new Date().toISOString(),
        context_version: '2.0',
        generation_config: {
          ai_model: 'gemini-1.5-pro',
          quality_level: 'production',
          include_tests: true,
          include_documentation: true
        }
      };

      this.logger.info('Code context generated successfully');
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify(comprehensiveContext, null, 2) 
        }]
      };
    } catch (error) {
      this.logger.error('Code context generation failed:', error.message);
      return this.generateFallbackContext(args);
    }
  }

  async generateServerCode(args) {
    try {
      const { 
        context, 
        code_type, 
        custom_prompt_additions = '',
        quality_level = 'production'
      } = args;
      
      this.logger.info(`Generating ${code_type} with ${quality_level} quality...`);
      
      if (!this.model) {
        this.logger.warn('AI model not available, using template generation');
        return this.generateCodeTemplate(context, code_type, quality_level);
      }
      
      let generatedCode;
      
      switch (code_type) {
        case 'complete_project':
          generatedCode = await this.generateCompleteProject(context, quality_level, custom_prompt_additions);
          break;
        case 'main_server':
          generatedCode = await this.generateMainServer(context, quality_level, custom_prompt_additions);
          break;
        case 'package_json':
          generatedCode = await this.generatePackageJson(context, quality_level);
          break;
        case 'config_file':
          generatedCode = await this.generateConfigFile(context, quality_level);
          break;
        case 'tests':
          generatedCode = await this.generateTestSuite(context, quality_level);
          break;
        case 'utils':
          generatedCode = await this.generateUtilities(context, quality_level);
          break;
        case 'readme':
          generatedCode = await this.generateReadme(context, quality_level);
          break;
        default:
          throw new Error(`Unknown code type: ${code_type}`);
      }
      
      return {
        content: [{
          type: 'text',
          text: typeof generatedCode === 'string' ? generatedCode : JSON.stringify(generatedCode, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error(`Code generation failed for ${args.code_type}:`, error.message);
      return this.generateCodeTemplate(args.context, args.code_type, args.quality_level || 'basic');
    }
  }

  // AI-Powered Generation Methods
  async generateCompleteProject(context, quality_level, customPrompt) {
    const prompt = this.buildCompleteProjectPrompt(context, quality_level, customPrompt);
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    
    return this.parseCompleteProjectResponse(response.text(), context);
  }

  async generateMainServer(context, quality_level, customPrompt) {
    const prompt = this.buildMainServerPrompt(context, quality_level, customPrompt);
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    
    return this.cleanCodeResponse(response.text());
  }

  async generatePackageJson(context, quality_level) {
    const prompt = this.buildPackageJsonPrompt(context, quality_level);
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    
    return this.parseJsonResponse(response.text());
  }

  async generateConfigFile(context, quality_level) {
    const prompt = this.buildConfigFilePrompt(context, quality_level);
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    
    return this.parseJsonResponse(response.text());
  }

  async generateTestSuite(context, quality_level) {
    const prompt = this.buildTestSuitePrompt(context, quality_level);
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    
    return this.cleanCodeResponse(response.text());
  }

  async generateUtilities(context, quality_level) {
    const prompt = this.buildUtilitiesPrompt(context, quality_level);
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    
    return this.cleanCodeResponse(response.text());
  }

  async generateReadme(context, quality_level) {
    const prompt = this.buildReadmePrompt(context, quality_level);
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    
    return response.text();
  }

  // Prompt Building Methods
  buildCompleteProjectPrompt(context, quality_level, customPrompt) {
    return `
You are an expert software engineer. Generate a complete, production-ready project based on the following specification.

PROJECT SPECIFICATION:
${context.specification}

ARCHITECTURE TYPE: ${context.target.architecture}
PLATFORM: ${context.target.platform}
SERVER NAME: ${context.target.server_name}
QUALITY LEVEL: ${quality_level}

TECHNOLOGY STACK:
${JSON.stringify(context.technology_stack, null, 2)}

PROJECT STRUCTURE:
${JSON.stringify(context.project_structure, null, 2)}

API SPECIFICATION:
${JSON.stringify(context.api_specification, null, 2)}

REQUIREMENTS:
- Functional: ${context.requirements.functional.join(', ')}
- Non-functional: ${context.requirements.non_functional.join(', ')}
- Constraints: ${context.requirements.constraints.join(', ')}

CODING STANDARDS:
${JSON.stringify(context.coding_standards, null, 2)}

CUSTOM INSTRUCTIONS:
${customPrompt}

Generate a complete project with:
1. Main server file (${context.target.server_name}-server.js)
2. Package.json with all dependencies
3. Configuration files
4. Utility modules
5. Test suite
6. README documentation
7. Additional supporting files

IMPORTANT:
- Use modern ${context.target.platform} best practices
- Include comprehensive error handling
- Add detailed comments and documentation
- Implement proper logging
- Include input validation
- Follow security best practices
- Make code production-ready

Return the response as a JSON object with this structure:
{
  "files": {
    "filename.js": "file content",
    "package.json": "json content",
    "README.md": "markdown content",
    ...
  },
  "instructions": "Setup and deployment instructions",
  "notes": "Important notes about the implementation"
}
`;
  }

  buildMainServerPrompt(context, quality_level, customPrompt) {
    return `
Generate a production-ready main server file for a ${context.target.architecture} application.

SPECIFICATION: ${context.specification}
SERVER NAME: ${context.target.server_name}
PLATFORM: ${context.target.platform}
QUALITY LEVEL: ${quality_level}

TECHNOLOGY STACK: ${context.technology_stack.core.join(', ')}
ARCHITECTURE PATTERN: ${context.architecture.pattern}

API ENDPOINTS:
${JSON.stringify(context.api_specification.endpoints, null, 2)}

ERROR HANDLING STRATEGY:
${JSON.stringify(context.error_handling_strategy, null, 2)}

CUSTOM REQUIREMENTS:
${customPrompt}

Generate a complete, well-documented server file that includes:
- Modern ES6+ JavaScript
- Comprehensive error handling
- Input validation
- Logging with appropriate levels
- Security considerations
- Performance optimizations
- Clear code structure and comments
- MCP protocol compliance (if applicable)

Return ONLY the JavaScript code, no explanations.
`;
  }

  buildPackageJsonPrompt(context, quality_level) {
    return `
Generate a complete package.json for a ${context.target.architecture} project.

PROJECT: ${context.target.server_name}
DESCRIPTION: ${context.specification}
PLATFORM: ${context.target.platform}

TECHNOLOGY STACK:
${JSON.stringify(context.technology_stack, null, 2)}

INCLUDE:
- All required dependencies
- Development dependencies for testing, linting, formatting
- Useful npm scripts
- Proper version constraints
- Engine requirements
- Keywords and metadata

Return ONLY the JSON content, properly formatted.
`;
  }

  buildConfigFilePrompt(context, quality_level) {
    return `
Generate comprehensive configuration files for a ${context.target.architecture} project.

PROJECT: ${context.target.server_name}
PLATFORM: ${context.target.platform}

REQUIRED CONFIGURATIONS:
- Environment variables
- Application settings
- Logging configuration
- Security settings
- Performance tuning

Return as JSON with configuration file names as keys and their content as values:
{
  ".env.example": "environment template",
  "config.json": "application config",
  ".eslintrc.js": "linting rules",
  "jest.config.js": "testing config"
}
`;
  }

  buildTestSuitePrompt(context, quality_level) {
    return `
Generate a comprehensive test suite for the ${context.target.server_name} project.

SPECIFICATION: ${context.specification}
TESTING FRAMEWORK: ${context.testing_strategy.framework || 'Jest'}
API ENDPOINTS:
${JSON.stringify(context.api_specification.endpoints, null, 2)}

Generate tests for:
- Unit tests for core functions
- Integration tests for API endpoints
- Error handling scenarios
- Edge cases and boundary conditions
- Mock data and fixtures

Include:
- Setup and teardown procedures
- Mock implementations
- Test data generators
- Comprehensive test coverage

Return the complete test file code.
`;
  }

  buildUtilitiesPrompt(context, quality_level) {
    return `
Generate utility modules for the ${context.target.server_name} project.

SPECIFICATION: ${context.specification}
ARCHITECTURE: ${context.architecture.pattern}

Generate utilities for:
- Logging and monitoring
- Input validation and sanitization
- Error handling and formatting
- Data transformation
- Helper functions
- Constants and enums

Make utilities:
- Reusable and modular
- Well-documented
- Type-safe (where applicable)
- Performance-optimized
- Easy to test

Return as code modules with clear separation of concerns.
`;
  }

  buildReadmePrompt(context, quality_level) {
    return `
Generate a comprehensive README.md for the ${context.target.server_name} project.

PROJECT DESCRIPTION: ${context.specification}
TECHNOLOGY STACK: ${context.technology_stack.core.join(', ')}
ARCHITECTURE: ${context.target.architecture}

Include sections for:
1. Project overview and purpose
2. Features and capabilities
3. Installation instructions
4. Configuration guide
5. Usage examples
6. API documentation
7. Testing instructions
8. Deployment guide
9. Contributing guidelines
10. License information

Make it:
- Clear and well-structured
- Include code examples
- Professional and comprehensive
- Easy to follow for new developers

Return as Markdown format.
`;
  }

  // Analysis and Design Methods
  async analyzeRequirements(technical_spec, additional_requirements, solution_plan) {
    return {
      complexity_score: this.calculateComplexityScore(technical_spec),
      estimated_components: this.estimateComponents(technical_spec),
      integration_points: this.identifyIntegrationPoints(technical_spec),
      data_flow: this.analyzeDataFlow(technical_spec),
      scalability_needs: this.assessScalabilityNeeds(technical_spec),
      performance_requirements: this.extractPerformanceNeeds(technical_spec)
    };
  }

  generateArchitecturalSpec(architecture_type, analysisData) {
    const patterns = {
      'mcp-server': {
        pattern: 'Event-driven MCP Protocol',
        components: ['server', 'tools', 'handlers', 'transport'],
        communication: 'JSON-RPC over stdio',
        scalability: 'Single process, multiple tools'
      },
      'api-server': {
        pattern: 'RESTful API with Express',
        components: ['routes', 'controllers', 'middleware', 'models'],
        communication: 'HTTP REST',
        scalability: 'Horizontal scaling with load balancer'
      },
      'cli-tool': {
        pattern: 'Command-line interface',
        components: ['commands', 'parsers', 'validators', 'output'],
        communication: 'CLI arguments and flags',
        scalability: 'Single instance per execution'
      }
    };
    
    return patterns[architecture_type] || patterns['api-server'];
  }

  selectTechnologyStack(platform, architecturalSpec, solution_plan) {
    const stacks = {
      'node.js': {
        core: ['Node.js', 'npm'],
        framework: this.selectFramework(architecturalSpec.pattern),
        testing: ['Jest', 'Supertest'],
        linting: ['ESLint', 'Prettier'],
        utilities: ['Winston', 'Joi', 'Lodash'],
        security: ['Helmet', 'bcrypt'],
        performance: ['compression', 'cors']
      }
    };
    
    const selectedStack = stacks[platform] || stacks['node.js'];
    
    // Add specific dependencies based on solution plan
    if (solution_plan?.optimal_solution?.technology_stack) {
      selectedStack.additional = solution_plan.optimal_solution.technology_stack;
    }
    
    return selectedStack;
  }

  selectFramework(pattern) {
    const frameworks = {
      'Event-driven MCP Protocol': ['@modelcontextprotocol/sdk'],
      'RESTful API with Express': ['Express.js', 'body-parser', 'cors'],
      'Command-line interface': ['Commander.js', 'Inquirer.js']
    };
    
    return frameworks[pattern] || ['Express.js'];
  }

  designProjectStructure(architecture_type, serverName, technologyStack) {
    const structures = {
      'mcp-server': {
        root: [
          `${serverName}-server.js`,
          'package.json',
          'README.md',
          '.env.example',
          '.gitignore'
        ],
        directories: {
          'src/': ['tools/', 'handlers/', 'utils/', 'config/'],
          'tests/': ['unit/', 'integration/', 'fixtures/'],
          'docs/': ['api.md', 'setup.md']
        }
      },
      'api-server': {
        root: [
          'server.js',
          'package.json',
          'README.md',
          '.env.example',
          '.gitignore'
        ],
        directories: {
          'src/': ['routes/', 'controllers/', 'middleware/', 'models/', 'utils/', 'config/'],
          'tests/': ['unit/', 'integration/', 'fixtures/'],
          'docs/': ['api.md', 'deployment.md']
        }
      }
    };
    
    return structures[architecture_type] || structures['api-server'];
  }

  async generateAPISpecification(technical_spec, architecturalSpec) {
    // Extract API requirements from technical specification
    const endpoints = this.extractEndpoints(technical_spec);
    const dataModels = this.extractDataModels(technical_spec);
    
    return {
      protocol: architecturalSpec.communication,
      version: '1.0.0',
      endpoints: endpoints,
      data_models: dataModels,
      authentication: this.determineAuth(technical_spec),
      rate_limiting: this.determineRateLimiting(technical_spec),
      error_codes: this.defineErrorCodes()
    };
  }

  // Helper Methods
  generateServerName(target_directory, technical_spec) {
    const baseName = path.basename(target_directory);
    if (baseName && baseName !== '.' && baseName !== '/') {
      return baseName;
    }
    
    // Generate name from technical spec
    const words = technical_spec.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3);
    
    return words.join('-') || 'custom-server';
  }

  extractNonFunctionalRequirements(technical_spec) {
    const nfrs = [];
    const spec = technical_spec.toLowerCase();
    
    if (spec.includes('performance') || spec.includes('fast') || spec.includes('speed')) {
      nfrs.push('High performance');
    }
    if (spec.includes('secure') || spec.includes('security')) {
      nfrs.push('Security compliance');
    }
    if (spec.includes('scale') || spec.includes('scalable')) {
      nfrs.push('Scalability');
    }
    if (spec.includes('reliable') || spec.includes('availability')) {
      nfrs.push('High availability');
    }
    
    return nfrs.length > 0 ? nfrs : ['Maintainability', 'Reliability'];
  }

  extractConstraints(technical_spec, solution_plan) {
    const constraints = [];
    
    if (solution_plan?.constraints) {
      Object.entries(solution_plan.constraints).forEach(([key, value]) => {
        constraints.push(`${key}: ${value}`);
      });
    }
    
    return constraints.length > 0 ? constraints : ['Development time constraints', 'Resource limitations'];
  }

  defineImplementationStrategy(architecturalSpec, solution_plan) {
    return {
      approach: solution_plan?.optimal_solution?.name || 'Iterative development',
      phases: [
        'Core functionality implementation',
        'API/interface development',
        'Error handling and validation',
        'Testing and optimization',
        'Documentation and deployment'
      ],
      methodology: 'Test-driven development with continuous integration'
    };
  }

  selectCodePatterns(architecture_type, technologyStack) {
    return {
      design_patterns: ['Module Pattern', 'Factory Pattern', 'Observer Pattern'],
      architectural_patterns: [this.getArchitecturalPattern(architecture_type)],
      coding_patterns: ['Error-first callbacks', 'Promise chains', 'Async/await'],
      testing_patterns: ['AAA Pattern', 'Mock objects', 'Test fixtures']
    };
  }

  getArchitecturalPattern(architecture_type) {
    const patterns = {
      'mcp-server': 'Event-driven architecture',
      'api-server': 'Layered architecture',
      'cli-tool': 'Command pattern',
      'library': 'Facade pattern'
    };
    
    return patterns[architecture_type] || 'Modular architecture';
  }

  designErrorHandling(architecturalSpec) {
    return {
      strategy: 'Centralized error handling with proper logging',
      error_types: ['ValidationError', 'BusinessLogicError', 'SystemError', 'NetworkError'],
      logging_levels: ['error', 'warn', 'info', 'debug'],
      recovery_mechanisms: ['Retry logic', 'Graceful degradation', 'Circuit breaker'],
      user_communication: 'Structured error responses with helpful messages'
    };
  }

  designTestingStrategy(architecturalSpec, technologyStack) {
    return {
      framework: 'Jest',
      types: ['Unit tests', 'Integration tests', 'End-to-end tests'],
      coverage_target: '90%',
      mock_strategy: 'Mock external dependencies',
      test_data: 'Fixtures and factories',
      ci_integration: 'Automated testing on push'
    };
  }

  defineSecurityRequirements(architecturalSpec) {
    return {
      input_validation: 'Joi schema validation',
      output_sanitization: 'HTML entity encoding',
      authentication: this.determineAuthMethod(architecturalSpec),
      authorization: 'Role-based access control',
      data_protection: 'Encryption at rest and in transit',
      security_headers: 'Helmet.js security headers'
    };
  }

  determineAuthMethod(architecturalSpec) {
    if (architecturalSpec.pattern.includes('MCP')) {
      return 'MCP protocol authentication';
    }
    return 'JWT token-based authentication';
  }

  definePerformanceRequirements(technical_spec) {
    return {
      response_time: 'Sub-100ms for core operations',
      throughput: 'Handle 1000+ requests per second',
      memory_usage: 'Efficient memory management',
      cpu_optimization: 'Minimize CPU-intensive operations',
      caching_strategy: 'In-memory caching for frequently accessed data'
    };
  }

  defineCodingStandards(platform) {
    return {
      style_guide: 'Airbnb JavaScript Style Guide',
      linting: 'ESLint with strict rules',
      formatting: 'Prettier for consistent formatting',
      naming_conventions: 'camelCase for variables, PascalCase for classes',
      documentation: 'JSDoc comments for functions and classes',
      file_structure: 'Modular file organization'
    };
  }

  defineDocumentationRequirements() {
    return {
      code_documentation: 'Inline comments and JSDoc',
      api_documentation: 'OpenAPI/Swagger specification',
      user_documentation: 'README with setup and usage',
      developer_documentation: 'Architecture and contribution guides',
      examples: 'Code examples and tutorials'
    };
  }

  defineDeploymentStrategy(architecture_type) {
    return {
      containerization: 'Docker containers',
      orchestration: 'Docker Compose for development',
      ci_cd: 'GitHub Actions or Jenkins',
      monitoring: 'Application and infrastructure monitoring',
      logging: 'Centralized logging with Winston',
      health_checks: 'Health endpoint for monitoring'
    };
  }

  // Complexity and Analysis Methods
  calculateComplexityScore(technical_spec) {
    let score = 0;
    const spec = technical_spec.toLowerCase();
    
    // Add complexity based on keywords
    if (spec.includes('database')) score += 2;
    if (spec.includes('api')) score += 1;
    if (spec.includes('authentication')) score += 2;
    if (spec.includes('real-time')) score += 3;
    if (spec.includes('machine learning')) score += 4;
    if (spec.includes('distributed')) score += 3;
    
    return Math.min(score, 10); // Cap at 10
  }

  estimateComponents(technical_spec) {
    const components = ['main server', 'configuration'];
    const spec = technical_spec.toLowerCase();
    
    if (spec.includes('database')) components.push('database layer');
    if (spec.includes('api')) components.push('API routes');
    if (spec.includes('auth')) components.push('authentication module');
    if (spec.includes('test')) components.push('test suite');
    if (spec.includes('log')) components.push('logging system');
    
    return components;
  }

  identifyIntegrationPoints(technical_spec) {
    const integrations = [];
    const spec = technical_spec.toLowerCase();
    
    if (spec.includes('database')) integrations.push('Database connection');
    if (spec.includes('api')) integrations.push('External API calls');
    if (spec.includes('file')) integrations.push('File system operations');
    if (spec.includes('email')) integrations.push('Email service');
    if (spec.includes('payment')) integrations.push('Payment gateway');
    
    return integrations.length > 0 ? integrations : ['Internal modules'];
  }

  analyzeDataFlow(technical_spec) {
    return {
      input_sources: ['User requests', 'Configuration files'],
      processing_stages: ['Validation', 'Business logic', 'Response formatting'],
      output_destinations: ['Client responses', 'Log files'],
      data_transformations: ['Input parsing', 'Data validation', 'Response serialization']
    };
  }

  assessScalabilityNeeds(technical_spec) {
    const spec = technical_spec.toLowerCase();
    
    if (spec.includes('high load') || spec.includes('scale')) {
      return 'High scalability requirements';
    }
    if (spec.includes('enterprise') || spec.includes('production')) {
      return 'Medium scalability requirements';
    }
    
    return 'Basic scalability requirements';
  }

  extractPerformanceNeeds(technical_spec) {
    const needs = [];
    const spec = technical_spec.toLowerCase();
    
    if (spec.includes('fast') || spec.includes('performance')) {
      needs.push('Low latency');
    }
    if (spec.includes('real-time')) {
      needs.push('Real-time processing');
    }
    if (spec.includes('concurrent')) {
      needs.push('High concurrency');
    }
    
    return needs.length > 0 ? needs : ['Standard performance'];
  }

  extractEndpoints(technical_spec) {
    // Extract or infer API endpoints from specification
    const endpoints = [];
    const spec = technical_spec.toLowerCase();
    
    // Add health check endpoint
    endpoints.push({
      path: '/health',
      method: 'GET',
      description: 'Health check endpoint',
      parameters: [],
      responses: { '200': 'Service is healthy' }
    });
    
    // Infer endpoints based on specification
    if (spec.includes('user')) {
      endpoints.push({
        path: '/users',
        method: 'GET',
        description: 'Get users',
        parameters: [],
        responses: { '200': 'List of users' }
      });
    }
    
    if (spec.includes('data') || spec.includes('information')) {
      endpoints.push({
        path: '/data',
        method: 'GET',
        description: 'Retrieve data',
        parameters: [],
        responses: { '200': 'Data retrieved successfully' }
      });
    }
    
    return endpoints;
  }

  extractDataModels(technical_spec) {
    // Define basic data models based on specification
    return {
      'Response': {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          message: { type: 'string' }
        }
      },
      'Error': {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'number' },
          details: { type: 'object' }
        }
      }
    };
  }

  determineAuth(technical_spec) {
    if (technical_spec.toLowerCase().includes('auth')) {
      return 'JWT Bearer token';
    }
    return 'None';
  }

  determineRateLimiting(technical_spec) {
    if (technical_spec.toLowerCase().includes('rate limit') || technical_spec.toLowerCase().includes('throttle')) {
      return '100 requests per minute per IP';
    }
    return 'None';
  }

  defineErrorCodes() {
    return {
      400: 'Bad Request - Invalid input parameters',
      401: 'Unauthorized - Authentication required',
      403: 'Forbidden - Insufficient permissions',
      404: 'Not Found - Resource not found',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Server error occurred'
    };
  }

  // Response Parsing Methods
  parseCompleteProjectResponse(responseText, context) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.files) {
          return parsed;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to parse complete project response as JSON');
    }
    
    // Fallback: return the response as a single file
    return {
      files: {
        [`${context.target.server_name}-server.js`]: responseText
      },
      instructions: 'Setup: npm install && npm start',
      notes: 'Generated code may need review and customization'
    };
  }

  cleanCodeResponse(responseText) {
    // Remove markdown code blocks and extra text
    let cleaned = responseText
      .replace(/```javascript\s*/g, '')
      .replace(/```js\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/^[\s\S]*?(?=\/\*|const|class|function|module\.exports)/m, '')
      .trim();
    
    return cleaned || responseText;
  }

  parseJsonResponse(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      this.logger.warn('Failed to parse JSON response');
    }
    
    return responseText;
  }

  // Template Generation (Fallback)
  generateCodeTemplate(context, code_type, quality_level) {
    this.logger.info(`Generating ${code_type} template (fallback mode)`);
    
    const templates = {
      'main_server': this.getMainServerTemplate(context),
      'package_json': this.getPackageJsonTemplate(context),
      'config_file': this.getConfigTemplate(context),
      'readme': this.getReadmeTemplate(context),
      'tests': this.getTestTemplate(context)
    };
    
    const template = templates[code_type] || templates['main_server'];
    
    return {
      content: [{
        type: 'text',
        text: typeof template === 'string' ? template : JSON.stringify(template, null, 2)
      }]
    };
  }

  getMainServerTemplate(context) {
    return `/**
 * ${context.target.server_name} Server
 * ${context.specification}
 * Generated by AI Code Writer
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

class ${this.toPascalCase(context.target.server_name)}Server {
  constructor() {
    this.server = new Server(
      {
        name: '${context.target.server_name}',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'example_tool',
          description: 'Example tool implementation',
          inputSchema: {
            type: 'object',
            properties: {
              input: {
                type: 'string',
                description: 'Input parameter'
              }
            },
            required: ['input']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'example_tool':
          return await this.handleExampleTool(args);
        default:
          throw new Error(\`Unknown tool: \${name}\`);
      }
    });
  }

  async handleExampleTool(args) {
    try {
      const { input } = args;
      
      // TODO: Implement your tool logic here
      const result = \`Processed: \${input}\`;
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            result: result,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(\`Tool execution failed: \${error.message}\`);
    }
  }

  setupErrorHandlers() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      console.log('Shutting down server...');
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('${context.target.server_name} server running on stdio');
  }
}

const server = new ${this.toPascalCase(context.target.server_name)}Server();
server.run().catch(console.error);
`;
  }

  getPackageJsonTemplate(context) {
    return {
      name: context.target.server_name,
      version: '1.0.0',
      description: context.specification,
      main: `${context.target.server_name}-server.js`,
      scripts: {
        start: `node ${context.target.server_name}-server.js`,
        dev: `nodemon ${context.target.server_name}-server.js`,
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage',
        lint: 'eslint .',
        'lint:fix': 'eslint . --fix'
      },
      keywords: [context.target.architecture, context.target.platform, 'mcp'],
      author: 'AI Code Writer',
      license: 'MIT',
      dependencies: {
        '@modelcontextprotocol/sdk': '^0.4.0'
      },
      devDependencies: {
        jest: '^29.0.0',
        nodemon: '^3.0.0',
        eslint: '^8.0.0',
        prettier: '^3.0.0'
      },
      engines: {
        node: '>=18.0.0'
      }
    };
  }

  getConfigTemplate(context) {
    return {
      '.env.example': `# Environment Variables for ${context.target.server_name}\n# Copy to .env and fill in your values\n\nNODE_ENV=development\nLOG_LEVEL=info\n# Add your environment variables here`,
      'jest.config.js': `module.exports = {\n  testEnvironment: 'node',\n  collectCoverageFrom: [\n    'src/**/*.js',\n    '!src/**/*.test.js'\n  ],\n  coverageThreshold: {\n    global: {\n      branches: 80,\n      functions: 80,\n      lines: 80,\n      statements: 80\n    }\n  }\n};`,
      '.eslintrc.js': `module.exports = {\n  env: {\n    node: true,\n    es2021: true,\n    jest: true\n  },\n  extends: ['eslint:recommended'],\n  parserOptions: {\n    ecmaVersion: 12,\n    sourceType: 'module'\n  },\n  rules: {\n    'no-console': 'warn',\n    'no-unused-vars': 'error'\n  }\n};`
    };
  }

  getReadmeTemplate(context) {
    return `# ${context.target.server_name}

${context.specification}

## Features

- Production-ready ${context.target.architecture}
- Comprehensive error handling
- Extensive test coverage
- Modern JavaScript (ES6+)
- Docker support

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`

## License

MIT
`;
  }

  getTestTemplate(context) {
    return `/**
 * Test Suite for ${context.target.server_name}
 */

const { expect } = require('@jest/globals');

describe('${context.target.server_name} Server', () => {
  test('should initialize correctly', () => {
    expect(true).toBe(true);
  });

  test('should handle example tool', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should handle errors gracefully', async () => {
    // TODO: Implement error handling test
    expect(true).toBe(true);
  });
});
`;
  }

  generateFallbackContext(args) {
    const { technical_spec, target_directory, additional_requirements = [] } = args;
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          specification: technical_spec,
          target: {
            directory: target_directory,
            server_name: path.basename(target_directory) || 'custom-server',
            platform: 'node.js',
            architecture: 'mcp-server'
          },
          requirements: {
            functional: additional_requirements,
            non_functional: ['Maintainability', 'Reliability'],
            constraints: ['Development time constraints']
          },
          technology_stack: {
            core: ['Node.js', 'npm'],
            framework: ['@modelcontextprotocol/sdk'],
            testing: ['Jest'],
            linting: ['ESLint']
          },
          generated_at: new Date().toISOString(),
          fallback_mode: true,
          note: 'This is a fallback context. Full AI analysis was not available.'
        }, null, 2)
      }]
    };
  }

  // Utility Methods
  toPascalCase(str) {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}

module.exports = CodeGenerator;

