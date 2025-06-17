#!/usr/bin/env pwsh
# Setup script for Obsidian Smart Composer MCP Servers

Write-Host "🚀 Setting up Obsidian Smart Composer MCP Servers..." -ForegroundColor Green
Write-Host ""

# Check Node.js version
Write-Host "📋 Checking Node.js version..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
    
    # Parse version number
    $versionNumber = [Version]($nodeVersion -replace 'v', '')
    if ($versionNumber -lt [Version]"18.0.0") {
        Write-Host "❌ Node.js 18.0.0 or higher is required. Please update Node.js." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18.0.0 or higher." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies." -ForegroundColor Red
    exit 1
}

# Test the setup
Write-Host "🧪 Testing server configuration..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Server configuration test failed." -ForegroundColor Red
    exit 1
}

# List available servers
Write-Host "📋 Available MCP servers:" -ForegroundColor Yellow
npm run list

Write-Host ""
Write-Host "✅ Setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📖 Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy configuration from 'smart-composer-config-optimized.json'"
Write-Host "2. Paste it into your Smart Composer plugin settings in Obsidian"
Write-Host "3. Start servers with: npm start"
Write-Host "4. Restart Obsidian or reload Smart Composer plugin"
Write-Host ""
Write-Host "🎯 Quick commands:" -ForegroundColor Cyan
Write-Host "  npm start          - Start all servers"
Write-Host "  npm stop           - Stop all servers"
Write-Host "  npm run status     - Check server status"
Write-Host "  npm run list       - List available servers"
Write-Host ""
Write-Host "Happy note-taking! 🚀" -ForegroundColor Green

