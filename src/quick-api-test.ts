require('dotenv').config();

async function quickAPITest() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  
  console.log('🔑 Testing ElevenLabs API');
  console.log('API Key:', apiKey?.substring(0, 20) + '...');
  console.log('Voice ID:', voiceId);
  console.log('');
  
  if (!apiKey || !voiceId) {
    console.error('❌ Missing credentials!');
    return;
  }
  
  const fetch = require('node-fetch');
  const fs = require('fs/promises');
  const path = require('path');
  
  // Test both Voice IDs
  const voiceIds = [
    { id: voiceId, name: 'From .env file' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Original Voice ID' },
    { id: 'TIqcwupBJYSZbsX4qIBv', name: 'New Voice ID' }
  ];
  
  for (const voice of voiceIds) {
    console.log(`\n🎤 Testing ${voice.name}: ${voice.id}`);
    console.log('─'.repeat(40));
    
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: 'مرحبا، هذا اختبار للصوت.',
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.85,
            },
          }),
        }
      );
      
      if (response.ok) {
        const buffer = await response.buffer();
        const outputDir = path.join(process.cwd(), 'temp', 'api-tests');
        await fs.mkdir(outputDir, { recursive: true });
        
        const filename = `test-${voice.id.substring(0, 10)}.mp3`;
        const filepath = path.join(outputDir, filename);
        
        await fs.writeFile(filepath, buffer);
        console.log(`✅ SUCCESS! Voice works!`);
        console.log(`   File: ${filepath}`);
        console.log(`   Size: ${buffer.length} bytes`);
      } else {
        const error = await response.text();
        console.error(`❌ FAILED: ${response.status}`);
        
        if (response.status === 400) {
          console.error('   → Voice ID not found or invalid');
        } else if (response.status === 401) {
          console.error('   → API Key invalid');
        }
        
        console.error(`   Error: ${error.substring(0, 100)}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ Request failed: ${error.message}`);
      } else {
        console.error(`❌ Request failed: ${String(error)}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test complete! Check which Voice ID worked.');
}

quickAPITest();