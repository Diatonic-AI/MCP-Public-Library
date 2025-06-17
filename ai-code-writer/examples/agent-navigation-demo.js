#!/usr/bin/env node
/**
 * AI Agent Navigation Demo
 * 
 * Demonstrates how AI agents can navigate between different filesystems
 * (Windows, WSL, Unix) while maintaining session context and performing
 * cross-platform analysis.
 * 
 * Run with: node examples/agent-navigation-demo.js
 */

const path = require('path');
const { execSync } = require('child_process');

// Simulated MCP client for demonstration
class MockMCPClient {
  constructor() {
    this.sessions = new Map();
    this.currentPlatform = process.platform === 'win32' ? 'windows' : 'unix';
  }

  async callTool(toolName, args) {
    console.log(`\n🔧 Calling tool: ${toolName}`);
    console.log(`📋 Arguments:`, JSON.stringify(args, null, 2));

    switch (toolName) {
      case 'create_session_directory':
        return this.createSessionDirectory(args);
      case 'change_directory':
        return this.changeDirectory(args);
      case 'get_session_directory':
        return this.getSessionDirectory(args);
      case 'advanced_file_operations':
        return this.advancedFileOperations(args);
      case 'execute_terminal_command':
        return this.executeTerminalCommand(args);
      case 'list_session_directories':
        return this.listSessionDirectories(args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async createSessionDirectory(args) {
    const { sessionId, initialCwd, metadata } = args;
    const session = {
      sessionId,
      cwd: initialCwd || process.cwd(),
      created: new Date().toISOString(),
      metadata: metadata || {},
      platform: this.currentPlatform
    };
    
    this.sessions.set(sessionId, session);
    
    return {
      success: true,
      sessionId,
      cwd: session.cwd,
      created: session.created,
      metadata: session.metadata
    };
  }

  async changeDirectory(args) {
    const { sessionId, targetPath } = args;
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const oldCwd = session.cwd;
    const newCwd = path.isAbsolute(targetPath) 
      ? targetPath 
      : path.resolve(session.cwd, targetPath);
    
    session.cwd = newCwd;
    session.lastChanged = new Date().toISOString();
    
    // Detect platform change based on path
    if (newCwd.startsWith('/mnt/c/') || newCwd.startsWith('/mnt/')) {
      session.platform = 'wsl';
    } else if (newCwd.match(/^[A-Z]:/)) {
      session.platform = 'windows';
    } else if (newCwd.startsWith('/')) {
      session.platform = 'unix';
    }
    
    return {
      success: true,
      sessionId,
      oldCwd,
      newCwd,
      platform: session.platform,
      changed: session.lastChanged
    };
  }

  async getSessionDirectory(args) {
    const { sessionId } = args;
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    return {
      success: true,
      sessionId,
      cwd: session.cwd,
      platform: session.platform,
      created: session.created,
      metadata: session.metadata
    };
  }

  async advancedFileOperations(args) {
    const { operation, target_path, options } = args;
    const sessionId = options?.sessionId;
    const session = this.sessions.get(sessionId);
    
    // Simulate file analysis based on current directory
    const mockFiles = [
      { name: 'package.json', type: 'file', size: 1234, language: 'json' },
      { name: 'src', type: 'directory', files: 15 },
      { name: 'README.md', type: 'file', size: 2345, language: 'markdown' },
      { name: 'node_modules', type: 'directory', files: 1200 }
    ];
    
    return {
      success: true,
      operation,
      target_path,
      session: session ? {
        sessionId: session.sessionId,
        cwd: session.cwd,
        platform: session.platform
      } : null,
      results: mockFiles,
      analysis: {
        totalFiles: 1217,
        languagesDetected: ['javascript', 'json', 'markdown'],
        estimatedLinesOfCode: 25000,
        projectType: 'Node.js Application'
      }
    };
  }

  async executeTerminalCommand(args) {
    const { sessionId, command, platform } = args;
    const session = this.sessions.get(sessionId);
    
    // Simulate command execution based on platform
    let mockOutput = '';
    const detectedPlatform = platform === 'auto' ? (session?.platform || this.currentPlatform) : platform;
    
    if (command.includes('git status')) {
      mockOutput = `On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean`;
    } else if (command.includes('ls') || command.includes('dir')) {
      mockOutput = `package.json\nsrc/\nREADME.md\nnode_modules/\n.git/`;
    } else {
      mockOutput = `Command executed on ${detectedPlatform} platform`;
    }
    
    return {
      success: true,
      command,
      platform: detectedPlatform,
      exitCode: 0,
      stdout: mockOutput,
      stderr: '',
      duration: Math.random() * 1000 + 100,
      session: session ? {
        sessionId: session.sessionId,
        cwd: session.cwd
      } : null
    };
  }

  async listSessionDirectories(args) {
    const sessions = Array.from(this.sessions.values()).map(session => ({
      sessionId: session.sessionId,
      cwd: session.cwd,
      platform: session.platform,
      created: session.created,
      metadata: args?.includeMetadata ? session.metadata : undefined
    }));
    
    return {
      success: true,
      totalSessions: sessions.length,
      sessions
    };
  }
}

// Demo scenarios
class AgentNavigationDemo {
  constructor() {
    this.mcpClient = new MockMCPClient();
  }

  log(message, data = null) {
    console.log(`\n🤖 ${message}`);
    if (data) {
      console.log(`📊 Result:`, JSON.stringify(data, null, 2));
    }
  }

  async runDemo() {
    console.log('🚀 AI Agent Navigation Demo');
    console.log('=' .repeat(50));
    
    try {
      await this.scenario1_BasicNavigation();
      await this.scenario2_CrossPlatformAnalysis();
      await this.scenario3_MultiAgentCoordination();
      await this.scenario4_SessionManagement();
      
      console.log('\n✅ Demo completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Demo failed:', error.message);
      console.error(error.stack);
    }
  }

  async scenario1_BasicNavigation() {
    console.log('\n🎯 Scenario 1: Basic Agent Navigation');
    console.log('-'.repeat(40));
    
    // Create agent session
    this.log('Creating AI agent session');
    const session = await this.mcpClient.callTool('create_session_directory', {
      sessionId: 'code-analyzer-001',
      initialCwd: 'C:/Development/projects',
      metadata: {
        agent: 'code-analyzer',
        task: 'project-analysis',
        priority: 'high'
      }
    });
    this.log('Agent session created', session);
    
    // Navigate to different directories
    this.log('Navigating to Windows project directory');
    const windowsNav = await this.mcpClient.callTool('change_directory', {
      sessionId: 'code-analyzer-001',
      targetPath: 'C:/Users/Developer/Projects/my-app'
    });
    this.log('Windows navigation result', windowsNav);
    
    // Switch to WSL equivalent
    this.log('Switching to WSL filesystem');
    const wslNav = await this.mcpClient.callTool('change_directory', {
      sessionId: 'code-analyzer-001',
      targetPath: '/mnt/c/Users/Developer/Projects/my-app'
    });
    this.log('WSL navigation result', wslNav);
    
    // Navigate within project
    this.log('Navigating to source directory');
    const srcNav = await this.mcpClient.callTool('change_directory', {
      sessionId: 'code-analyzer-001',
      targetPath: './src'
    });
    this.log('Source directory navigation', srcNav);
  }

  async scenario2_CrossPlatformAnalysis() {
    console.log('\n🔍 Scenario 2: Cross-Platform Analysis');
    console.log('-'.repeat(40));
    
    // Get current session state
    this.log('Getting current session state');
    const sessionState = await this.mcpClient.callTool('get_session_directory', {
      sessionId: 'code-analyzer-001'
    });
    this.log('Current session state', sessionState);
    
    // Analyze files in current directory
    this.log('Analyzing files in current directory');
    const analysis = await this.mcpClient.callTool('advanced_file_operations', {
      operation: 'analyze',
      target_path: '.',
      options: {
        sessionId: 'code-analyzer-001',
        includeStats: true,
        analyzeContent: true,
        detectLanguages: true
      }
    });
    this.log('File analysis results', analysis);
    
    // Execute platform-specific commands
    this.log('Executing git status command');
    const gitStatus = await this.mcpClient.callTool('execute_terminal_command', {
      sessionId: 'code-analyzer-001',
      command: 'git status --porcelain',
      platform: 'auto'
    });
    this.log('Git status result', gitStatus);
    
    // List directory contents
    this.log('Listing directory contents');
    const listFiles = await this.mcpClient.callTool('execute_terminal_command', {
      sessionId: 'code-analyzer-001',
      command: sessionState.platform === 'windows' ? 'dir' : 'ls -la',
      platform: 'auto'
    });
    this.log('Directory listing', listFiles);
  }

  async scenario3_MultiAgentCoordination() {
    console.log('\n👥 Scenario 3: Multi-Agent Coordination');
    console.log('-'.repeat(40));
    
    // Create multiple agent sessions
    this.log('Creating Windows-focused agent');
    const windowsAgent = await this.mcpClient.callTool('create_session_directory', {
      sessionId: 'windows-specialist',
      initialCwd: 'C:/Development/projects/team-app',
      metadata: {
        agent: 'windows-specialist',
        platform: 'windows',
        specialization: 'build-and-deploy'
      }
    });
    this.log('Windows agent created', windowsAgent);
    
    this.log('Creating Linux-focused agent');
    const linuxAgent = await this.mcpClient.callTool('create_session_directory', {
      sessionId: 'linux-specialist',
      initialCwd: '/mnt/c/Development/projects/team-app',
      metadata: {
        agent: 'linux-specialist',
        platform: 'linux',
        specialization: 'testing-and-security'
      }
    });
    this.log('Linux agent created', linuxAgent);
    
    // Coordinate different tasks
    this.log('Windows agent: Analyzing build configuration');
    const windowsAnalysis = await this.mcpClient.callTool('advanced_file_operations', {
      operation: 'search',
      target_path: '.',
      options: {
        sessionId: 'windows-specialist',
        pattern: '.*\\.(json|yml|yaml)$',
        content_search: '(build|deploy|script)'
      }
    });
    this.log('Windows build analysis', windowsAnalysis);
    
    this.log('Linux agent: Security and testing analysis');
    const linuxAnalysis = await this.mcpClient.callTool('execute_terminal_command', {
      sessionId: 'linux-specialist',
      command: 'find . -name "*test*" -type f',
      platform: 'unix'
    });
    this.log('Linux security analysis', linuxAnalysis);
  }

  async scenario4_SessionManagement() {
    console.log('\n📋 Scenario 4: Session Management & Monitoring');
    console.log('-'.repeat(40));
    
    // List all active sessions
    this.log('Listing all active agent sessions');
    const allSessions = await this.mcpClient.callTool('list_session_directories', {
      includeMetadata: true
    });
    this.log('Active sessions overview', allSessions);
    
    // Demonstrate session context switching
    this.log('Switching back to original analyzer session');
    const originalSession = await this.mcpClient.callTool('get_session_directory', {
      sessionId: 'code-analyzer-001'
    });
    this.log('Original session context', originalSession);
    
    // Navigate to a completely different project
    this.log('Switching to different project context');
    const projectSwitch = await this.mcpClient.callTool('change_directory', {
      sessionId: 'code-analyzer-001',
      targetPath: '/home/developer/new-project'
    });
    this.log('Project context switch', projectSwitch);
    
    // Final analysis in new context
    this.log('Analyzing new project context');
    const finalAnalysis = await this.mcpClient.callTool('advanced_file_operations', {
      operation: 'analyze',
      target_path: '.',
      options: {
        sessionId: 'code-analyzer-001',
        quick: true
      }
    });
    this.log('New project analysis', finalAnalysis);
  }
}

// ASCII Art and Visual Demo
function displayBanner() {
  console.log(`
████████████████████████████████████████████████████████████████
█                                                              █
█    🤖 AI Agent Navigation Demo                                █
█    ================================                           █
█                                                              █
█    Features Demonstrated:                                    █
█    • Cross-platform filesystem navigation                    █
█    • Session-based context management                        █
█    • Multi-agent coordination                                █
█    • Real-time analysis and monitoring                       █
█                                                              █
████████████████████████████████████████████████████████████████
`);
}

function displayPlatformMap() {
  console.log(`
🗺️  Platform Navigation Map:

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   🪟 Windows    │    │   🐧 WSL/Linux  │    │   🍎 macOS      │
│                 │    │                 │    │                 │
│ C:/Users/...    │◄──►│ /mnt/c/Users/.. │◄──►│ /Users/...      │
│ C:/Project/...  │    │ /home/user/...  │    │ /home/user/...  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        ▲                       ▲                       ▲
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                               │
                    🤖 AI Agent Sessions
                   (Context-aware navigation)
`);
}

// Main execution
async function main() {
  displayBanner();
  displayPlatformMap();
  
  const demo = new AgentNavigationDemo();
  await demo.runDemo();
  
  console.log(`
📈 Demo Statistics:`);
  console.log(`   • Sessions Created: 3`);
  console.log(`   • Platforms Navigated: Windows, WSL, Unix`);
  console.log(`   • Operations Performed: 15+`);
  console.log(`   • Context Switches: 8`);
  
  console.log(`\n🎓 Key Takeaways:`);
  console.log(`   • AI agents maintain independent session contexts`);
  console.log(`   • Seamless navigation between different filesystems`);
  console.log(`   • Platform-aware command execution`);
  console.log(`   • Real-time analysis and coordination capabilities`);
  
  console.log(`\n💡 Next Steps:`);
  console.log(`   • Try running: node examples/cross-platform-analysis.js`);
  console.log(`   • Explore: node examples/ai-problem-solving.js`);
  console.log(`   • Advanced: node examples/team-collaboration-setup.js`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AgentNavigationDemo, MockMCPClient };

