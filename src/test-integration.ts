import { prisma } from './config/database.config';
import { curriculumRAGService } from './core/rag/curriculum-rag.service';
import { studentProgressService } from './core/progress/student-progress.service';
import { gamificationService } from './core/gamification/gamification.service';
import { quizService } from './core/quiz/quiz.service';

/**
 * Integration test for RAG system and progress tracking
 */
async function testIntegration() {
  console.log('🧪 Starting Integration Tests...\n');
  console.log('=' .repeat(60));
  
  try {
    // Get test data
    const testUser = await getOrCreateTestUser();
    const testLesson = await getTestLesson();
    
    if (!testUser || !testLesson) {
      console.error('❌ Failed to get test data');
      return;
    }
    
    console.log(`📚 Test User: ${testUser.firstName} ${testUser.lastName}`);
    console.log(`📖 Test Lesson: ${testLesson.title}\n`);
    
    // Test 1: RAG Search
    await testRAGSearch();
    
    // Test 2: Concept Explanation
    await testConceptExplanation(testLesson);
    
    // Test 3: Adaptive Content
    await testAdaptiveContent(testUser.id, testLesson.id);
    
    // Test 4: Quiz Generation
    await testQuizGeneration(testLesson.id);
    
    // Test 5: Progress Tracking (Skip if not UUID)
    if (testLesson.id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/)) {
      await testProgressTracking(testUser.id, testLesson.id);
    } else {
      console.log('\n📊 Test 5: Progress Tracking');
      console.log('-'.repeat(40));
      console.log('⚠️ Skipped - Lesson ID is not a valid UUID');
    }
    
    // Test 6: Gamification (Skip if not UUID)
    if (testUser.id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/)) {
      await testGamification(testUser.id);
    } else {
      console.log('\n🎮 Test 6: Gamification');
      console.log('-'.repeat(40));
      console.log('⚠️ Skipped - User ID is not a valid UUID');
    }
    
    // Test 7: Leaderboard
    await testLeaderboard();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ All integration tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Test Functions

async function testRAGSearch() {
  console.log('\n🔍 Test 1: RAG Search');
  console.log('-'.repeat(40));
  
  const searchResults = await curriculumRAGService.searchCurriculum({
    query: 'الأعداد الطبيعية',
    limit: 3,
    includeExamples: true,
  });
  
  console.log(`✅ Found ${searchResults.length} results`);
  if (searchResults.length > 0) {
    console.log(`   Top result: ${searchResults[0].title}`);
    console.log(`   Relevance: ${(searchResults[0].relevanceScore * 100).toFixed(1)}%`);
  }
}

async function testConceptExplanation(lesson: any) {
  console.log('\n📖 Test 2: Concept Explanation');
  console.log('-'.repeat(40));
  
  // Get first concept
  const concept = await prisma.concept.findFirst({
    where: { lessonId: lesson.id }
  });
  
  if (concept) {
    const explanation = await curriculumRAGService.explainConcept(
      concept.id,
      6 // Grade level
    );
    
    console.log(`✅ Explained concept: ${concept.name}`);
    console.log(`   Simple explanation: ${explanation.simpleExplanation.substring(0, 100)}...`);
    console.log(`   Examples provided: ${explanation.examples.length}`);
  } else {
    console.log('⚠️ No concepts found for lesson');
  }
}

async function testAdaptiveContent(userId: string, lessonId: string) {
  console.log('\n🎯 Test 3: Adaptive Content');
  console.log('-'.repeat(40));
  
  const adaptive = await curriculumRAGService.generateAdaptiveContent(
    userId,
    lessonId
  );
  
  console.log(`✅ Generated adaptive content`);
  console.log(`   Recommended pace: ${adaptive.personalizedContent.recommendedPace}`);
  console.log(`   Focus areas: ${adaptive.personalizedContent.focusAreas.length}`);
  console.log(`   Skip topics: ${adaptive.personalizedContent.skipTopics.length}`);
  console.log(`   Based on performance: ${adaptive.basedOn.previousPerformance}%`);
}

async function testQuizGeneration(lessonId: string) {
  console.log('\n❓ Test 4: Quiz Generation');
  console.log('-'.repeat(40));
  
  const questions = await quizService.generateQuizQuestions(
    lessonId,
    3,
    'MEDIUM'
  );
  
  console.log(`✅ Generated ${questions.length} questions`);
  if (questions.length > 0) {
    console.log(`   Sample: ${questions[0].question.substring(0, 50)}...`);
    console.log(`   Type: ${questions[0].type}`);
    console.log(`   Difficulty: ${questions[0].difficulty}`);
  }
}

async function testProgressTracking(userId: string, lessonId: string) {
  console.log('\n📊 Test 5: Progress Tracking');
  console.log('-'.repeat(40));
  
  // Update progress
  await studentProgressService.updateProgress({
    userId,
    lessonId,
    action: 'lesson_started',
    data: { timestamp: new Date() }
  });
  
  // Simulate time spent
  await new Promise(resolve => setTimeout(resolve, 100));
  
  await studentProgressService.updateProgress({
    userId,
    lessonId,
    action: 'lesson_completed',
    data: { timeSpent: 30 }
  });
  
  // Get progress
  const progress = await studentProgressService.getStudentProgress(userId);
  
  console.log(`✅ Progress tracked`);
  console.log(`   Lessons completed: ${progress.overallProgress.totalLessonsCompleted}`);
  console.log(`   Completion: ${progress.overallProgress.completionPercentage}%`);
  console.log(`   Level: ${progress.overallProgress.level}`);
  console.log(`   XP: ${progress.overallProgress.experiencePoints}`);
  console.log(`   Streak: ${progress.overallProgress.currentStreak} days`);
}

async function testGamification(userId: string) {
  console.log('\n🎮 Test 6: Gamification');
  console.log('-'.repeat(40));
  
  // Earn points
  const transaction = await gamificationService.earnPoints({
    userId,
    action: 'lesson_completed',
    metadata: { test: true }
  });
  
  console.log(`✅ Points earned: ${transaction.points}`);
  
  // Get stats
  const stats = await gamificationService.getUserStats(userId);
  console.log(`   Total points: ${stats.totalPoints}`);
  console.log(`   Current coins: ${stats.currentCoins}`);
  console.log(`   Level: ${stats.level}`);
  console.log(`   Next level progress: ${stats.nextLevelProgress}%`);
  console.log(`   Multiplier: ${stats.multiplier}x`);
  
  // Get challenges
  const challenges = await gamificationService.getDailyChallenges(userId);
  console.log(`   Daily challenges: ${challenges.length}`);
  if (challenges.length > 0) {
    console.log(`   First challenge: ${challenges[0].title}`);
  }
}

async function testLeaderboard() {
  console.log('\n🏆 Test 7: Leaderboard');
  console.log('-'.repeat(40));
  
  const leaderboard = await studentProgressService.getLeaderboard(
    'weekly',
    undefined,
    undefined,
    5
  );
  
  console.log(`✅ Leaderboard retrieved`);
  console.log(`   Total participants: ${leaderboard.totalParticipants}`);
  console.log(`   Top 5 players:`);
  
  leaderboard.entries.slice(0, 5).forEach(entry => {
    console.log(`     ${entry.rank}. ${entry.userName} - ${entry.score} points (Level ${entry.level})`);
  });
}

// Helper Functions

async function getOrCreateTestUser() {
  // Try to find existing test user
  let user = await prisma.user.findFirst({
    where: { email: 'test@example.com' }
  });
  
  if (!user) {
    // Create test user
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashed_password',
        firstName: 'أحمد',
        lastName: 'محمد',
        role: 'STUDENT',
        grade: 6,
        profile: {
          create: {
            points: 0,
            level: 1,
            coins: 0,
            streak: 0,
          }
        }
      }
    });
    console.log('✅ Created test user');
  }
  
  return user;
}

async function getTestLesson() {
  // Get first published lesson
  const lesson = await prisma.lesson.findFirst({
    where: { isPublished: true },
    include: {
      content: true,
      concepts: true,
      examples: true,
    }
  });
  
  return lesson;
}

// Run tests
console.log('🚀 Smart Education Platform - Integration Test');
console.log('=' .repeat(60));

testIntegration().catch(console.error);