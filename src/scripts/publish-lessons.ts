import { prisma } from '../config/database.config';

async function publishAllLessons() {
  const result = await prisma.lesson.updateMany({
    data: {
      isPublished: true,
      publishedAt: new Date()
    }
  });
  
  console.log(`✅ تم نشر ${result.count} درس`);
  await prisma.$disconnect();
}

publishAllLessons();