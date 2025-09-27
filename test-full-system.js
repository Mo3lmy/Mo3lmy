// Full System Test Script
// Tests all critical functionality

const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';
const FRONTEND_URL = 'http://localhost:3000';

// Test credentials (using existing user)
const testUser = {
  email: 'quiztest@example.com',
  password: 'password123'
};

let authToken = '';
let lessonId = '';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(testName) {
  console.log(`\n${colors.cyan}━━━ Testing: ${testName} ━━━${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

// Test Functions
async function testBackendHealth() {
  logTest('Backend Health');
  try {
    const response = await axios.get(`http://localhost:3001/health`);
    if (response.status === 200) {
      logSuccess('Backend is healthy');
      return true;
    }
  } catch (error) {
    logError(`Backend health check failed: ${error.message}`);
    return false;
  }
}

async function testLogin() {
  logTest('User Authentication');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, testUser);
    if (response.data.success && response.data.data.token) {
      authToken = response.data.data.token;
      logSuccess(`Logged in successfully as ${testUser.email}`);
      log(`Token: ${authToken.substring(0, 20)}...`, colors.blue);
      return true;
    }
  } catch (error) {
    const errorMessage = error.response?.data?.error ||
                        error.response?.data?.message ||
                        error.message ||
                        'Unknown error';
    const errorStr = typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : String(errorMessage);
    logError(`Login failed: ${errorStr}`);

    // Try to create the user if it doesn't exist
    if (errorStr.includes('not found') || errorStr.includes('Invalid') || errorStr.includes('credentials')) {
      logWarning('User might not exist. Trying to create...');
      try {
        const registerResponse = await axios.post(`${API_URL}/auth/register`, {
          ...testUser,
          firstName: 'Test',
          lastName: 'User',
          grade: 6,
          role: 'STUDENT'
        });

        if (registerResponse.data.success) {
          logSuccess('User created successfully. Trying to login again...');
          const loginResponse = await axios.post(`${API_URL}/auth/login`, testUser);
          if (loginResponse.data.success && loginResponse.data.data.token) {
            authToken = loginResponse.data.data.token;
            logSuccess(`Logged in successfully as ${testUser.email}`);
            return true;
          }
        }
      } catch (regError) {
        logWarning(`Registration also failed: ${regError.response?.data?.error || regError.message}`);
      }
    }
    return false;
  }
}

async function testGetLessons() {
  logTest('Fetching Lessons');
  try {
    const response = await axios.get(`${API_URL}/lessons`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success && response.data.data.lessons) {
      const lessons = response.data.data.lessons;
      logSuccess(`Found ${lessons.length} lessons`);

      if (lessons.length > 0) {
        lessonId = lessons[0].id;
        log(`Using lesson: ${lessons[0].titleAr || lessons[0].title} (${lessonId})`, colors.blue);
      }
      return lessons.length > 0;
    }
  } catch (error) {
    logError(`Failed to fetch lessons: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testGetSlides() {
  logTest('Fetching Slides for Lesson');
  try {
    const response = await axios.get(`${API_URL}/lessons/${lessonId}/slides`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success && response.data.data.slides) {
      const slides = response.data.data.slides;
      logSuccess(`Generated ${slides.length} slides`);

      // Check if slides have content
      let hasContent = false;
      slides.forEach((slide, index) => {
        if (slide.html) {
          hasContent = true;
          log(`  Slide ${index + 1}: ${slide.type} - ${slide.title || 'No title'}`, colors.blue);
        }
      });

      if (!hasContent) {
        logWarning('Slides generated but no HTML content found');
      }

      return hasContent;
    }
  } catch (error) {
    logError(`Failed to fetch slides: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testTeachingScript() {
  logTest('Teaching Script Generation');
  try {
    // Test with slideId (simulating frontend behavior)
    const response = await axios.post(
      `${API_URL}/lessons/${lessonId}/teaching/script`,
      {
        slideId: 'slide-1'  // Frontend sends slideId
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.success && response.data.data.script) {
      logSuccess('Teaching script generated successfully');
      log(`Script preview: ${response.data.data.script.substring(0, 100)}...`, colors.blue);

      if (response.data.data.audioUrl) {
        logSuccess('Audio URL generated');
      } else {
        logWarning('No audio URL generated (ElevenLabs might not be configured)');
      }

      return true;
    }
  } catch (error) {
    logError(`Failed to generate teaching script: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testChatIntegration() {
  logTest('Chat Integration with Slides Context');
  try {
    const response = await axios.post(
      `${API_URL}/chat/send`,
      {
        message: 'ما هو موضوع هذا الدرس؟',
        context: {
          lessonId: lessonId,
          currentSlideIndex: 0
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.success && response.data.data.message) {
      logSuccess('Chat responded with lesson context');
      log(`Response: ${response.data.data.message.substring(0, 100)}...`, colors.blue);
      return true;
    }
  } catch (error) {
    logError(`Chat integration failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testFrontendConnection() {
  logTest('Frontend Server');
  try {
    const response = await axios.get(FRONTEND_URL);
    if (response.status === 200) {
      logSuccess('Frontend is accessible');
      return true;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logError('Frontend server is not running on port 3000');
    } else {
      logError(`Frontend connection failed: ${error.message}`);
    }
    return false;
  }
}

async function testGenerateSingleSlide() {
  logTest('Dynamic Slide Generation');
  try {
    const response = await axios.post(
      `${API_URL}/lessons/${lessonId}/slides/generate-single`,
      {
        topic: 'مثال تطبيقي',
        type: 'example'
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.success && response.data.data.slide) {
      logSuccess('Dynamic slide generated successfully');
      log(`Slide type: ${response.data.data.slide.content.type}`, colors.blue);
      log(`Slide title: ${response.data.data.slide.content.title}`, colors.blue);

      if (response.data.data.script) {
        logSuccess('Teaching script included');
      }

      return true;
    }
  } catch (error) {
    logError(`Failed to generate dynamic slide: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log(colors.cyan + '=' .repeat(50));
  console.log('    🧪 SMART EDUCATION PLATFORM - FULL SYSTEM TEST');
  console.log('=' .repeat(50) + colors.reset);
  console.log(`📅 Test Date: ${new Date().toLocaleString('ar-EG')}`);
  console.log(`🔗 Backend URL: ${API_URL}`);
  console.log(`🔗 Frontend URL: ${FRONTEND_URL}\n`);

  const results = {
    backend: false,
    auth: false,
    lessons: false,
    slides: false,
    teaching: false,
    chat: false,
    frontend: false,
    dynamicSlide: false
  };

  // Run tests in sequence
  results.backend = await testBackendHealth();
  if (!results.backend) {
    logError('\nBackend is not running! Please start the backend server first.');
    return;
  }

  await delay(500);
  results.auth = await testLogin();
  if (!results.auth) {
    logError('\nAuthentication failed! Cannot continue tests.');
    return;
  }

  await delay(500);
  results.lessons = await testGetLessons();
  if (!results.lessons) {
    logError('\nNo lessons found! Cannot test slides.');
    return;
  }

  await delay(500);
  results.slides = await testGetSlides();

  await delay(500);
  results.teaching = await testTeachingScript();

  await delay(500);
  results.chat = await testChatIntegration();

  await delay(500);
  results.dynamicSlide = await testGenerateSingleSlide();

  await delay(500);
  results.frontend = await testFrontendConnection();

  // Summary
  console.log(`\n${colors.cyan}${'═'.repeat(50)}`);
  console.log('                 📊 TEST SUMMARY');
  console.log('═'.repeat(50) + colors.reset);

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  const failedTests = totalTests - passedTests;

  console.log('\n📋 Test Results:');
  console.log(`   ✅ Backend Health:     ${results.backend ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✅ Authentication:     ${results.auth ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✅ Lessons API:        ${results.lessons ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✅ Slides Generation:  ${results.slides ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✅ Teaching Script:    ${results.teaching ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✅ Chat Integration:   ${results.chat ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✅ Dynamic Slides:     ${results.dynamicSlide ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✅ Frontend Server:    ${results.frontend ? 'PASSED' : 'FAILED'}`);

  console.log(`\n📊 Overall Score: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log(colors.green + '\n🎉 ALL TESTS PASSED! The system is working correctly!' + colors.reset);
  } else if (passedTests >= totalTests * 0.75) {
    console.log(colors.yellow + `\n⚠️  Most tests passed (${failedTests} failures). System is mostly functional.` + colors.reset);
  } else {
    console.log(colors.red + `\n❌ Multiple failures detected (${failedTests} failures). System needs fixes.` + colors.reset);
  }

  // Recommendations
  if (!results.frontend) {
    console.log('\n💡 Recommendation: Start the frontend server with "cd frontend && npm run dev"');
  }

  if (!results.teaching && results.slides) {
    console.log('\n💡 Recommendation: Check ElevenLabs API configuration for voice generation');
  }

  console.log('\n' + colors.cyan + '═'.repeat(50) + colors.reset);
}

// Run the tests
runAllTests().catch(error => {
  logError(`\nUnexpected error: ${error.message}`);
  process.exit(1);
});