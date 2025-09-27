// src/services/queue/workers/index.ts
// Worker مبسط لمعالجة الـ jobs

import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import slideQueue from '../slide-generation.queue';

// Only create worker if Redis is available
let slideWorker: Worker | null = null;

try {
  const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null
  });

  slideWorker = new Worker(
    'slide-generation',
    async (job) => {
      console.log(`🔧 Worker processing job ${job.id}`);
      return await slideQueue.processSlideGeneration(job);
    },
    {
      connection,
      concurrency: 2
    }
  );

  slideWorker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  slideWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err);
  });

  console.log('✅ Worker initialized');
} catch (error) {
  console.log('⚠️ Worker not started - will use in-memory processing');
}

export default { slideWorker };