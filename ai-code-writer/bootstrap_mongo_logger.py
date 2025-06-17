#!/usr/bin/env python3
"""
MongoDB Logger Bootstrap Script

This script:
1. Connects to MongoDB (localhost or Docker)
2. Creates a unique test database/collection with timestamp
3. Exports the collection handle to the MongoToolLogger
4. Sets up proper indexing for optimal performance
"""

import os
import sys
from datetime import datetime
from pymongo import MongoClient, errors
from pymongo.collection import Collection
from pymongo.database import Database
import json
from pathlib import Path

class MongoLoggerBootstrap:
    def __init__(self, mongo_uri=None, test_mode=True):
        """
        Initialize MongoDB Logger Bootstrap
        
        Args:
            mongo_uri (str): MongoDB connection string (defaults to env var or localhost)
            test_mode (bool): If True, creates unique test database with timestamp
        """
        self.mongo_uri = mongo_uri or os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
        self.test_mode = test_mode
        self.client = None
        self.db = None
        self.collection = None
        self.connection_info = {}
        
        # Generate unique database/collection names for testing
        if test_mode:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            self.db_name = f'mcp_test_logs_{timestamp}'
            self.collection_name = f'tool_executions_{timestamp}'
        else:
            self.db_name = os.getenv('MONGODB_LOGGER_DB', 'mcp_tool_logs')
            self.collection_name = os.getenv('MONGODB_LOGGER_COLLECTION', 'tool_executions')
    
    def connect_to_mongodb(self):
        """
        Establish connection to MongoDB with proper error handling
        """
        try:
            print(f"Connecting to MongoDB at: {self.mongo_uri}")
            
            # Connection options for reliability
            self.client = MongoClient(
                self.mongo_uri,
                serverSelectionTimeoutMS=5000,  # 5 second timeout
                connectTimeoutMS=10000,         # 10 second connection timeout
                socketTimeoutMS=10000,          # 10 second socket timeout
                maxPoolSize=10,                 # Maximum connections in pool
                retryWrites=True,               # Enable retry writes
                w='majority',                   # Write concern
                maxIdleTimeMS=30000             # 30 second max idle time
            )
            
            # Test the connection
            self.client.admin.command('ping')
            
            # Get server info
            server_info = self.client.server_info()
            
            self.connection_info = {
                'status': 'connected',
                'mongo_uri': self.mongo_uri,
                'server_version': server_info.get('version'),
                'connection_time': datetime.now().isoformat(),
                'database_name': self.db_name,
                'collection_name': self.collection_name
            }
            
            print(f"✓ Successfully connected to MongoDB {server_info.get('version')}")
            return True
            
        except errors.ServerSelectionTimeoutError:
            error_msg = f"Could not connect to MongoDB at {self.mongo_uri} - Check if MongoDB is running"
            print(f"✗ {error_msg}")
            self.connection_info = {'status': 'failed', 'error': error_msg}
            return False
            
        except errors.ConfigurationError as e:
            error_msg = f"MongoDB configuration error: {e}"
            print(f"✗ {error_msg}")
            self.connection_info = {'status': 'failed', 'error': error_msg}
            return False
            
        except Exception as e:
            error_msg = f"Unexpected error connecting to MongoDB: {e}"
            print(f"✗ {error_msg}")
            self.connection_info = {'status': 'failed', 'error': error_msg}
            return False
    
    def setup_database_and_collection(self):
        """
        Create database and collection with proper indexing
        """
        try:
            # Get database handle
            self.db = self.client[self.db_name]
            
            # Get collection handle
            self.collection = self.db[self.collection_name]
            
            print(f"✓ Database '{self.db_name}' ready")
            print(f"✓ Collection '{self.collection_name}' ready")
            
            # Create indexes for optimal query performance
            indexes_created = self.create_indexes()
            
            # Insert a test document to verify write permissions
            test_doc = {
                '_id': 'bootstrap_test',
                'type': 'bootstrap_verification',
                'timestamp': datetime.now(),
                'test_mode': self.test_mode,
                'created_by': 'bootstrap_mongo_logger.py'
            }
            
            self.collection.insert_one(test_doc)
            print("✓ Test document inserted successfully")
            
            # Verify we can read it back
            retrieved = self.collection.find_one({'_id': 'bootstrap_test'})
            if retrieved:
                print("✓ Test document retrieval successful")
            
            self.connection_info.update({
                'database_created': True,
                'collection_created': True,
                'indexes_created': indexes_created,
                'test_document_inserted': True
            })
            
            return True
            
        except Exception as e:
            error_msg = f"Failed to setup database/collection: {e}"
            print(f"✗ {error_msg}")
            self.connection_info['setup_error'] = error_msg
            return False
    
    def create_indexes(self):
        """
        Create database indexes for optimal query performance
        """
        indexes = [
            ('toolName', 1),           # Tool name ascending
            ('startTime', -1),         # Start time descending (most recent first)
            ('sessionId', 1),          # Session ID ascending
            ('success', 1),            # Success status ascending
        ]
        
        compound_indexes = [
            [('toolName', 1), ('startTime', -1)],      # Tool + time queries
            [('sessionId', 1), ('startTime', -1)],     # Session + time queries
            [('success', 1), ('startTime', -1)],       # Success + time queries
        ]
        
        indexes_created = []
        
        try:
            # Create single field indexes
            for field, direction in indexes:
                try:
                    index_name = self.collection.create_index([(field, direction)])
                    indexes_created.append(f"{field}_{direction}")
                    print(f"  ✓ Index created: {field} ({direction})")
                except Exception as e:
                    print(f"  ⚠ Index creation failed for {field}: {e}")
            
            # Create compound indexes
            for compound_fields in compound_indexes:
                try:
                    index_name = self.collection.create_index(compound_fields)
                    field_names = "_".join([f"{field}_{direction}" for field, direction in compound_fields])
                    indexes_created.append(field_names)
                    print(f"  ✓ Compound index created: {field_names}")
                except Exception as e:
                    field_names = "_".join([field for field, _ in compound_fields])
                    print(f"  ⚠ Compound index creation failed for {field_names}: {e}")
            
            return indexes_created
            
        except Exception as e:
            print(f"  ✗ Index creation error: {e}")
            return []
    
    def export_collection_handle(self):
        """
        Export collection configuration for use by MongoToolLogger
        """
        if not self.collection:
            print("✗ No collection handle to export")
            return None
        
        # Create configuration object
        mongo_config = {
            'mongodb_uri': self.mongo_uri,
            'database_name': self.db_name,
            'collection_name': self.collection_name,
            'connection_info': self.connection_info,
            'bootstrap_timestamp': datetime.now().isoformat(),
            'test_mode': self.test_mode
        }
        
        # Save configuration to file for Node.js MongoToolLogger
        config_file = 'mongo_logger_config.json'
        try:
            with open(config_file, 'w') as f:
                json.dump(mongo_config, f, indent=2, default=str)
            
            print(f"✓ Configuration exported to {config_file}")
            
            # Also create environment variable exports
            env_exports = f"""
# MongoDB Logger Configuration (generated by bootstrap_mongo_logger.py)
export MONGODB_URI="{self.mongo_uri}"
export MONGODB_LOGGER_DB="{self.db_name}"
export MONGODB_LOGGER_COLLECTION="{self.collection_name}"
"""
            
            env_file = 'mongo_logger_env.sh'
            with open(env_file, 'w') as f:
                f.write(env_exports)
            
            print(f"✓ Environment exports saved to {env_file}")
            print("\nTo use this configuration, run:")
            print(f"  source {env_file}")
            
            return mongo_config
            
        except Exception as e:
            print(f"✗ Failed to export configuration: {e}")
            return None
    
    def get_collection_stats(self):
        """
        Get collection statistics and information
        """
        if not self.collection:
            return None
        
        try:
            stats = self.db.command('collStats', self.collection_name)
            
            collection_info = {
                'document_count': stats.get('count', 0),
                'size_bytes': stats.get('size', 0),
                'average_document_size': stats.get('avgObjSize', 0),
                'indexes': stats.get('nindexes', 0),
                'total_index_size': stats.get('totalIndexSize', 0)
            }
            
            return collection_info
            
        except Exception as e:
            print(f"Warning: Could not get collection stats: {e}")
            return None
    
    def run_bootstrap(self):
        """
        Run complete bootstrap process
        """
        print("\n" + "="*60)
        print("MongoDB Logger Bootstrap Starting...")
        print("="*60)
        
        # Step 1: Connect to MongoDB
        if not self.connect_to_mongodb():
            print("\n✗ Bootstrap failed - Could not connect to MongoDB")
            return False
        
        # Step 2: Setup database and collection
        if not self.setup_database_and_collection():
            print("\n✗ Bootstrap failed - Could not setup database/collection")
            return False
        
        # Step 3: Export configuration
        config = self.export_collection_handle()
        if not config:
            print("\n✗ Bootstrap failed - Could not export configuration")
            return False
        
        # Step 4: Display summary
        stats = self.get_collection_stats()
        
        print("\n" + "="*60)
        print("✓ MongoDB Logger Bootstrap Complete!")
        print("="*60)
        print(f"Database: {self.db_name}")
        print(f"Collection: {self.collection_name}")
        print(f"MongoDB URI: {self.mongo_uri}")
        
        if stats:
            print(f"\nCollection Stats:")
            print(f"  Documents: {stats['document_count']}")
            print(f"  Indexes: {stats['indexes']}")
            print(f"  Size: {stats['size_bytes']} bytes")
        
        print(f"\nConfiguration files created:")
        print(f"  - mongo_logger_config.json")
        print(f"  - mongo_logger_env.sh")
        
        return True
    
    def cleanup(self):
        """
        Clean up resources
        """
        if self.client:
            try:
                self.client.close()
                print("✓ MongoDB connection closed")
            except Exception as e:
                print(f"Warning: Error closing MongoDB connection: {e}")

def main():
    """
    Main entry point
    """
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Bootstrap MongoDB Logger for MCP Tool Execution Tracking'
    )
    parser.add_argument(
        '--mongo-uri', 
        default=None,
        help='MongoDB connection URI (default: from MONGODB_URI env var or mongodb://localhost:27017)'
    )
    parser.add_argument(
        '--production', 
        action='store_true',
        help='Use production database names instead of test names with timestamp'
    )
    parser.add_argument(
        '--test-connection-only', 
        action='store_true',
        help='Only test the MongoDB connection without creating databases'
    )
    
    args = parser.parse_args()
    
    # Create bootstrap instance
    bootstrap = MongoLoggerBootstrap(
        mongo_uri=args.mongo_uri,
        test_mode=not args.production
    )
    
    try:
        if args.test_connection_only:
            # Just test connection
            print("Testing MongoDB connection...")
            success = bootstrap.connect_to_mongodb()
            if success:
                print("✓ MongoDB connection test successful!")
                sys.exit(0)
            else:
                print("✗ MongoDB connection test failed!")
                sys.exit(1)
        else:
            # Run full bootstrap
            success = bootstrap.run_bootstrap()
            sys.exit(0 if success else 1)
            
    except KeyboardInterrupt:
        print("\n\nBootstrap interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        sys.exit(1)
    finally:
        bootstrap.cleanup()

if __name__ == '__main__':
    main()

