/**
 * Test Setup Configuration
 * Provides global test environment setup and teardown for Jest
 */

const Logger = require('./utils/logger');
const { initializeGlobalLogger, closeGlobalLogger } = require('./utils/global-logger');
const ToolRegistryDatabase = require('./modules/tool-registry/tool-registry-database');
const RedisTaskQueue = require('./modules/embeddings/redis-task-queue');
const QdrantTableManager = require('./modules/embeddings/qdrant-table-manager');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

class TestCleanupManager {
  constructor() {
    this.logger = new Logger('TestCleanup');
    this.temporaryDatabases = [];
    this.temporaryCollections = [];
    this.temporaryFiles = [];
    this.activeConnections = [];
    this.keepLogs = process.argv.includes('--keep-logs');
    
    // Track all resources that need cleanup
    this.resources = {
      mongodb: {
        clients: [],
        databases: [],
        collections: []
      },
      redis: {
        connections: [],
        queues: [],
        keys: []
      },
      qdrant: {
        collections: []
      },
      files: {
        temporary: [],
        logs: []
      }
    };
  }

  /**
   * Initialize test environment
   */
  async setupTestEnvironment() {
    try {
      this.logger.info('Setting up test environment...');
      
      // Load environment variables
      require('dotenv').config();
      
      // Verify required environment variables
      await this.verifyEnvironmentVariables();
      
      // Create test-specific configurations
      await this.createTestConfigurations();
      
      this.logger.info('Test environment setup complete');
      return true;
    } catch (error) {
      this.logger.error('Failed to setup test environment:', error.message);
      throw error;
    }
  }

  /**
   * Verify all required environment variables are present
   */
  async verifyEnvironmentVariables() {
    const requiredVars = [
      'MONGODB_URI',
      'REDIS_URL',
      'QDRANT_URL'
    ];
    
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      // Use defaults for testing
      if (!process.env.MONGODB_URI) {
        process.env.MONGODB_URI = 'mongodb://localhost:27017';
      }
      if (!process.env.REDIS_URL) {
        process.env.REDIS_URL = 'redis://localhost:6379';
      }
      if (!process.env.QDRANT_URL) {
        process.env.QDRANT_URL = 'http://localhost:6333';
      }
      
      this.logger.warn(`Using default values for missing environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Create test-specific configurations
   */
  async createTestConfigurations() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    // Create test database names
    this.testDbName = `mcp_test_${timestamp}`;
    this.testCollectionName = `test_executions_${timestamp}`;
    
    // Track for cleanup
    this.resources.mongodb.databases.push(this.testDbName);
    this.resources.mongodb.collections.push(this.testCollectionName);
  }

  /**
   * Register a temporary MongoDB database for cleanup
   */
  registerTemporaryDatabase(dbName, client = null) {
    if (!this.resources.mongodb.databases.includes(dbName)) {
      this.resources.mongodb.databases.push(dbName);
    }
    if (client && !this.resources.mongodb.clients.includes(client)) {
      this.resources.mongodb.clients.push(client);
    }
    this.logger.debug(`Registered temporary database: ${dbName}`);
  }

  /**
   * Register a temporary file for cleanup
   */
  registerTemporaryFile(filePath) {
    if (!this.resources.files.temporary.includes(filePath)) {
      this.resources.files.temporary.push(filePath);
    }
    this.logger.debug(`Registered temporary file: ${filePath}`);
  }

  /**
   * Register a Redis connection for cleanup
   */
  registerRedisConnection(connection) {
    if (!this.resources.redis.connections.includes(connection)) {
      this.resources.redis.connections.push(connection);
    }
    this.logger.debug('Registered Redis connection for cleanup');
  }

  /**
   * Register a Qdrant collection for cleanup
   */
  registerQdrantCollection(collectionName) {
    if (!this.resources.qdrant.collections.includes(collectionName)) {
      this.resources.qdrant.collections.push(collectionName);
    }
    this.logger.debug(`Registered Qdrant collection: ${collectionName}`);
  }

  /**
   * Comprehensive cleanup of all test resources
   */
  async cleanupTestEnvironment() {
    try {
      this.logger.info('Starting comprehensive test cleanup...');
      
      const startTime = Date.now();
      let cleanupResults = {
        mongodb: { databases: 0, collections: 0, connections: 0 },
        redis: { connections: 0, keys: 0 },
        qdrant: { collections: 0 },
        files: { temporary: 0, logs: 0 }
      };

      // Clean MongoDB resources
      await this.cleanupMongoDB(cleanupResults);
      
      // Clean Redis resources
      await this.cleanupRedis(cleanupResults);
      
      // Clean Qdrant resources
      await this.cleanupQdrant(cleanupResults);
      
      // Clean temporary files
      await this.cleanupFiles(cleanupResults);
      
      // Close any remaining connections
      await this.closeAllConnections();
      
      const duration = Date.now() - startTime;
      
      this.logger.info('Test cleanup completed', {
        duration: `${duration}ms`,
        results: cleanupResults
      });
      
      // Log cleanup summary
      this.logCleanupSummary(cleanupResults, duration);
      
      return cleanupResults;
    } catch (error) {
      this.logger.error('Error during test cleanup:', error.message);
      throw error;
    }
  }

  /**
   * Clean up MongoDB databases and collections
   */
  async cleanupMongoDB(results) {
    if (this.keepLogs) {
      this.logger.info('Skipping MongoDB cleanup (--keep-logs flag)');
      return;
    }

    try {
      // Clean up test databases
      for (const dbName of this.resources.mongodb.databases) {
        try {
          const client = new MongoClient(process.env.MONGODB_URI);
          await client.connect();
          
          const db = client.db(dbName);
          await db.dropDatabase();
          
          results.mongodb.databases++;
          this.logger.debug(`Dropped MongoDB database: ${dbName}`);
          
          await client.close();
        } catch (error) {
          this.logger.warn(`Failed to drop database ${dbName}:`, error.message);
        }
      }
      
      // Close all tracked MongoDB connections
      for (const client of this.resources.mongodb.clients) {
        try {
          await client.close();
          results.mongodb.connections++;
        } catch (error) {
          this.logger.warn('Failed to close MongoDB connection:', error.message);
        }
      }
    } catch (error) {
      this.logger.warn('Error during MongoDB cleanup:', error.message);
    }
  }

  /**
   * Clean up Redis connections and test data
   */
  async cleanupRedis(results) {
    if (this.keepLogs) {
      this.logger.info('Skipping Redis cleanup (--keep-logs flag)');
      return;
    }

    try {
      // Create a cleanup connection
      const redis = require('redis');
      const client = redis.createClient({ url: process.env.REDIS_URL });
      await client.connect();
      
      // Clean test-related keys
      const testKeys = await client.keys('*test*');
      const embeddingKeys = await client.keys('embeddings_*');
      const taskKeys = await client.keys('task_*');
      
      const allTestKeys = [...testKeys, ...embeddingKeys, ...taskKeys];
      
      if (allTestKeys.length > 0) {
        await client.del(allTestKeys);
        results.redis.keys = allTestKeys.length;
        this.logger.debug(`Deleted ${allTestKeys.length} Redis test keys`);
      }
      
      await client.disconnect();
      
      // Close tracked connections
      for (const connection of this.resources.redis.connections) {
        try {
          if (connection.isReady) {
            await connection.disconnect();
          }
          results.redis.connections++;
        } catch (error) {
          this.logger.warn('Failed to close Redis connection:', error.message);
        }
      }
    } catch (error) {
      this.logger.warn('Error during Redis cleanup:', error.message);
    }
  }

  /**
   * Clean up Qdrant collections
   */
  async cleanupQdrant(results) {
    if (this.keepLogs) {
      this.logger.info('Skipping Qdrant cleanup (--keep-logs flag)');
      return;
    }

    try {
      const axios = require('axios');
      const baseUrl = process.env.QDRANT_URL;
      
      // Get all collections
      const response = await axios.get(`${baseUrl}/collections`);
      const collections = response.data.result.collections || [];
      
      // Delete test collections (those containing 'test' in name)
      for (const collection of collections) {
        if (collection.name.includes('test') || 
            this.resources.qdrant.collections.includes(collection.name)) {
          try {
            await axios.delete(`${baseUrl}/collections/${collection.name}`);
            results.qdrant.collections++;
            this.logger.debug(`Deleted Qdrant collection: ${collection.name}`);
          } catch (error) {
            this.logger.warn(`Failed to delete collection ${collection.name}:`, error.message);
          }
        }
      }
    } catch (error) {
      this.logger.warn('Error during Qdrant cleanup:', error.message);
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupFiles(results) {
    // Clean temporary files
    for (const filePath of this.resources.files.temporary) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          results.files.temporary++;
          this.logger.debug(`Deleted temporary file: ${filePath}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to delete file ${filePath}:`, error.message);
      }
    }
    
    // Clean log files (unless --keep-logs is specified)
    if (!this.keepLogs) {
      const logFiles = [
        './mongo_logger_config.json',
        './test_demo_file.txt',
        './test-output/test-read.txt'
      ];
      
      for (const logFile of logFiles) {
        try {
          if (fs.existsSync(logFile)) {
            fs.unlinkSync(logFile);
            results.files.logs++;
            this.logger.debug(`Deleted log file: ${logFile}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to delete log file ${logFile}:`, error.message);
        }
      }
    }
  }

  /**
   * Close all remaining connections
   */
  async closeAllConnections() {
    try {
      // Close global logger
      await closeGlobalLogger();
    } catch (error) {
      this.logger.warn('Error closing global logger:', error.message);
    }
  }

  /**
   * Log cleanup summary
   */
  logCleanupSummary(results, duration) {
    console.log('\n' + '='.repeat(60));
    console.log('🧹 Test Cleanup Summary');
    console.log('='.repeat(60));
    
    if (this.keepLogs) {
      console.log('📝 Logs preserved (--keep-logs flag enabled)');
    }
    
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log('\n📊 Resources cleaned:');
    console.log(`   MongoDB:`);
    console.log(`     - Databases: ${results.mongodb.databases}`);
    console.log(`     - Collections: ${results.mongodb.collections}`);
    console.log(`     - Connections: ${results.mongodb.connections}`);
    console.log(`   Redis:`);
    console.log(`     - Connections: ${results.redis.connections}`);
    console.log(`     - Keys: ${results.redis.keys}`);
    console.log(`   Qdrant:`);
    console.log(`     - Collections: ${results.qdrant.collections}`);
    console.log(`   Files:`);
    console.log(`     - Temporary: ${results.files.temporary}`);
    console.log(`     - Logs: ${results.files.logs}`);
    console.log('='.repeat(60));
  }
}

// Global test cleanup manager instance
const testCleanupManager = new TestCleanupManager();

// Jest global setup
module.exports = async () => {
  await testCleanupManager.setupTestEnvironment();
  
  // Make cleanup manager available globally
  global.testCleanupManager = testCleanupManager;
};

// Jest global teardown
module.exports.teardown = async () => {
  if (global.testCleanupManager) {
    await global.testCleanupManager.cleanupTestEnvironment();
  }
};

// Export for manual use
module.exports.TestCleanupManager = TestCleanupManager;
module.exports.testCleanupManager = testCleanupManager;

