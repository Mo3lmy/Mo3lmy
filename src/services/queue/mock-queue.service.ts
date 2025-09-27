// src/services/queue/mock-queue.service.ts
// Mock Queue Service for development without Redis

import { EventEmitter } from 'events';
import { processSlideGeneration } from './slide-generation.queue';

interface Job<T> {
  id: string;
  data: T;
  progress: any;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  result?: any;
  error?: any;
  finishedOn?: number;
  processedOn?: number;
  failedReason?: string;
}

class MockQueue<T> extends EventEmitter {
  private jobs: Map<string, Job<T>> = new Map();
  private processing: boolean = false;
  private static resultsCache: Map<string, any> = new Map();

  async add(name: string, data: T): Promise<{ id: string }> {
    const jobId = Math.random().toString(36).substr(2, 9);
    const job: Job<T> = {
      id: jobId,
      data,
      progress: { progress: 0 },
      status: 'waiting',
      processedOn: Date.now()
    };

    this.jobs.set(jobId, job);

    // Process after a delay to simulate async behavior
    setTimeout(() => this.processJob(jobId), 100);

    return { id: jobId };
  }

  async getJob(jobId: string): Promise<Job<T> | null> {
    return this.jobs.get(jobId) || null;
  }

  async getState(): Promise<string> {
    // For compatibility with BullMQ API
    return 'active';
  }

  async updateProgress(progress: any): Promise<void> {
    // For compatibility with processSlideGeneration
  }

  private async processJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'waiting') return;

    job.status = 'active';
    this.emit('active', job);

    try {
      // Check if this is a slide generation job
      const jobData = job.data as any;
      if (jobData.lessonId && jobData.slides) {
        console.log(`🚀 Mock Queue: Processing slide generation for lesson ${jobData.lessonId}`);

        // Create a job-like object for processSlideGeneration
        const mockJobObject = {
          id: jobId,
          data: jobData,
          progress: job.progress,
          updateProgress: async (progress: any) => {
            job.progress = progress;
            this.emit('progress', job, progress);
          }
        };

        // Actually process the slides
        const result = await processSlideGeneration(mockJobObject as any);

        // Store results in cache
        const cacheKey = `slides:${jobData.lessonId}:${jobData.userId}`;
        const cacheKey2 = `slides:${jobData.lessonId}:latest`;
        MockQueue.resultsCache.set(cacheKey, {
          ...result,
          processedSlides: result.htmlSlides?.map((html: string, idx: number) => ({
            index: idx,
            html,
            script: result.teachingScripts?.[idx]?.script,
            audioUrl: result.audioUrls?.[idx],
            processingTime: 100
          })),
          generatedAt: new Date()
        });
        MockQueue.resultsCache.set(cacheKey2, MockQueue.resultsCache.get(cacheKey));

        console.log(`✅ Mock Queue: Stored results for ${cacheKey}`);

        job.result = result;
        job.status = 'completed';
        job.finishedOn = Date.now();
        job.progress = { progress: 100 };
      } else {
        // Generic job processing
        for (let i = 0; i <= 100; i += 10) {
          job.progress = { progress: i };
          this.emit('progress', job, { progress: i });
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        job.status = 'completed';
        job.finishedOn = Date.now();
        job.result = { success: true };
      }

      this.emit('completed', job);
    } catch (error) {
      job.status = 'failed';
      job.error = error;
      job.failedReason = error instanceof Error ? error.message : 'Unknown error';
      this.emit('failed', job, error);
    }
  }

  async getWaitingCount(): Promise<number> {
    return Array.from(this.jobs.values()).filter(j => j.status === 'waiting').length;
  }

  async getActiveCount(): Promise<number> {
    return Array.from(this.jobs.values()).filter(j => j.status === 'active').length;
  }

  async getCompletedCount(): Promise<number> {
    return Array.from(this.jobs.values()).filter(j => j.status === 'completed').length;
  }

  async getFailedCount(): Promise<number> {
    return Array.from(this.jobs.values()).filter(j => j.status === 'failed').length;
  }

  async drain(): Promise<void> {
    this.jobs.clear();
  }

  async clean(grace: number, limit: number, type: string): Promise<void> {
    // Mock implementation
  }

  // Add method to get cached results (for mock mode)
  static getCachedResults(lessonId: string, userId: string): any | null {
    const primaryKey = `slides:${lessonId}:${userId}`;
    const fallbackKey = `slides:${lessonId}:latest`;

    let result = MockQueue.resultsCache.get(primaryKey);
    if (result) {
      console.log(`✅ Mock Cache: Found results for ${primaryKey}`);
      return result;
    }

    result = MockQueue.resultsCache.get(fallbackKey);
    if (result) {
      console.log(`✅ Mock Cache: Found results for ${fallbackKey}`);
      return result;
    }

    console.log(`❌ Mock Cache: No results found for ${lessonId}, ${userId}`);
    return null;
  }
}

// Export mock implementation when Redis is not available
export const createMockQueue = <T>(name: string) => {
  console.log(`⚠️ Using mock queue for ${name} (Redis not available)`);
  return new MockQueue<T>();
};

export const isMockMode = () => {
  return !process.env.REDIS_HOST || process.env.USE_MOCK_QUEUE === 'true';
};

export const getMockCachedResults = (lessonId: string, userId: string) => {
  return MockQueue.getCachedResults(lessonId, userId);
};