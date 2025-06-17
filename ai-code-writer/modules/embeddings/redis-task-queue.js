const redis = require('redis');
const Logger = require('../../utils/logger');
const logger = new Logger('RedisQueue');

class RedisTaskQueue {
    constructor() {
        this.client = null;
        this.subscriber = null;
        this.publisher = null;
        this.isConnected = false;
        this.taskCallbacks = new Map();
        this.queueNames = {
            embeddings: 'embeddings_queue',
            processing: 'embeddings_processing',
            completed: 'embeddings_completed',
            failed: 'embeddings_failed'
        };
    }

    /**
     * Initialize Redis connections
     */
    async initialize() {
        try {
            logger.info('Initializing Redis Task Queue...');
            
            const redisUrl = process.env.REDIS_URL;
            if (!redisUrl) {
                throw new Error('REDIS_URL environment variable not set');
            }

            // Create main client
            this.client = redis.createClient({ url: redisUrl });
            
            // Create subscriber for real-time updates
            this.subscriber = redis.createClient({ url: redisUrl });
            
            // Create publisher for notifications
            this.publisher = redis.createClient({ url: redisUrl });

            // Connect all clients
            await Promise.all([
                this.client.connect(),
                this.subscriber.connect(),
                this.publisher.connect()
            ]);

            this.isConnected = true;
            
            // Set up error handlers
            [this.client, this.subscriber, this.publisher].forEach(client => {
                client.on('error', (error) => {
                    logger.error('Redis client error:', error);
                });
            });

            // Start listening for task updates
            await this.setupTaskSubscriptions();
            
            logger.info('Redis Task Queue initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize Redis Task Queue:', error.message);
            throw error;
        }
    }

    /**
     * Set up Redis subscriptions for task notifications
     */
    async setupTaskSubscriptions() {
        try {
            // Subscribe to task completion notifications
            await this.subscriber.subscribe('task_completed', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleTaskCompletion(data);
                } catch (error) {
                    logger.error('Error handling task completion:', error.message);
                }
            });

            // Subscribe to task failure notifications
            await this.subscriber.subscribe('task_failed', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleTaskFailure(data);
                } catch (error) {
                    logger.error('Error handling task failure:', error.message);
                }
            });

            logger.info('Task subscriptions set up successfully');
        } catch (error) {
            logger.error('Failed to set up task subscriptions:', error.message);
            throw error;
        }
    }

    /**
     * Add embedding task to queue
     */
    async addEmbeddingTask(taskData) {
        try {
            const task = {
                id: this.generateTaskId(),
                type: 'embedding',
                data: taskData,
                priority: taskData.priority || 'normal',
                category: taskData.category || 'general',
                createdAt: new Date().toISOString(),
                status: 'queued',
                retries: 0,
                maxRetries: 3
            };

            // Add to appropriate queue based on priority
            const queueKey = this.getQueueKey(task.priority);
            
            await this.client.lPush(queueKey, JSON.stringify(task));
            
            // Add to tracking hash
            await this.client.hSet('embedding_tasks', task.id, JSON.stringify(task));
            
            logger.info(`Added embedding task ${task.id} to queue ${queueKey}`);
            return task.id;
        } catch (error) {
            logger.error('Failed to add embedding task:', error.message);
            throw error;
        }
    }

    /**
     * Get next task from queue (priority order)
     */
    async getNextTask() {
        try {
            const priorityQueues = [
                this.getQueueKey('urgent'),
                this.getQueueKey('high'),
                this.getQueueKey('normal'),
                this.getQueueKey('low')
            ];

            // Check queues in priority order
            for (const queueKey of priorityQueues) {
                const taskData = await this.client.rPop(queueKey);
                if (taskData) {
                    const task = JSON.parse(taskData);
                    
                    // Move to processing queue
                    task.status = 'processing';
                    task.processedAt = new Date().toISOString();
                    
                    await this.client.lPush(this.queueNames.processing, JSON.stringify(task));
                    await this.client.hSet('embedding_tasks', task.id, JSON.stringify(task));
                    
                    logger.info(`Retrieved task ${task.id} from queue ${queueKey}`);
                    return task;
                }
            }
            
            return null; // No tasks available
        } catch (error) {
            logger.error('Failed to get next task:', error.message);
            throw error;
        }
    }

    /**
     * Mark task as completed
     */
    async completeTask(taskId, result) {
        try {
            const taskData = await this.client.hGet('embedding_tasks', taskId);
            if (!taskData) {
                throw new Error(`Task ${taskId} not found`);
            }

            const task = JSON.parse(taskData);
            task.status = 'completed';
            task.completedAt = new Date().toISOString();
            task.result = result;

            // Remove from processing queue
            await this.removeFromProcessingQueue(taskId);
            
            // Add to completed queue
            await this.client.lPush(this.queueNames.completed, JSON.stringify(task));
            await this.client.hSet('embedding_tasks', task.id, JSON.stringify(task));
            
            // Publish completion notification
            await this.publisher.publish('task_completed', JSON.stringify({
                taskId: task.id,
                result: result
            }));
            
            logger.info(`Task ${taskId} completed successfully`);
            return true;
        } catch (error) {
            logger.error(`Failed to complete task ${taskId}:`, error.message);
            throw error;
        }
    }

    /**
     * Mark task as failed
     */
    async failTask(taskId, error, retry = true) {
        try {
            const taskData = await this.client.hGet('embedding_tasks', taskId);
            if (!taskData) {
                throw new Error(`Task ${taskId} not found`);
            }

            const task = JSON.parse(taskData);
            task.retries = (task.retries || 0) + 1;
            task.lastError = error.message || error;
            task.lastFailedAt = new Date().toISOString();

            // Remove from processing queue
            await this.removeFromProcessingQueue(taskId);

            if (retry && task.retries < task.maxRetries) {
                // Retry the task
                task.status = 'queued';
                const queueKey = this.getQueueKey(task.priority);
                await this.client.lPush(queueKey, JSON.stringify(task));
                
                logger.warn(`Task ${taskId} failed, retrying (attempt ${task.retries}/${task.maxRetries})`);
            } else {
                // Mark as permanently failed
                task.status = 'failed';
                await this.client.lPush(this.queueNames.failed, JSON.stringify(task));
                
                logger.error(`Task ${taskId} permanently failed after ${task.retries} attempts`);
            }

            await this.client.hSet('embedding_tasks', task.id, JSON.stringify(task));
            
            // Publish failure notification
            await this.publisher.publish('task_failed', JSON.stringify({
                taskId: task.id,
                error: error.message || error,
                retry: retry && task.retries < task.maxRetries
            }));
            
            return true;
        } catch (error) {
            logger.error(`Failed to mark task ${taskId} as failed:`, error.message);
            throw error;
        }
    }

    /**
     * Get task status
     */
    async getTaskStatus(taskId) {
        try {
            const taskData = await this.client.hGet('embedding_tasks', taskId);
            if (!taskData) {
                return null;
            }
            
            return JSON.parse(taskData);
        } catch (error) {
            logger.error(`Failed to get task status for ${taskId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get queue statistics
     */
    async getQueueStats() {
        try {
            const stats = {
                queued: {
                    urgent: await this.client.lLen(this.getQueueKey('urgent')),
                    high: await this.client.lLen(this.getQueueKey('high')),
                    normal: await this.client.lLen(this.getQueueKey('normal')),
                    low: await this.client.lLen(this.getQueueKey('low'))
                },
                processing: await this.client.lLen(this.queueNames.processing),
                completed: await this.client.lLen(this.queueNames.completed),
                failed: await this.client.lLen(this.queueNames.failed)
            };
            
            stats.total = {
                queued: Object.values(stats.queued).reduce((a, b) => a + b, 0),
                processing: stats.processing,
                completed: stats.completed,
                failed: stats.failed
            };
            
            return stats;
        } catch (error) {
            logger.error('Failed to get queue stats:', error.message);
            throw error;
        }
    }

    /**
     * Watch for new tasks (blocking operation)
     */
    async watchForTasks(timeout = 5) {
        try {
            const priorityQueues = [
                this.getQueueKey('urgent'),
                this.getQueueKey('high'),
                this.getQueueKey('normal'),
                this.getQueueKey('low')
            ];

            // Use BRPOP for blocking pop with timeout
            const result = await this.client.brPop(
                priorityQueues.map(queue => ({ key: queue, timeout }))
            );

            if (result) {
                const task = JSON.parse(result.element);
                
                // Move to processing queue
                task.status = 'processing';
                task.processedAt = new Date().toISOString();
                
                await this.client.lPush(this.queueNames.processing, JSON.stringify(task));
                await this.client.hSet('embedding_tasks', task.id, JSON.stringify(task));
                
                logger.info(`Watched task ${task.id} from queue ${result.key}`);
                return task;
            }
            
            return null;
        } catch (error) {
            logger.error('Failed to watch for tasks:', error.message);
            throw error;
        }
    }

    /**
     * Helper methods
     */
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getQueueKey(priority) {
        return `${this.queueNames.embeddings}_${priority}`;
    }

    async removeFromProcessingQueue(taskId) {
        try {
            const items = await this.client.lRange(this.queueNames.processing, 0, -1);
            for (let i = 0; i < items.length; i++) {
                const task = JSON.parse(items[i]);
                if (task.id === taskId) {
                    await this.client.lRem(this.queueNames.processing, 1, items[i]);
                    break;
                }
            }
        } catch (error) {
            logger.error(`Failed to remove task ${taskId} from processing queue:`, error.message);
        }
    }

    handleTaskCompletion(data) {
        const callback = this.taskCallbacks.get(data.taskId);
        if (callback && typeof callback.onComplete === 'function') {
            callback.onComplete(data.result);
            this.taskCallbacks.delete(data.taskId);
        }
    }

    handleTaskFailure(data) {
        const callback = this.taskCallbacks.get(data.taskId);
        if (callback && typeof callback.onFailure === 'function') {
            callback.onFailure(data.error);
            if (!data.retry) {
                this.taskCallbacks.delete(data.taskId);
            }
        }
    }

    /**
     * Clean up completed and failed tasks (older than specified days)
     */
    async cleanupOldTasks(daysOld = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            
            let cleaned = 0;
            
            // Clean completed tasks
            const completed = await this.client.lRange(this.queueNames.completed, 0, -1);
            for (const taskData of completed) {
                const task = JSON.parse(taskData);
                if (new Date(task.completedAt) < cutoffDate) {
                    await this.client.lRem(this.queueNames.completed, 1, taskData);
                    await this.client.hDel('embedding_tasks', task.id);
                    cleaned++;
                }
            }
            
            // Clean failed tasks
            const failed = await this.client.lRange(this.queueNames.failed, 0, -1);
            for (const taskData of failed) {
                const task = JSON.parse(taskData);
                if (new Date(task.lastFailedAt) < cutoffDate) {
                    await this.client.lRem(this.queueNames.failed, 1, taskData);
                    await this.client.hDel('embedding_tasks', task.id);
                    cleaned++;
                }
            }
            
            logger.info(`Cleaned up ${cleaned} old tasks`);
            return cleaned;
        } catch (error) {
            logger.error('Failed to cleanup old tasks:', error.message);
            throw error;
        }
    }

    /**
     * Disconnect from Redis
     */
    async disconnect() {
        try {
            if (this.client) await this.client.disconnect();
            if (this.subscriber) await this.subscriber.disconnect();
            if (this.publisher) await this.publisher.disconnect();
            
            this.isConnected = false;
            logger.info('Redis Task Queue disconnected');
        } catch (error) {
            logger.error('Error disconnecting from Redis:', error.message);
        }
    }
}

module.exports = RedisTaskQueue;

