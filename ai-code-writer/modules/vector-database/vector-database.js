/**
 * Vector Database Module
 * Manages vector storage, similarity search, and contextual reasoning
 */

const fs = require('fs').promises;
const path = require('path');
const Logger = require('../../utils/logger');

class VectorDatabase {
  constructor() {
    this.logger = new Logger('VectorDatabase');
    this.vectors = new Map(); // In-memory vector storage
    this.metadata = new Map(); // Associated metadata
    this.dbPath = null;
    this.initialized = false;
  }

  getTools() {
    return [
      {
        name: 'initialize_vector_database',
        description: 'Initialize vector database with storage path',
        inputSchema: {
          type: 'object',
          properties: {
            db_path: {
              type: 'string',
              description: 'Path to store vector database',
              default: './vector_db'
            },
            dimension: {
              type: 'number',
              description: 'Vector dimension size',
              default: 1536
            },
            load_existing: {
              type: 'boolean',
              description: 'Load existing database if available',
              default: true
            }
          },
          required: []
        }
      },
      {
        name: 'store_vector',
        description: 'Store vector with metadata in database',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the vector'
            },
            vector: {
              type: 'array',
              items: { type: 'number' },
              description: 'Vector embedding array'
            },
            metadata: {
              type: 'object',
              description: 'Associated metadata (text, source, category, etc.)'
            },
            category: {
              type: 'string',
              description: 'Category for organizing vectors',
              default: 'general'
            }
          },
          required: ['id', 'vector', 'metadata']
        }
      },
      {
        name: 'similarity_search',
        description: 'Perform similarity search against stored vectors',
        inputSchema: {
          type: 'object',
          properties: {
            query_vector: {
              type: 'array',
              items: { type: 'number' },
              description: 'Query vector for similarity search'
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
            metadata_filter: {
              type: 'object',
              description: 'Filter results by metadata fields'
            }
          },
          required: ['query_vector']
        }
      },
      {
        name: 'contextual_search',
        description: 'Advanced contextual search with reasoning algorithms',
        inputSchema: {
          type: 'object',
          properties: {
            context_vectors: {
              type: 'array',
              items: {
                type: 'array',
                items: { type: 'number' }
              },
              description: 'Multiple context vectors for complex reasoning'
            },
            reasoning_type: {
              type: 'string',
              enum: ['weighted_average', 'max_similarity', 'consensus', 'hierarchical'],
              default: 'weighted_average',
              description: 'Type of reasoning algorithm to apply'
            },
            context_weights: {
              type: 'array',
              items: { type: 'number' },
              description: 'Weights for each context vector'
            },
            top_k: {
              type: 'number',
              default: 10,
              description: 'Number of results to return'
            }
          },
          required: ['context_vectors']
        }
      },
      {
        name: 'get_database_stats',
        description: 'Get statistics about the vector database',
        inputSchema: {
          type: 'object',
          properties: {
            include_categories: {
              type: 'boolean',
              default: true,
              description: 'Include category breakdown'
            }
          },
          required: []
        }
      },
      {
        name: 'backup_database',
        description: 'Create backup of vector database',
        inputSchema: {
          type: 'object',
          properties: {
            backup_path: {
              type: 'string',
              description: 'Path for backup file'
            },
            compress: {
              type: 'boolean',
              default: true,
              description: 'Compress backup file'
            }
          },
          required: []
        }
      }
    ];
  }

  async initializeVectorDatabase(args) {
    try {
      const { db_path = './vector_db', dimension = 1536, load_existing = true } = args;
      
      this.dbPath = path.resolve(db_path);
      this.dimension = dimension;
      
      // Ensure database directory exists
      await fs.mkdir(this.dbPath, { recursive: true });
      
      // Load existing database if requested
      if (load_existing) {
        await this.loadExistingDatabase();
      }
      
      this.initialized = true;
      
      const stats = {
        initialized: true,
        db_path: this.dbPath,
        dimension: this.dimension,
        total_vectors: this.vectors.size,
        categories: this.getCategoryStats(),
        timestamp: new Date().toISOString()
      };
      
      this.logger.info(`Vector database initialized: ${this.vectors.size} vectors loaded`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(stats, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Failed to initialize vector database:', error.message);
      throw new Error(`Vector database initialization failed: ${error.message}`);
    }
  }

  async storeVector(args) {
    try {
      if (!this.initialized) {
        throw new Error('Vector database not initialized. Call initialize_vector_database first.');
      }
      
      const { id, vector, metadata, category = 'general' } = args;
      
      // Validate vector dimension
      if (vector.length !== this.dimension) {
        throw new Error(`Vector dimension mismatch. Expected ${this.dimension}, got ${vector.length}`);
      }
      
      // Normalize vector
      const normalizedVector = this.normalizeVector(vector);
      
      // Store vector and metadata
      this.vectors.set(id, normalizedVector);
      this.metadata.set(id, {
        ...metadata,
        category,
        stored_at: new Date().toISOString(),
        vector_norm: this.calculateVectorNorm(normalizedVector)
      });
      
      // Persist to disk
      await this.persistVector(id, normalizedVector, metadata, category);
      
      const result = {
        success: true,
        id,
        category,
        vector_dimension: vector.length,
        metadata_keys: Object.keys(metadata),
        total_vectors: this.vectors.size,
        timestamp: new Date().toISOString()
      };
      
      this.logger.debug(`Stored vector ${id} in category ${category}`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Failed to store vector:', error.message);
      throw new Error(`Vector storage failed: ${error.message}`);
    }
  }

  async similaritySearch(args) {
    try {
      if (!this.initialized) {
        throw new Error('Vector database not initialized.');
      }
      
      const { 
        query_vector, 
        top_k = 5, 
        threshold = 0.7, 
        category_filter, 
        metadata_filter 
      } = args;
      
      // Validate query vector
      if (query_vector.length !== this.dimension) {
        throw new Error(`Query vector dimension mismatch. Expected ${this.dimension}, got ${query_vector.length}`);
      }
      
      const normalizedQuery = this.normalizeVector(query_vector);
      const results = [];
      
      // Calculate similarities
      for (const [id, vector] of this.vectors.entries()) {
        const metadata = this.metadata.get(id);
        
        // Apply filters
        if (category_filter && metadata.category !== category_filter) {
          continue;
        }
        
        if (metadata_filter && !this.matchesMetadataFilter(metadata, metadata_filter)) {
          continue;
        }
        
        const similarity = this.cosineSimilarity(normalizedQuery, vector);
        
        if (similarity >= threshold) {
          results.push({
            id,
            similarity,
            metadata,
            category: metadata.category
          });
        }
      }
      
      // Sort by similarity and return top_k
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, top_k);
      
      const searchResult = {
        query_processed: true,
        total_candidates: this.vectors.size,
        filtered_candidates: results.length,
        top_k: topResults.length,
        threshold,
        results: topResults,
        search_stats: {
          avg_similarity: topResults.length > 0 ? 
            topResults.reduce((sum, r) => sum + r.similarity, 0) / topResults.length : 0,
          max_similarity: topResults.length > 0 ? topResults[0].similarity : 0,
          min_similarity: topResults.length > 0 ? topResults[topResults.length - 1].similarity : 0
        },
        timestamp: new Date().toISOString()
      };
      
      this.logger.info(`Similarity search returned ${topResults.length} results`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(searchResult, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Similarity search failed:', error.message);
      throw new Error(`Similarity search failed: ${error.message}`);
    }
  }

  async contextualSearch(args) {
    try {
      if (!this.initialized) {
        throw new Error('Vector database not initialized.');
      }
      
      const { 
        context_vectors, 
        reasoning_type = 'weighted_average', 
        context_weights, 
        top_k = 10 
      } = args;
      
      // Validate context vectors
      for (const vector of context_vectors) {
        if (vector.length !== this.dimension) {
          throw new Error(`Context vector dimension mismatch. Expected ${this.dimension}, got ${vector.length}`);
        }
      }
      
      // Apply reasoning algorithm to combine context vectors
      let combinedVector;
      
      switch (reasoning_type) {
        case 'weighted_average':
          combinedVector = this.weightedAverageReasoning(context_vectors, context_weights);
          break;
        case 'max_similarity':
          combinedVector = await this.maxSimilarityReasoning(context_vectors);
          break;
        case 'consensus':
          combinedVector = await this.consensusReasoning(context_vectors);
          break;
        case 'hierarchical':
          combinedVector = await this.hierarchicalReasoning(context_vectors, context_weights);
          break;
        default:
          throw new Error(`Unknown reasoning type: ${reasoning_type}`);
      }
      
      // Perform similarity search with combined vector
      const searchArgs = {
        query_vector: combinedVector,
        top_k,
        threshold: 0.5 // Lower threshold for contextual search
      };
      
      const searchResponse = await this.similaritySearch(searchArgs);
      const searchResult = JSON.parse(searchResponse.content[0].text);
      
      // Add contextual reasoning metadata
      const contextualResult = {
        ...searchResult,
        contextual_search: true,
        reasoning_type,
        context_vectors_count: context_vectors.length,
        combined_vector_norm: this.calculateVectorNorm(combinedVector),
        reasoning_metadata: {
          algorithm_used: reasoning_type,
          context_influence: this.calculateContextInfluence(context_vectors, combinedVector),
          confidence_score: this.calculateConfidenceScore(searchResult.results)
        }
      };
      
      this.logger.info(`Contextual search with ${reasoning_type} returned ${searchResult.results.length} results`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(contextualResult, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Contextual search failed:', error.message);
      throw new Error(`Contextual search failed: ${error.message}`);
    }
  }

  async getDatabaseStats(args) {
    try {
      const { include_categories = true } = args;
      
      const stats = {
        initialized: this.initialized,
        total_vectors: this.vectors.size,
        dimension: this.dimension,
        db_path: this.dbPath,
        memory_usage: this.calculateMemoryUsage(),
        timestamp: new Date().toISOString()
      };
      
      if (include_categories) {
        stats.categories = this.getCategoryStats();
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(stats, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Failed to get database stats:', error.message);
      throw new Error(`Database stats failed: ${error.message}`);
    }
  }

  async backupDatabase(args) {
    try {
      if (!this.initialized) {
        throw new Error('Vector database not initialized.');
      }
      
      const { backup_path, compress = true } = args;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = backup_path || path.join(this.dbPath, `backup_${timestamp}.json`);
      
      const backupData = {
        metadata: {
          created_at: new Date().toISOString(),
          total_vectors: this.vectors.size,
          dimension: this.dimension,
          version: '1.0'
        },
        vectors: Object.fromEntries(this.vectors),
        metadata_store: Object.fromEntries(this.metadata)
      };
      
      let content = JSON.stringify(backupData, null, 2);
      
      if (compress) {
        // Simple compression simulation (in real implementation, use zlib)
        content = this.compressData(content);
      }
      
      await fs.writeFile(backupFile, content, 'utf8');
      
      const result = {
        success: true,
        backup_file: backupFile,
        vectors_backed_up: this.vectors.size,
        file_size: content.length,
        compressed: compress,
        timestamp: new Date().toISOString()
      };
      
      this.logger.info(`Database backed up to ${backupFile}`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Database backup failed:', error.message);
      throw new Error(`Database backup failed: ${error.message}`);
    }
  }

  // Helper Methods
  async loadExistingDatabase() {
    try {
      const vectorsFile = path.join(this.dbPath, 'vectors.json');
      const metadataFile = path.join(this.dbPath, 'metadata.json');
      
      if (await this.fileExists(vectorsFile) && await this.fileExists(metadataFile)) {
        const vectorsData = JSON.parse(await fs.readFile(vectorsFile, 'utf8'));
        const metadataData = JSON.parse(await fs.readFile(metadataFile, 'utf8'));
        
        this.vectors = new Map(Object.entries(vectorsData));
        this.metadata = new Map(Object.entries(metadataData));
        
        this.logger.info(`Loaded ${this.vectors.size} vectors from existing database`);
      }
    } catch (error) {
      this.logger.warn('Could not load existing database:', error.message);
    }
  }

  async persistVector(id, vector, metadata, category) {
    // In a production system, this would use a proper vector database
    // For now, we'll save to JSON files
    const vectorsFile = path.join(this.dbPath, 'vectors.json');
    const metadataFile = path.join(this.dbPath, 'metadata.json');
    
    try {
      await fs.writeFile(vectorsFile, JSON.stringify(Object.fromEntries(this.vectors), null, 2));
      await fs.writeFile(metadataFile, JSON.stringify(Object.fromEntries(this.metadata), null, 2));
    } catch (error) {
      this.logger.warn('Failed to persist vector to disk:', error.message);
    }
  }

  normalizeVector(vector) {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return norm === 0 ? vector : vector.map(val => val / norm);
  }

  calculateVectorNorm(vector) {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  }

  cosineSimilarity(vec1, vec2) {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    return Math.max(-1, Math.min(1, dotProduct)); // Clamp to [-1, 1]
  }

  matchesMetadataFilter(metadata, filter) {
    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  getCategoryStats() {
    const stats = {};
    for (const metadata of this.metadata.values()) {
      const category = metadata.category || 'uncategorized';
      stats[category] = (stats[category] || 0) + 1;
    }
    return stats;
  }

  calculateMemoryUsage() {
    const vectorSize = this.vectors.size * this.dimension * 8; // 8 bytes per float64
    const metadataSize = JSON.stringify(Object.fromEntries(this.metadata)).length * 2; // Rough estimate
    return {
      vectors_bytes: vectorSize,
      metadata_bytes: metadataSize,
      total_bytes: vectorSize + metadataSize,
      total_mb: (vectorSize + metadataSize) / (1024 * 1024)
    };
  }

  // Reasoning Algorithms
  weightedAverageReasoning(vectors, weights) {
    if (weights && weights.length !== vectors.length) {
      throw new Error('Weights length must match vectors length');
    }
    
    const defaultWeights = weights || vectors.map(() => 1 / vectors.length);
    const combined = new Array(this.dimension).fill(0);
    
    for (let i = 0; i < vectors.length; i++) {
      const weight = defaultWeights[i];
      for (let j = 0; j < this.dimension; j++) {
        combined[j] += vectors[i][j] * weight;
      }
    }
    
    return this.normalizeVector(combined);
  }

  async maxSimilarityReasoning(vectors) {
    // Find the vector that has maximum average similarity to all others
    let bestVector = vectors[0];
    let maxAvgSimilarity = -1;
    
    for (const candidateVector of vectors) {
      let totalSimilarity = 0;
      for (const otherVector of vectors) {
        if (candidateVector !== otherVector) {
          totalSimilarity += this.cosineSimilarity(
            this.normalizeVector(candidateVector),
            this.normalizeVector(otherVector)
          );
        }
      }
      const avgSimilarity = totalSimilarity / (vectors.length - 1);
      
      if (avgSimilarity > maxAvgSimilarity) {
        maxAvgSimilarity = avgSimilarity;
        bestVector = candidateVector;
      }
    }
    
    return this.normalizeVector(bestVector);
  }

  async consensusReasoning(vectors) {
    // Use element-wise median for consensus
    const combined = new Array(this.dimension);
    
    for (let dim = 0; dim < this.dimension; dim++) {
      const values = vectors.map(v => v[dim]).sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      combined[dim] = values.length % 2 === 0 
        ? (values[mid - 1] + values[mid]) / 2 
        : values[mid];
    }
    
    return this.normalizeVector(combined);
  }

  async hierarchicalReasoning(vectors, weights) {
    // Hierarchical clustering approach
    if (!weights || weights.length !== vectors.length) {
      // Default to importance-based weights
      weights = vectors.map((_, i) => Math.pow(0.8, i));
    }
    
    // Sort vectors by weights and apply exponential decay
    const sortedVectors = vectors
      .map((v, i) => ({ vector: v, weight: weights[i] }))
      .sort((a, b) => b.weight - a.weight);
    
    let result = this.normalizeVector(sortedVectors[0].vector);
    
    for (let i = 1; i < sortedVectors.length; i++) {
      const currentVector = this.normalizeVector(sortedVectors[i].vector);
      const blendWeight = sortedVectors[i].weight / (sortedVectors[i].weight + sortedVectors[0].weight);
      
      result = result.map((val, idx) => 
        val * (1 - blendWeight) + currentVector[idx] * blendWeight
      );
    }
    
    return this.normalizeVector(result);
  }

  calculateContextInfluence(contextVectors, combinedVector) {
    const influences = contextVectors.map(cv => 
      this.cosineSimilarity(this.normalizeVector(cv), combinedVector)
    );
    
    return {
      individual_influences: influences,
      max_influence: Math.max(...influences),
      min_influence: Math.min(...influences),
      avg_influence: influences.reduce((sum, inf) => sum + inf, 0) / influences.length
    };
  }

  calculateConfidenceScore(results) {
    if (results.length === 0) return 0;
    
    const similarities = results.map(r => r.similarity);
    const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
    const variance = similarities.reduce((sum, sim) => sum + Math.pow(sim - avgSimilarity, 2), 0) / similarities.length;
    
    // Confidence is higher when average similarity is high and variance is low
    return avgSimilarity * (1 - Math.sqrt(variance));
  }

  compressData(data) {
    // Simple compression simulation - in real implementation use zlib
    return data; // Placeholder
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = VectorDatabase;

