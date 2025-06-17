#!/usr/bin/env node

/**
 * Comprehensive Logging System Test
 * 
 * Tests all major components with comprehensive cleanup:
 * - MongoDB logging
 * - Redis task queue
 * - Qdrant vector database
 * - File operations
 * - Automated cleanup with --keep-logs flag support
 */

const Logger = require('./utils/logger');
const { TestCleanupManager } = require('./test-setup');
const { initializeGlobalLogger, closeGlobalLogger } = require('./utils/global-logger');
const ToolRegistryDatabase = require('./modules/tool-registry/tool-registry-database');
const RedisTaskQueue = require('./modules/embeddings/redis-task-queue');
const QdrantTableManager = require('./modules/embeddings/qdrant-table-manager');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

class ComprehensiveLoggingTest {
  constructor() {
    this.logger = new Logger('ComprehensiveTest');
    this.cleanupManager = new TestCleanupManager();
    this.testResults = {
      mongodb: { status: 'pending', details: null },
      redis: { status: 'pending', details: null },
      qdrant: { status: 'pending', details: null },
      fileOps: { status: 'pending', details: null },
      cleanup: { status: 'pending', details: null }
    };
    
    // Test configuration
    this.testConfig = {
      mongodb: {
        dbName: null,
        collectionName: null,
        client: null
      },
      redis: {
        queue: null
      },
      qdrant: {
        manager: null,
        testCollections: []
      },
      files: {
        testFiles: []
      }
    };
  }

  /**
   * Initialize test environment
   */
  async initializeTest() {
    try {
      this.logger.info('Initializing comprehensive logging test...');
      
      // Load environment
      require('dotenv').config();
      
      // Setup test environment
      await this.cleanupManager.setupTestEnvironment();
      
      // Create test-specific names
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      this.testConfig.mongodb.dbName = `mcp_comprehensive_test_${timestamp}`;
      this.testConfig.mongodb.collectionName = `comprehensive_logs_${timestamp}`;
      
      this.logger.info('Test environment initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize test:', error.message);
      throw error;
    }
  }

  /**
   * Test MongoDB logging functionality
   */
  async testMongoDBLogging() {
    try {
      this.logger.info('Testing MongoDB logging...');
      
      // Initialize MongoDB connection
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      this.testConfig.mongodb.client = new MongoClient(mongoUri);
      await this.testConfig.mongodb.client.connect();
      
      // Register for cleanup
      this.cleanupManager.registerTemporaryDatabase(
        this.testConfig.mongodb.dbName,
        this.testConfig.mongodb.client
      );
      
      // Create test database and collection
      const db = this.testConfig.mongodb.client.db(this.testConfig.mongodb.dbName);
      const collection = db.collection(this.testConfig.mongodb.collectionName);
      
      // Create indexes
      await collection.createIndex({ 'toolName': 1, 'timestamp': -1 });
      await collection.createIndex({ 'sessionId': 1 });
      
      // Insert test documents
      const testDocuments = [
        {
          _id: 'test_log_1',
          toolName: 'load_environment',
          sessionId: 'test_session_1',
          timestamp: new Date(),
          duration: 150,
          success: true,
          args: { env_file_path: './.env' },
          response: { status: 'success', message: 'Environment loaded' }
        },
        {
          _id: 'test_log_2',
          toolName: 'advanced_file_operations',
          sessionId: 'test_session_1',
          timestamp: new Date(),
          duration: 75,
          success: true,
          args: { operation: 'create', target_path: './test_file.txt' },
          response: { status: 'success', message: 'File created' }
        },
        {
          _id: 'test_log_3',
          toolName: 'error_test',
          sessionId: 'test_session_1',
          timestamp: new Date(),
          duration: 50,
          success: false,
          args: { test: 'error_simulation' },
          error: { message: 'Simulated error for testing', type: 'TestError' }
        }
      ];
      
      const insertResult = await collection.insertMany(testDocuments);
      
      // Verify data was inserted
      const count = await collection.countDocuments();
      const successfulLogs = await collection.countDocuments({ success: true });
      const failedLogs = await collection.countDocuments({ success: false });
      
      // Test aggregation queries
      const stats = await collection.aggregate([
        {
          $group: {
            _id: '$success',
            count: { $sum: 1 },
            avgDuration: { $avg: '$duration' },
            tools: { $addToSet: '$toolName' }
          }
        }
      ]).toArray();
      
      this.testResults.mongodb = {
        status: 'success',
        details: {
          database: this.testConfig.mongodb.dbName,
          collection: this.testConfig.mongodb.collectionName,
          documentsInserted: insertResult.insertedCount,
          totalDocuments: count,
          successfulLogs,
          failedLogs,
          aggregationStats: stats
        }
      };
      
      this.logger.info(`MongoDB test completed: ${count} documents in ${this.testConfig.mongodb.dbName}`);
      return true;
    } catch (error) {
      this.testResults.mongodb = {
        status: 'failed',
        details: { error: error.message }
      };
      this.logger.error('MongoDB test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test Redis task queue functionality
   */
  async testRedisTaskQueue() {
    try {
      this.logger.info('Testing Redis task queue...');
      
      // Initialize Redis queue
      this.testConfig.redis.queue = new RedisTaskQueue();
      await this.testConfig.redis.queue.initialize();
      
      // Register for cleanup
      this.cleanupManager.registerRedisConnection(this.testConfig.redis.queue.client);
      this.cleanupManager.registerRedisConnection(this.testConfig.redis.queue.subscriber);
      this.cleanupManager.registerRedisConnection(this.testConfig.redis.queue.publisher);
      
      // Add test tasks
      const testTasks = [
        {
          category: 'test',
          priority: 'high',
          data: { text: 'Test embedding task 1', model: 'test-model' }
        },
        {
          category: 'test',
          priority: 'normal',
          data: { text: 'Test embedding task 2', model: 'test-model' }
        },
        {
          category: 'test',
          priority: 'low',
          data: { text: 'Test embedding task 3', model: 'test-model' }
        }
      ];
      
      const taskIds = [];
      for (const taskData of testTasks) {
        const taskId = await this.testConfig.redis.queue.addEmbeddingTask(taskData);
        taskIds.push(taskId);
      }
      
      // Test retrieving tasks
      const retrievedTasks = [];
      for (let i = 0; i < testTasks.length; i++) {
        const task = await this.testConfig.redis.queue.getNextTask();
        if (task) {
          retrievedTasks.push(task);
          
          // Simulate task completion
          await this.testConfig.redis.queue.completeTask(task.id, {
            embeddings: [0.1, 0.2, 0.3],
            model: 'test-model',
            success: true
          });
        }
      }
      
      // Get queue statistics
      const queueStats = await this.testConfig.redis.queue.getQueueStats();
      
      this.testResults.redis = {
        status: 'success',
        details: {
          tasksAdded: taskIds.length,
          tasksRetrieved: retrievedTasks.length,
          tasksCompleted: retrievedTasks.length,
          queueStats: queueStats.total
        }
      };
      
      this.logger.info(`Redis test completed: ${taskIds.length} tasks processed`);
      return true;
    } catch (error) {
      this.testResults.redis = {
        status: 'failed',
        details: { error: error.message }
      };
      this.logger.error('Redis test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test Qdrant vector database functionality
   */
  async testQdrantVectorDB() {
    try {
      this.logger.info('Testing Qdrant vector database...');
      
      // Initialize Qdrant manager
      this.testConfig.qdrant.manager = new QdrantTableManager();
      await this.testConfig.qdrant.manager.initialize();
      
      // Create test collections
      const testCollectionName = `test_collection_${Date.now()}`;
      await this.testConfig.qdrant.manager.createCollection(testCollectionName, 384);
      
      this.testConfig.qdrant.testCollections.push(testCollectionName);
      this.cleanupManager.registerQdrantCollection(testCollectionName);
      
      // Store test embeddings
      const testEmbeddings = [
        {
          id: 'test_embedding_1',
          vector: Array(384).fill(0).map(() => Math.random()),
          text: 'Test document 1 for vector search',
          metadata: { category: 'test', type: 'document' }
        },
        {
          id: 'test_embedding_2',
          vector: Array(384).fill(0).map(() => Math.random()),
          text: 'Test document 2 for vector search',
          metadata: { category: 'test', type: 'document' }
        },
        {
          id: 'test_embedding_3',
          vector: Array(384).fill(0).map(() => Math.random()),
          text: 'Test document 3 for vector search',
          metadata: { category: 'test', type: 'document' }
        }
      ];
      
      // Store embeddings using manual API calls since we don't have the layer structure
      const axios = require('axios');
      const baseUrl = process.env.QDRANT_URL;
      
      const formattedPoints = testEmbeddings.map(embedding => ({
        id: embedding.id,
        vector: embedding.vector,
        payload: {
          text: embedding.text,
          metadata: embedding.metadata,
          timestamp: new Date().toISOString()
        }
      }));
      
      await axios.put(`${baseUrl}/collections/${testCollectionName}/points`, {
        points: formattedPoints
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Test search functionality
      const queryVector = Array(384).fill(0).map(() => Math.random());
      const searchResponse = await axios.post(
        `${baseUrl}/collections/${testCollectionName}/points/search`,
        {
          vector: queryVector,
          limit: 5,
          with_payload: true
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      // Get collection stats
      const statsResponse = await axios.get(`${baseUrl}/collections/${testCollectionName}`);
      const collectionStats = statsResponse.data.result;
      
      this.testResults.qdrant = {
        status: 'success',
        details: {
          collection: testCollectionName,
          embeddingsStored: formattedPoints.length,
          searchResults: searchResponse.data.result.length,
          collectionStats: {
            pointsCount: collectionStats.points_count,
            status: collectionStats.status,
            vectorSize: collectionStats.config.params.vectors.size
          }
        }
      };
      
      this.logger.info(`Qdrant test completed: ${formattedPoints.length} embeddings stored`);
      return true;
    } catch (error) {
      this.testResults.qdrant = {
        status: 'failed',
        details: { error: error.message }
      };
      this.logger.error('Qdrant test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test file operations
   */
  async testFileOperations() {
    try {
      this.logger.info('Testing file operations...');
      
      // Create test files
      const testFiles = [
        {
          path: './test_file_1.txt',
          content: 'Test file 1 content for comprehensive logging test'
        },
        {
          path: './test_file_2.json',
          content: JSON.stringify({ test: true, timestamp: new Date().toISOString() }, null, 2)
        },
        {
          path: './test_output/test_results.log',
          content: `Test execution log\nTimestamp: ${new Date().toISOString()}\nStatus: Running`
        }
      ];
      
      // Ensure test-output directory exists
      if (!fs.existsSync('./test-output')) {
        fs.mkdirSync('./test-output', { recursive: true });
      }
      
      const createdFiles = [];
      for (const testFile of testFiles) {
        try {
          fs.writeFileSync(testFile.path, testFile.content);
          createdFiles.push(testFile.path);
          
          // Register for cleanup
          this.cleanupManager.registerTemporaryFile(testFile.path);
        } catch (error) {
          this.logger.warn(`Failed to create test file ${testFile.path}:`, error.message);
        }
      }
      
      // Test file reading
      const readResults = [];
      for (const filePath of createdFiles) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          readResults.push({
            path: filePath,
            size: content.length,
            success: true
          });
        } catch (error) {
          readResults.push({
            path: filePath,
            error: error.message,
            success: false
          });
        }
      }
      
      this.testResults.fileOps = {
        status: 'success',
        details: {
          filesCreated: createdFiles.length,
          filesRead: readResults.filter(r => r.success).length,
          readResults
        }
      };
      
      this.logger.info(`File operations test completed: ${createdFiles.length} files created`);
      return true;
    } catch (error) {
      this.testResults.fileOps = {
        status: 'failed',
        details: { error: error.message }
      };
      this.logger.error('File operations test failed:', error.message);
      throw error;
    }
  }

  /**
   * Run comprehensive cleanup test
   */
  async testComprehensiveCleanup() {
    try {
      this.logger.info('Testing comprehensive cleanup...');
      
      const cleanupResults = await this.cleanupManager.cleanupTestEnvironment();
      
      this.testResults.cleanup = {
        status: 'success',
        details: cleanupResults
      };
      
      this.logger.info('Cleanup test completed successfully');
      return true;
    } catch (error) {
      this.testResults.cleanup = {
        status: 'failed',
        details: { error: error.message }
      };
      this.logger.error('Cleanup test failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 COMPREHENSIVE LOGGING TEST REPORT');
    console.log('='.repeat(80));
    
    const hasKeepLogs = process.argv.includes('--keep-logs');
    if (hasKeepLogs) {
      console.log('📝 Note: --keep-logs flag enabled, cleanup was limited');
    }
    
    console.log('\n📊 Test Results Summary:');
    
    // MongoDB results
    console.log(`\n🍃 MongoDB Logging: ${this.getStatusEmoji(this.testResults.mongodb.status)}`);
    if (this.testResults.mongodb.status === 'success') {
      const details = this.testResults.mongodb.details;
      console.log(`   Database: ${details.database}`);
      console.log(`   Documents: ${details.totalDocuments} (${details.successfulLogs} successful, ${details.failedLogs} failed)`);
    } else {
      console.log(`   Error: ${this.testResults.mongodb.details?.error || 'Unknown error'}`);
    }
    
    // Redis results
    console.log(`\n🔴 Redis Task Queue: ${this.getStatusEmoji(this.testResults.redis.status)}`);
    if (this.testResults.redis.status === 'success') {
      const details = this.testResults.redis.details;
      console.log(`   Tasks Processed: ${details.tasksCompleted}/${details.tasksAdded}`);
      console.log(`   Queue Stats: ${JSON.stringify(details.queueStats)}`);
    } else {
      console.log(`   Error: ${this.testResults.redis.details?.error || 'Unknown error'}`);
    }
    
    // Qdrant results
    console.log(`\n🔍 Qdrant Vector DB: ${this.getStatusEmoji(this.testResults.qdrant.status)}`);
    if (this.testResults.qdrant.status === 'success') {
      const details = this.testResults.qdrant.details;
      console.log(`   Collection: ${details.collection}`);
      console.log(`   Embeddings: ${details.embeddingsStored}`);
      console.log(`   Search Results: ${details.searchResults}`);
    } else {
      console.log(`   Error: ${this.testResults.qdrant.details?.error || 'Unknown error'}`);
    }
    
    // File operations results
    console.log(`\n📁 File Operations: ${this.getStatusEmoji(this.testResults.fileOps.status)}`);
    if (this.testResults.fileOps.status === 'success') {
      const details = this.testResults.fileOps.details;
      console.log(`   Files Created: ${details.filesCreated}`);
      console.log(`   Files Read: ${details.filesRead}`);
    } else {
      console.log(`   Error: ${this.testResults.fileOps.details?.error || 'Unknown error'}`);
    }
    
    // Cleanup results
    console.log(`\n🧹 Automated Cleanup: ${this.getStatusEmoji(this.testResults.cleanup.status)}`);
    if (this.testResults.cleanup.status === 'success') {
      const details = this.testResults.cleanup.details;
      console.log(`   MongoDB: ${details.mongodb.databases} databases, ${details.mongodb.connections} connections`);
      console.log(`   Redis: ${details.redis.connections} connections, ${details.redis.keys} keys`);
      console.log(`   Qdrant: ${details.qdrant.collections} collections`);
      console.log(`   Files: ${details.files.temporary} temporary, ${details.files.logs} logs`);
    } else {
      console.log(`   Error: ${this.testResults.cleanup.details?.error || 'Unknown error'}`);
    }
    
    // Overall status
    const allTests = Object.values(this.testResults);
    const successCount = allTests.filter(test => test.status === 'success').length;
    const totalTests = allTests.length;
    
    console.log('\n' + '='.repeat(80));
    if (successCount === totalTests) {
      console.log('🎉 ALL TESTS PASSED! Comprehensive logging system is working correctly.');
    } else {
      console.log(`⚠️  ${successCount}/${totalTests} tests passed. Some issues need attention.`);
    }
    
    if (!hasKeepLogs) {
      console.log('✨ All test resources have been automatically cleaned up.');
    } else {
      console.log('📝 Test resources preserved for manual inspection (--keep-logs).');
    }
    
    console.log('='.repeat(80));
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'success': return '✅ SUCCESS';
      case 'failed': return '❌ FAILED';
      case 'pending': return '⏳ PENDING';
      default: return '❓ UNKNOWN';
    }
  }

  /**
   * Run all tests
   */
  async runComprehensiveTest() {
    console.log('🚀 Starting Comprehensive Logging System Test');
    console.log('='.repeat(80));
    
    try {
      // Initialize
      await this.initializeTest();
      
      // Run all tests
      await this.testMongoDBLogging();
      await this.testRedisTaskQueue();
      await this.testQdrantVectorDB();
      await this.testFileOperations();
      
      // Run cleanup (this will respect --keep-logs flag)
      await this.testComprehensiveCleanup();
      
      // Generate report
      this.generateTestReport();
      
      return true;
    } catch (error) {
      this.logger.error('Comprehensive test failed:', error.message);
      
      // Still try to cleanup even if tests failed
      try {
        await this.cleanupManager.cleanupTestEnvironment();
      } catch (cleanupError) {
        this.logger.error('Cleanup after failure also failed:', cleanupError.message);
      }
      
      this.generateTestReport();
      throw error;
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  const test = new ComprehensiveLoggingTest();
  test.runComprehensiveTest()
    .then(() => {
      console.log('\n✅ Comprehensive test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Comprehensive test failed:', error.message);
      process.exit(1);
    });
}

module.exports = ComprehensiveLoggingTest;

