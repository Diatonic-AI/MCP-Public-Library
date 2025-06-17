# MCP Servers Environment Variables Setup Script
# This script helps you securely set up API keys as environment variables

Write-Host "🔐 MCP Servers API Keys Setup" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Function to set environment variable securely
function Set-SecureEnvVar {
    param(
        [string]$Name,
        [string]$Description,
        [bool]$Required = $false
    )
    
    $currentValue = [Environment]::GetEnvironmentVariable($Name, "User")
    
    if ($currentValue) {
        Write-Host "✓ $Name is already set" -ForegroundColor Green
        $response = Read-Host "Do you want to update it? (y/N)"
        if ($response -ne 'y' -and $response -ne 'Y') {
            return
        }
    }
    
    Write-Host "$Description" -ForegroundColor Yellow
    $value = Read-Host "Enter your $Name (leave blank to skip)"
    
    if ($value) {
        [Environment]::SetEnvironmentVariable($Name, $value, "User")
        Write-Host "✓ $Name set successfully" -ForegroundColor Green
    } elseif ($Required) {
        Write-Host "⚠️  $Name is required for some features" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Set up API keys
Set-SecureEnvVar -Name "OPENAI_API_KEY" -Description "OpenAI API Key (starts with 'sk-')"
Set-SecureEnvVar -Name "GEMINI_API_KEY" -Description "Google Gemini API Key"
Set-SecureEnvVar -Name "LM_STUDIO_BASE_URL" -Description "LM Studio Base URL (your server: http://172.16.0.50:1240)"

# Set vault path (required)
Set-SecureEnvVar -Name "OBSIDIAN_VAULT_PATH" -Description "Path to your Obsidian vault" -Required $true

Write-Host "🎉 Environment variables setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart your terminal/PowerShell" -ForegroundColor White
Write-Host "2. Run 'npm run test-tools' to test individual tools" -ForegroundColor White
Write-Host "3. Configure Smart Composer with the MCP servers" -ForegroundColor White
Write-Host ""
Write-Host "To verify environment variables are set:" -ForegroundColor Cyan
Write-Host "Get-ChildItem Env: | Where-Object Name -Like '*API*'" -ForegroundColor White

