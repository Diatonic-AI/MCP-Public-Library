#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CollaborationServer {
  constructor() {
    this.server = new Server(
      {
        name: 'collaboration-server',
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
          name: 'create_team_workspace',
          description: 'Create a collaborative workspace for team projects',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_name: {
                type: 'string',
                description: 'Name of the workspace',
              },
              team_members: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of team member names',
              },
              project_description: {
                type: 'string',
                description: 'Description of the project',
              },
              workspace_template: {
                type: 'string',
                enum: ['basic', 'agile', 'research', 'documentation'],
                description: 'Template to use for workspace structure',
                default: 'basic',
              },
            },
            required: ['workspace_name', 'team_members'],
          },
        },
        {
          name: 'assign_task',
          description: 'Assign tasks to team members with tracking',
          inputSchema: {
            type: 'object',
            properties: {
              task_title: {
                type: 'string',
                description: 'Title of the task',
              },
              assignee: {
                type: 'string',
                description: 'Name of the person assigned to the task',
              },
              description: {
                type: 'string',
                description: 'Detailed description of the task',
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high', 'urgent'],
                description: 'Priority level of the task',
                default: 'medium',
              },
              due_date: {
                type: 'string',
                description: 'Due date for the task (YYYY-MM-DD format)',
              },
              workspace: {
                type: 'string',
                description: 'Workspace where task should be created',
              },
            },
            required: ['task_title', 'assignee', 'workspace'],
          },
        },
        {
          name: 'create_meeting_notes',
          description: 'Create structured meeting notes with action items',
          inputSchema: {
            type: 'object',
            properties: {
              meeting_title: {
                type: 'string',
                description: 'Title of the meeting',
              },
              date: {
                type: 'string',
                description: 'Meeting date (YYYY-MM-DD format)',
              },
              attendees: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of meeting attendees',
              },
              agenda_items: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of agenda items discussed',
              },
              action_items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    action: { type: 'string' },
                    assignee: { type: 'string' },
                    due_date: { type: 'string' }
                  },
                  required: ['action', 'assignee']
                },
                description: 'Action items with assignees',
              },
              workspace: {
                type: 'string',
                description: 'Workspace to save meeting notes in',
              },
            },
            required: ['meeting_title', 'date', 'attendees', 'workspace'],
          },
        },
        {
          name: 'track_team_progress',
          description: 'Track and report team progress across projects',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: {
                type: 'string',
                description: 'Workspace to analyze',
              },
              report_type: {
                type: 'string',
                enum: ['daily', 'weekly', 'monthly', 'project'],
                description: 'Type of progress report',
                default: 'weekly',
              },
              include_charts: {
                type: 'boolean',
                description: 'Include visual progress charts',
                default: true,
              },
            },
            required: ['workspace'],
          },
        },
        {
          name: 'create_code_review_checklist',
          description: 'Generate code review checklists for team standards',
          inputSchema: {
            type: 'object',
            properties: {
              project_type: {
                type: 'string',
                enum: ['web', 'mobile', 'backend', 'ml', 'general'],
                description: 'Type of project for the checklist',
                default: 'general',
              },
              languages: {
                type: 'array',
                items: { type: 'string' },
                description: 'Programming languages used in the project',
              },
              team_standards: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific team coding standards to include',
              },
              workspace: {
                type: 'string',
                description: 'Workspace to save checklist in',
              },
            },
            required: ['workspace'],
          },
        },
        {
          name: 'generate_team_dashboard',
          description: 'Create a team dashboard with key metrics and updates',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: {
                type: 'string',
                description: 'Workspace to create dashboard for',
              },
              dashboard_type: {
                type: 'string',
                enum: ['overview', 'detailed', 'executive'],
                description: 'Type of dashboard to create',
                default: 'overview',
              },
              include_metrics: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['task_completion', 'team_velocity', 'deadlines', 'workload_distribution']
                },
                description: 'Metrics to include in dashboard',
                default: ['task_completion', 'deadlines'],
              },
            },
            required: ['workspace'],
          },
        },
        {
          name: 'sync_external_tools',
          description: 'Sync data with external collaboration tools',
          inputSchema: {
            type: 'object',
            properties: {
              tool_type: {
                type: 'string',
                enum: ['jira', 'github', 'slack', 'teams', 'notion'],
                description: 'External tool to sync with',
              },
              sync_direction: {
                type: 'string',
                enum: ['import', 'export', 'bidirectional'],
                description: 'Direction of sync',
                default: 'import',
              },
              workspace: {
                type: 'string',
                description: 'Target workspace for sync',
              },
              api_config: {
                type: 'object',
                description: 'API configuration for external tool',
              },
            },
            required: ['tool_type', 'workspace'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'create_team_workspace':
          return await this.createTeamWorkspace(request.params.arguments);
        case 'assign_task':
          return await this.assignTask(request.params.arguments);
        case 'create_meeting_notes':
          return await this.createMeetingNotes(request.params.arguments);
        case 'track_team_progress':
          return await this.trackTeamProgress(request.params.arguments);
        case 'create_code_review_checklist':
          return await this.createCodeReviewChecklist(request.params.arguments);
        case 'generate_team_dashboard':
          return await this.generateTeamDashboard(request.params.arguments);
        case 'sync_external_tools':
          return await this.syncExternalTools(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async createTeamWorkspace({ workspace_name, team_members, project_description, workspace_template = 'basic' }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const workspacePath = path.join(vaultPath, 'workspaces', workspace_name);
      
      // Create workspace directory structure
      await fs.mkdir(workspacePath, { recursive: true });
      
      const templates = {
        basic: ['README.md', 'tasks', 'meetings', 'resources'],
        agile: ['README.md', 'sprints', 'backlog', 'retrospectives', 'daily-standups'],
        research: ['README.md', 'literature-review', 'experiments', 'findings', 'publications'],
        documentation: ['README.md', 'specifications', 'user-guides', 'api-docs', 'tutorials']
      };
      
      const structure = templates[workspace_template] || templates.basic;
      
      for (const item of structure) {
        if (item.endsWith('.md')) {
          const filePath = path.join(workspacePath, item);
          await this.createWorkspaceFile(filePath, item, workspace_name, team_members, project_description);
        } else {
          await fs.mkdir(path.join(workspacePath, item), { recursive: true });
        }
      }
      
      // Create team members file
      const teamContent = this.generateTeamMembersContent(team_members);
      await fs.writeFile(path.join(workspacePath, 'team-members.md'), teamContent);
      
      return {
        content: [{
          type: 'text',
          text: `Team workspace "${workspace_name}" created successfully with ${workspace_template} template.\n\nWorkspace structure:\n${structure.map(s => `- ${s}`).join('\n')}\n\nTeam members: ${team_members.join(', ')}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating workspace: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async createWorkspaceFile(filePath, fileName, workspaceName, teamMembers, description) {
    let content = '';
    
    if (fileName === 'README.md') {
      content = `# ${workspaceName}\n\n${description || 'Team workspace for collaborative work.'}\n\n## Team Members\n${teamMembers.map(member => `- ${member}`).join('\n')}\n\n## Getting Started\n\nThis workspace contains all project-related documentation, tasks, and resources.\n\n## Quick Links\n\n- [Tasks](./tasks/)\n- [Meetings](./meetings/)\n- [Resources](./resources/)\n\n---\n*Created on ${new Date().toISOString().split('T')[0]}*`;
    }
    
    await fs.writeFile(filePath, content);
  }

  generateTeamMembersContent(teamMembers) {
    return `# Team Members\n\n${teamMembers.map(member => `## ${member}\n\n- **Role**: \n- **Expertise**: \n- **Contact**: \n- **Current Tasks**: \n\n`).join('')}\n---\n*Last updated: ${new Date().toISOString().split('T')[0]}*`;
  }

  async assignTask({ task_title, assignee, description, priority = 'medium', due_date, workspace }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const tasksPath = path.join(vaultPath, 'workspaces', workspace, 'tasks');
      
      await fs.mkdir(tasksPath, { recursive: true });
      
      const taskId = crypto.randomBytes(4).toString('hex');
      const fileName = `${taskId}-${task_title.toLowerCase().replace(/\s+/g, '-')}.md`;
      const taskPath = path.join(tasksPath, fileName);
      
      const taskContent = `# ${task_title}\n\n**Task ID**: ${taskId}\n**Assignee**: ${assignee}\n**Priority**: ${priority}\n**Status**: Todo\n${due_date ? `**Due Date**: ${due_date}\n` : ''}\n**Created**: ${new Date().toISOString().split('T')[0]}\n\n## Description\n\n${description || 'No description provided.'}\n\n## Checklist\n\n- [ ] Task analysis\n- [ ] Implementation\n- [ ] Testing\n- [ ] Review\n- [ ] Completion\n\n## Notes\n\n\n## Updates\n\n`;
      
      await fs.writeFile(taskPath, taskContent);
      
      // Update task tracking file
      await this.updateTaskTracker(workspace, {
        id: taskId,
        title: task_title,
        assignee,
        priority,
        status: 'Todo',
        created: new Date().toISOString().split('T')[0],
        due_date
      });
      
      return {
        content: [{
          type: 'text',
          text: `Task "${task_title}" (ID: ${taskId}) assigned to ${assignee} successfully.\n\nPriority: ${priority}\n${due_date ? `Due Date: ${due_date}\n` : ''}Task file created: ${fileName}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error assigning task: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async updateTaskTracker(workspace, task) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const trackerPath = path.join(vaultPath, 'workspaces', workspace, 'task-tracker.md');
      
      let content = '';
      try {
        content = await fs.readFile(trackerPath, 'utf8');
      } catch {
        content = `# Task Tracker - ${workspace}\n\n| ID | Title | Assignee | Priority | Status | Created | Due Date |\n|---|---|---|---|---|---|---|\n`;
      }
      
      const newRow = `| ${task.id} | ${task.title} | ${task.assignee} | ${task.priority} | ${task.status} | ${task.created} | ${task.due_date || 'N/A'} |\n`;
      content += newRow;
      
      await fs.writeFile(trackerPath, content);
    } catch (error) {
      console.error('Error updating task tracker:', error);
    }
  }

  async createMeetingNotes({ meeting_title, date, attendees, agenda_items = [], action_items = [], workspace }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const meetingsPath = path.join(vaultPath, 'workspaces', workspace, 'meetings');
      
      await fs.mkdir(meetingsPath, { recursive: true });
      
      const fileName = `${date}-${meeting_title.toLowerCase().replace(/\s+/g, '-')}.md`;
      const meetingPath = path.join(meetingsPath, fileName);
      
      const meetingContent = `# ${meeting_title}\n\n**Date**: ${date}\n**Attendees**: ${attendees.join(', ')}\n\n## Agenda\n\n${agenda_items.map(item => `- ${item}`).join('\n')}\n\n## Discussion Notes\n\n\n## Decisions Made\n\n\n## Action Items\n\n${action_items.map(item => `- [ ] ${item.action} (Assigned: ${item.assignee}${item.due_date ? `, Due: ${item.due_date}` : ''})\n`).join('')}\n## Next Steps\n\n\n---\n*Meeting notes created on ${new Date().toISOString().split('T')[0]}*`;
      
      await fs.writeFile(meetingPath, meetingContent);
      
      // Create tasks from action items
      for (const actionItem of action_items) {
        await this.assignTask({
          task_title: actionItem.action,
          assignee: actionItem.assignee,
          description: `Action item from meeting: ${meeting_title} (${date})`,
          priority: 'medium',
          due_date: actionItem.due_date,
          workspace
        });
      }
      
      return {
        content: [{
          type: 'text',
          text: `Meeting notes "${meeting_title}" created successfully for ${date}.\n\nAttendees: ${attendees.join(', ')}\nAction Items: ${action_items.length}\nFile: ${fileName}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating meeting notes: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async trackTeamProgress({ workspace, report_type = 'weekly', include_charts = true }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const workspacePath = path.join(vaultPath, 'workspaces', workspace);
      
      // Analyze tasks and progress
      const progress = await this.analyzeProgress(workspacePath);
      
      const reportContent = `# Team Progress Report - ${workspace}\n\n**Report Type**: ${report_type}\n**Generated**: ${new Date().toISOString().split('T')[0]}\n\n## Summary\n\n- **Total Tasks**: ${progress.totalTasks}\n- **Completed**: ${progress.completed}\n- **In Progress**: ${progress.inProgress}\n- **Todo**: ${progress.todo}\n- **Completion Rate**: ${Math.round((progress.completed / progress.totalTasks) * 100)}%\n\n## Team Metrics\n\n${progress.teamMetrics}\n\n## Upcoming Deadlines\n\n${progress.upcomingDeadlines}\n\n${include_charts ? '## Visual Progress\n\n```mermaid\npie title Task Distribution\n    "Completed" : ' + progress.completed + '\n    "In Progress" : ' + progress.inProgress + '\n    "Todo" : ' + progress.todo + '\n```\n\n' : ''}## Recommendations\n\n${progress.recommendations}`;
      
      const reportPath = path.join(workspacePath, `progress-report-${new Date().toISOString().split('T')[0]}.md`);
      await fs.writeFile(reportPath, reportContent);
      
      return {
        content: [{
          type: 'text',
          text: reportContent,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error tracking progress: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async analyzeProgress(workspacePath) {
    // Placeholder for progress analysis logic
    return {
      totalTasks: 10,
      completed: 4,
      inProgress: 3,
      todo: 3,
      teamMetrics: '- Average completion time: 3 days\n- Most active contributor: Team Lead\n- Current workload distribution: Balanced',
      upcomingDeadlines: '- Project milestone (Due: Next week)\n- Code review session (Due: 2 days)',
      recommendations: '- Consider reassigning overdue tasks\n- Schedule team sync meeting\n- Update project timeline'
    };
  }

  async createCodeReviewChecklist({ project_type = 'general', languages = [], team_standards = [], workspace }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const workspacePath = path.join(vaultPath, 'workspaces', workspace);
      
      const checklist = this.generateCodeReviewChecklist(project_type, languages, team_standards);
      
      const checklistPath = path.join(workspacePath, 'code-review-checklist.md');
      await fs.writeFile(checklistPath, checklist);
      
      return {
        content: [{
          type: 'text',
          text: `Code review checklist created for ${project_type} project.\n\nLanguages: ${languages.join(', ') || 'General'}\nCustom standards: ${team_standards.length}\n\nChecklist saved to: code-review-checklist.md`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating checklist: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  generateCodeReviewChecklist(projectType, languages, teamStandards) {
    const baseChecklist = `# Code Review Checklist\n\n## General Guidelines\n\n- [ ] Code follows project conventions\n- [ ] No obvious bugs or logical errors\n- [ ] Code is readable and well-documented\n- [ ] No security vulnerabilities\n- [ ] Performance considerations addressed\n\n## Functionality\n\n- [ ] Code does what it's supposed to do\n- [ ] Edge cases are handled\n- [ ] Error handling is appropriate\n- [ ] Tests are included and pass\n\n## Code Quality\n\n- [ ] Variables and functions are well-named\n- [ ] No duplicate code\n- [ ] Code is modular and reusable\n- [ ] Complexity is reasonable\n\n${teamStandards.length ? '## Team Standards\n\n' + teamStandards.map(std => `- [ ] ${std}`).join('\n') + '\n\n' : ''}## Language-Specific\n\n${this.getLanguageSpecificChecks(languages)}\n\n---\n*Checklist for ${projectType} project - Updated ${new Date().toISOString().split('T')[0]}*`;
    
    return baseChecklist;
  }

  getLanguageSpecificChecks(languages) {
    const checks = {
      javascript: '- [ ] No var declarations, use const/let\n- [ ] Proper async/await usage\n- [ ] ESLint rules followed',
      python: '- [ ] PEP 8 style guidelines followed\n- [ ] Proper exception handling\n- [ ] Type hints included',
      java: '- [ ] Proper exception handling\n- [ ] No magic numbers\n- [ ] Consistent naming conventions',
      typescript: '- [ ] Type safety maintained\n- [ ] Interfaces properly defined\n- [ ] No any types without justification'
    };
    
    return languages.map(lang => checks[lang.toLowerCase()] || '- [ ] Language-specific best practices followed').join('\n');
  }

  async generateTeamDashboard({ workspace, dashboard_type = 'overview', include_metrics = ['task_completion', 'deadlines'] }) {
    try {
      const vaultPath = process.env.VAULT_PATH || '.';
      const workspacePath = path.join(vaultPath, 'workspaces', workspace);
      
      const dashboard = await this.createDashboardContent(workspace, dashboard_type, include_metrics);
      
      const dashboardPath = path.join(workspacePath, 'team-dashboard.md');
      await fs.writeFile(dashboardPath, dashboard);
      
      return {
        content: [{
          type: 'text',
          text: dashboard,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error generating dashboard: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async createDashboardContent(workspace, dashboardType, includeMetrics) {
    const date = new Date().toISOString().split('T')[0];
    
    return `# Team Dashboard - ${workspace}\n\n*Last Updated: ${date}*\n\n## Quick Overview\n\n### Current Sprint Status\n- **Sprint**: Week ${Math.ceil(new Date().getDate() / 7)}\n- **Days Remaining**: 3\n- **Completion**: 65%\n\n### Team Availability\n- **Active Members**: 5/6\n- **On Leave**: 1\n- **Capacity**: 85%\n\n## Key Metrics\n\n${this.generateMetricsSection(includeMetrics)}\n\n## Recent Updates\n\n- ✅ Feature X completed\n- 🔄 Bug fix in progress\n- 📅 Team meeting scheduled for tomorrow\n\n## Action Items\n\n- [ ] Review pending PRs\n- [ ] Update project timeline\n- [ ] Prepare demo for stakeholders\n\n## Upcoming Events\n\n| Date | Event | Participants |\n|------|-------|-------------|\n| ${date} | Daily Standup | All |\n| Tomorrow | Sprint Review | Team + PM |\n\n---\n\n*Dashboard Type: ${dashboardType}*`;
  }

  generateMetricsSection(includeMetrics) {
    const metrics = {
      task_completion: '**Task Completion Rate**: 78% (23/30 tasks completed)',
      team_velocity: '**Team Velocity**: 15 story points per sprint (↑ 20% from last sprint)',
      deadlines: '**Upcoming Deadlines**: 3 tasks due this week, 1 overdue',
      workload_distribution: '**Workload Distribution**: Balanced across team members'
    };
    
    return includeMetrics.map(metric => metrics[metric] || '').filter(Boolean).join('\n');
  }

  async syncExternalTools({ tool_type, sync_direction = 'import', workspace, api_config }) {
    try {
      // Placeholder for external tool integration
      const syncResult = `External tool sync initiated:\n\n- **Tool**: ${tool_type}\n- **Direction**: ${sync_direction}\n- **Workspace**: ${workspace}\n- **Status**: Configuration required\n\nTo complete setup:\n1. Configure API credentials\n2. Set up webhook endpoints\n3. Test connection\n4. Enable automatic sync`;
      
      return {
        content: [{
          type: 'text',
          text: syncResult,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error syncing with ${tool_type}: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Collaboration MCP server running on stdio');
  }
}

const server = new CollaborationServer();
server.run().catch(console.error);

