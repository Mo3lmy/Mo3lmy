// src/services/queue/workers/index.ts
// Main workers initialization file

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import {
  processSlideGeneration,
  type SlideGenerationJob,
  type SlideGenerationResult
} from '../slide-generation.queue';
import { websocketService } from '../../websocket/websocket.service';

// Create Redis connection for workers
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    if (times > 3) {
      console.error('❌ Worker could not connect to Redis after 3 attempts');
      return null;
    }
    return Math.min(times * 100, 3000);
  }
});

// Slide Generation Worker
export const slideWorker = new Worker<SlideGenerationJob, SlideGenerationResult>(
  'slide-generation',
  async (job: Job<SlideGenerationJob>) => {
    console.log(`🔧 Processing slide generation job ${job.id} for lesson ${job.data.lessonId}`);

    try {
      // Update progress to show we're starting
      await job.updateProgress({
        status: 'processing',
        progress: 0,
        currentSlide: 0,
        totalSlides: job.data.slides.length
      });

      // Process the job
      const result = await processSlideGeneration(job);

      // Send WebSocket notification for completion if sessionId exists
      if (job.data.sessionId && websocketService) {
        websocketService.emitSlideGenerationComplete(
          job.data.userId,
          job.data.lessonId,
          {
            jobId: job.id!,
            status: 'completed',
            slides: result.htmlSlides,
            audioUrls: result.audioUrls,
            teachingScripts: result.teachingScripts,
          }
        );
      }

      console.log(`✅ Job ${job.id} completed successfully`);
      return result;
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);

      // Send WebSocket notification for failure
      if (job.data.sessionId && websocketService) {
        websocketService.emitSlideGenerationError(
          job.data.userId,
          job.data.lessonId,
          {
            jobId: job.id!,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        );
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.SLIDE_WORKER_CONCURRENCY || '2'), // Process 2 jobs in parallel
    removeOnComplete: {
      count: 100,  // Keep last 100 completed jobs
      age: 3600    // Keep for 1 hour
    },
    removeOnFail: {
      count: 50,   // Keep last 50 failed jobs
      age: 7200    // Keep for 2 hours
    }
  }
);

// Worker event handlers
slideWorker.on('completed', (job) => {
  console.log(`✅ Slide generation job ${job.id} completed`);
});

slideWorker.on('failed', (job, err) => {
  console.error(`❌ Slide generation job ${job?.id} failed:`, err);
});

slideWorker.on('progress', (job, progress) => {
  console.log(`📊 Job ${job.id} progress:`, progress);

  // Send WebSocket progress update
  if (job.data.sessionId && websocketService) {
    websocketService.emitSlideGenerationProgress(
      job.data.userId,
      job.data.lessonId,
      {
        jobId: job.id!,
        progress: progress as any,
      }
    );
  }
});

slideWorker.on('error', (error) => {
  console.error('⚠️ Worker error:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, closing workers...');
  await slideWorker.close();
  connection.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, closing workers...');
  await slideWorker.close();
  connection.disconnect();
  process.exit(0);
});

// Export for use in other modules
export default {
  slideWorker,
  connection
};

console.log('✅ Queue workers initialized and ready');