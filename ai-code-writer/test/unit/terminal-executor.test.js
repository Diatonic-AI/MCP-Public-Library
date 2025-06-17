/**
 * Unit Tests for TerminalExecutor
 * Tests the base terminal execution functionality with mocked child_process
 */

const TerminalExecutor = require('../../modules/terminal-backend/terminal-executor');
const ErrorHandler = require('../../modules/terminal-backend/error-handler');
const { spawn } = require('child_process');

// Mock child_process
jest.mock('child_process');

describe('TerminalExecutor', () => {
  let executor;
  let mockChildProcess;
  let MockChildProcess;

  beforeEach(() => {
    MockChildProcess = global.createMockChildProcess();
    mockChildProcess = new MockChildProcess();
    spawn.mockReturnValue(mockChildProcess);
    
    executor = new TerminalExecutor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Platform Detection', () => {
    test('should detect Windows platform correctly', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      
      const windowsExecutor = new TerminalExecutor();
      expect(windowsExecutor.platform).toBe('windows');
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    test('should detect Linux platform correctly', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });
      
      const linuxExecutor = new TerminalExecutor();
      expect(linuxExecutor.platform).toBe('linux');
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    test('should detect macOS platform correctly', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });
      
      const macExecutor = new TerminalExecutor();
      expect(macExecutor.platform).toBe('darwin');
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });
  });

  describe('Command Execution', () => {
    test('should execute simple command successfully', async () => {
      const mockOutput = 'Hello World';
      mockChildProcess._options = {
        stdout: mockOutput,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('echo "Hello World"');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(mockOutput);
      expect(result.exitCode).toBe(0);
    });

    test('should handle command with stderr', async () => {
      const mockStderr = 'Warning: something happened';
      mockChildProcess._options = {
        stderr: mockStderr,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('some-command');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stderr).toBe(mockStderr);
    });

    test('should handle command failure', async () => {
      mockChildProcess._options = {
        stdout: '',
        stderr: 'Command not found',
        exitCode: 1
      };

      const resultPromise = executor.executeCapture('invalid-command');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('Command not found');
    });

    test('should handle process error', async () => {
      const mockError = new Error('ENOENT: command not found');
      mockChildProcess._options = {
        error: mockError
      };

      const resultPromise = executor.executeCapture('nonexistent-command');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError.message);
    });
  });

  describe('Working Directory', () => {
    test('should use specified working directory', async () => {
      const testDir = '/test/directory';
      mockChildProcess._options = {
        stdout: 'success',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('pwd', { cwd: testDir });
      mockChildProcess.simulate();
      
      await resultPromise;
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ cwd: testDir })
      );
    });

    test('should use current directory as default', async () => {
      mockChildProcess._options = {
        stdout: 'success',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('pwd');
      mockChildProcess.simulate();
      
      await resultPromise;
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ cwd: process.cwd() })
      );
    });
  });

  describe('Environment Variables', () => {
    test('should pass environment variables to child process', async () => {
      const testEnv = { TEST_VAR: 'test_value' };
      mockChildProcess._options = {
        stdout: 'success',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('env', { env: testEnv });
      mockChildProcess.simulate();
      
      await resultPromise;
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining(testEnv)
        })
      );
    });
  });

  describe('Timeout Handling', () => {
    test('should timeout long-running commands', async () => {
      const timeout = 1000; // 1 second
      mockChildProcess._options = {
        delay: 2000 // 2 seconds delay
      };

      const resultPromise = executor.executeCapture('sleep 10', { timeout });
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 3000);

    test('should not timeout fast commands', async () => {
      const timeout = 2000; // 2 seconds
      mockChildProcess._options = {
        stdout: 'fast result',
        exitCode: 0,
        delay: 100 // 100ms delay
      };

      const resultPromise = executor.executeCapture('echo fast', { timeout });
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('fast result');
    });
  });

  describe('Command Streaming', () => {
    test('should handle streaming output', async () => {
      const outputChunks = ['chunk1', 'chunk2', 'chunk3'];
      const receivedChunks = [];
      
      mockChildProcess._options = {
        exitCode: 0
      };

      const resultPromise = executor.executeStreaming('streaming-command', {
        onStdout: (chunk) => receivedChunks.push(chunk)
      });
      
      // Simulate streaming output
      setTimeout(() => {
        outputChunks.forEach(chunk => {
          mockChildProcess.stdout.emit('data', chunk);
        });
        mockChildProcess.emit('exit', 0, null);
      }, 10);
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(receivedChunks).toEqual(outputChunks);
    });

    test('should handle streaming stderr', async () => {
      const errorChunks = ['error1', 'error2'];
      const receivedErrors = [];
      
      mockChildProcess._options = {
        exitCode: 0
      };

      const resultPromise = executor.executeStreaming('command-with-warnings', {
        onStderr: (chunk) => receivedErrors.push(chunk)
      });
      
      // Simulate streaming stderr
      setTimeout(() => {
        errorChunks.forEach(chunk => {
          mockChildProcess.stderr.emit('data', chunk);
        });
        mockChildProcess.emit('exit', 0, null);
      }, 10);
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(receivedErrors).toEqual(errorChunks);
    });
  });

  describe('Security and Error Handling', () => {
    test('should validate commands through ErrorHandler', async () => {
      // Mock ErrorHandler to reject dangerous commands
      const originalValidate = ErrorHandler.prototype.validateCommand;
      ErrorHandler.prototype.validateCommand = jest.fn().mockReturnValue({
        isValid: false,
        reason: 'Command contains dangerous patterns'
      });

      const result = await executor.executeCapture('rm -rf /');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('dangerous patterns');
      
      // Restore original method
      ErrorHandler.prototype.validateCommand = originalValidate;
    });

    test('should handle malformed commands gracefully', async () => {
      const result = await executor.executeCapture('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Command cannot be empty');
    });

    test('should handle null/undefined commands', async () => {
      const nullResult = await executor.executeCapture(null);
      expect(nullResult.success).toBe(false);
      
      const undefinedResult = await executor.executeCapture(undefined);
      expect(undefinedResult.success).toBe(false);
    });
  });

  describe('Process Management', () => {
    test('should kill running process when requested', async () => {
      mockChildProcess._options = {
        delay: 5000 // Long delay to test killing
      };

      const resultPromise = executor.executeCapture('long-running-command');
      mockChildProcess.simulate();
      
      // Kill the process after a short delay
      setTimeout(() => {
        executor.kill();
      }, 100);
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(mockChildProcess.killed).toBe(true);
    });

    test('should track process PID', async () => {
      mockChildProcess._options = {
        stdout: 'test',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('test-command');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.pid).toBe(mockChildProcess.pid);
    });
  });
});

