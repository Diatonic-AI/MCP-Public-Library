/**
 * Basic Jest Test
 * Simple test to verify Jest setup is working
 */

describe('Basic Test Suite', () => {
  test('should verify Jest environment is working', () => {
    expect(true).toBe(true);
  });
  
  test('should have access to global test utilities', () => {
    expect(global.testConfig).toBeDefined();
    expect(global.testUtils).toBeDefined();
    expect(global.testTimeout).toBeDefined();
  });
  
  test('should have proper environment variables set', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.TEST_MODE).toBe('true');
  });
  
  test('should have platform detection working', () => {
    expect(global.testConfig.platform).toBeDefined();
    expect(['windows', 'unix']).toContain(global.testConfig.platform);
  });
  
  test('should be able to use test utilities', async () => {
    const testData = global.testUtils.generateTestData();
    expect(testData.randomString()).toMatch(/^[a-z0-9]+$/);
    expect(testData.safeTestCommand()).toBeDefined();
  });
});

