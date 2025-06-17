# Smart Composer Deployment Script
# This script helps deploy MCP servers to Obsidian Smart Composer

Write-Host "🚀 Smart Composer MCP Servers Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Read the configuration file
$configPath = "./master-mcp-config.json"
if (-not (Test-Path $configPath)) {
    Write-Host "❌ Configuration file not found: $configPath" -ForegroundColor Red
    exit 1
}

$config = Get-Content $configPath -Raw
Write-Host "✅ Configuration loaded successfully" -ForegroundColor Green
Write-Host ""

# Display the configuration
Write-Host "📋 MCP Servers Configuration for Smart Composer:" -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host $config -ForegroundColor White
Write-Host ""

# Instructions
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Copy the above JSON configuration" -ForegroundColor White
Write-Host "2. Open Obsidian" -ForegroundColor White
Write-Host "3. Go to Settings → Smart Composer → MCP Servers" -ForegroundColor White
Write-Host "4. Paste the configuration in the MCP Servers field" -ForegroundColor White
Write-Host "5. Save and restart Obsidian" -ForegroundColor White
Write-Host ""

# Copy to clipboard if possible
try {
    $config | Set-Clipboard
    Write-Host "📋 Configuration copied to clipboard!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not copy to clipboard. Please copy manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🧪 Testing Commands:" -ForegroundColor Cyan
Write-Host "npm run test-tools              # Test all tools" -ForegroundColor White
Write-Host "npm run test-tools-interactive  # Interactive testing" -ForegroundColor White
Write-Host ""

Write-Host "✨ Ready for Smart Composer!" -ForegroundColor Green
Write-Host "Your MCP servers are configured and ready to use." -ForegroundColor White

