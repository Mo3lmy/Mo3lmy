// src/services/queue/workers/slide.worker.ts
// Worker لمعالجة توليد الشرائح

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { processSlideGeneration, SlideGenerationJob, SlideGenerationResult } from '../slide-generation.queue';
import { websocketService } from '../../websocket/websocket.service';
import { isMockMode } from '../mock-queue.service';

// Redis connection
let redisConnection: any;

if (!isMockMode()) {
  try {
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // BullMQ requires null
    });
  } catch (error) {
    console.warn('⚠️ Worker: Redis connection failed, using mock mode');
  }
}

// Create worker instance
export const slideWorker = isMockMode()
  ? null as any  // In mock mode, we don't need a real worker
  : new Worker<SlideGenerationJob, SlideGenerationResult>(
      'slide-generation',
      async (job: Job<SlideGenerationJob>) => {
    console.log(`🔨 Worker processing job ${job.id} for lesson ${job.data.lessonId}`);

    try {
      // Process the job
      const result = await processSlideGeneration(job);

      // Send WebSocket notification for completion
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

      return result;
    } catch (error) {
      console.error(`❌ Worker failed processing job ${job.id}:`, error);

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
      connection: redisConnection,
    concurrency: parseInt(process.env.SLIDE_WORKER_CONCURRENCY || '3'), // Process 3 jobs concurrently
    limiter: {
      max: 10,
      duration: 60000, // Max 10 jobs per minute
    },
  }
);

// Worker event handlers (only if not in mock mode)
if (slideWorker) {
  slideWorker.on('completed', (job: any) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  slideWorker.on('failed', (job: any, err: any) => {
    console.error(`❌ Job ${job?.id} failed:`, err);
  });

  slideWorker.on('progress', (job: any, progress: any) => {
  console.log(`📊 Job ${job.id} progress: ${JSON.stringify(progress)}`);

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
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  if (slideWorker) await slideWorker.close();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...');
  if (slideWorker) await slideWorker.close();
});

export default slideWorker;