const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testQuizAttempt() {
  try {
    console.log('Testing QuizAttempt with answers...');

    // Test 1: Basic query
    const attempt1 = await prisma.quizAttempt.findFirst();
    console.log('✅ Basic query works');

    // Test 2: With answers
    const attempt2 = await prisma.quizAttempt.findFirst({
      include: { answers: true }
    });
    console.log('✅ Query with answers works');

    // Test 3: With answers and question
    const attempt3 = await prisma.quizAttempt.findFirst({
      include: {
        answers: {
          include: { question: true }
        }
      }
    });
    console.log('✅ Query with answers and question works');

    // Test 4: With lesson relation
    const attempt4 = await prisma.quizAttempt.findFirst({
      include: { lesson: true }
    });
    console.log('✅ Query with lesson works');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testQuizAttempt();