// Test optimized slides API
const axios = require('axios');

const testLessonId = 'LESSON_1758905299464_qjan5xlid';
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3N2Q3MzMxMS01YTBiLTQ4OWEtYWU3My0wOGZjYjc4YjIzZmIiLCJlbWFpbCI6InNsaWRldGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJTVFVERU5UIiwiaWF0IjoxNzU4OTI5ODUzLCJleHAiOjE3NTk1MzQ2NTN9.qqe45UzgGj0NtM6bmuw-vVVvr-wo9pIY-nrkCU9jSW0';
const API_URL = 'http://localhost:3001/api/v1';

async function testOptimizedSlides() {
  console.log('🚀 Testing Optimized Slides API...\n');
  const startTime = Date.now();

  try {
    // Test with optimized settings (no voice/teaching)
    console.log('📋 Testing GET /lessons/:id/slides (optimized)');
    const slidesResponse = await axios.get(
      `${API_URL}/lessons/${testLessonId}/slides?theme=default&generateVoice=false&generateTeaching=false`,
      {
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'X-Session-Id': `test-optimized-${Date.now()}`
        }
      }
    );

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    if (slidesResponse.data.data.jobId) {
      console.log('📊 Slide generation queued:', {
        jobId: slidesResponse.data.data.jobId,
        totalSlides: slidesResponse.data.data.totalSlides,
        timeElapsed: `${elapsedTime}s`
      });

      // Check job status a few times
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await axios.get(
          `${API_URL}/lessons/slides/job/${slidesResponse.data.data.jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${testToken}`
            }
          }
        );

        const currentTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`   Check ${attempts + 1}: Status=${statusResponse.data.data.status} (${currentTime}s)`);

        if (statusResponse.data.data.status === 'completed') {
          console.log('\n✅ SUCCESS! Slides generated in', currentTime, 'seconds');
          console.log('   Total slides:', statusResponse.data.data.slides?.length || 0);

          if (statusResponse.data.data.slides) {
            const slideTypes = statusResponse.data.data.slides.map(s => s.type || 'unknown');
            console.log('   Slide types:', slideTypes.join(', '));
          }
          break;
        }

        attempts++;
      }

      const finalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n📊 Total time: ${finalTime} seconds`);

    } else if (slidesResponse.data.data.slides) {
      // Direct response (no queue)
      console.log('✅ Slides returned directly (no queue needed)');
      console.log('   Total slides:', slidesResponse.data.data.slides.length);
      console.log(`   Time: ${elapsedTime} seconds`);
    }

  } catch (error) {
    console.error('❌ Test failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
  }
}

// Wait for server to be ready
setTimeout(() => {
  testOptimizedSlides();
}, 3000);