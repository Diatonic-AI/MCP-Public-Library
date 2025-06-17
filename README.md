# MCP Public Library

[![Build Status](https://img.shields.io/github/actions/workflow/status/Diatonic-AI/MCP-Public-Library/node-ci.yml?branch=main&label=build)](https://github.com/Diatonic-AI/MCP-Public-Library/actions/workflows/node-ci.yml)
[![License: MIT](https://img.shields.io/github/license/Diatonic-AI/MCP-Public-Library?color=yellow)](https://github.com/Diatonic-AI/MCP-Public-Library/blob/main/LICENSE)
[![Issues](https://img.shields.io/github/issues/Diatonic-AI/MCP-Public-Library)](https://github.com/Diatonic-AI/MCP-Public-Library/issues)
[![Pull Requests](https://img.shields.io/github/issues-pr/Diatonic-AI/MCP-Public-Library)](https://github.com/Diatonic-AI/MCP-Public-Library/pulls)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Code Style](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

A comprehensive collection of MCP (Model Context Protocol) servers with AI integration for enhanced knowledge management in Obsidian. These servers provide intelligent note creation, advanced text processing, smart file management, automated tagging, link building, and collaborative features that transform your Obsidian vault into a powerful AI-enhanced workspace.

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- Obsidian with Smart Composer plugin installed
- Your Obsidian vault at `G:\SmartGrowth`

### Installation

1. **Install dependencies:**
   ```powershell
   npm install
   ```

2. **Test the setup:**
   ```powershell
   npm test
   ```

3. **Start all servers:**
   ```powershell
   npm start
   ```

### Usage with Smart Composer

1. Copy the configuration from `smart-composer-config-optimized.json`
2. Paste it into your Smart Composer plugin settings in Obsidian
3. Restart Obsidian or reload the Smart Composer plugin
4. Your MCP servers will be available for AI assistance

## 📊 Server Management

### Available Commands

```powershell
# Start all servers
npm start

# Stop all servers  
npm stop

# Check server status
npm run status

# List available servers
npm run list

# Start individual servers
npm run start:note-creator
npm run start:text-processor
npm run start:file-manager
npm run start:tag-helper
npm run start:link-builder
```

### Using the Server Launcher Directly

```powershell
# Start specific server
node server-launcher.js start note-creator

# Stop specific server
node server-launcher.js stop note-creator

# Get detailed status
node server-launcher.js status
```

## 🛠 Available MCP Servers

### 1. Note Creator Server
**Purpose:** Create new notes and daily notes with proper formatting

**Tools:**
- `create_note` - Create a new note with title and content
- `create_daily_note` - Create a daily note with current date

**Environment Variables:**
- `VAULT_PATH=G:\SmartGrowth`
- `NODE_ENV=production`

### 2. Text Processor Server
**Purpose:** Process and analyze text content

**Tools:**
- Extract keywords from text
- Analyze text structure
- Generate summaries

**Environment Variables:**
- `MAX_KEYWORDS=10`
- `MIN_WORD_LENGTH=3`
- `VAULT_PATH=G:\SmartGrowth`

### 3. File Manager Server
**Purpose:** Manage files within your Obsidian vault

**Tools:**
- Search files by name or content
- List files in directories
- Get file metadata

**Environment Variables:**
- `DEFAULT_FILE_EXTENSION=.md`
- `MAX_SEARCH_RESULTS=50`
- `VAULT_PATH=G:\SmartGrowth`

### 4. Tag Helper Server
**Purpose:** Manage and suggest tags for your notes

**Tools:**
- Suggest relevant tags
- Extract existing tags
- Tag analytics

**Environment Variables:**
- `TAG_PREFIX=#`
- `MAX_SUGGESTED_TAGS=5`
- `VAULT_PATH=G:\SmartGrowth`

### 5. Link Builder Server
**Purpose:** Create and manage internal links between notes

**Tools:**
- Generate wikilinks
- Suggest related notes
- Build link networks

**Environment Variables:**
- `LINK_FORMAT=wikilink`
- `MAX_LINK_SUGGESTIONS=5`
- `VAULT_PATH=G:\SmartGrowth`

## 📁 Configuration Files

### For Smart Composer Plugin
- `smart-composer-config-optimized.json` - Production configuration with all environment variables
- `smart-composer-config-example.json` - Simple configuration example

### For Server Management
- `mcp-master-config.json` - Master configuration used by server launcher
- `server-launcher.js` - Unified launcher for all MCP servers

## 🔧 Configuration Options

### Environment Variables
Each server supports these common environment variables:

- `NODE_ENV` - Set to 'production' for optimal performance
- `MCP_SERVER_NAME` - Unique identifier for each server
- `VAULT_PATH` - Path to your Obsidian vault

### Server-Specific Variables
See individual server sections above for specific environment variables.

## 🐛 Troubleshooting

### Common Issues

1. **Servers won't start:**
   ```powershell
   # Check Node.js version
   node --version  # Should be 18.0.0+
   
   # Reinstall dependencies
   npm install
   ```

2. **Smart Composer can't connect:**
   - Verify the vault path in configuration matches your actual vault location
   - Ensure all servers are running: `npm run status`
   - Check Obsidian console for connection errors

3. **Permission errors:**
   ```powershell
   # Run as administrator if needed
   # Ensure vault directory is writable
   ```

### Debug Mode

To enable debug logging, set environment variables:
```powershell
$env:NODE_ENV="development"
$env:DEBUG="*"
npm start
```

## 📈 Performance Tuning

### Recommended Settings
- Use `NODE_ENV=production` for better performance
- Adjust `MAX_SEARCH_RESULTS` based on vault size
- Tune `MAX_KEYWORDS` and `MIN_WORD_LENGTH` for text processing

### Resource Usage
- Each server uses approximately 20-50MB RAM
- CPU usage is minimal during idle
- I/O depends on vault size and operations

## 🔄 Updates and Maintenance

### Updating Dependencies
```powershell
npm update
```

### Server Health Checks
```powershell
# Check if all servers are responsive
npm run status

# Restart if needed
npm stop
npm start
```

## 📝 Development

### File Structure
```
mcp-servers/
├── server-launcher.js                    # Unified server launcher
├── note-creator-server.js                # Note creation server
├── text-processor-server.js              # Text processing server
├── file-manager-server.js                # File management server
├── tag-helper-server.js                  # Tag management server
├── link-builder-server.js                # Link building server
├── mcp-master-config.json                # Master configuration
├── smart-composer-config-optimized.json  # Smart Composer config
├── package.json                          # Dependencies and scripts
└── README.md                             # This file
```

### Adding New Tools
1. Modify the appropriate server file
2. Add the new tool to the `ListToolsRequestSchema` handler
3. Implement the tool logic in `CallToolRequestSchema` handler
4. Test with `npm run start:[server-name]`

## 📄 License

MIT License - See package.json for details.

## 🤝 Contributing

1. Test changes thoroughly with your Obsidian vault
2. Ensure all servers start/stop properly
3. Update documentation as needed
4. Follow existing code patterns and error handling

---

**Happy note-taking with enhanced AI assistance! 🚀**

