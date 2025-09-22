#!/usr/bin/env node

// MUST BE FIRST - Before ANY imports!
require('dotenv').config();

// Verify env loaded IMMEDIATELY
console.log('✅ Environment loaded');
console.log('API Key:', process.env.ELEVENLABS_API_KEY?.substring(0, 20) + '...');
console.log('Voice ID:', process.env.ELEVENLABS_VOICE_ID);
console.log('');

// NOW we can import - AFTER env is loaded
import('./core/video/audio.generator').then(async (module) => {
  const { audioGenerator } = module;
  const path = require('path');
  const fs = require('fs/promises');
  
  console.log('🎙️ Starting Egyptian Voice Test\n');
  
  const outputDir = path.join(process.cwd(), 'temp', 'working-test');
  await fs.mkdir(outputDir, { recursive: true });
  
  try {
    const files = await audioGenerator.generateAudio(
      [{
        id: 'test',
        type: 'intro',
        title: 'Working Test',
        narration: 'مرحباً! النهاردة حنتعلم درس جميل. خلي بالك معايا.',
        slides: [],
        duration: 5,
      }],
      outputDir
    );
    
    console.log('✅ Generated:', files[0]);
    
    // Check if real audio
    const buffer = await fs.readFile(files[0]);
    const isReal = buffer[0] !== 123; // Not '{'
    
    if (isReal) {
      console.log('🎉 SUCCESS! Real audio file generated!');
      console.log('Size:', buffer.length, 'bytes');
    } else {
      console.log('❌ Still mock - check initialization logs above');
    }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('Error:', error);
    }
  }
}).catch(console.error);