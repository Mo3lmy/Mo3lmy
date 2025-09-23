// src/scripts/fix-enrichment-levels.ts
import 'dotenv/config';
import { prisma } from '../config/database.config';

async function fixEnrichmentLevels() {
  console.log('🔧 Fixing Enrichment Levels...\n');
  
  try {
    // 1. احصل على كل الدروس التي لها examples أو questions
    const lessonsWithContent = await prisma.lesson.findMany({
      include: {
        content: true,
        _count: {
          select: {
            examples: true,
            questions: true,
            visualElements: true,
            interactiveComponents: true
          }
        }
      }
    });
    
    console.log(`Found ${lessonsWithContent.length} lessons to check\n`);
    
    let updated = 0;
    
    for (const lesson of lessonsWithContent) {
      const counts = lesson._count;
      
      // إذا كان الدرس له محتوى محسن (examples, questions, etc)
      if (counts.examples > 0 || counts.questions > 0 || counts.visualElements > 0) {
        
        // حساب مستوى التحسين بناء على العناصر الموجودة
        let enrichmentLevel = 0;
        if (counts.examples > 0) enrichmentLevel += 3;
        if (counts.questions > 0) enrichmentLevel += 3;
        if (counts.visualElements > 0) enrichmentLevel += 2;
        if (counts.interactiveComponents > 0) enrichmentLevel += 2;
        
        enrichmentLevel = Math.min(10, enrichmentLevel);
        
        // بناء محتوى enriched من العناصر الموجودة
        const examples = await prisma.example.findMany({
          where: { lessonId: lesson.id }
        });
        
        const questions = await prisma.question.findMany({
          where: { lessonId: lesson.id }
        });
        
        const visuals = await prisma.visualElement.findMany({
          where: { lessonId: lesson.id }
        });
        
        const enrichedData = {
          enrichmentLevel,
          examples: examples.length,
          questions: questions.length,
          visuals: visuals.length,
          detailedExplanation: lesson.content?.fullText || '',
          realWorldExamples: examples.map(e => ({
            id: e.id,
            title: e.problem,
            description: e.solution,
            type: e.type,
            difficulty: e.difficulty
          })),
          assessmentQuestions: questions.slice(0, 6).map(q => ({
            id: q.id,
            question: q.question,
            type: q.type,
            correctAnswer: q.correctAnswer
          })),
          visualElements: visuals.map(v => ({
            id: v.id,
            type: v.type,
            title: v.title,
            description: v.description
          })),
          metadata: {
            grade: 6,
            subject: 'الرياضيات',
            enrichmentLevel
          }
        };
        
        // تحديث Content
        if (lesson.content) {
          await prisma.content.update({
            where: { id: lesson.content.id },
            data: {
              enrichmentLevel,
              enrichedContent: JSON.stringify(enrichedData),
              lastEnrichedAt: new Date()
            }
          });
          
          updated++;
          console.log(`✅ Updated: ${lesson.title} (Level: ${enrichmentLevel})`);
          console.log(`   Examples: ${counts.examples}, Questions: ${counts.questions}, Visuals: ${counts.visualElements}`);
        }
      }
    }
    
    console.log(`\n✅ Fixed ${updated} lessons`);
    
    // التحقق من النتيجة
    const enrichedCount = await prisma.content.count({
      where: {
        enrichmentLevel: { gt: 0 }
      }
    });
    
    console.log(`\n📊 Final Status:`);
    console.log(`   Total enriched lessons: ${enrichedCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixEnrichmentLevels();