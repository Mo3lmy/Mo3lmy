// scripts/export-data.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';

const prisma = new PrismaClient();

async function exportData() {
  console.log('📦 Exporting important data...');
  
  // Export embeddings
  const embeddings = await prisma.contentEmbedding.findMany({
    include: {
      content: true
    }
  });
  
  // Export enriched content
  const content = await prisma.content.findMany({
    where: {
      enrichmentLevel: { gt: 0 }
    }
  });
  
  // Export all lessons with content
  const lessons = await prisma.lesson.findMany({
    include: {
      content: true,
      questions: true,
      concepts: true,
      examples: true,
      formulas: true
    }
  });
  
  const exportData = {
    timestamp: new Date().toISOString(),
    embeddings: embeddings.length,
    enrichedContent: content.length,
    lessons: lessons.length,
    data: {
      embeddings,
      content,
      lessons
    }
  };
  
  await fs.writeFile(
    'data/backup-export.json',
    JSON.stringify(exportData, null, 2)
  );
  
  console.log(`✅ Exported:`);
  console.log(`   - ${embeddings.length} embeddings`);
  console.log(`   - ${content.length} enriched content`);
  console.log(`   - ${lessons.length} lessons`);
  console.log(`   Saved to: data/backup-export.json`);
}

exportData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());