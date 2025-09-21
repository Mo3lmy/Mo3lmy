import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../../config/database.config';
import { scriptGenerator } from './script.generator';
import { slideGenerator } from './slide.generator';
import { audioGenerator } from './audio.generator';
import { videoComposer } from './video.composer';
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
      
      await videoComposer.composeVideo(
        slidePaths,
        finalAudioPath,
        outputPath,
        durations
      );
      
      // Step 5: Generate thumbnail
      console.log('\n📸 Step 5: Generating thumbnail...');
      const thumbnailPath = path.join(jobDir, 'thumbnail.png');
      await videoComposer.extractThumbnail(outputPath, thumbnailPath);
      
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
    const job = await queues.videoGeneration.add(
      'generate-video',
      { lessonId },
      { priority: 1 }
    );
    
    console.log(`📋 Video generation job queued: ${job.id}`);
    return job.id || '';
  }
  
  /**
   * Get video generation status
   */
  async getVideoStatus(lessonId: string): Promise<any> {
    const video = await prisma.video.findUnique({
      where: { lessonId },
    });
    
    if (!video) {
      return null;
    }
    
    return {
      status: video.status,
      progress: this.calculateProgress(video),
      url: video.url,
      thumbnailUrl: video.thumbnailUrl,
      error: video.error,
      startedAt: video.startedAt,
      completedAt: video.completedAt,
    };
  }
  
  /**
   * Calculate progress percentage
   */
  private calculateProgress(video: any): number {
    switch (video.status) {
      case 'PENDING':
        return 0;
      case 'PROCESSING':
        if (video.script && video.slides && video.audioUrl) {
          return 75;
        } else if (video.script && video.slides) {
          return 50;
        } else if (video.script) {
          return 25;
        }
        return 10;
      case 'COMPLETED':
        return 100;
      case 'FAILED':
        return 0;
      default:
        return 0;
    }
  }
  
  /**
   * Regenerate video
   */
  async regenerateVideo(lessonId: string): Promise<string> {
    // Delete existing video
    await prisma.video.deleteMany({
      where: { lessonId },
    });
    
    // Generate new video
    return await this.generateVideo(lessonId);
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
      if (video.url) {
        const videoDir = path.dirname(video.url);
        try {
          await fs.rm(videoDir, { recursive: true, force: true });
          console.log(`🗑️ Cleaned up video: ${video.id}`);
        } catch (error) {
          console.error(`Failed to cleanup video ${video.id}:`, error);
        }
      }
    }
  }
}

// Export singleton instance
export const videoService = new VideoGenerationService();