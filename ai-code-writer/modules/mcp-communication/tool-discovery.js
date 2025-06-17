/**
 * Tool Discovery Module
 * Discovers and catalogs all tools across MCP servers
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const Logger = require('../../utils/logger');
const ResponseFormatter = require('../../utils/response-formatter');

class ToolDiscovery {
  constructor() {
    this.logger = new Logger('ToolDiscovery');
    this.responseFormatter = new ResponseFormatter();
    this.discoveredServers = new Map();
    this.discoveredTools = new Map();
  }

  getTools() {
    return [
      {
        name: 'discover_mcp_tools',
        description: 'Discover and catalog all tools across MCP servers',
        inputSchema: {
          type: 'object',
          properties: {
            server_directories: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of directories containing MCP servers',
              default: ['.']
            },
            include_configs: {
              type: 'boolean',
              default: true,
              description: 'Include server configuration analysis'
            },
            deep_scan: {
              type: 'boolean',
              default: false,
              description: 'Perform deep analysis of server capabilities'
            }
          },
          required: ['server_directories']
        }
      },
      {
        name: 'get_tool_catalog',
        description: 'Get comprehensive catalog of all discovered tools',
        inputSchema: {
          type: 'object',
          properties: {
            filter_by_server: {
              type: 'string',
              description: 'Filter tools by specific server name'
            },
            include_performance: {
              type: 'boolean',
              default: true,
              description: 'Include performance metrics'
            }
          }
        }
      }
    ];
  }

  async discoverMcpTools(args) {
    try {
      const { server_directories = ['.'], include_configs = true, deep_scan = false } = args;
      
      this.logger.info('Starting MCP tool discovery across directories:', server_directories);
      
      const discoveryResults = {
        scan_timestamp: new Date().toISOString(),
        directories_scanned: server_directories,
        servers_found: [],
        tools_discovered: [],
        total_servers: 0,
        total_tools: 0,
        scan_duration: 0
      };
      
      const startTime = Date.now();
      
      // Discover all MCP servers
      for (const directory of server_directories) {
        const servers = await this.scanDirectoryForServers(directory, include_configs);
        discoveryResults.servers_found.push(...servers);
      }
      
      // Extract tools from discovered servers
      for (const server of discoveryResults.servers_found) {
        const tools = await this.extractToolsFromServer(server, deep_scan);
        discoveryResults.tools_discovered.push(...tools);
      }
      
      discoveryResults.total_servers = discoveryResults.servers_found.length;
      discoveryResults.total_tools = discoveryResults.tools_discovered.length;
      discoveryResults.scan_duration = Date.now() - startTime;
      
      // Store in internal maps for quick access
      this.updateInternalCatalog(discoveryResults);
      
      this.logger.info(`Discovery complete: ${discoveryResults.total_servers} servers, ${discoveryResults.total_tools} tools`);
      
      return this.responseFormatter.formatResponse(discoveryResults, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Tool discovery failed:', error.message);
      throw new Error(`Tool discovery failed: ${error.message}`);
    }
  }

  async getToolCatalog(args) {
    try {
      const { filter_by_server, include_performance = true } = args;
      
      let tools = Array.from(this.discoveredTools.values());
      
      if (filter_by_server) {
        tools = tools.filter(tool => tool.server_name === filter_by_server);
      }
      
      const catalog = {
        catalog_timestamp: new Date().toISOString(),
        total_tools: tools.length,
        servers_represented: [...new Set(tools.map(t => t.server_name))],
        tools: tools.map(tool => ({
          ...tool,
          performance_data: include_performance ? tool.performance_data : undefined
        }))
      };
      
      return this.responseFormatter.formatResponse(catalog, {
        type: 'text',
        prettify: true
      });
      
    } catch (error) {
      this.logger.error('Failed to get tool catalog:', error.message);
      throw new Error(`Failed to get tool catalog: ${error.message}`);
    }
  }

  async scanDirectoryForServers(directory, includeConfigs) {
    const servers = [];
    const resolvedDir = path.resolve(directory);
    
    try {
      this.logger.debug(`Scanning directory: ${resolvedDir}`);
      const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const serverPath = path.join(resolvedDir, entry.name);
          const server = await this.analyzeServerDirectory(serverPath, includeConfigs);
          if (server) {
            servers.push(server);
          }
        }
      }
      
      // Also check current directory for server files
      const currentServer = await this.analyzeServerDirectory(resolvedDir, includeConfigs);
      if (currentServer) {
        servers.push(currentServer);
      }
      
    } catch (error) {
      this.logger.warn(`Could not scan directory ${resolvedDir}:`, error.message);
    }
    
    return servers;
  }

  async analyzeServerDirectory(serverPath, includeConfigs) {
    try {
      const files = await fs.readdir(serverPath);
      
      // Look for MCP server indicators
      const packageJson = files.find(f => f === 'package.json');
      const serverFiles = files.filter(f => 
        f.includes('server') && 
        (f.endsWith('.js') || f.endsWith('.ts')) &&
        !f.includes('test')
      );
      
      if (!packageJson && serverFiles.length === 0) {
        return null; // Not an MCP server directory
      }
      
      const server = {
        name: path.basename(serverPath),
        path: serverPath,
        type: 'mcp-server',
        discovered_at: new Date().toISOString(),
        files: {
          package_json: !!packageJson,
          server_files: serverFiles,
          total_files: files.length
        }
      };
      
      // Analyze package.json if it exists
      if (packageJson && includeConfigs) {
        try {
          const packagePath = path.join(serverPath, 'package.json');
          const packageContent = await fs.readFile(packagePath, 'utf8');
          const packageData = JSON.parse(packageContent);
          
          server.package_info = {
            name: packageData.name,
            version: packageData.version,
            description: packageData.description,
            main: packageData.main,
            scripts: packageData.scripts,
            dependencies: Object.keys(packageData.dependencies || {}),
            mcp_related: this.isMcpRelated(packageData)
          };
        } catch (error) {
          this.logger.warn(`Could not parse package.json in ${serverPath}`);
        }
      }
      
      return server;
      
    } catch (error) {
      this.logger.debug(`Could not analyze ${serverPath}:`, error.message);
      return null;
    }
  }

  async extractToolsFromServer(server, deepScan) {
    const tools = [];
    
    try {
      this.logger.debug(`Extracting tools from server: ${server.name}`);
      
      // Try to load and analyze server files
      for (const serverFile of server.files.server_files) {
        const filePath = path.join(server.path, serverFile);
        const fileTools = await this.analyzeServerFile(filePath, server, deepScan);
        tools.push(...fileTools);
      }
      
      // If no tools found from file analysis, try runtime discovery
      if (tools.length === 0 && deepScan) {
        const runtimeTools = await this.attemptRuntimeDiscovery(server);
        tools.push(...runtimeTools);
      }
      
    } catch (error) {
      this.logger.warn(`Could not extract tools from ${server.name}:`, error.message);
    }
    
    return tools;
  }

  async analyzeServerFile(filePath, server, deepScan) {
    const tools = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Look for tool definitions in the code
      const toolPatterns = [
        /getTools\(\)\s*{[^}]*return\s*\[([^\]]*\{[^}]*name[^}]*\}[^\]]*)\]/gs,
        /tools\s*:\s*\[([^\]]*\{[^}]*name[^}]*\}[^\]]*)\]/gs,
        /name\s*:\s*['"]([^'"]+)['"][^}]*description\s*:\s*['"]([^'"]+)['"]/gs
      ];
      
      // Extract tool information using regex patterns
      for (const pattern of toolPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const toolInfo = this.parseToolFromMatch(match, server, filePath);
          if (toolInfo) {
            tools.push(toolInfo);
          }
        }
      }
      
      // If deep scan is enabled, try to dynamically load the module
      if (deepScan && tools.length === 0) {
        const dynamicTools = await this.attemptDynamicAnalysis(filePath, server);
        tools.push(...dynamicTools);
      }
      
    } catch (error) {
      this.logger.debug(`Could not analyze file ${filePath}:`, error.message);
    }
    
    return tools;
  }

  parseToolFromMatch(match, server, filePath) {
    try {
      // This is a simplified parser - in practice, you might want a more robust solution
      const matchText = match[0] || match[1] || '';
      
      const nameMatch = matchText.match(/name\s*:\s*['"]([^'"]+)['"]/); 
      const descMatch = matchText.match(/description\s*:\s*['"]([^'"]+)['"]/);
      
      if (nameMatch && descMatch) {
        return {
          id: `${server.name}_${nameMatch[1]}`,
          name: nameMatch[1],
          description: descMatch[1],
          server_name: server.name,
          server_path: server.path,
          file_path: filePath,
          discovered_at: new Date().toISOString(),
          category: this.categorizeToolByName(nameMatch[1]),
          suggested_chains: this.suggestToolChains(nameMatch[1], descMatch[1]),
          performance_data: {
            usage_count: 0,
            success_rate: 0,
            average_duration: 0,
            last_used: null,
            user_ratings: []
          }
        };
      }
    } catch (error) {
      this.logger.debug('Could not parse tool from match:', error.message);
    }
    
    return null;
  }

  async attemptDynamicAnalysis(filePath, server) {
    const tools = [];
    
    try {
      // Attempt to safely require the module and extract tools
      // This is risky, so we'll be very careful
      
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Only try if it looks safe
      if (this.isSafeToRequire(filePath)) {
        delete require.cache[require.resolve(relativePath)];
        const module = require(relativePath);
        
        if (module && typeof module.getTools === 'function') {
          const moduleTools = module.getTools();
          
          for (const tool of moduleTools) {
            tools.push({
              id: `${server.name}_${tool.name}`,
              name: tool.name,
              description: tool.description || 'No description available',
              server_name: server.name,
              server_path: server.path,
              file_path: filePath,
              discovered_at: new Date().toISOString(),
              input_schema: tool.inputSchema,
              category: this.categorizeToolByName(tool.name),
              suggested_chains: this.suggestToolChains(tool.name, tool.description || ''),
              performance_data: {
                usage_count: 0,
                success_rate: 0,
                average_duration: 0,
                last_used: null,
                user_ratings: []
              }
            });
          }
        }
      }
    } catch (error) {
      this.logger.debug(`Dynamic analysis failed for ${filePath}:`, error.message);
    }
    
    return tools;
  }

  isSafeToRequire(filePath) {
    // Basic safety checks
    const unsafe = ['exec', 'spawn', 'eval', 'require(', 'process.exit'];
    try {
      const content = require('fs').readFileSync(filePath, 'utf8');
      return !unsafe.some(pattern => content.includes(pattern));
    } catch {
      return false;
    }
  }

  isMcpRelated(packageData) {
    const mcpIndicators = [
      '@modelcontextprotocol',
      'mcp-server',
      'model-context-protocol'
    ];
    
    const deps = [
      ...Object.keys(packageData.dependencies || {}),
      ...Object.keys(packageData.devDependencies || {})
    ].join(' ');
    
    const text = `${packageData.name} ${packageData.description} ${deps}`.toLowerCase();
    
    return mcpIndicators.some(indicator => text.includes(indicator));
  }

  categorizeToolByName(toolName) {
    const categories = {
      'file': ['file', 'read', 'write', 'create', 'delete', 'copy'],
      'analysis': ['analyze', 'inspect', 'validate', 'check'],
      'generation': ['generate', 'create', 'build', 'produce'],
      'communication': ['send', 'fetch', 'request', 'api'],
      'data': ['search', 'query', 'index', 'store'],
      'orchestration': ['execute', 'run', 'chain', 'workflow']
    };
    
    const lowerName = toolName.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerName.includes(keyword))) {
        return category;
      }
    }
    
    return 'utility';
  }

  suggestToolChains(toolName, description) {
    const chains = [];
    const category = this.categorizeToolByName(toolName);
    const text = `${toolName} ${description}`.toLowerCase();
    
    // Suggest common tool chains based on category and content
    if (category === 'analysis') {
      chains.push('analyze → generate_solution → execute');
      chains.push('analyze → validate → report');
    }
    
    if (category === 'generation') {
      chains.push('analyze_problem → generate → validate → deploy');
      chains.push('plan → generate → test → document');
    }
    
    if (category === 'file') {
      chains.push('create → validate → backup');
      chains.push('read → analyze → modify → save');
    }
    
    if (text.includes('problem')) {
      chains.push('analyze_problem → generate_solution_plan → execute_solution_plan');
    }
    
    return chains.slice(0, 3); // Limit to 3 suggestions
  }

  updateInternalCatalog(discoveryResults) {
    // Clear existing data
    this.discoveredServers.clear();
    this.discoveredTools.clear();
    
    // Update servers
    for (const server of discoveryResults.servers_found) {
      this.discoveredServers.set(server.name, server);
    }
    
    // Update tools
    for (const tool of discoveryResults.tools_discovered) {
      this.discoveredTools.set(tool.id, tool);
    }
  }

  async attemptRuntimeDiscovery(server) {
    const tools = [];
    
    try {
      // Try to run the server and capture its tool list
      // This is experimental and might not work for all servers
      
      if (server.package_info && server.package_info.main) {
        const mainFile = path.join(server.path, server.package_info.main);
        
        // Create a temporary script to extract tools
        const extractorScript = `
          try {
            const server = require('${mainFile}');
            if (server && server.getTools) {
              console.log(JSON.stringify(server.getTools()));
            }
          } catch (e) {
            console.error('Discovery failed:', e.message);
          }
        `;
        
        // This is risky and should be used carefully
        // In production, you might want to use a safer sandbox
        
      }
    } catch (error) {
      this.logger.debug(`Runtime discovery failed for ${server.name}:`, error.message);
    }
    
    return tools;
  }
}

module.exports = ToolDiscovery;

