# API Keys Setup Guide

## Overview
This guide will help you obtain and configure API keys for the MCP servers.

## Required API Keys

### 1. OpenAI API Key
**Service:** GPT-4, GPT-3.5-turbo models
**Cost:** Pay-per-use (starting at $0.0015/1K tokens for GPT-3.5)

**Steps to get OpenAI API Key:**
1. Go to https://platform.openai.com/
2. Sign up or log in to your account
3. Navigate to "API Keys" in the left sidebar
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)
6. **Important:** Add billing information and set usage limits

### 2. Google Gemini API Key
**Service:** Gemini Pro models
**Cost:** Free tier available (60 requests/minute)

**Steps to get Gemini API Key:**
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Select your project or create a new one
5. Copy the generated API key

### 3. LM Studio (Local - No API Key Needed)
**Service:** Local AI models
**Cost:** Free (uses your hardware)

**Steps to setup LM Studio:**
1. Download from https://lmstudio.ai/
2. Install and launch LM Studio
3. Download a model (recommended: Llama 2 7B or similar)
4. Start the local server (your server: http://172.16.0.50:1240)
5. No API key required - uses local endpoint

## Configuration

After obtaining your API keys, you'll need to add them to the configuration. We'll do this securely using environment variables.

### Option 1: Environment Variables (Recommended)
Set these in your system environment:
```
OPENAI_API_KEY=sk-your-openai-key-here
GEMINI_API_KEY=your-gemini-key-here
LM_STUDIO_BASE_URL=http://172.16.0.50:1240
```

### Option 2: Configuration File (Less Secure)
Add to master-mcp-config.json under each server's env section.

## Security Notes
- Never commit API keys to version control
- Use environment variables when possible
- Set usage limits on paid APIs
- Regularly rotate your keys
- Monitor your API usage and costs

## Cost Estimates
- **OpenAI GPT-3.5:** ~$0.002 per 1K tokens (~750 words)
- **OpenAI GPT-4:** ~$0.03 per 1K tokens (~750 words)
- **Gemini Pro:** Free up to 60 requests/minute
- **LM Studio:** Free (local processing)

## Testing Budget Recommendations
- Start with $5-10 OpenAI credit for testing
- Use Gemini free tier for initial testing
- Use LM Studio for unlimited local testing

