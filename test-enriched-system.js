// test-enriched-system.js
// 🆕 Comprehensive test for all enriched content improvements

const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';
let authToken = null;
let testLessonId = null;

// Test configuration
const testConfig = {
  email: 'test@example.com',
  password: 'Test123!',
  verbose: true
};

// Utility functions
function log(message, type = 'info') {
  if (testConfig.verbose) {
    const timestamp = new Date().toLocaleTimeString();
    let prefix = '';
    switch (type) {
      case 'success':
        prefix = '✅';
        break;
      case 'error':
        prefix = '❌';
        break;
      case 'warning':
        prefix = '⚠️';
        break;
      case 'info':
        prefix = 'ℹ️';
        break;
      default:
        prefix = '📝';
    }
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }
}

// API helper functions
async function makeRequest(method, endpoint, data = null) {
  const config = {
    method,
    url: `${API_URL}${endpoint}`,
    headers: {}
  };

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.data.message || error.message}`);
    }
    throw error;
  }
}

// Test functions
async function testLogin() {
  log('Testing login...', 'info');
  try {
    const response = await makeRequest('POST', '/auth/login', {
      email: testConfig.email,
      password: testConfig.password
    });

    if (response.data && response.data.token) {
      authToken = response.data.token;
      log('Login successful', 'success');
      return true;
    }
  } catch (error) {
    log(`Login failed: ${error.message}`, 'error');
    return false;
  }
}

async function testGetLessons() {
  log('Testing get lessons...', 'info');
  try {
    const response = await makeRequest('GET', '/lessons');

    if (response.data && response.data.lessons && response.data.lessons.length > 0) {
      testLessonId = response.data.lessons[0].id;
      log(`Found ${response.data.lessons.length} lessons`, 'success');
      return true;
    }
  } catch (error) {
    log(`Get lessons failed: ${error.message}`, 'error');
    return false;
  }
}

// 🆕 Test 1: Quiz Service with Enriched Exercises
async function testEnrichedQuizService() {
  log('\n=== Testing Enriched Quiz Service ===', 'info');

  try {
    // Get exercises from enriched content
    log('Getting enriched exercises...', 'info');
    const exercisesResponse = await makeRequest('GET', `/quiz/lessons/${testLessonId}/exercises?count=5`);

    if (exercisesResponse.success && exercisesResponse.data.exercises) {
      log(`Found ${exercisesResponse.data.exercises.length} enriched exercises`, 'success');
      log(`Enrichment level: ${exercisesResponse.data.enrichmentLevel}`, 'info');

      // Show sample exercise
      if (exercisesResponse.data.exercises.length > 0) {
        const sample = exercisesResponse.data.exercises[0];
        log(`Sample exercise: ${sample.question || sample.text}`, 'info');
      }
    }

    // Generate quiz questions
    log('Generating quiz questions from enriched content...', 'info');
    const quizResponse = await makeRequest('POST', '/quiz/generate', {
      lessonId: testLessonId,
      count: 5,
      difficulty: 'MEDIUM'
    });

    if (quizResponse.success && quizResponse.data) {
      log(`Generated ${quizResponse.data.length} quiz questions`, 'success');
      return true;
    }
  } catch (error) {
    log(`Quiz service test failed: ${error.message}`, 'error');
    return false;
  }
}

// 🆕 Test 2: Educational Content Endpoints
async function testEducationalContentEndpoints() {
  log('\n=== Testing Educational Content Endpoints ===', 'info');

  const endpoints = [
    { path: '/tips', name: 'Tips' },
    { path: '/stories', name: 'Stories' },
    { path: '/mistakes', name: 'Common Mistakes' },
    { path: '/applications', name: 'Real-World Applications' },
    { path: '/fun-facts', name: 'Fun Facts' },
    { path: '/challenges', name: 'Challenges' },
    { path: '/visual-aids', name: 'Visual Aids' }
  ];

  let successCount = 0;

  for (const endpoint of endpoints) {
    try {
      log(`Testing ${endpoint.name} endpoint...`, 'info');
      const response = await makeRequest('GET', `/educational/lessons/${testLessonId}${endpoint.path}`);

      if (response.success) {
        const count = response.data.count || 0;
        log(`${endpoint.name}: Found ${count} items`, count > 0 ? 'success' : 'warning');

        if (count > 0) {
          successCount++;
        }
      }
    } catch (error) {
      log(`${endpoint.name} failed: ${error.message}`, 'error');
    }
  }

  // Test random content endpoint
  try {
    log('Testing random content endpoint...', 'info');
    const randomResponse = await makeRequest('GET', `/educational/lessons/${testLessonId}/random`);

    if (randomResponse.success && randomResponse.data.content) {
      log(`Got random content of type: ${randomResponse.data.type}`, 'success');
      successCount++;
    }
  } catch (error) {
    log(`Random content failed: ${error.message}`, 'warning');
  }

  log(`Educational endpoints: ${successCount}/${endpoints.length + 1} successful`,
      successCount > 0 ? 'success' : 'error');

  return successCount > 0;
}

// 🆕 Test 3: Teaching Assistant with Enriched Content
async function testEnrichedTeachingAssistant() {
  log('\n=== Testing Enhanced Teaching Assistant ===', 'info');

  try {
    // Test teaching script generation
    log('Generating teaching script with enriched content...', 'info');
    const scriptResponse = await makeRequest('POST', `/lessons/${testLessonId}/teaching/script`, {
      slideContent: {
        title: 'مقدمة الدرس',
        content: 'محتوى الشريحة'
      },
      generateVoice: false,
      options: {
        useAnalogies: true,
        useStories: true
      }
    });

    if (scriptResponse.success && scriptResponse.data.script) {
      log('Teaching script generated successfully', 'success');
      log(`Script length: ${scriptResponse.data.script.length} characters`, 'info');
      log(`Duration: ${scriptResponse.data.duration} seconds`, 'info');
    }

    // Test interactive content
    log('Testing interactive content retrieval...', 'info');
    const interactionResponse = await makeRequest('POST', `/lessons/${testLessonId}/teaching/interaction`, {
      type: 'example',
      currentSlide: {
        title: 'Test Slide'
      }
    });

    if (interactionResponse.success) {
      log('Interactive content generated successfully', 'success');
    }

    return true;
  } catch (error) {
    log(`Teaching assistant test failed: ${error.message}`, 'error');
    return false;
  }
}

// 🆕 Test 4: Cache System
async function testCacheSystem() {
  log('\n=== Testing Cache System ===', 'info');

  try {
    // Get cache stats
    log('Getting cache statistics...', 'info');
    const statsResponse = await makeRequest('GET', '/lessons/cache/stats');

    if (statsResponse.success && statsResponse.data) {
      const stats = statsResponse.data;
      log(`Cache stats:`, 'info');
      log(`  - Keys: ${stats.keys}`, 'info');
      log(`  - Hits: ${stats.hits}`, 'info');
      log(`  - Misses: ${stats.misses}`, 'info');
      log(`  - Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`, 'info');
      log(`  - Memory usage: ${stats.memoryUsage}`, 'info');
    }

    // Test cache invalidation
    log('Testing cache invalidation...', 'info');
    const invalidateResponse = await makeRequest('POST', `/lessons/${testLessonId}/cache/invalidate`);

    if (invalidateResponse.success) {
      log('Cache invalidation successful', 'success');
    }

    // Test cache warmup
    log('Testing cache warmup...', 'info');
    const warmupResponse = await makeRequest('POST', '/lessons/cache/warmup');

    if (warmupResponse.success) {
      log('Cache warmup successful', 'success');
    }

    return true;
  } catch (error) {
    log(`Cache system test failed: ${error.message}`, 'error');
    return false;
  }
}

// 🆕 Test 5: Performance Test
async function testPerformance() {
  log('\n=== Testing Performance ===', 'info');

  try {
    // Test without cache (first request)
    log('Testing first request (no cache)...', 'info');
    const start1 = Date.now();
    const response1 = await makeRequest('GET', `/lessons/${testLessonId}`);
    const time1 = Date.now() - start1;

    log(`First request time: ${time1}ms`, 'info');

    // Test with cache (second request)
    log('Testing second request (with cache)...', 'info');
    const start2 = Date.now();
    const response2 = await makeRequest('GET', `/lessons/${testLessonId}`);
    const time2 = Date.now() - start2;

    log(`Second request time: ${time2}ms`, 'info');

    if (response2.data && response2.data.fromCache) {
      log('Data served from cache', 'success');
      const improvement = ((time1 - time2) / time1 * 100).toFixed(2);
      log(`Performance improvement: ${improvement}%`, 'success');
    } else {
      log('Data not served from cache', 'warning');
    }

    return true;
  } catch (error) {
    log(`Performance test failed: ${error.message}`, 'error');
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 ENRICHED CONTENT SYSTEM TEST SUITE');
  console.log('='.repeat(60) + '\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  // Login first
  const loginSuccess = await testLogin();
  if (!loginSuccess) {
    log('Cannot proceed without authentication', 'error');
    return;
  }

  // Get lessons
  const lessonsSuccess = await testGetLessons();
  if (!lessonsSuccess || !testLessonId) {
    log('Cannot proceed without lessons', 'error');
    return;
  }

  // Run all tests
  const tests = [
    { name: 'Enriched Quiz Service', fn: testEnrichedQuizService },
    { name: 'Educational Content Endpoints', fn: testEducationalContentEndpoints },
    { name: 'Enhanced Teaching Assistant', fn: testEnrichedTeachingAssistant },
    { name: 'Cache System', fn: testCacheSystem },
    { name: 'Performance', fn: testPerformance }
  ];

  for (const test of tests) {
    results.total++;
    const passed = await test.fn();
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(2)}%`);
  console.log('='.repeat(60) + '\n');

  if (results.failed === 0) {
    console.log('🎉 ALL TESTS PASSED! The enriched content system is working perfectly!');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});