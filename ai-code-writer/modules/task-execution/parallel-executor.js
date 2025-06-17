/**
 * Parallel Executor Module
 * Execute multiple tasks in parallel with coordination
 */

const Logger = require('../../utils/logger');

class ParallelExecutor {
  constructor() {
    this.logger = new Logger('ParallelExecutor');
    this.activeTasks = new Map();
    this.taskResults = new Map();
  }

  getTools() {
    return [
      {
        name: 'parallel_task_executor',
        description: 'Execute multiple tasks in parallel with coordination',
        inputSchema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  parameters: { type: 'object' },
                  dependencies: { type: 'array', items: { type: 'string' } }
                }
              },
              description: 'Array of tasks to execute'
            },
            max_concurrent: {
              type: 'number',
              default: 5,
              description: 'Maximum number of concurrent tasks'
            },
            dependency_resolution: {
              type: 'boolean',
              default: true,
              description: 'Automatically resolve task dependencies'
            }
          },
          required: ['tasks']
        }
      }
    ];
  }

  async parallelTaskExecutor(args) {
    try {
      const { tasks, max_concurrent = 5, dependency_resolution = true } = args;
      
      this.logger.info(`Starting parallel execution of ${tasks.length} tasks`);
      
      const execution = {
        id: this.generateExecutionId(),
        start_time: new Date().toISOString(),
        tasks: tasks,
        max_concurrent,
        dependency_resolution,
        status: 'running',
        results: []
      };
      
      // Resolve dependencies if enabled
      const sortedTasks = dependency_resolution ? 
        this.resolveDependencies(tasks) : tasks;
      
      // Execute tasks
      const results = await this.executeTasks(sortedTasks, max_concurrent, execution.id);
      
      execution.end_time = new Date().toISOString();
      execution.status = 'completed';
      execution.results = results;
      execution.duration = Date.parse(execution.end_time) - Date.parse(execution.start_time);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(execution, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error('Parallel execution failed:', error.message);
      throw new Error(`Parallel execution failed: ${error.message}`);
    }
  }

  resolveDependencies(tasks) {
    // Simple topological sort for dependency resolution
    const taskMap = new Map(tasks.map(task => [task.id, task]));
    const visited = new Set();
    const visiting = new Set();
    const sorted = [];
    
    const visit = (taskId) => {
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected involving task: ${taskId}`);
      }
      if (visited.has(taskId)) {
        return;
      }
      
      visiting.add(taskId);
      const task = taskMap.get(taskId);
      
      if (task && task.dependencies) {
        for (const depId of task.dependencies) {
          if (taskMap.has(depId)) {
            visit(depId);
          }
        }
      }
      
      visiting.delete(taskId);
      visited.add(taskId);
      if (task) {
        sorted.push(task);
      }
    };
    
    for (const task of tasks) {
      visit(task.id);
    }
    
    this.logger.debug(`Dependency resolution complete: ${sorted.map(t => t.id).join(' -> ')}`);
    return sorted;
  }

  async executeTasks(tasks, maxConcurrent, executionId) {
    const results = [];
    const running = new Set();
    let taskIndex = 0;
    
    const executeTask = async (task) => {
      const taskId = `${executionId}-${task.id}`;
      this.activeTasks.set(taskId, {
        ...task,
        start_time: new Date().toISOString(),
        status: 'running'
      });
      
      try {
        this.logger.info(`Executing task: ${task.id} (${task.type})`);
        
        // Simulate task execution - in reality, this would call the appropriate handler
        const result = await this.simulateTaskExecution(task);
        
        const taskResult = {
          task_id: task.id,
          type: task.type,
          status: 'completed',
          start_time: this.activeTasks.get(taskId).start_time,
          end_time: new Date().toISOString(),
          result: result,
          error: null
        };
        
        this.taskResults.set(taskId, taskResult);
        this.activeTasks.delete(taskId);
        
        return taskResult;
      } catch (error) {
        const taskResult = {
          task_id: task.id,
          type: task.type,
          status: 'failed',
          start_time: this.activeTasks.get(taskId).start_time,
          end_time: new Date().toISOString(),
          result: null,
          error: error.message
        };
        
        this.taskResults.set(taskId, taskResult);
        this.activeTasks.delete(taskId);
        
        return taskResult;
      }
    };
    
    // Execute tasks with concurrency control
    while (taskIndex < tasks.length || running.size > 0) {
      // Start new tasks if under the concurrency limit
      while (running.size < maxConcurrent && taskIndex < tasks.length) {
        const task = tasks[taskIndex++];
        
        // Check if dependencies are satisfied
        if (this.areDependenciesSatisfied(task, results)) {
          const promise = executeTask(task);
          running.add(promise);
          
          promise.finally(() => {
            running.delete(promise);
          });
        } else {
          // Put task back and wait
          taskIndex--;
          break;
        }
      }
      
      // Wait for at least one task to complete
      if (running.size > 0) {
        const completed = await Promise.race(running);
        results.push(completed);
      }
    }
    
    return results;
  }

  areDependenciesSatisfied(task, completedResults) {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }
    
    const completedTaskIds = new Set(completedResults.map(r => r.task_id));
    return task.dependencies.every(depId => completedTaskIds.has(depId));
  }

  async simulateTaskExecution(task) {
    // Simulate different task types
    const delay = Math.random() * 2000 + 500; // 0.5-2.5 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      message: `Task ${task.id} of type ${task.type} completed successfully`,
      parameters: task.parameters,
      execution_time: delay
    };
  }

  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getActiveTasksCount() {
    return this.activeTasks.size;
  }

  getTaskResults(executionId) {
    const results = [];
    for (const [taskId, result] of this.taskResults) {
      if (taskId.startsWith(executionId)) {
        results.push(result);
      }
    }
    return results;
  }
}

module.exports = ParallelExecutor;

