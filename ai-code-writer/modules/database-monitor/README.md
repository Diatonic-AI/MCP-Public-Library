# Database Monitor Module

Comprehensive database monitoring and visualization module for MCP server. Provides real-time monitoring, querying, and visualization capabilities across MongoDB, Redis, Neo4j, and Qdrant databases.

## Features

### 🔍 **Multi-Database Support**
- **MongoDB**: Document database monitoring with collection analysis
- **Redis**: Key-value store monitoring with pattern analysis
- **Neo4j**: Graph database monitoring with node/relationship analysis
- **Qdrant**: Vector database monitoring with collection insights

### 📊 **Comprehensive Analytics**
- Connection status monitoring
- Database size and performance metrics
- Schema analysis and visualization
- Sample data inspection
- Health reporting

### 🎯 **Query Capabilities**
- MongoDB collection queries with filters
- Redis key pattern searches
- Neo4j Cypher query execution
- Qdrant vector similarity searches

### 📈 **Visualization & Reporting**
- Mermaid diagram generation
- Markdown report formatting
- CSV data export
- JSON data structures
- Health status dashboards

## Installation

The module is automatically included with the AI Code Writer MCP server. No separate installation required.

## Usage

### Initialize Database Monitor

```javascript
// The module automatically loads database connections from environment variables
// or you can provide them explicitly
```

### Available MCP Tools

#### 1. `initialize_database_monitor`
Initialize connections to all configured databases.

```json
{
  "mongodb_uri": "mongodb://localhost:27017",
  "redis_url": "redis://localhost:6379",
  "neo4j_uri": "neo4j://localhost:7687",
  "neo4j_user": "neo4j",
  "neo4j_password": "password",
  "qdrant_url": "http://localhost:6333"
}
```

#### 2. `get_database_overview`
Get a high-level overview of all database connections and basic metrics.

```json
{
  "include_details": true
}
```

#### 3. `analyze_mongodb`
Detailed analysis of MongoDB databases and collections.

```json
{
  "database_filter": "myapp",
  "include_samples": true
}
```

#### 4. `analyze_redis`
Analyze Redis keys, patterns, and memory usage.

```json
{
  "key_limit": 100,
  "include_memory_details": true
}
```

#### 5. `analyze_neo4j`
Analyze Neo4j graph structure and schema.

```json
{
  "include_schema": true
}
```

#### 6. `analyze_qdrant`
Analyze Qdrant vector collections.

```json
{
  "collection_filter": "embeddings"
}
```

#### 7. `generate_health_report`
Generate comprehensive system health report.

```json
{
  "save_to_file": true,
  "report_format": "markdown"
}
```

#### 8. `create_database_visualization`
Generate visualization data and charts.

```json
{
  "chart_types": ["connection_status", "data_volumes"],
  "export_format": "mermaid"
}
```

#### 9. `query_mongodb_collection`
Query specific MongoDB collection.

```json
{
  "database": "myapp",
  "collection": "users",
  "query": {"status": "active"},
  "limit": 10,
  "sort": {"created_at": -1}
}
```

#### 10. `query_redis_keys`
Query Redis keys by pattern.

```json
{
  "pattern": "user:*",
  "limit": 20,
  "include_values": false
}
```

#### 11. `query_neo4j_cypher`
Execute Cypher queries on Neo4j.

```json
{
  "cypher": "MATCH (n:User) RETURN n LIMIT 10",
  "parameters": {},
  "limit": 25
}
```

#### 12. `search_qdrant_collection`
Search vectors in Qdrant collection.

```json
{
  "collection_name": "embeddings",
  "query_vector": [0.1, 0.2, 0.3],
  "top_k": 5,
  "score_threshold": 0.7
}
```

#### 13. `export_database_summary`
Export comprehensive database summary.

```json
{
  "format": "markdown",
  "include_samples": false
}
```

## Configuration

The module reads database connection details from environment variables:

```bash
# MongoDB
MONGODB_URI=mongodb://root:password@localhost:27017/?authSource=admin

# Redis
REDIS_URL=redis://localhost:6379

# Neo4j
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Qdrant
QDRANT_URL=http://localhost:6333
```

## Example Output

### Database Overview
```json
{
  "timestamp": "2025-06-17T11:00:00.000Z",
  "connections": {
    "mongodb": true,
    "redis": true,
    "neo4j": false,
    "qdrant": true
  },
  "databases": {
    "mongodb": {
      "status": "connected",
      "totalDatabases": 3,
      "totalSize": 1048576
    },
    "redis": {
      "status": "connected",
      "keyCount": 150,
      "uptime": 86400
    },
    "qdrant": {
      "status": "connected",
      "collections": 2,
      "collectionNames": ["embeddings", "documents"]
    }
  }
}
```

### Health Report
```json
{
  "timestamp": "2025-06-17T11:00:00.000Z",
  "summary": {
    "totalDatabases": 4,
    "connectedDatabases": 3,
    "status": "healthy"
  },
  "details": {
    "overview": { /* ... */ },
    "mongodb": { /* ... */ },
    "redis": { /* ... */ },
    "qdrant": { /* ... */ }
  }
}
```

### Visualization (Mermaid)
```mermaid
graph TD
    MONGODB[MONGODB] --> C0[Connected]
    REDIS[REDIS] --> C1[Connected]
    NEO4J[NEO4J] --> D2[Disconnected]
    QDRANT[QDRANT] --> C3[Connected]
```

## Error Handling

The module provides comprehensive error handling:
- Graceful connection failures
- Detailed error messages
- Partial functionality when some databases are unavailable
- Connection retry mechanisms

## Security Considerations

- Connections use authentication when configured
- Sample data is limited to prevent large data exposure
- Query results are bounded to prevent resource exhaustion
- Sensitive data is handled according to database-specific best practices

## Performance

- Asynchronous operations throughout
- Connection pooling where supported
- Configurable limits on query results
- Efficient sampling strategies for large datasets

## Troubleshooting

### Connection Issues
1. Verify environment variables are set correctly
2. Check database services are running
3. Verify network connectivity
4. Check authentication credentials

### Performance Issues
1. Reduce query limits
2. Disable sample data collection
3. Filter to specific databases/collections
4. Use connection pooling

## Contributing

The module is part of the AI Code Writer MCP server project. Contributions should follow the project guidelines.

## License

MIT - See the main project license for details.

