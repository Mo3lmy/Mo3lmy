// src/services/voice/voice.service.ts
// الوظيفة: تحويل النص لصوت باستخدام ElevenLabs API

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../config';

export interface VoiceOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface VoiceGenerationResult {
  success: boolean;
  audioUrl?: string;
  audioPath?: string;
  duration?: number;
  error?: string;
  cached?: boolean;
}

export class VoiceService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';
  private readonly defaultVoiceId: string;
  private readonly defaultModelId: string;
  private readonly cacheDir: string;
  
  constructor() {
  this.apiKey = process.env.ELEVENLABS_API_KEY || '';
  this.defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || 'TX3LPaxmHKxFdv7VOQHJ';
  this.defaultModelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
  this.cacheDir = path.join(process.cwd(), 'temp', 'voice-cache');
  
  // Create cache directory if not exists
  this.ensureCacheDirectory();
  
  if (!this.apiKey) {
    console.warn('⚠️ ElevenLabs API key not configured');
  } else {
    console.log('✅ VoiceService initialized with ElevenLabs');
  }
}
  
  /**
   * تحويل نص لصوت
   */
  async textToSpeech(
    text: string, 
    options?: VoiceOptions
  ): Promise<VoiceGenerationResult> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'ElevenLabs API key not configured'
        };
      }
      
      // Check cache first
      const cacheKey = this.generateCacheKey(text, options);
      const cachedFile = await this.getCachedAudio(cacheKey);
      
      if (cachedFile) {
        console.log('🎵 Using cached audio');
        return {
          success: true,
          audioPath: cachedFile,
          audioUrl: `/audio/${path.basename(cachedFile)}`,
          cached: true
        };
      }
      
      // Prepare request
      const voiceId = options?.voiceId || this.defaultVoiceId;
      const url = `${this.baseUrl}/text-to-speech/${voiceId}`;
      
      const data = {
        text: text,
        model_id: options?.modelId || this.defaultModelId,
        voice_settings: {
  stability: options?.stability ?? parseFloat(process.env.ELEVENLABS_STABILITY || '0.75'),
  similarity_boost: options?.similarityBoost ?? parseFloat(process.env.ELEVENLABS_SIMILARITY_BOOST || '0.85'),
  style: options?.style ?? parseFloat(process.env.ELEVENLABS_STYLE || '0.5'),
  use_speaker_boost: options?.useSpeakerBoost ?? (process.env.ELEVENLABS_USE_SPEAKER_BOOST === 'true')
}
      };
      
      // Make API request
      console.log('🎙️ Generating speech with ElevenLabs...');
      const response = await axios.post(url, data, {
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      });
      
      // Save audio file
      const audioPath = await this.saveAudioFile(response.data, cacheKey);
      
      console.log('✅ Speech generated successfully');
      
      return {
        success: true,
        audioPath,
        audioUrl: `/audio/${path.basename(audioPath)}`,
        cached: false
      };
      
    } catch (error: any) {
      console.error('❌ Voice generation error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Voice generation failed'
      };
    }
  }
  
  /**
   * توليد صوت لشريحة
   */
  async generateSlideNarration(
    slideContent: {
      title?: string;
      content?: string;
      bullets?: string[];
    },
    options?: VoiceOptions
  ): Promise<VoiceGenerationResult> {
    // Build narration text
    let narrationText = '';
    
    if (slideContent.title) {
      narrationText += slideContent.title + '. ';
    }
    
    if (slideContent.content) {
      narrationText += slideContent.content + ' ';
    }
    
    if (slideContent.bullets && slideContent.bullets.length > 0) {
      narrationText += 'النقاط الرئيسية: ';
      slideContent.bullets.forEach((bullet, index) => {
        narrationText += `${index + 1}. ${bullet}. `;
      });
    }
    
    // Clean text for better speech
    narrationText = this.cleanTextForSpeech(narrationText);
    
    return this.textToSpeech(narrationText, options);
  }
  
  /**
   * توليد أصوات لكل شرائح الدرس
   */
  async generateLessonNarration(
    slides: Array<{
      type: string;
      title?: string;
      content?: string;
      bullets?: string[];
    }>,
    options?: VoiceOptions
  ): Promise<VoiceGenerationResult[]> {
    console.log(`🎙️ Generating narration for ${slides.length} slides...`);
    
    const results: VoiceGenerationResult[] = [];
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`  Processing slide ${i + 1}/${slides.length}: ${slide.type}`);
      
      // Skip certain slide types
      if (slide.type === 'quiz' || slide.type === 'image') {
  results.push({
    success: true,
    audioUrl: undefined,  // ✅ استخدم undefined بدلاً من null
    audioPath: undefined  // ✅ استخدم undefined بدلاً من null
  });
  continue;
}
      
      const result = await this.generateSlideNarration(slide, options);
      results.push(result);
      
      // Add delay to avoid rate limiting
      if (i < slides.length - 1 && !result.cached) {
        await this.delay(1000); // 1 second delay between API calls
      }
    }
    
    console.log('✅ All narrations generated');
    return results;
  }
  
  /**
   * الحصول على معلومات الصوت
   */
  async getVoiceInfo(voiceId?: string): Promise<any> {
    try {
      const id = voiceId || this.defaultVoiceId;
      const url = `${this.baseUrl}/voices/${id}`;
      
      const response = await axios.get(url, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });
      
      return response.data;
      
    } catch (error: any) {
      console.error('❌ Error fetching voice info:', error.message);
      return null;
    }
  }
  
  /**
   * قائمة الأصوات المتاحة
   */
  async listAvailableVoices(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/voices`;
      
      const response = await axios.get(url, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });
      
      // Filter for Arabic voices
      const arabicVoices = response.data.voices.filter((voice: any) => 
        voice.labels?.language === 'ar' || 
        voice.labels?.language === 'arabic' ||
        voice.name.toLowerCase().includes('arab')
      );
      
      return arabicVoices;
      
    } catch (error: any) {
      console.error('❌ Error listing voices:', error.message);
      return [];
    }
  }
  
  // ============= PRIVATE HELPER METHODS =============
  
  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Remove extra spaces
      .replace(/[*_~`]/g, '') // Remove markdown
      .replace(/\n+/g, '. ') // Replace newlines with periods
      .replace(/\.+/g, '.') // Remove multiple periods
      .replace(/\s+([.,!?])/g, '$1') // Fix punctuation spacing
      .trim();
  }
  
  private generateCacheKey(text: string, options?: VoiceOptions): string {
    const content = text + JSON.stringify(options || {});
    return crypto.createHash('md5').update(content).digest('hex');
  }
  
  private async getCachedAudio(cacheKey: string): Promise<string | null> {
    const filePath = path.join(this.cacheDir, `${cacheKey}.mp3`);
    
    if (fs.existsSync(filePath)) {
      // Check if file is not too old (24 hours)
      const stats = fs.statSync(filePath);
      const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
      
      if (ageInHours < 24) {
        return filePath;
      }
    }
    
    return null;
  }
  
  private async saveAudioFile(data: Buffer, cacheKey: string): Promise<string> {
    const filePath = path.join(this.cacheDir, `${cacheKey}.mp3`);
    fs.writeFileSync(filePath, data);
    return filePath;
  }
  
  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.log('📁 Created voice cache directory');
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * تنظيف الكاش القديم
   */
  async cleanupCache(maxAgeHours: number = 24): Promise<number> {
    let deletedCount = 0;
    
    try {
      const files = fs.readdirSync(this.cacheDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        const ageInHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (ageInHours > maxAgeHours) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old audio files`);
      }
      
    } catch (error) {
      console.error('❌ Cache cleanup error:', error);
    }
    
    return deletedCount;
  }
}

// Export singleton
export const voiceService = new VoiceService();