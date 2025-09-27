// src/services/queue/slide-generation.queue.ts
// نظام Job Queue لتوليد الشرائح بشكل غير متزامن

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../../config';
import { slideService, type SlideContent } from '../slides/slide.service';
import { voiceService } from '../voice/voice.service';
import { teachingAssistant } from '../teaching/teaching-assistant.service';
import { prisma } from '../../config/database.config';

// ============= TYPES =============

export interface SlideGenerationJob {
  lessonId: string;
  userId: string;
  slides: SlideContent[];
  theme: string;
  generateVoice: boolean;
  generateTeaching: boolean;
  userGrade: number;
  userName: string;
  sessionId?: string;
}

export interface SlideGenerationResult {
  lessonId: string;
  htmlSlides: string[];
  teachingScripts: any[];
  audioUrls: string[];
  totalSlides: number;
  processingTime: number;
}

export interface SlideGenerationProgress {
  lessonId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentSlide: number;
  totalSlides: number;
  processedSlides: SlideResult[];
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface SlideResult {
  index: number;
  html: string;
  script?: string;
  audioUrl?: string;
  processingTime: number;
}

// ============= REDIS CONNECTION =============

import { createMockQueue, isMockMode } from './mock-queue.service';

let redisConnection: any;

// Check if Redis is available
if (!isMockMode()) {
  try {
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // BullMQ requires null
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('❌ Could not connect to Redis after 3 attempts');
          return null;
        }
        return Math.min(times * 100, 3000);
      }
    });
  } catch (error) {
    console.warn('⚠️ Redis connection failed, using mock queue:', error);
  }
}

// ============= QUEUE SETUP =============

export const slideGenerationQueue = isMockMode()
  ? createMockQueue<SlideGenerationJob>('slide-generation') as any
  : new Queue<SlideGenerationJob>(
      'slide-generation',
      {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 100, // Keep max 100 completed jobs
          },
          removeOnFail: {
            age: 24 * 3600, // Keep failed jobs for 24 hours
          },
        },
      }
    );

// Queue Events for monitoring
export const queueEvents = isMockMode()
  ? null
  : new QueueEvents('slide-generation', {
      connection: redisConnection,
    });

// ============= JOB PROCESSING LOGIC =============

export async function processSlideGeneration(job: Job<SlideGenerationJob>): Promise<SlideGenerationResult> {
  const startTime = Date.now();
  const { lessonId, userId, slides, theme, generateVoice, generateTeaching, userGrade, userName } = job.data;

  console.log(`🚀 Starting slide generation for lesson ${lessonId}, ${slides.length} slides`);

  const htmlSlides: string[] = [];
  const teachingScripts: any[] = [];
  const audioUrls: string[] = [];
  const processedSlides: SlideResult[] = [];

  try {
    // Process each slide
    for (let i = 0; i < slides.length; i++) {
      const slideStartTime = Date.now();
      const slide = slides[i];

      // Update progress
      const progress = Math.round(((i + 1) / slides.length) * 100);
      await job.updateProgress({
        currentSlide: i + 1,
        totalSlides: slides.length,
        progress,
        message: `Processing slide ${i + 1} of ${slides.length}`,
      });

      console.log(`📄 Processing slide ${i + 1}/${slides.length}: ${slide.type}`);

      // 1. Generate HTML
      const html = slideService.generateSlideHTML(slide, theme);
      htmlSlides.push(html);

      // 2. Generate teaching script (if requested)
      let script = null;
      if (generateTeaching) {
        try {
          const teachingResult = await teachingAssistant.generateTeachingScript({
            slideContent: slide,
            lessonId,
            studentGrade: userGrade,
            studentName: userName,
            interactionType: 'explain',
          });
          script = teachingResult;
          teachingScripts.push(script);
          console.log(`✅ Teaching script generated for slide ${i + 1}`);
        } catch (error) {
          console.error(`❌ Failed to generate teaching script for slide ${i + 1}:`, error);
          // Use fallback script
          script = {
            script: `مرحباً ${userName}، دعنا نتعلم عن ${slide.title || 'هذا الموضوع'}`,
            duration: 10,
            keyPoints: [],
          };
          teachingScripts.push(script);
        }
      }

      // 3. Generate voice (if requested)
      let audioUrl = '';
      if (generateVoice && script) {
        try {
          const voiceResult = await voiceService.textToSpeech(script.script);
          if (voiceResult.success && voiceResult.audioUrl) {
            audioUrl = voiceResult.audioUrl;
            console.log(`🔊 Voice generated for slide ${i + 1}`);
          }
        } catch (error) {
          console.error(`❌ Failed to generate voice for slide ${i + 1}:`, error);
        }
      }
      audioUrls.push(audioUrl);

      // Store processed slide result
      processedSlides.push({
        index: i,
        html,
        script: script?.script,
        audioUrl,
        processingTime: Date.now() - slideStartTime,
      });

      // Small delay to prevent API rate limiting
      if (i < slides.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Slide generation completed in ${processingTime}ms`);

    // Store results in cache/database
    await storeGenerationResults(lessonId, userId, {
      htmlSlides,
      teachingScripts,
      audioUrls,
      processedSlides,
    });

    return {
      lessonId,
      htmlSlides,
      teachingScripts,
      audioUrls,
      totalSlides: slides.length,
      processingTime,
    };

  } catch (error) {
    console.error('❌ Slide generation failed:', error);
    throw error;
  }
}

// ============= HELPER FUNCTIONS =============

async function storeGenerationResults(lessonId: string, userId: string, results: any): Promise<void> {
  // استخدم multiple cache keys للتأكد
  const primaryKey = `slides:${lessonId}:${userId}`;
  const lessonKey = `slides:${lessonId}:latest`; // Fallback key
  const ttl = 3600; // 1 hour

  try {
    // Store with primary key
    await redisConnection.setex(
      primaryKey,
      ttl,
      JSON.stringify({
        ...results,
        generatedAt: new Date(),
        userId  // أضف userId للتأكد
      })
    );

    // Also store with lesson-only key as fallback
    await redisConnection.setex(
      lessonKey,
      ttl,
      JSON.stringify({
        ...results,
        generatedAt: new Date(),
        userId
      })
    );

    console.log(`💾 Stored generation results for ${primaryKey} and ${lessonKey}`);
  } catch (error) {
    console.error('Failed to store generation results:', error);
  }
}

export async function getGenerationResults(lessonId: string, userId: string): Promise<any | null> {
  try {
    // First, try exact match
    const exactKey = `slides:${lessonId}:${userId}`;
    let cached = await redisConnection.get(exactKey);

    if (cached) {
      console.log(`✅ Found exact match: ${exactKey}`);
      return JSON.parse(cached);
    }

    // Second, try latest key
    const latestKey = `slides:${lessonId}:latest`;
    cached = await redisConnection.get(latestKey);

    if (cached) {
      console.log(`✅ Found latest: ${latestKey}`);
      return JSON.parse(cached);
    }

    // Third, find ANY key for this lesson (fallback)
    const pattern = `slides:${lessonId}:*`;
    const keys = await redisConnection.keys(pattern);

    if (keys && keys.length > 0) {
      console.log(`🔍 Found ${keys.length} keys matching pattern`);

      // Get the most recent one
      for (const key of keys) {
        const data = await redisConnection.get(key);
        if (data) {
          console.log(`✅ Using fallback key: ${key}`);
          return JSON.parse(data);
        }
      }
    }

    console.log(`❌ No results found for lesson ${lessonId}, user ${userId}`);
    return null;

  } catch (error) {
    console.error('Failed to get generation results:', error);
    return null;
  }
}

export async function getJobStatus(jobId: string): Promise<SlideGenerationProgress | null> {
  try {
    const job = await slideGenerationQueue.getJob(jobId);

    if (!job) {
      console.log(`❌ Job ${jobId} not found`);
      return null;
    }

    const state = await job.getState();
    const progress = job.progress as any || {};

    // IMPORTANT: Return actual state, not 'processing' when completed
    const actualStatus = state === 'completed' ? 'completed' :
                        state === 'failed' ? 'failed' :
                        state === 'active' ? 'processing' :
                        state as any;

    console.log(`📊 Job ${jobId} state: ${state}, status: ${actualStatus}`);

    return {
      lessonId: job.data.lessonId,
      status: actualStatus, // ✅ Return correct status
      progress: progress.progress || 0,
      currentSlide: progress.currentSlide || 0,
      totalSlides: job.data.slides?.length || 0,
      processedSlides: progress.processedSlides || [],
      error: job.failedReason,
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  } catch (error) {
    console.error('Failed to get job status:', error);
    return null;
  }
}

// ============= QUEUE MANAGEMENT =============

export async function addSlideGenerationJob(data: SlideGenerationJob): Promise<string> {
  try {
    const job = await slideGenerationQueue.add('generate-slides', data, {
      priority: data.slides.length <= 5 ? 1 : 0, // Higher priority for smaller lessons
    });

    console.log(`📋 Added slide generation job ${job.id} for lesson ${data.lessonId}`);
    return job.id!;
  } catch (error) {
    console.error('Failed to add slide generation job:', error);
    throw error;
  }
}

export async function cancelSlideGenerationJob(jobId: string): Promise<boolean> {
  try {
    // Check if using mock queue
    if (isMockMode()) {
      // Mock cancellation - just return true for now
      console.log(`🚫 Mock: Cancelled job ${jobId}`);
      return true;
    }

    // Real BullMQ cancellation
    const job = await slideGenerationQueue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`🚫 Cancelled job ${jobId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to cancel job:', error);
    return false;
  }
}

// ============= QUEUE STATISTICS =============

export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    slideGenerationQueue.getWaitingCount(),
    slideGenerationQueue.getActiveCount(),
    slideGenerationQueue.getCompletedCount(),
    slideGenerationQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed,
  };
}

// ============= CLEANUP =============

export async function cleanupQueue(): Promise<void> {
  try {
    await slideGenerationQueue.drain();
    await slideGenerationQueue.clean(0, 1000, 'completed');
    await slideGenerationQueue.clean(0, 1000, 'failed');
    console.log('🧹 Queue cleaned up');
  } catch (error) {
    console.error('Failed to cleanup queue:', error);
  }
}

// Export functions for use in workers and API
export default {
  queue: slideGenerationQueue,
  events: queueEvents,
  addJob: addSlideGenerationJob,
  cancelJob: cancelSlideGenerationJob,
  getStatus: getJobStatus,
  getResults: getGenerationResults,
  getStats: getQueueStats,
  cleanup: cleanupQueue,
};