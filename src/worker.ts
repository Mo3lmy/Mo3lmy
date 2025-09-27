// src/worker.ts
// Main worker process for handling background jobs

import 'dotenv/config';
import { config } from './config';
import { isMockMode } from './services/queue/mock-queue.service';

// Import workers
import slideWorker from './services/queue/workers/slide.worker';

console.log('🚀 Starting worker process...');
console.log('📋 Configuration:');

if (isMockMode()) {
  console.log('⚠️ Running in MOCK MODE (Redis not available)');
  console.log('  - Using in-memory queue simulation');
} else {
  console.log(`  - Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
  console.log(`  - Concurrency: ${process.env.SLIDE_WORKER_CONCURRENCY || 3}`);
}

console.log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);

// Start workers
if (slideWorker) {
  console.log('✅ Slide generation worker started');
} else {
  console.log('⚠️ Worker running in mock mode - jobs will be processed inline');
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down workers...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down workers...');
  process.exit(0);
});

// Keep the process alive
process.stdin.resume();