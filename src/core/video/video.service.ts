import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../../config/database.config';
import { scriptGenerator } from './script.generator';
import { EnhancedSlideGenerator } from './slide.generator';
const slideGenerator = new EnhancedSlideGenerator();
import { audioGenerator } from './audio.generator';
import * as enhancedVideoComposer from './video.composer';
import { queues } from '../../config/queue.config';
import type { VideoGenerationJob, VideoScript } from '../../types/video.types';

export class VideoGenerationService {
  private readonly workDir = path.join(process.cwd(), 'temp', 'videos');
  
  /**
   * Generate video for a lesson
   */
  async generateVideo(lessonId: string): Promise<string> {
    console.log('🎥 Starting video generation for lesson:', lessonId);
    
    // Create or update video record
    const video = await prisma.video.upsert({
      where: { lessonId },
      update: {
        status: 'PROCESSING',
        startedAt: new Date(),
        error: null,
      },
      create: {
        lessonId,
        status: 'PROCESSING',
        startedAt: new Date(),
      },
    });
    
    try {
      // Create work directory
      const jobDir = path.join(this.workDir, video.id);
      await fs.mkdir(jobDir, { recursive: true });
      
      // Step 1: Generate script
      console.log('\n📝 Step 1: Generating script...');
      const script = await scriptGenerator.generateScript(lessonId);
      
      // Save script
      await prisma.video.update({
        where: { id: video.id },
        data: {
          script: JSON.stringify(script),
        },
      });
      
      // Step 2: Generate slides
      console.log('\n🖼️ Step 2: Generating slides...');
      const slidesDir = path.join(jobDir, 'slides');
      const allSlides = script.sections.flatMap(section => section.slides);
      const slidePaths = await slideGenerator.generateSlides(allSlides, slidesDir);
      
      // Save slides metadata
      await prisma.video.update({
        where: { id: video.id },
        data: {
          slides: JSON.stringify(slidePaths),
        },
      });
      
      // Step 3: Generate audio
      console.log('\n🎵 Step 3: Generating audio...');
      const audioDir = path.join(jobDir, 'audio');
      const audioFiles = await audioGenerator.generateAudio(script.sections, audioDir);
      
      // Combine audio files
      const finalAudioPath = path.join(jobDir, 'narration.mp3');
      await audioGenerator.combineAudioFiles(audioFiles, finalAudioPath);
      
      // Save audio URL
      await prisma.video.update({
        where: { id: video.id },
        data: {
          audioUrl: finalAudioPath,
        },
      });
      
      // Step 4: Compose final video
      console.log('\n🎬 Step 4: Composing final video...');
      const outputPath = path.join(jobDir, 'output.mp4');
      const durations = allSlides.map(slide => slide.duration);
      
      await enhancedVideoComposer.composeVideo(
        slidePaths,
        finalAudioPath,
        outputPath,
        durations
      );
      
      // Step 5: Generate thumbnail
      console.log('\n📸 Step 5: Generating thumbnail...');
      const thumbnailPath = path.join(jobDir, 'thumbnail.png');
      await enhancedVideoComposer.extractThumbnail(outputPath, thumbnailPath);
      
      // Update video record
      await prisma.video.update({
        where: { id: video.id },
        data: {
          status: 'COMPLETED',
          url: outputPath,
          thumbnailUrl: thumbnailPath,
          duration: Math.round(script.duration),
          completedAt: new Date(),
        },
      });
      
      // Cleanup slide generator
      await slideGenerator.cleanup();
      
      console.log('\n✅ Video generation completed successfully!');
      console.log(`📁 Output: ${outputPath}`);
      
      return outputPath;
      
    } catch (error) {
      console.error('❌ Video generation failed:', error);
      
      // Update video record with error
      await prisma.video.update({
        where: { id: video.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      
      throw error;
    }
  }
  
  /**
   * Queue video generation job
   */
  async queueVideoGeneration(lessonId: string): Promise<string> {
    console.log('📋 Queueing video generation for lesson:', lessonId);
    
    // Create pending video record
    const video = await prisma.video.create({
      data: {
        lessonId,
        status: 'PENDING',
      },
    });
    
    // Add to queue
    const job = await queues.videoGeneration.add(
      'generate-video',
      { lessonId, videoId: video.id },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );
    
    console.log(`✅ Video generation job queued: ${job.id}`);
    return video.id;
  }
  
  /**
   * Get video generation status
   */
  async getVideoStatus(videoId: string) {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        status: true,
        url: true,
        thumbnailUrl: true,
        duration: true,
        error: true,
        startedAt: true,
        completedAt: true,
      },
    });
    
    if (!video) {
      throw new Error('Video not found');
    }
    
    // Calculate progress based on status
    let progress = 0;
    switch (video.status) {
      case 'PENDING':
        progress = 0;
        break;
      case 'PROCESSING':
        progress = 50;
        break;
      case 'COMPLETED':
        progress = 100;
        break;
      case 'FAILED':
        progress = -1;
        break;
    }
    
    return {
      ...video,
      progress,
    };
  }
  
  /**
   * Retry failed video generation
   */
  async retryVideoGeneration(videoId: string): Promise<void> {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });
    
    if (!video) {
      throw new Error('Video not found');
    }
    
    if (video.status !== 'FAILED') {
      throw new Error('Can only retry failed videos');
    }
    
    // Reset status and queue again
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'PENDING',
        error: null,
      },
    });
    
    await queues.videoGeneration.add(
      'generate-video',
      { lessonId: video.lessonId, videoId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );
  }
  
  /**
   * Clean up old video files
   */
  async cleanupOldVideos(daysOld: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const oldVideos = await prisma.video.findMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
    
    for (const video of oldVideos) {
      try {
        const jobDir = path.join(this.workDir, video.id);
        await fs.rm(jobDir, { recursive: true, force: true });
        console.log(`🗑️ Cleaned up video: ${video.id}`);
      } catch (error) {
        console.error(`❌ Failed to cleanup video ${video.id}:`, error);
      }
    }
  }
}

// Export singleton instance
export const videoGenerationService = new VideoGenerationService();