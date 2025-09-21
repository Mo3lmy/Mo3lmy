import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './index';

// Queue types
export enum QueueName {
  VIDEO_GENERATION = 'video-generation',
  CONTENT_PROCESSING = 'content-processing',
  EMAIL_NOTIFICATION = 'email-notification',
  ANALYTICS = 'analytics',
}

// Job data types
export interface VideoGenerationJob {
  lessonId: string;
  priority?: number;
}

export interface ContentProcessingJob {
  contentId: string;
  type: 'generate-embeddings' | 'generate-summary' | 'generate-questions';
}

export interface EmailNotificationJob {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

export interface AnalyticsJob {
  event: string;
  userId: string;
  data: Record<string, any>;
}

// Mock Queue for testing without Redis
class MockQueue<T = any> {
  name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  async add(jobName: string, data: T, options?: any) {
    console.log(`📋 Mock Queue: Job "${jobName}" added to ${this.name}`);
    return { id: Math.random().toString(), data };
  }
  
  async getWaitingCount() { return 0; }
  async getActiveCount() { return 0; }
  async getCompletedCount() { return 0; }
  async getFailedCount() { return 0; }
  async getDelayedCount() { return 0; }
  async clean() { }
  async obliterate() { }
  async pause() { }
  async resume() { }
  async close() { }
}

// Mock QueueEvents for testing
class MockQueueEvents {
  async close() { }
}

// Check if Redis is available
let redisAvailable = false;
let connection: IORedis | null = null;

try {
  connection = new IORedis(config.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    retryStrategy: () => null, // Don't retry
  });
  
  connection.on('error', () => {
    redisAvailable = false;
    console.warn('⚠️ Redis not available - using mock queues');
  });
  
  connection.on('ready', () => {
    redisAvailable = true;
    console.log('✅ Redis connected for queues');
  });
} catch (error) {
  console.warn('⚠️ Redis not available - using mock queues');
}

// Create queues based on Redis availability
export const queues = redisAvailable && connection ? {
  videoGeneration: new Queue<VideoGenerationJob>(QueueName.VIDEO_GENERATION, {
    connection: connection as IORedis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  }),
  
  contentProcessing: new Queue<ContentProcessingJob>(QueueName.CONTENT_PROCESSING, {
    connection: connection as IORedis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  }),
  
  emailNotification: new Queue<EmailNotificationJob>(QueueName.EMAIL_NOTIFICATION, {
    connection: connection as IORedis,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  }),
  
  analytics: new Queue<AnalyticsJob>(QueueName.ANALYTICS, {
    connection: connection as IORedis,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  }),
} : {
  videoGeneration: new MockQueue<VideoGenerationJob>(QueueName.VIDEO_GENERATION) as any,
  contentProcessing: new MockQueue<ContentProcessingJob>(QueueName.CONTENT_PROCESSING) as any,
  emailNotification: new MockQueue<EmailNotificationJob>(QueueName.EMAIL_NOTIFICATION) as any,
  analytics: new MockQueue<AnalyticsJob>(QueueName.ANALYTICS) as any,
};

// Queue events for monitoring
export const queueEvents = redisAvailable && connection ? {
  videoGeneration: new QueueEvents(QueueName.VIDEO_GENERATION, { connection: connection as IORedis }),
  contentProcessing: new QueueEvents(QueueName.CONTENT_PROCESSING, { connection: connection as IORedis }),
  emailNotification: new QueueEvents(QueueName.EMAIL_NOTIFICATION, { connection: connection as IORedis }),
  analytics: new QueueEvents(QueueName.ANALYTICS, { connection: connection as IORedis }),
} : {
  videoGeneration: new MockQueueEvents() as any,
  contentProcessing: new MockQueueEvents() as any,
  emailNotification: new MockQueueEvents() as any,
  analytics: new MockQueueEvents() as any,
};

// Queue management utilities
export class QueueManager {
  /**
   * Get queue statistics
   */
  static async getQueueStats(queueName: QueueName) {
    if (!redisAvailable) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
      };
    }
    
    const queue = Object.values(queues).find(q => q.name === queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  }
  
  /**
   * Clear queue
   */
  static async clearQueue(queueName: QueueName, status?: 'completed' | 'failed') {
    if (!redisAvailable) return;
    
    const queue = Object.values(queues).find(q => q.name === queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    if (status === 'completed') {
      await queue.clean(0, 0, 'completed');
    } else if (status === 'failed') {
      await queue.clean(0, 0, 'failed');
    } else {
      await queue.obliterate({ force: true });
    }
  }
  
  /**
   * Pause queue
   */
  static async pauseQueue(queueName: QueueName) {
    if (!redisAvailable) return;
    
    const queue = Object.values(queues).find(q => q.name === queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    await queue.pause();
  }
  
  /**
   * Resume queue
   */
  static async resumeQueue(queueName: QueueName) {
    if (!redisAvailable) return;
    
    const queue = Object.values(queues).find(q => q.name === queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    await queue.resume();
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing queues...');
  
  if (redisAvailable) {
    await Promise.all([
      ...Object.values(queues).map(queue => queue.close()),
      ...Object.values(queueEvents).map(events => events.close()),
    ]);
  }
  
  if (connection) {
    connection.disconnect();
  }
  
  console.log('Queues closed successfully');
});

console.log('✅ Queue system initialized');