const LMStudioManager = require('./lm-studio-manager');
const RedisTaskQueue = require('./redis-task-queue');
const QdrantTableManager = require('./qdrant-table-manager');
const Logger = require('../../utils/logger');
const logger = new Logger('EmbeddingsOrchestrator');

class EmbeddingsOrchestrator {
    constructor() {
        this.lmStudio = new LMStudioManager();
        this.taskQueue = new RedisTaskQueue();
        this.qdrant = new QdrantTableManager();
        this.isRunning = false;
        this.processingInterval = null;
        this.feedbackAlgorithms = new Map();
        this.performanceMetrics = {
            tasksProcessed: 0,
            tasksCompleted: 0,
            tasksFailed: 0,
            averageProcessingTime: 0,
            lastProcessingTime: null
        };
    }

    /**
     * Initialize the embeddings orchestrator
     */
    async initialize() {
        try {
            logger.info('Initializing Embeddings Orchestrator...');
            
            // Initialize all components
            await Promise.all([
                this.lmStudio.initialize(),
                this.taskQueue.initialize(),
                this.qdrant.initialize()
            ]);
            
            // Set up feedback algorithms
            this.initializeFeedbackAlgorithms();
            
            logger.info('Embeddings Orchestrator initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize Embeddings Orchestrator:', error.message);
            throw error;
        }
    }

    /**
     * Start the embeddings processing loop
     */
    async start() {
        try {
            if (this.isRunning) {
                logger.warn('Embeddings Orchestrator is already running');
                return;
            }

            logger.info('Starting Embeddings Orchestrator...');
            this.isRunning = true;
            
            // Start the main processing loop
            await this.startProcessingLoop();
            
            logger.info('Embeddings Orchestrator started successfully');
        } catch (error) {
            logger.error('Failed to start Embeddings Orchestrator:', error.message);
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Stop the embeddings processing
     */
    async stop() {
        try {
            logger.info('Stopping Embeddings Orchestrator...');
            this.isRunning = false;
            
            if (this.processingInterval) {
                clearInterval(this.processingInterval);
                this.processingInterval = null;
            }
            
            // Disconnect from services
            await this.taskQueue.disconnect();
            
            logger.info('Embeddings Orchestrator stopped');
        } catch (error) {
            logger.error('Error stopping Embeddings Orchestrator:', error.message);
        }
    }

    /**
     * Main processing loop that watches for tasks
     */
    async startProcessingLoop() {
        logger.info('Starting embeddings processing loop...');
        
        // Use a continuous loop instead of interval for better responsiveness
        this.processTasksContinuously();
    }

    /**
     * Continuous task processing with blocking wait
     */
    async processTasksContinuously() {
        while (this.isRunning) {
            try {
                // Watch for new tasks with a 5-second timeout
                const task = await this.taskQueue.watchForTasks(5);
                
                if (task) {
                    await this.processEmbeddingTask(task);
                }
                
                // Small delay to prevent overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                logger.error('Error in processing loop:', error.message);
                
                // Wait a bit before retrying on error
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    /**
     * Process a single embedding task
     */
    async processEmbeddingTask(task) {
        const startTime = Date.now();
        
        try {
            logger.info(`Processing embedding task ${task.id} (${task.data.category}/${task.data.layer})`);
            
            this.performanceMetrics.tasksProcessed++;
            
            // Generate embeddings using LM Studio
            const embeddingResult = await this.lmStudio.generateEmbeddings(
                task.data.text,
                task.data.modelPriority || 'primary'
            );
            
            // Prepare data for storage
            const embeddingData = {
                id: task.data.id || `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                text: task.data.text,
                embeddings: embeddingResult.embeddings,
                model: embeddingResult.model,
                dimensions: embeddingResult.dimensions,
                metadata: {
                    ...task.data.metadata,
                    taskId: task.id,
                    processedAt: new Date().toISOString(),
                    usage: embeddingResult.usage
                }
            };
            
            // Store embeddings in appropriate Qdrant collection
            const pointIds = await this.qdrant.storeEmbeddings(
                task.data.category,
                task.data.layer,
                embeddingData
            );
            
            // Prepare task completion result
            const result = {
                taskId: task.id,
                pointIds: pointIds,
                embeddingData: embeddingData,
                processingTime: Date.now() - startTime,
                model: embeddingResult.model,
                dimensions: embeddingResult.dimensions
            };
            
            // Apply feedback algorithms for continuous improvement
            await this.applyFeedbackAlgorithms(task, result);
            
            // Mark task as completed
            await this.taskQueue.completeTask(task.id, result);
            
            // Update performance metrics
            this.updatePerformanceMetrics(startTime);
            this.performanceMetrics.tasksCompleted++;
            
            logger.info(`Successfully processed task ${task.id} in ${result.processingTime}ms`);
            
        } catch (error) {
            logger.error(`Failed to process task ${task.id}:`, error.message);
            
            // Mark task as failed
            await this.taskQueue.failTask(task.id, error);
            
            this.performanceMetrics.tasksFailed++;
        }
    }

    /**
     * Add embedding task to the queue
     */
    async addEmbeddingTask(data) {
        try {
            // Validate input data
            const validation = this.validateTaskData(data);
            if (!validation.valid) {
                throw new Error(`Invalid task data: ${validation.error}`);
            }
            
            const taskId = await this.taskQueue.addEmbeddingTask(data);
            
            logger.info(`Added embedding task ${taskId} to queue`);
            return taskId;
        } catch (error) {
            logger.error('Failed to add embedding task:', error.message);
            throw error;
        }
    }

    /**
     * Batch add multiple embedding tasks
     */
    async addBatchEmbeddingTasks(tasksData) {
        try {
            const taskIds = [];
            
            for (const taskData of tasksData) {
                const taskId = await this.addEmbeddingTask(taskData);
                taskIds.push(taskId);
            }
            
            logger.info(`Added ${taskIds.length} embedding tasks to queue`);
            return taskIds;
        } catch (error) {
            logger.error('Failed to add batch embedding tasks:', error.message);
            throw error;
        }
    }

    /**
     * Perform complex feedback loop analysis
     */
    async performFeedbackAnalysis(queryText, categories = []) {
        try {
            logger.info('Performing feedback loop analysis...');
            
            // Generate query embeddings
            const queryEmbeddings = await this.lmStudio.generateEmbeddings(queryText);
            
            // Perform cross-collection analysis
            const analysisResults = await this.qdrant.performCrossAnalysis(
                queryEmbeddings.embeddings,
                categories,
                {
                    limit: 20,
                    scoreThreshold: 0.6
                }
            );
            
            // Apply feedback algorithms to analyze results
            const feedbackAnalysis = await this.analyzeFeedbackPatterns(analysisResults);
            
            // Generate improvement recommendations
            const recommendations = await this.generateImprovementRecommendations(
                analysisResults,
                feedbackAnalysis
            );
            
            return {
                query: queryText,
                queryEmbeddings: {
                    model: queryEmbeddings.model,
                    dimensions: queryEmbeddings.dimensions
                },
                analysisResults,
                feedbackAnalysis,
                recommendations,
                processedAt: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Failed to perform feedback analysis:', error.message);
            throw error;
        }
    }

    /**
     * Initialize feedback algorithms for continuous improvement
     */
    initializeFeedbackAlgorithms() {
        // Task completion success rate algorithm
        this.feedbackAlgorithms.set('completion_rate', {
            analyze: (task, result) => {
                return {
                    category: task.data.category,
                    layer: task.data.layer,
                    success: true,
                    processingTime: result.processingTime,
                    model: result.model
                };
            },
            improve: (patterns) => {
                // Suggest model optimizations based on success patterns
                return {
                    suggestions: patterns.bestPerformingModels,
                    optimizations: patterns.timeOptimizations
                };
            }
        });
        
        // Embedding quality algorithm
        this.feedbackAlgorithms.set('embedding_quality', {
            analyze: (task, result) => {
                return {
                    dimensions: result.dimensions,
                    model: result.model,
                    category: task.data.category,
                    confidence: this.calculateEmbeddingConfidence(result)
                };
            },
            improve: (patterns) => {
                // Suggest better model selection based on quality patterns
                return {
                    modelRecommendations: patterns.highQualityModels,
                    categoryOptimizations: patterns.categoryPerformance
                };
            }
        });
        
        // Cross-layer correlation algorithm
        this.feedbackAlgorithms.set('cross_layer_correlation', {
            analyze: (task, result) => {
                return {
                    layer: task.data.layer,
                    category: task.data.category,
                    correlationPotential: this.calculateCorrelationPotential(task, result)
                };
            },
            improve: (patterns) => {
                // Suggest cross-layer learning opportunities
                return {
                    crossLayerInsights: patterns.correlationOpportunities,
                    knowledgeTransfer: patterns.transferSuggestions
                };
            }
        });
        
        logger.info('Initialized feedback algorithms for continuous improvement');
    }

    /**
     * Apply feedback algorithms to a completed task
     */
    async applyFeedbackAlgorithms(task, result) {
        try {
            const feedbackData = {
                taskId: task.id,
                patterns: {},
                insights: {},
                timestamp: new Date().toISOString()
            };
            
            // Apply each feedback algorithm
            for (const [algorithmName, algorithm] of this.feedbackAlgorithms) {
                try {
                    const analysis = algorithm.analyze(task, result);
                    feedbackData.patterns[algorithmName] = analysis;
                } catch (error) {
                    logger.error(`Error in feedback algorithm ${algorithmName}:`, error.message);
                }
            }
            
            // Store feedback data for future analysis
            await this.storeFeedbackData(feedbackData);
            
        } catch (error) {
            logger.error('Error applying feedback algorithms:', error.message);
        }
    }

    /**
     * Analyze feedback patterns for insights
     */
    async analyzeFeedbackPatterns(analysisResults) {
        try {
            const patterns = {
                performancePatterns: this.analyzePerformancePatterns(analysisResults),
                qualityPatterns: this.analyzeQualityPatterns(analysisResults),
                crossLayerPatterns: this.analyzeCrossLayerPatterns(analysisResults),
                improvementAreas: this.identifyImprovementAreas(analysisResults)
            };
            
            return patterns;
        } catch (error) {
            logger.error('Error analyzing feedback patterns:', error.message);
            throw error;
        }
    }

    /**
     * Generate improvement recommendations
     */
    async generateImprovementRecommendations(analysisResults, feedbackAnalysis) {
        try {
            const recommendations = {
                modelOptimizations: [],
                dataQualityImprovements: [],
                crossLayerEnhancements: [],
                performanceOptimizations: []
            };
            
            // Analyze best matches and suggest optimizations
            if (analysisResults.summary.bestMatch) {
                const bestMatch = analysisResults.summary.bestMatch;
                
                recommendations.modelOptimizations.push({
                    type: 'best_model_usage',
                    description: `Consider using model patterns similar to ${bestMatch.layer}/${bestMatch.category}`,
                    confidence: bestMatch.score
                });
            }
            
            // Suggest cross-layer improvements
            if (feedbackAnalysis.crossLayerPatterns.correlationOpportunities.length > 0) {
                recommendations.crossLayerEnhancements.push({
                    type: 'cross_layer_learning',
                    description: 'Leverage insights from both frontend and backend embeddings',
                    opportunities: feedbackAnalysis.crossLayerPatterns.correlationOpportunities
                });
            }
            
            // Performance optimizations based on metrics
            if (this.performanceMetrics.averageProcessingTime > 5000) {
                recommendations.performanceOptimizations.push({
                    type: 'processing_speed',
                    description: 'Consider model optimization or batch processing for better performance',
                    currentAvgTime: this.performanceMetrics.averageProcessingTime
                });
            }
            
            return recommendations;
        } catch (error) {
            logger.error('Error generating improvement recommendations:', error.message);
            throw error;
        }
    }

    /**
     * Utility methods for analysis
     */
    analyzePerformancePatterns(results) {
        // Analyze performance patterns across different layers and categories
        const patterns = {
            bestPerformingCategories: [],
            layerPerformanceComparison: {},
            averageScores: {}
        };
        
        // Implementation would analyze the results structure
        // and identify performance patterns
        
        return patterns;
    }
    
    analyzeQualityPatterns(results) {
        // Analyze embedding quality patterns
        return {
            highQualityCategories: [],
            qualityIndicators: {},
            improvementAreas: []
        };
    }
    
    analyzeCrossLayerPatterns(results) {
        // Analyze patterns between frontend and backend layers
        return {
            correlationOpportunities: [],
            knowledgeGaps: [],
            transferPotential: {}
        };
    }
    
    identifyImprovementAreas(results) {
        // Identify areas for improvement
        return {
            dataGaps: [],
            modelOptimizations: [],
            processImprovements: []
        };
    }
    
    calculateEmbeddingConfidence(result) {
        // Calculate confidence score based on various factors
        let confidence = 0.5; // Base confidence
        
        // Factor in dimensions (higher dimensions might indicate better models)
        if (result.dimensions >= 768) confidence += 0.2;
        else if (result.dimensions >= 384) confidence += 0.1;
        
        // Factor in processing time (faster might indicate better optimization)
        if (result.processingTime < 1000) confidence += 0.1;
        
        return Math.min(confidence, 1.0);
    }
    
    calculateCorrelationPotential(task, result) {
        // Calculate potential for cross-layer correlation
        return {
            score: 0.7, // Placeholder calculation
            factors: ['category_similarity', 'content_type', 'processing_pattern']
        };
    }

    /**
     * Store feedback data for analysis
     */
    async storeFeedbackData(feedbackData) {
        try {
            // Store in backend confidence collection for analysis
            await this.qdrant.storeEmbeddings('confidence', 'backend', {
                text: JSON.stringify(feedbackData),
                metadata: {
                    type: 'feedback_data',
                    ...feedbackData
                }
            });
        } catch (error) {
            logger.error('Error storing feedback data:', error.message);
        }
    }

    /**
     * Validate task data
     */
    validateTaskData(data) {
        if (!data.text) {
            return { valid: false, error: 'Text is required' };
        }
        
        if (!data.category) {
            return { valid: false, error: 'Category is required' };
        }
        
        if (!data.layer || !['frontend', 'backend'].includes(data.layer)) {
            return { valid: false, error: 'Layer must be "frontend" or "backend"' };
        }
        
        // Validate category exists
        const validation = this.qdrant.validateCategoryLayer(data.category, data.layer);
        if (!validation.valid) {
            return validation;
        }
        
        return { valid: true };
    }

    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(startTime) {
        const processingTime = Date.now() - startTime;
        this.performanceMetrics.lastProcessingTime = processingTime;
        
        // Update running average
        const totalTasks = this.performanceMetrics.tasksProcessed;
        const currentAvg = this.performanceMetrics.averageProcessingTime;
        this.performanceMetrics.averageProcessingTime = 
            ((currentAvg * (totalTasks - 1)) + processingTime) / totalTasks;
    }

    /**
     * Get orchestrator status and metrics
     */
    async getStatus() {
        try {
            const [queueStats, qdrantStats, lmStudioInfo] = await Promise.all([
                this.taskQueue.getQueueStats(),
                this.qdrant.getAllStats(),
                Promise.resolve(this.lmStudio.getModelInfo())
            ]);
            
            return {
                isRunning: this.isRunning,
                performanceMetrics: this.performanceMetrics,
                queueStats,
                qdrantStats,
                lmStudioInfo,
                feedbackAlgorithms: Array.from(this.feedbackAlgorithms.keys()),
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error getting orchestrator status:', error.message);
            throw error;
        }
    }
}

module.exports = EmbeddingsOrchestrator;

