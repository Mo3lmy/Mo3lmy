// src/scripts/enrich-all.ts
import { contentEnricher } from '../core/ai/content-enricher.service';
import { prisma } from '../config/database.config';

async function enrichAllLessons() {
  console.log('🚀 Starting enrichment for all lessons...\n');
  
  try {
    // جلب كل الدروس
    const lessons = await prisma.lesson.findMany({
      where: { isPublished: true },
      select: { id: true, title: true }
    });
    
    console.log(`📚 Found ${lessons.length} lessons to enrich\n`);
    
    let completed = 0;
    const batchSize = 3;
    
    // معالجة الدروس على دفعات
    for (let i = 0; i < lessons.length; i += batchSize) {
      const batch = lessons.slice(i, i + batchSize);
      
      console.log(`\n🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(lessons.length/batchSize)}`);
      console.log('─'.repeat(50));
      
      // معالجة كل درس في الدفعة
      for (const lesson of batch) {
        try {
          console.log(`\n📖 Enriching: ${lesson.title}`);
          
          await contentEnricher.enrichLesson(lesson.id, {
            level: 'intermediate',
            includeExamples: true,
            includeProblems: true,
            includeVisuals: true,
            includeInteractive: true,
            includeAssessments: true,
            maxExamples: 5,
            maxProblems: 10,
            maxVisuals: 5
          });
          
          completed++;
          console.log(`✅ Completed ${completed}/${lessons.length}`);
          
        } catch (error) {
          console.error(`❌ Failed to enrich ${lesson.title}:`, error);
        }
      }
      
      // انتظار بين الدفعات
      if (i + batchSize < lessons.length) {
        console.log('\n⏳ Waiting 5 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Enrichment Complete!`);
    console.log(`📊 Successfully enriched: ${completed}/${lessons.length} lessons`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Enrichment failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// تشغيل
enrichAllLessons();