// Test slides API
const axios = require('axios');

// Test data
const testLessonId = 'LESSON_1758905299464_qjan5xlid';
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3N2Q3MzMxMS01YTBiLTQ4OWEtYWU3My0wOGZjYjc4YjIzZmIiLCJlbWFpbCI6InNsaWRldGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJTVFVERU5UIiwiaWF0IjoxNzU4OTI5ODUzLCJleHAiOjE3NTk1MzQ2NTN9.qqe45UzgGj0NtM6bmuw-vVVvr-wo9pIY-nrkCU9jSW0';

const API_URL = 'http://localhost:3001/api/v1';

async function testSlidesAPI() {
  console.log('🚀 Testing Slides API...\n');

  try {
    // 1. Test getting lesson details
    console.log('1️⃣ Testing GET /lessons/:id');
    const lessonResponse = await axios.get(
      `${API_URL}/lessons/${testLessonId}`,
      {
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      }
    );
    console.log('✅ Lesson details fetched:', {
      id: lessonResponse.data.data.id,
      title: lessonResponse.data.data.titleAr,
      hasContent: !!lessonResponse.data.data.content,
      hasEnrichedContent: !!lessonResponse.data.data.enrichedContent
    });

    // 2. Test getting slides with queue
    console.log('\n2️⃣ Testing GET /lessons/:id/slides');
    const slidesResponse = await axios.get(
      `${API_URL}/lessons/${testLessonId}/slides?theme=default&generateVoice=true&generateTeaching=true`,
      {
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'X-Session-Id': `test-${Date.now()}`
        }
      }
    );

    if (slidesResponse.data.data.jobId) {
      console.log('✅ Slide generation job started:', {
        jobId: slidesResponse.data.data.jobId,
        status: slidesResponse.data.data.status,
        totalSlides: slidesResponse.data.data.totalSlides
      });

      // 3. Check job status
      console.log('\n3️⃣ Checking job status...');
      let jobComplete = false;
      let attempts = 0;
      const maxAttempts = 30; // Wait max 60 seconds

      while (!jobComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

        const statusResponse = await axios.get(
          `${API_URL}/lessons/slides/job/${slidesResponse.data.data.jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${testToken}`
            }
          }
        );

        console.log(`   Attempt ${attempts + 1}: Status = ${statusResponse.data.data.status}`);

        if (statusResponse.data.data.status === 'completed') {
          jobComplete = true;
          console.log('✅ Slides generated successfully!');
          console.log('   Total slides:', statusResponse.data.data.slides?.length || 0);

          // Display slide details
          if (statusResponse.data.data.slides && statusResponse.data.data.slides.length > 0) {
            console.log('\n📊 Generated Slides:');
            statusResponse.data.data.slides.forEach((slide, index) => {
              console.log(`   Slide ${index + 1}:`, {
                type: slide.type,
                title: slide.title,
                hasHTML: !!slide.html,
                hasAudio: !!slide.audioUrl,
                hasScript: !!slide.script
              });
            });
          }
        } else if (statusResponse.data.data.status === 'failed') {
          console.error('❌ Slide generation failed');
          break;
        }

        attempts++;
      }

      if (!jobComplete) {
        console.log('⏱️ Job still processing after 60 seconds...');
      }
    } else if (slidesResponse.data.data.slides) {
      // Direct slides response
      console.log('✅ Slides fetched directly:', {
        totalSlides: slidesResponse.data.data.slides.length
      });
    }

    // 4. Test teaching script endpoint
    console.log('\n4️⃣ Testing POST /lessons/:id/teaching/script');
    const teachingResponse = await axios.post(
      `${API_URL}/lessons/${testLessonId}/teaching/script`,
      {
        slideContent: {
          type: 'content',
          title: 'مقدمة الدرس',
          content: 'محتوى تعليمي للاختبار'
        },
        generateVoice: false
      },
      {
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Teaching script generated:', {
      hasScript: !!teachingResponse.data.data.script,
      duration: teachingResponse.data.data.duration,
      keyPoints: teachingResponse.data.data.keyPoints?.length || 0
    });

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
  }
}

// Run tests
testSlidesAPI();