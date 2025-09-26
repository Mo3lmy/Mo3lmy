const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLeaderboard() {
  try {
    const subjectId = 'SUBJECT_1758905283866_v1r8bnb01';
    const grade = 6;
    const limit = 10;

    console.log('1. Testing progress query with distinct...');
    try {
      const progress = await prisma.progress.findMany({
        where: {
          lesson: {
            unit: { subjectId }
          }
        },
        select: { userId: true },
        distinct: ['userId']
      });
      console.log('✅ Progress query successful:', progress.length);
    } catch (err) {
      console.error('❌ Progress query failed:', err.message);
      // Try alternative approach
      console.log('\n2. Testing alternative approach...');
      const progress = await prisma.progress.findMany({
        where: {
          lesson: {
            unit: { subjectId }
          }
        },
        select: { userId: true }
      });
      const uniqueUserIds = [...new Set(progress.map(p => p.userId))];
      console.log('✅ Alternative approach worked:', uniqueUserIds.length, 'unique users');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testLeaderboard();