/**
 * Integration Tests for Terminal Backend
 * Tests with real WSL instances and command execution
 * Requires WSL to be installed for full test coverage
 */

const TerminalExecutor = require('../../modules/terminal-backend/terminal-executor');
const WindowsExecutor = require('../../modules/terminal-backend/windows-executor');
const WSLExecutor = require('../../modules/terminal-backend/wsl-executor');
const ErrorHandler = require('../../modules/terminal-backend/error-handler');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Terminal Backend Integration Tests', () => {
  let testTempDir;
  
  beforeAll(async () => {
    // Create a temporary directory for integration tests
    testTempDir = await global.testUtils.createTempDir('integration-tests');
  });
  
  afterAll(async () => {
    // Cleanup test files
    try {
      await fs.rmdir(testTempDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error.message);
    }
  });

  describe('Platform Detection and Factory', () => {
    test('should create appropriate executor for current platform', () => {
      const executor = new TerminalExecutor();
      
      if (process.platform === 'win32') {
        expect(executor.platform).toBe('windows');
      } else if (process.platform === 'linux') {
        expect(executor.platform).toBe('linux');
      } else if (process.platform === 'darwin') {
        expect(executor.platform).toBe('darwin');
      }
    });

    test('should create Windows executor explicitly', () => {
      const windowsExecutor = new WindowsExecutor();
      expect(windowsExecutor).toBeDefined();
      expect(windowsExecutor.platform).toBe('windows');
    });

    test('should create WSL executor explicitly', () => {
      const wslExecutor = new WSLExecutor();
      expect(wslExecutor).toBeDefined();
      expect(wslExecutor.platform).toBe('wsl');
    });
  });

  describe('Basic Command Execution', () => {
    test('should execute platform-appropriate date command', async () => {
      const executor = new TerminalExecutor();
      const isWindows = process.platform === 'win32';
      const dateCommand = isWindows ? 'Get-Date' : 'date';
      
      const result = await executor.execute(dateCommand);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toBeDefined();
      expect(result.stdout.length).toBeGreaterThan(0);
      expect(result.exitCode).toBe(0);
    }, global.testTimeout.medium);

    test('should execute platform-appropriate directory listing', async () => {
      const executor = new TerminalExecutor();
      const isWindows = process.platform === 'win32';
      const listCommand = isWindows ? 'dir' : 'ls -la';
      
      const result = await executor.execute(listCommand, { cwd: testTempDir });
      
      expect(result.success).toBe(true);
      expect(result.stdout).toBeDefined();
      expect(result.exitCode).toBe(0);
    }, global.testTimeout.medium);

    test('should handle command that produces stderr but succeeds', async () => {
      const executor = new TerminalExecutor();
      const isWindows = process.platform === 'win32';
      
      // Command that might produce warnings but succeeds
      const command = isWindows 
        ? 'Write-Warning "This is a warning"' 
        : 'echo "warning" >&2; echo "success"';
      
      const result = await executor.execute(command);
      
      // Command might succeed despite stderr
      expect(result.exitCode).toBe(0);
      if (result.stderr) {
        expect(result.stderr.length).toBeGreaterThan(0);
      }
    }, global.testTimeout.medium);
  });

  describe('Windows PowerShell Integration', function() {
    // Skip if not on Windows
    const isWindows = process.platform === 'win32';
    
    (isWindows ? describe : describe.skip)('Windows PowerShell Tests', () => {
      let windowsExecutor;
      
      beforeEach(() => {
        windowsExecutor = new WindowsExecutor();
      });

      test('should execute basic PowerShell commands', async () => {
        const result = await windowsExecutor.execute('Get-Location');
        
        expect(result.success).toBe(true);
        expect(result.stdout).toBeDefined();
        expect(result.exitCode).toBe(0);
      }, global.testTimeout.medium);

      test('should handle PowerShell object output', async () => {
        const result = await windowsExecutor.execute('Get-Process | Select-Object -First 5 ProcessName, Id');
        
        expect(result.success).toBe(true);
        expect(result.stdout).toBeDefined();
        expect(result.stdout).toContain('ProcessName');
      }, global.testTimeout.medium);

      test('should handle PowerShell environment variables', async () => {
        const result = await windowsExecutor.execute('echo $env:USERPROFILE');
        
        expect(result.success).toBe(true);
        expect(result.stdout).toBeDefined();
        expect(result.stdout.trim().length).toBeGreaterThan(0);
      }, global.testTimeout.medium);

      test('should handle PowerShell pipelines', async () => {
        const result = await windowsExecutor.execute(
          'Get-ChildItem | Where-Object { $_.Name -like "*.js" } | Measure-Object'
        );
        
        expect(result.success).toBe(true);
        expect(result.stdout).toBeDefined();
      }, global.testTimeout.medium);

      test('should create and manipulate files', async () => {
        const testFile = path.join(testTempDir, 'test-ps.txt');
        const testContent = 'PowerShell test content';
        
        // Create file
        const createResult = await windowsExecutor.execute(
          `'${testContent}' | Out-File -FilePath '${testFile}' -Encoding UTF8`
        );
        expect(createResult.success).toBe(true);
        
        // Read file
        const readResult = await windowsExecutor.execute(`Get-Content '${testFile}'`);
        expect(readResult.success).toBe(true);
        expect(readResult.stdout.trim()).toBe(testContent);
        
        // Cleanup
        await windowsExecutor.execute(`Remove-Item '${testFile}'`);
      }, global.testTimeout.medium);
    });
  });

  describe('WSL Integration', function() {
    // Only run if WSL is available
    const wslAvailable = global.testConfig.wslAvailable;
    
    (wslAvailable ? describe : describe.skip)('WSL Tests', () => {
      let wslExecutor;
      
      beforeEach(() => {
        wslExecutor = new WSLExecutor();
      });

      test('should execute basic bash commands in WSL', async () => {
        const result = await wslExecutor.execute('pwd');
        
        expect(result.success).toBe(true);
        expect(result.stdout).toBeDefined();
        expect(result.stdout.trim().startsWith('/')).toBe(true); // Unix path
        expect(result.exitCode).toBe(0);
      }, global.testTimeout.medium);

      test('should handle Linux environment variables', async () => {
        const result = await wslExecutor.execute('echo $HOME');
        
        expect(result.success).toBe(true);
        expect(result.stdout).toBeDefined();
        expect(result.stdout.trim().startsWith('/home')).toBe(true);
      }, global.testTimeout.medium);

      test('should handle bash pipes and redirections', async () => {
        const result = await wslExecutor.execute('echo "line1\nline2\nline3" | grep "line2"');
        
        expect(result.success).toBe(true);
        expect(result.stdout.trim()).toBe('line2');
      }, global.testTimeout.medium);

      test('should handle path translation from Windows to WSL', async () => {
        // Test with a Windows path
        const windowsPath = 'C:\\Users';
        const result = await wslExecutor.execute('pwd', { cwd: windowsPath });
        
        expect(result.success).toBe(true);
        // Should translate to /mnt/c/Users or similar
        expect(result.stdout).toContain('/mnt/c');
      }, global.testTimeout.medium);

      test('should create and manipulate files in WSL', async () => {
        const testFile = '/tmp/wsl-test.txt';
        const testContent = 'WSL test content';
        
        // Create file
        const createResult = await wslExecutor.execute(`echo '${testContent}' > ${testFile}`);
        expect(createResult.success).toBe(true);
        
        // Read file
        const readResult = await wslExecutor.execute(`cat ${testFile}`);
        expect(readResult.success).toBe(true);
        expect(readResult.stdout.trim()).toBe(testContent);
        
        // Cleanup
        await wslExecutor.execute(`rm ${testFile}`);
      }, global.testTimeout.medium);

      test('should handle system information commands', async () => {
        const result = await wslExecutor.execute('uname -a');
        
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('Linux');
        expect(result.stdout).toContain('WSL');
      }, global.testTimeout.medium);

      test('should handle package management commands (if available)', async () => {
        // Test if apt is available (Ubuntu/Debian)
        const result = await wslExecutor.execute('which apt || echo "apt not available"');
        
        expect(result.success).toBe(true);
        expect(result.stdout).toBeDefined();
        
        if (result.stdout.includes('/usr/bin/apt')) {
          // If apt is available, test listing packages
          const listResult = await wslExecutor.execute('apt list --installed 2>/dev/null | head -5');
          expect(listResult.success).toBe(true);
        }
      }, global.testTimeout.long);
    });
  });

  describe('Error Handling and Security', () => {
    test('should handle non-existent commands gracefully', async () => {
      const executor = new TerminalExecutor();
      const result = await executor.execute('this-command-does-not-exist');
      
      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(result.error || result.stderr).toBeDefined();
    }, global.testTimeout.short);

    test('should enforce security restrictions', async () => {
      const executor = new TerminalExecutor();
      const dangerousCommands = [
        'rm -rf /',
        'format c:',
        'del /s /q C:\\*'
      ];
      
      for (const command of dangerousCommands) {
        const result = await executor.execute(command);
        expect(result.success).toBe(false);
        expect(result.error).toContain('dangerous');
      }
    }, global.testTimeout.short);

    test('should handle timeout for long-running commands', async () => {
      const executor = new TerminalExecutor();
      const isWindows = process.platform === 'win32';
      
      // Command that sleeps for a long time
      const sleepCommand = isWindows 
        ? 'Start-Sleep -Seconds 10' 
        : 'sleep 10';
      
      const startTime = Date.now();
      const result = await executor.execute(sleepCommand, { timeout: 2000 }); // 2 second timeout
      const elapsed = Date.now() - startTime;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(elapsed).toBeLessThan(3000); // Should timeout before 3 seconds
    }, global.testTimeout.short);

    test('should handle permission denied errors appropriately', async () => {
      const executor = new TerminalExecutor();
      const isWindows = process.platform === 'win32';
      
      // Command that typically requires elevated permissions
      const restrictedCommand = isWindows 
        ? 'Stop-Service -Name "Spooler"'  // Requires admin rights
        : 'cat /etc/shadow';               // Requires root
      
      const result = await executor.execute(restrictedCommand);
      
      // Should either be blocked by security or fail with permission error
      expect(result.success).toBe(false);
      if (result.error) {
        expect(result.error.toLowerCase()).toMatch(/(permission|access|denied|privilege)/i);
      } else if (result.stderr) {
        expect(result.stderr.toLowerCase()).toMatch(/(permission|access|denied|privilege)/i);
      }
    }, global.testTimeout.medium);
  });

  describe('Directory and File Operations', () => {
    test('should handle working directory changes', async () => {
      const executor = new TerminalExecutor();
      const isWindows = process.platform === 'win32';
      const pwdCommand = isWindows ? 'Get-Location' : 'pwd';
      
      // Test execution in different working directory
      const result = await executor.execute(pwdCommand, { cwd: testTempDir });
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(path.basename(testTempDir));
    }, global.testTimeout.medium);

    test('should create and read files correctly', async () => {
      const executor = new TerminalExecutor();
      const isWindows = process.platform === 'win32';
      const testFile = path.join(testTempDir, 'integration-test.txt');
      const testContent = 'Integration test content\nLine 2\nLine 3';
      
      // Create file with content
      let createCommand;
      if (isWindows) {
        createCommand = `@'
${testContent}
'@ | Out-File -FilePath '${testFile}' -Encoding UTF8`;
      } else {
        createCommand = `cat > '${testFile}' << 'EOF'\n${testContent}\nEOF`;
      }
      
      const createResult = await executor.execute(createCommand);
      expect(createResult.success).toBe(true);
      
      // Read file content
      const readCommand = isWindows 
        ? `Get-Content '${testFile}'`
        : `cat '${testFile}'`;
      
      const readResult = await executor.execute(readCommand);
      expect(readResult.success).toBe(true);
      expect(readResult.stdout).toContain('Integration test content');
      expect(readResult.stdout).toContain('Line 2');
      
      // Cleanup
      const deleteCommand = isWindows 
        ? `Remove-Item '${testFile}'`
        : `rm '${testFile}'`;
      await executor.execute(deleteCommand);
    }, global.testTimeout.medium);
  });

  describe('Streaming and Real-time Output', () => {
    test('should handle streaming output correctly', async () => {
      const executor = new TerminalExecutor();
      const receivedChunks = [];
      const isWindows = process.platform === 'win32';
      
      // Command that produces output in chunks
      const streamCommand = isWindows 
        ? '1..5 | ForEach-Object { Write-Output "Chunk $_"; Start-Sleep -Milliseconds 100 }'
        : 'for i in {1..5}; do echo "Chunk $i"; sleep 0.1; done';
      
      const result = await executor.execute(streamCommand, {
        onStdout: (chunk) => receivedChunks.push(chunk.toString())
      });
      
      expect(result.success).toBe(true);
      expect(receivedChunks.length).toBeGreaterThan(0);
      
      // Verify we received streaming data
      const allOutput = receivedChunks.join('');
      expect(allOutput).toContain('Chunk 1');
      expect(allOutput).toContain('Chunk 5');
    }, global.testTimeout.long);

    test('should handle both stdout and stderr streaming', async () => {
      const executor = new TerminalExecutor();
      const stdoutChunks = [];
      const stderrChunks = [];
      const isWindows = process.platform === 'win32';
      
      // Command that outputs to both stdout and stderr
      const mixedCommand = isWindows 
        ? 'Write-Output "stdout message"; Write-Error "stderr message" 2>&1'
        : 'echo "stdout message"; echo "stderr message" >&2';
      
      const result = await executor.execute(mixedCommand, {
        onStdout: (chunk) => stdoutChunks.push(chunk.toString()),
        onStderr: (chunk) => stderrChunks.push(chunk.toString())
      });
      
      // Command should complete (may succeed or fail depending on platform)
      expect(result).toBeDefined();
      
      // Should have received some output
      const hasStdout = stdoutChunks.length > 0;
      const hasStderr = stderrChunks.length > 0;
      expect(hasStdout || hasStderr).toBe(true);
      
      if (hasStdout) {
        expect(stdoutChunks.join('')).toContain('stdout message');
      }
    }, global.testTimeout.medium);
  });
});

