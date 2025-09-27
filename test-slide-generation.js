const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testSlideGeneration() {
  try {
    // Get first lesson
    const lesson = await prisma.lesson.findFirst({
      where: { isPublished: true }
    });

    if (!lesson) {
      console.log('❌ No lessons found in database');
      return;
    }

    console.log(`✅ Found lesson: ${lesson.title} (ID: ${lesson.id})`);

    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3N2Q3MzMxMS01YTBiLTQ4OWEtYWU3My0wOGZjYjc4YjIzZmIiLCJlbWFpbCI6InNsaWRldGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJTVFVERU5UIiwiaWF0IjoxNzU4OTI5ODUzLCJleHAiOjE3NTk1MzQ2NTN9.qqe45UzgGj0NtM6bmuw-vVVvr-wo9pIY-nrkCU9jSW0';

    // Test slide generation with queue
    console.log('🔧 Testing slide generation with queue...');
    const response = await axios.get(
      `http://localhost:3001/api/v1/lessons/${lesson.id}/slides?generateVoice=false&generateTeaching=true`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Session-Id': 'test-session-123'
        }
      }
    );

    console.log('📋 Response:', {
      success: response.data.success,
      hasJobId: !!response.data.data?.jobId,
      jobId: response.data.data?.jobId
    });

    if (response.data.data?.jobId) {
      console.log(`✅ Job queued successfully: ${response.data.data.jobId}`);
      console.log('⏳ Check job status at: /api/v1/lessons/slides/job/' + response.data.data.jobId);

      // Wait a bit then check status
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        const statusResponse = await axios.get(
          `http://localhost:3001/api/v1/lessons/slides/job/${response.data.data.jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        console.log('📊 Job Status:', statusResponse.data.data);
      } catch (err) {
        console.log('⚠️ Could not check job status:', err.message);
      }
    } else {
      console.log('✅ Slides generated synchronously');
      console.log('📊 Number of slides:', response.data.data?.slides?.length || 0);
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testSlideGeneration();