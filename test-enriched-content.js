/**
 * 🧪 اختبار شامل للمحتوى المثرى
 * يختبر جميع الميزات الجديدة بعد عملية الإثراء
 */

const fetch = require('node-fetch');
const chalk = require('chalk');

const BASE_URL = 'http://localhost:3001';
let authToken = '';
let testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper functions
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  switch(type) {
    case 'success':
      console.log(chalk.green(`✅ [${timestamp}] ${message}`));
      break;
    case 'error':
      console.log(chalk.red(`❌ [${timestamp}] ${message}`));
      break;
    case 'warning':
      console.log(chalk.yellow(`⚠️  [${timestamp}] ${message}`));
      break;
    case 'info':
      console.log(chalk.cyan(`📊 [${timestamp}] ${message}`));
      break;
    case 'header':
      console.log(chalk.bold.magenta(`\n${'='.repeat(60)}\n${message}\n${'='.repeat(60)}`));
      break;
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
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
async function testSystemHealth() {
  log('SYSTEM HEALTH CHECK', 'header');

  try {
    // Check main health endpoint
    const health = await apiCall('/health');
    if (!health.success) {
      throw new Error('Health check failed');
    }

    log('Server Status: ' + health.data.status, 'success');
    log(`Version: ${health.data.version}`, 'info');

    // Check services
    const services = health.data.services;
    const requiredServices = ['database', 'websocket', 'ai', 'teaching'];

    for (const service of requiredServices) {
      if (services[service]) {
        log(`${service}: ${JSON.stringify(services[service])}`, 'success');
      } else {
        log(`${service}: Not available`, 'warning');
        testResults.warnings.push(`Service ${service} not available`);
      }
    }

    testResults.passed.push('System Health Check');
    return true;
  } catch (error) {
    log('System health check failed: ' + error.message, 'error');
    testResults.failed.push('System Health Check: ' + error.message);
    return false;
  }
}

async function testAuthentication() {
  log('AUTHENTICATION', 'header');

  try {
    // Register test user
    const testUser = {
      email: `test_enriched_${Date.now()}@test.com`,
      password: 'Test123456',
      firstName: 'Test',
      lastName: 'Enriched',
      grade: 6
    };

    const register = await apiCall('/api/v1/auth/register', 'POST', testUser);
    if (register.success && register.data?.data?.token) {
      authToken = register.data.data.token;
      log('Authentication successful', 'success');
      testResults.passed.push('Authentication');
      return true;
    } else {
      throw new Error('Failed to authenticate');
    }
  } catch (error) {
    log('Authentication failed: ' + error.message, 'error');
    testResults.failed.push('Authentication: ' + error.message);
    return false;
  }
}

async function testEnrichedExamples() {
  log('ENRICHED EXAMPLES (10+ per lesson)', 'header');

  try {
    // Get lessons
    const lessons = await apiCall('/api/v1/lessons?grade=6');
    if (!lessons.success || !lessons.data?.data?.lessons) {
      throw new Error('Failed to fetch lessons');
    }

    const lessonList = lessons.data.data.lessons.slice(0, 3); // Test first 3 lessons
    let totalExamples = 0;
    let lessonsWithSufficientExamples = 0;

    for (const lesson of lessonList) {
      log(`\nChecking lesson: ${lesson.titleAr || lesson.title}`, 'info');

      // Get lesson content - using correct endpoint structure
      const content = await apiCall(`/api/v1/lessons/${lesson.id}`);
      if (content.success && content.data?.data) {
        const lessonData = content.data.data;

        // Check for examples in different places
        let exampleCount = 0;

        // Check in content field (correct location based on API)
        if (lessonData.content) {
          // Try parsing examples if it's a string
          let examples = lessonData.content.examples;
          if (typeof examples === 'string') {
            try {
              examples = JSON.parse(examples);
            } catch (e) {
              examples = [];
            }
          }
          exampleCount += Array.isArray(examples) ? examples.length : 0;

          // Also check fullText for embedded examples
          if (lessonData.content.fullText) {
            const embeddedExamples = (lessonData.content.fullText.match(/مثال/g) || []).length;
            if (embeddedExamples > 0 && exampleCount === 0) {
              exampleCount = embeddedExamples;
            }
          }
        }

        // Check keyPoints as they might contain examples
        if (lessonData.keyPoints && Array.isArray(lessonData.keyPoints)) {
          const examplePoints = lessonData.keyPoints.filter(point =>
            point.includes('مثال') || point.includes('مثل')
          ).length;
          if (examplePoints > 0) {
            exampleCount += examplePoints;
          }
        }

        totalExamples += exampleCount;

        if (exampleCount >= 10) {
          log(`  ✅ Found ${exampleCount} examples`, 'success');
          lessonsWithSufficientExamples++;
        } else if (exampleCount > 0) {
          log(`  ⚠️  Found only ${exampleCount} examples (need 10+)`, 'warning');
          testResults.warnings.push(`${lesson.title}: Only ${exampleCount} examples`);
        } else {
          log(`  ❌ No examples found`, 'error');
        }
      }
    }

    log(`\nTotal examples found: ${totalExamples}`, 'info');
    log(`Lessons with 10+ examples: ${lessonsWithSufficientExamples}/${lessonList.length}`, 'info');

    if (lessonsWithSufficientExamples > 0) {
      testResults.passed.push(`Enriched Examples (${lessonsWithSufficientExamples} lessons)`);
      return true;
    } else {
      testResults.failed.push('Enriched Examples: No lessons with sufficient examples');
      return false;
    }
  } catch (error) {
    log('Failed to test examples: ' + error.message, 'error');
    testResults.failed.push('Enriched Examples: ' + error.message);
    return false;
  }
}

async function testExercises() {
  log('EXERCISES (20 per lesson)', 'header');

  try {
    const lessons = await apiCall('/api/v1/lessons?grade=6');
    if (!lessons.success || !lessons.data?.data?.lessons) {
      throw new Error('Failed to fetch lessons');
    }

    const lessonList = lessons.data.data.lessons.slice(0, 3);
    let totalExercises = 0;
    let lessonsWithSufficientExercises = 0;

    for (const lesson of lessonList) {
      log(`\nChecking lesson: ${lesson.titleAr || lesson.title}`, 'info');

      const content = await apiCall(`/api/v1/lessons/${lesson.id}`);
      if (content.success && content.data?.data) {
        const lessonData = content.data.data;

        let exerciseCount = 0;

        // Check exercises in content (now properly parsed by API)
        if (lessonData.content?.exercises && Array.isArray(lessonData.content.exercises)) {
          exerciseCount += lessonData.content.exercises.length;
        }

        // Also check enrichedContent if it exists
        if (lessonData.enrichedContent?.exercises && Array.isArray(lessonData.enrichedContent.exercises)) {
          exerciseCount += lessonData.enrichedContent.exercises.length;
        }

        // Check top-level exercises (legacy location)
        if (lessonData.exercises && Array.isArray(lessonData.exercises)) {
          exerciseCount += lessonData.exercises.length;
        }

        totalExercises += exerciseCount;

        if (exerciseCount >= 20) {
          log(`  ✅ Found ${exerciseCount} exercises`, 'success');
          lessonsWithSufficientExercises++;
        } else if (exerciseCount > 0) {
          log(`  ⚠️  Found only ${exerciseCount} exercises (need 20)`, 'warning');
          testResults.warnings.push(`${lesson.title}: Only ${exerciseCount} exercises`);
        } else {
          log(`  ❌ No exercises found`, 'error');
        }
      }
    }

    log(`\nTotal exercises found: ${totalExercises}`, 'info');
    log(`Lessons with 20+ exercises: ${lessonsWithSufficientExercises}/${lessonList.length}`, 'info');

    if (lessonsWithSufficientExercises > 0) {
      testResults.passed.push(`Exercises (${lessonsWithSufficientExercises} lessons)`);
      return true;
    } else {
      testResults.failed.push('Exercises: No lessons with sufficient exercises');
      return false;
    }
  } catch (error) {
    log('Failed to test exercises: ' + error.message, 'error');
    testResults.failed.push('Exercises: ' + error.message);
    return false;
  }
}

async function testCommonMistakes() {
  log('COMMON MISTAKES', 'header');

  try {
    const lessons = await apiCall('/api/v1/lessons?grade=6');
    if (!lessons.success || !lessons.data?.data?.lessons) {
      throw new Error('Failed to fetch lessons');
    }

    const lessonList = lessons.data.data.lessons.slice(0, 3);
    let lessonsWithMistakes = 0;
    let totalMistakes = 0;

    for (const lesson of lessonList) {
      const content = await apiCall(`/api/v1/lessons/${lesson.id}`);
      if (content.success && content.data?.data) {
        const lessonData = content.data.data;

        // Check for common mistakes
        const mistakes =
          lessonData.commonMistakes ||
          lessonData.enrichedContent?.commonMistakes ||
          lessonData.content?.commonMistakes ||
          [];

        if (mistakes.length > 0) {
          log(`  ✅ ${lesson.titleAr}: Found ${mistakes.length} common mistakes`, 'success');
          lessonsWithMistakes++;
          totalMistakes += mistakes.length;
        } else {
          log(`  ⚠️  ${lesson.titleAr}: No common mistakes found`, 'warning');
        }
      }
    }

    log(`\nTotal common mistakes: ${totalMistakes}`, 'info');
    log(`Lessons with mistakes: ${lessonsWithMistakes}/${lessonList.length}`, 'info');

    if (lessonsWithMistakes > 0) {
      testResults.passed.push(`Common Mistakes (${lessonsWithMistakes} lessons)`);
      return true;
    } else {
      testResults.warnings.push('Common Mistakes: No lessons have common mistakes documented');
      return false;
    }
  } catch (error) {
    log('Failed to test common mistakes: ' + error.message, 'error');
    testResults.failed.push('Common Mistakes: ' + error.message);
    return false;
  }
}

async function testRealWorldApplications() {
  log('REAL-WORLD APPLICATIONS', 'header');

  try {
    const lessons = await apiCall('/api/v1/lessons?grade=6');
    if (!lessons.success || !lessons.data?.data?.lessons) {
      throw new Error('Failed to fetch lessons');
    }

    const lessonList = lessons.data.data.lessons.slice(0, 3);
    let lessonsWithApplications = 0;
    let totalApplications = 0;

    for (const lesson of lessonList) {
      const content = await apiCall(`/api/v1/lessons/${lesson.id}`);
      if (content.success && content.data?.data) {
        const lessonData = content.data.data;

        // Check for real-world applications
        const applications =
          lessonData.realWorldApplications ||
          lessonData.enrichedContent?.realWorldApplications ||
          lessonData.content?.applications ||
          [];

        if (applications.length > 0) {
          log(`  ✅ ${lesson.titleAr}: Found ${applications.length} real-world applications`, 'success');
          lessonsWithApplications++;
          totalApplications += applications.length;
        } else {
          log(`  ⚠️  ${lesson.titleAr}: No real-world applications found`, 'warning');
        }
      }
    }

    log(`\nTotal applications: ${totalApplications}`, 'info');
    log(`Lessons with applications: ${lessonsWithApplications}/${lessonList.length}`, 'info');

    if (lessonsWithApplications > 0) {
      testResults.passed.push(`Real-World Applications (${lessonsWithApplications} lessons)`);
      return true;
    } else {
      testResults.warnings.push('Real-World Applications: No lessons have applications');
      return false;
    }
  } catch (error) {
    log('Failed to test applications: ' + error.message, 'error');
    testResults.failed.push('Real-World Applications: ' + error.message);
    return false;
  }
}

async function testQuestionGeneration() {
  log('QUESTION GENERATION', 'header');

  try {
    const lessons = await apiCall('/api/v1/lessons?grade=6');
    if (!lessons.success || !lessons.data?.data?.lessons) {
      throw new Error('Failed to fetch lessons');
    }

    const lesson = lessons.data.data.lessons[0];
    log(`Testing quiz generation for: ${lesson.titleAr || lesson.title}`, 'info');

    // Try to start a quiz
    const quiz = await apiCall('/api/v1/quiz/start', 'POST', {
      lessonId: lesson.id,
      difficulty: 'MEDIUM',
      questionCount: 5
    });

    if (quiz.success && quiz.data?.data?.quiz) {
      const quizData = quiz.data.data.quiz;
      log(`✅ Quiz generated successfully`, 'success');
      log(`  - Quiz ID: ${quizData.id}`, 'info');
      log(`  - Questions: ${quizData.questions?.length || 0}`, 'info');
      log(`  - Difficulty: ${quizData.difficulty}`, 'info');

      testResults.passed.push('Question Generation');
      return true;
    } else {
      log('Quiz generation failed - might need content enrichment', 'warning');
      testResults.warnings.push('Question Generation: Content might not be sufficient');
      return false;
    }
  } catch (error) {
    log('Failed to test question generation: ' + error.message, 'warning');
    testResults.warnings.push('Question Generation: ' + error.message);
    return false;
  }
}

async function testDifficultyLevels() {
  log('DIFFICULTY LEVELS', 'header');

  try {
    const lessons = await apiCall('/api/v1/lessons?grade=6');
    if (!lessons.success || !lessons.data?.data?.lessons) {
      throw new Error('Failed to fetch lessons');
    }

    const lesson = lessons.data.data.lessons[0];
    const difficulties = ['EASY', 'MEDIUM', 'HARD'];
    let successCount = 0;

    for (const difficulty of difficulties) {
      log(`Testing ${difficulty} level...`, 'info');

      const quiz = await apiCall('/api/v1/quiz/start', 'POST', {
        lessonId: lesson.id,
        difficulty: difficulty,
        questionCount: 3
      });

      if (quiz.success && quiz.data?.data?.quiz) {
        log(`  ✅ ${difficulty} quiz generated`, 'success');
        successCount++;
      } else {
        log(`  ⚠️  ${difficulty} quiz failed`, 'warning');
      }
    }

    if (successCount > 0) {
      testResults.passed.push(`Difficulty Levels (${successCount}/3 levels)`);
      return true;
    } else {
      testResults.warnings.push('Difficulty Levels: No levels available');
      return false;
    }
  } catch (error) {
    log('Failed to test difficulty levels: ' + error.message, 'warning');
    testResults.warnings.push('Difficulty Levels: ' + error.message);
    return false;
  }
}

async function testTipsAndStories() {
  log('TIPS AND EDUCATIONAL STORIES', 'header');

  try {
    const lessons = await apiCall('/api/v1/lessons?grade=6');
    if (!lessons.success || !lessons.data?.data?.lessons) {
      throw new Error('Failed to fetch lessons');
    }

    const lessonList = lessons.data.data.lessons.slice(0, 3);
    let lessonsWithTips = 0;
    let lessonsWithStories = 0;

    for (const lesson of lessonList) {
      const content = await apiCall(`/api/v1/lessons/${lesson.id}`);
      if (content.success && content.data?.data) {
        const lessonData = content.data.data;

        // Check for tips
        const tips =
          lessonData.tips ||
          lessonData.enrichedContent?.tips ||
          lessonData.content?.tips ||
          [];

        // Check for stories
        const stories =
          lessonData.educationalStories ||
          lessonData.enrichedContent?.stories ||
          lessonData.content?.stories ||
          [];

        if (tips.length > 0) {
          log(`  ✅ ${lesson.titleAr}: Found ${tips.length} tips`, 'success');
          lessonsWithTips++;
        }

        if (stories.length > 0) {
          log(`  ✅ ${lesson.titleAr}: Found ${stories.length} stories`, 'success');
          lessonsWithStories++;
        }
      }
    }

    log(`\nLessons with tips: ${lessonsWithTips}/${lessonList.length}`, 'info');
    log(`Lessons with stories: ${lessonsWithStories}/${lessonList.length}`, 'info');

    if (lessonsWithTips > 0 || lessonsWithStories > 0) {
      testResults.passed.push(`Tips & Stories (${lessonsWithTips} tips, ${lessonsWithStories} stories)`);
      return true;
    } else {
      testResults.warnings.push('Tips & Stories: No educational content found');
      return false;
    }
  } catch (error) {
    log('Failed to test tips & stories: ' + error.message, 'error');
    testResults.failed.push('Tips & Stories: ' + error.message);
    return false;
  }
}

async function testTeachingAssistant() {
  log('TEACHING ASSISTANT', 'header');

  try {
    const lessons = await apiCall('/api/v1/lessons?grade=6');
    if (!lessons.success || !lessons.data?.data?.lessons) {
      throw new Error('Failed to fetch lessons');
    }

    const lesson = lessons.data.data.lessons[0];

    // Test teaching script generation
    const teachingScript = await apiCall('/api/v1/teaching/generate-script', 'POST', {
      lessonId: lesson.id,
      slideNumber: 1,
      studentName: 'أحمد',
      grade: 6,
      options: {
        voiceStyle: 'friendly',
        useAnalogies: true,
        useStories: true
      }
    });

    if (teachingScript.success && teachingScript.data?.data?.script) {
      log('✅ Teaching script generated successfully', 'success');
      log(`  Script length: ${teachingScript.data.data.script.length} characters`, 'info');

      // Test chat interaction
      const chatResponse = await apiCall('/api/v1/teaching/chat', 'POST', {
        lessonId: lesson.id,
        message: 'اشرح لي هذا الدرس',
        studentId: 'test-student'
      });

      if (chatResponse.success && chatResponse.data?.data?.response) {
        log('✅ Chat interaction successful', 'success');
        testResults.passed.push('Teaching Assistant');
        return true;
      } else {
        log('⚠️  Chat interaction failed', 'warning');
        testResults.warnings.push('Teaching Assistant: Chat not fully functional');
        return false;
      }
    } else {
      log('Teaching script generation failed', 'warning');
      testResults.warnings.push('Teaching Assistant: Script generation issues');
      return false;
    }
  } catch (error) {
    log('Failed to test teaching assistant: ' + error.message, 'warning');
    testResults.warnings.push('Teaching Assistant: ' + error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.clear();
  log('🧪 ENRICHED CONTENT TEST SUITE', 'header');
  log(`Testing against: ${BASE_URL}`, 'info');
  log(`Started at: ${new Date().toLocaleString()}`, 'info');

  const tests = [
    { name: 'System Health', fn: testSystemHealth },
    { name: 'Authentication', fn: testAuthentication },
    { name: 'Enriched Examples', fn: testEnrichedExamples },
    { name: 'Exercises', fn: testExercises },
    { name: 'Common Mistakes', fn: testCommonMistakes },
    { name: 'Real-World Applications', fn: testRealWorldApplications },
    { name: 'Question Generation', fn: testQuestionGeneration },
    { name: 'Difficulty Levels', fn: testDifficultyLevels },
    { name: 'Tips & Stories', fn: testTipsAndStories },
    { name: 'Teaching Assistant', fn: testTeachingAssistant }
  ];

  for (const test of tests) {
    await test.fn();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between tests
  }

  // Print final report
  log('\n📊 FINAL REPORT', 'header');

  if (testResults.passed.length > 0) {
    log('\n✅ PASSED TESTS:', 'success');
    testResults.passed.forEach(test => log(`  • ${test}`, 'success'));
  }

  if (testResults.warnings.length > 0) {
    log('\n⚠️  WARNINGS:', 'warning');
    testResults.warnings.forEach(warning => log(`  • ${warning}`, 'warning'));
  }

  if (testResults.failed.length > 0) {
    log('\n❌ FAILED TESTS:', 'error');
    testResults.failed.forEach(test => log(`  • ${test}`, 'error'));
  }

  const total = tests.length;
  const passRate = Math.round((testResults.passed.length / total) * 100);

  log('\n📈 SUMMARY:', 'header');
  log(`Total Tests: ${total}`, 'info');
  log(`Passed: ${testResults.passed.length}`, 'success');
  log(`Warnings: ${testResults.warnings.length}`, 'warning');
  log(`Failed: ${testResults.failed.length}`, 'error');
  log(`Pass Rate: ${passRate}%`, passRate >= 70 ? 'success' : 'warning');

  if (passRate >= 80) {
    log('\n🎉 Content enrichment is SUCCESSFUL!', 'success');
  } else if (passRate >= 60) {
    log('\n⚠️  Content enrichment is PARTIAL. Review warnings.', 'warning');
  } else {
    log('\n❌ Content enrichment needs more work.', 'error');
  }

  process.exit(testResults.failed.length === 0 ? 0 : 1);
}

// Check server is running
fetch(BASE_URL + '/health')
  .then(response => {
    if (!response.ok) {
      throw new Error('Server health check failed');
    }
    return runTests();
  })
  .catch(error => {
    log('❌ Server is not running!', 'error');
    log('Please start the server with: npm run dev', 'info');
    process.exit(1);
  });