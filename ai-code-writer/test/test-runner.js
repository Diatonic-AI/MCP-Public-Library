#!/usr/bin/env node
/**
 * Comprehensive Test Runner for AI Code Writer
 * Runs unit tests, integration tests, and CI-specific test suites
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

class TestRunner {
  constructor() {
    this.testTypes = {
      unit: 'test/unit/**/*.test.js',
      integration: 'test/integration/**/*.test.js',
      all: 'test/**/*.test.js'
    };
    
    this.environments = {
      ci: process.env.CI === 'true',
      windows: process.platform === 'win32',
      wsl: false // Will be detected
    };
    
    this.config = {
      verbose: process.argv.includes('--verbose'),
      coverage: process.argv.includes('--coverage'),
      watch: process.argv.includes('--watch'),
      bail: process.argv.includes('--bail'),
      testType: this.parseTestType(),
      maxWorkers: this.parseMaxWorkers()
    };
  }
  
  parseTestType() {
    const typeArg = process.argv.find(arg => arg.startsWith('--type='));
    if (typeArg) {
      const type = typeArg.split('=')[1];
      return this.testTypes[type] ? type : 'all';
    }
    return 'all';
  }
  
  parseMaxWorkers() {
    const workerArg = process.argv.find(arg => arg.startsWith('--max-workers='));
    if (workerArg) {
      return parseInt(workerArg.split('=')[1]) || 1;
    }
    return this.environments.ci ? 1 : Math.max(1, os.cpus().length - 1);
  }
  
  async detectWSL() {
    if (!this.environments.windows) {
      return false;
    }
    
    try {
      const { spawn } = require('child_process');
      const wslProcess = spawn('wsl.exe', ['--status'], { stdio: 'pipe' });
      
      return new Promise((resolve) => {
        wslProcess.on('exit', (code) => {
          resolve(code === 0);
        });
        
        wslProcess.on('error', () => {
          resolve(false);
        });
        
        setTimeout(() => {
          wslProcess.kill();
          resolve(false);
        }, 3000);
      });
    } catch (error) {
      return false;
    }
  }
  
  async setupEnvironment() {
    console.log('🌍 Setting up test environment...');
    
    // Detect WSL availability
    this.environments.wsl = await this.detectWSL();
    
    // Set environment variables for tests
    process.env.NODE_ENV = 'test';
    process.env.TEST_RUNNER = 'true';
    process.env.WSL_AVAILABLE = this.environments.wsl.toString();
    
    // Platform-specific setup
    if (this.environments.windows) {
      process.env.TEST_PLATFORM = 'windows';
      process.env.TEST_SHELL = 'powershell';
    } else {
      process.env.TEST_PLATFORM = 'unix';
      process.env.TEST_SHELL = 'bash';
    }
    
    console.log(`⚙️  Platform: ${process.env.TEST_PLATFORM}`);
    console.log(`🐚 WSL Available: ${this.environments.wsl}`);
    console.log(`🎭 Test Type: ${this.config.testType}`);
    console.log(`📋 Coverage: ${this.config.coverage}`);
  }
  
  buildJestArgs() {
    const args = [];
    
    // Test pattern
    args.push(this.testTypes[this.config.testType]);
    
    // Configuration
    args.push('--config', 'jest.config.js');
    
    // Environment-specific options
    if (this.config.verbose) {
      args.push('--verbose');
    }
    
    if (this.config.coverage) {
      args.push('--coverage');
      args.push('--coverageReporters', 'text', 'lcov', 'html');
    }
    
    if (this.config.watch && !this.environments.ci) {
      args.push('--watch');
    }
    
    if (this.config.bail) {
      args.push('--bail');
    }
    
    // Worker configuration
    args.push('--maxWorkers', this.config.maxWorkers.toString());
    
    // CI-specific options
    if (this.environments.ci) {
      args.push('--ci');
      args.push('--forceExit');
      args.push('--detectOpenHandles');
      args.push('--passWithNoTests');
    }
    
    return args;
  }
  
  async runTests() {
    console.log('\n🏃 Running tests...');
    
    const jestArgs = this.buildJestArgs();
    const jestPath = path.join(__dirname, '..', 'node_modules', '.bin', 'jest');
    
    return new Promise((resolve, reject) => {
      const jestProcess = spawn('node', [jestPath, ...jestArgs], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
        env: process.env
      });
      
      jestProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('\n✅ All tests passed!');
          resolve(code);
        } else {
          console.error(`\n❌ Tests failed with exit code ${code}`);
          reject(new Error(`Tests failed with exit code ${code}`));
        }
      });
      
      jestProcess.on('error', (error) => {
        console.error('❌ Failed to run Jest:', error.message);
        reject(error);
      });
    });
  }
  
  async generateTestReport() {
    if (!this.config.coverage) {
      return;
    }
    
    console.log('\n📈 Generating test report...');
    
    try {
      const coverageDir = path.join(__dirname, '..', 'coverage');
      const reportPath = path.join(coverageDir, 'test-report.json');
      
      const report = {
        timestamp: new Date().toISOString(),
        environment: this.environments,
        config: this.config,
        platform: process.platform,
        nodeVersion: process.version,
        testResults: {
          type: this.config.testType,
          coverage: this.config.coverage
        }
      };
      
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`🗄 Test report saved to ${reportPath}`);
    } catch (error) {
      console.warn('⚠️ Failed to generate test report:', error.message);
    }
  }
  
  async run() {
    try {
      console.log('🧪 AI Code Writer Test Runner');
      console.log('============================\n');
      
      await this.setupEnvironment();
      await this.runTests();
      await this.generateTestReport();
      
      console.log('\n🎉 Test run completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n🚨 Test run failed:', error.message);
      process.exit(1);
    }
  }
  
  static printHelp() {
    console.log(`
AI Code Writer Test Runner

Usage: node test/test-runner.js [options]

Options:
  --type=<unit|integration|all>  Run specific test type (default: all)
  --coverage                     Generate coverage report
  --verbose                      Verbose output
  --watch                        Watch mode (not available in CI)
  --bail                         Stop on first test failure
  --max-workers=<n>              Maximum number of worker processes
  --help                         Show this help message

Examples:
  node test/test-runner.js --type=unit --coverage
  node test/test-runner.js --type=integration --verbose
  node test/test-runner.js --watch --bail
`);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  TestRunner.printHelp();
  process.exit(0);
}

// Run the test runner
if (require.main === module) {
  const runner = new TestRunner();
  runner.run();
}

module.exports = TestRunner;

