/**
 * File Creator Module
 * Creates and manages generated files with comprehensive file system operations
 */

const fs = require('fs').promises;
const path = require('path');
const Logger = require('../../utils/logger');

class FileCreator {
  constructor() {
    this.logger = new Logger('FileCreator');
  }

  getTools() {
    return [
      {
        name: 'create_server_files',
        description: 'Create all necessary files for the MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            target_directory: { 
              type: 'string',
              description: 'Target directory for file creation'
            },
            generated_code: { 
              type: 'object',
              description: 'Generated code and files from code generator'
            },
            server_name: { 
              type: 'string',
              description: 'Name of the server project'
            },
            project_structure: {
              type: 'object',
              description: 'Project structure definition'
            },
            overwrite: {
              type: 'boolean',
              default: false,
              description: 'Whether to overwrite existing files'
            },
            create_subdirectories: {
              type: 'boolean',
              default: true,
              description: 'Whether to create subdirectories'
            }
          },
          required: ['target_directory', 'generated_code', 'server_name']
        }
      }
    ];
  }

  async createServerFiles(args) {
    try {
      const { 
        target_directory, 
        generated_code, 
        server_name,
        project_structure,
        overwrite = false,
        create_subdirectories = true
      } = args;
      
      this.logger.info(`Creating server files in ${target_directory}`);
      
      // Ensure target directory exists
      const resolvedTargetDir = path.resolve(target_directory);
      await this.ensureDirectoryExists(resolvedTargetDir);
      
      const createdFiles = [];
      const skippedFiles = [];
      const errors = [];
      
      // Create directory structure if provided
      if (create_subdirectories && project_structure) {
        await this.createDirectoryStructure(resolvedTargetDir, project_structure);
      }
      
      // Process different types of generated code
      if (generated_code.files) {
        // Complete project with multiple files
        await this.createMultipleFiles(resolvedTargetDir, generated_code.files, overwrite, createdFiles, skippedFiles, errors);
      } else {
        // Single file or structured response
        await this.createSingleFile(resolvedTargetDir, generated_code, server_name, overwrite, createdFiles, skippedFiles, errors);
      }
      
      // Create additional configuration files
      await this.createConfigurationFiles(resolvedTargetDir, server_name, overwrite, createdFiles, skippedFiles, errors);
      
      // Create package.json if not already created
      await this.ensurePackageJson(resolvedTargetDir, server_name, generated_code, overwrite, createdFiles, skippedFiles);
      
      // Create README.md if not already created
      await this.ensureReadme(resolvedTargetDir, server_name, generated_code, overwrite, createdFiles, skippedFiles);
      
      // Set appropriate file permissions
      await this.setFilePermissions(createdFiles);
      
      const summary = {
        success: true,
        target_directory: resolvedTargetDir,
        server_name,
        files_created: createdFiles.map(file => ({
          path: file.path,
          size: file.size,
          type: file.type
        })),
        files_skipped: skippedFiles,
        errors: errors,
        summary: {
          total_files: createdFiles.length,
          total_size: createdFiles.reduce((sum, file) => sum + file.size, 0),
          directories_created: create_subdirectories ? this.countDirectories(project_structure) : 0
        },
        next_steps: this.generateNextSteps(resolvedTargetDir, server_name),
        timestamp: new Date().toISOString()
      };
      
      this.logger.info(`Successfully created ${createdFiles.length} files`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(summary, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('File creation failed:', error.message);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            target_directory: args.target_directory,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    }
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
      this.logger.debug(`Directory already exists: ${dirPath}`);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
      this.logger.info(`Created directory: ${dirPath}`);
    }
  }

  async createDirectoryStructure(baseDir, structure) {
    if (!structure || !structure.directories) return;
    
    for (const [dirName, subItems] of Object.entries(structure.directories)) {
      const dirPath = path.join(baseDir, dirName);
      await this.ensureDirectoryExists(dirPath);
      
      // Recursively create subdirectories
      if (Array.isArray(subItems)) {
        for (const subItem of subItems) {
          if (subItem.endsWith('/')) {
            await this.ensureDirectoryExists(path.join(dirPath, subItem));
          }
        }
      }
    }
  }

  async createMultipleFiles(baseDir, files, overwrite, createdFiles, skippedFiles, errors) {
    for (const [filename, content] of Object.entries(files)) {
      try {
        const filePath = path.join(baseDir, filename);
        
        // Check if file exists
        if (!overwrite && await this.fileExists(filePath)) {
          skippedFiles.push({ filename, reason: 'File already exists' });
          continue;
        }
        
        // Ensure directory exists for the file
        const fileDir = path.dirname(filePath);
        await this.ensureDirectoryExists(fileDir);
        
        // Write file
        const fileContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
        await fs.writeFile(filePath, fileContent, 'utf8');
        
        const stats = await fs.stat(filePath);
        createdFiles.push({
          path: filePath,
          filename,
          size: stats.size,
          type: this.getFileType(filename),
          created_at: stats.birthtime
        });
        
        this.logger.debug(`Created file: ${filename}`);
      } catch (error) {
        errors.push({ filename, error: error.message });
        this.logger.error(`Failed to create file ${filename}:`, error.message);
      }
    }
  }

  async createSingleFile(baseDir, generatedCode, serverName, overwrite, createdFiles, skippedFiles, errors) {
    try {
      // Determine filename based on content type
      let filename;
      let content;
      
      if (typeof generatedCode === 'string') {
        // Raw code content
        filename = `${serverName}-server.js`;
        content = generatedCode;
      } else if (generatedCode.content && Array.isArray(generatedCode.content)) {
        // MCP response format
        filename = `${serverName}-server.js`;
        content = generatedCode.content[0]?.text || '';
        
        // Try to parse as JSON if it looks like JSON
        try {
          const parsed = JSON.parse(content);
          if (parsed.files) {
            // It's a complete project response
            await this.createMultipleFiles(baseDir, parsed.files, overwrite, createdFiles, skippedFiles, errors);
            return;
          }
        } catch (e) {
          // Not JSON, treat as raw content
        }
      } else {
        // Object format
        filename = `${serverName}.json`;
        content = JSON.stringify(generatedCode, null, 2);
      }
      
      const filePath = path.join(baseDir, filename);
      
      // Check if file exists
      if (!overwrite && await this.fileExists(filePath)) {
        skippedFiles.push({ filename, reason: 'File already exists' });
        return;
      }
      
      // Write file
      await fs.writeFile(filePath, content, 'utf8');
      
      const stats = await fs.stat(filePath);
      createdFiles.push({
        path: filePath,
        filename,
        size: stats.size,
        type: this.getFileType(filename),
        created_at: stats.birthtime
      });
      
      this.logger.debug(`Created single file: ${filename}`);
    } catch (error) {
      errors.push({ filename: 'main-file', error: error.message });
      this.logger.error('Failed to create single file:', error.message);
    }
  }

  async createConfigurationFiles(baseDir, serverName, overwrite, createdFiles, skippedFiles, errors) {
    const configFiles = {
      '.gitignore': this.generateGitignore(),
      '.env.example': this.generateEnvExample(serverName)
    };
    
    for (const [filename, content] of Object.entries(configFiles)) {
      try {
        const filePath = path.join(baseDir, filename);
        
        if (!overwrite && await this.fileExists(filePath)) {
          skippedFiles.push({ filename, reason: 'File already exists' });
          continue;
        }
        
        await fs.writeFile(filePath, content, 'utf8');
        
        const stats = await fs.stat(filePath);
        createdFiles.push({
          path: filePath,
          filename,
          size: stats.size,
          type: 'config',
          created_at: stats.birthtime
        });
        
        this.logger.debug(`Created config file: ${filename}`);
      } catch (error) {
        errors.push({ filename, error: error.message });
        this.logger.error(`Failed to create config file ${filename}:`, error.message);
      }
    }
  }

  async ensurePackageJson(baseDir, serverName, generatedCode, overwrite, createdFiles, skippedFiles) {
    const packageJsonPath = path.join(baseDir, 'package.json');
    
    if (!overwrite && await this.fileExists(packageJsonPath)) {
      skippedFiles.push({ filename: 'package.json', reason: 'File already exists' });
      return;
    }
    
    // Check if package.json was already generated
    if (generatedCode.files && generatedCode.files['package.json']) {
      return; // Already handled in createMultipleFiles
    }
    
    // Generate default package.json
    const packageJson = {
      name: serverName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      version: '1.0.0',
      description: `MCP server: ${serverName}`,
      main: `${serverName}-server.js`,
      scripts: {
        start: `node ${serverName}-server.js`,
        dev: `nodemon ${serverName}-server.js`,
        test: 'jest',
        lint: 'eslint .'
      },
      keywords: ['mcp', 'server'],
      license: 'MIT',
      dependencies: {
        '@modelcontextprotocol/sdk': '^0.4.0'
      },
      devDependencies: {
        jest: '^29.0.0',
        nodemon: '^3.0.0',
        eslint: '^8.0.0'
      }
    };
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    
    const stats = await fs.stat(packageJsonPath);
    createdFiles.push({
      path: packageJsonPath,
      filename: 'package.json',
      size: stats.size,
      type: 'config',
      created_at: stats.birthtime
    });
  }

  async ensureReadme(baseDir, serverName, generatedCode, overwrite, createdFiles, skippedFiles) {
    const readmePath = path.join(baseDir, 'README.md');
    
    if (!overwrite && await this.fileExists(readmePath)) {
      skippedFiles.push({ filename: 'README.md', reason: 'File already exists' });
      return;
    }
    
    // Check if README was already generated
    if (generatedCode.files && generatedCode.files['README.md']) {
      return; // Already handled in createMultipleFiles
    }
    
    // Generate default README
    const readme = this.generateDefaultReadme(serverName);
    
    await fs.writeFile(readmePath, readme, 'utf8');
    
    const stats = await fs.stat(readmePath);
    createdFiles.push({
      path: readmePath,
      filename: 'README.md',
      size: stats.size,
      type: 'documentation',
      created_at: stats.birthtime
    });
  }

  async setFilePermissions(createdFiles) {
    for (const file of createdFiles) {
      try {
        if (file.filename.endsWith('.js')) {
          await fs.chmod(file.path, 0o644);
        }
      } catch (error) {
        this.logger.warn(`Failed to set permissions for ${file.filename}:`, error.message);
      }
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const types = {
      '.js': 'javascript',
      '.json': 'json',
      '.md': 'markdown',
      '.env': 'environment'
    };
    return types[ext] || 'unknown';
  }

  countDirectories(structure) {
    if (!structure || !structure.directories) return 0;
    return Object.keys(structure.directories).length;
  }

  generateNextSteps(targetDir, serverName) {
    return [
      `cd ${targetDir}`,
      'npm install',
      'npm start'
    ];
  }

  generateGitignore() {
    return `node_modules/\n.env\nlogs/\n*.log\ncoverage/\n.nyc_output/\n`;
  }

  generateEnvExample(serverName) {
    return `NODE_ENV=development\nLOG_LEVEL=info\nSERVER_NAME=${serverName}\n`;
  }

  generateDefaultReadme(serverName) {
    return `# ${serverName}\n\nMCP server generated by AI Code Writer.\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Usage\n\n\`\`\`bash\nnpm start\n\`\`\`\n`;
  }
}

module.exports = FileCreator;

