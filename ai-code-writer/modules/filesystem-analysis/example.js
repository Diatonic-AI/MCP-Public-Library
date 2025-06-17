/**
 * Integration Example for Filesystem Analysis Module
 * Shows how to use the module in practice for AI context generation
 */

const FilesystemAnalysis = require('./index.js');
const path = require('path');

async function generateProjectContext(projectPath) {
  console.log(`🔍 Generating comprehensive project context for: ${projectPath}\n`);
  
  const analyzer = new FilesystemAnalysis();
  const context = {
    project_path: projectPath,
    analysis_timestamp: new Date().toISOString(),
    structure: null,
    large_files: null,
    executables: null,
    permissions: null,
    ai_summary: null
  };
  
  try {
    // 1. Analyze overall structure
    console.log('📊 Analyzing project structure...');
    const structureResult = await analyzer.analyzeStructure({
      directory: projectPath,
      max_depth: 3,
      include_hidden: false
    });
    context.structure = JSON.parse(structureResult.content[0].text);
    
    // 2. Find large files that might impact performance
    console.log('📁 Identifying large files...');
    const largeFilesResult = await analyzer.detectLargeFiles({
      directory: projectPath,
      size_threshold: 5242880, // 5MB
      max_results: 10
    });
    context.large_files = JSON.parse(largeFilesResult.content[0].text);
    
    // 3. Find executables for security analysis
    console.log('⚙️  Locating executables and scripts...');
    const executablesResult = await analyzer.findExecutables({
      directory: projectPath,
      include_scripts: true
    });
    context.executables = JSON.parse(executablesResult.content[0].text);
    
    // 4. Analyze permissions for security assessment (on a subset for performance)
    console.log('🔒 Analyzing file permissions...');
    try {
      const permissionsResult = await analyzer.summarizePermissions({
        directory: path.join(projectPath, 'modules'), // Analyze smaller subset
        check_writable: true,
        check_executable: true
      });
      context.permissions = JSON.parse(permissionsResult.content[0].text);
    } catch (permError) {
      console.warn('  Warning: Permission analysis failed, using defaults');
      context.permissions = {
        total_items: 0,
        security_assessment: {
          risk_level: 'unknown',
          concerns: ['Permission analysis failed'],
          recommendations: ['Manual security review recommended']
        }
      };
    }
    
    // 5. Generate AI-friendly summary
    context.ai_summary = generateAISummary(context);
    
    return context;
    
  } catch (error) {
    console.error('❌ Context generation failed:', error.message);
    throw error;
  }
}

function generateAISummary(context) {
  const { structure, large_files, executables, permissions } = context;
  
  return {
    project_type: determineProjectType(structure),
    complexity_score: calculateComplexity(structure),
    size_category: categorizeSizeScale(structure),
    technology_stack: identifyTechnologies(structure),
    security_profile: {
      risk_level: permissions.security_assessment.risk_level,
      concerns: permissions.security_assessment.concerns,
      executable_count: executables.found_count
    },
    performance_considerations: {
      large_files_present: large_files.found_count > 0,
      total_large_file_size: large_files.total_size,
      depth_complexity: Object.keys(structure.depth_analysis).length
    },
    recommendations: generateRecommendations(structure, large_files, executables, permissions)
  };
}

function determineProjectType(structure) {
  const fileTypes = structure.file_types;
  
  if (fileTypes.code > fileTypes.docs && fileTypes.code > fileTypes.config) {
    return 'software_development';
  } else if (fileTypes.docs > fileTypes.code) {
    return 'documentation_heavy';
  } else if (fileTypes.config > fileTypes.code) {
    return 'configuration_focused';
  }
  return 'mixed_content';
}

function calculateComplexity(structure) {
  const factors = {
    file_count: Math.min(structure.total_files / 100, 10), // Max 10 points
    directory_depth: Math.min(Object.keys(structure.depth_analysis).length, 5), // Max 5 points
    file_type_diversity: Math.min(Object.keys(structure.file_types).length, 5) // Max 5 points
  };
  
  const total = factors.file_count + factors.directory_depth + factors.file_type_diversity;
  
  if (total < 5) return 'simple';
  if (total < 12) return 'moderate';
  if (total < 18) return 'complex';
  return 'very_complex';
}

function categorizeSizeScale(structure) {
  const totalFiles = structure.total_files;
  
  if (totalFiles < 50) return 'small';
  if (totalFiles < 200) return 'medium';
  if (totalFiles < 1000) return 'large';
  return 'enterprise';
}

function identifyTechnologies(structure) {
  const extensions = structure.extensions;
  const technologies = [];
  
  // JavaScript/Node.js
  if (extensions['.js'] || extensions['.json'] || extensions['.ts']) {
    technologies.push('javascript');
  }
  
  // Python
  if (extensions['.py']) {
    technologies.push('python');
  }
  
  // Web Technologies
  if (extensions['.html'] || extensions['.css'] || extensions['.jsx']) {
    technologies.push('web_frontend');
  }
  
  // Docker
  if (extensions[''] && structure.extensions[''] > 0) { // Dockerfile has no extension
    technologies.push('docker');
  }
  
  // Documentation
  if (extensions['.md'] || extensions['.rst']) {
    technologies.push('documentation');
  }
  
  return technologies;
}

function generateRecommendations(structure, large_files, executables, permissions) {
  const recommendations = [];
  
  // File size recommendations
  if (large_files.found_count > 0) {
    recommendations.push({
      category: 'performance',
      priority: 'medium',
      message: `Consider optimizing ${large_files.found_count} large files for better performance`,
      details: large_files.files.slice(0, 3).map(f => `${f.relative_path} (${f.size_formatted})`)
    });
  }
  
  // Security recommendations
  if (permissions.security_assessment.risk_level !== 'low') {
    recommendations.push({
      category: 'security',
      priority: permissions.security_assessment.risk_level === 'high' ? 'high' : 'medium',
      message: 'Review file permissions for security compliance',
      details: permissions.security_assessment.concerns
    });
  }
  
  // Executable recommendations
  if (executables.summary.binary_executables > 5) {
    recommendations.push({
      category: 'security',
      priority: 'medium',
      message: 'High number of binary executables detected - verify legitimacy',
      details: [`${executables.summary.binary_executables} binary executables found`]
    });
  }
  
  // Complexity recommendations
  if (structure.total_files > 500) {
    recommendations.push({
      category: 'organization',
      priority: 'low',
      message: 'Large codebase - consider modularization strategies',
      details: [`${structure.total_files} files across ${structure.total_directories} directories`]
    });
  }
  
  return recommendations;
}

// Example usage
async function demonstrateUsage() {
  try {
    const projectPath = path.resolve('../..');
    const context = await generateProjectContext(projectPath);
    
    console.log('\n🎯 AI-Friendly Project Summary:');
    console.log('================================');
    console.log(`Project Type: ${context.ai_summary.project_type}`);
    console.log(`Complexity: ${context.ai_summary.complexity_score}`);
    console.log(`Size Category: ${context.ai_summary.size_category}`);
    console.log(`Technologies: ${context.ai_summary.technology_stack.join(', ')}`);
    console.log(`Security Risk: ${context.ai_summary.security_profile.risk_level}`);
    
    console.log('\n📋 Recommendations:');
    context.ai_summary.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
    });
    
    console.log('\n💾 Full context object ready for embeddings/orchestration modules');
    
  } catch (error) {
    console.error('Demo failed:', error.message);
  }
}

// Run demonstration if this file is executed directly
if (require.main === module) {
  demonstrateUsage();
}

module.exports = {
  generateProjectContext,
  generateAISummary
};

