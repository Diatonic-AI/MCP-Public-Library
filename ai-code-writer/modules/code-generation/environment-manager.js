/**
 * Environment Manager Module
 * Handles environment variable loading and AI service initialization
 */

const fs = require('fs').promises;
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Logger = require('../../utils/logger');

class EnvironmentManager {
  constructor() {
    this.logger = new Logger('EnvironmentManager');
    this.genAI = null;
    this.model = null;
  }

  getTools() {
    return [
      {
        name: 'load_environment',
        description: 'Load environment variables from .env file and initialize AI services',
        inputSchema: {
          type: 'object',
          properties: {
            env_file_path: {
              type: 'string',
              description: 'Path to .env file',
              default: './.env'
            }
          },
          required: []
        }
      }
    ];
  }

  async loadEnvironment(args) {
    try {
      const { env_file_path = './.env' } = args;
      
      // Force reload environment variables
      const envPath = path.resolve(env_file_path);
      
      try {
        await fs.access(envPath);
        require('dotenv').config({ path: envPath, override: true });
        
        // Reinitialize Gemini AI with new environment
        if (process.env.GEMINI_API_KEY) {
          this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
          this.logger.info('Gemini AI initialized successfully');
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              env_file_loaded: envPath,
              mongodb_config_loaded: !!process.env.MONGODB_URI,
              mongodb_logger_config: {
                db: process.env.MONGODB_LOGGER_DB || 'mcp_tool_logs',
                collection: process.env.MONGODB_LOGGER_COLLECTION || 'tool_executions'
              },
              redis_config_loaded: !!process.env.REDIS_URL,
              gemini_config_loaded: !!process.env.GEMINI_API_KEY,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Could not load .env file from ${envPath}: ${error.message}`,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
    } catch (error) {
      throw new Error(`Environment loading failed: ${error.message}`);
    }
  }

  getGeminiModel() {
    return this.model;
  }

  isGeminiConfigured() {
    return !!this.genAI && !!process.env.GEMINI_API_KEY;
  }
}

module.exports = EnvironmentManager;

