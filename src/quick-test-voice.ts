import { audioGenerator } from './core/video/audio.generator';
import path from 'path';

/**
 * Quick test for Egyptian voice
 */
async function quickTest() {
  console.log('🚀 Quick Voice Test\n');
  
  const testText = 'أهلاً وسهلاً! النهاردة حنتعلم درس جديد. خلي بالك معايا كويس!';
  
  console.log('📝 Input:', testText);
  console.log('🎙️ Generating audio...\n');
  
  const outputPath = path.join(process.cwd(), 'temp', 'quick-test');
  
  await audioGenerator.generateAudio(
    [{
      id: 'quick',
      type: 'intro',
      title: 'Quick Test',
      narration: testText,
      slides: [],
      duration: 5,
    }],
    outputPath
  );
  
  console.log('✅ Done! Check:', path.join(outputPath, 'audio-section-1.mp3'));
}

quickTest().catch(console.error);