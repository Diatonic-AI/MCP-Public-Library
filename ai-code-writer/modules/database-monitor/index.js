/**
 * Database Monitor Module
 * Comprehensive database monitoring and visualization for MCP server
 * Supports MongoDB, Redis, Neo4j, and Qdrant
 */

const { MongoClient } = require('mongodb');
const redis = require('redis');
const neo4j = require('neo4j-driver');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class DatabaseMonitor {
    constructor(config) {
        this.config = config;
        this.connections = {
            mongodb: null,
            redis: null,
            neo4j: null,
            qdrant: null
        };
        this.isConnected = {
            mongodb: false,
            redis: false,
            neo4j: false,
            qdrant: false
        };
    }

    /**
     * Initialize all database connections
     */
    async initialize() {
        console.log('🔌 Initializing database connections...');
        
        try {
            // MongoDB
            if (this.config.mongodb?.uri) {
                this.connections.mongodb = new MongoClient(this.config.mongodb.uri);
                await this.connections.mongodb.connect();
                this.isConnected.mongodb = true;
                console.log('✅ MongoDB connected');
            }

            // Redis
            if (this.config.redis?.url) {
                this.connections.redis = redis.createClient({ url: this.config.redis.url });
                await this.connections.redis.connect();
                this.isConnected.redis = true;
                console.log('✅ Redis connected');
            }

            // Neo4j
            if (this.config.neo4j?.uri) {
                this.connections.neo4j = neo4j.driver(
                    this.config.neo4j.uri,
                    neo4j.auth.basic(this.config.neo4j.user, this.config.neo4j.password)
                );
                // Test connection
                const session = this.connections.neo4j.session();
                await session.run('RETURN 1');
                await session.close();
                this.isConnected.neo4j = true;
                console.log('✅ Neo4j connected');
            }

            // Qdrant
            if (this.config.qdrant?.url) {
                // Test Qdrant connection
                const response = await axios.get(`${this.config.qdrant.url}/collections`);
                this.isConnected.qdrant = response.status === 200;
                console.log('✅ Qdrant connected');
            }

        } catch (error) {
            console.error('❌ Database initialization error:', error.message);
        }
    }

    /**
     * Get comprehensive database overview
     */
    async getDatabaseOverview() {
        const overview = {
            timestamp: new Date().toISOString(),
            connections: { ...this.isConnected },
            databases: {}
        };

        // MongoDB overview
        if (this.isConnected.mongodb) {
            try {
                const admin = this.connections.mongodb.db().admin();
                const databases = await admin.listDatabases();
                overview.databases.mongodb = {
                    status: 'connected',
                    databases: databases.databases.map(db => ({
                        name: db.name,
                        sizeOnDisk: db.sizeOnDisk || 0
                    })),
                    totalDatabases: databases.databases.length,
                    totalSize: databases.totalSize || 0
                };
            } catch (error) {
                overview.databases.mongodb = { status: 'error', error: error.message };
            }
        }

        // Redis overview
        if (this.isConnected.redis) {
            try {
                const info = await this.connections.redis.info();
                const dbSize = await this.connections.redis.dbSize();
                const memory = await this.connections.redis.info('memory');
                
                overview.databases.redis = {
                    status: 'connected',
                    keyCount: dbSize,
                    memory: this.parseRedisInfo(memory),
                    uptime: this.parseRedisInfo(info).uptime_in_seconds
                };
            } catch (error) {
                overview.databases.redis = { status: 'error', error: error.message };
            }
        }

        // Neo4j overview
        if (this.isConnected.neo4j) {
            try {
                const session = this.connections.neo4j.session();
                const nodeCountResult = await session.run('MATCH (n) RETURN count(n) as nodeCount');
                const relCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as relCount');
                
                overview.databases.neo4j = {
                    status: 'connected',
                    nodeCount: nodeCountResult.records[0].get('nodeCount').toNumber(),
                    relationshipCount: relCountResult.records[0].get('relCount').toNumber()
                };
                
                await session.close();
            } catch (error) {
                overview.databases.neo4j = { status: 'error', error: error.message };
            }
        }

        // Qdrant overview
        if (this.isConnected.qdrant) {
            try {
                const collections = await axios.get(`${this.config.qdrant.url}/collections`);
                const collectionsData = collections.data.result.collections || [];
                
                overview.databases.qdrant = {
                    status: 'connected',
                    collections: collectionsData.length,
                    collectionNames: collectionsData.map(c => c.name)
                };
            } catch (error) {
                overview.databases.qdrant = { status: 'error', error: error.message };
            }
        }

        return overview;
    }

    /**
     * Get detailed MongoDB analysis
     */
    async getMongoDBAnalysis() {
        if (!this.isConnected.mongodb) {
            throw new Error('MongoDB not connected');
        }

        const analysis = {
            timestamp: new Date().toISOString(),
            databases: {}
        };

        try {
            const admin = this.connections.mongodb.db().admin();
            const databases = await admin.listDatabases();

            for (const dbInfo of databases.databases) {
                if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;

                const db = this.connections.mongodb.db(dbInfo.name);
                const collections = await db.listCollections().toArray();
                
                analysis.databases[dbInfo.name] = {
                    sizeOnDisk: dbInfo.sizeOnDisk || 0,
                    collections: {}
                };

                for (const collInfo of collections) {
                    const collection = db.collection(collInfo.name);
                    const count = await collection.countDocuments();
                    // Get collection stats (some MongoDB versions don't support .stats())
                    let stats = { size: 0, avgObjSize: 0 };
                    try {
                        const dbStats = await db.stats();
                        stats.size = dbStats.dataSize || 0;
                        stats.avgObjSize = count > 0 ? stats.size / count : 0;
                    } catch (err) {
                        // Fallback: estimate based on sample document
                        if (count > 0) {
                            const sampleDoc = await collection.findOne();
                            if (sampleDoc) {
                                const docSize = JSON.stringify(sampleDoc).length;
                                stats.avgObjSize = docSize;
                                stats.size = docSize * count;
                            }
                        }
                    }
                    
                    // Sample documents
                    const samples = await collection.find().limit(3).toArray();
                    
                    analysis.databases[dbInfo.name].collections[collInfo.name] = {
                        documentCount: count,
                        size: stats.size || 0,
                        avgObjSize: stats.avgObjSize || 0,
                        sampleDocuments: samples.map(doc => {
                            // Remove _id for cleaner display
                            const { _id, ...cleanDoc } = doc;
                            return cleanDoc;
                        })
                    };
                }
            }
        } catch (error) {
            analysis.error = error.message;
        }

        return analysis;
    }

    /**
     * Get detailed Redis analysis
     */
    async getRedisAnalysis() {
        if (!this.isConnected.redis) {
            throw new Error('Redis not connected');
        }

        const analysis = {
            timestamp: new Date().toISOString(),
            keys: {},
            patterns: {},
            memory: {}
        };

        try {
            // Get all keys
            const keys = await this.connections.redis.keys('*');
            analysis.totalKeys = keys.length;
            
            // Analyze key patterns
            const patterns = {};
            const keyTypes = {};
            const keyTTLs = {};
            
            for (const key of keys.slice(0, 100)) { // Limit to first 100 keys for performance
                const type = await this.connections.redis.type(key);
                const ttl = await this.connections.redis.ttl(key);
                
                keyTypes[type] = (keyTypes[type] || 0) + 1;
                
                if (ttl > 0) {
                    keyTTLs[key] = ttl;
                }
                
                // Extract pattern
                const pattern = key.split(':')[0] || 'no-pattern';
                patterns[pattern] = (patterns[pattern] || 0) + 1;
            }
            
            analysis.keyTypes = keyTypes;
            analysis.patterns = patterns;
            analysis.keysWithTTL = Object.keys(keyTTLs).length;
            
            // Memory info
            const memoryInfo = await this.connections.redis.info('memory');
            analysis.memory = this.parseRedisInfo(memoryInfo);
            
        } catch (error) {
            analysis.error = error.message;
        }

        return analysis;
    }

    /**
     * Get detailed Neo4j analysis
     */
    async getNeo4jAnalysis() {
        if (!this.isConnected.neo4j) {
            throw new Error('Neo4j not connected');
        }

        const analysis = {
            timestamp: new Date().toISOString(),
            nodes: {},
            relationships: {},
            schema: {}
        };

        try {
            const session = this.connections.neo4j.session();
            
            // Node labels and counts
            const labelsResult = await session.run('CALL db.labels()');
            for (const record of labelsResult.records) {
                const label = record.get('label');
                const countResult = await session.run(`MATCH (n:${label}) RETURN count(n) as count`);
                analysis.nodes[label] = countResult.records[0].get('count').toNumber();
            }
            
            // Relationship types and counts
            const relTypesResult = await session.run('CALL db.relationshipTypes()');
            for (const record of relTypesResult.records) {
                const relType = record.get('relationshipType');
                const countResult = await session.run(`MATCH ()-[r:${relType}]->() RETURN count(r) as count`);
                analysis.relationships[relType] = countResult.records[0].get('count').toNumber();
            }
            
            // Schema information
            const schemaResult = await session.run('CALL db.schema.visualization()');
            analysis.schema = schemaResult.records.map(record => ({
                nodes: record.get('nodes'),
                relationships: record.get('relationships')
            }));
            
            await session.close();
        } catch (error) {
            analysis.error = error.message;
        }

        return analysis;
    }

    /**
     * Get detailed Qdrant analysis
     */
    async getQdrantAnalysis() {
        if (!this.isConnected.qdrant) {
            throw new Error('Qdrant not connected');
        }

        const analysis = {
            timestamp: new Date().toISOString(),
            collections: {}
        };

        try {
            const collectionsResponse = await axios.get(`${this.config.qdrant.url}/collections`);
            const collections = collectionsResponse.data.result.collections || [];
            
            for (const collection of collections) {
                const collectionInfo = await axios.get(`${this.config.qdrant.url}/collections/${collection.name}`);
                const collectionData = collectionInfo.data.result;
                
                analysis.collections[collection.name] = {
                    status: collectionData.status,
                    vectorsCount: collectionData.vectors_count || 0,
                    pointsCount: collectionData.points_count || 0,
                    config: {
                        vectorSize: collectionData.config?.params?.vectors?.size || 'unknown',
                        distance: collectionData.config?.params?.vectors?.distance || 'unknown'
                    }
                };
            }
        } catch (error) {
            analysis.error = error.message;
        }

        return analysis;
    }

    /**
     * Generate comprehensive system health report
     */
    async generateHealthReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalDatabases: 4,
                connectedDatabases: Object.values(this.isConnected).filter(Boolean).length,
                status: 'healthy'
            },
            details: {}
        };

        try {
            report.details.overview = await this.getDatabaseOverview();
            
            if (this.isConnected.mongodb) {
                report.details.mongodb = await this.getMongoDBAnalysis();
            }
            
            if (this.isConnected.redis) {
                report.details.redis = await this.getRedisAnalysis();
            }
            
            if (this.isConnected.neo4j) {
                report.details.neo4j = await this.getNeo4jAnalysis();
            }
            
            if (this.isConnected.qdrant) {
                report.details.qdrant = await this.getQdrantAnalysis();
            }
            
            // Determine overall health
            const connectedCount = Object.values(this.isConnected).filter(Boolean).length;
            if (connectedCount === 0) {
                report.summary.status = 'critical';
            } else if (connectedCount < 2) {
                report.summary.status = 'warning';
            } else {
                report.summary.status = 'healthy';
            }
            
        } catch (error) {
            report.error = error.message;
            report.summary.status = 'error';
        }

        return report;
    }

    /**
     * Create visualization data for database metrics
     */
    async createVisualizationData() {
        const data = {
            timestamp: new Date().toISOString(),
            charts: {}
        };

        try {
            const overview = await this.getDatabaseOverview();
            
            // Connection status pie chart
            data.charts.connectionStatus = {
                type: 'pie',
                title: 'Database Connection Status',
                data: Object.entries(this.isConnected).map(([db, connected]) => ({
                    name: db.toUpperCase(),
                    value: connected ? 1 : 0,
                    status: connected ? 'Connected' : 'Disconnected'
                }))
            };
            
            // Data volume bar chart
            const volumes = [];
            if (overview.databases.mongodb) {
                volumes.push({
                    database: 'MongoDB',
                    size: overview.databases.mongodb.totalSize || 0,
                    count: overview.databases.mongodb.totalDatabases || 0
                });
            }
            
            if (overview.databases.redis) {
                volumes.push({
                    database: 'Redis',
                    size: overview.databases.redis.memory?.used_memory || 0,
                    count: overview.databases.redis.keyCount || 0
                });
            }
            
            if (overview.databases.neo4j) {
                volumes.push({
                    database: 'Neo4j',
                    size: 0, // Neo4j doesn't provide easy size metrics
                    count: overview.databases.neo4j.nodeCount + overview.databases.neo4j.relationshipCount
                });
            }
            
            if (overview.databases.qdrant) {
                volumes.push({
                    database: 'Qdrant',
                    size: 0, // Qdrant size would need more complex calculation
                    count: overview.databases.qdrant.collections || 0
                });
            }
            
            data.charts.dataVolumes = {
                type: 'bar',
                title: 'Data Volumes by Database',
                data: volumes
            };
            
        } catch (error) {
            data.error = error.message;
        }

        return data;
    }

    /**
     * Parse Redis INFO output
     */
    parseRedisInfo(infoString) {
        const info = {};
        const lines = infoString.split('\r\n');
        
        for (const line of lines) {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                info[key] = isNaN(value) ? value : Number(value);
            }
        }
        
        return info;
    }

    /**
     * Close all database connections
     */
    async close() {
        console.log('🔌 Closing database connections...');
        
        try {
            if (this.connections.mongodb) {
                await this.connections.mongodb.close();
                console.log('✅ MongoDB connection closed');
            }
            
            if (this.connections.redis) {
                await this.connections.redis.quit();
                console.log('✅ Redis connection closed');
            }
            
            if (this.connections.neo4j) {
                await this.connections.neo4j.close();
                console.log('✅ Neo4j connection closed');
            }
            
            console.log('✅ All database connections closed');
        } catch (error) {
            console.error('❌ Error closing connections:', error.message);
        }
    }
}

module.exports = DatabaseMonitor;

