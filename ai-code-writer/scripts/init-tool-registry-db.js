#!/usr/bin/env node
/**
 * MongoDB Tool Registry Database Initialization Script
 * 
 * This script initializes the MongoDB database for the MCP Tool Registry
 * with proper environment variable loading and error handling.
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ToolRegistryDatabase = require('../modules/tool-registry/tool-registry-database');
const Logger = require('../utils/logger');

class DatabaseInitializer {
  constructor() {
    this.logger = new Logger('DBInit');
    this.toolRegistryDb = new ToolRegistryDatabase();
  }

  async validateEnvironment() {
    this.logger.info('Validating environment variables...');
    
    const requiredVars = {
      MONGODB_URI: process.env.MONGODB_URI,
      MONGODB_USER: process.env.MONGODB_USER,
      MONGODB_PASSWORD: process.env.MONGODB_PASSWORD
    };

    const missing = [];
    const present = [];
    
    for (const [key, value] of Object.entries(requiredVars)) {
      if (!value) {
        missing.push(key);
      } else {
        present.push(`${key}: ${key.includes('PASSWORD') ? '***' : value}`);
      }
    }

    if (missing.length > 0) {
      this.logger.error('Missing required environment variables:', missing);
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    this.logger.info('Environment validation passed:');
    present.forEach(varInfo => this.logger.info(`  ✓ ${varInfo}`));
    
    return true;
  }

  async checkMongoConnection() {
    this.logger.info('Testing MongoDB connection...');
    
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
      await client.connect();
      const admin = client.db().admin();
      const serverStatus = await admin.serverStatus();
      
      this.logger.info(`✓ MongoDB connection successful`);
      this.logger.info(`  Server version: ${serverStatus.version}`);
      this.logger.info(`  Host: ${serverStatus.host}`);
      
      await client.close();
      return true;
    } catch (error) {
      this.logger.error('MongoDB connection failed:', error.message);
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  }

  async initializeDatabase() {
    this.logger.info('Initializing Tool Registry Database...');
    
    try {
      const result = await this.toolRegistryDb.initializeToolRegistryDb({
        connection_string: process.env.MONGODB_URI,
        database_name: process.env.MONGODB_DATABASE || 'mcp_tool_registry'
      });
      
      this.logger.info('Database initialization completed successfully');
      console.log(result);
      
      return result;
    } catch (error) {
      this.logger.error('Database initialization failed:', error.message);
      throw error;
    }
  }

  async createIndexes() {
    this.logger.info('Creating additional performance indexes...');
    
    // Additional custom indexes for better performance
    const customIndexes = [
      {
        collection: 'tools',
        indexes: [
          { 'performance_summary.usage_count': -1, 'performance_summary.success_rate': -1 },
          { 'registered_at': -1 },
          { 'category': 1, 'server_name': 1 }
        ]
      },
      {
        collection: 'usage_logs',
        indexes: [
          { 'tool_id': 1, 'timestamp': -1 },
          { 'success': 1, 'timestamp': -1 },
          { 'session_id': 1, 'timestamp': 1 }
        ]
      },
      {
        collection: 'performance',
        indexes: [
          { 'success_rate': -1, 'average_rating': -1 },
          { 'total_usage_count': -1 },
          { 'last_used': -1 }
        ]
      }
    ];

    try {
      for (const { collection, indexes } of customIndexes) {
        for (const index of indexes) {
          await this.toolRegistryDb.collections[collection].createIndex(index);
          this.logger.info(`✓ Created index on ${collection}:`, Object.keys(index).join(', '));
        }
      }
    } catch (error) {
      this.logger.warn('Some indexes may already exist:', error.message);
    }
  }

  async setupDefaultData() {
    this.logger.info('Setting up default data and configurations...');
    
    // Create default categories collection for tool organization
    const categoriesCollection = this.toolRegistryDb.db.collection('categories');
    
    const defaultCategories = [
      { name: 'file_operations', description: 'File and directory management tools' },
      { name: 'data_processing', description: 'Data transformation and analysis tools' },
      { name: 'ai_integration', description: 'AI and machine learning integration tools' },
      { name: 'communication', description: 'Inter-service communication tools' },
      { name: 'visualization', description: 'Charts, graphs, and data visualization tools' },
      { name: 'automation', description: 'Workflow and task automation tools' },
      { name: 'database', description: 'Database operations and management tools' },
      { name: 'development', description: 'Code generation and development tools' },
      { name: 'collaboration', description: 'Team collaboration and project management tools' },
      { name: 'utilities', description: 'General utility and helper tools' }
    ];

    try {
      for (const category of defaultCategories) {
        await categoriesCollection.updateOne(
          { name: category.name },
          { $set: { ...category, created_at: new Date() } },
          { upsert: true }
        );
      }
      this.logger.info(`✓ Default categories setup complete (${defaultCategories.length} categories)`);
    } catch (error) {
      this.logger.warn('Default data setup warning:', error.message);
    }
  }

  async generateSummaryReport() {
    this.logger.info('Generating initialization summary...');
    
    const collections = await this.toolRegistryDb.db.listCollections().toArray();
    const stats = {
      database_name: this.toolRegistryDb.db.databaseName,
      collections_created: collections.length,
      collection_names: collections.map(c => c.name),
      initialization_time: new Date().toISOString(),
      mongodb_uri: process.env.MONGODB_URI.replace(/\/\/.*@/, '//***:***@')
    };

    console.log('\n' + '='.repeat(60));
    console.log('  MONGODB TOOL REGISTRY INITIALIZATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`Database: ${stats.database_name}`);
    console.log(`Collections: ${stats.collections_created}`);
    console.log(`Connection: ${stats.mongodb_uri}`);
    console.log(`Completed: ${stats.initialization_time}`);
    console.log('='.repeat(60));
    console.log('\nCollections created:');
    stats.collection_names.forEach(name => console.log(`  ✓ ${name}`));
    console.log('\nNext steps:');
    console.log('  1. Run tool discovery to populate the registry');
    console.log('  2. Start recording tool usage for analytics');
    console.log('  3. Use performance metrics for optimization');
    console.log('='.repeat(60));

    return stats;
  }

  async run() {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting MongoDB Tool Registry Database Initialization...');
      console.log('');
      
      // Step 1: Validate environment
      await this.validateEnvironment();
      console.log('');
      
      // Step 2: Test MongoDB connection
      await this.checkMongoConnection();
      console.log('');
      
      // Step 3: Initialize database and collections
      await this.initializeDatabase();
      console.log('');
      
      // Step 4: Create additional indexes
      await this.createIndexes();
      console.log('');
      
      // Step 5: Setup default data
      await this.setupDefaultData();
      console.log('');
      
      // Step 6: Generate summary
      const stats = await this.generateSummaryReport();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Initialization completed successfully in ${duration}s`);
      
      return stats;
      
    } catch (error) {
      console.error('\n❌ Initialization failed:', error.message);
      console.error('\nPlease check:');
      console.error('  1. MongoDB is running and accessible');
      console.error('  2. Environment variables are correctly set');
      console.error('  3. Database user has sufficient permissions');
      console.error('');
      process.exit(1);
    } finally {
      // Always close the database connection
      await this.toolRegistryDb.close();
    }
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  const initializer = new DatabaseInitializer();
  initializer.run().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = DatabaseInitializer;

