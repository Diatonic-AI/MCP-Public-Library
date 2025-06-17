# Contributing to SmartGrowth MCP Servers

Thank you for your interest in contributing to the SmartGrowth MCP Servers project! This document outlines our development workflow, coding standards, and guidelines for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Git
- Obsidian with Smart Composer plugin (for testing)

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/yourusername/smartgrowth-mcp-servers.git
   cd smartgrowth-mcp-servers
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Validate configuration:**
   ```bash
   npm run validate-config
   ```

5. **Run tests:**
   ```bash
   npm test
   ```

## 📝 Pull Request Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 2. Make Your Changes

- Follow our coding style guidelines (see below)
- Write or update tests as needed
- Update documentation if necessary
- Ensure all tests pass locally

### 3. Commit Your Changes

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
git commit -m "feat: add new MCP tool for note linking"
git commit -m "fix: resolve server startup timeout issue"
git commit -m "docs: update API documentation for text processor"
git commit -m "test: add unit tests for file manager tools"
```

### 4. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub with:
- Clear title and description
- Reference to any related issues
- Screenshots or examples if applicable

### 5. Code Review Process

- All PRs require at least one review
- Address feedback promptly
- Keep PR scope focused and manageable
- Rebase if needed to maintain clean history

## 🎨 Coding Style Guidelines

### JavaScript/Node.js Standards

- **Indentation:** 2 spaces (no tabs)
- **Semicolons:** Always use semicolons
- **Quotes:** Single quotes for strings, double quotes for JSON
- **Line length:** Maximum 100 characters
- **Naming conventions:**
  - camelCase for variables and functions
  - PascalCase for classes and constructors
  - UPPER_SNAKE_CASE for constants
  - kebab-case for file names

### Code Structure

```javascript
// Example MCP server structure
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

class MyMCPServer {
  constructor() {
    this.server = new Server({
      name: 'my-mcp-server',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {},
      },
    });
    
    this.setupHandlers();
  }
  
  setupHandlers() {
    // Handler implementations
  }
}

module.exports = MyMCPServer;
```

### Error Handling

```javascript
// Always handle errors appropriately
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  console.error('Operation failed:', error.message);
  throw new Error(`Failed to perform operation: ${error.message}`);
}
```

### Documentation

- Use JSDoc comments for functions and classes
- Include parameter types and return values
- Provide usage examples for complex functions

```javascript
/**
 * Creates a new note in the specified vault location
 * @param {string} title - The title of the note
 * @param {string} content - The content of the note
 * @param {string} [folder] - Optional folder path
 * @returns {Promise<string>} The path to the created note
 * @throws {Error} When note creation fails
 */
async function createNote(title, content, folder) {
  // Implementation
}
```

## 📋 Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for consistent commit messages:

### Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat:** A new feature
- **fix:** A bug fix
- **docs:** Documentation only changes
- **style:** Changes that don't affect code meaning (white-space, formatting)
- **refactor:** Code change that neither fixes a bug nor adds a feature
- **perf:** A code change that improves performance
- **test:** Adding missing tests or correcting existing tests
- **chore:** Changes to build process or auxiliary tools

### Examples

```bash
# Good commit messages
git commit -m "feat(note-creator): add template support for daily notes"
git commit -m "fix(file-manager): handle special characters in file names"
git commit -m "docs: update installation instructions for Windows"
git commit -m "test(link-builder): add integration tests for wikilink generation"

# Bad commit messages
git commit -m "fix stuff"
git commit -m "update"
git commit -m "WIP"
```

## 🧪 Testing Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific server
npm run test:note-creator

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write unit tests for all new functions
- Include integration tests for MCP tools
- Test error conditions and edge cases
- Use descriptive test names

```javascript
// Example test structure
describe('Note Creator Server', () => {
  describe('createNote tool', () => {
    it('should create a note with valid title and content', async () => {
      // Test implementation
    });
    
    it('should handle special characters in note titles', async () => {
      // Test implementation
    });
    
    it('should throw error when title is empty', async () => {
      // Test implementation
    });
  });
});
```

### Local Testing Commands

```bash
# Validate all configurations
npm run validate-config

# Test server startup/shutdown
npm start
npm stop
npm run status

# Test individual servers
npm run start:note-creator
node test-tools.js -i  # Interactive tool testing

# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format
```

## 📚 Documentation

### README Updates

- Update README.md for any new features or changes
- Include usage examples
- Update configuration sections as needed

### Code Comments

- Comment complex logic and algorithms
- Explain why something is done, not just what
- Keep comments up-to-date with code changes

### API Documentation

- Document all MCP tools and their parameters
- Include example requests and responses
- Update schema definitions when needed

## 🔧 Development Tools

### Recommended VS Code Extensions

- ESLint
- Prettier
- JavaScript (ES6) code snippets
- GitLens
- Thunder Client (for API testing)

### Debugging

```bash
# Debug mode with verbose logging
NODE_ENV=development DEBUG=* npm start

# Debug specific server
NODE_ENV=development DEBUG=mcp:note-creator npm run start:note-creator
```

## 🐛 Issue Reporting

### Before Creating an Issue

1. Check existing issues for duplicates
2. Try the latest version
3. Test with minimal configuration
4. Gather system information

### Issue Template Information

- Node.js version
- npm version
- Operating system
- Obsidian version
- Smart Composer plugin version
- Steps to reproduce
- Expected vs. actual behavior
- Error messages or logs

## 🚀 Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR:** Breaking changes
- **MINOR:** New features (backward compatible)
- **PATCH:** Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] Release notes prepared

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Focus on the code, not the person

### Getting Help

- Check the documentation first
- Search existing issues
- Ask questions in discussions
- Provide context and examples

### Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Added to package.json contributors list

---

Thank you for contributing to SmartGrowth MCP Servers! Your help makes this project better for everyone. 🎉

