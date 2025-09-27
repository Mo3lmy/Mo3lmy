// Test Complete Slides System
// Tests all slide functionality after fixes

const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';

// Use new test user
const testUser = {
  email: 'testslides@example.com',
  password: 'password123'
};

let authToken = '';
let lessonId = '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(testName) {
  console.log(`\n${colors.cyan}━━━ ${testName} ━━━${colors.reset}`);
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

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Delay to avoid rate limiting
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test login with delay for rate limiting
async function testLogin() {
  logTest('Authentication');

  // Wait a bit to avoid rate limiting
  await delay(2000);

  try {
    const response = await axios.post(`${API_URL}/auth/login`, testUser);

    if (response.data.success && response.data.data.token) {
      authToken = response.data.data.token;
      logSuccess(`Logged in as ${testUser.email}`);
      return true;
    }
  } catch (error) {
    if (error.response?.status === 429) {
      logWarning('Rate limited - waiting 10 seconds...');
      await delay(10000);
      return testLogin(); // Retry
    }
    logError(`Login failed: ${error.response?.data?.error?.message || error.message}`);
    return false;
  }
}

// Get first available lesson
async function getFirstLesson() {
  logTest('Finding Lesson');

  try {
    const response = await axios.get(`${API_URL}/lessons`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success && response.data.data.lessons?.length > 0) {
      const lesson = response.data.data.lessons[0];
      lessonId = lesson.id;
      logSuccess(`Using lesson: "${lesson.titleAr || lesson.title}" (${lessonId})`);
      return true;
    }

    logError('No lessons found');
    return false;
  } catch (error) {
    logError(`Failed to get lessons: ${error.message}`);
    return false;
  }
}

// Test getting slides with all parameters
async function testGetSlides() {
  logTest('Fetching Slides with Voice & Teaching');

  try {
    const url = `${API_URL}/lessons/${lessonId}/slides?generateVoice=true&generateTeaching=true&theme=default`;
    logInfo(`Request URL: ${url}`);

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success && response.data.data.slides) {
      const slides = response.data.data.slides;
      logSuccess(`Received ${slides.length} slides`);

      // Analyze first slide structure
      if (slides.length > 0) {
        const firstSlide = slides[0];
        console.log('\n📊 First Slide Analysis:');
        console.log('─'.repeat(40));

        // Check all important fields
        const checks = [
          { field: 'html', label: 'HTML Content', value: !!firstSlide.html },
          { field: 'type', label: 'Type', value: firstSlide.type },
          { field: 'title', label: 'Title', value: firstSlide.title },
          { field: 'subtitle', label: 'Subtitle', value: !!firstSlide.subtitle },
          { field: 'content', label: 'Content', value: !!firstSlide.content },
          { field: 'bullets', label: 'Bullets', value: Array.isArray(firstSlide.bullets) ? firstSlide.bullets.length : false },
          { field: 'audioUrl', label: 'Audio URL', value: !!firstSlide.audioUrl },
          { field: 'teachingScript', label: 'Teaching Script', value: !!firstSlide.teachingScript },
          { field: 'duration', label: 'Duration', value: firstSlide.duration },
        ];

        checks.forEach(check => {
          if (check.value) {
            if (typeof check.value === 'boolean') {
              logSuccess(`${check.label}: Present`);
            } else {
              logSuccess(`${check.label}: ${check.value}`);
            }
          } else {
            logWarning(`${check.label}: Missing`);
          }
        });

        // Display content preview if available
        if (firstSlide.content) {
          console.log('\n📝 Content Preview:');
          console.log('─'.repeat(40));
          log(firstSlide.content.substring(0, 100) + '...', colors.magenta);
        }

        // Display bullets if available
        if (firstSlide.bullets && firstSlide.bullets.length > 0) {
          console.log('\n📌 Bullets:');
          console.log('─'.repeat(40));
          firstSlide.bullets.forEach((bullet, i) => {
            log(`  ${i + 1}. ${bullet}`, colors.magenta);
          });
        }

        // Check teaching script
        if (firstSlide.teachingScript) {
          console.log('\n🎓 Teaching Script Preview:');
          console.log('─'.repeat(40));
          const script = typeof firstSlide.teachingScript === 'object'
            ? firstSlide.teachingScript.script
            : firstSlide.teachingScript;
          if (script) {
            log(script.substring(0, 150) + '...', colors.magenta);
          }
        }
      }

      // Check all slides for completeness
      console.log('\n📈 All Slides Summary:');
      console.log('─'.repeat(40));

      let hasContent = 0;
      let hasAudio = 0;
      let hasTeaching = 0;
      let hasBullets = 0;

      slides.forEach((slide, index) => {
        if (slide.content) hasContent++;
        if (slide.audioUrl) hasAudio++;
        if (slide.teachingScript) hasTeaching++;
        if (slide.bullets && slide.bullets.length > 0) hasBullets++;

        // Log each slide briefly
        const audioStatus = slide.audioUrl ? '🔊' : '🔇';
        const contentStatus = slide.content ? '📄' : '❌';
        const teachingStatus = slide.teachingScript ? '🎓' : '❌';

        console.log(`  Slide ${index + 1}: ${slide.type} - "${slide.title}" ${contentStatus} ${audioStatus} ${teachingStatus}`);
      });

      console.log('\n📊 Statistics:');
      console.log('─'.repeat(40));
      logInfo(`Slides with content: ${hasContent}/${slides.length}`);
      logInfo(`Slides with audio: ${hasAudio}/${slides.length}`);
      logInfo(`Slides with teaching: ${hasTeaching}/${slides.length}`);
      logInfo(`Slides with bullets: ${hasBullets}/${slides.length}`);

      // Overall assessment
      const contentScore = (hasContent / slides.length) * 100;
      const audioScore = (hasAudio / slides.length) * 100;

      if (contentScore >= 80 && audioScore >= 50) {
        logSuccess('System is working well! ✨');
      } else if (contentScore >= 50) {
        logWarning('System is partially working - some features may need attention');
      } else {
        logError('System has significant issues - content is missing');
      }

      return contentScore >= 50;
    }

    logError('No slides data in response');
    return false;
  } catch (error) {
    logError(`Failed to fetch slides: ${error.response?.data?.error?.message || error.message}`);
    if (error.response?.data) {
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Test teaching script endpoint
async function testTeachingScript() {
  logTest('Teaching Script Generation');

  try {
    const response = await axios.post(
      `${API_URL}/lessons/${lessonId}/teaching/script`,
      { slideId: 'slide-1' },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    if (response.data.success && response.data.data.script) {
      logSuccess('Teaching script generated successfully');
      logInfo(`Script length: ${response.data.data.script.length} characters`);

      if (response.data.data.audioUrl) {
        logSuccess('Audio URL included');
      } else {
        logWarning('No audio URL (ElevenLabs might not be configured)');
      }

      return true;
    }

    logError('No script in response');
    return false;
  } catch (error) {
    logError(`Teaching script failed: ${error.response?.data?.error?.message || error.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log(colors.cyan + '═'.repeat(50));
  console.log('     🧪 SLIDES SYSTEM COMPREHENSIVE TEST');
  console.log('═'.repeat(50) + colors.reset);
  console.log(`📅 Date: ${new Date().toLocaleString('ar-EG')}`);
  console.log(`🔗 Backend: ${API_URL}`);
  console.log(`🔗 Frontend: http://localhost:3000`);

  const results = {
    auth: false,
    lesson: false,
    slides: false,
    teaching: false
  };

  // Run tests
  results.auth = await testLogin();
  if (!results.auth) {
    logError('Cannot continue without authentication');
    return;
  }

  await delay(1000);
  results.lesson = await getFirstLesson();
  if (!results.lesson) {
    logError('Cannot test slides without a lesson');
    return;
  }

  await delay(1000);
  results.slides = await testGetSlides();

  await delay(1000);
  results.teaching = await testTeachingScript();

  // Final summary
  console.log('\n' + colors.cyan + '═'.repeat(50));
  console.log('                  FINAL REPORT');
  console.log('═'.repeat(50) + colors.reset);

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;

  console.log('\n📋 Test Results:');
  console.log(`   Authentication:     ${results.auth ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Lesson Found:       ${results.lesson ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Slides System:      ${results.slides ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Teaching Script:    ${results.teaching ? '✅ PASSED' : '❌ FAILED'}`);

  console.log(`\n🏆 Score: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log(colors.green + '\n🎉 ALL TESTS PASSED! The slides system is fully functional!' + colors.reset);
  } else if (passedTests >= 3) {
    console.log(colors.yellow + '\n⚠️  Most features working but some issues remain' + colors.reset);
  } else {
    console.log(colors.red + '\n❌ System has critical issues that need fixing' + colors.reset);
  }

  // Recommendations
  if (!results.slides) {
    console.log('\n💡 Recommendations:');
    console.log('   1. Check that backend is sending complete slide data');
    console.log('   2. Verify generateVoice and generateTeaching parameters');
    console.log('   3. Check console logs in browser for frontend issues');
  }

  console.log('\n' + colors.cyan + '═'.repeat(50) + colors.reset);
}

// Run the tests
runTests().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});