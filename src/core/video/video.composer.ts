// src/core/video/video.composer.fixed.ts
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class FixedVideoComposer {
  
  /**
   * طريقة مبسطة وفعالة لتجميع الفيديو
   */
  async composeVideo(
    slidePaths: string[],
    audioPath: string,
    outputPath: string,
    durations: number[]
  ): Promise<void> {
    console.log('\n' + '═'.repeat(60));
    console.log('🎬 تجميع الفيديو بالطريقة المبسطة');
    console.log('═'.repeat(60));
    
    // التحقق من الملفات
    for (const slide of slidePaths) {
      if (!existsSync(slide)) {
        throw new Error(`Slide not found: ${slide}`);
      }
    }
    
    // تحديد نوع الصوت
    const isRealAudio = await this.isRealAudioFile(audioPath);
    
    if (isRealAudio) {
      // استخدم concat بدلاً من xfade (أبسط وأسرع)
      await this.composeSimpleVideo(slidePaths, audioPath, outputPath, durations);
    } else {
      // بدون صوت حقيقي
      await this.composeSilentVideo(slidePaths, outputPath, durations);
    }
    
    const stats = await fs.stat(outputPath);
    console.log(`\n✅ الفيديو جاهز!`);
    console.log(`📁 الحجم: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  }
  
  /**
   * الطريقة البسيطة والفعالة
   */
  private async composeSimpleVideo(
    slidePaths: string[],
    audioPath: string,
    outputPath: string,
    durations: number[]
  ): Promise<void> {
    console.log('🎬 استخدام طريقة concat البسيطة...');
    
    // Step 1: إنشاء ملف concat list
    const listPath = path.join(path.dirname(outputPath), 'input.txt');
    await this.createInputList(slidePaths, durations, listPath);
    
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .input(audioPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'fast',      // أسرع من medium
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-ar', '44100',
          '-shortest',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log('📹 بدء التجميع...');
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            process.stdout.write(`\r⏳ التقدم: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', async () => {
          console.log('\n✅ تم بنجاح!');
          // حذف الملف المؤقت
          try {
            await fs.unlink(listPath);
          } catch {}
          resolve();
        })
        .on('error', (err) => {
          console.error('\n❌ خطأ:', err.message);
          reject(err);
        })
        .run();
    });
  }
  
  /**
   * إنشاء input list للـ concat
   */
  private async createInputList(
    slidePaths: string[],
    durations: number[],
    outputPath: string
  ): Promise<void> {
    let content = '';
    
    for (let i = 0; i < slidePaths.length; i++) {
      // استخدم مسارات مطلقة
      const absolutePath = path.resolve(slidePaths[i]).replace(/\\/g, '/');
      content += `file '${absolutePath}'\n`;
      content += `duration ${durations[i] || 5}\n`;
    }
    
    // أضف آخر ملف مرة أخرى (مطلوب لـ FFmpeg)
    if (slidePaths.length > 0) {
      const lastPath = path.resolve(slidePaths[slidePaths.length - 1]).replace(/\\/g, '/');
      content += `file '${lastPath}'\n`;
      content += `duration 1\n`; // ثانية واحدة للنهاية
    }
    
    await fs.writeFile(outputPath, content, 'utf8');
    console.log(`📝 تم إنشاء قائمة الملفات (${slidePaths.length} شريحة)`);
  }
  
  /**
   * فيديو بدون صوت
   */
  private async composeSilentVideo(
    slidePaths: string[],
    outputPath: string,
    durations: number[]
  ): Promise<void> {
    console.log('🔇 إنشاء فيديو صامت...');
    
    const listPath = path.join(path.dirname(outputPath), 'input.txt');
    await this.createInputList(slidePaths, durations, listPath);
    
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-r', '30',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('end', async () => {
          console.log('✅ فيديو صامت جاهز');
          try {
            await fs.unlink(listPath);
          } catch {}
          resolve();
        })
        .on('error', reject)
        .run();
    });
  }
  
  /**
   * التحقق من نوع الصوت
   */
  private async isRealAudioFile(audioPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(audioPath);
      
      // إذا كان الملف أكبر من 1KB فهو صوت حقيقي
      if (stats.size > 1024) {
        return true;
      }
      
      // جرب قراءته كـ JSON
      const content = await fs.readFile(audioPath, 'utf-8');
      const data = JSON.parse(content);
      return !(data.type === 'mock_audio' || data.type === 'combined_mock_audio');
    } catch {
      // افترض أنه صوت حقيقي
      return true;
    }
  }
  
  /**
   * استخراج صورة مصغرة
   */
  async extractThumbnail(
    videoPath: string,
    outputPath: string,
    timestamp: string = '00:00:02'
  ): Promise<void> {
    // تحقق من وجود الفيديو
    if (!existsSync(videoPath)) {
      console.warn('⚠️ الفيديو غير موجود للصورة المصغرة');
      return;
    }
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: 'thumbnail.png',
          folder: path.dirname(outputPath),
          size: '1920x1080'
        })
        .on('end', () => {
          console.log('📸 تم استخراج الصورة المصغرة');
          resolve();
        })
        .on('error', (err) => {
          console.warn('⚠️ فشل استخراج الصورة المصغرة:', err.message);
          // لا نريد فشل العملية بسبب الصورة المصغرة
          resolve();
        });
    });
  }
}

export const videoComposer = new FixedVideoComposer();

export function composeVideo(slidePaths: string[], finalAudioPath: string, outputPath: string, durations: number[]) {
  throw new Error('Function not implemented.');
}
export function extractThumbnail(outputPath: string, thumbnailPath: string) {
  throw new Error('Function not implemented.');
}

