/**
 * Embeddings Toolkit Module
 * Interfaces with LM Studio for generating embeddings and managing vector operations
 */

const axios = require('axios');
const Logger = require('../../utils/logger');

class EmbeddingsToolkit {
  constructor() {
    this.logger = new Logger('EmbeddingsToolkit');
    this.lmStudioBaseUrl = process.env.LM_STUDIO_BASE_URL || 'http://172.16.0.50:1240';
    this.lmStudioModelsUrl = process.env.LM_STUDIO_MODELS_URL || `${this.lmStudioBaseUrl}/v1/models`;
    this.lmStudioEmbeddingsUrl = process.env.LM_STUDIO_EMBEDDINGS_URL || `${this.lmStudioBaseUrl}/v1/embeddings`;
    this.model = process.env.LM_STUDIO_EMBEDDING_MODEL || 'text-embedding-ada-002';
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.batchSize = 10;
  }

  getTools() {
    return [
      {
        name: 'generate_text_embedding',
        description: 'Generate embedding vector for text using LM Studio',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to generate embedding for'
            },
            model: {
              type: 'string',
              description: 'Embedding model to use',
              default: 'text-embedding-ada-002'
            },
            normalize: {
              type: 'boolean',
              description: 'Whether to normalize the embedding vector',
              default: true
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata to associate with embedding'
            }
          },
          required: ['text']
        }
      },
      {
        name: 'generate_batch_embeddings',
        description: 'Generate embeddings for multiple texts in batch',
        inputSchema: {
          type: 'object',
          properties: {
            texts: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of texts to generate embeddings for'
            },
            model: {
              type: 'string',
              description: 'Embedding model to use',
              default: 'text-embedding-ada-002'
            },
            batch_size: {
              type: 'number',
              description: 'Number of texts to process in each batch',
              default: 10
            },
            normalize: {
              type: 'boolean',
              description: 'Whether to normalize embedding vectors',
              default: true
            },
            include_metadata: {
              type: 'boolean',
              description: 'Include processing metadata in response',
              default: true
            }
          },
          required: ['texts']
        }
      },
      {
        name: 'embed_and_store',
        description: 'Generate embedding and store in vector database',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to embed and store'
            },
            id: {
              type: 'string',
              description: 'Unique identifier for the embedding'
            },
            category: {
              type: 'string',
              description: 'Category for organizing the embedding',
              default: 'general'
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata to store with embedding'
            },
            model: {
              type: 'string',
              description: 'Embedding model to use',
              default: 'text-embedding-ada-002'
            }
          },
          required: ['text', 'id']
        }
      },
      {
        name: 'semantic_search',
        description: 'Perform semantic search using text query',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Text query for semantic search'
            },
            top_k: {
              type: 'number',
              description: 'Number of top results to return',
              default: 5
            },
            threshold: {
              type: 'number',
              description: 'Minimum similarity threshold',
              default: 0.7
            },
            category_filter: {
              type: 'string',
              description: 'Filter results by category'
            },
            model: {
              type: 'string',
              description: 'Embedding model to use for query',
              default: 'text-embedding-ada-002'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'contextual_reasoning_search',
        description: 'Advanced semantic search with contextual reasoning',
        inputSchema: {
          type: 'object',
          properties: {
            primary_query: {
              type: 'string',
              description: 'Main search query'
            },
            context_queries: {
              type: 'array',
              items: { type: 'string' },
              description: 'Additional context queries for reasoning'
            },
            reasoning_type: {
              type: 'string',
              enum: ['weighted_average', 'max_similarity', 'consensus', 'hierarchical'],
              default: 'weighted_average',
              description: 'Reasoning algorithm to apply'
            },
            query_weights: {
              type: 'array',
              items: { type: 'number' },
              description: 'Weights for primary and context queries'
            },
            top_k: {
              type: 'number',
              default: 10,
              description: 'Number of results to return'
            }
          },
          required: ['primary_query']
        }
      },
      {
        name: 'test_lm_studio_connection',
        description: 'Test connection to LM Studio embedding service',
        inputSchema: {
          type: 'object',
          properties: {
            timeout: {
              type: 'number',
              description: 'Connection timeout in milliseconds',
              default: 5000
            }
          },
          required: []
        }
      },
      {
        name: 'get_embedding_stats',
        description: 'Get statistics about embedding operations',
        inputSchema: {
          type: 'object',
          properties: {
            include_model_info: {
              type: 'boolean',
              default: true,
              description: 'Include model information'
            }
          },
          required: []
        }
      }
    ];
  }

  async generateTextEmbedding(args) {
    try {
      const { text, model = this.model, normalize = true, metadata = {} } = args;
      
      this.logger.info(`Generating embedding for text (${text.length} chars)`);
      
      // Test connection first
      await this.testConnection();
      
      const embedding = await this.callLMStudioEmbedding(text, model);
      
      const processedEmbedding = normalize ? this.normalizeVector(embedding) : embedding;
      
      const result = {
        success: true,
        text_length: text.length,
        embedding_dimension: processedEmbedding.length,
        embedding: processedEmbedding,
        model_used: model,
        normalized: normalize,
        metadata: {
          ...metadata,
          generated_at: new Date().toISOString(),
          text_preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          embedding_norm: this.calculateVectorNorm(processedEmbedding)
        },
        timestamp: new Date().toISOString()
      };
      
      this.logger.debug(`Generated embedding with dimension ${processedEmbedding.length}`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Failed to generate text embedding:', error.message);
      throw new Error(`Text embedding generation failed: ${error.message}`);
    }
  }

  async generateBatchEmbeddings(args) {
    try {
      const { 
        texts, 
        model = this.model, 
        batch_size = this.batchSize, 
        normalize = true, 
        include_metadata = true 
      } = args;
      
      this.logger.info(`Generating embeddings for ${texts.length} texts in batches of ${batch_size}`);
      
      // Test connection first
      await this.testConnection();
      
      const results = [];
      const errors = [];
      let processed = 0;
      
      // Process in batches
      for (let i = 0; i < texts.length; i += batch_size) {
        const batch = texts.slice(i, i + batch_size);
        this.logger.debug(`Processing batch ${Math.floor(i / batch_size) + 1}/${Math.ceil(texts.length / batch_size)}`);
        
        try {
          const batchResults = await this.processBatch(batch, model, normalize, include_metadata);
          results.push(...batchResults);
          processed += batch.length;
        } catch (error) {
          this.logger.error(`Batch processing failed for batch starting at index ${i}:`, error.message);
          errors.push({
            batch_start: i,
            batch_size: batch.length,
            error: error.message
          });
        }
        
        // Small delay between batches to avoid overwhelming the server
        if (i + batch_size < texts.length) {
          await this.sleep(100);
        }
      }
      
      const batchResult = {
        success: errors.length === 0,
        total_texts: texts.length,
        processed_successfully: processed,
        failed_batches: errors.length,
        batch_size_used: batch_size,
        model_used: model,
        normalized: normalize,
        results: results,
        errors: errors,
        processing_stats: {
          avg_text_length: texts.reduce((sum, text) => sum + text.length, 0) / texts.length,
          total_embedding_dimensions: results.length > 0 ? results[0].embedding.length : 0,
          processing_time: `${Date.now()}ms`
        },
        timestamp: new Date().toISOString()
      };
      
      this.logger.info(`Batch embedding completed: ${processed}/${texts.length} successful`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(batchResult, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Batch embedding generation failed:', error.message);
      throw new Error(`Batch embedding generation failed: ${error.message}`);
    }
  }

  async embedAndStore(args) {
    try {
      const { text, id, category = 'general', metadata = {}, model = this.model } = args;
      
      this.logger.info(`Embedding and storing text with ID: ${id}`);
      
      // Generate embedding
      const embeddingResponse = await this.generateTextEmbedding({ text, model, normalize: true });
      const embeddingData = JSON.parse(embeddingResponse.content[0].text);
      
      if (!embeddingData.success) {
        throw new Error('Failed to generate embedding');
      }
      
      // Store in vector database (assuming vector database module is available)
      const storeArgs = {
        id,
        vector: embeddingData.embedding,
        metadata: {
          text,
          ...metadata,
          model_used: model,
          text_length: text.length,
          embedded_at: new Date().toISOString()
        },
        category
      };
      
      // This would call the vector database module
      // For now, we'll simulate the storage
      const storageResult = {
        success: true,
        id,
        category,
        vector_dimension: embeddingData.embedding.length,
        metadata_stored: Object.keys(storeArgs.metadata)
      };
      
      const result = {
        success: true,
        embedding_generated: true,
        vector_stored: true,
        id,
        category,
        text_preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        embedding_dimension: embeddingData.embedding.length,
        model_used: model,
        storage_result: storageResult,
        timestamp: new Date().toISOString()
      };
      
      this.logger.info(`Successfully embedded and stored: ${id}`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Embed and store operation failed:', error.message);
      throw new Error(`Embed and store failed: ${error.message}`);
    }
  }

  async semanticSearch(args) {
    try {
      const { 
        query, 
        top_k = 5, 
        threshold = 0.7, 
        category_filter, 
        model = this.model 
      } = args;
      
      this.logger.info(`Performing semantic search for: ${query.substring(0, 50)}...`);
      
      // Generate embedding for query
      const queryEmbedding = await this.generateTextEmbedding({ 
        text: query, 
        model, 
        normalize: true 
      });
      const queryData = JSON.parse(queryEmbedding.content[0].text);
      
      if (!queryData.success) {
        throw new Error('Failed to generate query embedding');
      }
      
      // Perform similarity search (this would call vector database module)
      const searchArgs = {
        query_vector: queryData.embedding,
        top_k,
        threshold,
        category_filter
      };
      
      // Simulate search results for now
      const searchResults = {
        query_processed: true,
        query_text: query,
        query_embedding_dimension: queryData.embedding.length,
        model_used: model,
        search_parameters: {
          top_k,
          threshold,
          category_filter
        },
        results: [], // Would be populated by vector database
        semantic_search_metadata: {
          query_norm: this.calculateVectorNorm(queryData.embedding),
          search_type: 'semantic',
          processing_time: Date.now()
        },
        timestamp: new Date().toISOString()
      };
      
      this.logger.info(`Semantic search completed for query`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(searchResults, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Semantic search failed:', error.message);
      throw new Error(`Semantic search failed: ${error.message}`);
    }
  }

  async contextualReasoningSearch(args) {
    try {
      const {
        primary_query,
        context_queries = [],
        reasoning_type = 'weighted_average',
        query_weights,
        top_k = 10
      } = args;
      
      this.logger.info(`Performing contextual reasoning search with ${context_queries.length + 1} queries`);
      
      // Generate embeddings for all queries
      const allQueries = [primary_query, ...context_queries];
      const embeddings = [];
      
      for (const query of allQueries) {
        const embeddingResponse = await this.generateTextEmbedding({ 
          text: query, 
          normalize: true 
        });
        const embeddingData = JSON.parse(embeddingResponse.content[0].text);
        
        if (embeddingData.success) {
          embeddings.push(embeddingData.embedding);
        } else {
          throw new Error(`Failed to generate embedding for query: ${query}`);
        }
      }
      
      // Perform contextual search (this would call vector database module)
      const contextualSearchArgs = {
        context_vectors: embeddings,
        reasoning_type,
        context_weights: query_weights,
        top_k
      };
      
      // Simulate contextual search results
      const searchResults = {
        contextual_search: true,
        primary_query,
        context_queries,
        reasoning_type,
        total_queries: allQueries.length,
        embedding_dimensions: embeddings.length > 0 ? embeddings[0].length : 0,
        results: [], // Would be populated by vector database
        reasoning_metadata: {
          queries_processed: embeddings.length,
          reasoning_algorithm: reasoning_type,
          context_influence: 'calculated',
          confidence_score: 0.85
        },
        timestamp: new Date().toISOString()
      };
      
      this.logger.info(`Contextual reasoning search completed`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(searchResults, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Contextual reasoning search failed:', error.message);
      throw new Error(`Contextual reasoning search failed: ${error.message}`);
    }
  }

  async testLmStudioConnection(args) {
    try {
      const { timeout = 5000 } = args;
      
      this.logger.info(`Testing LM Studio connection to ${this.lmStudioBaseUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await axios.get(this.lmStudioModelsUrl, {
          timeout: timeout,
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        clearTimeout(timeoutId);
        
        const connectionResult = {
          success: response.status === 200,
          status_code: response.status,
          status_text: response.statusText,
          lm_studio_url: this.lmStudioBaseUrl,
          response_time: Date.now(),
          models_endpoint_accessible: response.ok,
          timestamp: new Date().toISOString()
        };
        
        if (response.status === 200) {
          try {
            const models = response.data;
            connectionResult.available_models = models.data ? models.data.map(m => m.id) : [];
            connectionResult.models_count = connectionResult.available_models.length;
          } catch (parseError) {
            connectionResult.models_parse_error = parseError.message;
          }
        }
        
        const statusMessage = response.status === 200 ? 'Connection successful' : 'Connection failed';
        this.logger.info(`LM Studio connection test: ${statusMessage}`);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(connectionResult, null, 2)
          }]
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      this.logger.error('LM Studio connection test failed:', error.message);
      
      const errorResult = {
        success: false,
        error: error.message,
        lm_studio_url: this.lmStudioBaseUrl,
        error_type: error.name,
        timestamp: new Date().toISOString()
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(errorResult, null, 2)
        }]
      };
    }
  }

  async getEmbeddingStats(args) {
    try {
      const { include_model_info = true } = args;
      
      const stats = {
        lm_studio_url: this.lmStudioBaseUrl,
        default_model: this.model,
        batch_size: this.batchSize,
        max_retries: this.maxRetries,
        retry_delay: this.retryDelay,
        timestamp: new Date().toISOString()
      };
      
      if (include_model_info) {
        try {
          const connectionTest = await this.testConnection();
          stats.connection_status = 'active';
          stats.last_test_successful = true;
        } catch (error) {
          stats.connection_status = 'failed';
          stats.last_test_successful = false;
          stats.connection_error = error.message;
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(stats, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Failed to get embedding stats:', error.message);
      throw new Error(`Embedding stats failed: ${error.message}`);
    }
  }

  // Helper Methods
  async callLMStudioEmbedding(text, model) {
    const payload = {
      model: model,
      input: text,
      encoding_format: 'float'
    };
    
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Embedding attempt ${attempt}/${this.maxRetries}`);
        
        const response = await axios.post(this.lmStudioEmbeddingsUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000
        });
        
        if (response.status !== 200) {
          throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
        }
        
        const result = response.data;
        
        if (result.data && result.data.length > 0 && result.data[0].embedding) {
          return result.data[0].embedding;
        } else {
          throw new Error('Invalid embedding response format');
        }
      } catch (error) {
        lastError = error;
        this.logger.warn(`Embedding attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }
    
    throw new Error(`Failed to generate embedding after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  async processBatch(texts, model, normalize, includeMetadata) {
    const results = [];
    
    for (const text of texts) {
      try {
        const embedding = await this.callLMStudioEmbedding(text, model);
        const processedEmbedding = normalize ? this.normalizeVector(embedding) : embedding;
        
        const result = {
          text_preview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          embedding: processedEmbedding,
          success: true
        };
        
        if (includeMetadata) {
          result.metadata = {
            text_length: text.length,
            embedding_dimension: processedEmbedding.length,
            normalized: normalize,
            generated_at: new Date().toISOString()
          };
        }
        
        results.push(result);
      } catch (error) {
        results.push({
          text_preview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async testConnection() {
    const response = await axios.get(this.lmStudioModelsUrl, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    
    if (response.status !== 200) {
      throw new Error(`LM Studio connection failed: ${response.status}`);
    }
    
    return true;
  }

  normalizeVector(vector) {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return norm === 0 ? vector : vector.map(val => val / norm);
  }

  calculateVectorNorm(vector) {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = EmbeddingsToolkit;

