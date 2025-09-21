import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import type { VideoConfig } from '../../types/video.types';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class VideoComposer {
  private readonly defaultConfig: VideoConfig = {
    resolution: {
      width: 1920,
      height: 1080,
    },
    fps: 30,
    bitrate: '4000k',
    format: 'mp4',
    quality: 'high',
  };
  
  /**
   * Compose video from slides and audio
   */
  async composeVideo(
    slidePaths: string[],
    audioPath: string,
    outputPath: string,
    durations: number[],
    config: Partial<VideoConfig> = {}
  ): Promise<void> {
    console.log('🎬 Composing final video...');
    
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // Check if audio is mock (JSON file)
    let isMockMode = false;
    try {
      const audioContent = await fs.readFile(audioPath, 'utf-8');
      const parsed = JSON.parse(audioContent);
      if (parsed.type === 'mock_audio') {
        isMockMode = true;
      }
    } catch {
      // Real audio file
      isMockMode = false;
    }
    
    // For mock mode or if FFmpeg not available, create placeholder
    if (!this.isFFmpegAvailable() || isMockMode) {
      await this.createMockVideo(outputPath);
      return;
    }
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      
      // Add input slides
      slidePaths.forEach((slidePath, index) => {
        command.input(slidePath)
          .loop(durations[index])
          .inputFPS(1);
      });
      
      // Add audio
      if (audioPath) {
        command.input(audioPath);
      }
      
      // Set output options
      command
        .complexFilter([
          // Concatenate slides
          `concat=n=${slidePaths.length}:v=1:a=0[v]`,
        ])
        .outputOptions([
          '-map', '[v]',
          '-map', '1:a?',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '22',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          `-r`, `${finalConfig.fps}`,
          `-b:v`, finalConfig.bitrate,
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('🎥 FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`⏳ Processing: ${progress.percent?.toFixed(1)}%`);
        })
        .on('end', () => {
          console.log('✅ Video composition complete!');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ Video composition failed:', err);
          reject(err);
        })
        .run();
    });
  }
  
  /**
   * Create mock video file with slide information
   */
  private async createMockVideo(outputPath: string): Promise<void> {
    console.log('🎭 Creating mock video file (Mock mode - no real audio/FFmpeg)...');
    
    const mockVideo = {
      type: 'mock_video',
      format: 'mp4',
      duration: 60,
      resolution: '1920x1080',
      message: 'Mock video created successfully. Add API keys for real video generation.',
      slides: 'Generated PNG slides are saved in temp folder',
      audio: 'Mock audio files created',
      createdAt: new Date().toISOString(),
    };
    
    await fs.writeFile(outputPath, JSON.stringify(mockVideo, null, 2));
    console.log(`✅ Mock video saved: ${outputPath}`);
  }
  
  /**
   * Check if FFmpeg is available
   */
  private isFFmpegAvailable(): boolean {
    try {
      return !!ffmpegInstaller.path;
    } catch {
      return false;
    }
  }
  
  /**
   * Add watermark to video
   */
  async addWatermark(
    videoPath: string,
    watermarkPath: string,
    outputPath: string
  ): Promise<void> {
    if (!this.isFFmpegAvailable()) {
      await fs.copyFile(videoPath, outputPath);
      return;
    }
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .input(watermarkPath)
        .complexFilter([
          '[1:v]scale=150:-1[logo]',
          '[0:v][logo]overlay=W-w-10:10',
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }
  
  /**
   * Extract thumbnail from video
   */
  async extractThumbnail(
    videoPath: string,
    outputPath: string,
    timestamp: string = '00:00:05'
  ): Promise<void> {
    // Check if video is mock
    let isMockVideo = false;
    try {
      const content = await fs.readFile(videoPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.type === 'mock_video') {
        isMockVideo = true;
      }
    } catch {
      isMockVideo = false;
    }
    
    if (!this.isFFmpegAvailable() || isMockVideo) {
      // Create mock thumbnail
      const mockThumbnail = { 
        type: 'thumbnail', 
        source: videoPath,
        message: 'Mock thumbnail for mock video'
      };
      await fs.writeFile(outputPath, JSON.stringify(mockThumbnail));
      return;
    }
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });
  }
  
  /**
   * Get video metadata
   */
  async getVideoMetadata(videoPath: string): Promise<any> {
    // Check if video is mock
    try {
      const content = await fs.readFile(videoPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.type === 'mock_video') {
        return {
          duration: parsed.duration || 60,
          width: 1920,
          height: 1080,
          fps: 30,
          format: 'mp4 (mock)',
        };
      }
    } catch {
      // Real video file
    }
    
    if (!this.isFFmpegAvailable()) {
      return {
        duration: 60,
        width: 1920,
        height: 1080,
        fps: 30,
        format: 'mp4',
      };
    }
    
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });
  }
}

// Export singleton instance
export const videoComposer = new VideoComposer();