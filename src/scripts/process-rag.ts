
// src/scripts/process-enriched-rag.ts
import 'dotenv/config';
import { prisma } from '../config/database.config';
import { documentProcessor } from '../core/rag/document.processor';

async function processEnrichedLessons() {
  console.log('🚀 Processing Enriched Lessons for RAG...\n');
  
  try {
    // جلب الدروس المحسنة
    const enrichedLessons = await prisma.lesson.findMany({
      where: {
        isPublished: true,
        content: {
          enrichmentLevel: { gt: 0 }
        }
      },
      select: {
        id: true,
        title: true
      }
    });
    
    console.log(`📚 Found ${enrichedLessons.length} enriched lessons\n`);
    
    let processed = 0;
    let failed = 0;
    
    // معالجة كل درس
    for (const lesson of enrichedLessons) {
      try {
        console.log(`[${processed + 1}/${enrichedLessons.length}] Processing: ${lesson.title}`);
        
        // استخدام الدالة الموجودة
        await documentProcessor.processLessonContent(lesson.id);
        
        processed++;
        console.log(`   ✅ Done\n`);
        
        // تأخير صغير
        await new Promise(r => setTimeout(r, 1000));
        
      } catch (error: any) {
        failed++;
        console.error(`   ❌ Failed: ${error.message}\n`);
      }
    }
    
    // النتائج
    console.log('═'.repeat(60));
    console.log(`✅ Processed: ${processed} lessons`);
    console.log(`❌ Failed: ${failed} lessons`);
    
    const totalEmbeddings = await prisma.contentEmbedding.count();
    console.log(`📈 Total embeddings: ${totalEmbeddings}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

processEnrichedLessons();