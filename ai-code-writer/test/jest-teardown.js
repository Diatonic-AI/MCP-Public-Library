/**
 * Jest Global Teardown
 * Cleans up test environment and resources
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('🧹 Cleaning up Jest test environment...');
  
  // Clean up temporary test directory
  if (process.env.TEST_TEMP_DIR) {
    try {
      await fs.rmdir(process.env.TEST_TEMP_DIR, { recursive: true });
      console.log(`🗑️ Removed test temp directory: ${process.env.TEST_TEMP_DIR}`);
    } catch (error) {
      console.warn(`⚠️ Failed to clean up temp directory: ${error.message}`);
    }
  }
  
  // Clean up any lingering processes or resources
  if (global.testCleanupFunctions) {
    for (const cleanup of global.testCleanupFunctions) {
      try {
        await cleanup();
      } catch (error) {
        console.warn(`⚠️ Cleanup function failed: ${error.message}`);
      }
    }
  }
  
  console.log('✅ Jest test environment cleaned up');
};

