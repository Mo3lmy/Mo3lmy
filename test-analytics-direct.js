const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAnalytics() {
  try {
    // Get a test user
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No users found');
      return;
    }
    console.log('Testing with user:', user.id);

    // Test the exact query from progress.service.ts
    console.log('\n1. Testing lesson query with subjectId...');
    const subjectId = 'SUBJECT_1758905283866_v1r8bnb01';

    const lessons = await prisma.lesson.findMany({
      where: {
        unit: { subjectId }
      },
      select: { id: true }
    });
    console.log('Lessons found:', lessons.length);
    const lessonIds = lessons.map(l => l.id);

    console.log('\n2. Testing quizAttempt query...');
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        userId: user.id,
        ...(lessonIds && { lessonId: { in: lessonIds } })
      },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    console.log('✅ Attempts query successful:', attempts.length, 'attempts');

    console.log('\n3. Testing lesson details fetch...');
    const lessonsMap = new Map();
    for (const attempt of attempts) {
      if (!lessonsMap.has(attempt.lessonId)) {
        const lesson = await prisma.lesson.findUnique({
          where: { id: attempt.lessonId },
          include: {
            unit: {
              include: {
                subject: true,
              },
            },
          },
        });
        if (lesson) {
          lessonsMap.set(attempt.lessonId, lesson);
        }
      }
    }
    console.log('✅ Lessons map created:', lessonsMap.size, 'lessons');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testAnalytics();