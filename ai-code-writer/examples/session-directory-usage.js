/**
 * Session Directory Manager Usage Example
 * 
 * This example demonstrates how to use the session-based directory manager
 * for tracking current working directory per context/session.
 */

const SessionDirectoryManager = require('../modules/file-operations/session-directory-manager');
const TerminalSessionIntegration = require('../modules/terminal-backend/terminal-session-integration');
const TerminalExecutor = require('../modules/terminal-backend/terminal-executor');
const redis = require('redis');

async function demonstrateSessionDirectoryManager() {
  console.log('=== Session Directory Manager Demo ===\n');
  
  // 1. Initialize session directory manager
  console.log('1. Initializing Session Directory Manager...');
  const sessionManager = new SessionDirectoryManager({
    useRedis: true,
    defaultCwd: process.cwd(),
    sessionTimeout: 3600000, // 1 hour
    enableValidation: true
  });
  
  // 2. Initialize Redis (optional)
  console.log('2. Setting up Redis connection...');
  let redisClient;
  try {
    redisClient = redis.createClient({ host: 'localhost', port: 6379 });
    await redisClient.connect();
    await sessionManager.initializeRedis(redisClient);
    console.log('   Redis connected successfully\n');
  } catch (error) {
    console.log('   Redis not available, using in-memory storage only\n');
  }
  
  // 3. Create sessions
  console.log('3. Creating sessions...');
  const session1 = 'user-session-1';
  const session2 = 'user-session-2';
  
  try {
    // Create first session
    const result1 = await sessionManager.createSessionDirectory({
      sessionId: session1,
      initialCwd: process.cwd(),
      metadata: { userId: 'user1', type: 'development' }
    });
    console.log(`   Session 1 created: ${result1.cwd}`);
    
    // Create second session with different directory
    const result2 = await sessionManager.createSessionDirectory({
      sessionId: session2,
      initialCwd: require('os').homedir(),
      metadata: { userId: 'user2', type: 'testing' }
    });
    console.log(`   Session 2 created: ${result2.cwd}\n`);
    
  } catch (error) {
    console.error('   Error creating sessions:', error.message);
  }
  
  // 4. Demonstrate directory changes
  console.log('4. Demonstrating directory changes...');
  try {
    // Change directory for session 1
    await sessionManager.changeDirectory({
      sessionId: session1,
      targetPath: '..',
    });
    
    const session1Dir = await sessionManager.getSessionDirectory({ sessionId: session1 });
    console.log(`   Session 1 changed to: ${session1Dir.cwd}`);
    
    // Change directory for session 2
    await sessionManager.changeDirectory({
      sessionId: session2,
      targetPath: 'Documents',
      createIfNotExists: true
    });
    
    const session2Dir = await sessionManager.getSessionDirectory({ sessionId: session2 });
    console.log(`   Session 2 changed to: ${session2Dir.cwd}\n`);
    
  } catch (error) {
    console.error('   Error changing directories:', error.message);
  }
  
  // 5. List all sessions
  console.log('5. Listing all sessions...');
  try {
    const sessionsList = await sessionManager.listSessionDirectories({ includeMetadata: true });
    console.log(`   Total sessions: ${sessionsList.totalSessions}`);
    sessionsList.sessions.forEach(session => {
      console.log(`   - ${session.sessionId}: ${session.cwd}`);
      if (session.metadata) {
        console.log(`     Metadata: ${JSON.stringify(session.metadata)}`);
      }
    });
    console.log('');
  } catch (error) {
    console.error('   Error listing sessions:', error.message);
  }
  
  // 6. Demonstrate terminal integration
  console.log('6. Demonstrating terminal integration...');
  try {
    const terminalExecutor = new TerminalExecutor();
    const terminalIntegration = new TerminalSessionIntegration(sessionManager, terminalExecutor);
    
    // Execute pwd command in session context
    console.log('   Executing pwd in session 1...');
    const pwdResult = await terminalIntegration.executeSessionCommand(session1, 'pwd');
    console.log(`   PWD output: ${pwdResult.output}`);
    
    // Execute cd command through terminal integration
    console.log('   Executing cd command in session 1...');
    const cdResult = await terminalIntegration.executeSessionCommand(session1, 'cd ..');
    if (cdResult.success) {
      console.log(`   Directory changed from ${cdResult.oldCwd} to ${cdResult.newCwd}`);
    }
    
    // Execute ls command in the new directory
    console.log('   Executing ls in new directory...');
    const lsResult = await terminalIntegration.executeSessionCommand(session1, 'dir');
    console.log(`   LS output (first 200 chars): ${lsResult.output.substring(0, 200)}...\n`);
    
  } catch (error) {
    console.error('   Error with terminal integration:', error.message);
  }
  
  // 7. Demonstrate batch command execution
  console.log('7. Demonstrating batch command execution...');
  try {
    const terminalExecutor = new TerminalExecutor();
    const terminalIntegration = new TerminalSessionIntegration(sessionManager, terminalExecutor);
    
    const commands = [
      'pwd',
      'cd ..',
      'pwd',
      'dir'
    ];
    
    const batchResult = await terminalIntegration.executeSessionCommandBatch(
      session2,
      commands,
      { continueOnError: true }
    );
    
    console.log(`   Executed ${batchResult.executedCommands}/${batchResult.totalCommands} commands`);
    console.log(`   Final directory: ${batchResult.finalCwd}\n`);
    
  } catch (error) {
    console.error('   Error with batch execution:', error.message);
  }
  
  // 8. Clean up
  console.log('8. Cleaning up...');
  try {
    await sessionManager.deleteSessionDirectory({ sessionId: session1 });
    await sessionManager.deleteSessionDirectory({ sessionId: session2 });
    console.log('   Sessions deleted');
    
    await sessionManager.shutdown();
    console.log('   Session manager shut down');
    
    if (redisClient) {
      await redisClient.quit();
      console.log('   Redis connection closed');
    }
    
  } catch (error) {
    console.error('   Error during cleanup:', error.message);
  }
  
  console.log('\n=== Demo Complete ===');
}

// API Usage Examples
function demonstrateAPIUsage() {
  console.log('\n=== API Usage Examples ===\n');
  
  console.log('// 1. Basic session creation');
  console.log(`
const sessionManager = new SessionDirectoryManager({
  useRedis: true,
  defaultCwd: process.cwd(),
  sessionTimeout: 3600000
});

// Create a session
const result = await sessionManager.createSessionDirectory({
  sessionId: 'my-session',
  initialCwd: '/path/to/directory',
  metadata: { userId: 'user123' }
});
`);
  
  console.log('// 2. Directory navigation');
  console.log(`
// Change directory
const cdResult = await sessionManager.changeDirectory({
  sessionId: 'my-session',
  targetPath: '../parent-directory'
});

// Get current directory
const current = await sessionManager.getSessionDirectory({
  sessionId: 'my-session'
});
console.log('Current directory:', current.cwd);
`);
  
  console.log('// 3. Terminal integration');
  console.log(`
const terminalIntegration = new TerminalSessionIntegration(
  sessionManager,
  terminalExecutor
);

// Execute command with automatic cd tracking
const result = await terminalIntegration.executeSessionCommand(
  'my-session',
  'cd /some/path && ls -la'
);
`);
  
  console.log('// 4. Hooks for custom behavior');
  console.log(`
// Register a hook for directory changes
sessionManager.registerCdHook(async (sessionId, oldCwd, newCwd) => {
  console.log(\`Session \${sessionId} moved from \${oldCwd} to \${newCwd}\`);
  // Custom logic here
});
`);
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateSessionDirectoryManager()
    .then(() => {
      demonstrateAPIUsage();
      process.exit(0);
    })
    .catch(error => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
}

module.exports = {
  demonstrateSessionDirectoryManager,
  demonstrateAPIUsage
};

