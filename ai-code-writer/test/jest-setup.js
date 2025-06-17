/**
 * Jest Global Setup
 * Sets up test environment and global configurations
 */

const os = require('os');
const path = require('path');
const fs = require('fs').promises;

module.exports = async () => {
  console.log('🚀 Setting up Jest test environment...');
  
  // Set global test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce noise during tests
  process.env.TEST_MODE = 'true';
  
  // Configure platform-specific test settings
  if (os.platform() === 'win32') {
    process.env.TEST_PLATFORM = 'windows';
    process.env.TEST_SHELL = 'powershell';
  } else {
    process.env.TEST_PLATFORM = 'unix';
    process.env.TEST_SHELL = 'bash';
  }
  
  // Create temporary test directory
  const testTempDir = path.join(os.tmpdir(), 'ai-code-writer-tests', Date.now().toString());
  await fs.mkdir(testTempDir, { recursive: true });
  process.env.TEST_TEMP_DIR = testTempDir;
  
  // Global test timeouts
  process.env.TEST_TIMEOUT_SHORT = '5000';
  process.env.TEST_TIMEOUT_MEDIUM = '15000';
  process.env.TEST_TIMEOUT_LONG = '30000';
  
  // WSL detection for Windows
  if (os.platform() === 'win32') {
    try {
      const { spawn } = require('child_process');
      const wslCheck = spawn('wsl.exe', ['--status'], { stdio: 'pipe' });
      process.env.WSL_AVAILABLE = 'true';
    } catch (error) {
      process.env.WSL_AVAILABLE = 'false';
    }
  }
  
  console.log(`✅ Test environment configured for ${process.env.TEST_PLATFORM}`);
  console.log(`📂 Test temp directory: ${testTempDir}`);
};

