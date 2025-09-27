// Test job status directly from backend
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmN2YzNzI0ZC00NWRhLTQ3MjYtOTllZC05MzI2ZGZmNTk0NGEiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJyb2xlIjoiU1RVREVOVCIsImdyYWRlIjo2LCJpYXQiOjE3NTg5NjczNDMsImV4cCI6MTc1OTU3MjE0M30.Yyb9Xr9tjgMRy68vU5qejyJqf1_n-Cp82MbMaH8XdHA';

async function testJobStatus(jobId) {
  try {
    console.log(`\nTesting job ${jobId}...`);

    const response = await fetch(`${API_URL}/api/v1/lessons/slides/job/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Job ${jobId}: Error - ${data.error?.message || 'Unknown error'}`);
      return null;
    }

    console.log(`✅ Job ${jobId} Status:`, data);

    // Check if completed
    if (data.status === 'completed') {
      console.log(`  - Completed with ${data.slides?.length || 0} slides`);

      // Check slides structure
      if (data.slides?.length > 0) {
        console.log('  - First slide structure:');
        const firstSlide = data.slides[0];
        console.log('    • Has HTML:', !!firstSlide.html);
        console.log('    • Has audioUrl:', !!firstSlide.audioUrl);
        console.log('    • Has script:', !!firstSlide.script);
        console.log('    • Number:', firstSlide.number);
      }
    } else {
      console.log(`  - Status: ${data.status}`);
      console.log(`  - Progress: ${data.progress || 0}%`);
    }

    return data;
  } catch (error) {
    console.error(`❌ Job ${jobId}: Error - ${error.message}`);
    return null;
  }
}

// Test latest jobs
async function main() {
  // Test specific job IDs from the logs
  const jobIds = [162, 161, 160, 159];

  console.log('Testing recent jobs...');

  for (const jobId of jobIds) {
    const result = await testJobStatus(jobId);

    // If we find completed job, check the slides structure
    if (result?.status === 'completed' && result.slides?.length > 0) {
      console.log('\n📊 Found completed job with slides!');
      console.log('Job ID:', jobId);
      console.log('Total slides:', result.slides.length);

      // Check slide transformation issue
      console.log('\n🔍 Checking slide transformation:');
      result.slides.slice(0, 3).forEach((slide, index) => {
        console.log(`\nSlide ${index + 1}:`);
        console.log('  - Number:', slide.number);
        console.log('  - Has HTML:', !!slide.html);
        console.log('  - HTML length:', slide.html?.length || 0);
        console.log('  - Has audioUrl:', !!slide.audioUrl);
        console.log('  - Has script:', !!slide.script);
        console.log('  - Has teachingScript:', !!slide.teachingScript);
      });

      break; // Stop after finding first completed job
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

main().catch(console.error);