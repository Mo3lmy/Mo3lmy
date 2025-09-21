import { quizService } from './core/quiz/quiz.service';
import { progressService } from './core/progress/progress.service';
import { authService } from './core/auth/auth.service';
import { prisma } from './config/database.config';

async function testQuizSystem() {
  console.log('🧪 Testing Quiz & Progress System...\n');
  
  try {
    // Create or get test user
    let user;
    try {
      user = await authService.register({
        email: 'quiz-test@example.com',
        password: 'Test@1234',
        firstName: 'Quiz',
        lastName: 'Tester',
        grade: 6,
      });
    } catch {
      // User exists, login instead
      user = await authService.login({
        email: 'quiz-test@example.com',
        password: 'Test@1234',
      });
    }
    
    console.log(`👤 Using user: ${user.user.email}\n`);
    
    // Get a lesson
    const lesson = await prisma.lesson.findFirst({
      where: { isPublished: true },
    });
    
    if (!lesson) {
      console.log('❌ No published lesson found');
      return;
    }
    
    console.log(`📚 Using lesson: ${lesson.title}\n`);
    
    // Test 1: Generate questions
    console.log('1️⃣ Generating quiz questions...');
    const questions = await quizService.generateQuizQuestions(lesson.id, 3);
    console.log(`✅ Generated ${questions.length} questions\n`);
    
    // Test 2: Start quiz
    console.log('2️⃣ Starting quiz attempt...');
    const session = await quizService.startQuizAttempt(
      user.user.id as string,
      lesson.id,
      3
    );
    console.log(`✅ Quiz started with ${session.questions.length} questions`);
    console.log(`   Session ID: ${session.id}\n`);
    
    // Test 3: Submit answers
    console.log('3️⃣ Submitting answers...');
    for (let i = 0; i < Math.min(3, session.questions.length); i++) {
      const question = session.questions[i];
      const answer = question.type === 'MCQ' ? '0' : 'test answer';
      
      const isCorrect = await quizService.submitAnswer(
        session.id,
        question.id,
        answer,
        Math.floor(Math.random() * 60) + 10 // Random time 10-70 seconds
      );
      
      console.log(`   Question ${i + 1}: ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
    }
    
    // Test 4: Complete quiz
    console.log('\n4️⃣ Completing quiz...');
    const result = await quizService.completeQuiz(session.id);
    console.log(`✅ Quiz completed!`);
    console.log(`   Score: ${result.percentage}%`);
    console.log(`   Passed: ${result.passed ? 'Yes' : 'No'}`);
    console.log(`   Time spent: ${result.timeSpent} seconds\n`);
    
    // Test 5: Get progress
    console.log('5️⃣ Getting user progress...');
    const progress = await progressService.getUserProgress(user.user.id as string);
    console.log(`✅ Progress retrieved:`);
    console.log(`   Lessons started: ${progress.overall.lessonsStarted}`);
    console.log(`   Lessons completed: ${progress.overall.lessonsCompleted}`);
    console.log(`   Completion rate: ${progress.overall.completionRate}%\n`);
    
    // Test 6: Get learning analytics
    console.log('6️⃣ Getting learning analytics...');
    const analytics = await progressService.getLearningAnalytics(user.user.id as string);
    console.log(`✅ Analytics retrieved:`);
    console.log(`   Mastery level: ${analytics.estimatedMasteryLevel}%`);
    console.log(`   Strengths: ${analytics.strengths.length} topics`);
    console.log(`   Weaknesses: ${analytics.weaknesses.length} topics\n`);
    
    // Test 7: Get quiz statistics
    console.log('7️⃣ Getting quiz statistics...');
    const stats = await quizService.getQuizStatistics(lesson.id);
    console.log(`✅ Statistics retrieved:`);
    console.log(`   Total attempts: ${stats.totalAttempts}`);
    console.log(`   Average score: ${stats.averageScore}%`);
    console.log(`   Pass rate: ${stats.passRate}%\n`);
    
    console.log('🎉 All quiz system tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    await prisma.quizAttemptAnswer.deleteMany({
      where: {
        attempt: {
          user: {
            email: 'quiz-test@example.com',
          },
        },
      },
    });
    await prisma.quizAttempt.deleteMany({
      where: {
        user: {
          email: 'quiz-test@example.com',
        },
      },
    });
    await prisma.$disconnect();
  }
}

// Run tests
testQuizSystem().catch(console.error);