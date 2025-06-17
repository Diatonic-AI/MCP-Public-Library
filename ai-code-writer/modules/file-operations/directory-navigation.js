const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Try to import treeify, fallback to basic implementation if not available
let treeify;
try {
  treeify = require('treeify');
} catch (error) {
  console.warn('treeify not found, using fallback implementation');
  treeify = null;
}

/**
 * Cross-platform path resolution with WSL/Windows UNC support
 * @param {string} inputPath - Path to resolve
 * @returns {string} Resolved absolute path
 */
function resolveCrossPlatformPath(inputPath) {
  if (!inputPath) return process.cwd();
  
  // Handle UNC paths for WSL <-> Windows bridging
  if (inputPath.startsWith('/mnt/')) {
    // WSL mount point - convert to Windows style if needed
    const driveLetter = inputPath.split('/')[2];
    if (driveLetter && driveLetter.length === 1) {
      const windowsPath = inputPath.replace(`/mnt/${driveLetter}`, `${driveLetter.toUpperCase()}:`);
      return path.resolve(windowsPath.replace(/\//g, path.sep));
    }
  }
  
  // Handle Windows UNC paths
  if (inputPath.startsWith('\\\\') || inputPath.match(/^[A-Za-z]:/)) {
    return path.resolve(inputPath);
  }
  
  // Standard path resolution
  return path.resolve(inputPath);
}

/**
 * Get file/directory stats with extended information
 * @param {string} filePath - Path to file/directory
 * @returns {Object} Extended stats object
 */
async function getExtendedStats(filePath) {
  try {
    const stats = await fs.stat(filePath);
    const basename = path.basename(filePath);
    
    // Determine file type
    let type = 'file';
    if (stats.isDirectory()) type = 'directory';
    else if (stats.isSymbolicLink()) type = 'symlink';
    else if (stats.isBlockDevice()) type = 'block-device';
    else if (stats.isCharacterDevice()) type = 'char-device';
    else if (stats.isFIFO()) type = 'fifo';
    else if (stats.isSocket()) type = 'socket';
    
    // Get permissions in octal format
    const permissions = '0' + (stats.mode & parseInt('777', 8)).toString(8);
    
    return {
      name: basename,
      path: filePath,
      type,
      size: stats.size,
      permissions,
      mode: stats.mode,
      uid: stats.uid,
      gid: stats.gid,
      atime: stats.atime,
      mtime: stats.mtime,
      ctime: stats.ctime,
      birthtime: stats.birthtime
    };
  } catch (error) {
    return {
      name: path.basename(filePath),
      path: filePath,
      type: 'unknown',
      size: 0,
      permissions: '000',
      error: error.message
    };
  }
}

/**
 * Generate hash for file content (for change detection)
 * @param {string} filePath - Path to file
 * @returns {string} SHA-256 hash of file content
 */
async function generateFileHash(filePath) {
  try {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (error) {
    return null;
  }
}

/**
 * List directory contents with extended information
 * @param {string} dir - Directory path
 * @param {number} depth - Maximum depth to traverse (0 = current dir only)
 * @param {Object} context - Additional context options
 * @returns {Array} Array of directory entries with metadata
 */
async function list(dir = '.', depth = 0, context = {}) {
  const resolvedDir = resolveCrossPlatformPath(dir);
  const {
    includeHidden = false,
    includeHashes = false,
    sortBy = 'name', // name, size, mtime, type
    sortOrder = 'asc', // asc, desc
    filter = null // function to filter entries
  } = context;
  
  const results = [];
  
  async function traverse(currentDir, currentDepth) {
    if (currentDepth > depth) return;
    
    try {
      const entries = await fs.readdir(currentDir);
      
      for (const entry of entries) {
        // Skip hidden files unless requested
        if (!includeHidden && entry.startsWith('.')) continue;
        
        const fullPath = path.join(currentDir, entry);
        const stats = await getExtendedStats(fullPath);
        
        // Add hash for files if requested
        if (includeHashes && stats.type === 'file') {
          stats.hash = await generateFileHash(fullPath);
        }
        
        stats.depth = currentDepth;
        stats.relativePath = path.relative(resolvedDir, fullPath);
        
        // Apply filter if provided
        if (!filter || filter(stats)) {
          results.push(stats);
        }
        
        // Recurse into directories
        if (stats.type === 'directory' && currentDepth < depth) {
          await traverse(fullPath, currentDepth + 1);
        }
      }
    } catch (error) {
      results.push({
        name: path.basename(currentDir),
        path: currentDir,
        type: 'error',
        error: error.message,
        depth: currentDepth
      });
    }
  }
  
  await traverse(resolvedDir, 0);
  
  // Sort results
  results.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'mtime':
        comparison = new Date(a.mtime) - new Date(b.mtime);
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'name':
      default:
        comparison = a.name.localeCompare(b.name);
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  return results;
}

/**
 * Create a tree structure object for visualization
 * @param {string} dir - Directory path
 * @param {number} currentDepth - Current traversal depth
 * @param {number} maxDepth - Maximum depth to traverse
 * @returns {Object} Tree structure object
 */
async function buildTreeStructure(dir, currentDepth = 0, maxDepth = 3) {
  if (currentDepth > maxDepth) return '[max depth reached]';
  
  try {
    const stats = await fs.stat(dir);
    if (!stats.isDirectory()) {
      return `[${path.basename(dir)}]`;
    }
    
    const entries = await fs.readdir(dir);
    const tree = {};
    
    for (const entry of entries) {
      // Skip hidden files for cleaner tree view
      if (entry.startsWith('.')) continue;
      
      const fullPath = path.join(dir, entry);
      const entryStats = await fs.stat(fullPath).catch(() => null);
      
      if (!entryStats) {
        tree[`${entry} [error]`] = null;
        continue;
      }
      
      if (entryStats.isDirectory()) {
        if (currentDepth < maxDepth) {
          tree[`📁 ${entry}/`] = await buildTreeStructure(fullPath, currentDepth + 1, maxDepth);
        } else {
          tree[`📁 ${entry}/`] = '[...]';
        }
      } else {
        const sizeStr = entryStats.size > 0 ? ` (${formatFileSize(entryStats.size)})` : '';
        tree[`📄 ${entry}${sizeStr}`] = null;
      }
    }
    
    return tree;
  } catch (error) {
    return `[error: ${error.message}]`;
  }
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)}${units[unitIndex]}`;
}

/**
 * Fallback tree visualization when treeify is not available
 * @param {Object} tree - Tree structure object
 * @param {string} prefix - Current line prefix
 * @param {boolean} isLast - Whether this is the last item at current level
 * @returns {string} ASCII tree representation
 */
function fallbackTreeify(tree, prefix = '', isLast = true) {
  if (typeof tree === 'string' || tree === null) {
    return '';
  }
  
  let result = '';
  const keys = Object.keys(tree);
  
  keys.forEach((key, index) => {
    const isLastItem = index === keys.length - 1;
    const currentPrefix = isLast ? '└── ' : '├── ';
    const nextPrefix = isLast ? '    ' : '│   ';
    
    result += prefix + currentPrefix + key + '\n';
    
    if (tree[key] && typeof tree[key] === 'object') {
      result += fallbackTreeify(tree[key], prefix + nextPrefix, isLastItem);
    }
  });
  
  return result;
}

/**
 * Generate ASCII/UTF tree visualization of directory structure
 * @param {string} dir - Directory path
 * @param {number} maxDepth - Maximum depth to traverse
 * @returns {string} ASCII tree representation
 */
async function tree(dir = '.', maxDepth = 3) {
  const resolvedDir = resolveCrossPlatformPath(dir);
  
  try {
    const treeStructure = await buildTreeStructure(resolvedDir, 0, maxDepth);
    const rootName = `📁 ${path.basename(resolvedDir) || path.dirname(resolvedDir)}/`;
    const rootTree = { [rootName]: treeStructure };
    
    if (treeify) {
      return treeify.asTree(rootTree, true, true);
    } else {
      return fallbackTreeify(rootTree);
    }
  } catch (error) {
    return `Error generating tree for ${resolvedDir}: ${error.message}`;
  }
}

/**
 * Generate comprehensive JSON index with file hashes for change detection
 * @param {string} dir - Directory path
 * @returns {Object} JSON index with metadata and hashes
 */
async function index(dir = '.') {
  const resolvedDir = resolveCrossPlatformPath(dir);
  const indexData = {
    path: resolvedDir,
    generated: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version,
    totalFiles: 0,
    totalDirectories: 0,
    totalSize: 0,
    entries: {}
  };
  
  async function indexDirectory(currentDir, relativePath = '') {
    try {
      const entries = await fs.readdir(currentDir);
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry);
        const entryRelativePath = path.join(relativePath, entry).replace(/\\/g, '/');
        const stats = await getExtendedStats(fullPath);
        
        const indexEntry = {
          type: stats.type,
          size: stats.size,
          permissions: stats.permissions,
          mtime: stats.mtime,
          ctime: stats.ctime
        };
        
        if (stats.type === 'file') {
          indexEntry.hash = await generateFileHash(fullPath);
          indexData.totalFiles++;
          indexData.totalSize += stats.size;
        } else if (stats.type === 'directory') {
          indexData.totalDirectories++;
          // Recursively index subdirectories
          await indexDirectory(fullPath, entryRelativePath);
        }
        
        indexData.entries[entryRelativePath] = indexEntry;
      }
    } catch (error) {
      indexData.entries[relativePath] = {
        type: 'error',
        error: error.message
      };
    }
  }
  
  await indexDirectory(resolvedDir);
  
  return indexData;
}

/**
 * Compare two directory indexes to detect changes
 * @param {Object} oldIndex - Previous index
 * @param {Object} newIndex - Current index
 * @returns {Object} Change detection results
 */
function compareIndexes(oldIndex, newIndex) {
  const changes = {
    added: [],
    modified: [],
    deleted: [],
    unchanged: []
  };
  
  const oldEntries = oldIndex.entries || {};
  const newEntries = newIndex.entries || {};
  
  // Check for added and modified files
  for (const [path, entry] of Object.entries(newEntries)) {
    if (!oldEntries[path]) {
      changes.added.push({ path, entry });
    } else if (entry.hash && oldEntries[path].hash && entry.hash !== oldEntries[path].hash) {
      changes.modified.push({ path, entry, oldEntry: oldEntries[path] });
    } else {
      changes.unchanged.push({ path, entry });
    }
  }
  
  // Check for deleted files
  for (const [path, entry] of Object.entries(oldEntries)) {
    if (!newEntries[path]) {
      changes.deleted.push({ path, entry });
    }
  }
  
  return changes;
}

module.exports = {
  list,
  tree,
  index,
  compareIndexes,
  resolveCrossPlatformPath,
  getExtendedStats,
  generateFileHash,
  formatFileSize
};

