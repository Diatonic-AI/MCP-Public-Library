/**
 * Response Formatter Utility
 * Handles proper JSON serialization and response formatting for MCP tools
 */

const Logger = require('./logger');

class ResponseFormatter {
  constructor() {
    this.logger = new Logger('ResponseFormatter');
    this.maxResponseSize = 100000; // 100KB limit
    this.chunkSize = 50000; // 50KB chunks
  }

  /**
   * Format a response properly for MCP
   * @param {any} data - The data to format
   * @param {Object} options - Formatting options
   * @returns {Object} - Properly formatted MCP response
   */
  formatResponse(data, options = {}) {
    try {
      const {
        type = 'text',
        prettify = true,
        maxSize = this.maxResponseSize,
        enableChunking = true
      } = options;

      // Handle different data types
      let content;
      if (typeof data === 'string') {
        content = data;
      } else if (typeof data === 'object') {
        content = prettify ? JSON.stringify(data, null, 2) : JSON.stringify(data);
      } else {
        content = String(data);
      }

      // Check size and chunk if necessary
      if (content.length > maxSize && enableChunking) {
        return this.createChunkedResponse(content, type);
      }

      // Validate JSON if it's supposed to be JSON
      if (type === 'json' || (typeof data === 'object' && data !== null)) {
        this.validateJson(content);
      }

      return {
        content: [{
          type,
          text: content
        }]
      };
    } catch (error) {
      this.logger.error('Response formatting failed:', error.message);
      return this.createErrorResponse(error.message);
    }
  }

  /**
   * Create a chunked response for large data
   * @param {string} content - The content to chunk
   * @param {string} type - Content type
   * @returns {Object} - Chunked MCP response
   */
  createChunkedResponse(content, type = 'text') {
    try {
      const chunks = this.chunkContent(content);
      const totalChunks = chunks.length;

      // For JSON responses, try to create a summary instead of chunking
      if (type === 'json' || content.trim().startsWith('{')) {
        return this.createSummarizedResponse(content);
      }

      // Return first chunk with metadata about remaining chunks
      return {
        content: [{
          type,
          text: chunks[0]
        }],
        metadata: {
          chunked: true,
          total_chunks: totalChunks,
          current_chunk: 1,
          remaining_size: content.length - chunks[0].length,
          note: `Response was chunked due to size (${content.length} bytes). Use get_chunk tool to retrieve remaining data.`
        }
      };
    } catch (error) {
      this.logger.error('Chunking failed:', error.message);
      return this.createErrorResponse(`Chunking failed: ${error.message}`);
    }
  }

  /**
   * Create a summarized response for large JSON objects
   * @param {string} jsonContent - The JSON content to summarize
   * @returns {Object} - Summarized MCP response
   */
  createSummarizedResponse(jsonContent) {
    try {
      const data = JSON.parse(jsonContent);
      const summary = this.createJsonSummary(data);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            response_summary: summary,
            full_response_size: `${jsonContent.length} bytes`,
            note: "Response was summarized due to size. Key information is shown above.",
            available_actions: [
              "Use specific query tools to get detailed information",
              "Request specific sections of the data"
            ]
          }, null, 2)
        }]
      };
    } catch (error) {
      this.logger.warn('JSON summarization failed, using text chunking');
      return this.createChunkedResponse(jsonContent, 'text');
    }
  }

  /**
   * Create a summary of a JSON object
   * @param {any} data - The data to summarize
   * @returns {Object} - Summary object
   */
  createJsonSummary(data) {
    if (Array.isArray(data)) {
      return {
        type: 'array',
        length: data.length,
        sample_items: data.slice(0, 3),
        contains: this.analyzeArrayContent(data)
      };
    }

    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      const summary = {
        type: 'object',
        total_keys: keys.length,
        main_keys: keys.slice(0, 10),
        key_types: {}
      };

      // Analyze key types and create abbreviated content
      const abbreviated = {};
      keys.forEach(key => {
        const value = data[key];
        const valueType = Array.isArray(value) ? 'array' : typeof value;
        summary.key_types[key] = valueType;

        // Include abbreviated versions of key data
        if (key.length < 50) { // Only include reasonably named keys
          if (typeof value === 'string' && value.length > 100) {
            abbreviated[key] = value.substring(0, 100) + '...';
          } else if (Array.isArray(value) && value.length > 5) {
            abbreviated[key] = [...value.slice(0, 5), `... ${value.length - 5} more items`];
          } else if (typeof value === 'object' && value !== null) {
            abbreviated[key] = this.createObjectPreview(value);
          } else {
            abbreviated[key] = value;
          }
        }
      });

      summary.abbreviated_content = abbreviated;
      return summary;
    }

    return {
      type: typeof data,
      value: data
    };
  }

  /**
   * Create a preview of an object
   * @param {Object} obj - Object to preview
   * @returns {Object} - Preview object
   */
  createObjectPreview(obj) {
    const keys = Object.keys(obj);
    if (keys.length <= 3) {
      return obj;
    }
    
    const preview = {};
    keys.slice(0, 3).forEach(key => {
      preview[key] = obj[key];
    });
    preview['...'] = `${keys.length - 3} more properties`;
    return preview;
  }

  /**
   * Analyze array content types
   * @param {Array} arr - Array to analyze
   * @returns {Object} - Content analysis
   */
  analyzeArrayContent(arr) {
    const types = new Set();
    const sample = arr.slice(0, 5);
    
    arr.forEach(item => {
      types.add(Array.isArray(item) ? 'array' : typeof item);
    });
    
    return {
      unique_types: Array.from(types),
      sample_values: sample
    };
  }

  /**
   * Chunk content into smaller pieces
   * @param {string} content - Content to chunk
   * @returns {Array} - Array of content chunks
   */
  chunkContent(content) {
    const chunks = [];
    for (let i = 0; i < content.length; i += this.chunkSize) {
      chunks.push(content.substring(i, i + this.chunkSize));
    }
    return chunks;
  }

  /**
   * Validate JSON string
   * @param {string} jsonString - JSON string to validate
   * @throws {Error} - If JSON is invalid
   */
  validateJson(jsonString) {
    try {
      JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }

  /**
   * Create an error response
   * @param {string} message - Error message
   * @returns {Object} - Error response
   */
  createErrorResponse(message) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          message: message,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Create a success response with metadata
   * @param {any} data - Response data
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Success response
   */
  createSuccessResponse(data, metadata = {}) {
    const response = {
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    return this.formatResponse(response);
  }

  /**
   * Format an operation result
   * @param {string} operation - Operation name
   * @param {boolean} success - Operation success status
   * @param {any} result - Operation result
   * @param {string} error - Error message if failed
   * @returns {Object} - Formatted response
   */
  formatOperationResult(operation, success, result = null, error = null) {
    const response = {
      operation,
      success,
      timestamp: new Date().toISOString()
    };

    if (success) {
      response.result = result;
    } else {
      response.error = error;
    }

    return this.formatResponse(response);
  }
}

module.exports = ResponseFormatter;

