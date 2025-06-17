# Terminal Backend Testing Framework

Comprehensive test suite for the AI Code Writer terminal backend modules with support for unit testing, integration testing, and CI/CD automation.

## Overview

This testing framework provides:

- **Unit Tests**: Mock-based testing of individual components
- **Integration Tests**: Real command execution on multiple platforms
- **Security Testing**: Command validation and error handling
- **Cross-Platform Support**: Windows PowerShell, WSL, Linux, and macOS
- **CI/CD Integration**: GitHub Actions workflows for automated testing

## Test Structure

```
test/
├── unit/                     # Unit tests with mocked dependencies
│   ├── terminal-executor.test.js
│   ├── windows-executor.test.js
│   ├── wsl-executor.test.js
│   └── error-handler.test.js
├── integration/              # Integration tests with real commands
│   └── terminal-backend.integration.test.js
├── jest-setup.js            # Global test setup
├── jest-teardown.js         # Global test cleanup
├── jest-setup-after-env.js  # Test environment configuration
├── test-runner.js           # Custom test runner
└── README.md               # This file
```

## Quick Start

### Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with verbose output
npm run test:verbose
```

### CI/CD Testing

```bash
# Run CI-optimized test suite
npm run test:ci
```

## Test Categories

### Unit Tests

Unit tests use Jest with mocked `child_process` to test:

- **TerminalExecutor**: Base platform detection and command routing
- **WindowsExecutor**: PowerShell command execution
- **WSLExecutor**: WSL bash command execution  
- **ErrorHandler**: Security validation and error normalization

**Key Features:**
- Mocked child processes for predictable testing
- Platform-specific command validation
- Error handling and timeout scenarios
- Security constraint testing

### Integration Tests

Integration tests execute real commands on actual systems:

- **Windows PowerShell**: Tests on `windows-latest` GitHub runners
- **WSL (Windows Subsystem for Linux)**: Tests WSL when available
- **Linux**: Tests on `ubuntu-latest` GitHub runners
- **macOS**: Tests on `macos-latest` GitHub runners

**Test Scenarios:**
- Basic command execution
- File and directory operations
- Environment variable handling
- Streaming output processing
- Error conditions and timeouts
- Path translation (Windows ↔ WSL)

## Test Configuration

### Jest Configuration

The test suite uses a comprehensive Jest configuration:

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testTimeout: 120000,
  globalSetup: './test/jest-setup.js',
  globalTeardown: './test/jest-teardown.js',
  setupFilesAfterEnv: ['./test/jest-setup-after-env.js'],
  // ... additional configuration
};
```

### Environment Variables

Tests automatically detect and configure:

- `TEST_PLATFORM`: Current platform (windows/linux/darwin)
- `TEST_SHELL`: Default shell (powershell/bash)
- `WSL_AVAILABLE`: Whether WSL is available on Windows
- `CI`: Whether running in CI environment

## Platform-Specific Testing

### Windows Testing

- **PowerShell Commands**: `Get-Date`, `Get-Process`, `Get-ChildItem`
- **File Operations**: `Out-File`, `Get-Content`, `Remove-Item`
- **Error Handling**: PowerShell-specific error patterns
- **WSL Integration**: Path translation and command execution

### Linux/Unix Testing

- **Bash Commands**: `ls`, `cat`, `grep`, `find`
- **System Commands**: `ps`, `df`, `uname`
- **Package Management**: `apt` (when available)
- **File Permissions**: `chmod`, `chown`

### WSL Testing

- **Path Translation**: Windows paths to `/mnt/c/...`
- **Environment Mapping**: Windows → Linux environment
- **Cross-System Operations**: File access across filesystems

## Security Testing

Robust security validation includes:

### Dangerous Command Detection

```javascript
const dangerousCommands = [
  'rm -rf /',
  'format c:',
  'del /s /q C:\\*',
  'dd if=/dev/zero of=/dev/sda'
];
```

### Injection Prevention

- Command chaining detection (`&&`, `||`, `;`)
- Code injection patterns (`eval`, `exec`)
- Privilege escalation attempts (`sudo`, `runas`)
- Network communication (`curl | bash`, `wget | sh`)

### Custom Security Rules

```javascript
const customHandler = new ErrorHandler({
  additionalBlacklist: ['custom-dangerous-command'],
  whitelist: ['safe-command'],
  strictMode: true
});
```

## CI/CD Integration

### GitHub Actions Workflow

Automated testing across multiple platforms:

```yaml
strategy:
  matrix:
    os: [windows-latest, ubuntu-latest, macos-latest]
    node-version: [18.x, 20.x]
```

### Test Jobs

1. **Unit Tests**: Fast, mocked tests on all platforms
2. **Integration Tests**: Real command execution
3. **Security Tests**: Focused security validation
4. **Performance Tests**: Timeout and resource testing

### Coverage Reporting

- **Codecov Integration**: Automated coverage uploads
- **Multi-Platform Coverage**: Separate reports per OS
- **Coverage Thresholds**: Configurable minimum coverage

## Mock Utilities

### Mock Child Process Factory

```javascript
const MockChildProcess = global.createMockChildProcess();
const mockProcess = new MockChildProcess({
  stdout: 'test output',
  stderr: 'test error',
  exitCode: 0,
  delay: 100
});
```

### Test Utilities

```javascript
// Create temporary directories
const testDir = await global.testUtils.createTempDir('test-name');

// Wait for conditions
await global.testUtils.waitFor(() => condition, timeout);

// Generate test data
const data = global.testUtils.generateTestData();
```

## Test Development Guidelines

### Writing Unit Tests

1. **Mock Dependencies**: Always mock `child_process`
2. **Test Isolation**: Each test should be independent
3. **Platform Awareness**: Consider platform differences
4. **Error Scenarios**: Test both success and failure paths

### Writing Integration Tests

1. **Real Commands**: Use actual system commands
2. **Platform Guards**: Skip tests on incompatible platforms
3. **Cleanup**: Always clean up created files/directories
4. **Timeouts**: Set appropriate timeouts for real operations

### Example Test Structure

```javascript
describe('TerminalExecutor', () => {
  let executor;
  
  beforeEach(() => {
    executor = new TerminalExecutor();
  });
  
  describe('Platform Detection', () => {
    test('should detect Windows platform', () => {
      // Test implementation
    });
  });
  
  describe('Command Execution', () => {
    test('should execute simple commands', async () => {
      // Test implementation
    });
  });
});
```

## Debugging Tests

### Verbose Mode

```bash
npm run test:verbose
```

### Preserving Test Data

```bash
# Keep temporary files for inspection
KEEP_TEST_FILES=true npm test
```

### Individual Test Execution

```bash
# Run specific test file
npx jest test/unit/terminal-executor.test.js

# Run specific test pattern
npx jest --testNamePattern="should execute commands"
```

## Performance Considerations

### Test Timeouts

- **Short**: 5 seconds (unit tests)
- **Medium**: 15 seconds (simple integration)
- **Long**: 30 seconds (complex integration)

### Parallel Execution

- **CI**: Single worker for stability
- **Local**: CPU count - 1 workers
- **Configurable**: `--max-workers=N`

### Resource Management

- Temporary directory cleanup
- Process termination
- Memory leak detection

## Troubleshooting

### Common Issues

1. **WSL Not Available**: Tests skip gracefully
2. **Permission Errors**: Expected for security tests
3. **Platform Differences**: Use conditional test execution
4. **Timeout Issues**: Adjust timeouts for slow systems

### Debug Commands

```bash
# Check test environment
node -e "console.log(process.platform, process.env.CI)"

# Verify WSL availability (Windows)
wsl --status

# Check Jest configuration
npx jest --showConfig
```

## Contributing

When adding new tests:

1. Follow existing naming conventions
2. Add both unit and integration tests
3. Consider all supported platforms
4. Update this documentation
5. Ensure CI passes on all platforms

## License

This testing framework is part of the AI Code Writer project and follows the same MIT license.

