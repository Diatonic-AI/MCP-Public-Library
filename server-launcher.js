#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class MCPServerLauncher {
  constructor() {
    this.servers = new Map();
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, 'mcp-master-config.json');
      const configContent = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      console.error('Failed to load configuration:', error.message);
      process.exit(1);
    }
  }

  async startServer(serverName) {
    const serverConfig = this.config.mcpServers[serverName];
    if (!serverConfig) {
      throw new Error(`Server configuration not found: ${serverName}`);
    }

    console.log(`Starting MCP server: ${serverName}`);
    
    const serverProcess = spawn(serverConfig.command, serverConfig.args, {
      cwd: serverConfig.cwd || __dirname,
      env: { ...process.env, ...serverConfig.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[${serverName}] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[${serverName}] ${data.toString().trim()}`);
    });

    serverProcess.on('close', (code) => {
      console.log(`[${serverName}] Process exited with code ${code}`);
      this.servers.delete(serverName);
    });

    serverProcess.on('error', (error) => {
      console.error(`[${serverName}] Failed to start: ${error.message}`);
    });

    this.servers.set(serverName, serverProcess);
    return serverProcess;
  }

  async startAllServers() {
    const serverNames = Object.keys(this.config.mcpServers);
    
    for (const serverName of serverNames) {
      try {
        await this.startServer(serverName);
        // Small delay between server starts
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to start ${serverName}:`, error.message);
      }
    }
  }

  stopServer(serverName) {
    const server = this.servers.get(serverName);
    if (server) {
      console.log(`Stopping MCP server: ${serverName}`);
      server.kill('SIGTERM');
      return true;
    }
    return false;
  }

  stopAllServers() {
    console.log('Stopping all MCP servers...');
    for (const [serverName] of this.servers) {
      this.stopServer(serverName);
    }
  }

  getServerStatus() {
    const status = {};
    for (const [serverName, process] of this.servers) {
      status[serverName] = {
        pid: process.pid,
        running: !process.killed
      };
    }
    return status;
  }
}

// CLI interface
if (require.main === module) {
  const launcher = new MCPServerLauncher();
  const command = process.argv[2];
  const serverName = process.argv[3];

  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down servers...');
    launcher.stopAllServers();
    setTimeout(() => process.exit(0), 2000);
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down servers...');
    launcher.stopAllServers();
    setTimeout(() => process.exit(0), 2000);
  });

  switch (command) {
    case 'start':
      if (serverName) {
        launcher.startServer(serverName).catch(console.error);
      } else {
        launcher.startAllServers().catch(console.error);
      }
      break;
      
    case 'stop':
      if (serverName) {
        launcher.stopServer(serverName);
      } else {
        launcher.stopAllServers();
      }
      break;
      
    case 'status':
      console.log('Server Status:', JSON.stringify(launcher.getServerStatus(), null, 2));
      break;
      
    case 'list':
      console.log('Available servers:', Object.keys(launcher.config.mcpServers));
      break;
      
    default:
      console.log(`
MCP Server Launcher

Usage:
  node server-launcher.js start [server-name]  - Start all servers or specific server
  node server-launcher.js stop [server-name]   - Stop all servers or specific server
  node server-launcher.js status               - Show server status
  node server-launcher.js list                 - List available servers

Available servers: ${Object.keys(launcher.config.mcpServers).join(', ')}
`);
      break;
  }
}

module.exports = MCPServerLauncher;

