/**
 * Test file for Filesystem Analysis Module
 * Run with: node test.js
 */

const FilesystemAnalysis = require('./index.js');
const path = require('path');

async function runTests() {
  console.log('🧪 Testing Filesystem Analysis Module\n');
  
  const analyzer = new FilesystemAnalysis();
  const testDir = path.resolve('../../'); // Test on the project root
  
  try {
    // Test 1: Structure Analysis
    console.log('📊 Test 1: Analyzing directory structure...');
    const structureAnalysis = await analyzer.analyzeStructure({
      directory: testDir,
      max_depth: 2,
      include_hidden: false
    });
    
    // Parse the formatted response
    const analysisData = JSON.parse(structureAnalysis.content[0].text);
    
    console.log('✅ Structure Analysis Results:');
    console.log(`   - Total files: ${analysisData.total_files}`);
    console.log(`   - Total directories: ${analysisData.total_directories}`);
    console.log(`   - Total size: ${analysisData.summary.overview.total_size_formatted}`);
    console.log(`   - Average file size: ${analysisData.summary.overview.average_file_size}`);
    console.log(`   - Dominant file types:`, analysisData.summary.dominant_file_types.slice(0, 3));
    console.log('');
    
    // Test 2: Large Files Detection
    console.log('📁 Test 2: Detecting large files (>1MB)...');
    const largeFiles = await analyzer.detectLargeFiles({
      directory: testDir,
      size_threshold: 1048576, // 1MB
      max_results: 5
    });
    
    // Parse the formatted response
    const largeFilesData = JSON.parse(largeFiles.content[0].text);
    
    console.log('✅ Large Files Results:');
    console.log(`   - Found ${largeFilesData.found_count} large files`);
    if (largeFilesData.files.length > 0) {
      console.log('   - Top large files:');
      largeFilesData.files.slice(0, 3).forEach(file => {
        console.log(`     * ${file.relative_path}: ${file.size_formatted}`);
      });
    }
    console.log('');
    
    // Test 3: Executable Detection
    console.log('⚙️ Test 3: Finding executables and scripts...');
    const executables = await analyzer.findExecutables({
      directory: testDir,
      include_scripts: true
    });
    
    // Parse the formatted response
    const executablesData = JSON.parse(executables.content[0].text);
    
    console.log('✅ Executables Results:');
    console.log(`   - Binary executables: ${executablesData.summary.binary_executables}`);
    console.log(`   - Script files: ${executablesData.summary.script_files}`);
    console.log(`   - Total size: ${executablesData.summary.total_size}`);
    if (executablesData.executables.length > 0) {
      console.log('   - Found executables:');
      executablesData.executables.slice(0, 3).forEach(exec => {
        console.log(`     * ${exec.relative_path} (${exec.type})`);
      });
    }
    console.log('');
    
    // Test 4: Permission Analysis (on a smaller subset)
    console.log('🔒 Test 4: Analyzing permissions...');
    const permissions = await analyzer.summarizePermissions({
      directory: path.join(testDir, 'modules'),
      check_writable: true,
      check_executable: true
    });
    
    // Parse the formatted response
    const permissionsData = JSON.parse(permissions.content[0].text);
    
    console.log('✅ Permissions Results:');
    console.log(`   - Total items analyzed: ${permissionsData.total_items}`);
    console.log(`   - Readable files: ${permissionsData.readable_files}`);
    console.log(`   - Writable files: ${permissionsData.writable_files}`);
    console.log(`   - Executable files: ${permissionsData.executable_files}`);
    console.log(`   - Security risk level: ${permissionsData.security_assessment.risk_level}`);
    if (permissionsData.security_assessment.concerns.length > 0) {
      console.log(`   - Security concerns: ${permissionsData.security_assessment.concerns.join(', ')}`);
    }
    console.log('');
    
    // Test 5: Tool Schema Validation
    console.log('🛠️ Test 5: Validating tool schemas...');
    const tools = analyzer.getTools();
    console.log('✅ Tool Schema Validation:');
    console.log(`   - Number of tools: ${tools.length}`);
    tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log('');
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };

