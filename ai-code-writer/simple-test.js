#!/usr/bin/env node

// Simple step-by-step test for embeddings system
require('dotenv').config();

const logger = require('./utils/logger');

async function testStep(stepName, testFunction) {
    try {
        console.log(`\n🔍 Testing: ${stepName}`);
        console.log('-'.repeat(40));
        
        const result = await testFunction();
        console.log(`✅ ${stepName} - SUCCESS`);
        return result;
    } catch (error) {
        console.error(`❌ ${stepName} - FAILED:`, error.message);
        throw error;
    }
}

async function main() {
    console.log('🚀 Simple Embeddings System Test');
    console.log('='.repeat(50));
    
    try {
        // Step 1: Check environment variables
        await testStep('Environment Variables', async () => {
            const vars = ['LM_STUDIO_BASE_URL', 'REDIS_URL', 'QDRANT_URL'];
            for (const varName of vars) {
                if (!process.env[varName]) {
                    throw new Error(`Missing ${varName}`);
                }
                console.log(`   ✓ ${varName}: ${process.env[varName]}`);
            }
            return true;
        });
        
        // Step 2: Test LM Studio Manager
        await testStep('LM Studio Manager', async () => {
            const LMStudioManager = require('./modules/embeddings/lm-studio-manager');
            const lm = new LMStudioManager();
            
            console.log('   Checking LM Studio health...');
            const health = await lm.healthCheck();
            console.log(`   Health: ${health.healthy}`);
            
            if (!health.healthy) {
                throw new Error('LM Studio health check failed');
            }
            
            console.log('   Initializing LM Studio...');
            await lm.initialize();
            
            const info = lm.getModelInfo();
            console.log(`   Total models: ${info.totalModels}`);
            console.log(`   Embedding models: ${info.embeddingModels}`);
            
            return info;
        });
        
        // Step 3: Test Redis Queue
        await testStep('Redis Task Queue', async () => {
            const RedisTaskQueue = require('./modules/embeddings/redis-task-queue');
            const redis = new RedisTaskQueue();
            
            console.log('   Initializing Redis...');
            await redis.initialize();
            
            console.log('   Getting queue stats...');
            const stats = await redis.getQueueStats();
            console.log(`   Queue stats:`, JSON.stringify(stats.total, null, 2));
            
            console.log('   Disconnecting...');
            await redis.disconnect();
            
            return stats;
        });
        
        // Step 4: Test Qdrant Manager
        await testStep('Qdrant Table Manager', async () => {
            const QdrantTableManager = require('./modules/embeddings/qdrant-table-manager');
            const qdrant = new QdrantTableManager();
            
            console.log('   Initializing Qdrant...');
            await qdrant.initialize();
            
            console.log('   Getting collection stats...');
            const stats = await qdrant.getAllStats();
            console.log(`   Collections: ${stats.totals.collections}`);
            console.log(`   Total points: ${stats.totals.points}`);
            
            return stats;
        });
        
        console.log('\n🎉 All basic component tests passed!');
        console.log('\n📋 Next steps:');
        console.log('   1. All components are working individually');
        console.log('   2. Ready to test full orchestrator');
        console.log('   3. Run: node test-embeddings-system.js for full test');
        
    } catch (error) {
        console.error('\n💥 Test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

