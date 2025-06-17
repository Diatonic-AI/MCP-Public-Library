/**
 * Jest Setup After Environment
 * Runs after Jest environment is set up for each test file
 */

// Global test utilities
global.testTimeout = {
  short: parseInt(process.env.TEST_TIMEOUT_SHORT) || 5000,
  medium: parseInt(process.env.TEST_TIMEOUT_MEDIUM) || 15000,
  long: parseInt(process.env.TEST_TIMEOUT_LONG) || 30000
};

// Initialize global cleanup functions array
global.testCleanupFunctions = [];

// Helper function to register cleanup functions
global.registerCleanup = (cleanupFn) => {
  if (typeof cleanupFn === 'function') {
    global.testCleanupFunctions.push(cleanupFn);
  }
};

// Global test configuration
global.testConfig = {
  platform: process.env.TEST_PLATFORM,
  shell: process.env.TEST_SHELL,
  tempDir: process.env.TEST_TEMP_DIR,
  isWindows: process.env.TEST_PLATFORM === 'windows',
  wslAvailable: process.env.WSL_AVAILABLE === 'true'
};

/**
 * Jest Setup After Environment
 * Additional setup that runs after Jest environment is initialized
 */

// Global test utilities and helpers
global.testUtils = {
  // Helper to create test-specific temp directories
  createTempDir: async (testName) => {
    const fs = require('fs').promises;
    const path = require('path');
    const testDir = path.join(process.env.TEST_TEMP_DIR, testName);
    await fs.mkdir(testDir, { recursive: true });
    return testDir;
  },
  
  // Helper to clean up test-specific resources
  cleanup: (cleanupFn) => {
    if (!global.testCleanupFunctions) {
      global.testCleanupFunctions = [];
    }
    global.testCleanupFunctions.push(cleanupFn);
  },
  
  // Helper to wait for a condition
  waitFor: (condition, timeout = 5000, interval = 100) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for condition after ${timeout}ms`));
        } else {
          setTimeout(check, interval);
        }
      };
      check();
    });
  },
  
  // Helper to generate random test data
  generateTestData: () => {
    return {
      randomString: () => Math.random().toString(36).substring(7),
      randomCommand: () => process.platform === 'win32' ? 'echo test' : 'echo test',
      safeTestCommand: () => process.platform === 'win32' ? 'Get-Date' : 'date'
    };
  }
};

// Mock factory for child_process
global.createMockChildProcess = () => {
  const EventEmitter = require('events');
  
  class MockChildProcess extends EventEmitter {
    constructor(options = {}) {
      super();
      this.pid = Math.floor(Math.random() * 10000) + 1000;
      this.exitCode = options.exitCode || 0;
      this.stdout = new EventEmitter();
      this.stderr = new EventEmitter();
      this.stdin = new EventEmitter();
      this.stdin.write = jest.fn();
      this.stdin.end = jest.fn();
      this.killed = false;
      this._options = options;
    }
    
    kill(signal = 'SIGTERM') {
      this.killed = true;
      this.emit('exit', null, signal);
      return true;
    }
    
    // Simulate command execution
    simulate() {
      setTimeout(() => {
        if (this._options.stdout) {
          this.stdout.emit('data', this._options.stdout);
        }
        if (this._options.stderr) {
          this.stderr.emit('data', this._options.stderr);
        }
        if (this._options.error) {
          this.emit('error', this._options.error);
        } else {
          this.emit('exit', this.exitCode, null);
        }
      }, this._options.delay || 10);
    }
  }
  
  return MockChildProcess;
};

// Enhanced timeout configurations for different test types
jest.setTimeout(120000); // 2 minutes for all tests

// Console override to reduce noise in tests
if (process.env.LOG_LEVEL === 'error') {
  const originalConsole = global.console;
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: originalConsole.warn,
    error: originalConsole.error
  };
}

// Setup mock reset between tests
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

