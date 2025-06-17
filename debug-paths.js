#!/usr/bin/env node

// Debug script to test path resolution
const path = require('path');
const fs = require('fs').promises;

console.log('=== MCP Path Resolution Debug ===');
console.log(`Current working directory: ${process.cwd()}`);
console.log(`VAULT_PATH environment: ${process.env.VAULT_PATH}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

// Test the path resolution logic
function getVaultPath() {
  return process.env.VAULT_PATH || 'G:\\SmartGrowth';
}

function resolvePath(inputPath) {
  const vaultPath = getVaultPath();
  return path.isAbsolute(inputPath) ? inputPath : path.join(vaultPath, inputPath);
}

async function testPaths() {
  const vaultPath = getVaultPath();
  console.log(`\nUsing vault path: ${vaultPath}`);
  
  // Test some common relative paths
  const testPaths = [
    'Pricing/Wix Studio Pricing.md',
    './README.md',
    'mcp-servers',
    '.'
  ];
  
  for (const testPath of testPaths) {
    const resolved = resolvePath(testPath);
    console.log(`Input: "${testPath}" -> Resolved: "${resolved}"`);
    
    try {
      const exists = await fs.access(resolved).then(() => true).catch(() => false);
      console.log(`  Exists: ${exists}`);
    } catch (err) {
      console.log(`  Error checking: ${err.message}`);
    }
  }
  
  // Test vault directory access
  console.log(`\nTesting vault directory access:`);
  try {
    const files = await fs.readdir(vaultPath);
    console.log(`  Successfully read vault directory: ${files.length} items found`);
    console.log(`  First 5 items: ${files.slice(0, 5).join(', ')}`);
  } catch (err) {
    console.log(`  ERROR reading vault directory: ${err.message}`);
  }
}

testPaths().catch(console.error);

