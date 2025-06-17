#!/usr/bin/env node

/**
 * MCP Server Test Script
 * Tests functionality of newly created MCP servers
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class MCPServerTester {
  constructor() {
    this.servers = [
      {
        name: 'AI Integration Server',
        path: './ai-integrations/ai-integration-server.js',
        port: 3001
      },
      {
        name: 'Collaboration Server', 
        path: './collaboration/collaboration-server.js',
        port: 3002
      },
      {
        name: 'Data Visualization Server',
        path: './data-visualization/data-viz-server.js',
        port: 3003
      }
    ];
  }

  async testServerStartup(server) {
    return new Promise((resolve) => {
      console.log(`Testing ${server.name}...`);
      
      const process = exec(`node "${server.path}"`, {
        cwd: __dirname,
        timeout: 5000
      });

      let output = '';
      let hasStarted = false;

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.stderr?.on('data', (data) => {
        const message = data.toString();
        output += message;
        
        if (message.includes('running on stdio') || message.includes('MCP server')) {
          hasStarted = true;
          process.kill();
        }
      });

      process.on('exit', (code) => {
        resolve({
          server: server.name,
          success: hasStarted || code === 0,
          output: output,
          code: code
        });
      });

      process.on('error', (error) => {
        resolve({
          server: server.name,
          success: false,
          output: error.message,
          code: 1
        });
      });

      // Force exit after timeout
      setTimeout(() => {
        if (!hasStarted) {
          process.kill();
        }
      }, 4500);
    });
  }

  async testFileStructure() {
    console.log('\n=== Testing File Structure ===');
    
    const requiredFiles = [
      './ai-integrations/ai-integration-server.js',
      './ai-integrations/ai-integration-config.json',
      './collaboration/collaboration-server.js', 
      './collaboration/collaboration-config.json',
      './data-visualization/data-viz-server.js',
      './data-visualization/data-viz-config.json',
      './master-mcp-config.json'
    ];

    const results = [];
    
    for (const file of requiredFiles) {
      const filePath = path.join(__dirname, file);
      const exists = fs.existsSync(filePath);
      
      results.push({
        file: file,
        exists: exists,
        size: exists ? fs.statSync(filePath).size : 0
      });
      
      console.log(`${exists ? '✓' : '✗'} ${file} ${exists ? `(${Math.round(fs.statSync(filePath).size/1024)}KB)` : '(missing)'}`);
    }
    
    return results;
  }

  async testConfigurationFiles() {
    console.log('\n=== Testing Configuration Files ===');
    
    const configFiles = [
      './master-mcp-config.json',
      './ai-integrations/ai-integration-config.json',
      './collaboration/collaboration-config.json',
      './data-visualization/data-viz-config.json'
    ];

    const results = [];
    
    for (const configFile of configFiles) {
      try {
        const filePath = path.join(__dirname, configFile);
        const content = fs.readFileSync(filePath, 'utf8');
        const config = JSON.parse(content);
        
        results.push({
          file: configFile,
          valid: true,
          servers: Object.keys(config.mcpServers || {}).length
        });
        
        console.log(`✓ ${configFile} - Valid JSON with ${Object.keys(config.mcpServers || {}).length} server(s)`);
      } catch (error) {
        results.push({
          file: configFile,
          valid: false,
          error: error.message
        });
        
        console.log(`✗ ${configFile} - Invalid: ${error.message}`);
      }
    }
    
    return results;
  }

  async runAllTests() {
    console.log('🚀 Starting MCP Server Tests\n');
    
    // Test file structure
    const fileResults = await this.testFileStructure();
    
    // Test configuration files
    const configResults = await this.testConfigurationFiles();
    
    // Test server startup
    console.log('\n=== Testing Server Startup ===');
    const serverResults = [];
    
    for (const server of this.servers) {
      const result = await this.testServerStartup(server);
      serverResults.push(result);
      
      console.log(`${result.success ? '✓' : '✗'} ${result.server} - ${result.success ? 'Started successfully' : 'Failed to start'}`);
      
      if (!result.success && result.output) {
        console.log(`  Error: ${result.output.slice(0, 100)}...`);
      }
    }
    
    // Generate summary
    console.log('\n=== Test Summary ===');
    
    const filesOk = fileResults.filter(r => r.exists).length;
    const configsOk = configResults.filter(r => r.valid).length;
    const serversOk = serverResults.filter(r => r.success).length;
    
    console.log(`Files: ${filesOk}/${fileResults.length} ✓`);
    console.log(`Configs: ${configsOk}/${configResults.length} ✓`);
    console.log(`Servers: ${serversOk}/${serverResults.length} ✓`);
    
    const overallSuccess = filesOk === fileResults.length && 
                          configsOk === configResults.length && 
                          serversOk === serverResults.length;
    
    console.log(`\n${overallSuccess ? '🎉' : '⚠️ '} Overall: ${overallSuccess ? 'All tests passed!' : 'Some tests failed'}`);
    
    if (overallSuccess) {
      console.log('\n✨ Your MCP servers are ready for deployment!');
      console.log('Next steps:');
      console.log('1. Copy master-mcp-config.json to Smart Composer settings');
      console.log('2. Configure API keys for AI services (optional)');
      console.log('3. Start Obsidian and test the tools');
    }
    
    return {
      files: fileResults,
      configs: configResults,
      servers: serverResults,
      success: overallSuccess
    };
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  const tester = new MCPServerTester();
  tester.runAllTests().catch(console.error);
}

module.exports = MCPServerTester;

