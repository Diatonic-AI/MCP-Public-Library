/**
 * Database Monitor MCP Tools
 * Exposes database monitoring functionality as MCP tools
 */

const DatabaseMonitor = require('./index');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class DatabaseMonitorTools {
    constructor() {
        this.monitor = null;
        this.initialized = false;
    }

    /**
     * Get tool definitions for MCP server
     */
    getTools() {
        return [
            {
                name: 'initialize_database_monitor',
                description: 'Initialize database monitor with connection to all backends',
                inputSchema: {
                    type: 'object',
                    properties: {
                        mongodb_uri: {
                            type: 'string',
                            description: 'MongoDB connection URI'
                        },
                        redis_url: {
                            type: 'string', 
                            description: 'Redis connection URL'
                        },
                        neo4j_uri: {
                            type: 'string',
                            description: 'Neo4j connection URI'
                        },
                        neo4j_user: {
                            type: 'string',
                            description: 'Neo4j username'
                        },
                        neo4j_password: {
                            type: 'string',
                            description: 'Neo4j password'
                        },
                        qdrant_url: {
                            type: 'string',
                            description: 'Qdrant API URL'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'get_database_overview',
                description: 'Get comprehensive overview of all database connections and basic metrics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        include_details: {
                            type: 'boolean',
                            default: false,
                            description: 'Include detailed connection information'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'analyze_mongodb',
                description: 'Get detailed analysis of MongoDB databases, collections, and sample data',
                inputSchema: {
                    type: 'object',
                    properties: {
                        database_filter: {
                            type: 'string',
                            description: 'Filter to specific database name (optional)'
                        },
                        include_samples: {
                            type: 'boolean',
                            default: true,
                            description: 'Include sample documents'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'analyze_redis',
                description: 'Get detailed analysis of Redis keys, patterns, and memory usage',
                inputSchema: {
                    type: 'object',
                    properties: {
                        key_limit: {
                            type: 'number',
                            default: 100,
                            description: 'Maximum number of keys to analyze for patterns'
                        },
                        include_memory_details: {
                            type: 'boolean',
                            default: true,
                            description: 'Include detailed memory information'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'analyze_neo4j',
                description: 'Get detailed analysis of Neo4j graph structure, nodes, and relationships',
                inputSchema: {
                    type: 'object',
                    properties: {
                        include_schema: {
                            type: 'boolean',
                            default: true,
                            description: 'Include schema visualization data'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'analyze_qdrant',
                description: 'Get detailed analysis of Qdrant vector collections and configurations',
                inputSchema: {
                    type: 'object',
                    properties: {
                        collection_filter: {
                            type: 'string',
                            description: 'Filter to specific collection name (optional)'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'generate_health_report',
                description: 'Generate comprehensive system health report across all databases',
                inputSchema: {
                    type: 'object',
                    properties: {
                        save_to_file: {
                            type: 'boolean',
                            default: false,
                            description: 'Save report to file'
                        },
                        report_format: {
                            type: 'string',
                            enum: ['json', 'markdown'],
                            default: 'json',
                            description: 'Format for the report'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'create_database_visualization',
                description: 'Create visualization data for database metrics and charts',
                inputSchema: {
                    type: 'object',
                    properties: {
                        chart_types: {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: ['connection_status', 'data_volumes', 'performance_metrics']
                            },
                            default: ['connection_status', 'data_volumes'],
                            description: 'Types of charts to generate'
                        },
                        export_format: {
                            type: 'string',
                            enum: ['mermaid', 'json', 'csv'],
                            default: 'mermaid',
                            description: 'Export format for visualization data'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'query_mongodb_collection',
                description: 'Query specific MongoDB collection with filters and aggregation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        database: {
                            type: 'string',
                            description: 'Database name'
                        },
                        collection: {
                            type: 'string',
                            description: 'Collection name'
                        },
                        query: {
                            type: 'object',
                            description: 'MongoDB query filter',
                            default: {}
                        },
                        limit: {
                            type: 'number',
                            default: 10,
                            description: 'Maximum number of documents to return'
                        },
                        sort: {
                            type: 'object',
                            description: 'Sort criteria',
                            default: {}
                        }
                    },
                    required: ['database', 'collection']
                }
            },
            {
                name: 'query_redis_keys',
                description: 'Query Redis keys by pattern and get their values',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pattern: {
                            type: 'string',
                            default: '*',
                            description: 'Key pattern to search for'
                        },
                        limit: {
                            type: 'number',
                            default: 20,
                            description: 'Maximum number of keys to return'
                        },
                        include_values: {
                            type: 'boolean',
                            default: false,
                            description: 'Include key values (be careful with large values)'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'query_neo4j_cypher',
                description: 'Execute Cypher query on Neo4j database',
                inputSchema: {
                    type: 'object',
                    properties: {
                        cypher: {
                            type: 'string',
                            description: 'Cypher query to execute'
                        },
                        parameters: {
                            type: 'object',
                            description: 'Query parameters',
                            default: {}
                        },
                        limit: {
                            type: 'number',
                            default: 25,
                            description: 'Maximum number of results to return'
                        }
                    },
                    required: ['cypher']
                }
            },
            {
                name: 'search_qdrant_collection',
                description: 'Search vectors in Qdrant collection',
                inputSchema: {
                    type: 'object',
                    properties: {
                        collection_name: {
                            type: 'string',
                            description: 'Name of the collection to search'
                        },
                        query_vector: {
                            type: 'array',
                            items: { type: 'number' },
                            description: 'Query vector for similarity search'
                        },
                        top_k: {
                            type: 'number',
                            default: 5,
                            description: 'Number of top results to return'
                        },
                        score_threshold: {
                            type: 'number',
                            default: 0.0,
                            description: 'Minimum score threshold'
                        }
                    },
                    required: ['collection_name']
                }
            },
            {
                name: 'export_database_summary',
                description: 'Export comprehensive database summary to file',
                inputSchema: {
                    type: 'object',
                    properties: {
                        output_file: {
                            type: 'string',
                            description: 'Output file path (optional, auto-generated if not provided)'
                        },
                        format: {
                            type: 'string',
                            enum: ['json', 'markdown', 'csv'],
                            default: 'markdown',
                            description: 'Export format'
                        },
                        include_samples: {
                            type: 'boolean',
                            default: false,
                            description: 'Include sample data in export'
                        }
                    },
                    required: []
                }
            }
        ];
    }

    /**
     * Initialize database monitor
     */
    async initializeDatabaseMonitor(args) {
        try {
            // Load from environment if not provided
            const config = {
                mongodb: {
                    uri: args.mongodb_uri || process.env.MONGODB_URI
                },
                redis: {
                    url: args.redis_url || process.env.REDIS_URL
                },
                neo4j: {
                    uri: args.neo4j_uri || process.env.NEO4J_URI,
                    user: args.neo4j_user || process.env.NEO4J_USER,
                    password: args.neo4j_password || process.env.NEO4J_PASSWORD
                },
                qdrant: {
                    url: args.qdrant_url || process.env.QDRANT_URL
                }
            };

            this.monitor = new DatabaseMonitor(config);
            await this.monitor.initialize();
            this.initialized = true;

            return {
                success: true,
                message: 'Database monitor initialized successfully',
                connections: this.monitor.isConnected,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get database overview
     */
    async getDatabaseOverview(args) {
        if (!this.initialized) {
            throw new Error('Database monitor not initialized. Call initialize_database_monitor first.');
        }

        try {
            const overview = await this.monitor.getDatabaseOverview();
            
            if (!args.include_details) {
                // Return simplified overview
                return {
                    timestamp: overview.timestamp,
                    connections: overview.connections,
                    summary: {
                        mongodb: overview.databases.mongodb?.status || 'disconnected',
                        redis: overview.databases.redis?.status || 'disconnected',
                        neo4j: overview.databases.neo4j?.status || 'disconnected',
                        qdrant: overview.databases.qdrant?.status || 'disconnected'
                    }
                };
            }

            return overview;
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Analyze MongoDB
     */
    async analyzeMongoDB(args) {
        if (!this.initialized) {
            throw new Error('Database monitor not initialized. Call initialize_database_monitor first.');
        }

        try {
            const analysis = await this.monitor.getMongoDBAnalysis();
            
            if (args.database_filter) {
                // Filter to specific database
                const filtered = {
                    timestamp: analysis.timestamp,
                    databases: {}
                };
                
                if (analysis.databases[args.database_filter]) {
                    filtered.databases[args.database_filter] = analysis.databases[args.database_filter];
                }
                
                return filtered;
            }

            if (!args.include_samples) {
                // Remove sample documents
                const cleaned = { ...analysis };
                for (const dbName in cleaned.databases) {
                    for (const collName in cleaned.databases[dbName].collections) {
                        delete cleaned.databases[dbName].collections[collName].sampleDocuments;
                    }
                }
                return cleaned;
            }

            return analysis;
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Analyze Redis
     */
    async analyzeRedis(args) {
        if (!this.initialized) {
            throw new Error('Database monitor not initialized. Call initialize_database_monitor first.');
        }

        try {
            const analysis = await this.monitor.getRedisAnalysis();
            
            if (!args.include_memory_details) {
                delete analysis.memory;
            }

            return analysis;
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Analyze Neo4j
     */
    async analyzeNeo4j(args) {
        if (!this.initialized) {
            throw new Error('Database monitor not initialized. Call initialize_database_monitor first.');
        }

        try {
            const analysis = await this.monitor.getNeo4jAnalysis();
            
            if (!args.include_schema) {
                delete analysis.schema;
            }

            return analysis;
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Analyze Qdrant
     */
    async analyzeQdrant(args) {
        if (!this.initialized) {
            throw new Error('Database monitor not initialized. Call initialize_database_monitor first.');
        }

        try {
            const analysis = await this.monitor.getQdrantAnalysis();
            
            if (args.collection_filter) {
                // Filter to specific collection
                const filtered = {
                    timestamp: analysis.timestamp,
                    collections: {}
                };
                
                if (analysis.collections[args.collection_filter]) {
                    filtered.collections[args.collection_filter] = analysis.collections[args.collection_filter];
                }
                
                return filtered;
            }

            return analysis;
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Generate health report
     */
    async generateHealthReport(args) {
        if (!this.initialized) {
            throw new Error('Database monitor not initialized. Call initialize_database_monitor first.');
        }

        try {
            const report = await this.monitor.generateHealthReport();
            
            if (args.save_to_file) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `database-health-report-${timestamp}.${args.report_format}`;
                
                let content;
                if (args.report_format === 'markdown') {
                    content = this.formatReportAsMarkdown(report);
                } else {
                    content = JSON.stringify(report, null, 2);
                }
                
                await fs.writeFile(filename, content);
                
                return {
                    ...report,
                    saved_to: filename
                };
            }

            return report;
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Create database visualization
     */
    async createDatabaseVisualization(args) {
        if (!this.initialized) {
            throw new Error('Database monitor not initialized. Call initialize_database_monitor first.');
        }

        try {
            const visualData = await this.monitor.createVisualizationData();
            
            if (args.export_format === 'mermaid') {
                return this.formatAsMermaid(visualData);
            }

            return visualData;
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Query MongoDB collection
     */
    async queryMongoDBCollection(args) {
        if (!this.initialized || !this.monitor.isConnected.mongodb) {
            throw new Error('MongoDB not connected');
        }

        try {
            const db = this.monitor.connections.mongodb.db(args.database);
            const collection = db.collection(args.collection);
            
            const results = await collection
                .find(args.query)
                .sort(args.sort)
                .limit(args.limit)
                .toArray();

            return {
                database: args.database,
                collection: args.collection,
                query: args.query,
                count: results.length,
                results: results,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Query Redis keys
     */
    async queryRedisKeys(args) {
        if (!this.initialized || !this.monitor.isConnected.redis) {
            throw new Error('Redis not connected');
        }

        try {
            const keys = await this.monitor.connections.redis.keys(args.pattern);
            const limitedKeys = keys.slice(0, args.limit);
            
            const results = {
                pattern: args.pattern,
                totalFound: keys.length,
                returned: limitedKeys.length,
                keys: [],
                timestamp: new Date().toISOString()
            };

            for (const key of limitedKeys) {
                const keyInfo = {
                    key: key,
                    type: await this.monitor.connections.redis.type(key),
                    ttl: await this.monitor.connections.redis.ttl(key)
                };

                if (args.include_values) {
                    try {
                        if (keyInfo.type === 'string') {
                            keyInfo.value = await this.monitor.connections.redis.get(key);
                        } else if (keyInfo.type === 'hash') {
                            keyInfo.value = await this.monitor.connections.redis.hGetAll(key);
                        } else if (keyInfo.type === 'list') {
                            keyInfo.value = await this.monitor.connections.redis.lRange(key, 0, 10);
                        } else if (keyInfo.type === 'set') {
                            keyInfo.value = await this.monitor.connections.redis.sMembers(key);
                        }
                    } catch (err) {
                        keyInfo.value_error = err.message;
                    }
                }

                results.keys.push(keyInfo);
            }

            return results;
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Query Neo4j with Cypher
     */
    async queryNeo4jCypher(args) {
        if (!this.initialized || !this.monitor.isConnected.neo4j) {
            throw new Error('Neo4j not connected');
        }

        try {
            const session = this.monitor.connections.neo4j.session();
            const result = await session.run(args.cypher, args.parameters);
            
            const records = result.records.slice(0, args.limit).map(record => {
                const obj = {};
                record.keys.forEach(key => {
                    obj[key] = record.get(key);
                });
                return obj;
            });

            await session.close();

            return {
                cypher: args.cypher,
                parameters: args.parameters,
                recordCount: result.records.length,
                returned: records.length,
                records: records,
                summary: result.summary,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Search Qdrant collection
     */
    async searchQdrantCollection(args) {
        if (!this.initialized || !this.monitor.isConnected.qdrant) {
            throw new Error('Qdrant not connected');
        }

        try {
            if (!args.query_vector) {
                // If no query vector provided, just get collection info
                const response = await axios.get(`${this.monitor.config.qdrant.url}/collections/${args.collection_name}`);
                return {
                    collection: args.collection_name,
                    info: response.data.result,
                    timestamp: new Date().toISOString()
                };
            }

            const searchRequest = {
                vector: args.query_vector,
                limit: args.top_k,
                score_threshold: args.score_threshold
            };

            const response = await axios.post(
                `${this.monitor.config.qdrant.url}/collections/${args.collection_name}/points/search`,
                searchRequest
            );

            return {
                collection: args.collection_name,
                query: searchRequest,
                results: response.data.result,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Export database summary
     */
    async exportDatabaseSummary(args) {
        if (!this.initialized) {
            throw new Error('Database monitor not initialized. Call initialize_database_monitor first.');
        }

        try {
            const overview = await this.monitor.getDatabaseOverview();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = args.output_file || `database-summary-${timestamp}.${args.format}`;
            
            let content;
            if (args.format === 'markdown') {
                content = this.formatOverviewAsMarkdown(overview);
            } else if (args.format === 'csv') {
                content = this.formatOverviewAsCSV(overview);
            } else {
                content = JSON.stringify(overview, null, 2);
            }
            
            await fs.writeFile(filename, content);
            
            return {
                success: true,
                filename: filename,
                format: args.format,
                size: content.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Format report as Markdown
     */
    formatReportAsMarkdown(report) {
        let md = `# Database Health Report\n\n`;
        md += `**Generated:** ${report.timestamp}\n\n`;
        md += `**Status:** ${report.summary.status.toUpperCase()}\n\n`;
        md += `**Connected Databases:** ${report.summary.connectedDatabases}/${report.summary.totalDatabases}\n\n`;
        
        md += `## Connection Status\n\n`;
        if (report.details.overview?.connections) {
            for (const [db, connected] of Object.entries(report.details.overview.connections)) {
                md += `- **${db.toUpperCase()}:** ${connected ? '✅ Connected' : '❌ Disconnected'}\n`;
            }
        }
        
        // Add more sections as needed...
        
        return md;
    }

    /**
     * Format overview as Markdown
     */
    formatOverviewAsMarkdown(overview) {
        let md = `# Database Overview\n\n`;
        md += `**Generated:** ${overview.timestamp}\n\n`;
        
        md += `## Connections\n\n`;
        for (const [db, connected] of Object.entries(overview.connections)) {
            md += `- **${db.toUpperCase()}:** ${connected ? '✅ Connected' : '❌ Disconnected'}\n`;
        }
        
        // Add database details...
        
        return md;
    }

    /**
     * Format overview as CSV
     */
    formatOverviewAsCSV(overview) {
        let csv = 'Database,Status,Details\n';
        
        for (const [db, connected] of Object.entries(overview.connections)) {
            const details = overview.databases[db] ? JSON.stringify(overview.databases[db]).replace(/,/g, ';') : 'N/A';
            csv += `${db},${connected ? 'Connected' : 'Disconnected'},"${details}"\n`;
        }
        
        return csv;
    }

    /**
     * Format visualization data as Mermaid
     */
    formatAsMermaid(visualData) {
        let mermaid = 'graph TD\n';
        
        // Connection status
        if (visualData.charts.connectionStatus) {
            visualData.charts.connectionStatus.data.forEach((item, index) => {
                const status = item.status === 'Connected' ? 'C' : 'D';
                mermaid += `    ${item.name}[${item.name}] --> ${status}${index}[${item.status}]\n`;
            });
        }
        
        return {
            mermaid: mermaid,
            title: 'Database Connections Diagram',
            timestamp: visualData.timestamp
        };
    }

    /**
     * Handle tool execution
     */
    async handleTool(name, args) {
        switch (name) {
            case 'initialize_database_monitor':
                return await this.initializeDatabaseMonitor(args);
            case 'get_database_overview':
                return await this.getDatabaseOverview(args);
            case 'analyze_mongodb':
                return await this.analyzeMongoDB(args);
            case 'analyze_redis':
                return await this.analyzeRedis(args);
            case 'analyze_neo4j':
                return await this.analyzeNeo4j(args);
            case 'analyze_qdrant':
                return await this.analyzeQdrant(args);
            case 'generate_health_report':
                return await this.generateHealthReport(args);
            case 'create_database_visualization':
                return await this.createDatabaseVisualization(args);
            case 'query_mongodb_collection':
                return await this.queryMongoDBCollection(args);
            case 'query_redis_keys':
                return await this.queryRedisKeys(args);
            case 'query_neo4j_cypher':
                return await this.queryNeo4jCypher(args);
            case 'search_qdrant_collection':
                return await this.searchQdrantCollection(args);
            case 'export_database_summary':
                return await this.exportDatabaseSummary(args);
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }

    /**
     * Cleanup connections
     */
    async cleanup() {
        if (this.monitor) {
            await this.monitor.close();
        }
    }
}

module.exports = DatabaseMonitorTools;

