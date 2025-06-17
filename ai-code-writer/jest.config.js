module.exports = {
  testEnvironment: 'node',
  testTimeout: 120000, // 120 seconds for comprehensive tests
  globalSetup: '<rootDir>/test/jest-setup.js',
  globalTeardown: '<rootDir>/test/jest-teardown.js',
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup-after-env.js'],
  collectCoverage: false,
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'modules/**/*.js',
    '!modules/**/node_modules/**',
    '!**/test/**',
    '!**/*.test.js',
    '!**/*.spec.js'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testMatch: [
    '<rootDir>/test/**/*.test.js',
    '<rootDir>/test/**/*.spec.js',
    '**/test-comprehensive-logging.js'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/'
  ],
  forceExit: true,
  detectOpenHandles: true,
  // Enable test isolation
  maxWorkers: 1,
  // Clean up after each test
  clearMocks: true,
  restoreMocks: true,
  // Add module name mapping for better test isolation
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@test/(.*)$': '<rootDir>/test/$1'
  }
};

