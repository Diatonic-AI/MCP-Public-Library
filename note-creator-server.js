#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');

class NoteCreatorServer {
  constructor() {
    this.server = new Server(
      {
        name: 'note-creator-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_note',
          description: 'Create a new note with title and content',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title of the note',
              },
              content: {
                type: 'string',
                description: 'Content of the note',
              },
              folder: {
                type: 'string',
                description: 'Folder to create the note in (optional)',
                default: '',
              },
            },
            required: ['title', 'content'],
          },
        },
        {
          name: 'create_daily_note',
          description: 'Create a daily note with current date',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Content for the daily note',
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'create_meeting_note',
          description: 'Creates a structured note with sections for agenda, attendees, and action items',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title of the meeting',
              },
              attendees: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of meeting attendees',
              },
              agenda: {
                type: 'string',
                description: 'Meeting agenda or topics',
              },
              folder: {
                type: 'string',
                description: 'Folder to create the note in (optional)',
                default: 'meetings',
              },
            },
            required: ['title', 'attendees'],
          },
        },
        {
          name: 'create_project_note',
          description: 'Generates a project note with predefined sections like goals, milestones, and resources',
          inputSchema: {
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                description: 'Name of the project',
              },
              description: {
                type: 'string',
                description: 'Project description',
              },
              goals: {
                type: 'array',
                items: { type: 'string' },
                description: 'Project goals',
              },
              folder: {
                type: 'string',
                description: 'Folder to create the note in (optional)',
                default: 'projects',
              },
            },
            required: ['projectName', 'description'],
          },
        },
        {
          name: 'create_research_note',
          description: 'Produces a research note template with sections for hypotheses, sources, and findings',
          inputSchema: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'Research topic',
              },
              hypothesis: {
                type: 'string',
                description: 'Research hypothesis',
              },
              sources: {
                type: 'array',
                items: { type: 'string' },
                description: 'Research sources',
              },
              folder: {
                type: 'string',
                description: 'Folder to create the note in (optional)',
                default: 'research',
              },
            },
            required: ['topic'],
          },
        },
        {
          name: 'create_template_note',
          description: 'Allows users to generate a note from a custom template',
          inputSchema: {
            type: 'object',
            properties: {
              templateName: {
                type: 'string',
                description: 'Name of the template to use',
              },
              title: {
                type: 'string',
                description: 'Title for the new note',
              },
              variables: {
                type: 'object',
                description: 'Variables to replace in template',
              },
              folder: {
                type: 'string',
                description: 'Folder to create the note in (optional)',
                default: '',
              },
            },
            required: ['templateName', 'title'],
          },
        },
        {
          name: 'create_summary_note',
          description: 'Automatically compiles a summary note by extracting key points from selected notes',
          inputSchema: {
            type: 'object',
            properties: {
              sourceFiles: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of source file paths to summarize',
              },
              title: {
                type: 'string',
                description: 'Title for the summary note',
              },
              summaryType: {
                type: 'string',
                enum: ['bullet_points', 'paragraph', 'executive_summary'],
                description: 'Type of summary to generate',
                default: 'bullet_points',
              },
              folder: {
                type: 'string',
                description: 'Folder to create the note in (optional)',
                default: 'summaries',
              },
            },
            required: ['sourceFiles', 'title'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'create_note':
          return await this.createNote(request.params.arguments);
        case 'create_daily_note':
          return await this.createDailyNote(request.params.arguments);
        case 'create_meeting_note':
          return await this.createMeetingNote(request.params.arguments);
        case 'create_project_note':
          return await this.createProjectNote(request.params.arguments);
        case 'create_research_note':
          return await this.createResearchNote(request.params.arguments);
        case 'create_template_note':
          return await this.createTemplateNote(request.params.arguments);
        case 'create_summary_note':
          return await this.createSummaryNote(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async createNote({ title, content, folder = '' }) {
    try {
      // Resolve paths relative to VAULT_PATH if not absolute
      const vaultPath = process.env.VAULT_PATH || '.';
      const fileName = `${title}.md`;
      const resolvedFolderPath = folder ? 
        (path.isAbsolute(folder) ? folder : path.join(vaultPath, folder)) : 
        vaultPath;
      const filePath = path.join(resolvedFolderPath, fileName);

      // Ensure directory exists
      await fs.mkdir(resolvedFolderPath, { recursive: true });

      const noteContent = `# ${title}\n\n${content}\n\n---\nCreated: ${new Date().toISOString()}`;
      await fs.writeFile(filePath, noteContent, 'utf8');

      return {
        content: [
          {
            type: 'text',
            text: `Successfully created note: ${fileName} in ${resolvedFolderPath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating note: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async createDailyNote({ content }) {
    try {
      // Resolve path relative to VAULT_PATH
      const vaultPath = process.env.VAULT_PATH || '.';
      const today = new Date().toISOString().split('T')[0];
      const fileName = `${today}.md`;
      const filePath = path.join(vaultPath, fileName);

      const noteContent = `# Daily Note - ${today}\n\n${content}\n\n---\nCreated: ${new Date().toISOString()}`;
      await fs.writeFile(filePath, noteContent, 'utf8');

      return {
        content: [
          {
            type: 'text',
            text: `Successfully created daily note: ${fileName}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating daily note: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async createMeetingNote({ title, attendees, agenda = '', folder = 'meetings' }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const fileName = `${title}.md`;
      const resolvedFolderPath = path.isAbsolute(folder) ? folder : path.join(vaultPath, folder);
      const filePath = path.join(resolvedFolderPath, fileName);

      await fs.mkdir(resolvedFolderPath, { recursive: true });

      const attendeesList = attendees.map(a => `- ${a}`).join('\n');
      const noteContent = `---
title: ${title}
type: meeting
created: ${new Date().toISOString()}
tags: [meeting, business]
---

# 📅 ${title}

## 👥 Attendees
${attendeesList}

## 📋 Agenda
${agenda || 'TBD'}

## 📝 Notes


## ✅ Action Items
- [ ] 

## 📅 Next Meeting
Date: 
Agenda: 

---
Created: ${new Date().toISOString()}`;
      
      await fs.writeFile(filePath, noteContent, 'utf8');

      return {
        content: [{
          type: 'text',
          text: `Successfully created meeting note: ${fileName} in ${resolvedFolderPath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating meeting note: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async createProjectNote({ projectName, description, goals = [], folder = 'projects' }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const fileName = `${projectName}.md`;
      const resolvedFolderPath = path.isAbsolute(folder) ? folder : path.join(vaultPath, folder);
      const filePath = path.join(resolvedFolderPath, fileName);

      await fs.mkdir(resolvedFolderPath, { recursive: true });

      const goalsList = goals.length > 0 ? goals.map(g => `- [ ] ${g}`).join('\n') : '- [ ] Define project goals';
      const noteContent = `---
title: ${projectName}
type: project
status: planning
created: ${new Date().toISOString()}
tags: [project, business]
---

# 🚀 ${projectName}

## 📖 Description
${description}

## 🎯 Goals
${goalsList}

## 📋 Milestones
- [ ] Project initiation
- [ ] Requirements gathering
- [ ] Development phase
- [ ] Testing phase
- [ ] Deployment
- [ ] Project closure

## 📊 Resources

### 👥 Team Members
- 

### 💰 Budget
- Total Budget: $
- Allocated: $
- Remaining: $

### 🛠️ Tools & Technologies
- 

## 📅 Timeline

| Phase | Start Date | End Date | Status |
|-------|------------|----------|--------|
| Planning | | | 🟡 In Progress |
| Development | | | ⚪ Pending |
| Testing | | | ⚪ Pending |
| Deployment | | | ⚪ Pending |

## 📝 Notes


## 🔗 Related Documents


---
Created: ${new Date().toISOString()}
Last Updated: ${new Date().toISOString()}`;
      
      await fs.writeFile(filePath, noteContent, 'utf8');

      return {
        content: [{
          type: 'text',
          text: `Successfully created project note: ${fileName} in ${resolvedFolderPath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating project note: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async createResearchNote({ topic, hypothesis = '', sources = [], folder = 'research' }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const fileName = `${topic.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')}.md`;
      const resolvedFolderPath = path.isAbsolute(folder) ? folder : path.join(vaultPath, folder);
      const filePath = path.join(resolvedFolderPath, fileName);

      await fs.mkdir(resolvedFolderPath, { recursive: true });

      const sourcesList = sources.length > 0 ? sources.map(s => `- ${s}`).join('\n') : '- Add research sources';
      const noteContent = `---
title: ${topic}
type: research
status: in-progress
created: ${new Date().toISOString()}
tags: [research, analysis]
---

# 🔬 ${topic}

## 💭 Hypothesis
${hypothesis || 'Define research hypothesis'}

## 📚 Sources
${sourcesList}

## 🔍 Methodology


## 📊 Data Collection

### Quantitative Data


### Qualitative Data


## 📈 Analysis


## 🔍 Findings

### Key Insights
- 

### Supporting Evidence
- 

### Contradictory Evidence
- 

## 💡 Conclusions


## 🚀 Next Steps
- [ ] 

## 🔗 Related Research


---
Created: ${new Date().toISOString()}
Last Updated: ${new Date().toISOString()}`;
      
      await fs.writeFile(filePath, noteContent, 'utf8');

      return {
        content: [{
          type: 'text',
          text: `Successfully created research note: ${fileName} in ${resolvedFolderPath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating research note: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async createTemplateNote({ templateName, title, variables = {}, folder = '' }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const templatesPath = path.join(vaultPath, 'templates');
      const templateFile = path.join(templatesPath, `${templateName}.md`);
      
      // Read template
      let templateContent;
      try {
        templateContent = await fs.readFile(templateFile, 'utf8');
      } catch (error) {
        throw new Error(`Template '${templateName}' not found in ${templatesPath}`);
      }

      // Replace variables in template
      let content = templateContent;
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, value);
      }

      // Replace title placeholder
      content = content.replace(/{{title}}/g, title);
      content = content.replace(/{{date}}/g, new Date().toISOString());

      const fileName = `${title}.md`;
      const resolvedFolderPath = folder ? 
        (path.isAbsolute(folder) ? folder : path.join(vaultPath, folder)) : 
        vaultPath;
      const filePath = path.join(resolvedFolderPath, fileName);

      await fs.mkdir(resolvedFolderPath, { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');

      return {
        content: [{
          type: 'text',
          text: `Successfully created note from template '${templateName}': ${fileName} in ${resolvedFolderPath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating template note: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async createSummaryNote({ sourceFiles, title, summaryType = 'bullet_points', folder = 'summaries' }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const fileName = `${title}.md`;
      const resolvedFolderPath = path.isAbsolute(folder) ? folder : path.join(vaultPath, folder);
      const filePath = path.join(resolvedFolderPath, fileName);

      await fs.mkdir(resolvedFolderPath, { recursive: true });

      // Read source files
      const summaryContent = [];
      for (const sourceFile of sourceFiles) {
        try {
          const sourceFilePath = path.isAbsolute(sourceFile) ? sourceFile : path.join(vaultPath, sourceFile);
          const content = await fs.readFile(sourceFilePath, 'utf8');
          
          // Extract key points (simple implementation)
          const lines = content.split('\n').filter(line => {
            return line.trim().startsWith('#') || 
                   line.trim().startsWith('-') || 
                   line.trim().startsWith('*') ||
                   (line.trim().length > 50 && line.trim().length < 200);
          });
          
          if (lines.length > 0) {
            summaryContent.push(`## Summary from ${path.basename(sourceFile)}\n${lines.slice(0, 5).join('\n')}`);
          }
        } catch (error) {
          summaryContent.push(`## Error reading ${sourceFile}\n${error.message}`);
        }
      }

      const noteContent = `---
title: ${title}
type: summary
created: ${new Date().toISOString()}
tags: [summary, analysis]
source_files: [${sourceFiles.map(f => `"${f}"`).join(', ')}]
---

# 📄 ${title}

## 📊 Summary Type: ${summaryType.replace('_', ' ').toUpperCase()}

${summaryContent.join('\n\n')}

## 🔗 Source Files
${sourceFiles.map(f => `- [[${path.basename(f, '.md')}]]`).join('\n')}

---
Generated: ${new Date().toISOString()}`;
      
      await fs.writeFile(filePath, noteContent, 'utf8');

      return {
        content: [{
          type: 'text',
          text: `Successfully created summary note: ${fileName} from ${sourceFiles.length} source files`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating summary note: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Note Creator MCP server running on stdio');
  }
}

const server = new NoteCreatorServer();
server.run().catch(console.error);

