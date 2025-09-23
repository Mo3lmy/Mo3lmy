// src/scripts/list-lessons.ts
import { prisma } from '../config/database.config';

async function listLessons() {
  const lessons = await prisma.lesson.findMany({
    select: {
      id: true,
      title: true,
      unit: {
        select: {
          title: true,
          subject: {
            select: { name: true, grade: true }
          }
        }
      }
    },
    take: 10
  });
  
  console.log('\n📚 الدروس المتاحة:\n');
  lessons.forEach(lesson => {
    console.log(`ID: ${lesson.id}`);
    console.log(`Title: ${lesson.title}`);
    console.log(`Subject: ${lesson.unit.subject.name} - Grade ${lesson.unit.subject.grade}`);
    console.log('-'.repeat(50));
  });
  
  await prisma.$disconnect();
}

listLessons();