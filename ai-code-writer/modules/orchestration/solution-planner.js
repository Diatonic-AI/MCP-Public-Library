/**
 * Solution Planner Module
 * Provides comprehensive multi-idea reasoning and logical solution planning
 * Uses AI-powered analysis for optimal solution design
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Logger = require('../../utils/logger');
const ResponseFormatter = require('../../utils/response-formatter');

class SolutionPlanner {
  constructor() {
    this.logger = new Logger('SolutionPlanner');
    this.responseFormatter = new ResponseFormatter();
    this.genAI = null;
    this.model = null;
    this.initializeAI();
  }

  initializeAI() {
    if (process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    }
  }

  getTools() {
    return [
      {
        name: 'generate_solution_plan',
        description: 'Create detailed solution plan with steps and tool chains',
        inputSchema: {
          type: 'object',
          properties: {
            problem_analysis: { 
              type: 'object',
              description: 'Analyzed problem data from problem analyzer'
            },
            available_tools: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'List of available tools and technologies'
            },
            constraints: { 
              type: 'object',
              description: 'Project constraints (time, budget, tech stack)'
            },
            preferences: {
              type: 'object',
              description: 'User preferences for solution approach'
            },
            target_platform: {
              type: 'string',
              description: 'Target deployment platform',
              default: 'node.js'
            }
          },
          required: ['problem_analysis']
        }
      }
    ];
  }

  async generateSolutionPlan(args) {
    try {
      const { 
        problem_analysis, 
        available_tools = [], 
        constraints = {},
        preferences = {},
        target_platform = 'node.js'
      } = args;

      this.logger.info('Generating comprehensive solution plan...');

      // Generate multiple solution concepts
      const solutionConcepts = await this.generateSolutionConcepts(problem_analysis, target_platform);
      
      // Evaluate and rank solutions
      const rankedSolutions = this.evaluateAndRankSolutions(solutionConcepts, constraints, preferences);
      
      // Select optimal solution
      const optimalSolution = this.selectOptimalSolution(rankedSolutions);
      
      // Create detailed implementation plan
      const implementationPlan = await this.createDetailedImplementationPlan(optimalSolution, problem_analysis);
      
      // Build tool chain and workflow
      const toolChain = this.buildComprehensiveToolChain(available_tools, optimalSolution, constraints);
      
      // Generate testing strategy
      const testingStrategy = this.generateTestingStrategy(optimalSolution);
      
      // Create deployment plan
      const deploymentPlan = this.createDeploymentPlan(optimalSolution, target_platform);
      
      // Risk analysis and mitigation
      const riskAnalysis = this.analyzeRisksAndMitigation(optimalSolution, constraints);

      const comprehensivePlan = {
        plan_id: this.generatePlanId(),
        timestamp: new Date().toISOString(),
        problem_summary: {
          description: problem_analysis.problem_description,
          domain: problem_analysis.domain || 'general',
          complexity: this.assessComplexity(problem_analysis)
        },
        solution_concepts: solutionConcepts,
        ranked_solutions: rankedSolutions,
        optimal_solution: optimalSolution,
        implementation_plan: implementationPlan,
        tool_chain: toolChain,
        testing_strategy: testingStrategy,
        deployment_plan: deploymentPlan,
        risk_analysis: riskAnalysis,
        success_criteria: this.defineSuccessCriteria(problem_analysis, optimalSolution),
        timeline_estimation: this.estimateTimeline(implementationPlan),
        resource_requirements: this.calculateResourceRequirements(optimalSolution),
        quality_assurance: this.defineQualityAssurance(optimalSolution)
      };

      this.logger.info('Comprehensive solution plan generated successfully');
      
      return this.responseFormatter.formatResponse(comprehensivePlan, {
        type: 'text',
        prettify: true
      });
    } catch (error) {
      this.logger.error('Solution planning failed:', error.message);
      return this.generateFallbackPlan(args);
    }
  }

  async generateSolutionConcepts(problem_analysis, target_platform) {
    this.logger.info('Generating multiple solution concepts...');
    
    const concepts = [];
    const baseApproaches = problem_analysis.analysis?.solution_approaches || [];
    
    // Generate enhanced concepts based on analysis
    for (let i = 0; i < baseApproaches.length; i++) {
      const approach = baseApproaches[i];
      const concept = {
        id: `concept_${i + 1}`,
        name: approach.name,
        description: approach.description,
        approach_type: this.categorizeApproach(approach.name),
        technical_details: await this.generateTechnicalDetails(approach, target_platform),
        effort_estimate: this.normalizeEffort(approach.effort),
        risk_level: this.normalizeRisk(approach.risk),
        innovation_score: this.calculateInnovationScore(approach),
        maintainability_score: this.calculateMaintainabilityScore(approach),
        scalability_potential: this.assessScalability(approach),
        technology_stack: this.suggestTechnologyStack(approach, target_platform),
        architectural_pattern: this.suggestArchitecture(approach),
        pros: this.extractPros(approach),
        cons: this.extractCons(approach)
      };
      concepts.push(concept);
    }
    
    // Generate additional innovative concepts
    const innovativeConcepts = await this.generateInnovativeConcepts(problem_analysis, target_platform);
    concepts.push(...innovativeConcepts);
    
    return concepts;
  }

  async generateTechnicalDetails(approach, platform) {
    if (!this.model) {
      return this.getFallbackTechnicalDetails(approach, platform);
    }

    try {
      const prompt = `
Generate technical implementation details for the following approach:

Approach: ${approach.name}
Description: ${approach.description}
Target Platform: ${platform}

Provide specific technical details including:
1. Core components needed
2. Key algorithms or patterns
3. Data structures
4. Integration points
5. Performance considerations

Respond in JSON format with these fields:
{
  "core_components": [],
  "algorithms_patterns": [],
  "data_structures": [],
  "integration_points": [],
  "performance_considerations": []
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        this.logger.warn('Failed to parse AI technical details, using fallback');
      }
    } catch (error) {
      this.logger.warn('AI technical details generation failed, using fallback');
    }
    
    return this.getFallbackTechnicalDetails(approach, platform);
  }

  getFallbackTechnicalDetails(approach, platform) {
    return {
      core_components: ['main module', 'configuration manager', 'error handler'],
      algorithms_patterns: ['modular design', 'error handling pattern'],
      data_structures: ['objects', 'arrays', 'maps'],
      integration_points: ['API endpoints', 'database connections'],
      performance_considerations: ['memory usage', 'response time', 'error handling']
    };
  }

  evaluateAndRankSolutions(concepts, constraints, preferences) {
    this.logger.info('Evaluating and ranking solutions...');
    
    const scoredConcepts = concepts.map(concept => {
      const scores = {
        feasibility: this.scoreFeasibility(concept, constraints),
        effort_efficiency: this.scoreEffortEfficiency(concept),
        risk_mitigation: this.scoreRiskMitigation(concept),
        innovation: concept.innovation_score || 0.5,
        maintainability: concept.maintainability_score || 0.7,
        scalability: concept.scalability_potential || 0.6,
        preference_alignment: this.scorePreferenceAlignment(concept, preferences)
      };
      
      const weightedScore = this.calculateWeightedScore(scores, constraints);
      
      return {
        ...concept,
        evaluation_scores: scores,
        overall_score: weightedScore,
        rank: 0 // Will be set after sorting
      };
    });
    
    // Sort by overall score and assign ranks
    const ranked = scoredConcepts.sort((a, b) => b.overall_score - a.overall_score);
    ranked.forEach((concept, index) => {
      concept.rank = index + 1;
    });
    
    return ranked;
  }

  selectOptimalSolution(rankedSolutions) {
    this.logger.info('Selecting optimal solution...');
    
    // Select the highest-ranked solution that meets minimum criteria
    const optimalSolution = rankedSolutions.find(solution => 
      solution.overall_score > 0.6 && 
      solution.evaluation_scores.feasibility > 0.7
    ) || rankedSolutions[0];
    
    return {
      ...optimalSolution,
      selection_reason: this.explainSelection(optimalSolution, rankedSolutions)
    };
  }

  async createDetailedImplementationPlan(solution, problem_analysis) {
    this.logger.info('Creating detailed implementation plan...');
    
    const phases = [
      {
        name: 'Planning & Setup',
        duration: '1-2 days',
        tasks: [
          'Environment setup',
          'Project structure creation',
          'Dependency management',
          'Initial configuration'
        ]
      },
      {
        name: 'Core Development',
        duration: this.estimateDevelopmentTime(solution),
        tasks: [
          'Core functionality implementation',
          'API/interface development',
          'Data handling implementation',
          'Error handling integration'
        ]
      },
      {
        name: 'Testing & Validation',
        duration: '1-3 days',
        tasks: [
          'Unit test development',
          'Integration testing',
          'Performance testing',
          'Security validation'
        ]
      },
      {
        name: 'Documentation & Deployment',
        duration: '0.5-1 day',
        tasks: [
          'Code documentation',
          'User documentation',
          'Deployment configuration',
          'Production validation'
        ]
      }
    ];
    
    return {
      phases,
      total_estimated_duration: this.calculateTotalDuration(phases),
      critical_path: this.identifyCriticalPath(phases),
      dependencies: this.extractDependencies(solution),
      milestones: this.defineMilestones(phases),
      deliverables: this.defineDeliverables(solution)
    };
  }

  buildComprehensiveToolChain(availableTools, solution, constraints) {
    this.logger.info('Building comprehensive tool chain...');
    
    const requiredTools = {
      development: ['Node.js', 'npm/yarn', 'git'],
      testing: ['jest', 'mocha', 'chai'],
      linting: ['eslint', 'prettier'],
      monitoring: ['winston', 'debug'],
      security: ['helmet', 'joi'],
      performance: ['clinic', 'autocannon']
    };
    
    const toolChain = Object.keys(requiredTools).map(category => ({
      category,
      tools: requiredTools[category].map(tool => ({
        name: tool,
        available: availableTools.includes(tool),
        required: true,
        purpose: this.getToolPurpose(tool),
        installation_command: this.getInstallationCommand(tool)
      }))
    }));
    
    return {
      categories: toolChain,
      setup_order: this.determineSetupOrder(toolChain),
      configuration_files: this.generateConfigurationFiles(solution),
      scripts: this.generateBuildScripts(solution)
    };
  }

  generateTestingStrategy(solution) {
    return {
      test_levels: [
        {
          level: 'Unit Testing',
          coverage_target: '90%',
          frameworks: ['Jest'],
          focus_areas: ['core functions', 'utilities', 'data processing']
        },
        {
          level: 'Integration Testing',
          coverage_target: '80%',
          frameworks: ['Jest', 'Supertest'],
          focus_areas: ['API endpoints', 'database interactions', 'external services']
        },
        {
          level: 'End-to-End Testing',
          coverage_target: '70%',
          frameworks: ['Playwright', 'Cypress'],
          focus_areas: ['user workflows', 'system integration']
        }
      ],
      test_data_strategy: 'Mock data with realistic scenarios',
      performance_testing: {
        load_testing: true,
        stress_testing: true,
        tools: ['autocannon', 'artillery']
      },
      security_testing: {
        vulnerability_scanning: true,
        penetration_testing: false,
        tools: ['snyk', 'audit']
      }
    };
  }

  createDeploymentPlan(solution, platform) {
    return {
      environment_strategy: {
        development: 'Local development with hot reload',
        staging: 'Docker containerized staging environment',
        production: 'Cloud deployment with monitoring'
      },
      deployment_method: 'CI/CD pipeline',
      infrastructure: {
        platform: platform,
        containerization: 'Docker',
        orchestration: 'Docker Compose',
        monitoring: 'Winston + custom metrics'
      },
      rollback_strategy: 'Version-based rollback with database migration safety',
      health_checks: [
        'Service health endpoint',
        'Database connectivity',
        'External service availability'
      ]
    };
  }

  analyzeRisksAndMitigation(solution, constraints) {
    const risks = [
      {
        risk: 'Implementation complexity higher than estimated',
        probability: 'Medium',
        impact: 'High',
        mitigation: 'Break down into smaller modules, frequent testing'
      },
      {
        risk: 'Performance bottlenecks',
        probability: 'Low',
        impact: 'Medium',
        mitigation: 'Performance testing, code profiling, optimization'
      },
      {
        risk: 'Integration challenges',
        probability: 'Medium',
        impact: 'Medium',
        mitigation: 'Early integration testing, mock services'
      }
    ];
    
    return {
      identified_risks: risks,
      overall_risk_level: this.calculateOverallRisk(risks),
      mitigation_strategy: 'Proactive monitoring and iterative development',
      contingency_plans: this.generateContingencyPlans(risks)
    };
  }

  // Helper methods
  categorizeApproach(name) {
    const categories = {
      'basic': ['simple', 'basic', 'minimal'],
      'advanced': ['advanced', 'complex', 'comprehensive'],
      'middleware': ['middleware', 'plugin', 'extension']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => name.toLowerCase().includes(keyword))) {
        return category;
      }
    }
    return 'custom';
  }

  normalizeEffort(effort) {
    const effortMap = {
      'low': 0.3,
      'medium': 0.6,
      'high': 0.9
    };
    return effortMap[effort?.toLowerCase()] || 0.5;
  }

  normalizeRisk(risk) {
    const riskMap = {
      'low': 0.2,
      'medium': 0.5,
      'high': 0.8
    };
    return riskMap[risk?.toLowerCase()] || 0.5;
  }

  calculateInnovationScore(approach) {
    return approach.name.includes('innovative') || approach.name.includes('advanced') ? 0.8 : 0.5;
  }

  calculateMaintainabilityScore(approach) {
    return approach.description.includes('modular') || approach.description.includes('clean') ? 0.8 : 0.6;
  }

  assessScalability(approach) {
    return approach.description.includes('scalable') || approach.description.includes('distributed') ? 0.8 : 0.6;
  }

  suggestTechnologyStack(approach, platform) {
    const baseStack = ['Node.js', 'Express.js'];
    
    if (approach.description.includes('database')) {
      baseStack.push('MongoDB', 'Mongoose');
    }
    if (approach.description.includes('api')) {
      baseStack.push('Swagger', 'Joi');
    }
    if (approach.description.includes('test')) {
      baseStack.push('Jest', 'Supertest');
    }
    
    return baseStack;
  }

  suggestArchitecture(approach) {
    if (approach.description.includes('middleware')) return 'Middleware Pattern';
    if (approach.description.includes('modular')) return 'Modular Architecture';
    if (approach.description.includes('service')) return 'Service-Oriented Architecture';
    return 'Layered Architecture';
  }

  extractPros(approach) {
    const commonPros = {
      'simple': ['Easy to implement', 'Quick to deploy', 'Low complexity'],
      'advanced': ['Feature-rich', 'Highly configurable', 'Enterprise-ready'],
      'middleware': ['Reusable', 'Modular', 'Easy to maintain']
    };
    
    const category = this.categorizeApproach(approach.name);
    return commonPros[category] || ['Tailored solution', 'Meets requirements'];
  }

  extractCons(approach) {
    const commonCons = {
      'simple': ['Limited features', 'May need extension'],
      'advanced': ['Higher complexity', 'Longer development time'],
      'middleware': ['Dependency on framework', 'May be overkill']
    };
    
    const category = this.categorizeApproach(approach.name);
    return commonCons[category] || ['Requires custom development'];
  }

  async generateInnovativeConcepts(problem_analysis, platform) {
    // Generate additional innovative concepts
    return [
      {
        id: 'innovative_1',
        name: 'AI-Enhanced Solution',
        description: 'Leverage AI for intelligent decision making and optimization',
        approach_type: 'innovative',
        technical_details: {
          core_components: ['AI decision engine', 'learning module', 'optimization algorithm'],
          algorithms_patterns: ['machine learning', 'decision trees', 'adaptive algorithms'],
          data_structures: ['neural networks', 'decision matrices', 'optimization graphs']
        },
        effort_estimate: 0.8,
        risk_level: 0.6,
        innovation_score: 0.9,
        maintainability_score: 0.7,
        scalability_potential: 0.9
      }
    ];
  }

  // Scoring methods
  scoreFeasibility(concept, constraints) {
    let score = 0.8; // Base feasibility
    
    if (constraints.timeline === 'urgent' && concept.effort_estimate > 0.7) score -= 0.3;
    if (constraints.budget === 'limited' && concept.effort_estimate > 0.6) score -= 0.2;
    if (constraints.team_size === 'small' && concept.innovation_score > 0.8) score -= 0.2;
    
    return Math.max(score, 0.1);
  }

  scoreEffortEfficiency(concept) {
    return 1 - concept.effort_estimate; // Lower effort = higher efficiency
  }

  scoreRiskMitigation(concept) {
    return 1 - concept.risk_level; // Lower risk = higher score
  }

  scorePreferenceAlignment(concept, preferences) {
    let score = 0.5;
    
    if (preferences.prefer_simple && concept.approach_type === 'basic') score += 0.3;
    if (preferences.prefer_innovative && concept.innovation_score > 0.7) score += 0.3;
    if (preferences.prefer_proven && concept.risk_level < 0.4) score += 0.2;
    
    return Math.min(score, 1.0);
  }

  calculateWeightedScore(scores, constraints) {
    const weights = {
      feasibility: 0.25,
      effort_efficiency: 0.2,
      risk_mitigation: 0.2,
      innovation: 0.1,
      maintainability: 0.15,
      scalability: 0.1
    };
    
    // Adjust weights based on constraints
    if (constraints.timeline === 'urgent') {
      weights.effort_efficiency += 0.1;
      weights.innovation -= 0.1;
    }
    
    return Object.keys(scores).reduce((total, key) => {
      return total + (scores[key] * (weights[key] || 0));
    }, 0);
  }

  explainSelection(optimal, alternatives) {
    return `Selected for optimal balance of feasibility (${optimal.evaluation_scores.feasibility.toFixed(2)}), ` +
           `efficiency (${optimal.evaluation_scores.effort_efficiency.toFixed(2)}), ` +
           `and risk mitigation (${optimal.evaluation_scores.risk_mitigation.toFixed(2)}). ` +
           `Overall score: ${optimal.overall_score.toFixed(2)}.`;
  }

  assessComplexity(problem_analysis) {
    const description = problem_analysis.problem_description?.toLowerCase() || '';
    
    if (description.includes('simple') || description.includes('basic')) return 'Low';
    if (description.includes('complex') || description.includes('advanced')) return 'High';
    return 'Medium';
  }

  defineSuccessCriteria(problem_analysis, solution) {
    return {
      functional: [
        'All requirements implemented and tested',
        'Solution performs as specified',
        'Error handling covers edge cases'
      ],
      technical: [
        'Code quality meets standards',
        'Performance benchmarks achieved',
        'Security requirements satisfied'
      ],
      business: [
        'Delivery within timeline',
        'Budget constraints maintained',
        'Stakeholder approval obtained'
      ]
    };
  }

  estimateTimeline(implementationPlan) {
    const totalDays = implementationPlan.phases?.reduce((total, phase) => {
      const days = parseFloat(phase.duration?.match(/\d+/)?.[0] || '1');
      return total + days;
    }, 0) || 5;
    
    return {
      estimated_duration: `${totalDays} days`,
      buffer_time: `${Math.ceil(totalDays * 0.2)} days`,
      total_with_buffer: `${totalDays + Math.ceil(totalDays * 0.2)} days`
    };
  }

  calculateResourceRequirements(solution) {
    return {
      human_resources: {
        developers: 1,
        testers: 0.5,
        reviewers: 0.5
      },
      technical_resources: {
        development_environment: 'Standard developer machine',
        testing_environment: 'Local or staging server',
        deployment_environment: 'Cloud or local server'
      },
      external_dependencies: solution.technology_stack || []
    };
  }

  defineQualityAssurance(solution) {
    return {
      code_review_process: 'Peer review for all changes',
      testing_requirements: 'Minimum 80% test coverage',
      documentation_standards: 'Inline comments and README documentation',
      performance_criteria: 'Response time under 100ms for core operations',
      security_checklist: [
        'Input validation',
        'Error handling',
        'Secure configurations'
      ]
    };
  }

  generatePlanId() {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  estimateDevelopmentTime(solution) {
    const baseTime = solution.effort_estimate * 5; // 5 days max
    return `${Math.max(1, Math.ceil(baseTime))}-${Math.ceil(baseTime * 1.5)} days`;
  }

  calculateTotalDuration(phases) {
    const total = phases.reduce((acc, phase) => {
      const duration = parseFloat(phase.duration.match(/\d+/)?.[0] || '1');
      return acc + duration;
    }, 0);
    return `${total}-${Math.ceil(total * 1.2)} days`;
  }

  identifyCriticalPath(phases) {
    return phases.map(phase => phase.name).join(' → ');
  }

  extractDependencies(solution) {
    return solution.technology_stack || ['Node.js', 'npm'];
  }

  defineMilestones(phases) {
    return phases.map((phase, index) => ({
      milestone: `${phase.name} Complete`,
      deliverable: `Phase ${index + 1} artifacts`,
      success_criteria: 'All phase tasks completed and reviewed'
    }));
  }

  defineDeliverables(solution) {
    return [
      'Source code repository',
      'Documentation (README, API docs)',
      'Test suite with coverage report',
      'Deployment configuration',
      'User guide and examples'
    ];
  }

  getToolPurpose(tool) {
    const purposes = {
      'Node.js': 'Runtime environment',
      'npm': 'Package management',
      'jest': 'Testing framework',
      'eslint': 'Code linting',
      'prettier': 'Code formatting',
      'winston': 'Logging',
      'git': 'Version control'
    };
    return purposes[tool] || 'Development tool';
  }

  getInstallationCommand(tool) {
    const commands = {
      'Node.js': 'Download from nodejs.org',
      'npm': 'Included with Node.js',
      'jest': 'npm install --save-dev jest',
      'eslint': 'npm install --save-dev eslint',
      'prettier': 'npm install --save-dev prettier',
      'winston': 'npm install winston'
    };
    return commands[tool] || `npm install ${tool}`;
  }

  determineSetupOrder(toolChain) {
    return [
      'Install Node.js and npm',
      'Initialize project with package.json',
      'Install development dependencies',
      'Configure linting and formatting',
      'Set up testing framework',
      'Configure logging and monitoring'
    ];
  }

  generateConfigurationFiles(solution) {
    return [
      {
        file: 'package.json',
        purpose: 'Project configuration and dependencies'
      },
      {
        file: '.eslintrc.js',
        purpose: 'Code linting rules'
      },
      {
        file: 'jest.config.js',
        purpose: 'Testing configuration'
      },
      {
        file: '.gitignore',
        purpose: 'Version control exclusions'
      }
    ];
  }

  generateBuildScripts(solution) {
    return {
      'start': 'node src/index.js',
      'dev': 'nodemon src/index.js',
      'test': 'jest',
      'test:watch': 'jest --watch',
      'test:coverage': 'jest --coverage',
      'lint': 'eslint src/',
      'lint:fix': 'eslint src/ --fix',
      'format': 'prettier --write src/'
    };
  }

  calculateOverallRisk(risks) {
    const riskScores = risks.map(risk => {
      const probability = { 'Low': 0.2, 'Medium': 0.5, 'High': 0.8 }[risk.probability] || 0.5;
      const impact = { 'Low': 0.2, 'Medium': 0.5, 'High': 0.8 }[risk.impact] || 0.5;
      return probability * impact;
    });
    
    const avgRisk = riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length;
    
    if (avgRisk < 0.3) return 'Low';
    if (avgRisk < 0.6) return 'Medium';
    return 'High';
  }

  generateContingencyPlans(risks) {
    return risks.map(risk => ({
      risk: risk.risk,
      contingency: `If ${risk.risk.toLowerCase()} occurs, implement ${risk.mitigation} immediately and assess project timeline impact.`
    }));
  }

  generateFallbackPlan(args) {
    this.logger.warn('Generating fallback solution plan');
    
    const fallbackPlan = {
      plan_id: this.generatePlanId(),
      timestamp: new Date().toISOString(),
      problem_summary: {
        description: args.problem_analysis?.problem_description || 'Unknown problem',
        complexity: 'Medium'
      },
      fallback_plan: {
        approach: 'Standard Implementation',
        phases: [
          { name: 'Analysis', duration: '1 day' },
          { name: 'Development', duration: '3-5 days' },
          { name: 'Testing', duration: '1-2 days' },
          { name: 'Deployment', duration: '0.5 day' }
        ],
        technology_stack: ['Node.js', 'Express', 'Jest'],
        estimated_timeline: '5-8 days'
      },
      note: 'This is a fallback plan. Full AI-powered planning was not available.'
    };

    return this.responseFormatter.formatResponse(fallbackPlan, {
      type: 'text',
      prettify: true
    });
  }
}

module.exports = SolutionPlanner;
