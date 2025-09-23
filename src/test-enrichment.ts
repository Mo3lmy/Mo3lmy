// 📍 المكان: src/test-enrichment.ts
// الوظيفة: اختبار نظام التحسين الجديد

import { multiAgentSystem } from './core/ai/multi-agent.system';
import { contentEnricher } from './core/ai/content-enricher.service';
import { documentProcessor } from './core/rag/document.processor';
import { ragService } from './core/rag/rag.service';
import { prisma } from './config/database.config';

async function testEnrichmentSystem() {
  console.log('🧪 TESTING CONTENT ENRICHMENT SYSTEM');
  console.log('═'.repeat(60));
  
  try {
    // اختبار 1: جلب درس للاختبار
    console.log('\n📚 Test 1: Fetching test lesson...');
    const lesson = await prisma.lesson.findFirst({
      where: { isPublished: true },
      include: {
        content: true,
        unit: {
          include: {
            subject: true,
          },
        },
      },
    });
    
    if (!lesson) {
      console.error('❌ No published lesson found');
      return;
    }
    
    console.log(`✅ Found lesson: ${lesson.title}`);
    console.log(`   Subject: ${lesson.unit.subject.name}`);
    console.log(`   Grade: ${lesson.unit.subject.grade}`);
    
    // اختبار 2: تحسين المحتوى بـ Multi-Agent
    console.log('\n🤖 Test 2: Multi-Agent Content Enrichment...');
    console.log('─'.repeat(50));
    
    const enrichedContent = await multiAgentSystem.enrichLessonContent(lesson, {
      targetDepth: 'intermediate',
      includeVisuals: true,
      includeInteractive: true,
      maxExamples: 3,
      maxProblems: 5,
    });
    
    console.log('✅ Content enriched successfully!');
    console.log(`   Original length: ${lesson.content?.fullText?.length || 0} chars`);
    console.log(`   Enriched length: ${enrichedContent.enrichedText.length} chars`);
    console.log(`   Examples added: ${enrichedContent.realWorldExamples.length}`);
    console.log(`   Problems added: ${enrichedContent.practiceProblems.length}`);
    console.log(`   Visuals designed: ${enrichedContent.visualElements.length}`);
    console.log(`   Interactive components: ${enrichedContent.interactiveComponents.length}`);
    console.log(`   Assessment questions: ${enrichedContent.assessmentQuestions.length}`);
    console.log(`   Enrichment level: ${enrichedContent.metadata.enrichmentLevel}/10`);
    
    // اختبار 3: Content Enricher Service
    console.log('\n📈 Test 3: Content Enricher Service...');
    console.log('─'.repeat(50));
    
    const enrichmentResult = await contentEnricher.enrichLesson(lesson.id, {
      level: 'intermediate',
      includeExamples: true,
      includeProblems: true,
      includeVisuals: true,
      includeInteractive: true,
      includeAssessments: true,
    });
    
    console.log('✅ Enrichment service completed!');
    console.log(`   Content ratio: ${enrichmentResult.enrichmentRatio.toFixed(2)}x`);
    console.log(`   Quality scores:`);
    console.log(`     - Content: ${enrichmentResult.quality.contentScore}/100`);
    console.log(`     - Pedagogical: ${enrichmentResult.quality.pedagogicalScore}/100`);
    console.log(`     - Engagement: ${enrichmentResult.quality.engagementScore}/100`);
    console.log(`   Processing time: ${enrichmentResult.processingTime}ms`);
    
    // اختبار 4: Enhanced Document Processor
    console.log('\n🔍 Test 4: Enhanced RAG Processing...');
    console.log('─'.repeat(50));
    
  await documentProcessor.processLessonWithEnrichment(lesson.id, {
      enrichmentLevel: 'intermediate',
    });
    
    // التحقق من عدد embeddings المحفوظة
    const embeddingCount = await prisma.contentEmbedding.count({
      where: { contentId: lesson.content?.id },
    });
    
    console.log(`✅ Enhanced processing complete!`);
    console.log(`   Embeddings created: ${embeddingCount}`);
    
    // اختبار 5: اختبار RAG مع المحتوى المحسن
    console.log('\n💬 Test 5: Testing RAG with enriched content...');
    console.log('─'.repeat(50));
    
    const testQuestions = [
      'ما هو موضوع هذا الدرس؟',
      'أعطني مثال من الحياة الواقعية',
      'ما هي التمارين المتاحة؟',
      'اشرح المفهوم الأساسي',
    ];
    
    for (const question of testQuestions) {
      console.log(`\n❓ Question: ${question}`);
      const answer = await ragService.answerQuestion(question, lesson.id);
      console.log(`📝 Answer: ${answer.answer.substring(0, 150)}...`);
      console.log(`   Confidence: ${answer.confidence}%`);
      console.log(`   Sources used: ${answer.sources.length}`);
    }
    
    // اختبار 6: مقارنة الجودة قبل وبعد
    console.log('\n📊 Test 6: Quality Comparison...');
    console.log('─'.repeat(50));
    
    // سؤال معقد يحتاج شرح جيد
    const complexQuestion = 'اشرح هذا الدرس بالتفصيل مع أمثلة وتمارين';
    
    // الإجابة بالمحتوى المحسن
    const enrichedAnswer = await ragService.answerQuestion(complexQuestion, lesson.id);
    
    console.log('✅ Quality Analysis:');
    console.log(`   Answer length: ${enrichedAnswer.answer.length} chars`);
    console.log(`   Has examples: ${enrichedAnswer.answer.includes('مثال') ? 'Yes ✅' : 'No ❌'}`);
    console.log(`   Has exercises: ${enrichedAnswer.answer.includes('تمرين') ? 'Yes ✅' : 'No ❌'}`);
    console.log(`   Has explanations: ${enrichedAnswer.answer.includes('شرح') ? 'Yes ✅' : 'No ❌'}`);
    console.log(`   Confidence: ${enrichedAnswer.confidence}%`);
    
    // عرض عينة من المحتوى المحسن
    console.log('\n📝 Sample of Enriched Content:');
    console.log('─'.repeat(50));
    console.log(enrichedContent.detailedExplanation.substring(0, 500));
    console.log('...');
    
    if (enrichedContent.realWorldExamples.length > 0) {
      console.log('\n💡 Sample Example:');
      const example = enrichedContent.realWorldExamples[0];
      console.log(`   Title: ${example.title}`);
      console.log(`   Type: ${example.type}`);
      console.log(`   Difficulty: ${example.difficulty}`);
      console.log(`   ${example.description.substring(0, 200)}...`);
    }
    
    if (enrichedContent.practiceProblems.length > 0) {
      console.log('\n📐 Sample Problem:');
      const problem = enrichedContent.practiceProblems[0];
      console.log(`   Question: ${problem.question}`);
      console.log(`   Hints: ${problem.hints.join(', ')}`);
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(60));
    
    // نصائح للخطوات التالية
    console.log('\n📌 Next Steps:');
    console.log('1. Run enrichment on all lessons:');
    console.log('   await contentEnricher.enrichAllLessons()');
    console.log('2. Process all with enhanced RAG:');
  console.log('   await documentProcessor.processAllLessonsWithEnrichment()');
    console.log('3. Test interactive components in frontend');
    console.log('4. Monitor quality scores and adjust parameters');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// تشغيل الاختبارات
testEnrichmentSystem().catch(console.error);