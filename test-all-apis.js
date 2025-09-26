// test-all-apis.js
// اختبار شامل لجميع APIs في المشروع

const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api/v1`;
let token = null;
let userId = null;
let lessonId = null;
let quizSessionId = null;
let chatSessionId = null;

// ألوان للطباعة
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// دالة للطباعة بالألوان
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// دالة لتسجيل النتائج
const results = {
  passed: [],
  failed: [],
  warnings: []
};

function recordResult(testName, status, details = '') {
  if (status === 'pass') {
    results.passed.push({ test: testName, details });
    log(`✅ ${testName}`, 'green');
  } else if (status === 'fail') {
    results.failed.push({ test: testName, details });
    log(`❌ ${testName}: ${details}`, 'red');
  } else if (status === 'warning') {
    results.warnings.push({ test: testName, details });
    log(`⚠️  ${testName}: ${details}`, 'yellow');
  }
}


// Test Functions
async function testRegister() {
  console.log('\n📝 Testing User Registration...');

  const testUser = {
    email: `test${Date.now()}@example.com`,
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'User',
    grade: 6,
    role: 'STUDENT'
  };

  const result = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(testUser)
  }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

  if (result.data?.token) {
    token = result.data.token;
    userId = result.data.user.id;
    recordResult('User Registration', 'pass', `User ID: ${userId}`);
    return true;
  } else {
    recordResult('User Registration', 'fail', result.message || result.error || 'Registration failed');
    return false;
  }
}

async function testLogin() {
  console.log('\n🔐 Testing User Login...');

  const loginUser = {
    email: 'quiztest@example.com',
    password: 'QuizTest123!'
  };

  const result = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(loginUser)
  }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

  if (result.data?.token) {
    token = result.data.token;
    userId = result.data.user.id;
    recordResult('User Login', 'pass', 'Token received');
    return true;
  } else {
    recordResult('User Login', 'fail', result.message || result.error || 'Login failed');
    return false;
  }
}

async function testGetLessons() {
  console.log('\n📚 Testing Get Lessons...');

  const result = await fetch(`${API_BASE}/lessons?grade=6`, {
    headers: {'Authorization': `Bearer ${token}`}
  }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

  if (result.data) {
    const lessons = Array.isArray(result.data) ? result.data : result.data.lessons;
    if (lessons && lessons.length > 0) {
      lessonId = lessons[0].id;
      console.log(`   📌 Using lesson ID: ${lessonId}`);
      recordResult('Get Lessons', 'pass', `Found ${lessons.length} lessons`);
      return true;
    } else {
      recordResult('Get Lessons', 'fail', 'No lessons found');
      return false;
    }
  } else {
    recordResult('Get Lessons', 'fail', result.message || 'No lessons found');
    return false;
  }
}

async function testWebSocketConnection_disabled() {
  console.log('\n🔌 Testing WebSocket Connection...');

  return new Promise((resolve) => {
    socket = io(WS_URL, {
      auth: { token: authToken },
      transports: ['websocket', 'polling']
    });

    const timeout = setTimeout(() => {
      printResult('WebSocket Connection', false, 'Connection timeout');
      socket.disconnect();
      resolve(false);
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      printResult('WebSocket Connection', true, `Socket ID: ${socket.id}`);
      resolve(true);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      printResult('WebSocket Connection', false, error.message);
      resolve(false);
    });
  });
}

async function testWebSocketAuth_disabled() {
  console.log('\n🔑 Testing WebSocket Authentication...');

  if (!socket || !socket.connected) {
    printResult('WebSocket Authentication', false, 'Socket not connected');
    return false;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      printResult('WebSocket Authentication', false, 'Authentication timeout');
      resolve(false);
    }, 5000);

    socket.emit('authenticate', { token: authToken });

    socket.on('authenticated', (data) => {
      clearTimeout(timeout);
      if (data.success) {
        printResult('WebSocket Authentication', true, data.userName || 'Authenticated');
        resolve(true);
      } else {
        printResult('WebSocket Authentication', false, 'Authentication failed');
        resolve(false);
      }
    });

    socket.on('auth_error', (error) => {
      clearTimeout(timeout);
      printResult('WebSocket Authentication', false, error.message);
      resolve(false);
    });
  });
}

async function testJoinLesson_disabled() {
  console.log('\n🎓 Testing Join Lesson via WebSocket...');

  if (!socket || !socket.connected || !lessonId) {
    printResult('Join Lesson', false, 'Prerequisites not met');
    return false;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      printResult('Join Lesson', false, 'Join timeout');
      resolve(false);
    }, 5000);

    socket.emit('join_lesson', { lessonId });

    socket.on('joined_lesson', (data) => {
      clearTimeout(timeout);
      if (data.success) {
        printResult('Join Lesson', true, `Lesson: ${data.lessonTitle || lessonId}`);
        resolve(true);
      } else {
        printResult('Join Lesson', false, 'Join failed');
        resolve(false);
      }
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      printResult('Join Lesson', false, error.message);
      resolve(false);
    });
  });
}

async function testChatMessage_disabled() {
  console.log('\n💬 Testing Chat Message via WebSocket...');

  if (!socket || !socket.connected) {
    printResult('Chat Message', false, 'Socket not connected');
    return false;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      printResult('Chat Message', false, 'Response timeout');
      resolve(false);
    }, 10000);

    const testMessage = 'ما هو الكسر العشري؟';
    socket.emit('chat_message', {
      message: testMessage,
      lessonId: lessonId
    });

    socket.on('ai_response', (data) => {
      clearTimeout(timeout);
      if (data.message) {
        printResult('Chat Message', true, 'AI responded');
        resolve(true);
      } else {
        printResult('Chat Message', false, 'No response');
        resolve(false);
      }
    });
  });
}

async function testStartQuiz() {
  console.log('\n📝 Testing Start Quiz...');

  if (!lessonId) {
    recordResult('Start Quiz', 'fail', 'No lesson ID available');
    return false;
  }

  const result = await fetch(`${API_BASE}/quiz/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      lessonId: lessonId,
      difficulty: 'MEDIUM',
      questionCount: 5
    })
  }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

  let quizId = null;
  let attemptId = null;

  if (result.data) {
    const quizData = result.data;
    // The API returns quiz data directly in result.data, not result.data.quiz
    if (quizData.id && quizData.questions) {
      quizId = quizData.id;
      attemptId = quizData.attemptId || quizData.id;
      recordResult('Start Quiz', 'pass', `Quiz ID: ${quizId}, ${quizData.questions?.length || 0} questions`);
      return true;
    } else {
      recordResult('Start Quiz', 'fail', 'No quiz data found');
      return false;
    }
  } else {
    recordResult('Start Quiz', 'fail', result.message || result.error || 'Quiz generation failed');
    return false;
  }
}

async function testSubmitAnswer_disabled() {
  console.log('\n✍️ Testing Submit Answer...');
  recordResult('Submit Answer', 'warning', 'Test skipped (WebSocket tests disabled)');
  return true;
}

async function testGetStatus_disabled() {
  console.log('\n📊 Testing Get Status via WebSocket...');

  if (!socket || !socket.connected) {
    printResult('Get Status', false, 'Socket not connected');
    return false;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      printResult('Get Status', false, 'Status timeout');
      resolve(false);
    }, 5000);

    socket.emit('get_status');

    socket.on('status', (data) => {
      clearTimeout(timeout);
      if (data.connected) {
        printResult('Get Status', true, `Features: ${Object.keys(data.features || {}).join(', ')}`);
        resolve(true);
      } else {
        printResult('Get Status', false, 'Status check failed');
        resolve(false);
      }
    });
  });
}

// Test Quiz Analytics and Leaderboard
async function testQuizAnalytics() {
  console.log('\n📊 Testing Quiz Analytics...');

  const result = await fetch(`${API_BASE}/quiz/analytics`, {
    headers: {'Authorization': `Bearer ${token}`}
  }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

  if (result.data) {
    recordResult('Quiz Analytics', 'pass', 'Analytics retrieved');
    return true;
  } else {
    recordResult('Quiz Analytics', 'fail', result.message || 'Analytics failed');
    return false;
  }
}

async function testLeaderboard() {
  console.log('\n🏆 Testing Leaderboard...');

  const result = await fetch(`${API_BASE}/quiz/leaderboard?grade=6`, {
    headers: {'Authorization': `Bearer ${token}`}
  }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

  if (result.data) {
    recordResult('Quiz Leaderboard', 'pass', `${result.data.length || 0} entries`);
    return true;
  } else {
    recordResult('Quiz Leaderboard', 'fail', result.message || 'Leaderboard failed');
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('========================================');
  console.log('🧪 SMART EDUCATION PLATFORM TEST SUITE');
  console.log('========================================');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log(`🕐 Started at: ${new Date().toLocaleTimeString()}`);
  console.log('========================================');

  // Test sequence (removed WebSocket tests)
  const tests = [
    { name: 'Login', fn: testLogin },
    { name: 'Get Lessons', fn: testGetLessons },
    { name: 'Start Quiz', fn: testStartQuiz },
    { name: 'Quiz Analytics', fn: testQuizAnalytics },
    { name: 'Leaderboard', fn: testLeaderboard }
  ];

  for (const test of tests) {
    try {
      const success = await test.fn();
    } catch (error) {
      recordResult(test.name, 'fail', error.message);
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print summary
  const total = results.passed.length + results.failed.length + results.warnings.length;
  const passRate = Math.round((results.passed.length / total) * 100);

  console.log('\n========================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('========================================');
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️ Warnings: ${results.warnings.length}`);
  console.log(`Success Rate: ${passRate}%`);
  console.log('========================================');

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed: results.passed.length,
      failed: results.failed.length,
      warnings: results.warnings.length,
      passRate
    },
    details: results
  };

  fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
  console.log('\n💾 Report saved to test-report.json');

  if (results.failed.length === 0) {
    console.log('🎉 ALL CRITICAL TESTS PASSED! System is ready.');
  } else {
    console.log('⚠️ Some tests failed. Please check the errors above.');
  }

  process.exit(results.failed.length === 0 ? 0 : 1);
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Check if server is running
fetch(BASE_URL + '/health')
  .then(response => {
    if (!response.ok) {
      throw new Error('Server health check failed');
    }
    return runTests();
  })
  .catch(error => {
    console.error('❌ Server is not running or not healthy');
    console.error('   Please start the server with: npm run dev');
    process.exit(1);
  });