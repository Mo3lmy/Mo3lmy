// Simple test to verify userId is correctly stored and retrieved
const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';

async function testUserId() {
  console.log('🔍 Testing userId Storage and Retrieval');
  console.log('=====================================\n');

  try {
    // Step 1: Login as slidetest user
    console.log('1️⃣ Logging in as slidetest@example.com...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'slidetest@example.com',
      password: 'Test123!@#'
    });

    const token = loginResponse.data.data.token;
    const userId = loginResponse.data.data.user.id;
    console.log(`✅ Logged in: userId = ${userId}\n`);

    // Step 2: Generate slides (this will use the queue)
    console.log('2️⃣ Requesting slides for lesson...');
    const lessonId = 'LESSON_1758905299464_qjan5xlid';

    const slidesResponse = await axios.get(
      `${API_URL}/lessons/${lessonId}/slides?theme=modern&generateVoice=true`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('Response type:', slidesResponse.data.data.jobId ? 'Job' : 'Direct');

    if (slidesResponse.data.data.jobId) {
      const jobId = slidesResponse.data.data.jobId;
      console.log(`✅ Job created: ${jobId}`);
      console.log(`   Expected userId: ${userId}`);

      // Wait for job to complete
      console.log('\n3️⃣ Waiting for job to complete (max 30 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to get results directly from Redis
      console.log('\n4️⃣ Checking Redis for results...');
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);

      // Check what keys exist
      const { stdout: keys } = await execPromise(`redis-cli KEYS "slides:${lessonId}:*"`);
      console.log('Redis keys found:');
      keys.split('\n').filter(k => k).forEach(key => {
        console.log(`   - ${key}`);
      });

      // Get the content of the primary key
      const primaryKey = `slides:${lessonId}:${userId}`;
      try {
        const { stdout: content } = await execPromise(`redis-cli GET "${primaryKey}"`);
        if (content && content !== '(nil)') {
          const data = JSON.parse(content);
          console.log(`\n✅ Found data in Redis with key: ${primaryKey}`);
          console.log(`   Stored userId: ${data.userId}`);
          console.log(`   Matches expected: ${data.userId === userId ? '✅ YES' : '❌ NO'}`);
        } else {
          console.log(`❌ No data found for key: ${primaryKey}`);
        }
      } catch (error) {
        console.log(`❌ Error getting Redis data: ${error.message}`);
      }

      // Also check the latest key
      const latestKey = `slides:${lessonId}:latest`;
      try {
        const { stdout: content } = await execPromise(`redis-cli GET "${latestKey}"`);
        if (content && content !== '(nil)') {
          const data = JSON.parse(content);
          console.log(`\n✅ Found data in fallback key: ${latestKey}`);
          console.log(`   Stored userId: ${data.userId}`);
          console.log(`   Matches expected: ${data.userId === userId ? '✅ YES' : '❌ NO'}`);
        }
      } catch (error) {
        console.log(`❌ Error getting fallback data: ${error.message}`);
      }

    } else {
      console.log('⚠️ Slides generated synchronously (no job)');
    }

    console.log('\n=====================================');
    console.log('✨ Test completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run test
testUserId();