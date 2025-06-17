# Filesystem Analysis Module

This module provides comprehensive filesystem analysis utilities designed to generate structured summaries suitable for AI context generation and orchestration modules.

## Features

### Core Functions

1. **`analyzeStructure(dir)`** - Analyzes directory structure with comprehensive statistics:
   - File counts by type (code, markup, styles, config, docs, images, archives, executables, data)
   - Size distribution (tiny, small, medium, large, huge)
   - Depth analysis showing files/directories at each level
   - Extension frequency analysis
   - Largest files tracking
   - Summary statistics

2. **`detectLargeFiles(dir, threshold)`** - Finds files larger than specified threshold:
   - Configurable size threshold (default: 10MB)
   - Sorted results by file size
   - Detailed file information with formatted sizes
   - Summary with largest file and total size

3. **`findExecutables(dir)`** - Locates executable files and scripts:
   - Binary executables (.exe, .msi, .app, etc.)
   - Script files (.sh, .bat, .ps1, .py, etc.)
   - Grouped by file type
   - Security-relevant information

4. **`summarizePermissions(dir)`** - Analyzes file and directory permissions:
   - Readable/writable/executable file counts
   - Permission issues detection
   - Security assessment with risk levels
   - Detailed breakdown of file permissions

## Usage Examples

### Basic Structure Analysis

```javascript
const FilesystemAnalysis = require('./modules/filesystem-analysis');
const analyzer = new FilesystemAnalysis();

// Analyze current directory structure
const analysis = await analyzer.analyzeStructure({
  directory: './src',
  max_depth: 3,
  include_hidden: false
});

console.log(analysis.summary.overview);
// Output: Total files, directories, size, and average file size
```

### Large File Detection

```javascript
// Find files larger than 5MB
const largeFiles = await analyzer.detectLargeFiles({
  directory: './project',
  size_threshold: 5242880, // 5MB in bytes
  max_results: 20
});

console.log(`Found ${largeFiles.found_count} large files`);
largeFiles.files.forEach(file => {
  console.log(`${file.relative_path}: ${file.size_formatted}`);
});
```

### Executable Discovery

```javascript
// Find all executables and scripts
const executables = await analyzer.findExecutables({
  directory: './bin',
  include_scripts: true
});

console.log(`Binary executables: ${executables.summary.binary_executables}`);
console.log(`Script files: ${executables.summary.script_files}`);
```

### Permission Analysis

```javascript
// Analyze file permissions for security
const permissions = await analyzer.summarizePermissions({
  directory: './sensitive-data',
  check_writable: true,
  check_executable: true
});

console.log(`Security risk level: ${permissions.security_assessment.risk_level}`);
if (permissions.security_assessment.concerns.length > 0) {
  console.log('Security concerns:', permissions.security_assessment.concerns);
}
```

## Output Structure

All functions return structured data suitable for:
- AI context generation
- Embeddings creation
- Orchestration module consumption
- Human-readable reporting

### Analysis Output Schema

```json
{
  "directory": "/path/to/analyzed/directory",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "total_files": 1250,
  "total_directories": 45,
  "total_size": 52428800,
  "file_types": {
    "code": 450,
    "config": 12,
    "docs": 8,
    "images": 25
  },
  "size_distribution": {
    "tiny": 200,
    "small": 800,
    "medium": 200,
    "large": 45,
    "huge": 5
  },
  "summary": {
    "overview": {
      "total_files": 1250,
      "total_directories": 45,
      "total_size_formatted": "50.00 MB",
      "average_file_size": "40.96 KB"
    },
    "dominant_file_types": [
      { "category": "code", "count": 450 },
      { "category": "config", "count": 12 }
    ]
  }
}
```

## File Categories

The module categorizes files into the following types:

- **Code**: `.js`, `.ts`, `.py`, `.java`, `.cpp`, `.c`, `.cs`, `.rb`, `.go`, `.rs`, `.php`, `.swift`, `.kt`
- **Markup**: `.html`, `.xml`, `.jsx`, `.tsx`, `.vue`, `.svelte`
- **Styles**: `.css`, `.scss`, `.sass`, `.less`, `.styl`
- **Config**: `.json`, `.yaml`, `.yml`, `.toml`, `.ini`, `.conf`, `.cfg`, `.env`
- **Docs**: `.md`, `.txt`, `.rst`, `.adoc`, `.tex`
- **Images**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.bmp`, `.webp`, `.ico`
- **Archives**: `.zip`, `.tar`, `.gz`, `.rar`, `.7z`, `.bz2`
- **Executables**: `.exe`, `.msi`, `.app`, `.deb`, `.rpm`, `.dmg`, `.bin`
- **Data**: `.csv`, `.tsv`, `.xlsx`, `.xls`, `.db`, `.sqlite`, `.json`, `.xml`

## Size Categories

- **Tiny**: < 1KB
- **Small**: 1KB - 10KB
- **Medium**: 10KB - 1MB
- **Large**: 1MB - 100MB
- **Huge**: > 100MB

## Error Handling

The module gracefully handles:
- Permission denied errors
- Inaccessible files/directories
- Invalid paths
- Network drives (with appropriate timeouts)

All errors are logged with appropriate detail levels and do not stop the analysis process.

## Integration

This module is designed to integrate seamlessly with:
- **Embeddings modules** - for generating vector representations of filesystem structure
- **Orchestration modules** - for providing AI context about project organization
- **Code generation modules** - for understanding project structure during code generation
- **Terminal backend** - for filesystem operations and navigation assistance

## Performance Considerations

- Configurable depth limits prevent excessive recursion
- Efficient file streaming for large directories
- Memory-conscious handling of file lists
- Async/await for non-blocking I/O operations
- Graceful degradation for inaccessible resources

