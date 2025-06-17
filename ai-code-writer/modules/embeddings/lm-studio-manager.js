const axios = require('axios');
const Logger = require('../../utils/logger');
const logger = new Logger('LMStudio');

class LMStudioManager {
    constructor() {
        this.baseUrl = process.env.LM_STUDIO_BASE_URL;
        this.embeddingsUrl = process.env.LM_STUDIO_EMBEDDINGS_URL;
        this.modelsUrl = process.env.LM_STUDIO_MODELS_URL;
        this.completionsUrl = process.env.LM_STUDIO_COMPLETIONS_URL;
        this.chatCompletionsUrl = process.env.LM_STUDIO_CHAT_COMPLETIONS_URL;
        this.availableModels = [];
        this.embeddingModels = [];
        this.selectedModels = {
            primary: null,
            secondary: null,
            tertiary: null
        };
    }

    /**
     * Initialize the LM Studio manager
     */
    async initialize() {
        try {
            logger.info('Initializing LM Studio Manager...');
            
            if (!this.baseUrl || !this.modelsUrl || !this.embeddingsUrl) {
                throw new Error('LM Studio environment variables not properly set. Required: LM_STUDIO_BASE_URL, LM_STUDIO_MODELS_URL, LM_STUDIO_EMBEDDINGS_URL');
            }

            await this.fetchAvailableModels();
            await this.selectBestEmbeddingModels();
            
            logger.info(`LM Studio Manager initialized with ${this.embeddingModels.length} embedding models`);
            return true;
        } catch (error) {
            logger.error('Failed to initialize LM Studio Manager:', error.message);
            throw error;
        }
    }

    /**
     * Fetch available models from LM Studio API
     */
    async fetchAvailableModels() {
        try {
            const response = await axios.get(this.modelsUrl, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            this.availableModels = response.data.data || [];
            
            // Filter embedding models
            this.embeddingModels = this.availableModels.filter(model => 
                this.isEmbeddingModel(model.id)
            );

            logger.info(`Found ${this.availableModels.length} total models, ${this.embeddingModels.length} embedding models`);
            
            return this.availableModels;
        } catch (error) {
            logger.error('Failed to fetch models from LM Studio:', error.message);
            throw new Error(`LM Studio API unavailable: ${error.message}`);
        }
    }

    /**
     * Check if a model is suitable for embeddings
     */
    isEmbeddingModel(modelId) {
        const embeddingPatterns = [
            /embedding/i,
            /embed/i,
            /sentence-transformers/i,
            /all-MiniLM/i,
            /all-mpnet/i,
            /bge-/i,
            /gte-/i,
            /e5-/i,
            /nomic-embed/i,
            /text-embedding/i
        ];

        return embeddingPatterns.some(pattern => pattern.test(modelId));
    }

    /**
     * Select the 3 best embedding models
     */
    async selectBestEmbeddingModels() {
        if (this.embeddingModels.length === 0) {
            logger.warn('No embedding models found in LM Studio');
            return;
        }

        // Rank models by quality (based on common patterns)
        const rankedModels = this.embeddingModels.sort((a, b) => {
            return this.getModelScore(b.id) - this.getModelScore(a.id);
        });

        // Select top 3 models
        this.selectedModels.primary = rankedModels[0] || null;
        this.selectedModels.secondary = rankedModels[1] || null;
        this.selectedModels.tertiary = rankedModels[2] || null;

        logger.info('Selected embedding models:', {
            primary: this.selectedModels.primary?.id,
            secondary: this.selectedModels.secondary?.id,
            tertiary: this.selectedModels.tertiary?.id
        });
    }

    /**
     * Score models based on quality indicators
     */
    getModelScore(modelId) {
        let score = 0;
        const id = modelId.toLowerCase();

        // High-quality model patterns
        if (id.includes('large') || id.includes('xl')) score += 30;
        if (id.includes('base')) score += 20;
        if (id.includes('small')) score += 10;
        
        // Specific high-performance models
        if (id.includes('bge-large')) score += 50;
        if (id.includes('gte-large')) score += 45;
        if (id.includes('e5-large')) score += 40;
        if (id.includes('all-mpnet')) score += 35;
        if (id.includes('nomic-embed')) score += 30;
        if (id.includes('all-minilm-l12')) score += 25;
        if (id.includes('all-minilm-l6')) score += 20;
        
        // Version preferences
        if (id.includes('v2') || id.includes('v3')) score += 10;
        if (id.includes('instruct')) score += 15;
        
        return score;
    }

    /**
     * Generate embeddings using specified model
     */
    async generateEmbeddings(text, modelPriority = 'primary') {
        const model = this.selectedModels[modelPriority];
        
        if (!model) {
            throw new Error(`No ${modelPriority} embedding model available`);
        }

        try {
            const response = await axios.post(this.embeddingsUrl, {
                model: model.id,
                input: text,
                encoding_format: 'float'
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const embeddings = response.data.data[0].embedding;
            
            return {
                embeddings,
                model: model.id,
                dimensions: embeddings.length,
                usage: response.data.usage
            };
        } catch (error) {
            logger.error(`Failed to generate embeddings with ${model.id}:`, error.message);
            
            // Try fallback model if primary fails
            if (modelPriority === 'primary' && this.selectedModels.secondary) {
                logger.info('Trying secondary embedding model...');
                return this.generateEmbeddings(text, 'secondary');
            } else if (modelPriority === 'secondary' && this.selectedModels.tertiary) {
                logger.info('Trying tertiary embedding model...');
                return this.generateEmbeddings(text, 'tertiary');
            }
            
            throw error;
        }
    }

    /**
     * Batch generate embeddings for multiple texts
     */
    async generateBatchEmbeddings(texts, modelPriority = 'primary', batchSize = 10) {
        const results = [];
        
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchPromises = batch.map(text => 
                this.generateEmbeddings(text, modelPriority)
            );
            
            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                
                // Small delay between batches to avoid overwhelming the API
                if (i + batchSize < texts.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                logger.error(`Batch embedding failed for batch starting at index ${i}:`, error.message);
                throw error;
            }
        }
        
        return results;
    }

    /**
     * Get model information
     */
    getModelInfo() {
        return {
            baseUrl: this.baseUrl,
            totalModels: this.availableModels.length,
            embeddingModels: this.embeddingModels.length,
            selectedModels: this.selectedModels,
            availableEmbeddingModels: this.embeddingModels.map(m => ({
                id: m.id,
                score: this.getModelScore(m.id)
            }))
        };
    }

    /**
     * Health check for LM Studio connection
     */
    async healthCheck() {
        try {
            const response = await axios.get(`${this.baseUrl}/health`, {
                timeout: 5000
            });
            return { healthy: true, status: response.status };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
}

module.exports = LMStudioManager;

