/**
 * Code Analyzer Module
 * Analyze existing code patterns and structures
 */

const fs = require('fs').promises;
const path = require('path');
const Logger = require('../../utils/logger');

class CodeAnalyzer {
  constructor() {
    this.logger = new Logger('CodeAnalyzer');
  }

  getTools() {
    return [
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
      }
    ];
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
          this.logger.warn(`Could not analyze directory ${dir}: ${error.message}`);
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
}

module.exports = CodeAnalyzer;

