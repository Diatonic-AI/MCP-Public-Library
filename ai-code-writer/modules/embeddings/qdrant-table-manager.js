const axios = require('axios');
const Logger = require('../../utils/logger');
const logger = new Logger('QdrantManager');

class QdrantTableManager {
    constructor() {
        this.baseUrl = process.env.QDRANT_URL;
        this.collections = {
            // Frontend collections
            frontend: {
                knowledge: 'frontend_knowledge',
                documentation: 'frontend_documentation',
                completion_summaries: 'frontend_completion_summaries',
                repositories: 'frontend_repositories',
                indexes: 'frontend_indexes',
                mcp_tasks: 'frontend_mcp_tasks',
                confidence: 'frontend_confidence',
                problem_solving: 'frontend_problem_solving'
            },
            // Backend collections
            backend: {
                knowledge: 'backend_knowledge',
                documentation: 'backend_documentation',
                completion_summaries: 'backend_completion_summaries',
                repositories: 'backend_repositories',
                indexes: 'backend_indexes',
                mcp_tasks: 'backend_mcp_tasks',
                confidence: 'backend_confidence',
                problem_solving: 'backend_problem_solving'
            }
        };
        this.isInitialized = false;
    }

    /**
     * Initialize Qdrant collections
     */
    async initialize() {
        try {
            logger.info('Initializing Qdrant Table Manager...');
            
            if (!this.baseUrl) {
                throw new Error('QDRANT_URL environment variable not set');
            }

            await this.healthCheck();
            await this.createAllCollections();
            
            this.isInitialized = true;
            logger.info('Qdrant Table Manager initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize Qdrant Table Manager:', error.message);
            throw error;
        }
    }

    /**
     * Health check for Qdrant connection
     */
    async healthCheck() {
        try {
            const response = await axios.get(`${this.baseUrl}/collections`, {
                timeout: 10000
            });
            logger.info('Qdrant health check passed');
            return response.data;
        } catch (error) {
            throw new Error(`Qdrant health check failed: ${error.message}`);
        }
    }

    /**
     * Create all required collections
     */
    async createAllCollections() {
        try {
            const allCollections = [...Object.values(this.collections.frontend), ...Object.values(this.collections.backend)];
            
            for (const collectionName of allCollections) {
                await this.createCollection(collectionName);
            }
            
            logger.info(`Created/verified ${allCollections.length} Qdrant collections`);
        } catch (error) {
            logger.error('Failed to create collections:', error.message);
            throw error;
        }
    }

    /**
     * Create a single collection if it doesn't exist
     */
    async createCollection(collectionName, vectorSize = 384) {
        try {
            // Check if collection exists
            const exists = await this.collectionExists(collectionName);
            if (exists) {
                logger.debug(`Collection ${collectionName} already exists`);
                return true;
            }

            // Create collection
            const collectionConfig = {
                name: collectionName,
                vectors: {
                    size: vectorSize,
                    distance: "Cosine"
                },
                optimizers_config: {
                    default_segment_number: 2
                },
                replication_factor: 1
            };

            await axios.put(`${this.baseUrl}/collections/${collectionName}`, collectionConfig, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });

            logger.info(`Created Qdrant collection: ${collectionName}`);
            return true;
        } catch (error) {
            logger.error(`Failed to create collection ${collectionName}:`, error.message);
            throw error;
        }
    }

    /**
     * Check if collection exists
     */
    async collectionExists(collectionName) {
        try {
            const response = await axios.get(`${this.baseUrl}/collections/${collectionName}`, {
                timeout: 10000
            });
            return response.status === 200;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Store embeddings in the appropriate collection
     */
    async storeEmbeddings(category, layer, data) {
        try {
            const collectionName = this.getCollectionName(category, layer);
            
            if (!collectionName) {
                throw new Error(`Invalid category: ${category} or layer: ${layer}`);
            }

            const points = Array.isArray(data) ? data : [data];
            
            // Format points for Qdrant
            const formattedPoints = points.map((point, index) => ({
                id: point.id || this.generatePointId(),
                vector: point.embeddings || point.vector,
                payload: {
                    text: point.text,
                    metadata: point.metadata || {},
                    timestamp: new Date().toISOString(),
                    category: category,
                    layer: layer,
                    model: point.model || 'unknown',
                    dimensions: point.dimensions || point.vector?.length || 0
                }
            }));

            // Store in Qdrant
            await axios.put(`${this.baseUrl}/collections/${collectionName}/points`, {
                points: formattedPoints
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });

            logger.info(`Stored ${formattedPoints.length} embeddings in ${collectionName}`);
            return formattedPoints.map(p => p.id);
        } catch (error) {
            logger.error(`Failed to store embeddings in ${category}/${layer}:`, error.message);
            throw error;
        }
    }

    /**
     * Search embeddings in collection
     */
    async searchEmbeddings(category, layer, queryVector, options = {}) {
        try {
            const collectionName = this.getCollectionName(category, layer);
            
            if (!collectionName) {
                throw new Error(`Invalid category: ${category} or layer: ${layer}`);
            }

            const searchQuery = {
                vector: queryVector,
                limit: options.limit || 10,
                score_threshold: options.scoreThreshold || 0.7,
                with_payload: true,
                with_vector: options.withVector || false
            };

            if (options.filter) {
                searchQuery.filter = options.filter;
            }

            const response = await axios.post(
                `${this.baseUrl}/collections/${collectionName}/points/search`,
                searchQuery,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            );

            logger.debug(`Found ${response.data.result.length} similar embeddings in ${collectionName}`);
            return response.data.result;
        } catch (error) {
            logger.error(`Failed to search embeddings in ${category}/${layer}:`, error.message);
            throw error;
        }
    }

    /**
     * Get collection statistics
     */
    async getCollectionStats(category, layer) {
        try {
            const collectionName = this.getCollectionName(category, layer);
            
            if (!collectionName) {
                throw new Error(`Invalid category: ${category} or layer: ${layer}`);
            }

            const response = await axios.get(
                `${this.baseUrl}/collections/${collectionName}`,
                { timeout: 10000 }
            );

            return {
                name: collectionName,
                pointsCount: response.data.result.points_count,
                status: response.data.result.status,
                vectorSize: response.data.result.config.params.vectors.size,
                distance: response.data.result.config.params.vectors.distance
            };
        } catch (error) {
            logger.error(`Failed to get stats for ${category}/${layer}:`, error.message);
            throw error;
        }
    }

    /**
     * Get comprehensive statistics for all collections
     */
    async getAllStats() {
        try {
            const stats = {
                frontend: {},
                backend: {},
                totals: {
                    collections: 0,
                    points: 0
                }
            };

            // Get frontend stats
            for (const [category, collectionName] of Object.entries(this.collections.frontend)) {
                try {
                    stats.frontend[category] = await this.getCollectionStats(category, 'frontend');
                    stats.totals.points += stats.frontend[category].pointsCount;
                    stats.totals.collections++;
                } catch (error) {
                    stats.frontend[category] = { error: error.message };
                }
            }

            // Get backend stats
            for (const [category, collectionName] of Object.entries(this.collections.backend)) {
                try {
                    stats.backend[category] = await this.getCollectionStats(category, 'backend');
                    stats.totals.points += stats.backend[category].pointsCount;
                    stats.totals.collections++;
                } catch (error) {
                    stats.backend[category] = { error: error.message };
                }
            }

            return stats;
        } catch (error) {
            logger.error('Failed to get all collection stats:', error.message);
            throw error;
        }
    }

    /**
     * Perform cross-collection analysis
     */
    async performCrossAnalysis(queryVector, categories = [], options = {}) {
        try {
            const results = {
                frontend: {},
                backend: {},
                summary: {
                    totalMatches: 0,
                    bestMatch: null,
                    avgScore: 0
                }
            };

            const searchPromises = [];
            const searchTargets = [];

            // Determine which categories to search
            const categoriesToSearch = categories.length > 0 ? categories : Object.keys(this.collections.frontend);

            // Search frontend collections
            for (const category of categoriesToSearch) {
                searchPromises.push(
                    this.searchEmbeddings(category, 'frontend', queryVector, options)
                        .catch(error => ({ error: error.message }))
                );
                searchTargets.push({ layer: 'frontend', category });

                searchPromises.push(
                    this.searchEmbeddings(category, 'backend', queryVector, options)
                        .catch(error => ({ error: error.message }))
                );
                searchTargets.push({ layer: 'backend', category });
            }

            const searchResults = await Promise.all(searchPromises);

            // Process results
            let allScores = [];
            let bestMatch = null;
            let bestScore = 0;

            searchResults.forEach((result, index) => {
                const { layer, category } = searchTargets[index];
                
                if (result.error) {
                    results[layer][category] = { error: result.error };
                } else {
                    results[layer][category] = result;
                    results.summary.totalMatches += result.length;
                    
                    // Track best match
                    if (result.length > 0) {
                        const topScore = result[0].score;
                        allScores.push(topScore);
                        
                        if (topScore > bestScore) {
                            bestScore = topScore;
                            bestMatch = {
                                layer,
                                category,
                                score: topScore,
                                content: result[0]
                            };
                        }
                    }
                }
            });

            // Calculate summary statistics
            results.summary.bestMatch = bestMatch;
            results.summary.avgScore = allScores.length > 0 ? 
                allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

            return results;
        } catch (error) {
            logger.error('Failed to perform cross-analysis:', error.message);
            throw error;
        }
    }

    /**
     * Delete points from collection
     */
    async deletePoints(category, layer, pointIds) {
        try {
            const collectionName = this.getCollectionName(category, layer);
            
            if (!collectionName) {
                throw new Error(`Invalid category: ${category} or layer: ${layer}`);
            }

            const deleteQuery = {
                points: Array.isArray(pointIds) ? pointIds : [pointIds]
            };

            await axios.post(
                `${this.baseUrl}/collections/${collectionName}/points/delete`,
                deleteQuery,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            );

            logger.info(`Deleted ${deleteQuery.points.length} points from ${collectionName}`);
            return true;
        } catch (error) {
            logger.error(`Failed to delete points from ${category}/${layer}:`, error.message);
            throw error;
        }
    }

    /**
     * Update point payload
     */
    async updatePointPayload(category, layer, pointId, payload) {
        try {
            const collectionName = this.getCollectionName(category, layer);
            
            if (!collectionName) {
                throw new Error(`Invalid category: ${category} or layer: ${layer}`);
            }

            const updateQuery = {
                points: [pointId],
                payload: {
                    ...payload,
                    updatedAt: new Date().toISOString()
                }
            };

            await axios.post(
                `${this.baseUrl}/collections/${collectionName}/points/payload`,
                updateQuery,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            );

            logger.info(`Updated payload for point ${pointId} in ${collectionName}`);
            return true;
        } catch (error) {
            logger.error(`Failed to update point payload in ${category}/${layer}:`, error.message);
            throw error;
        }
    }

    /**
     * Utility methods
     */
    getCollectionName(category, layer) {
        if (!this.collections[layer] || !this.collections[layer][category]) {
            return null;
        }
        return this.collections[layer][category];
    }

    generatePointId() {
        return `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get all available categories and layers
     */
    getAvailableCategories() {
        return {
            frontend: Object.keys(this.collections.frontend),
            backend: Object.keys(this.collections.backend)
        };
    }

    /**
     * Validate category and layer
     */
    validateCategoryLayer(category, layer) {
        const categories = this.getAvailableCategories();
        
        if (!categories[layer]) {
            return { valid: false, error: `Invalid layer: ${layer}. Must be 'frontend' or 'backend'` };
        }
        
        if (!categories[layer].includes(category)) {
            return { 
                valid: false, 
                error: `Invalid category: ${category}. Available categories for ${layer}: ${categories[layer].join(', ')}` 
            };
        }
        
        return { valid: true };
    }

    /**
     * Create index for better search performance
     */
    async createIndex(category, layer, fieldName) {
        try {
            const collectionName = this.getCollectionName(category, layer);
            
            if (!collectionName) {
                throw new Error(`Invalid category: ${category} or layer: ${layer}`);
            }

            const indexConfig = {
                field_name: fieldName,
                field_schema: "keyword"
            };

            await axios.put(
                `${this.baseUrl}/collections/${collectionName}/index`,
                indexConfig,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            );

            logger.info(`Created index on field '${fieldName}' for collection ${collectionName}`);
            return true;
        } catch (error) {
            logger.error(`Failed to create index for ${category}/${layer}:`, error.message);
            throw error;
        }
    }
}

module.exports = QdrantTableManager;

