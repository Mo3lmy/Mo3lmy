// src/scripts/verify-status.ts
import 'dotenv/config';
import { prisma } from '../config/database.config';

async function verifyStatus() {
  console.log('📊 System Status Check\n');
  
  const stats = {
    totalLessons: await prisma.lesson.count(),
    enrichedContent: await prisma.content.count({
      where: { enrichmentLevel: { gt: 0 }}
    }),
    examples: await prisma.example.count(),
    questions: await prisma.question.count(),
    visuals: await prisma.visualElement.count(),
    embeddings: await prisma.contentEmbedding.count(),
    qualityRecords: await prisma.contentQuality.count()
  };
  
  console.table(stats);
  
  // عرض عينة من الدروس المحسنة
  const sample = await prisma.content.findMany({
    where: { enrichmentLevel: { gt: 0 }},
    take: 3,
    select: {
      enrichmentLevel: true,
      lastEnrichedAt: true,
      lesson: {
        select: { title: true }
      }
    }
  });
  
  console.log('\n📚 Sample Enriched Lessons:');
  sample.forEach(s => {
    console.log(`   - ${s.lesson.title}: Level ${s.enrichmentLevel}`);
  });
  
  await prisma.$disconnect();
}

verifyStatus();