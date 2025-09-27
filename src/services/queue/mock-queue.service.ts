// src/services/queue/mock-queue.service.ts
// Mock Queue Service for development without Redis

import { EventEmitter } from 'events';

interface Job<T> {
  id: string;
  data: T;
  progress: number;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  result?: any;
  error?: any;
}

class MockQueue<T> extends EventEmitter {
  private jobs: Map<string, Job<T>> = new Map();
  private processing: boolean = false;

  async add(name: string, data: T): Promise<{ id: string }> {
    const jobId = Math.random().toString(36).substr(2, 9);
    const job: Job<T> = {
      id: jobId,
      data,
      progress: 0,
      status: 'waiting'
    };

    this.jobs.set(jobId, job);

    // Process after a delay to simulate async behavior
    setTimeout(() => this.processJob(jobId), 100);

    return { id: jobId };
  }

  async getJob(jobId: string): Promise<Job<T> | null> {
    return this.jobs.get(jobId) || null;
  }

  private async processJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'waiting') return;

    job.status = 'active';
    this.emit('active', job);

    try {
      // Simulate processing
      for (let i = 0; i <= 100; i += 10) {
        job.progress = i;
        this.emit('progress', job, i);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      job.status = 'completed';
      job.result = { success: true };
      this.emit('completed', job);
    } catch (error) {
      job.status = 'failed';
      job.error = error;
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
}

// Export mock implementation when Redis is not available
export const createMockQueue = <T>(name: string) => {
  console.log(`⚠️ Using mock queue for ${name} (Redis not available)`);
  return new MockQueue<T>();
};

export const isMockMode = () => {
  return !process.env.REDIS_HOST || process.env.USE_MOCK_QUEUE === 'true';
};