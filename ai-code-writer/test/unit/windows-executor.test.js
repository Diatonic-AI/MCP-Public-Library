/**
 * Unit Tests for WindowsExecutor
 * Tests Windows PowerShell command execution with mocked child_process
 */

const WindowsExecutor = require('../../modules/terminal-backend/windows-executor');
const { spawn } = require('child_process');

// Mock child_process
jest.mock('child_process');

describe('WindowsExecutor', () => {
  let executor;
  let mockChildProcess;
  let MockChildProcess;

  beforeEach(() => {
    MockChildProcess = global.createMockChildProcess();
    mockChildProcess = new MockChildProcess();
    spawn.mockReturnValue(mockChildProcess);
    
    executor = new WindowsExecutor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PowerShell Command Execution', () => {
    test('should execute PowerShell commands correctly', async () => {
      const mockOutput = 'PowerShell output';
      mockChildProcess._options = {
        stdout: mockOutput,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('Get-Date');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(mockOutput);
      
      // Verify PowerShell was called with correct parameters
      expect(spawn).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining([
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy', 'Bypass',
          '-Command'
        ]),
        expect.any(Object)
      );
    });

    test('should handle PowerShell-specific commands', async () => {
      const commands = [
        'Get-Process',
        'Get-Service',
        'Get-ChildItem',
        'Test-Path "C:\\Windows"'
      ];

      for (const command of commands) {
        mockChildProcess._options = {
          stdout: `Output for ${command}`,
          exitCode: 0
        };

        const resultPromise = executor.executeCapture(command);
        mockChildProcess.simulate();
        
        const result = await resultPromise;
        expect(result.success).toBe(true);
        expect(result.stdout).toBe(`Output for ${command}`);
      }
    });

    test('should handle PowerShell errors correctly', async () => {
      const errorMessage = 'Get-InvalidCommand : The term \'Get-InvalidCommand\' is not recognized';
      mockChildProcess._options = {
        stderr: errorMessage,
        exitCode: 1
      };

      const resultPromise = executor.executeCapture('Get-InvalidCommand');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.stderr).toBe(errorMessage);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Command Formatting', () => {
    test('should handle single quotes in commands', async () => {
      mockChildProcess._options = {
        stdout: 'success',
        exitCode: 0
      };

      const command = "echo 'Hello World'";
      const resultPromise = executor.executeCapture(command);
      mockChildProcess.simulate();
      
      await resultPromise;
      
      // Check that the command was properly formatted for PowerShell
      const calledArgs = spawn.mock.calls[0][1];
      const commandArg = calledArgs[calledArgs.length - 1];
      expect(commandArg).toContain(command);
    });

    test('should handle double quotes in commands', async () => {
      mockChildProcess._options = {
        stdout: 'success',
        exitCode: 0
      };

      const command = 'echo "Hello World"';
      const resultPromise = executor.executeCapture(command);
      mockChildProcess.simulate();
      
      await resultPromise;
      
      const calledArgs = spawn.mock.calls[0][1];
      const commandArg = calledArgs[calledArgs.length - 1];
      expect(commandArg).toContain(command);
    });

    test('should handle complex PowerShell pipelines', async () => {
      mockChildProcess._options = {
        stdout: 'pipeline result',
        exitCode: 0
      };

      const command = 'Get-Process | Where-Object {$_.CPU -gt 100} | Sort-Object CPU -Descending';
      const resultPromise = executor.executeCapture(command);
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('pipeline result');
    });
  });

  describe('Working Directory Handling', () => {
    test('should handle Windows paths correctly', async () => {
      const windowsPath = 'C:\\Users\\TestUser\\Documents';
      mockChildProcess._options = {
        stdout: windowsPath,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('Get-Location', { cwd: windowsPath });
      mockChildProcess.simulate();
      
      await resultPromise;
      expect(spawn).toHaveBeenCalledWith(
        'powershell.exe',
        expect.any(Array),
        expect.objectContaining({ cwd: windowsPath })
      );
    });

    test('should handle UNC paths', async () => {
      const uncPath = '\\\\server\\share\\folder';
      mockChildProcess._options = {
        stdout: 'UNC path accessed',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('Get-ChildItem', { cwd: uncPath });
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
    });
  });

  describe('Environment Variables', () => {
    test('should pass Windows environment variables correctly', async () => {
      const windowsEnv = {
        PATH: 'C:\\Windows\\System32;C:\\Windows',
        USERPROFILE: 'C:\\Users\\TestUser',
        TEMP: 'C:\\Temp'
      };
      
      mockChildProcess._options = {
        stdout: 'env vars set',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('$env:PATH', { env: windowsEnv });
      mockChildProcess.simulate();
      
      await resultPromise;
      expect(spawn).toHaveBeenCalledWith(
        'powershell.exe',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining(windowsEnv)
        })
      );
    });

    test('should handle PowerShell environment variable syntax', async () => {
      mockChildProcess._options = {
        stdout: 'C:\\Users\\TestUser',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('echo $env:USERPROFILE');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('C:\\Users\\TestUser');
    });
  });

  describe('PowerShell-specific Features', () => {
    test('should handle PowerShell objects and formatting', async () => {
      const psObjectOutput = `
ProcessName     Id  CPU
-----------     --  ---
chrome        1234  45.2
firefox       5678  23.1
`;
      
      mockChildProcess._options = {
        stdout: psObjectOutput,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('Get-Process | Format-Table ProcessName, Id, CPU');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(psObjectOutput);
    });

    test('should handle PowerShell scripts with multiple commands', async () => {
      const multiLineScript = `
$date = Get-Date
Write-Output "Current date: $date"
Get-Process | Measure-Object
`;
      
      mockChildProcess._options = {
        stdout: 'Script executed successfully',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture(multiLineScript);
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
    });

    test('should handle PowerShell execution policy warnings', async () => {
      const warningMessage = 'Execution policy warning: Running scripts is disabled';
      mockChildProcess._options = {
        stderr: warningMessage,
        stdout: 'Script output',
        exitCode: 0  // PowerShell warnings don't always cause non-zero exit
      };

      const resultPromise = executor.executeCapture('Set-ExecutionPolicy RemoteSigned');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stderr).toBe(warningMessage);
    });
  });

  describe('Error Handling', () => {
    test('should handle PowerShell syntax errors', async () => {
      const syntaxError = 'ParserError: Unexpected token \'{\'...';
      mockChildProcess._options = {
        stderr: syntaxError,
        exitCode: 1
      };

      const resultPromise = executor.executeCapture('if ($true { echo "missing closing brace" }');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('ParserError');
    });

    test('should handle PowerShell module not found errors', async () => {
      const moduleError = 'Import-Module : The specified module \'NonExistentModule\' was not loaded';
      mockChildProcess._options = {
        stderr: moduleError,
        exitCode: 1
      };

      const resultPromise = executor.executeCapture('Import-Module NonExistentModule');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('was not loaded');
    });

    test('should handle PowerShell access denied errors', async () => {
      const accessError = 'Access denied. Administrator privileges required.';
      mockChildProcess._options = {
        stderr: accessError,
        exitCode: 1
      };

      const resultPromise = executor.executeCapture('Stop-Service -Name "ImportantService"');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Access denied');
    });
  });

  describe('Output Encoding', () => {
    test('should handle UTF-8 output correctly', async () => {
      const unicodeOutput = '✓ Success! 测试 тест';
      mockChildProcess._options = {
        stdout: unicodeOutput,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('Write-Output "✓ Success! 测试 тест"');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(unicodeOutput);
    });

    test('should handle Windows line endings', async () => {
      const windowsLineEndings = 'Line 1\r\nLine 2\r\nLine 3';
      mockChildProcess._options = {
        stdout: windowsLineEndings,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('Get-Content somefile.txt');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(windowsLineEndings);
    });
  });
});

