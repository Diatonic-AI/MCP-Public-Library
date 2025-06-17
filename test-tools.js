#!/usr/bin/env node

/**
 * MCP Servers Tool Testing Script
 * Tests individual tools from each MCP server
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Test configurations
const servers = {
    'note-creator': {
        script: './note-creator-server.js',
        tools: [
            { name: 'create_note', args: { title: 'Test Note', content: 'This is a test note created by the testing script.' } },
            { name: 'create_daily_note', args: { content: 'Daily test note content' } },
            { name: 'create_ai_enhanced_note', args: { topic: 'AI Testing', requirements: 'Create a note about testing AI tools' } }
        ]
    },
    'text-processor': {
        script: './text-processor-server.js',
        tools: [
            { name: 'format_markdown', args: { text: 'Test heading\nTest content\n- Bullet point', title: 'Test Document' } },
            { name: 'create_bullet_list', args: { items: ['Item 1', 'Item 2', 'Item 3'] } },
            { name: 'word_count', args: { text: 'This is a test sentence for word counting.' } },
            { name: 'extract_keywords', args: { text: 'This is a test document about artificial intelligence and machine learning algorithms.' } }
        ]
    },
    'file-manager': {
        script: './file-manager-server.js',
        tools: [
            { name: 'list_files', args: { directory: '.', extension: '.md' } },
            { name: 'get_vault_structure', args: { maxDepth: 2 } },
            { name: 'search_files', args: { searchTerm: 'test', directory: '.' } }
        ]
    },
    'ai-integration': {
        script: './ai-integrations/ai-integration-server.js',
        tools: [
            { name: 'test_lm_studio_connection', args: {} },
            { name: 'simple_ai_task', args: { task: 'Summarize this text: This is a test document about AI integration.' } },
            { name: 'generate_outline', args: { topic: 'Testing AI Integration', sections: 3 } }
        ]
    },
    'collaboration': {
        script: './collaboration/collaboration-server.js',
        tools: [
            { name: 'create_team_workspace', args: { name: 'Test Workspace', description: 'Testing workspace creation' } },
            { name: 'create_task', args: { title: 'Test Task', description: 'Test task description', priority: 'medium' } },
            { name: 'list_team_workspaces', args: {} }
        ]
    },
    'data-visualization': {
        script: './data-visualization/data-viz-server.js',
        tools: [
            { name: 'create_simple_chart', args: { 
                data: [{ name: 'A', value: 10 }, { name: 'B', value: 20 }], 
                type: 'bar', 
                title: 'Test Chart' 
            } },
            { name: 'generate_dashboard_template', args: { 
                title: 'Test Dashboard',
                widgets: ['chart', 'table']
            } }
        ]
    }
};

class ToolTester {
    constructor() {
        this.results = [];
        this.currentTest = 0;
        this.totalTests = 0;
    }

    async testServer(serverName, config) {
        console.log(`\n🧪 Testing ${serverName.toUpperCase()} Server`);
        console.log('='.repeat(50));

        // Check if server file exists
        if (!fs.existsSync(config.script)) {
            console.log(`❌ Server file not found: ${config.script}`);
            return;
        }

        for (const tool of config.tools) {
            this.currentTest++;
            console.log(`\n[${this.currentTest}/${this.totalTests}] Testing tool: ${tool.name}`);
            
            try {
                const result = await this.testTool(config.script, tool.name, tool.args);
                if (result.success) {
                    console.log(`✅ ${tool.name} - SUCCESS`);
                    if (result.data && result.data.length < 200) {
                        console.log(`   Result: ${result.data}`);
                    } else {
                        console.log(`   Result: [${result.data ? result.data.length : 0} chars]`);
                    }
                } else {
                    console.log(`❌ ${tool.name} - FAILED`);
                    console.log(`   Error: ${result.error}`);
                }
                this.results.push({ server: serverName, tool: tool.name, ...result });
            } catch (error) {
                console.log(`❌ ${tool.name} - ERROR`);
                console.log(`   Error: ${error.message}`);
                this.results.push({ server: serverName, tool: tool.name, success: false, error: error.message });
            }

            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async testTool(serverScript, toolName, args) {
        return new Promise((resolve, reject) => {
            const serverProcess = spawn('node', [serverScript], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, OBSIDIAN_VAULT_PATH: process.cwd() }
            });

            let output = '';
            let errorOutput = '';
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    serverProcess.kill();
                    resolve({ success: false, error: 'Timeout - tool took too long to respond' });
                    resolved = true;
                }
            }, 10000); // 10 second timeout

            serverProcess.stdout.on('data', (data) => {
                output += data.toString();
                
                // Look for MCP response
                const lines = output.split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('{') && line.includes('"result"')) {
                        try {
                            const response = JSON.parse(line.trim());
                            if (response.result && !resolved) {
                                clearTimeout(timeout);
                                serverProcess.kill();
                                resolve({ success: true, data: JSON.stringify(response.result) });
                                resolved = true;
                                return;
                            }
                        } catch (e) {
                            // Not a valid JSON response, continue
                        }
                    }
                }
            });

            serverProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            serverProcess.on('close', (code) => {
                if (!resolved) {
                    clearTimeout(timeout);
                    if (code === 0) {
                        resolve({ success: true, data: output.trim() });
                    } else {
                        resolve({ success: false, error: `Process exited with code ${code}: ${errorOutput}` });
                    }
                    resolved = true;
                }
            });

            serverProcess.on('error', (error) => {
                if (!resolved) {
                    clearTimeout(timeout);
                    resolve({ success: false, error: error.message });
                    resolved = true;
                }
            });

            // Send MCP request
            const request = {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: args
                }
            };

            serverProcess.stdin.write(JSON.stringify(request) + '\n');
        });
    }

    async checkPrerequisites() {
        console.log('🔍 Checking Prerequisites...');
        
        // Check Node.js
        console.log('✅ Node.js is available');
        
        // Check environment variables
        const envVars = ['OBSIDIAN_VAULT_PATH', 'LM_STUDIO_BASE_URL'];
        for (const envVar of envVars) {
            if (process.env[envVar]) {
                console.log(`✅ ${envVar} is set`);
            } else {
                console.log(`⚠️  ${envVar} is not set (some features may not work)`);
            }
        }
        
        // Check LM Studio connection
        if (process.env.LM_STUDIO_BASE_URL) {
            try {
                const fetch = require('node-fetch').default || require('node-fetch');
                const response = await fetch(`${process.env.LM_STUDIO_BASE_URL}/v1/models`);
                if (response.ok) {
                    console.log('✅ LM Studio connection successful');
                } else {
                    console.log('⚠️  LM Studio connection failed');
                }
            } catch (error) {
                console.log('⚠️  Cannot connect to LM Studio (install node-fetch: npm install node-fetch)');
            }
        }
        
        console.log('');
    }

    async runAllTests() {
        console.log('🚀 MCP Servers Tool Testing');
        console.log('============================\n');

        await this.checkPrerequisites();

        // Calculate total tests
        this.totalTests = Object.values(servers).reduce((sum, config) => sum + config.tools.length, 0);
        console.log(`📊 Total tests to run: ${this.totalTests}\n`);

        // Run tests for each server
        for (const [serverName, config] of Object.entries(servers)) {
            await this.testServer(serverName, config);
        }

        // Print summary
        this.printSummary();
    }

    async runInteractiveTest() {
        console.log('🎯 Interactive Tool Testing');
        console.log('===========================\n');

        const serverNames = Object.keys(servers);
        console.log('Available servers:');
        serverNames.forEach((name, index) => {
            console.log(`${index + 1}. ${name}`);
        });

        const serverChoice = await this.question('\nSelect server (1-' + serverNames.length + ') or "all": ');
        
        if (serverChoice.toLowerCase() === 'all') {
            await this.runAllTests();
        } else {
            const serverIndex = parseInt(serverChoice) - 1;
            if (serverIndex >= 0 && serverIndex < serverNames.length) {
                const serverName = serverNames[serverIndex];
                const config = servers[serverName];
                
                console.log(`\nAvailable tools for ${serverName}:`);
                config.tools.forEach((tool, index) => {
                    console.log(`${index + 1}. ${tool.name}`);
                });
                
                const toolChoice = await this.question('\nSelect tool (1-' + config.tools.length + ') or "all": ');
                
                if (toolChoice.toLowerCase() === 'all') {
                    this.totalTests = config.tools.length;
                    await this.testServer(serverName, config);
                } else {
                    const toolIndex = parseInt(toolChoice) - 1;
                    if (toolIndex >= 0 && toolIndex < config.tools.length) {
                        const tool = config.tools[toolIndex];
                        this.totalTests = 1;
                        this.currentTest = 0;
                        console.log(`\n🧪 Testing ${serverName.toUpperCase()} Server - ${tool.name}`);
                        console.log('='.repeat(50));
                        
                        this.currentTest++;
                        const result = await this.testTool(config.script, tool.name, tool.args);
                        if (result.success) {
                            console.log(`✅ ${tool.name} - SUCCESS`);
                            console.log(`   Result: ${result.data}`);
                        } else {
                            console.log(`❌ ${tool.name} - FAILED`);
                            console.log(`   Error: ${result.error}`);
                        }
                        this.results.push({ server: serverName, tool: tool.name, ...result });
                    }
                }
            }
        }
        
        this.printSummary();
    }

    question(query) {
        return new Promise(resolve => {
            rl.question(query, resolve);
        });
    }

    printSummary() {
        console.log('\n📊 Test Summary');
        console.log('===============');
        
        const successful = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;
        
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${((successful / this.results.length) * 100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.filter(r => !r.success).forEach(r => {
                console.log(`   ${r.server}:${r.tool} - ${r.error}`);
            });
        }
        
        console.log('\n🎉 Testing complete!');
        console.log('\nNext steps:');
        console.log('1. Fix any failed tests');
        console.log('2. Set up API keys if needed: .\\setup-env-vars.ps1');
        console.log('3. Configure Smart Composer with master-mcp-config.json');
    }
}

// Main execution
async function main() {
    const tester = new ToolTester();
    
    const args = process.argv.slice(2);
    if (args.includes('--interactive') || args.includes('-i')) {
        await tester.runInteractiveTest();
    } else if (args.includes('--help') || args.includes('-h')) {
        console.log('MCP Servers Tool Testing Script');
        console.log('===============================');
        console.log('');
        console.log('Usage:');
        console.log('  node test-tools.js              # Run all tests');
        console.log('  node test-tools.js -i           # Interactive mode');
        console.log('  node test-tools.js --help       # Show this help');
        console.log('');
        console.log('Environment Variables:');
        console.log('  OBSIDIAN_VAULT_PATH    - Path to your Obsidian vault');
        console.log('  LM_STUDIO_BASE_URL     - LM Studio server URL');
        console.log('  OPENAI_API_KEY         - OpenAI API key (optional)');
        console.log('  GEMINI_API_KEY         - Gemini API key (optional)');
    } else {
        await tester.runAllTests();
    }
    
    rl.close();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ToolTester;

