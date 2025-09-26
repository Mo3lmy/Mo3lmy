/**
 * 🧪 Comprehensive API & WebSocket Test Suite
 * Tests all major endpoints and WebSocket events
 */

const fetch = require('node-fetch');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3001';
const WS_URL = 'http://localhost:3001';

// Test user data
const testUser = {
  email: `test_${Date.now()}@example.com`,
  password: 'Test123456', // Simpler password without special chars
  firstName: 'Test',
  lastName: 'User',
  grade: 6
};

let authToken = '';
let userId = '';
let socket = null;
let lessonId = '';
let quizId = '';
let attemptId = '';

// Utility function to print test results
function printResult(testName, success, details = '') {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${testName}${details ? ': ' + details : ''}`);
  if (!success && details) {
    console.log(`   └─ Error: ${details}`);
  }
}

// Utility function to make API calls
async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      ...(body && { body: JSON.stringify(body) })
    };

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Test Functions
async function testRegister() {
  console.log('\n📝 Testing User Registration...');

  const result = await apiCall('/api/v1/auth/register', 'POST', testUser);

  if (result.success && result.data?.data?.token) {
    authToken = result.data.data.token;
    userId = result.data.data.user.id;
    printResult('User Registration', true, `User ID: ${userId}`);
    return true;
  } else {
    printResult('User Registration', false, result.data?.message || result.error);
    return false;
  }
}

async function testLogin() {
  console.log('\n🔐 Testing User Login...');

  const result = await apiCall('/api/v1/auth/login', 'POST', {
    email: testUser.email,
    password: testUser.password
  });

  if (result.success && result.data?.data?.token) {
    authToken = result.data.data.token;
    printResult('User Login', true, `Token received`);
    return true;
  } else {
    printResult('User Login', false, result.data?.message || result.error);
    return false;
  }
}

async function testGetLessons() {
  console.log('\n📚 Testing Get Lessons...');

  const result = await apiCall('/api/v1/lessons?grade=6', 'GET', null, authToken);

  if (result.success && result.data?.data) {
    const lessons = Array.isArray(result.data.data) ? result.data.data : result.data.data.lessons;
    if (lessons && lessons.length > 0) {
      lessonId = lessons[0].id;
      console.log(`   📌 Using lesson ID: ${lessonId}`);
      printResult('Get Lessons', true, `Found ${lessons.length} lessons`);
      return true;
    } else {
      printResult('Get Lessons', false, 'No lessons found');
      return false;
    }
  } else {
    printResult('Get Lessons', false, result.data?.message || 'No lessons found');
    return false;
  }
}

async function testWebSocketConnection() {
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

async function testWebSocketAuth() {
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

async function testJoinLesson() {
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

async function testChatMessage() {
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
    printResult('Start Quiz', false, 'No lesson ID available');
    return false;
  }

  const result = await apiCall('/api/v1/quiz/start', 'POST', {
    lessonId: lessonId,
    difficulty: 'MEDIUM',
    questionCount: 5
  }, authToken);

  if (result.success && result.data?.data) {
    const quizData = result.data.data;
    if (quizData.quiz) {
      quizId = quizData.quiz.id;
      attemptId = quizData.attempt?.id || quizData.attemptId;
      printResult('Start Quiz', true, `Quiz ID: ${quizId}, ${quizData.quiz.questions?.length || 0} questions`);
      return true;
    } else {
      printResult('Start Quiz', false, 'No quiz data found');
      return false;
    }
  } else {
    printResult('Start Quiz', false, result.data?.message || result.error || 'Quiz generation failed');
    return false;
  }
}

async function testSubmitAnswer() {
  console.log('\n✍️ Testing Submit Answer...');

  if (!attemptId) {
    printResult('Submit Answer', false, 'No attempt ID available');
    return false;
  }

  // First, get the quiz to get question IDs
  const quizResult = await apiCall(`/api/v1/quiz/${quizId}`, 'GET', null, authToken);

  if (!quizResult.success || !quizResult.data.questions || quizResult.data.questions.length === 0) {
    printResult('Submit Answer', false, 'Could not get quiz questions');
    return false;
  }

  const firstQuestion = quizResult.data.questions[0];
  const answer = firstQuestion.options ? firstQuestion.options[0] : 'test answer';

  const result = await apiCall('/api/v1/quiz/submit', 'POST', {
    attemptId: attemptId,
    questionId: firstQuestion.id,
    answer: answer,
    timeSpent: 5000
  }, authToken);

  if (result.success) {
    printResult('Submit Answer', true, `Answer submitted, correct: ${result.data.isCorrect}`);
    return true;
  } else {
    printResult('Submit Answer', false, result.data?.message || result.error);
    return false;
  }
}

async function testGetStatus() {
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

// Main test runner
async function runTests() {
  console.log('========================================');
  console.log('🧪 SMART EDUCATION PLATFORM TEST SUITE');
  console.log('========================================');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log(`🕐 Started at: ${new Date().toLocaleTimeString()}`);
  console.log('========================================');

  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  // Test sequence
  const tests = [
    { name: 'Register', fn: testRegister },
    { name: 'Login', fn: testLogin },
    { name: 'Get Lessons', fn: testGetLessons },
    { name: 'WebSocket Connection', fn: testWebSocketConnection },
    { name: 'WebSocket Auth', fn: testWebSocketAuth },
    { name: 'Join Lesson', fn: testJoinLesson },
    { name: 'Chat Message', fn: testChatMessage },
    { name: 'Get Status', fn: testGetStatus },
    { name: 'Start Quiz', fn: testStartQuiz },
    { name: 'Submit Answer', fn: testSubmitAnswer }
  ];

  for (const test of tests) {
    results.total++;
    try {
      const success = await test.fn();
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      results.failed++;
      printResult(test.name, false, error.message);
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Cleanup
  if (socket) {
    socket.disconnect();
  }

  // Print summary
  console.log('\n========================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('========================================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${Math.round((results.passed / results.total) * 100)}%`);
  console.log('========================================');

  if (results.failed === 0) {
    console.log('🎉 ALL TESTS PASSED! System is ready for Frontend integration.');
  } else {
    console.log('⚠️ Some tests failed. Please check the errors above.');
  }

  process.exit(results.failed === 0 ? 0 : 1);
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