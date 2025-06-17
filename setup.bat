@echo off
rem Setup script for Obsidian Smart Composer MCP Servers

echo 🚀 Setting up Obsidian Smart Composer MCP Servers...
echo.

rem Check Node.js version
echo 📋 Checking Node.js version...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js 18.0.0 or higher.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set nodeVersion=%%i
echo Node.js version: %nodeVersion%

rem Install dependencies
echo 📦 Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies.
    pause
    exit /b 1
)

rem Test the setup
echo 🧪 Testing server configuration...
npm test
if %errorlevel% neq 0 (
    echo ❌ Server configuration test failed.
    pause
    exit /b 1
)

rem List available servers
echo 📋 Available MCP servers:
npm run list

echo.
echo ✅ Setup completed successfully!
echo.
echo 📖 Next steps:
echo 1. Copy configuration from 'smart-composer-config-optimized.json'
echo 2. Paste it into your Smart Composer plugin settings in Obsidian
echo 3. Start servers with: npm start
echo 4. Restart Obsidian or reload Smart Composer plugin
echo.
echo 🎯 Quick commands:
echo   npm start          - Start all servers
echo   npm stop           - Stop all servers
echo   npm run status     - Check server status
echo   npm run list       - List available servers
echo.
echo Happy note-taking! 🚀
echo.
pause

