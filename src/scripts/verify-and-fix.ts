import 'dotenv/config';
import { prisma } from '../config/database.config';

async function verifyAndFix() {
  console.log('🔍 Verifying Enrichment Status...\n');
  
  // 1. Check what we have
  const stats = {
    totalLessons: await prisma.lesson.count(),
    hasContent: await prisma.content.count(),
    hasEnrichedContent: await prisma.content.count({
      where: { enrichedContent: { not: null } }
    }),
    hasEnrichmentLevel: await prisma.content.count({
      where: { enrichmentLevel: { gt: 0 } }
    }),
    hasExamples: await prisma.example.count(),
    hasQuestions: await prisma.question.count(),
    hasVisuals: await prisma.visualElement.count()
  };
  
  console.table(stats);
  
  // 2. If enrichedContent exists but enrichmentLevel doesn't, fix it
  if (stats.hasEnrichedContent > stats.hasEnrichmentLevel) {
    console.log('\n🔧 Fixing enrichment levels...');
    
    const toFix = await prisma.content.findMany({
      where: {
        enrichedContent: { not: null },
        OR: [
          { enrichmentLevel: { equals: undefined } },
          { enrichmentLevel: 0 }
        ]
      }
    });
    
    for (const content of toFix) {
      await prisma.content.update({
        where: { id: content.id },
        data: { 
          enrichmentLevel: 10,
          lastEnrichedAt: new Date()
        }
      });
    }
    
    console.log(`✅ Fixed ${toFix.length} records`);
  }
  
  // 3. Now process RAG if needed
  if (stats.hasEnrichedContent > 0) {
    console.log('\n🚀 Ready for RAG processing!');
    console.log('Run: npx ts-node src/scripts/process-rag.ts');
  }
  
  await prisma.$disconnect();
}

verifyAndFix();