#!/usr/bin/env node
/**
 * Tool Discovery and Registry Population Script
 * 
 * This script runs tool discovery across MCP servers and populates
 * the MongoDB Tool Registry with the discovered tools.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ToolDiscovery = require('../modules/mcp-communication/tool-discovery');
const ToolRegistryDatabase = require('../modules/tool-registry/tool-registry-database');
const Logger = require('../utils/logger');

class DiscoveryAndRegistryIntegration {
  constructor() {
    this.logger = new Logger('DiscoveryIntegration');
    this.toolDiscovery = new ToolDiscovery();
    this.toolRegistryDb = new ToolRegistryDatabase();
  }

  async runFullDiscoveryAndPopulation() {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Starting Tool Discovery and Registry Population...');
      console.log('');
      
      // Step 1: Initialize the registry database
      this.logger.info('Initializing Tool Registry Database...');
      await this.toolRegistryDb.initializeToolRegistryDb({
        connection_string: process.env.MONGODB_URI,
        database_name: process.env.MONGODB_DATABASE || 'mcp_tool_registry'
      });
      console.log('✅ Database initialized');
      console.log('');
      
      // Step 2: Run tool discovery across multiple locations
      this.logger.info('Running comprehensive tool discovery...');
      
      const discoveryPaths = [
        '.', // Current directory
        '../', // Parent directory (look for other MCP servers)
        process.cwd(), // Working directory
        path.join(__dirname, '..'), // Project root
      ];
      
      const discoveryResult = await this.toolDiscovery.discoverMcpTools({
        server_directories: discoveryPaths,
        include_configs: true,
        deep_scan: true
      });
      
      console.log('📊 Discovery Results:');
      console.log(discoveryResult.content[0].text);
      console.log('');
      
      // Step 3: Parse discovery results and populate registry
      const parsedResults = JSON.parse(discoveryResult.content[0].text);
      
      this.logger.info('Populating registry with discovered tools...');
      
      const registrationResult = await this.toolRegistryDb.registerDiscoveredTools({
        discovery_results: parsedResults,
        update_existing: true
      });
      
      console.log('📝 Registration Results:');
      console.log(registrationResult.content[0].text);
      console.log('');
      
      // Step 4: Generate comprehensive summary
      const summary = await this.generateDiscoverySummary(parsedResults, JSON.parse(registrationResult.content[0].text));
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Discovery and population completed in ${duration}s`);
      
      return summary;
      
    } catch (error) {
      console.error('❌ Discovery and population failed:', error.message);
      this.logger.error('Full process failed:', error.message);
      throw error;
    } finally {
      await this.toolRegistryDb.close();
    }
  }

  async generateDiscoverySummary(discoveryResults, registrationResults) {
    const summary = {
      timestamp: new Date().toISOString(),
      discovery: {
        directories_scanned: discoveryResults.directories_scanned?.length || 0,
        servers_found: discoveryResults.total_servers || 0,
        tools_discovered: discoveryResults.total_tools || 0,
        scan_duration_ms: discoveryResults.scan_duration || 0
      },
      registration: {
        tools_registered: registrationResults.tools_registered || 0,
        tools_updated: registrationResults.tools_updated || 0,
        tools_skipped: registrationResults.tools_skipped || 0,
        servers_processed: registrationResults.servers_processed || 0,
        errors: registrationResults.errors?.length || 0
      },
      tool_breakdown: this.analyzeToolBreakdown(discoveryResults.tools_discovered || []),
      server_analysis: this.analyzeServerTypes(discoveryResults.servers_found || [])
    };

    console.log('\n' + '='.repeat(80));
    console.log('  DISCOVERY AND REGISTRY POPULATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n📈 Discovery Statistics:`);
    console.log(`  • Directories Scanned: ${summary.discovery.directories_scanned}`);
    console.log(`  • Servers Found: ${summary.discovery.servers_found}`);
    console.log(`  • Tools Discovered: ${summary.discovery.tools_discovered}`);
    console.log(`  • Scan Duration: ${(summary.discovery.scan_duration_ms / 1000).toFixed(2)}s`);
    
    console.log(`\n💾 Registry Population:`);
    console.log(`  • New Tools Registered: ${summary.registration.tools_registered}`);
    console.log(`  • Tools Updated: ${summary.registration.tools_updated}`);
    console.log(`  • Tools Skipped: ${summary.registration.tools_skipped}`);
    console.log(`  • Servers Processed: ${summary.registration.servers_processed}`);
    console.log(`  • Registration Errors: ${summary.registration.errors}`);
    
    if (summary.tool_breakdown.by_category) {
      console.log(`\n🏷️  Tool Categories:`);
      Object.entries(summary.tool_breakdown.by_category).forEach(([category, count]) => {
        console.log(`  • ${category}: ${count} tools`);
      });
    }
    
    if (summary.server_analysis.by_type) {
      console.log(`\n🖥️  Server Types:`);
      Object.entries(summary.server_analysis.by_type).forEach(([type, count]) => {
        console.log(`  • ${type}: ${count} servers`);
      });
    }
    
    console.log(`\n🎯 Next Steps:`);
    console.log(`  1. Review discovered tools in MongoDB registry`);
    console.log(`  2. Start using tools to generate usage metrics`);
    console.log(`  3. Set up performance monitoring and analytics`);
    console.log(`  4. Configure tool recommendation algorithms`);
    console.log('='.repeat(80));
    
    return summary;
  }

  analyzeToolBreakdown(tools) {
    const byCategory = {};
    const byServer = {};
    const withSchemas = tools.filter(t => t.input_schema).length;
    const withChains = tools.filter(t => t.suggested_chains?.length > 0).length;
    
    tools.forEach(tool => {
      // Count by category
      const category = tool.category || 'uncategorized';
      byCategory[category] = (byCategory[category] || 0) + 1;
      
      // Count by server
      const server = tool.server_name || 'unknown';
      byServer[server] = (byServer[server] || 0) + 1;
    });
    
    return {
      total: tools.length,
      by_category: byCategory,
      by_server: byServer,
      with_input_schemas: withSchemas,
      with_suggested_chains: withChains
    };
  }

  analyzeServerTypes(servers) {
    const byType = {};
    const withPackageJson = servers.filter(s => s.files?.package_json).length;
    const mcpServers = servers.filter(s => s.package_info?.mcp_related).length;
    
    servers.forEach(server => {
      const type = server.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });
    
    return {
      total: servers.length,
      by_type: byType,
      with_package_json: withPackageJson,
      mcp_related: mcpServers
    };
  }

  async demonstrateUsageTracking() {
    console.log('\n🔬 Demonstrating Usage Tracking...');
    
    try {
      // Get some tools from the registry to demonstrate usage tracking
      const performanceResult = await this.toolRegistryDb.getToolPerformance({
        time_range: '24h'
      });
      
      console.log('📊 Current Performance Data:');
      console.log(performanceResult.content[0].text);
      
      // Simulate some tool usage
      const sampleTools = ['discover_mcp_tools', 'get_tool_catalog'];
      
      for (const toolId of sampleTools) {
        await this.toolRegistryDb.recordToolUsage({
          tool_id: toolId,
          execution_time: Math.floor(Math.random() * 2000) + 500, // 500-2500ms
          success: Math.random() > 0.1, // 90% success rate
          user_rating: Math.floor(Math.random() * 2) + 4, // 4-5 star rating
          task_description: `Demo usage of ${toolId}`
        });
        
        console.log(`✅ Recorded usage for ${toolId}`);
      }
      
    } catch (error) {
      console.warn('⚠️  Usage tracking demo failed:', error.message);
    }
  }
}

// Run the integration if this script is executed directly
if (require.main === module) {
  const integration = new DiscoveryAndRegistryIntegration();
  
  integration.runFullDiscoveryAndPopulation()
    .then(async (summary) => {
      // Demonstrate usage tracking
      await integration.demonstrateUsageTracking();
      
      console.log('\n🎉 All operations completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Integration failed:', error);
      process.exit(1);
    });
}

module.exports = DiscoveryAndRegistryIntegration;

