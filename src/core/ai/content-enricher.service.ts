// 📍 المكان: src/core/rag/document.processor.ts
// نسخة محدثة بالكامل تدمج التحسينات مع الكود الموجود

import { openAIService } from '../../services/ai/openai.service';
import { prisma } from '../../config/database.config';
import type { DocumentChunk } from '../../types/rag.types';

// استيراد اختياري - إذا كان الملف موجود
export let contentEnricher: any = null;
try {
  // حاول استيراد content enricher إذا كان موجود
  const enricherModule = require('../ai/content-enricher.service');
  contentEnricher = enricherModule.contentEnricher;
  console.log('✅ Content Enricher module loaded');
} catch {
  console.log('⚠️ Content Enricher not available - using standard processing');
}

export class DocumentProcessor {
  private readonly chunkSize = 500;
  private readonly chunkOverlap = 50;
  
  /**
   * Process ALL lessons - works with ANY subject
   */
  async processAllContent(): Promise<void> {
    console.log('🔄 Processing all content for RAG...\n');
    
    const lessons = await prisma.lesson.findMany({
      where: { isPublished: true },
      include: { 
        content: true,
        unit: {
          include: {
            subject: true
          }
        }
      }
    });
    
    if (lessons.length === 0) {
      console.log('⚠️ No published lessons found to process');
      return;
    }
    
    console.log(`📚 Found ${lessons.length} lessons to process`);
    
    let processed = 0;
    let failed = 0;
    
    for (const lesson of lessons) {
      if (!lesson.content) {
        console.log(`⚠️ Skipping lesson "${lesson.title}" - no content`);
        continue;
      }
      
      try {
        console.log(`\n📝 Processing [${processed + 1}/${lessons.length}]: ${lesson.title}`);
        await this.processLessonContent(lesson.id);
        processed++;
        console.log(`   ✅ Success`);
      } catch (error: any) {
        failed++;
        console.error(`   ❌ Failed: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Processing complete!`);
    console.log(`   Processed: ${processed} lessons`);
    console.log(`   Failed: ${failed} lessons`);
    console.log(`   Total embeddings: ${await prisma.contentEmbedding.count()}`);
    console.log('='.repeat(50));
  }
  
  /**
   * معالجة محسّنة لمحتوى الدرس مع دعم اختياري للتحسين
   */
  async processLessonWithEnrichment(
    lessonId: string,
    options?: {
      enrichmentLevel?: 'basic' | 'intermediate' | 'advanced' | 'comprehensive';
      skipEnrichment?: boolean;
    }
  ): Promise<void> {
    console.log('\n🚀 Enhanced Lesson Processing Started');
    console.log('━'.repeat(60));
    
    try {
      // المرحلة 1: تحسين المحتوى (إذا كان متاحاً)
      if (!options?.skipEnrichment && contentEnricher) {
        console.log('\n📈 Phase 1: Content Enrichment');
        console.log('─'.repeat(40));
        
        const enrichmentResult = await contentEnricher.enrichLesson(lessonId, {
          level: options?.enrichmentLevel || 'intermediate',
        });
        
        console.log(`✅ Content enriched: ${enrichmentResult.enrichmentRatio}x increase`);
        console.log(`📊 Quality Score: ${enrichmentResult.quality.overallScore}/100`);
      } else if (!contentEnricher) {
        console.log('⚠️ Content Enricher not available - skipping enrichment');
      }
      
      // المرحلة 2: معالجة RAG العادية
      await this.processLessonContent(lessonId);
      
      console.log('\n' + '━'.repeat(60));
      console.log('✅ Enhanced Processing Complete!');
      console.log('━'.repeat(60));
      
    } catch (error) {
      console.error('❌ Enhanced processing failed:', error);
      throw error;
    }
  }
  
  /**
   * Process lesson content - universal approach
   */
  async processLessonContent(lessonId: string): Promise<void> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        content: true,
        unit: {
          include: {
            subject: true
          }
        }
      }
    });
    
    if (!lesson?.content) {
      throw new Error('Lesson or content not found');
    }
    
    console.log(`   📚 Processing: ${lesson.title}`);
    console.log(`   📊 Subject: ${lesson.unit.subject.name}`);
    
    // Delete existing embeddings
    await prisma.contentEmbedding.deleteMany({
      where: { contentId: lesson.content.id },
    });
    
    // استخدام المحتوى المحسن إن وجد، أو المحتوى الأصلي
    let contentToProcess = lesson.content.fullText || '';
    
    // تحقق من وجود محتوى محسن في حقل exercises (كحل مؤقت)
    // أو في RAGContent
    const enrichedData = await prisma.rAGContent.findFirst({
      where: {
        lessonId: lesson.id,
        contentType: 'ENRICHED_CONTENT',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    if (enrichedData) {
      try {
        const enriched = JSON.parse(enrichedData.content);
        contentToProcess = this.buildEnrichedText(enriched);
        console.log('   📝 Using enriched content for embeddings');
      } catch {
        console.log('   📝 Using original content (enriched content parse failed)');
      }
    } else {
      console.log('   📝 Using original content');
    }
    
    // Create universal enriched content
    const enrichedContent = await this.createUniversalEnrichedContent(lesson, contentToProcess);
    
    // Create smart chunks
    const chunks = this.createSmartChunks(enrichedContent);
    console.log(`   📄 Created ${chunks.length} chunks`);
    
    // Generate and store embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const { embedding } = await openAIService.generateEmbedding(chunk);
        
        await prisma.contentEmbedding.create({
          data: {
            contentId: lesson.content.id,
            chunkIndex: i,
            chunkText: chunk,
            embedding: JSON.stringify(embedding),
            metadata: JSON.stringify({
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              lessonTitleEn: lesson.titleEn,
              unitId: lesson.unit.id,
              unitTitle: lesson.unit.title,
              unitTitleEn: lesson.unit.titleEn,
              subjectId: lesson.unit.subject.id,
              subjectName: lesson.unit.subject.name,
              subjectNameEn: lesson.unit.subject.nameEn,
              grade: lesson.unit.subject.grade,
              chunkNumber: i + 1,
              totalChunks: chunks.length,
              difficulty: lesson.difficulty,
              keyPoints: lesson.content.keyPoints ? JSON.parse(lesson.content.keyPoints) : [],
            }),
          },
        });
      } catch (error: any) {
        console.error(`      ❌ Failed to process chunk ${i + 1}: ${error.message}`);
      }
    }
    
    // فهرسة المحتوى الإضافي
    await this.indexAdditionalContent(lesson);
  }
  
  /**
   * Create universal enriched content for ANY subject
   */
  private async createUniversalEnrichedContent(lesson: any, contentText?: string): Promise<string> {
    const content = lesson.content;
    const keyPoints = content.keyPoints ? JSON.parse(content.keyPoints) : [];
    const examples = content.examples ? JSON.parse(content.examples) : [];
    const exercises = content.exercises ? JSON.parse(content.exercises) : [];
    
    // Generate search variations automatically
    const searchVariations = this.generateSearchVariations(lesson);
    
    // Build universal content structure
    const parts: string[] = [
      // === Metadata Section ===
      `الدرس: ${lesson.title}`,
      lesson.titleEn ? `Lesson: ${lesson.titleEn}` : '',
      `الوحدة: ${lesson.unit.title}`,
      lesson.unit.titleEn ? `Unit: ${lesson.unit.titleEn}` : '',
      `المادة: ${lesson.unit.subject.name}`,
      lesson.unit.subject.nameEn ? `Subject: ${lesson.unit.subject.nameEn}` : '',
      `الصف: ${lesson.unit.subject.grade}`,
      `Grade: ${lesson.unit.subject.grade}`,
      '',
      
      // === Search optimization section ===
      '=== البحث | Search Terms ===',
      ...searchVariations,
      '',
      
      // === Main content ===
      '=== المحتوى الرئيسي | Main Content ===',
      contentText || content.fullText || '',
      '',
      
      // === Key points ===
      '=== النقاط الأساسية | Key Points ===',
      ...keyPoints.map((point: string, i: number) => `${i + 1}. ${point}`),
      '',
      
      // === Examples ===
      '=== الأمثلة | Examples ===',
      ...examples.map((ex: any, i: number) => {
        if (typeof ex === 'string') return `مثال ${i + 1}: ${ex}`;
        return `مثال ${i + 1}: ${ex.problem || ex.title || ''}\nالحل: ${ex.solution || ex.description || ''}`;
      }),
      '',
      
      // === Exercises ===
      '=== التمارين | Exercises ===',
      ...exercises.map((ex: any, i: number) => {
        if (typeof ex === 'string') return `تمرين ${i + 1}: ${ex}`;
        return `تمرين ${i + 1}: ${ex.question || ex.problem || ''}\n${ex.hint ? `تلميح: ${ex.hint}` : ''}`;
      }),
    ];
    
    return parts.filter(p => p).join('\n');
  }
  
  /**
   * بناء نص محسّن من المحتوى المُثري
   */
  private buildEnrichedText(enriched: any): string {
    const parts: string[] = [];
    
    // المحتوى الأساسي
    parts.push('=== المحتوى المحسّن ===');
    parts.push(enriched.enrichedText || enriched.detailedExplanation || '');
    
    // المفاهيم الأساسية
    if (enriched.keyConceptsExplained?.length > 0) {
      parts.push('\n=== المفاهيم الأساسية ===');
      enriched.keyConceptsExplained.forEach((concept: any) => {
        parts.push(`\n📌 ${concept.concept}`);
        parts.push(concept.simpleExplanation);
        parts.push(concept.detailedExplanation);
        if (concept.analogies?.length > 0) {
          parts.push(`تشبيهات: ${concept.analogies.join('، ')}`);
        }
      });
    }
    
    // الأمثلة
    if (enriched.realWorldExamples?.length > 0) {
      parts.push('\n=== أمثلة من الواقع ===');
      enriched.realWorldExamples.forEach((example: any, index: number) => {
        parts.push(`\nمثال ${index + 1}: ${example.title}`);
        parts.push(example.description);
      });
    }
    
    // التمارين
    if (enriched.practiceProblems?.length > 0) {
      parts.push('\n=== تمارين تطبيقية ===');
      enriched.practiceProblems.forEach((problem: any, index: number) => {
        parts.push(`\nتمرين ${index + 1}: ${problem.question}`);
        if (problem.hints?.length > 0) {
          parts.push(`تلميحات: ${problem.hints.join('، ')}`);
        }
        parts.push(`الحل: ${problem.solution}`);
      });
    }
    
    return parts.filter(p => p).join('\n');
  }
  
  /**
   * Generate search variations for better retrieval
   */
  private generateSearchVariations(lesson: any): string[] {
    const variations: string[] = [];
    const subject = lesson.unit.subject.name;
    const grade = lesson.unit.subject.grade;
    
    // Subject-specific variations
    if (subject.includes('رياضيات') || subject.includes('Math')) {
      variations.push(
        'حساب جبر هندسة',
        'calculation algebra geometry',
        'معادلة مسألة حل',
        'equation problem solution'
      );
    } else if (subject.includes('علوم') || subject.includes('Science')) {
      variations.push(
        'فيزياء كيمياء أحياء',
        'physics chemistry biology',
        'تجربة ظاهرة قانون',
        'experiment phenomenon law'
      );
    } else if (subject.includes('تاريخ') || subject.includes('History')) {
      variations.push(
        'حضارة أحداث شخصيات',
        'civilization events figures',
        'عصر فترة زمن',
        'era period time'
      );
    }
    
    // Grade-specific terms
    variations.push(
      `الصف ${grade} grade ${grade}`,
      `للصف ${grade} for grade ${grade}`,
    );
    
    return variations;
  }
  
  /**
   * Create smart chunks from content
   */
  private createSmartChunks(content: string): string[] {
    const chunks: string[] = [];
    const sections = content.split(/={3,}/); // Split by section headers
    
    for (const section of sections) {
      if (!section.trim()) continue;
      
      // Split long sections into smaller chunks
      const sentences = section.split(/[.؟!]\s+/);
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if ((currentChunk.length + sentence.length) > this.chunkSize) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = sentence;
        } else {
          currentChunk += (currentChunk ? '. ' : '') + sentence;
        }
      }
      
      // Add remaining chunk
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
    }
    
    return chunks;
  }
  
  /**
   * فهرسة المحتوى الإضافي (أمثلة، أسئلة، إلخ)
   */
  private async indexAdditionalContent(lesson: any): Promise<void> {
    // فهرسة الأمثلة
    const examples = await prisma.example.findMany({
      where: { lessonId: lesson.id },
    });
    
    for (const example of examples) {
      const text = `مثال: ${example.problem}\nالحل: ${example.solution}`;
      const { embedding } = await openAIService.generateEmbedding(text);
      
      // استخدام hash بسيط للـ ID لتحويله لرقم
      const idHash = this.hashStringToNumber(example.id);
      
      await prisma.contentEmbedding.create({
        data: {
          contentId: lesson.content.id,
          chunkIndex: 10000 + (idHash % 10000),
          chunkText: text,
          embedding: JSON.stringify(embedding),
          metadata: JSON.stringify({
            type: 'example',
            exampleId: example.id,
            lessonId: lesson.id,
          }),
        },
      }).catch(() => {}); // تجاهل التكرارات
    }
    
    if (examples.length > 0) {
      console.log(`   📌 Indexed ${examples.length} examples`);
    }
    
    // فهرسة الأسئلة
    const questions = await prisma.question.findMany({
      where: { lessonId: lesson.id },
    });
    
    for (const question of questions) {
      const text = `سؤال: ${question.question}\nالإجابة: ${question.correctAnswer}${question.explanation ? '\nالشرح: ' + question.explanation : ''}`;
      const { embedding } = await openAIService.generateEmbedding(text);
      
      const idHash = this.hashStringToNumber(question.id);
      
      await prisma.contentEmbedding.create({
        data: {
          contentId: lesson.content.id,
          chunkIndex: 20000 + (idHash % 10000),
          chunkText: text,
          embedding: JSON.stringify(embedding),
          metadata: JSON.stringify({
            type: 'question',
            questionId: question.id,
            lessonId: lesson.id,
          }),
        },
      }).catch(() => {});
    }
    
    if (questions.length > 0) {
      console.log(`   📌 Indexed ${questions.length} questions`);
    }
    
    // فهرسة العناصر المرئية إن وجدت في RAGContent
    const visualElements = await prisma.rAGContent.findFirst({
      where: {
        lessonId: lesson.id,
        contentType: 'VISUAL_ELEMENTS',
      },
    });
    
    if (visualElements) {
      try {
        const visuals = JSON.parse(visualElements.content);
        for (const visual of visuals) {
          const text = `عنصر مرئي: ${visual.title}\n${visual.description || ''}`;
          const { embedding } = await openAIService.generateEmbedding(text);
          
          await prisma.contentEmbedding.create({
            data: {
              contentId: lesson.content.id,
              chunkIndex: 30000 + Math.floor(Math.random() * 10000),
              chunkText: text,
              embedding: JSON.stringify(embedding),
              metadata: JSON.stringify({
                type: 'visual',
                visualType: visual.type,
                lessonId: lesson.id,
              }),
            },
          }).catch(() => {});
        }
        console.log(`   📌 Indexed ${visuals.length} visual elements`);
      } catch {}
    }
  }
  
  /**
   * تحويل string ID إلى رقم للـ chunkIndex
   */
  private hashStringToNumber(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * معالجة دفعية محسنة لكل الدروس
   */
  async processAllLessonsWithEnrichment(
    options?: {
      enrichmentLevel?: 'basic' | 'intermediate' | 'advanced';
      batchSize?: number;
    }
  ): Promise<void> {
    console.log('🚀 Starting batch enhanced processing...\n');
    
    const lessons = await prisma.lesson.findMany({
      where: { isPublished: true },
      select: { id: true, title: true },
    });
    
    console.log(`📚 Found ${lessons.length} lessons to process\n`);
    
    const batchSize = options?.batchSize || 5;
    let completed = 0;
    
    for (let i = 0; i < lessons.length; i += batchSize) {
      const batch = lessons.slice(i, i + batchSize);
      console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}`);
      console.log('─'.repeat(50));
      
      await Promise.all(
        batch.map(async (lesson) => {
          try {
            await this.processLessonWithEnrichment(lesson.id, options);
            completed++;
            console.log(`✅ [${completed}/${lessons.length}] ${lesson.title}`);
          } catch (error) {
            console.error(`❌ Failed: ${lesson.title}`, error);
          }
        })
      );
      
      // Delay between batches
      if (i + batchSize < lessons.length) {
        console.log('\n⏳ Waiting before next batch...');
        await this.delay(5000);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Batch processing complete: ${completed}/${lessons.length}`);
    console.log('='.repeat(60));
  }
  
  /**
   * Helper: تأخير
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * تحليل جودة المحتوى
   */
  async analyzeContentQuality(): Promise<void> {
    console.log('\n📊 Analyzing Content Quality...\n');
    
    const lessons = await prisma.lesson.findMany({
      where: { isPublished: true },
      include: {
        content: true,
        examples: true,
        questions: true,
      },
    });
    
    for (const lesson of lessons) {
      const enrichmentData = await prisma.rAGContent.findFirst({
        where: {
          lessonId: lesson.id,
          contentType: 'QUALITY_METRICS',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      let qualityScore = 50; // Default score
      
      if (enrichmentData) {
        try {
          const metrics = JSON.parse(enrichmentData.content);
          qualityScore = metrics.overallScore || 50;
        } catch {}
      } else {
        // حساب أساسي للجودة
        if (lesson.content?.fullText && lesson.content.fullText.length > 500) qualityScore += 10;
        if (lesson.examples.length > 3) qualityScore += 15;
        if (lesson.questions.length > 5) qualityScore += 15;
        if (lesson.content?.keyPoints) qualityScore += 10;
      }
      
      console.log(`📚 ${lesson.title}: ${qualityScore}/100`);
      
      // حفظ النتيجة
      await prisma.rAGContent.upsert({
        where: {
          id: enrichmentData?.id || 'new',
        },
        create: {
          lessonId: lesson.id,
          content: JSON.stringify({ overallScore: qualityScore }),
          contentType: 'QUALITY_METRICS',
          embedding: '[]',
          metadata: JSON.stringify({ assessedAt: new Date() }),
        },
        update: {
          content: JSON.stringify({ overallScore: qualityScore }),
          metadata: JSON.stringify({ assessedAt: new Date() }),
        },
      }).catch(() => {});
    }
    
    console.log('\n✅ Quality analysis complete');
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();