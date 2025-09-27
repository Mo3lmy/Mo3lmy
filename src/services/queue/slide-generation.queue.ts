// src/services/queue/slide-generation.queue.ts
// نظام مبسط لتوليد الشرائح

import { Queue, Job } from 'bullmq';
import IORedis from 'ioredis';
import { slideService, type SlideContent } from '../slides/slide.service';
import { voiceService } from '../voice/voice.service';
import { teachingAssistant } from '../teaching/teaching-assistant.service';

// Types
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

// Check if Redis is available
let redisConnection: IORedis | null = null;
let useInMemoryProcessing = false;

try {
  redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    retryStrategy: () => null
  });

  redisConnection.on('error', () => {
    useInMemoryProcessing = true;
    console.log('⚠️ Redis not available - using in-memory processing');
  });

  redisConnection.on('ready', () => {
    useInMemoryProcessing = false;
    console.log('✅ Redis connected for queues');
  });
} catch {
  useInMemoryProcessing = true;
  console.log('⚠️ Using in-memory processing');
}

// In-memory storage for development
const inMemoryJobs = new Map<string, any>();
const inMemoryResults = new Map<string, any>();

// Create queue (or mock if Redis not available)
const slideGenerationQueue = !useInMemoryProcessing && redisConnection
  ? new Queue<SlideGenerationJob>('slide-generation', { connection: redisConnection })
  : null;

// Process function that works for both queue and direct processing
export async function processSlideGeneration(
  job: { data: SlideGenerationJob; id?: string; updateProgress?: (progress: any) => Promise<void> }
): Promise<SlideGenerationResult> {
  const startTime = Date.now();
  const { lessonId, userId, slides, theme, generateVoice, generateTeaching, userGrade, userName } = job.data;

  console.log(`🚀 Processing ${slides.length} slides for lesson ${lessonId}`);

  const htmlSlides: string[] = [];
  const teachingScripts: any[] = [];
  const audioUrls: string[] = [];

  try {
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      // Update progress if available
      if (job.updateProgress) {
        await job.updateProgress({
          progress: Math.round(((i + 1) / slides.length) * 100),
          currentSlide: i + 1,
          totalSlides: slides.length
        });
      }

      // Generate HTML - تأكد من تمرير الشريحة بشكل صحيح
      const slideData = {
        type: slide.type || 'content',
        title: slide.title,
        subtitle: slide.subtitle,
        content: slide.content,  // هذا يجب أن يكون string
        bullets: slide.bullets,
        imageUrl: slide.imageUrl,
        equation: slide.equation,
        quiz: slide.quiz,
        metadata: slide.metadata
      };

      const html = slideService.generateSlideHTML(slideData, theme);
      htmlSlides.push(html);

      // Generate teaching script if requested (limit for performance)
      if (generateTeaching && i < 3) { // Only first 3 slides
        try {
          const script = await teachingAssistant.generateTeachingScript({
            slideContent: slide,
            lessonId,
            studentGrade: userGrade,
            studentName: userName,
            interactionType: 'explain'
          });
          teachingScripts.push(script);
        } catch (error) {
          console.error(`Failed to generate teaching script for slide ${i + 1}:`, error);
          teachingScripts.push({ script: 'مرحباً', duration: 10 });
        }
      }

      // Generate voice if requested (skip for now to avoid delays)
      audioUrls.push('');
    }

    const result = {
      lessonId,
      htmlSlides,
      teachingScripts,
      audioUrls,
      totalSlides: slides.length,
      processingTime: Date.now() - startTime,
      processedSlides: slides.map((slide, idx) => ({
        type: slide.type,
        title: slide.title,
        subtitle: slide.subtitle,
        content: slide.content,
        bullets: slide.bullets,
        html: htmlSlides[idx]
      }))
    };

    // Store results
    const cacheKey = `slides:${lessonId}:${userId}`;
    if (redisConnection && !useInMemoryProcessing) {
      await redisConnection.setex(cacheKey, 3600, JSON.stringify(result));
      await redisConnection.setex(`slides:${lessonId}:latest`, 3600, JSON.stringify(result));
    } else {
      inMemoryResults.set(cacheKey, result);
      inMemoryResults.set(`slides:${lessonId}:latest`, result);
    }

    console.log(`✅ Processed ${slides.length} slides in ${result.processingTime}ms`);
    return result;

  } catch (error) {
    console.error('❌ Slide generation failed:', error);
    throw error;
  }
}

// Add job function
export async function addSlideGenerationJob(data: SlideGenerationJob): Promise<string> {
  const jobId = Math.random().toString(36).substr(2, 9);

  if (slideGenerationQueue && !useInMemoryProcessing) {
    const job = await slideGenerationQueue.add('generate-slides', data);
    return job.id!;
  } else {
    // Process immediately in-memory
    inMemoryJobs.set(jobId, {
      id: jobId,
      data,
      status: 'processing',
      progress: 0
    });

    // Process async
    setTimeout(async () => {
      try {
        const result = await processSlideGeneration({
          data,
          id: jobId,
          updateProgress: async (progress) => {
            const job = inMemoryJobs.get(jobId);
            if (job) {
              job.progress = progress.progress;
              inMemoryJobs.set(jobId, job);
            }
          }
        });

        const job = inMemoryJobs.get(jobId);
        if (job) {
          job.status = 'completed';
          job.result = result;
          inMemoryJobs.set(jobId, job);
        }
      } catch (error) {
        const job = inMemoryJobs.get(jobId);
        if (job) {
          job.status = 'failed';
          job.error = error;
          inMemoryJobs.set(jobId, job);
        }
      }
    }, 100);

    return jobId;
  }
}

// Get job status
export async function getJobStatus(jobId: string): Promise<any> {
  if (slideGenerationQueue && !useInMemoryProcessing) {
    const job = await slideGenerationQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
      lessonId: job.data.lessonId,
      status: state === 'completed' ? 'completed' : state === 'failed' ? 'failed' : 'processing',
      progress: (job.progress as any)?.progress || 0
    };
  } else {
    const job = inMemoryJobs.get(jobId);
    return job ? {
      lessonId: job.data.lessonId,
      status: job.status,
      progress: job.progress
    } : null;
  }
}

// Get results
export async function getGenerationResults(lessonId: string, userId: string): Promise<any> {
  const keys = [
    `slides:${lessonId}:${userId}`,
    `slides:${lessonId}:latest`
  ];

  for (const key of keys) {
    if (redisConnection && !useInMemoryProcessing) {
      const cached = await redisConnection.get(key);
      if (cached) return JSON.parse(cached);
    } else {
      const cached = inMemoryResults.get(key);
      if (cached) return cached;
    }
  }

  return null;
}

// Export for API
export default {
  addJob: addSlideGenerationJob,
  getStatus: getJobStatus,
  getResults: getGenerationResults,
  processSlideGeneration
};