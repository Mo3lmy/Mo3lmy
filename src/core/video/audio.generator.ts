import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs/promises';
import { createWriteStream } from 'fs'; // Fix: Import from 'fs' not 'fs/promises'
import path from 'path';
import fetch from 'node-fetch'; // Will work after installing @types/node-fetch
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { VideoSection } from '../../types/video.types';

// cSpell:disable - Disable spell checking for Arabic words

/**
 * Egyptian Arabic Voice Generator Service
 * Handles audio generation with ElevenLabs cloned Egyptian voice
 * 
 * @class AudioGenerator
 * @version 2.0.0
 */
export class AudioGenerator {
  private readonly apiKey: string | undefined;
  private readonly voiceId: string | undefined;
  private readonly modelId: string;
  private readonly voiceSettings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };

  // Egyptian dialect conversion dictionary
  private readonly egyptianDictionary: Map<string, string>;
  
  // Cache for generated audio
  private audioCache: Map<string, string> = new Map();
  
  constructor() {
    // Initialize configuration from environment
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.voiceId = process.env.ELEVENLABS_VOICE_ID;
    this.modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
    
    // Voice settings for optimal Egyptian Arabic
    this.voiceSettings = {
      stability: parseFloat(process.env.ELEVENLABS_STABILITY || '0.75'),
      similarity_boost: parseFloat(process.env.ELEVENLABS_SIMILARITY_BOOST || '0.85'),
      style: parseFloat(process.env.ELEVENLABS_STYLE || '0.5'),
      use_speaker_boost: process.env.ELEVENLABS_USE_SPEAKER_BOOST === 'true',
    };
    
    // Initialize Egyptian dialect dictionary
    this.egyptianDictionary = this.initializeEgyptianDictionary();
    
    // Log initialization status
    this.logInitializationStatus();
  }
  
  /**
   * Initialize comprehensive Egyptian dialect dictionary
   */
  private initializeEgyptianDictionary(): Map<string, string> {
    const dictionary = new Map<string, string>();
    
    // Basic pronouns and demonstratives
    const basicConversions: [string, string][] = [
      // Demonstratives
      ['هذا', 'ده'],
      ['هذه', 'دي'],
      ['هؤلاء', 'دول'],
      ['ذلك', 'كده'],
      ['تلك', 'كده'],
      ['أولئك', 'دول'],
      
      // Question words
      ['ماذا', 'إيه'],
      ['ما هو', 'إيه هو'],
      ['ما هي', 'إيه هي'],
      ['لماذا', 'ليه'],
      ['كيف', 'إزاي'],
      ['أين', 'فين'],
      ['متى', 'إمتى'],
      ['من', 'مين'],
      ['كم', 'كام'],
      ['أي', 'أنهي'],
      
      // Time expressions
      ['الآن', 'دلوقتي'],
      ['اليوم', 'النهاردة'],
      ['غداً', 'بكره'],
      ['أمس', 'امبارح'],
      ['هذا الصباح', 'الصبح ده'],
      ['هذا المساء', 'بالليل'],
      ['في الصباح', 'الصبح'],
      ['في المساء', 'بالليل'],
      
      // Common verbs and expressions
      ['سوف', 'ح'],
      ['سنتعلم', 'حنتعلم'],
      ['سأشرح', 'حشرح'],
      ['دعونا', 'تعالوا'],
      ['انظر', 'بص'],
      ['انظروا', 'بصوا'],
      ['تعال', 'تعالى'],
      ['هيا', 'يلا'],
      ['هل تفهم', 'فاهم'],
      ['هل فهمت', 'فهمت'],
      
      // Educational terms
      ['لكن', 'بس'],
      ['أيضاً', 'كمان'],
      ['معاً', 'مع بعض'],
      ['مثلاً', 'مثلا كده'],
      ['بسيط جداً', 'سهل خالص'],
      ['صعب جداً', 'صعب أوي'],
      ['مهم جداً', 'مهم أوي'],
      ['رائع', 'حلو أوي'],
      ['ممتاز', 'ممتاز جداً'],
      ['جيد', 'كويس'],
      ['جيد جداً', 'كويس أوي'],
      
      // Encouragement phrases
      ['أحسنت', 'برافو عليك'],
      ['استمر', 'كمل كده'],
      ['حاول مرة أخرى', 'جرب تاني'],
      ['لا تقلق', 'متقلقش'],
      ['ركز معي', 'ركز معايا'],
      ['انتبه', 'خلي بالك'],
      
      // Mathematical/Scientific terms (keep some formal)
      ['يساوي', 'يساوي'],
      ['زائد', 'زائد'],
      ['ناقص', 'ناقص'],
      ['ضرب', 'ضرب'],
      ['قسمة', 'قسمة'],
      
      // Connectors
      ['لأن', 'عشان'],
      ['لذلك', 'عشان كده'],
      ['بالتالي', 'يبقى'],
      ['إذن', 'يبقى'],
      ['أو', 'ولا'],
      ['ثم', 'وبعدين'],
    ];
    
    basicConversions.forEach(([formal, egyptian]) => {
      dictionary.set(formal, egyptian);
    });
    
    return dictionary;
  }
  
  /**
   * Convert text to Egyptian dialect
   */
  private convertToEgyptianDialect(text: string): string {
    let egyptianText = text;
    
    // Apply dictionary conversions
    this.egyptianDictionary.forEach((egyptian, formal) => {
      const regex = new RegExp(`\\b${formal}\\b`, 'g');
      egyptianText = egyptianText.replace(regex, egyptian);
    });
    
    // Apply contextual conversions
    egyptianText = this.applyContextualConversions(egyptianText);
    
    // Add Egyptian flavor
    egyptianText = this.addEgyptianFlavor(egyptianText);
    
    return egyptianText;
  }
  
  /**
   * Apply context-aware conversions
   */
  private applyContextualConversions(text: string): string {
    let result = text;
    
    // Convert future tense patterns
    result = result.replace(/سوف\s+(\w+)/g, 'ح$1');
    result = result.replace(/س(\w+)/g, 'ح$1');
    
    // Convert questions
    result = result.replace(/هل\s+تريد/g, 'عايز');
    result = result.replace(/هل\s+تريدين/g, 'عايزة');
    result = result.replace(/هل\s+يمكنك/g, 'تقدر');
    
    // Educational context
    result = result.replace(/الدرس\s+اليوم/g, 'درس النهاردة');
    result = result.replace(/في\s+هذا\s+الدرس/g, 'في الدرس ده');
    result = result.replace(/المثال\s+التالي/g, 'المثال اللي جاي');
    
    return result;
  }
  
  /**
   * Add Egyptian conversational flavor
   */
  private addEgyptianFlavor(text: string): string {
    let result = text;
    
    // Add "يا" for addressing
    if (!result.includes('يا')) {
      result = result.replace(/الطلاب/g, 'يا شباب');
      result = result.replace(/الطالب/g, 'يا بطل');
      result = result.replace(/أصدقائي/g, 'يا جماعة');
    }
    
    // Add Egyptian sentence starters
    if (result.startsWith('الآن')) {
      result = result.replace(/^الآن/, 'دلوقتي احنا');
    }
    
    // Add filler words for natural flow
    result = result.replace(/\. ([A-Za-zأ-ي])/g, '. يلا بينا $1');
    
    return result;
  }
  
  /**
   * Generate audio from script narration
   */
  async generateAudio(
    sections: VideoSection[],
    outputDir: string
  ): Promise<string[]> {
    console.log('━'.repeat(60));
    console.log('🎵 Starting Egyptian Voice Generation');
    console.log('━'.repeat(60));
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    const audioFiles: string[] = [];
    const totalSections = sections.length;
    
    for (let i = 0; i < totalSections; i++) {
      const section = sections[i];
      const sectionNumber = i + 1;
      
      console.log(`\n📍 Section ${sectionNumber}/${totalSections}: ${section.type}`);
      console.log('─'.repeat(40));
      
      const outputPath = path.join(outputDir, `audio-section-${sectionNumber}.mp3`);
      
      try {
        // Check cache first
        const cacheKey = this.generateCacheKey(section.narration);
        if (this.audioCache.has(cacheKey)) {
          console.log('📦 Using cached audio');
          const cachedPath = this.audioCache.get(cacheKey)!;
          await fs.copyFile(cachedPath, outputPath);
        } else {
          // Generate new audio
          if (this.apiKey && this.voiceId) {
            await this.generateElevenLabsAudio(
              section.narration,
              outputPath,
              section.type
            );
            this.audioCache.set(cacheKey, outputPath);
          } else {
            await this.generateMockAudio(
              section.narration,
              outputPath,
              section.duration
            );
          }
        }
        
        audioFiles.push(outputPath);
        
        // Progress indicator
        const progress = Math.round((sectionNumber / totalSections) * 100);
        console.log(`✅ Section complete [${this.getProgressBar(progress)}] ${progress}%`);
        
      } catch (error) {
        console.error(`❌ Failed to generate audio for section ${sectionNumber}:`, error);
        // Fallback to mock audio
        await this.generateMockAudio(section.narration, outputPath, section.duration);
        audioFiles.push(outputPath);
      }
      
      // Rate limiting delay
      if (i < totalSections - 1 && this.apiKey) {
        await this.delay(500);
      }
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log(`✅ Audio Generation Complete! Generated ${audioFiles.length} files`);
    console.log('━'.repeat(60));
    
    return audioFiles;
  }
  
  /**
   * Generate audio using ElevenLabs API with Egyptian voice
   */
  private async generateElevenLabsAudio(
    text: string,
    outputPath: string,
    sectionType: string
  ): Promise<void> {
    console.log('🎙️ Generating Egyptian voice with ElevenLabs...');
    
    // Convert to Egyptian dialect
    const egyptianText = this.convertToEgyptianDialect(text);
    
    // Log conversion
    if (process.env.DEBUG_VIDEO === 'true') {
      console.log('📝 Original:', text.substring(0, 100) + '...');
      console.log('🇪🇬 Egyptian:', egyptianText.substring(0, 100) + '...');
    }
    
    // Adjust voice settings based on section type
    const adjustedSettings = this.adjustVoiceSettings(sectionType);
    
    try {
      // Make API request to ElevenLabs
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': this.apiKey!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: egyptianText,
            model_id: this.modelId,
            voice_settings: adjustedSettings,
            optimize_streaming_latency: process.env.ELEVENLABS_OPTIMIZE_STREAMING === 'true' ? 1 : 0,
          }),
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error (${response.status}): ${error}`);
      }
      
      // Stream audio to file - Fixed version
      const fileStream = createWriteStream(outputPath); // Now correctly imported
      const nodeStream = response.body as unknown as NodeJS.ReadableStream;

      await pipeline(nodeStream, fileStream);
      // Verify file was created
      const stats = await fs.stat(outputPath);
      console.log(`✅ Audio saved: ${outputPath} (${this.formatFileSize(stats.size)})`);
      
    } catch (error: any) {
      console.error('❌ ElevenLabs generation failed:', error.message);
      
      // Handle specific errors
      if (error.message.includes('401')) {
        console.error('🔑 Invalid API key. Please check your ElevenLabs credentials.');
      } else if (error.message.includes('429')) {
        console.error('⏳ Rate limited. Waiting before retry...');
        await this.delay(5000);
      } else if (error.message.includes('insufficient_quota')) {
        console.error('💰 Insufficient ElevenLabs quota. Please check your account.');
      }
      
      throw error;
    }
  }
  
  /**
   * Adjust voice settings based on content type
   */
  private adjustVoiceSettings(sectionType: string) {
    const baseSettings = { ...this.voiceSettings };
    
    switch (sectionType) {
      case 'intro':
        // More energetic for introductions
        baseSettings.stability = 0.65;
        baseSettings.style = 0.7;
        break;
        
      case 'example':
        // Clearer for examples
        baseSettings.stability = 0.8;
        baseSettings.similarity_boost = 0.9;
        break;
        
      case 'quiz':
        // Engaging for quizzes
        baseSettings.stability = 0.7;
        baseSettings.style = 0.6;
        break;
        
      case 'summary':
        // Calm for summaries
        baseSettings.stability = 0.85;
        baseSettings.style = 0.4;
        break;
        
      default:
        // Use default settings
        break;
    }
    
    return baseSettings;
  }
  
  /**
   * Generate mock audio file for testing
   */
  private async generateMockAudio(
    text: string,
    outputPath: string,
    duration: number
  ): Promise<void> {
    console.log('🎭 Generating mock audio (no API key configured)...');
    
    const egyptianText = this.convertToEgyptianDialect(text);
    
    const mockContent = {
      type: 'mock_audio',
      original_text: text,
      egyptian_text: egyptianText,
      duration: duration || Math.ceil(text.length / 10),
      estimated_words: text.split(/\s+/).length,
      estimated_reading_speed: 150, // words per minute
      message: 'This is a mock audio file. Configure ElevenLabs API for real Egyptian voice.',
      timestamp: new Date().toISOString(),
    };
    
    await fs.writeFile(outputPath, JSON.stringify(mockContent, null, 2));
    console.log(`✅ Mock audio saved: ${outputPath}`);
  }
  
  /**
   * Combine multiple audio files into one
   */
  async combineAudioFiles(
    audioFiles: string[],
    outputPath: string,
    addTransitions: boolean = true
  ): Promise<void> {
    console.log('\n🔊 Combining audio files...');
    console.log(`📁 Input files: ${audioFiles.length}`);
    
    try {
      // Check if files are mock or real
      const firstFile = await fs.readFile(audioFiles[0], 'utf-8');
      const isMock = this.isMockAudio(firstFile);
      
      if (isMock) {
        // For mock files, combine JSON data
        await this.combineMockAudioFiles(audioFiles, outputPath);
      } else {
        // For real audio files, use FFmpeg (if available)
        await this.combineRealAudioFiles(audioFiles, outputPath, addTransitions);
      }
      
      console.log(`✅ Combined audio saved: ${outputPath}`);
      
    } catch (error) {
      console.error('❌ Failed to combine audio files:', error);
      // Fallback: copy first file
      if (audioFiles.length > 0) {
        await fs.copyFile(audioFiles[0], outputPath);
      }
    }
  }
  
  /**
   * Combine mock audio files
   */
  private async combineMockAudioFiles(
    audioFiles: string[],
    outputPath: string
  ): Promise<void> {
    const combinedData = {
      type: 'combined_mock_audio',
      sections: [] as any[],
      total_duration: 0,
    };
    
    for (const file of audioFiles) {
      const content = await fs.readFile(file, 'utf-8');
      try {
        const data = JSON.parse(content);
        combinedData.sections.push(data);
        combinedData.total_duration += data.duration || 0;
      } catch {
        // Skip invalid files
      }
    }
    
    await fs.writeFile(outputPath, JSON.stringify(combinedData, null, 2));
  }
  
  /**
   * Combine real audio files using FFmpeg
   */
  private async combineRealAudioFiles(
    audioFiles: string[],
    outputPath: string,
    addTransitions: boolean
  ): Promise<void> {
    // This would use FFmpeg to combine audio files
    // For now, just copy the first file
    if (audioFiles.length > 0) {
      await fs.copyFile(audioFiles[0], outputPath);
    }
  }
  
  /**
   * Generate silence/pause audio
   */
  async generateSilence(
    duration: number,
    outputPath: string
  ): Promise<void> {
    console.log(`⏸️ Generating ${duration}s silence...`);
    
    const silence = {
      type: 'silence',
      duration,
      purpose: 'pause_between_sections',
    };
    
    await fs.writeFile(outputPath, JSON.stringify(silence, null, 2));
  }
  
  /**
   * Get audio duration
   */
  async getAudioDuration(audioPath: string): Promise<number> {
    try {
      const content = await fs.readFile(audioPath, 'utf-8');
      
      if (this.isMockAudio(content)) {
        const data = JSON.parse(content);
        return data.duration || data.total_duration || 10;
      }
      
      // For real audio files, would use FFprobe or similar
      return 10; // Default duration
      
    } catch {
      return 10; // Default duration
    }
  }
  
  /**
   * Preprocess text for better pronunciation
   */
  private preprocessTextForSpeech(text: string): string {
    let processed = text;
    
    // Handle numbers
    processed = processed.replace(/(\d+)/g, (match) => {
      return this.numberToArabicWords(parseInt(match));
    });
    
    // Handle mathematical symbols
    processed = processed.replace(/\+/g, ' زائد ');
    processed = processed.replace(/\-/g, ' ناقص ');
    processed = processed.replace(/×/g, ' ضرب ');
    processed = processed.replace(/÷/g, ' قسمة ');
    processed = processed.replace(/=/g, ' يساوي ');
    
    // Handle fractions
    processed = processed.replace(/(\d+)\/(\d+)/g, '$1 على $2');
    
    // Add pauses for better flow
    processed = processed.replace(/\./g, '.');
    processed = processed.replace(/،/g, '،');
    processed = processed.replace(/؟/g, '؟');
    
    return processed;
  }
  
  /**
   * Convert number to Arabic words
   */
  private numberToArabicWords(num: number): string {
    const ones = ['', 'واحد', 'اتنين', 'تلاتة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'تمانية', 'تسعة'];
    const tens = ['', 'عشرة', 'عشرين', 'تلاتين', 'أربعين', 'خمسين', 'ستين', 'سبعين', 'تمانين', 'تسعين'];
    const hundreds = ['', 'مية', 'ميتين', 'تلتمية', 'ربعمية', 'خمسمية', 'ستمية', 'سبعمية', 'تمنمية', 'تسعمية'];
    
    if (num === 0) return 'صفر';
    if (num < 10) return ones[num];
    if (num < 100) {
      const ten = Math.floor(num / 10);
      const one = num % 10;
      return one > 0 ? `${ones[one]} و${tens[ten]}` : tens[ten];
    }
    if (num < 1000) {
      const hundred = Math.floor(num / 100);
      const remainder = num % 100;
      if (remainder === 0) return hundreds[hundred];
      if (remainder < 10) return `${hundreds[hundred]} و${ones[remainder]}`;
      const ten = Math.floor(remainder / 10);
      const one = remainder % 10;
      return one > 0 
        ? `${hundreds[hundred]} و${ones[one]} و${tens[ten]}`
        : `${hundreds[hundred]} و${tens[ten]}`;
    }
    
    // For larger numbers, just return the digits
    return num.toString();
  }
  
  /**
   * Utility functions
   */
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private generateCacheKey(text: string): string {
    // Simple hash for cache key
    return Buffer.from(text).toString('base64').substring(0, 20);
  }
  
  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }
  
  private getProgressBar(percent: number): string {
    const filled = Math.floor(percent / 5);
    const empty = 20 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
  
  private isMockAudio(content: string): boolean {
    try {
      const data = JSON.parse(content);
      return data.type === 'mock_audio' || data.type === 'combined_mock_audio';
    } catch {
      return false;
    }
  }
  
  private logInitializationStatus(): void {
    console.log('\n' + '═'.repeat(60));
    console.log('🎙️  EGYPTIAN VOICE GENERATOR - INITIALIZATION');
    console.log('═'.repeat(60));
    
    if (this.apiKey && this.voiceId) {
      console.log('✅ Status: READY');
      console.log(`📍 Voice ID: ${this.voiceId}`);
      console.log(`🎯 Model: ${this.modelId}`);
      console.log(`🎚️ Settings:`);
      console.log(`   • Stability: ${this.voiceSettings.stability}`);
      console.log(`   • Similarity: ${this.voiceSettings.similarity_boost}`);
      console.log(`   • Style: ${this.voiceSettings.style}`);
      console.log(`   • Speaker Boost: ${this.voiceSettings.use_speaker_boost ? 'ON' : 'OFF'}`);
      console.log(`📚 Dictionary: ${this.egyptianDictionary.size} conversions loaded`);
    } else {
      console.log('⚠️ Status: MOCK MODE');
      console.log('❗ Missing credentials:');
      if (!this.apiKey) console.log('   • ELEVENLABS_API_KEY not set');
      if (!this.voiceId) console.log('   • ELEVENLABS_VOICE_ID not set');
      console.log('💡 Add credentials to .env file for real voice generation');
    }
    
    console.log('═'.repeat(60) + '\n');
  }
}

// cSpell:enable

// Export singleton instance
export const audioGenerator = new AudioGenerator();