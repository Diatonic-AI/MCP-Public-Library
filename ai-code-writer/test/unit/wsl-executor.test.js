/**
 * Unit Tests for WSLExecutor
 * Tests WSL bash command execution with mocked child_process
 */

const WSLExecutor = require('../../modules/terminal-backend/wsl-executor');
const { spawn } = require('child_process');

// Mock child_process
jest.mock('child_process');

describe('WSLExecutor', () => {
  let executor;
  let mockChildProcess;
  let MockChildProcess;

  beforeEach(() => {
    MockChildProcess = global.createMockChildProcess();
    mockChildProcess = new MockChildProcess();
    spawn.mockReturnValue(mockChildProcess);
    
    executor = new WSLExecutor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('WSL Command Execution', () => {
    test('should execute bash commands in WSL correctly', async () => {
      const mockOutput = 'Linux command output';
      mockChildProcess._options = {
        stdout: mockOutput,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('ls -la');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(mockOutput);
      
      // Verify WSL was called with correct parameters
      expect(spawn).toHaveBeenCalledWith(
        'wsl.exe',
        expect.arrayContaining([
          '--exec',
          'bash',
          '-c'
        ]),
        expect.any(Object)
      );
    });

    test('should handle Linux-specific commands', async () => {
      const commands = [
        'ps aux',
        'df -h',
        'grep -r "pattern" .',
        'find /home -name "*.txt"'
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

    test('should handle bash errors correctly', async () => {
      const errorMessage = 'bash: invalidcommand: command not found';
      mockChildProcess._options = {
        stderr: errorMessage,
        exitCode: 127
      };

      const resultPromise = executor.executeCapture('invalidcommand');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.stderr).toBe(errorMessage);
      expect(result.exitCode).toBe(127);
    });
  });

  describe('Path Translation', () => {
    test('should handle Windows to WSL path translation', async () => {
      mockChildProcess._options = {
        stdout: '/mnt/c/Users/TestUser',
        exitCode: 0
      };

      const windowsPath = 'C:\\Users\\TestUser';
      const resultPromise = executor.executeCapture('pwd', { cwd: windowsPath });
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      
      // Check that WSL was called with the translated path
      const spawnArgs = spawn.mock.calls[0];
      expect(spawnArgs[2]).toEqual(expect.objectContaining({
        cwd: expect.stringMatching(/\/mnt\/c\/Users\/TestUser/)
      }));
    });

    test('should handle drive letter mappings', async () => {
      const driveTests = [
        { windows: 'D:\\Projects', wsl: '/mnt/d/Projects' },
        { windows: 'E:\\Data\\files', wsl: '/mnt/e/Data/files' },
        { windows: 'F:\\backup', wsl: '/mnt/f/backup' }
      ];

      for (const { windows, wsl } of driveTests) {
        mockChildProcess._options = {
          stdout: wsl,
          exitCode: 0
        };

        const resultPromise = executor.executeCapture('pwd', { cwd: windows });
        mockChildProcess.simulate();
        
        const result = await resultPromise;
        expect(result.success).toBe(true);
      }
    });

    test('should handle relative paths correctly', async () => {
      mockChildProcess._options = {
        stdout: './relative/path',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('ls ./relative/path');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('./relative/path');
    });
  });

  describe('Environment Variables', () => {
    test('should pass Linux environment variables correctly', async () => {
      const linuxEnv = {
        PATH: '/usr/local/bin:/usr/bin:/bin',
        HOME: '/home/testuser',
        USER: 'testuser'
      };
      
      mockChildProcess._options = {
        stdout: 'env vars set',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('echo $PATH', { env: linuxEnv });
      mockChildProcess.simulate();
      
      await resultPromise;
      expect(spawn).toHaveBeenCalledWith(
        'wsl.exe',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining(linuxEnv)
        })
      );
    });

    test('should handle bash environment variable syntax', async () => {
      mockChildProcess._options = {
        stdout: '/home/testuser',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('echo $HOME');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('/home/testuser');
    });

    test('should handle exported variables', async () => {
      mockChildProcess._options = {
        stdout: 'custom_value',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('export CUSTOM_VAR=custom_value && echo $CUSTOM_VAR');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('custom_value');
    });
  });

  describe('Bash-specific Features', () => {
    test('should handle bash pipes and redirections', async () => {
      const pipeOutput = 'filtered output';
      mockChildProcess._options = {
        stdout: pipeOutput,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('cat file.txt | grep "pattern" | sort | uniq');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(pipeOutput);
    });

    test('should handle bash command substitution', async () => {
      mockChildProcess._options = {
        stdout: '2024-01-01',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('echo "Today is $(date +%Y-%m-%d)"');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('2024-01-01');
    });

    test('should handle bash functions and loops', async () => {
      const scriptOutput = 'function result';
      mockChildProcess._options = {
        stdout: scriptOutput,
        exitCode: 0
      };

      const bashScript = `
function test_func() {
  echo "function result"
}
test_func
`;

      const resultPromise = executor.executeCapture(bashScript);
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(scriptOutput);
    });

    test('should handle multi-line bash scripts', async () => {
      const multiLineScript = `
#!/bin/bash
set -e
echo "Starting script"
for i in {1..3}; do
  echo "Iteration $i"
done
echo "Script completed"
`;
      
      mockChildProcess._options = {
        stdout: 'Script completed successfully',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture(multiLineScript);
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
    });
  });

  describe('Package Management and System Commands', () => {
    test('should handle apt package commands', async () => {
      mockChildProcess._options = {
        stdout: 'Package installed successfully',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('sudo apt update && apt list --installed');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('Package installed successfully');
    });

    test('should handle system information commands', async () => {
      const systemInfo = 'Linux WSL 5.15.0 #1 SMP';
      mockChildProcess._options = {
        stdout: systemInfo,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('uname -a');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(systemInfo);
    });

    test('should handle file permissions and ownership', async () => {
      mockChildProcess._options = {
        stdout: 'Permissions changed successfully',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('chmod 755 script.sh && chown user:group file.txt');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle bash syntax errors', async () => {
      const syntaxError = 'bash: syntax error near unexpected token `then\'';
      mockChildProcess._options = {
        stderr: syntaxError,
        exitCode: 2
      };

      const resultPromise = executor.executeCapture('if [ "$var" == "value" then echo "invalid syntax"');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('syntax error');
    });

    test('should handle permission denied errors', async () => {
      const permissionError = 'bash: /root/restricted: Permission denied';
      mockChildProcess._options = {
        stderr: permissionError,
        exitCode: 126
      };

      const resultPromise = executor.executeCapture('cat /root/restricted');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Permission denied');
    });

    test('should handle file not found errors', async () => {
      const notFoundError = 'cat: nonexistent.txt: No such file or directory';
      mockChildProcess._options = {
        stderr: notFoundError,
        exitCode: 1
      };

      const resultPromise = executor.executeCapture('cat nonexistent.txt');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('No such file or directory');
    });

    test('should handle WSL not available error', async () => {
      const wslError = new Error('WSL is not installed or not available');
      mockChildProcess._options = {
        error: wslError
      };

      const resultPromise = executor.executeCapture('echo test');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('WSL is not installed');
    });
  });

  describe('Output Encoding and Formatting', () => {
    test('should handle UTF-8 output correctly', async () => {
      const unicodeOutput = '✓ Success! 测试 тест اختبار';
      mockChildProcess._options = {
        stdout: unicodeOutput,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('echo "✓ Success! 测试 тест اختبار"');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(unicodeOutput);
    });

    test('should handle Unix line endings', async () => {
      const unixLineEndings = 'Line 1\nLine 2\nLine 3';
      mockChildProcess._options = {
        stdout: unixLineEndings,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('cat file.txt');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(unixLineEndings);
    });

    test('should handle ANSI color codes', async () => {
      const colorOutput = '\u001b[32mGreen text\u001b[0m \u001b[31mRed text\u001b[0m';
      mockChildProcess._options = {
        stdout: colorOutput,
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('echo -e "\\033[32mGreen text\\033[0m \\033[31mRed text\\033[0m"');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(colorOutput);
    });
  });

  describe('Distribution-specific Commands', () => {
    test('should handle Ubuntu-specific commands', async () => {
      mockChildProcess._options = {
        stdout: 'Ubuntu 20.04.3 LTS',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('lsb_release -a');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('Ubuntu 20.04.3 LTS');
    });

    test('should handle snap package commands', async () => {
      mockChildProcess._options = {
        stdout: 'snap packages listed',
        exitCode: 0
      };

      const resultPromise = executor.executeCapture('snap list');
      mockChildProcess.simulate();
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
    });
  });
});

