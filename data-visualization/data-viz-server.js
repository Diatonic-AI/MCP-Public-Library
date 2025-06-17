#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');

class DataVisualizationServer {
  constructor() {
    this.server = new Server(
      {
        name: 'data-visualization-server',
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
          name: 'create_mermaid_chart',
          description: 'Create Mermaid diagrams and charts',
          inputSchema: {
            type: 'object',
            properties: {
              chart_type: {
                type: 'string',
                enum: ['flowchart', 'sequence', 'gantt', 'pie', 'class', 'state', 'journey', 'gitgraph'],
                description: 'Type of Mermaid chart to create',
              },
              title: {
                type: 'string',
                description: 'Title for the chart',
              },
              data: {
                type: 'object',
                description: 'Data for the chart (structure depends on chart type)',
              },
              style: {
                type: 'string',
                enum: ['default', 'forest', 'dark', 'neutral'],
                description: 'Visual style for the chart',
                default: 'default',
              },
              save_to_file: {
                type: 'boolean',
                description: 'Save chart to a markdown file',
                default: true,
              },
              file_name: {
                type: 'string',
                description: 'Custom filename for the chart file',
              },
            },
            required: ['chart_type', 'data'],
          },
        },
        {
          name: 'create_data_table',
          description: 'Create formatted data tables with sorting and filtering',
          inputSchema: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { type: 'object' },
                description: 'Array of data objects for the table',
              },
              columns: {
                type: 'array',
                items: { type: 'string' },
                description: 'Column headers for the table',
              },
              title: {
                type: 'string',
                description: 'Title for the table',
              },
              sort_column: {
                type: 'string',
                description: 'Column to sort by',
              },
              sort_order: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: 'Sort order',
                default: 'asc',
              },
              format: {
                type: 'string',
                enum: ['markdown', 'html', 'csv'],
                description: 'Output format for the table',
                default: 'markdown',
              },
              save_to_file: {
                type: 'boolean',
                description: 'Save table to a file',
                default: true,
              },
            },
            required: ['data', 'columns'],
          },
        },
        {
          name: 'generate_analytics_dashboard',
          description: 'Create comprehensive analytics dashboards with multiple visualizations',
          inputSchema: {
            type: 'object',
            properties: {
              dashboard_title: {
                type: 'string',
                description: 'Title for the dashboard',
              },
              data_sources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    data: { type: 'object' },
                    chart_type: { type: 'string' }
                  },
                  required: ['name', 'data', 'chart_type']
                },
                description: 'Multiple data sources for dashboard components',
              },
              layout: {
                type: 'string',
                enum: ['grid', 'vertical', 'horizontal', 'tabs'],
                description: 'Layout style for dashboard components',
                default: 'grid',
              },
              include_summary: {
                type: 'boolean',
                description: 'Include summary statistics section',
                default: true,
              },
            },
            required: ['dashboard_title', 'data_sources'],
          },
        },
        {
          name: 'create_timeline_visualization',
          description: 'Create timeline visualizations for project tracking',
          inputSchema: {
            type: 'object',
            properties: {
              events: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    status: { type: 'string' }
                  },
                  required: ['date', 'title']
                },
                description: 'Array of timeline events',
              },
              title: {
                type: 'string',
                description: 'Title for the timeline',
              },
              date_range: {
                type: 'object',
                properties: {
                  start: { type: 'string' },
                  end: { type: 'string' }
                },
                description: 'Date range for the timeline',
              },
              group_by: {
                type: 'string',
                enum: ['category', 'status', 'month', 'none'],
                description: 'How to group timeline events',
                default: 'none',
              },
            },
            required: ['events'],
          },
        },
        {
          name: 'create_network_diagram',
          description: 'Create network diagrams for relationships and connections',
          inputSchema: {
            type: 'object',
            properties: {
              nodes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    label: { type: 'string' },
                    type: { type: 'string' },
                    weight: { type: 'number' }
                  },
                  required: ['id', 'label']
                },
                description: 'Array of network nodes',
              },
              edges: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    from: { type: 'string' },
                    to: { type: 'string' },
                    label: { type: 'string' },
                    weight: { type: 'number' }
                  },
                  required: ['from', 'to']
                },
                description: 'Array of network edges/connections',
              },
              title: {
                type: 'string',
                description: 'Title for the network diagram',
              },
              layout: {
                type: 'string',
                enum: ['hierarchical', 'circular', 'force', 'tree'],
                description: 'Layout algorithm for the network',
                default: 'force',
              },
            },
            required: ['nodes', 'edges'],
          },
        },
        {
          name: 'export_chart_data',
          description: 'Export chart data in various formats',
          inputSchema: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                description: 'Chart data to export',
              },
              format: {
                type: 'string',
                enum: ['json', 'csv', 'excel', 'xml'],
                description: 'Export format',
                default: 'json',
              },
              include_metadata: {
                type: 'boolean',
                description: 'Include metadata in export',
                default: true,
              },
              file_name: {
                type: 'string',
                description: 'Name for the exported file',
              },
            },
            required: ['data'],
          },
        },
        {
          name: 'create_comparison_charts',
          description: 'Create side-by-side comparison charts',
          inputSchema: {
            type: 'object',
            properties: {
              datasets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    data: { type: 'object' }
                  },
                  required: ['name', 'data']
                },
                description: 'Multiple datasets to compare',
              },
              comparison_type: {
                type: 'string',
                enum: ['side-by-side', 'overlay', 'difference', 'ratio'],
                description: 'Type of comparison visualization',
                default: 'side-by-side',
              },
              chart_type: {
                type: 'string',
                enum: ['bar', 'line', 'pie', 'area'],
                description: 'Base chart type for comparison',
                default: 'bar',
              },
              title: {
                type: 'string',
                description: 'Title for the comparison chart',
              },
            },
            required: ['datasets'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'create_mermaid_chart':
          return await this.createMermaidChart(request.params.arguments);
        case 'create_data_table':
          return await this.createDataTable(request.params.arguments);
        case 'generate_analytics_dashboard':
          return await this.generateAnalyticsDashboard(request.params.arguments);
        case 'create_timeline_visualization':
          return await this.createTimelineVisualization(request.params.arguments);
        case 'create_network_diagram':
          return await this.createNetworkDiagram(request.params.arguments);
        case 'export_chart_data':
          return await this.exportChartData(request.params.arguments);
        case 'create_comparison_charts':
          return await this.createComparisonCharts(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async createMermaidChart({ chart_type, title, data, style = 'default', save_to_file = true, file_name }) {
    try {
      const mermaidCode = this.generateMermaidCode(chart_type, data, title, style);
      
      const chartContent = `# ${title || 'Chart'}\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\`\n\n---\n*Generated on ${new Date().toISOString().split('T')[0]}*`;
      
      if (save_to_file) {
        const vaultPath = process.env.VAULT_PATH || '.';
        const fileName = file_name || `${chart_type}-chart-${Date.now()}.md`;
        const filePath = path.join(vaultPath, 'visualizations', fileName);
        
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, chartContent);
        
        return {
          content: [{
            type: 'text',
            text: `Mermaid ${chart_type} chart created successfully.\n\nFile: ${fileName}\n\n${chartContent}`,
          }],
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: chartContent,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating chart: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  generateMermaidCode(chartType, data, title, style) {
    switch (chartType) {
      case 'flowchart':
        return this.generateFlowchart(data);
      case 'sequence':
        return this.generateSequenceDiagram(data);
      case 'gantt':
        return this.generateGanttChart(data, title);
      case 'pie':
        return this.generatePieChart(data, title);
      case 'class':
        return this.generateClassDiagram(data);
      case 'state':
        return this.generateStateDiagram(data);
      case 'journey':
        return this.generateJourneyMap(data, title);
      case 'gitgraph':
        return this.generateGitGraph(data);
      default:
        throw new Error(`Unsupported chart type: ${chartType}`);
    }
  }

  generateFlowchart(data) {
    const { nodes = [], edges = [], direction = 'TD' } = data;
    let mermaid = `flowchart ${direction}\n`;
    
    nodes.forEach(node => {
      const shape = node.shape || 'rect';
      const shapeMap = {
        rect: `["${node.label}"]`,
        round: `("${node.label}")`,
        diamond: `{"${node.label}"}`,
        circle: `(("${node.label}"))`
      };
      mermaid += `    ${node.id}${shapeMap[shape] || shapeMap.rect}\n`;
    });
    
    edges.forEach(edge => {
      const arrow = edge.type === 'dotted' ? '-..->' : '-->';
      const label = edge.label ? `|${edge.label}|` : '';
      mermaid += `    ${edge.from} ${arrow}${label} ${edge.to}\n`;
    });
    
    return mermaid;
  }

  generateSequenceDiagram(data) {
    const { participants = [], messages = [] } = data;
    let mermaid = 'sequenceDiagram\n';
    
    participants.forEach(p => {
      mermaid += `    participant ${p.id} as ${p.name}\n`;
    });
    
    messages.forEach(msg => {
      const arrow = msg.type === 'async' ? '->>' : '->';
      mermaid += `    ${msg.from}${arrow}${msg.to}: ${msg.text}\n`;
    });
    
    return mermaid;
  }

  generateGanttChart(data, title) {
    const { tasks = [] } = data;
    let mermaid = `gantt\n    title ${title || 'Project Timeline'}\n    dateFormat  YYYY-MM-DD\n`;
    
    tasks.forEach(task => {
      const status = task.status === 'done' ? 'done, ' : task.status === 'active' ? 'active, ' : '';
      mermaid += `    ${task.name} :${status}${task.id}, ${task.start}, ${task.end}\n`;
    });
    
    return mermaid;
  }

  generatePieChart(data, title) {
    const { values = {} } = data;
    let mermaid = `pie title ${title || 'Distribution'}\n`;
    
    Object.entries(values).forEach(([label, value]) => {
      mermaid += `    "${label}" : ${value}\n`;
    });
    
    return mermaid;
  }

  generateClassDiagram(data) {
    const { classes = [], relationships = [] } = data;
    let mermaid = 'classDiagram\n';
    
    classes.forEach(cls => {
      mermaid += `    class ${cls.name} {\n`;
      if (cls.attributes) {
        cls.attributes.forEach(attr => {
          mermaid += `        ${attr}\n`;
        });
      }
      if (cls.methods) {
        cls.methods.forEach(method => {
          mermaid += `        ${method}\n`;
        });
      }
      mermaid += `    }\n`;
    });
    
    relationships.forEach(rel => {
      const relType = {
        inheritance: '<|--',
        composition: '*--',
        aggregation: 'o--',
        association: '--'
      }[rel.type] || '--';
      mermaid += `    ${rel.from} ${relType} ${rel.to}\n`;
    });
    
    return mermaid;
  }

  generateStateDiagram(data) {
    const { states = [], transitions = [] } = data;
    let mermaid = 'stateDiagram-v2\n';
    
    states.forEach(state => {
      mermaid += `    ${state.id} : ${state.label}\n`;
    });
    
    transitions.forEach(trans => {
      mermaid += `    ${trans.from} --> ${trans.to} : ${trans.trigger}\n`;
    });
    
    return mermaid;
  }

  generateJourneyMap(data, title) {
    const { steps = [], actors = [] } = data;
    let mermaid = `journey\n    title ${title || 'User Journey'}\n`;
    
    steps.forEach(step => {
      mermaid += `    section ${step.section}\n`;
      step.tasks.forEach(task => {
        const score = task.score || 5;
        const actor = task.actor || actors[0] || 'User';
        mermaid += `      ${task.name}: ${score}: ${actor}\n`;
      });
    });
    
    return mermaid;
  }

  generateGitGraph(data) {
    const { commits = [], branches = [] } = data;
    let mermaid = 'gitgraph\n';
    
    branches.forEach(branch => {
      mermaid += `    checkout ${branch.name}\n`;
      const branchCommits = commits.filter(c => c.branch === branch.name);
      branchCommits.forEach(commit => {
        mermaid += `    commit id: "${commit.message}"\n`;
      });
    });
    
    return mermaid;
  }

  async createDataTable({ data, columns, title, sort_column, sort_order = 'asc', format = 'markdown', save_to_file = true }) {
    try {
      // Sort data if specified
      if (sort_column && data.length > 0) {
        data.sort((a, b) => {
          const aVal = a[sort_column];
          const bVal = b[sort_column];
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return sort_order === 'desc' ? -comparison : comparison;
        });
      }
      
      let tableContent = '';
      
      if (format === 'markdown') {
        tableContent = this.generateMarkdownTable(data, columns, title);
      } else if (format === 'html') {
        tableContent = this.generateHTMLTable(data, columns, title);
      } else if (format === 'csv') {
        tableContent = this.generateCSVTable(data, columns);
      }
      
      if (save_to_file) {
        const vaultPath = process.env.VAULT_PATH || '.';
        const fileName = `data-table-${Date.now()}.${format === 'markdown' ? 'md' : format}`;
        const filePath = path.join(vaultPath, 'data-tables', fileName);
        
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, tableContent);
        
        return {
          content: [{
            type: 'text',
            text: `Data table created successfully.\n\nFile: ${fileName}\nRows: ${data.length}\nFormat: ${format}\n\n${format === 'markdown' ? tableContent : 'Table saved to file.'}`,
          }],
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: tableContent,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating table: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  generateMarkdownTable(data, columns, title) {
    let table = title ? `# ${title}\n\n` : '';
    
    // Header
    table += '| ' + columns.join(' | ') + ' |\n';
    table += '|' + columns.map(() => '---').join('|') + '|\n';
    
    // Rows
    data.forEach(row => {
      const values = columns.map(col => row[col] || '');
      table += '| ' + values.join(' | ') + ' |\n';
    });
    
    table += `\n---\n*Table generated on ${new Date().toISOString().split('T')[0]}*`;
    
    return table;
  }

  generateHTMLTable(data, columns, title) {
    let html = title ? `<h1>${title}</h1>\n` : '';
    html += '<table border="1">\n<thead>\n<tr>';
    
    columns.forEach(col => {
      html += `<th>${col}</th>`;
    });
    html += '</tr>\n</thead>\n<tbody>\n';
    
    data.forEach(row => {
      html += '<tr>';
      columns.forEach(col => {
        html += `<td>${row[col] || ''}</td>`;
      });
      html += '</tr>\n';
    });
    
    html += '</tbody>\n</table>';
    return html;
  }

  generateCSVTable(data, columns) {
    let csv = columns.join(',') + '\n';
    
    data.forEach(row => {
      const values = columns.map(col => {
        const value = row[col] || '';
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      });
      csv += values.join(',') + '\n';
    });
    
    return csv;
  }

  async generateAnalyticsDashboard({ dashboard_title, data_sources, layout = 'grid', include_summary = true }) {
    try {
      let dashboard = `# ${dashboard_title}\n\n*Dashboard generated on ${new Date().toISOString().split('T')[0]}*\n\n`;
      
      if (include_summary) {
        dashboard += '## Summary\n\n';
        dashboard += `- **Total Data Sources**: ${data_sources.length}\n`;
        dashboard += `- **Layout**: ${layout}\n`;
        dashboard += `- **Last Updated**: ${new Date().toLocaleString()}\n\n`;
      }
      
      dashboard += '## Visualizations\n\n';
      
      for (let i = 0; i < data_sources.length; i++) {
        const source = data_sources[i];
        dashboard += `### ${source.name}\n\n`;
        
        if (source.chart_type === 'mermaid') {
          const mermaidCode = this.generateMermaidCode(source.data.type, source.data, source.name);
          dashboard += `\`\`\`mermaid\n${mermaidCode}\n\`\`\`\n\n`;
        } else if (source.chart_type === 'table') {
          const tableContent = this.generateMarkdownTable(source.data.rows, source.data.columns, source.name);
          dashboard += tableContent + '\n\n';
        }
        
        if (layout === 'grid' && i % 2 === 1) {
          dashboard += '---\n\n';
        }
      }
      
      const vaultPath = process.env.VAULT_PATH || '.';
      const fileName = `dashboard-${dashboard_title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
      const filePath = path.join(vaultPath, 'dashboards', fileName);
      
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, dashboard);
      
      return {
        content: [{
          type: 'text',
          text: `Analytics dashboard created successfully.\n\nFile: ${fileName}\nComponents: ${data_sources.length}\n\n${dashboard}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating dashboard: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async createTimelineVisualization({ events, title, date_range, group_by = 'none' }) {
    try {
      // Sort events by date
      events.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      let timeline = `# ${title || 'Timeline'}\n\n`;
      
      if (date_range) {
        timeline += `**Period**: ${date_range.start} to ${date_range.end}\n\n`;
      }
      
      if (group_by === 'none') {
        events.forEach(event => {
          timeline += `## ${event.date} - ${event.title}\n\n`;
          if (event.description) {
            timeline += `${event.description}\n\n`;
          }
          if (event.status) {
            timeline += `**Status**: ${event.status}\n\n`;
          }
        });
      } else {
        const grouped = this.groupEvents(events, group_by);
        Object.entries(grouped).forEach(([group, groupEvents]) => {
          timeline += `## ${group}\n\n`;
          groupEvents.forEach(event => {
            timeline += `- **${event.date}**: ${event.title}`;
            if (event.status) timeline += ` (${event.status})`;
            timeline += '\n';
          });
          timeline += '\n';
        });
      }
      
      // Create Mermaid timeline
      timeline += '## Visual Timeline\n\n```mermaid\n';
      timeline += this.generateTimelineMermaid(events);
      timeline += '\n```\n\n';
      
      const vaultPath = process.env.VAULT_PATH || '.';
      const fileName = `timeline-${Date.now()}.md`;
      const filePath = path.join(vaultPath, 'timelines', fileName);
      
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, timeline);
      
      return {
        content: [{
          type: 'text',
          text: `Timeline visualization created successfully.\n\nFile: ${fileName}\nEvents: ${events.length}\n\n${timeline}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating timeline: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  groupEvents(events, groupBy) {
    const grouped = {};
    
    events.forEach(event => {
      let key;
      if (groupBy === 'category') {
        key = event.category || 'Uncategorized';
      } else if (groupBy === 'status') {
        key = event.status || 'Unknown';
      } else if (groupBy === 'month') {
        key = new Date(event.date).toLocaleString('default', { month: 'long', year: 'numeric' });
      }
      
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });
    
    return grouped;
  }

  generateTimelineMermaid(events) {
    let mermaid = 'gantt\n    title Timeline\n    dateFormat YYYY-MM-DD\n';
    
    events.forEach((event, index) => {
      const endDate = events[index + 1] ? events[index + 1].date : event.date;
      mermaid += `    ${event.title} :${event.status === 'completed' ? 'done, ' : ''}event${index}, ${event.date}, ${endDate}\n`;
    });
    
    return mermaid;
  }

  async createNetworkDiagram({ nodes, edges, title, layout = 'force' }) {
    try {
      let diagram = `# ${title || 'Network Diagram'}\n\n`;
      
      // Create Mermaid network diagram
      diagram += '```mermaid\n';
      diagram += 'graph TD\n';
      
      // Add nodes
      nodes.forEach(node => {
        const shape = node.type === 'important' ? `["${node.label}"]` : `("${node.label}")`;
        diagram += `    ${node.id}${shape}\n`;
      });
      
      // Add edges
      edges.forEach(edge => {
        const weight = edge.weight ? `|${edge.weight}|` : '';
        const label = edge.label ? `|${edge.label}|` : weight;
        diagram += `    ${edge.from} --> ${label} ${edge.to}\n`;
      });
      
      diagram += '```\n\n';
      
      // Add network statistics
      diagram += '## Network Statistics\n\n';
      diagram += `- **Nodes**: ${nodes.length}\n`;
      diagram += `- **Edges**: ${edges.length}\n`;
      diagram += `- **Density**: ${(edges.length / (nodes.length * (nodes.length - 1))).toFixed(3)}\n\n`;
      
      const vaultPath = process.env.VAULT_PATH || '.';
      const fileName = `network-diagram-${Date.now()}.md`;
      const filePath = path.join(vaultPath, 'networks', fileName);
      
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, diagram);
      
      return {
        content: [{
          type: 'text',
          text: `Network diagram created successfully.\n\nFile: ${fileName}\nNodes: ${nodes.length}, Edges: ${edges.length}\n\n${diagram}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating network diagram: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async exportChartData({ data, format = 'json', include_metadata = true, file_name }) {
    try {
      let exportContent = '';
      const timestamp = new Date().toISOString();
      
      if (format === 'json') {
        const exportData = include_metadata ? {
          metadata: {
            exported: timestamp,
            format: 'json'
          },
          data: data
        } : data;
        exportContent = JSON.stringify(exportData, null, 2);
      } else if (format === 'csv') {
        // Convert object data to CSV
        if (Array.isArray(data)) {
          const headers = Object.keys(data[0] || {});
          exportContent = this.generateCSVTable(data, headers);
        }
      } else if (format === 'xml') {
        exportContent = this.convertToXML(data, include_metadata);
      }
      
      const vaultPath = process.env.VAULT_PATH || '.';
      const fileName = file_name || `chart-data-export-${Date.now()}.${format}`;
      const filePath = path.join(vaultPath, 'exports', fileName);
      
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, exportContent);
      
      return {
        content: [{
          type: 'text',
          text: `Chart data exported successfully.\n\nFile: ${fileName}\nFormat: ${format}\nSize: ${exportContent.length} characters`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error exporting data: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  convertToXML(data, includeMetadata) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<chartData>\n';
    
    if (includeMetadata) {
      xml += `  <metadata>\n    <exported>${new Date().toISOString()}</exported>\n    <format>xml</format>\n  </metadata>\n`;
    }
    
    xml += '  <data>\n';
    xml += this.objectToXML(data, '    ');
    xml += '  </data>\n</chartData>';
    
    return xml;
  }

  objectToXML(obj, indent = '') {
    let xml = '';
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        xml += `${indent}<item index="${index}">\n`;
        xml += this.objectToXML(item, indent + '  ');
        xml += `${indent}</item>\n`;
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        xml += `${indent}<${key}>`;
        if (typeof value === 'object') {
          xml += '\n';
          xml += this.objectToXML(value, indent + '  ');
          xml += `${indent}</${key}>\n`;
        } else {
          xml += `${value}</${key}>\n`;
        }
      });
    } else {
      xml += `${indent}${obj}\n`;
    }
    
    return xml;
  }

  async createComparisonCharts({ datasets, comparison_type = 'side-by-side', chart_type = 'bar', title }) {
    try {
      let comparison = `# ${title || 'Data Comparison'}\n\n`;
      
      comparison += `**Comparison Type**: ${comparison_type}\n`;
      comparison += `**Chart Type**: ${chart_type}\n`;
      comparison += `**Datasets**: ${datasets.length}\n\n`;
      
      if (comparison_type === 'side-by-side') {
        datasets.forEach(dataset => {
          comparison += `## ${dataset.name}\n\n`;
          if (chart_type === 'pie') {
            comparison += '```mermaid\n';
            comparison += this.generatePieChart(dataset.data, dataset.name);
            comparison += '\n```\n\n';
          } else {
            // Create table representation for other chart types
            const tableData = Object.entries(dataset.data.values || {}).map(([key, value]) => ({key, value}));
            comparison += this.generateMarkdownTable(tableData, ['key', 'value'], null);
            comparison += '\n\n';
          }
        });
      } else if (comparison_type === 'overlay') {
        comparison += '## Combined View\n\n';
        comparison += '| Category | ' + datasets.map(d => d.name).join(' | ') + ' |\n';
        comparison += '|---|' + datasets.map(() => '---').join('|') + '|\n';
        
        // Assume all datasets have similar structure
        const allKeys = new Set();
        datasets.forEach(d => Object.keys(d.data.values || {}).forEach(k => allKeys.add(k)));
        
        Array.from(allKeys).forEach(key => {
          const row = [key, ...datasets.map(d => d.data.values?.[key] || 0)];
          comparison += '| ' + row.join(' | ') + ' |\n';
        });
        comparison += '\n';
      }
      
      const vaultPath = process.env.VAULT_PATH || '.';
      const fileName = `comparison-chart-${Date.now()}.md`;
      const filePath = path.join(vaultPath, 'comparisons', fileName);
      
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, comparison);
      
      return {
        content: [{
          type: 'text',
          text: `Comparison chart created successfully.\n\nFile: ${fileName}\nDatasets: ${datasets.length}\n\n${comparison}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating comparison: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Data Visualization MCP server running on stdio');
  }
}

const server = new DataVisualizationServer();
server.run().catch(console.error);

