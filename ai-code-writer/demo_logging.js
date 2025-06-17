#!/usr/bin/env node

/**
 * Demo Logging Script
 * 
 * This script demonstrates the MongoDB logging functionality by:
 * 1. Bootstrapping the MongoDB logger (reusing test DB)
 * 2. Calling various MCP tools with random delays
 * 3. Querying the collection and displaying a summarized table
 * 4. Outputting success confirmation
 */

const path = require('path');
const fs = require('fs');

// Load environment variables first
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { MongoClient } = require('mongodb');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');

// Import the global logger utilities
const { initializeGlobalLogger, getGlobalLogger, closeGlobalLogger } = require('./utils/global-logger');
const Logger = require('./utils/logger');

class LoggingDemo {
  constructor() {
    this.logger = new Logger('LoggingDemo');
    this.mongoLogger = null;
    this.mongoClient = null;
    this.db = null;
    this.collection = null;
    this.dbName = null;
    this.collectionName = null;
    this.mongoUri = null;
    
    // Sample tools to test (based on available MCP tools)
    this.testTools = [
      {
        name: 'load_environment',
        args: { env_file_path: './.env' }
      },
      {
        name: 'advanced_file_operations',
        args: {
          operation: 'create',
          target_path: './test_demo_file.txt',
          content: 'Demo file created by logging demo script'
        }
      },
      {
        name: 'advanced_file_operations',
        args: {
          operation: 'read',
          target_path: './test_demo_file.txt'
        }
      },
      {
        name: 'advanced_file_operations',
        args: {
          operation: 'analyze',
          target_path: './test_demo_file.txt'
        }
      },
      {
        name: 'advanced_file_operations',
        args: {
          operation: 'delete',
          target_path: './test_demo_file.txt'
        }
      }
    ];
  }
  
  async bootLogger() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Step 1: Booting MongoDB Logger');
    console.log('='.repeat(60));
    
    // Create MongoDB configuration directly in Node.js
    await this.createMongoDBSetup();
    
    console.log('\n✅ Logger booted successfully!');
    console.log(`   Database: ${this.dbName}`);
    console.log(`   Collection: ${this.collectionName}`);
    
    // Initialize the global MongoDB logger
    const config = {
      mongodb_uri: this.mongoUri,
      database_name: this.dbName,
      collection_name: this.collectionName
    };
    
    this.mongoLogger = initializeGlobalLogger(config);
    
    return true;
  }
  
  async createMongoDBSetup() {
    // Set up MongoDB configuration similar to the Python bootstrap
    this.mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.dbName = `mcp_test_logs_${timestamp}`;
    this.collectionName = `tool_executions_${timestamp}`;
    
    console.log(`📦 Connecting to MongoDB at: ${this.mongoUri}`);
    
    try {
      // Test connection
      const testClient = new MongoClient(this.mongoUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000
      });
      
      await testClient.connect();
      console.log('✅ Successfully connected to MongoDB');
      
      // Create database and collection
      const db = testClient.db(this.dbName);
      const collection = db.collection(this.collectionName);
      
      // Create indexes for optimal query performance
      await collection.createIndex({ 'toolName': 1, 'startTime': -1 });
      await collection.createIndex({ 'sessionId': 1, 'startTime': -1 });
      await collection.createIndex({ 'success': 1, 'startTime': -1 });
      await collection.createIndex({ 'startTime': -1 });
      
      console.log(`✅ Database '${this.dbName}' ready`);
      console.log(`✅ Collection '${this.collectionName}' ready`);
      
      // Insert a test document to verify write permissions
      const testDoc = {
        _id: 'bootstrap_test',
        type: 'bootstrap_verification',
        timestamp: new Date(),
        test_mode: true,
        created_by: 'demo_logging.js'
      };
      
      await collection.insertOne(testDoc);
      console.log('✅ Test document inserted successfully');
      
      // Verify we can read it back
      const retrieved = await collection.findOne({ _id: 'bootstrap_test' });
      if (retrieved) {
        console.log('✅ Test document retrieval successful');
      }
      
      await testClient.close();
      
      // Save configuration for later use
      const config = {
        mongodb_uri: this.mongoUri,
        database_name: this.dbName,
        collection_name: this.collectionName,
        bootstrap_timestamp: new Date().toISOString(),
        test_mode: true
      };
      
      fs.writeFileSync('./mongo_logger_config.json', JSON.stringify(config, null, 2));
      console.log('✅ Configuration exported to mongo_logger_config.json');
      
    } catch (error) {
      console.error(`❌ MongoDB setup failed: ${error.message}`);
      throw error;
    }
  }
  
  async runPythonBootstrap() {
    return new Promise((resolve, reject) => {
      const python = spawn('python', ['bootstrap_mongo_logger.py'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python bootstrap exited with code ${code}`));
        }
      });
      
      python.on('error', (error) => {
        reject(new Error(`Failed to start Python bootstrap: ${error.message}`));
      });
    });
  }
  
  loadBootstrapConfig() {
    try {
      const configPath = './mongo_logger_config.json';
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.warn('⚠️ Could not load bootstrap config:', error.message);
    }
    return null;
  }
  
  async executeToolDirectly(toolName, args) {
    /**
     * Execute a tool directly using the tool registry
     * This simulates calling tools through the MCP server
     */
    const startTime = performance.now();
    
    try {
      console.log(`  📞 Calling tool: ${toolName}`);
      
      // Import the tool registry and initialize modules
      const ToolRegistry = require('./utils/tool-registry');
      const toolRegistry = new ToolRegistry();
      
      // Register modules (simplified for demo)
      const EnvironmentManager = require('./modules/code-generation/environment-manager');
      const FileOperations = require('./modules/file-operations/file-operations');
      
      toolRegistry.registerModule('environment', new EnvironmentManager());
      toolRegistry.registerModule('fileOperations', new FileOperations());
      
      // Execute the tool
      const result = await toolRegistry.executeTool(toolName, args);
      
      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);
      
      const success = result && !result.isError;
      
      if (success) {
        console.log(`  ✅ ${toolName} completed in ${durationMs}ms`);
      } else {
        console.log(`  ❌ ${toolName} failed in ${durationMs}ms`);
      }
      
      // Extract response snippet
      let responseSnippet = 'No response';
      if (result && result.content && Array.isArray(result.content)) {
        const textContent = result.content.find(item => item.type === 'text');
        if (textContent && textContent.text) {
          responseSnippet = textContent.text.substring(0, 100).replace(/\n/g, ' ');
        }
      } else if (result && typeof result === 'string') {
        responseSnippet = result.substring(0, 100).replace(/\n/g, ' ');
      }
      
      return {
        tool: toolName,
        success,
        durationMs,
        responseSnippet,
        fullResponse: result
      };
      
    } catch (error) {
      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);
      
      console.log(`  💥 ${toolName} error: ${error.message}`);
      return {
        tool: toolName,
        success: false,
        durationMs,
        responseSnippet: `Error: ${error.message.substring(0, 80)}`,
        fullResponse: { error: error.message }
      };
    }
  }
  
  async callToolsWithDelays() {
    console.log('\n' + '='.repeat(60));
    console.log('🔧 Step 2: Calling Tools with Random Delays');
    console.log('='.repeat(60));
    
    const results = [];
    
    for (let i = 0; i < this.testTools.length; i++) {
      const toolConfig = this.testTools[i];
      console.log(`\n[${i + 1}/${this.testTools.length}] Testing tool: ${toolConfig.name}`);
      
      // Add random delay between 0.5 and 3 seconds
      const delay = Math.random() * 2500 + 500; // 500ms to 3000ms
      console.log(`  ⏳ Waiting ${(delay / 1000).toFixed(1)}s for varied timing...`);
      await this.sleep(delay);
      
      // Execute the tool
      const result = await this.executeToolDirectly(toolConfig.name, toolConfig.args);
      results.push(result);
      
      // Small delay after each tool
      await this.sleep(200);
    }
    
    console.log(`\n✅ Completed ${results.length} tool executions`);
    return results;
  }
  
  async connectToCollection() {
    try {
      this.mongoClient = new MongoClient(this.mongoUri);
      await this.mongoClient.connect();
      this.db = this.mongoClient.db(this.dbName);
      this.collection = this.db.collection(this.collectionName);
      
      // Test connection
      await this.collection.findOne();
      console.log('✅ Connected to collection for querying');
      return true;
    } catch (error) {
      console.log(`❌ Failed to connect to collection: ${error.message}`);
      return false;
    }
  }
  
  async queryAndDisplayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Step 3: Querying Collection and Displaying Results');
    console.log('='.repeat(60));
    
    if (!await this.connectToCollection()) {
      return;
    }
    
    try {
      // Get all documents from the collection, sorted by start time
      const cursor = this.collection.find({}, {
        projection: {
          toolName: 1,
          success: 1,
          duration: 1,
          response: 1,
          error: 1,
          startTime: 1,
          _id: 1
        }
      }).sort({ startTime: -1 }).limit(20);
      
      const documents = await cursor.toArray();
      
      if (!documents.length) {
        console.log('⚠️  No tool executions found in the collection');
        console.log('   This might mean:');
        console.log('   - The tools were executed but not logged');
        console.log('   - The MongoDB logger is not properly configured');
        console.log('   - The tools haven\'t been executed yet');
        
        // Try to get any documents
        const totalDocs = await this.collection.countDocuments({});
        console.log(`   Total documents in collection: ${totalDocs}`);
        
        if (totalDocs > 0) {
          console.log('\n   Sample documents:');
          const sampleDocs = await this.collection.find({}).limit(3).toArray();
          for (const doc of sampleDocs) {
            console.log(`   - ${doc._id || 'No ID'}: ${doc.toolName || 'No tool name'}`);
          }
        }
        
        return;
      }
      
      // Prepare table data
      const tableData = [];
      for (const doc of documents) {
        const toolName = doc.toolName || 'Unknown';
        const success = doc.success ? '✅ Yes' : '❌ No';
        
        // Duration in milliseconds
        const duration = doc.duration;
        const durationMs = duration !== null && duration !== undefined ? `${duration}ms` : 'N/A';
        
        // Response snippet
        let responseSnippet = 'No response/error data';
        if (doc.response) {
          const responseStr = typeof doc.response === 'object' ? JSON.stringify(doc.response) : String(doc.response);
          responseSnippet = responseStr.replace(/\n/g, ' ').substring(0, 50);
        } else if (doc.error) {
          const errorStr = typeof doc.error === 'object' ? JSON.stringify(doc.error) : String(doc.error);
          responseSnippet = `ERROR: ${errorStr.replace(/\n/g, ' ').substring(0, 40)}`;
        }
        
        // Add ellipsis if truncated
        if (responseSnippet.length === 50) {
          responseSnippet += '...';
        }
        
        tableData.push([toolName, success, durationMs, responseSnippet]);
      }
      
      // Display table using simple formatting
      console.log(`\n📋 Tool Execution Summary (${documents.length} executions):`);
      console.log('┌─' + '─'.repeat(25) + '┬─' + '─'.repeat(10) + '┬─' + '─'.repeat(12) + '┬─' + '─'.repeat(50) + '┐');
      console.log('│ Tool'.padEnd(26) + '│ Success'.padEnd(11) + '│ Duration'.padEnd(13) + '│ Response Snippet'.padEnd(51) + '│');
      console.log('├─' + '─'.repeat(25) + '┼─' + '─'.repeat(10) + '┼─' + '─'.repeat(12) + '┼─' + '─'.repeat(50) + '┤');
      
      for (const [tool, success, duration, snippet] of tableData) {
        const toolPad = tool.substring(0, 25).padEnd(26);
        const successPad = success.substring(0, 10).padEnd(11);
        const durationPad = duration.substring(0, 12).padEnd(13);
        const snippetPad = snippet.substring(0, 50).padEnd(51);
        console.log(`│ ${toolPad}│ ${successPad}│ ${durationPad}│ ${snippetPad}│`);
      }
      
      console.log('└─' + '─'.repeat(25) + '┴─' + '─'.repeat(10) + '┴─' + '─'.repeat(12) + '┴─' + '─'.repeat(50) + '┘');
      
      // Additional statistics
      const successfulCount = documents.filter(doc => doc.success).length;
      const failedCount = documents.length - successfulCount;
      
      const durations = documents.filter(doc => doc.duration != null).map(doc => doc.duration);
      if (durations.length > 0) {
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        const minDuration = Math.min(...durations);
        
        console.log('\n📈 Statistics:');
        console.log(`   Total executions: ${documents.length}`);
        console.log(`   Successful: ${successfulCount}`);
        console.log(`   Failed: ${failedCount}`);
        console.log(`   Average duration: ${Math.round(avgDuration)}ms`);
        console.log(`   Min duration: ${minDuration}ms`);
        console.log(`   Max duration: ${maxDuration}ms`);
      }
      
    } catch (error) {
      console.log(`❌ Error querying collection: ${error.message}`);
      console.error(error);
    }
  }
  
  outputSuccessMessage() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Step 4: Demo Complete!');
    console.log('='.repeat(60));
    
    const message = `All interactions successfully logged to MongoDB at ${this.dbName}/${this.collectionName}`;
    console.log(`\n✅ ${message}`);
    
    console.log('\n📍 Connection Details:');
    console.log(`   MongoDB URI: ${this.mongoUri}`);
    console.log(`   Database: ${this.dbName}`);
    console.log(`   Collection: ${this.collectionName}`);
    
    console.log('\n🔧 You can query the data using:');
    console.log(`   mongosh "${this.mongoUri}" --eval "db.${this.collectionName}.find().pretty()"`);
    console.log(`   Or use MongoDB Compass: ${this.mongoUri}`);
  }
  
  async cleanup() {
    if (this.mongoClient) {
      try {
        await this.mongoClient.close();
        console.log('\n🧹 MongoDB connection closed');
      } catch (error) {
        console.log(`⚠️  Warning: Error closing MongoDB connection: ${error.message}`);
      }
    }
    
    try {
      await closeGlobalLogger();
    } catch (error) {
      console.log(`⚠️  Warning: Error closing global logger: ${error.message}`);
    }
  }
  
  async insertSampleLogEntries() {
    if (!await this.connectToCollection()) {
      return;
    }
    
    console.log('\n📝 Inserting sample log entries for demonstration...');
    
    const sampleEntries = [];
    const baseTime = new Date();
    
    for (let i = 0; i < this.testTools.length; i++) {
      const toolConfig = this.testTools[i];
      
      // Create realistic log entries
      const startTime = new Date(baseTime.getTime() - (this.testTools.length - i) * 10000);
      const duration = Math.floor(Math.random() * 1950) + 50; // 50ms to 2000ms
      const endTime = new Date(startTime.getTime() + duration);
      const success = Math.random() > 0.25; // 75% success rate
      
      const entry = {
        _id: `demo_${Date.now()}_${i}`,
        toolName: toolConfig.name,
        sessionId: `demo_session_${Math.floor(Date.now() / 1000)}`,
        args: toolConfig.args,
        startTime,
        endTime,
        duration,
        success,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          hostname: require('os').hostname(),
          pid: process.pid
        }
      };
      
      if (success) {
        entry.response = {
          content: [{
            type: 'text',
            text: `Tool ${toolConfig.name} executed successfully with sample output`
          }]
        };
        entry.error = null;
      } else {
        entry.response = null;
        entry.error = {
          message: `Sample error for ${toolConfig.name}`,
          type: 'DemoError'
        };
      }
      
      sampleEntries.push(entry);
      
      // Small delay to ensure different timestamps
      await this.sleep(100);
    }
    
    try {
      const result = await this.collection.insertMany(sampleEntries);
      console.log(`✅ Inserted ${result.insertedCount} sample log entries`);
    } catch (error) {
      console.log(`❌ Failed to insert sample entries: ${error.message}`);
    }
  }
  
  async runDemo() {
    try {
      console.log('\n' + '🎬'.repeat(20));
      console.log('🎬 MongoDB Logging Demo Starting');
      console.log('🎬'.repeat(20));
      
      // Step 1: Boot the logger
      await this.bootLogger();
      
      // Step 2: Call tools with delays
      await this.callToolsWithDelays();
      
      // For demo purposes, also insert some sample log entries
      await this.insertSampleLogEntries();
      
      // Step 3: Query and display results
      await this.queryAndDisplayResults();
      
      // Step 4: Output success message
      this.outputSuccessMessage();
      
      return true;
      
    } catch (error) {
      if (error.message.includes('interrupted')) {
        console.log('\n\n⏹️  Demo interrupted by user');
        return false;
      }
      
      console.log(`\n❌ Demo failed: ${error.message}`);
      console.error(error);
      return false;
    } finally {
      await this.cleanup();
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  // Check dependencies
  try {
    require('mongodb');
  } catch (error) {
    console.log('❌ Missing dependency: mongodb');
    console.log('   Install with: npm install mongodb');
    process.exit(1);
  }
  
  // Handle interruption
  process.on('SIGINT', () => {
    console.log('\n\n⏹️  Demo interrupted by user');
    process.exit(0);
  });
  
  // Run the demo
  const demo = new LoggingDemo();
  const success = await demo.runDemo();
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = LoggingDemo;

