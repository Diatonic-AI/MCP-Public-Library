const EmbeddingsOrchestrator = require('./embeddings-orchestrator');
const Logger = require('../../utils/logger');
const logger = new Logger('EmbeddingsSystem');

// Global orchestrator instance
let embeddingsOrchestrator = null;

/**
 * Initialize the embeddings system
 */
async function initializeEmbeddingsSystem() {
    try {
        if (embeddingsOrchestrator) {
            logger.warn('Embeddings system already initialized');
            return embeddingsOrchestrator;
        }

        logger.info('Initializing Embeddings System...');
        
        // Create and initialize orchestrator
        embeddingsOrchestrator = new EmbeddingsOrchestrator();
        await embeddingsOrchestrator.initialize();
        
        // Start processing
        await embeddingsOrchestrator.start();
        
        logger.info('Embeddings System initialized and started successfully');
        return embeddingsOrchestrator;
    } catch (error) {
        logger.error('Failed to initialize Embeddings System:', error.message);
        throw error;
    }
}

/**
 * Get the embeddings orchestrator instance
 */
function getEmbeddingsOrchestrator() {
    if (!embeddingsOrchestrator) {
        throw new Error('Embeddings system not initialized. Call initializeEmbeddingsSystem() first.');
    }
    return embeddingsOrchestrator;
}

/**
 * Add a single embedding task
 */
async function addEmbeddingTask(data) {
    const orchestrator = getEmbeddingsOrchestrator();
    return await orchestrator.addEmbeddingTask(data);
}

/**
 * Add multiple embedding tasks
 */
async function addBatchEmbeddingTasks(tasksData) {
    const orchestrator = getEmbeddingsOrchestrator();
    return await orchestrator.addBatchEmbeddingTasks(tasksData);
}

/**
 * Perform feedback analysis
 */
async function performFeedbackAnalysis(queryText, categories = []) {
    const orchestrator = getEmbeddingsOrchestrator();
    return await orchestrator.performFeedbackAnalysis(queryText, categories);
}

/**
 * Get system status
 */
async function getSystemStatus() {
    const orchestrator = getEmbeddingsOrchestrator();
    return await orchestrator.getStatus();
}

/**
 * Stop the embeddings system
 */
async function stopEmbeddingsSystem() {
    if (embeddingsOrchestrator) {
        logger.info('Stopping Embeddings System...');
        await embeddingsOrchestrator.stop();
        embeddingsOrchestrator = null;
        logger.info('Embeddings System stopped');
    }
}

/**
 * Process knowledge for embeddings (helper function)
 */
async function processKnowledge(text, category = 'knowledge', layer = 'backend', metadata = {}) {
    return await addEmbeddingTask({
        text,
        category,
        layer,
        priority: 'normal',
        metadata: {
            ...metadata,
            type: 'knowledge',
            source: 'ai_orchestrator'
        }
    });
}

/**
 * Process documentation for embeddings
 */
async function processDocumentation(text, category = 'documentation', layer = 'frontend', metadata = {}) {
    return await addEmbeddingTask({
        text,
        category,
        layer,
        priority: 'high',
        metadata: {
            ...metadata,
            type: 'documentation',
            source: 'ai_orchestrator'
        }
    });
}

/**
 * Process completion summaries for embeddings
 */
async function processCompletionSummary(text, layer = 'backend', metadata = {}) {
    return await addEmbeddingTask({
        text,
        category: 'completion_summaries',
        layer,
        priority: 'high',
        metadata: {
            ...metadata,
            type: 'completion_summary',
            source: 'ai_orchestrator'
        }
    });
}

/**
 * Process repository information for embeddings
 */
async function processRepository(text, layer = 'backend', metadata = {}) {
    return await addEmbeddingTask({
        text,
        category: 'repositories',
        layer,
        priority: 'normal',
        metadata: {
            ...metadata,
            type: 'repository',
            source: 'ai_orchestrator'
        }
    });
}

/**
 * Process index information for embeddings
 */
async function processIndex(text, layer = 'backend', metadata = {}) {
    return await addEmbeddingTask({
        text,
        category: 'indexes',
        layer,
        priority: 'normal',
        metadata: {
            ...metadata,
            type: 'index',
            source: 'ai_orchestrator'
        }
    });
}

/**
 * Process MCP task results for embeddings
 */
async function processMCPTask(text, success = true, layer = 'backend', metadata = {}) {
    return await addEmbeddingTask({
        text,
        category: 'mcp_tasks',
        layer,
        priority: success ? 'normal' : 'high',
        metadata: {
            ...metadata,
            type: 'mcp_task',
            success: success,
            source: 'ai_orchestrator'
        }
    });
}

/**
 * Process confidence ratings for embeddings
 */
async function processConfidenceRating(text, confidence, layer = 'backend', metadata = {}) {
    return await addEmbeddingTask({
        text,
        category: 'confidence',
        layer,
        priority: confidence < 0.5 ? 'high' : 'normal',
        metadata: {
            ...metadata,
            type: 'confidence',
            confidence_score: confidence,
            source: 'ai_orchestrator'
        }
    });
}

/**
 * Process problem solving reviews for embeddings
 */
async function processProblemSolvingReview(text, rating, layer = 'backend', metadata = {}) {
    return await addEmbeddingTask({
        text,
        category: 'problem_solving',
        layer,
        priority: rating < 3 ? 'high' : 'normal',
        metadata: {
            ...metadata,
            type: 'problem_solving_review',
            rating: rating,
            source: 'ai_orchestrator'
        }
    });
}

/**
 * Get available categories and layers
 */
function getAvailableCategories() {
    return {
        frontend: [
            'knowledge',
            'documentation', 
            'completion_summaries',
            'repositories',
            'indexes',
            'mcp_tasks',
            'confidence',
            'problem_solving'
        ],
        backend: [
            'knowledge',
            'documentation',
            'completion_summaries', 
            'repositories',
            'indexes',
            'mcp_tasks',
            'confidence',
            'problem_solving'
        ]
    };
}

module.exports = {
    // Core functions
    initializeEmbeddingsSystem,
    getEmbeddingsOrchestrator,
    stopEmbeddingsSystem,
    
    // Task management
    addEmbeddingTask,
    addBatchEmbeddingTasks,
    
    // Analysis
    performFeedbackAnalysis,
    getSystemStatus,
    
    // Helper functions for specific data types
    processKnowledge,
    processDocumentation,
    processCompletionSummary,
    processRepository,
    processIndex,
    processMCPTask,
    processConfidenceRating,
    processProblemSolvingReview,
    
    // Utilities
    getAvailableCategories
};

