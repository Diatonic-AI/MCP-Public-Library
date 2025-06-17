/**
 * Global MongoDB Logger Instance
 * Provides a singleton instance of the MongoDB logger for use across the entire application
 */

const MongoDBLogger = require('./mongodb-logger');

// Create a global singleton instance
let globalLoggerInstance = null;

/**
 * Get the global logger instance
 * @returns {MongoDBLogger}
 */
function getGlobalLogger() {
  if (!globalLoggerInstance) {
    globalLoggerInstance = new MongoDBLogger();
  }
  return globalLoggerInstance;
}

/**
 * Initialize the global logger with specific configuration
 * @param {Object} config - Configuration options
 */
function initializeGlobalLogger(config = {}) {
  if (globalLoggerInstance) {
    console.warn('[GlobalLogger] Logger already initialized, skipping re-initialization');
    return globalLoggerInstance;
  }
  
  globalLoggerInstance = new MongoDBLogger(config);
  return globalLoggerInstance;
}

/**
 * Close the global logger connection
 */
async function closeGlobalLogger() {
  if (globalLoggerInstance) {
    if (globalLoggerInstance.close && typeof globalLoggerInstance.close === 'function') {
      await globalLoggerInstance.close();
    }
    globalLoggerInstance = null;
  }
}

module.exports = {
  getGlobalLogger,
  initializeGlobalLogger,
  closeGlobalLogger
};

