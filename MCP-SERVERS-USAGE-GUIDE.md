# SmartGrowth MCP Servers - Complete Usage Guide

## 🚀 Overview

You now have **6 powerful MCP servers** running for your Obsidian SmartGrowth vault:

1. **note-creator-server** - Create notes and daily notes
2. **text-processor-server** - Format text, extract keywords, word counting
3. **file-manager-server** - Basic file operations (list, read, search, create folders)
4. **tag-helper-server** - Comprehensive tag management
5. **link-builder-server** - Link creation, backlinks, table of contents
6. **vault-navigator-server** - Advanced navigation, analytics, and path management

## 📋 Configuration Files Created

### Smart Composer Configuration
**File**: `smart-composer-config-complete.json`
- Copy this to your Obsidian Smart Composer plugin settings
- Contains all 6 MCP servers with proper vault path configuration

### Warp Terminal Configuration
**File**: `warp-terminal-mcp-config.json`
- Use this for Warp terminal MCP integration
- Individual server configurations already created in Warp config directory

## 🛠️ Available Tools by Server

### 1. Note Creator Server
- `create_note` - Create new markdown notes with title and content
- `create_daily_note` - Create dated daily notes

### 2. Text Processor Server
- `format_markdown` - Format text with proper markdown structure
- `create_bullet_list` - Convert text into bullet lists
- `extract_keywords` - Extract keywords for tagging
- `word_count` - Count words, characters, and paragraphs

### 3. File Manager Server
- `list_files` - List files in directories with filtering
- `read_file_content` - Read file contents
- `search_files` - Search for text within files
- `create_folder` - Create new directories

### 4. Tag Helper Server
- `add_tags` - Add tags to markdown files
- `find_files_by_tag` - Find all files with specific tags
- `list_all_tags` - List all tags in the vault
- `suggest_tags` - AI-powered tag suggestions based on content
- `create_tag_index` - Generate comprehensive tag index

### 5. Link Builder Server
- `create_wikilink` - Create [[wikilink]] format links
- `find_backlinks` - Find all files linking to a specific note
- `create_table_of_contents` - Generate TOC for markdown files
- `create_note_graph` - Visual representation of note connections
- `suggest_links` - Smart link suggestions based on content similarity

### 6. Vault Navigator Server (NEW!)
- `get_vault_structure` - Complete directory tree visualization
- `suggest_file_paths` - Smart path suggestions with scoring
- `create_directory_structure` - Bulk create directories/files with templates
- `index_vault_content` - Comprehensive file indexing with metadata
- `find_orphaned_files` - Identify unlinked/isolated files
- `analyze_vault_metrics` - Complete vault analytics and statistics
- `smart_path_resolver` - Intelligent path resolution with fuzzy matching
- `create_vault_backup_index` - Backup index with checksums
- `search_by_file_properties` - Advanced search by size, date, extension
- `generate_sitemap` - Hierarchical vault sitemap (MD/JSON/XML)

## 🎯 Key Features

### ✅ Path Resolution Fixed
All servers now properly resolve paths to your vault (`G:\SmartGrowth`) instead of looking in wrong directories.

### ✅ Smart Content Analysis
- Keyword extraction for automatic tagging
- Content similarity for link suggestions
- Fuzzy matching for path resolution
- Orphan file detection

### ✅ Comprehensive Analytics
- File count by type and extension
- Vault size and word count statistics
- File age tracking and largest file identification
- Link analysis and connectivity metrics

### ✅ Advanced Navigation
- Directory tree visualization with file counts
- Smart path suggestions with confidence scoring
- Multi-format sitemap generation
- Intelligent path resolution

## 🚀 Getting Started

### For Obsidian Smart Composer
1. Copy contents of `smart-composer-config-complete.json`
2. Paste into Smart Composer plugin MCP settings
3. All 6 servers will be available in the plugin

### For Warp Terminal
1. Individual configuration files already created in:
   `C:\Users\drew\AppData\Local\warp\Warp\data\config\`
2. Restart Warp terminal
3. All 6 servers should be available in MCP interface

### Manual Testing
```bash
# Test individual servers
npm run start:note-creator
npm run start:text-processor
npm run start:file-manager
npm run start:tag-helper
npm run start:link-builder
npm run start:vault-navigator

# Start all servers
npm run start

# Check status
npm run status
```

## 📊 Example Use Cases

### Content Organization
```
1. Use vault-navigator to analyze vault metrics
2. Find orphaned files and organize them
3. Use tag-helper to add consistent tags
4. Create directory structure for new projects
```

### Knowledge Management
```
1. Use link-builder to suggest related notes
2. Create comprehensive table of contents
3. Generate note graphs for visualization
4. Find backlinks to important concepts
```

### Productivity Workflows
```
1. Create daily notes with note-creator
2. Extract keywords from research content
3. Format text with proper markdown structure
4. Search and filter files by properties
```

## 🔧 Troubleshooting

### If servers don't start:
1. Check Node.js version (requires >=18.0.0)
2. Run `npm install` to ensure dependencies
3. Verify paths in configuration files
4. Check terminal output for error messages

### If path errors occur:
1. Verify `VAULT_PATH` is set to `G:\SmartGrowth`
2. Check file permissions
3. Ensure vault directory exists and is accessible

### For configuration issues:
1. Use the provided config files exactly as created
2. Restart Warp/Obsidian after configuration changes
3. Check MCP server logs in Warp data directory

## 🎉 Success!

You now have a complete MCP ecosystem for your SmartGrowth vault with:
- ✅ 6 specialized MCP servers
- ✅ 30+ available tools
- ✅ Proper path resolution
- ✅ Smart content analysis
- ✅ Advanced navigation capabilities
- ✅ Comprehensive vault analytics

All servers are configured and ready to supercharge your Obsidian workflow!

