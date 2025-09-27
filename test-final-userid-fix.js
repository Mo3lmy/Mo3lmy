// Test script to verify userId fix
const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';

// Test credentials
const testUser = {
  email: 'slidetest@example.com',
  password: 'Test123!@#',
  token: null
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testUserIdFix() {
  console.log('🚀 Testing userId Fix Implementation');
  console.log('=====================================\n');

  try {
    // Step 1: Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });

    if (!loginResponse.data.success || !loginResponse.data.data.token) {
      throw new Error('Login failed');
    }

    testUser.token = loginResponse.data.data.token;
    const userId = loginResponse.data.data.user.id;
    console.log(`✅ Logged in successfully`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Token: ${testUser.token.substring(0, 50)}...\n`);

    // Step 2: Request slide generation
    console.log('2️⃣ Requesting slide generation...');
    const lessonId = 'LESSON_1758905299464_qjan5xlid';

    const slidesResponse = await axios.get(
      `${API_URL}/lessons/${lessonId}/slides?theme=modern&generateVoice=true&generateTeaching=true`,
      {
        headers: {
          'Authorization': `Bearer ${testUser.token}`
        }
      }
    );

    if (!slidesResponse.data.success || !slidesResponse.data.data.jobId) {
      throw new Error('Failed to start slide generation');
    }

    const jobId = slidesResponse.data.data.jobId;
    console.log(`✅ Job created: ${jobId}\n`);

    // Step 3: Check job status
    console.log('3️⃣ Checking job status...');
    let attempts = 0;
    let jobComplete = false;

    while (attempts < 30 && !jobComplete) {
      await delay(2000);

      const statusResponse = await axios.get(
        `${API_URL}/slides/job/${jobId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${testUser.token}`
          }
        }
      );

      const status = statusResponse.data.data;
      console.log(`   Attempt ${attempts + 1}: Status = ${status.status}, Progress = ${status.progress}%`);

      if (status.status === 'completed') {
        jobComplete = true;
        console.log(`✅ Job completed successfully!\n`);
      } else if (status.status === 'failed') {
        throw new Error(`Job failed: ${status.error}`);
      }

      attempts++;
    }

    if (!jobComplete) {
      console.log('⚠️ Job still processing after 60 seconds\n');
    }

    // Step 4: Get generated results
    console.log('4️⃣ Getting generation results...');
    const resultsResponse = await axios.get(
      `${API_URL}/slides/${lessonId}/results`,
      {
        headers: {
          'Authorization': `Bearer ${testUser.token}`
        }
      }
    );

    if (resultsResponse.data.success && resultsResponse.data.data) {
      const results = resultsResponse.data.data;
      console.log(`✅ Results retrieved successfully!`);
      console.log(`   Total slides: ${results.htmlSlides ? results.htmlSlides.length : 0}`);
      console.log(`   Has audio URLs: ${results.audioUrls && results.audioUrls.length > 0}`);
      console.log(`   Has teaching scripts: ${results.teachingScripts && results.teachingScripts.length > 0}`);
      console.log(`   User ID in results: ${results.userId}`);

      // Verify userId matches
      if (results.userId === userId) {
        console.log(`\n✅✅✅ SUCCESS: userId matches correctly!`);
        console.log(`   Expected: ${userId}`);
        console.log(`   Got: ${results.userId}`);
      } else {
        console.log(`\n❌❌❌ FAILURE: userId mismatch!`);
        console.log(`   Expected: ${userId}`);
        console.log(`   Got: ${results.userId}`);
      }
    } else {
      console.log('❌ No results found');
    }

    // Step 5: Check Redis keys
    console.log('\n5️⃣ Checking Redis keys...');
    const { exec } = require('child_process');

    exec(`redis-cli KEYS "slides:${lessonId}:*"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error checking Redis: ${error}`);
        return;
      }

      const keys = stdout.trim().split('\n').filter(k => k);
      console.log(`Found ${keys.length} Redis keys:`);
      keys.forEach(key => {
        console.log(`   - ${key}`);
        // Check if key contains correct userId
        if (key.includes(userId)) {
          console.log(`     ✅ Contains correct userId`);
        }
      });
    });

    console.log('\n=====================================');
    console.log('🎉 Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testUserIdFix();