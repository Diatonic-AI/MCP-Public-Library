#!/usr/bin/env node
/**
 * Usage Tracking Demonstration Script
 * 
 * This script demonstrates the tool usage tracking and analytics capabilities
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ToolRegistryDatabase = require('../modules/tool-registry/tool-registry-database');
const Logger = require('../utils/logger');

class UsageTrackingDemo {
  constructor() {
    this.logger = new Logger('UsageDemo');
    this.toolRegistryDb = new ToolRegistryDatabase();
  }

  async runDemo() {
    try {
      console.log('🔍 Starting Usage Tracking Demo...');
      console.log('');
      
      // Initialize database
      await this.toolRegistryDb.initializeToolRegistryDb({
        connection_string: process.env.MONGODB_URI,
        database_name: process.env.MONGODB_DATABASE || 'mcp_tool_registry'
      });
      
      // Step 1: Show current performance baseline
      console.log('📊 Current Performance Baseline:');
      const initialPerf = await this.toolRegistryDb.getToolPerformance({ time_range: '24h' });
      console.log(initialPerf.content[0].text.substring(0, 500) + '...');
      console.log('');
      
      // Step 2: Simulate some tool usage
      console.log('🎧 Simulating Tool Usage...');
      
      const toolUsageSimulations = [
        {
          tool_id: 'ai-integrations_enhance_text_with_ai',
          execution_time: 1250,
          success: true,
          user_rating: 5,
          task_description: 'Enhanced marketing copy using AI'
        },
        {
          tool_id: 'mcp-servers_create_note',
          execution_time: 450,
          success: true,
          user_rating: 4,
          task_description: 'Created project planning note'
        },
        {
          tool_id: 'data-visualization_create_mermaid_chart',
          execution_time: 2100,
          success: true,
          user_rating: 5,
          task_description: 'Generated workflow diagram'
        },
        {
          tool_id: 'mcp-servers_analyze_problem',
          execution_time: 3200,
          success: true,
          user_rating: 4,
          task_description: 'Analyzed system architecture issue'
        },
        {
          tool_id: 'collaboration_create_team_workspace',
          execution_time: 800,
          success: false,
          error_message: 'Permission denied for workspace creation',
          task_description: 'Attempted to create team workspace'
        },
        {
          tool_id: 'ai-integrations_generate_smart_summary',
          execution_time: 1800,
          success: true,
          user_rating: 5,
          task_description: 'Summarized quarterly report'
        },
        {
          tool_id: 'mcp-servers_list_files',
          execution_time: 120,
          success: true,
          user_rating: 4,
          task_description: 'Listed project files'
        },
        {
          tool_id: 'mcp-servers_generate_solution_plan',
          execution_time: 4500,
          success: true,
          user_rating: 5,
          task_description: 'Generated implementation plan for new feature'
        }
      ];
      
      for (const usage of toolUsageSimulations) {
        await this.toolRegistryDb.recordToolUsage(usage);
        const status = usage.success ? '✅' : '❌';
        const rating = usage.user_rating ? `(⭐ ${usage.user_rating}/5)` : '';
        console.log(`  ${status} ${usage.tool_id} - ${usage.execution_time}ms ${rating}`);
      }
      
      console.log('');
      console.log(`✅ Recorded ${toolUsageSimulations.length} tool usage events`);
      console.log('');
      
      // Step 3: Show updated performance metrics
      console.log('📈 Updated Performance Metrics:');
      const updatedPerf = await this.toolRegistryDb.getToolPerformance({ time_range: '24h' });
      console.log(updatedPerf.content[0].text);
      console.log('');
      
      // Step 4: Get tool recommendations
      console.log('🎯 Tool Recommendations Demo:');
      const recommendations = await this.toolRegistryDb.getToolRecommendations({
        current_tool: 'mcp-servers_analyze_problem',
        task_context: 'working on system architecture and code generation',
        max_recommendations: 3
      });
      console.log(recommendations.content[0].text);
      console.log('');
      
      // Step 5: Generate analytics summary
      await this.generateAnalyticsSummary();
      
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
      throw error;
    } finally {
      await this.toolRegistryDb.close();
    }
  }

  async generateAnalyticsSummary() {
    console.log('📉 Analytics Summary:');
    console.log('='.repeat(60));
    
    try {
      // Get performance for specific high-usage tools
      const topTools = [
        'ai-integrations_enhance_text_with_ai',
        'mcp-servers_analyze_problem',
        'data-visualization_create_mermaid_chart'
      ];
      
      for (const toolId of topTools) {
        const perf = await this.toolRegistryDb.getToolPerformance({
          tool_id: toolId,
          time_range: '24h'
        });
        
        const perfData = JSON.parse(perf.content[0].text);
        if (perfData.total_usages > 0) {
          console.log(`🔧 ${toolId}:`);
          console.log(`  • Usage Count: ${perfData.total_usages}`);
          console.log(`  • Success Rate: ${(perfData.metrics.success_rate * 100).toFixed(1)}%`);
          console.log(`  • Avg Duration: ${perfData.metrics.average_duration.toFixed(0)}ms`);
          console.log(`  • Avg Rating: ${perfData.metrics.average_rating.toFixed(1)}/5`);
          console.log('');
        }
      }
      
    } catch (error) {
      console.warn('⚠️  Analytics summary partial failure:', error.message);
    }
    
    console.log('🎆 Usage tracking is now fully operational!');
    console.log('='.repeat(60));
  }
}

// Run the demo if this script is executed directly
if (require.main === module) {
  const demo = new UsageTrackingDemo();
  
  demo.runDemo()
    .then(() => {
      console.log('\n🎉 Usage tracking demo completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    });
}

module.exports = UsageTrackingDemo;

