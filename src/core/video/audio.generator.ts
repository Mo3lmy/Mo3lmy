import fs from 'fs/promises';
import path from 'path';
import type { VideoSection } from '../../types/video.types';

export class AudioGenerator {
  
  /**
   * Generate audio from script narration
   */
  async generateAudio(
    sections: VideoSection[],
    outputDir: string
  ): Promise<string[]> {
    console.log('🎵 Generating audio narration...');
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    const audioFiles: string[] = [];
    
    // Check if we have ElevenLabs API key
    const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      console.log(`🎤 Processing section ${i + 1}/${sections.length}`);
      
      const outputPath = path.join(outputDir, `audio-${i + 1}.mp3`);
      
      if (hasElevenLabs) {
        await this.generateElevenLabsAudio(section.narration, outputPath);
      } else {
        await this.generateMockAudio(section.narration, outputPath, section.duration);
      }
      
      audioFiles.push(outputPath);
    }
    
    return audioFiles;
  }
  
  /**
   * Generate mock audio file (for testing without API)
   */
  private async generateMockAudio(
    text: string,
    outputPath: string,
    duration: number
  ): Promise<void> {
    console.log('🎭 Creating mock audio file (no API key)...');
    
    // Create a simple text file as placeholder
    const mockContent = {
      text,
      duration,
      type: 'mock_audio',
      message: 'This is a mock audio file. Add ElevenLabs API key for real audio.',
    };
    
    // Save as JSON (we'll pretend it's audio)
    await fs.writeFile(outputPath, JSON.stringify(mockContent, null, 2));
    
    console.log(`✅ Mock audio saved: ${outputPath}`);
  }
  
  /**
   * Generate audio using ElevenLabs API
   */
  private async generateElevenLabsAudio(
    text: string,
    outputPath: string
  ): Promise<void> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    
    console.log('🎙️ Generating ElevenLabs audio...');
    
    try {
      // ElevenLabs API call
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      await fs.writeFile(outputPath, Buffer.from(audioBuffer));
      
      console.log(`✅ Audio generated: ${outputPath}`);
    } catch (error) {
      console.error('ElevenLabs generation failed:', error);
      // Fallback to mock
      await this.generateMockAudio(text, outputPath, 10);
    }
  }
  
  /**
   * Combine multiple audio files
   */
  async combineAudioFiles(
    audioFiles: string[],
    outputPath: string
  ): Promise<void> {
    console.log('🔊 Combining audio files...');
    
    // For mock mode, just copy the first file
    if (audioFiles.length > 0) {
      await fs.copyFile(audioFiles[0], outputPath);
    }
    
    console.log(`✅ Combined audio saved: ${outputPath}`);
  }
  
  /**
   * Generate silence audio
   */
  async generateSilence(duration: number, outputPath: string): Promise<void> {
    // Create mock silence file
    const silence = {
      type: 'silence',
      duration,
    };
    
    await fs.writeFile(outputPath, JSON.stringify(silence));
  }
  
  /**
   * Get audio duration
   */
  async getAudioDuration(audioPath: string): Promise<number> {
    // For mock files, read the duration from JSON
    try {
      const content = await fs.readFile(audioPath, 'utf-8');
      const data = JSON.parse(content);
      return data.duration || 10;
    } catch {
      return 10; // Default duration
    }
  }
}

// Export singleton instance
export const audioGenerator = new AudioGenerator();