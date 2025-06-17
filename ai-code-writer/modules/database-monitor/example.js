/**
 * Database Monitor Example Usage
 * Demonstrates how to use the database monitoring tools
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const DatabaseMonitorTools = require('./tools');

async function runExample() {
    const monitor = new DatabaseMonitorTools();
    
    console.log('🔍 Database Monitor Example');
    console.log('='*50);
    
    try {
        // Initialize the database monitor
        console.log('\n1. Initializing database monitor...');
        const initResult = await monitor.handleTool('initialize_database_monitor', {});
        console.log('✅ Initialization result:', JSON.stringify(initResult, null, 2));
        
        // Get database overview
        console.log('\n2. Getting database overview...');
        const overview = await monitor.handleTool('get_database_overview', { include_details: true });
        console.log('📊 Overview:', JSON.stringify(overview, null, 2));
        
        // Analyze MongoDB if connected
        if (overview.connections?.mongodb) {
            console.log('\n3. Analyzing MongoDB...');
            const mongoAnalysis = await monitor.handleTool('analyze_mongodb', { include_samples: false });
            console.log('🍃 MongoDB Analysis:', JSON.stringify(mongoAnalysis, null, 2));
        }
        
        // Analyze Redis if connected
        if (overview.connections?.redis) {
            console.log('\n4. Analyzing Redis...');
            const redisAnalysis = await monitor.handleTool('analyze_redis', { key_limit: 10 });
            console.log('🔴 Redis Analysis:', JSON.stringify(redisAnalysis, null, 2));
        }
        
        // Generate health report
        console.log('\n5. Generating health report...');
        const healthReport = await monitor.handleTool('generate_health_report', { 
            save_to_file: false 
        });
        console.log('🏥 Health Report Summary:', {
            status: healthReport.summary?.status,
            connected: healthReport.summary?.connectedDatabases,
            total: healthReport.summary?.totalDatabases
        });
        
        // Create visualization
        console.log('\n6. Creating database visualization...');
        const visualization = await monitor.handleTool('create_database_visualization', {
            export_format: 'mermaid'
        });
        console.log('📈 Visualization:');
        console.log(visualization.mermaid);
        
    } catch (error) {
        console.error('❌ Example failed:', error.message);
        console.error(error.stack);
    } finally {
        // Cleanup
        await monitor.cleanup();
        console.log('\n✅ Example completed');
    }
}

// Run the example
if (require.main === module) {
    runExample();
}

module.exports = runExample;

