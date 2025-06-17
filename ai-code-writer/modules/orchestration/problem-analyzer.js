/**
 * Problem Analyzer Module
 * AI-powered problem analysis and solution generation
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Logger = require('../../utils/logger');
const ResponseFormatter = require('../../utils/response-formatter');

class ProblemAnalyzer {
  constructor() {
    this.logger = new Logger('ProblemAnalyzer');
    this.responseFormatter = new ResponseFormatter();
  }

  getTools() {
    return [
      {
        name: 'analyze_problem',
        description: 'AI-powered problem analysis and solution generation',
        inputSchema: {
          type: 'object',
          properties: {
            problem_description: {
              type: 'string',
              description: 'Description of the problem to analyze'
            },
            context: {
              type: 'object',
              description: 'Additional context about the problem'
            },
            analysis_depth: {
              type: 'string',
              enum: ['quick', 'detailed', 'comprehensive'],
              default: 'detailed',
              description: 'Level of analysis to perform'
            }
          },
          required: ['problem_description']
        }
      }
    ];
  }

  async analyzeProblem(args) {
    try {
      const { problem_description, context = {}, analysis_depth = 'detailed' } = args;
      
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('Gemini AI not configured. Please load environment first.');
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

      const prompt = this.buildAnalysisPrompt(problem_description, context, analysis_depth);
      
      this.logger.info(`Analyzing problem with ${analysis_depth} depth`);
      const result = await model.generateContent(prompt);
      const analysis = result.response.text();

      // Parse the AI response into structured data
      const structuredAnalysis = this.parseAnalysisResponse(analysis);

      const analysisResult = {
        problem_description,
        analysis_depth,
        analysis: structuredAnalysis,
        context,
        timestamp: new Date().toISOString()
      };

      return this.responseFormatter.formatResponse(analysisResult, {
        type: 'text',
        prettify: true
      });
    } catch (error) {
      this.logger.error('Problem analysis failed:', error.message);
      throw new Error(`Problem analysis failed: ${error.message}`);
    }
  }

  buildAnalysisPrompt(problem, context, depth) {
    const depthInstructions = {
      quick: 'Provide a brief analysis with key points and immediate solutions.',
      detailed: 'Provide a thorough analysis with root causes, impacts, and multiple solution approaches.',
      comprehensive: 'Provide an exhaustive analysis including root causes, impacts, dependencies, risks, multiple solution approaches, implementation strategies, and success metrics.'
    };

    return `
You are an expert problem analyst. Analyze the following problem and provide insights.

PROBLEM DESCRIPTION:
${problem}

CONTEXT:
${JSON.stringify(context, null, 2)}

ANALYSIS REQUIREMENTS:
${depthInstructions[depth]}

Please structure your response as JSON with the following format:
{
  "problem_type": "classification of the problem",
  "root_causes": ["list of root causes"],
  "impact_assessment": {
    "severity": "low|medium|high|critical",
    "scope": "description of impact scope",
    "urgency": "low|medium|high|critical"
  },
  "dependencies": ["list of dependencies or prerequisites"],
  "constraints": ["list of constraints or limitations"],
  "solution_approaches": [
    {
      "name": "solution name",
      "description": "detailed description",
      "effort": "low|medium|high",
      "risk": "low|medium|high",
      "timeline": "estimated timeline"
    }
  ],
  "recommended_approach": "name of recommended solution",
  "next_steps": ["list of immediate next steps"],
  "success_metrics": ["how to measure success"]
}

Provide ONLY the JSON response, no additional text.
`;
  }

  parseAnalysisResponse(response) {
    try {
      // Clean up the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback: return structured response with raw text
      return {
        problem_type: 'unknown',
        root_causes: ['Analysis parsing failed'],
        impact_assessment: {
          severity: 'medium',
          scope: 'Unknown scope',
          urgency: 'medium'
        },
        dependencies: [],
        constraints: [],
        solution_approaches: [{
          name: 'Manual Review Required',
          description: 'The AI analysis could not be parsed automatically',
          effort: 'medium',
          risk: 'low',
          timeline: 'immediate'
        }],
        recommended_approach: 'Manual Review Required',
        next_steps: ['Review the raw AI response', 'Perform manual analysis'],
        success_metrics: ['Problem is understood and actionable plan is created'],
        raw_response: response
      };
    } catch (error) {
      this.logger.error('Failed to parse analysis response:', error.message);
      throw new Error('Failed to parse AI analysis response');
    }
  }
}

module.exports = ProblemAnalyzer;

