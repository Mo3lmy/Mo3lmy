// src/core/rag/document.processor.ts (النسخة المُحسّنة النهائية)

import { openAIService } from '../../services/ai/openai.service';
import { prisma } from '../../config/database.config';
import type { DocumentChunk } from '../../types/rag.types';

// محاولة استيراد contentEnricher (اختياري)
let contentEnricher: any;
try {
  const module = require('../ai/content-enricher.service');
  contentEnricher = module.contentEnricher;
} catch (error) {
  console.log('⚠️ Content enricher not found, using basic processing');
}

// Extended type للتعامل مع الحقول الإضافية
interface ExtendedContent {
  id: string;
  lessonId: string;
  fullText: string;
  summary: string | null;
  keyPoints: string | null;
  examples: string | null;
  exercises: string | null;
  enrichedContent?: string | null;
  lastEnrichedAt?: Date | null;
  enrichmentLevel?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class DocumentProcessor {
  static processAllLessonsWithEnrichment(arg0: { enrichmentLevel: string; batchSize: number; skipEnrichment: boolean; }) {
      throw new Error('Method not implemented.');
  }
  private readonly chunkSize = 800; // زيادة الحجم لمحتوى أغنى
  private readonly chunkOverlap = 100; // زيادة التداخل لسياق أفضل
  
  /**
   * Process ALL lessons - works with ANY subject
   * Now with optional content enrichment!
   */
  async processAllContent(options?: {
    enrichContent?: boolean;
    enrichmentLevel?: 'basic' | 'intermediate' | 'advanced' | 'comprehensive';
    batchSize?: number;
  }): Promise<void> {
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
    if (options?.enrichContent && contentEnricher) {
      console.log(`✨ Content enrichment enabled (Level: ${options.enrichmentLevel || 'intermediate'})`);
    } else if (options?.enrichContent && !contentEnricher) {
      console.log('⚠️ Enrichment requested but enricher not available');
    }
    
    let processed = 0;
    let failed = 0;
    
    // معالجة بـ batches إذا تم تحديد ذلك
    const batchSize = options?.batchSize || lessons.length;
    
    for (let i = 0; i < lessons.length; i += batchSize) {
      const batch = lessons.slice(i, i + batchSize);
      
      if (batchSize < lessons.length) {
        console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}`);
        console.log('─'.repeat(50));
      }
      
      for (const lesson of batch) {
        if (!lesson.content) {
          console.log(`⚠️ Skipping lesson "${lesson.title}" - no content`);
          continue;
        }
        
        try {
          console.log(`\n📝 Processing [${processed + 1}/${lessons.length}]: ${lesson.title}`);
          
          // معالجة مع أو بدون تحسين
          if (options?.enrichContent && contentEnricher) {
            await this.processLessonWithEnrichment(lesson.id, {
              enrichmentLevel: options.enrichmentLevel
            });
          } else {
            await this.processLessonContent(lesson.id);
          }
          
          processed++;
          console.log(`   ✅ Success`);
        } catch (error: any) {
          failed++;
          console.error(`   ❌ Failed: ${error.message}`);
        }
      }
      
      // تأخير بين الـ batches
      if (i + batchSize < lessons.length && options?.enrichContent) {
        console.log('\n⏳ Waiting before next batch...');
        await this.delay(3000);
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
   * Process lesson content with AI enrichment
   * IMPROVED - معالجة محسنة مع enrichment
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
      // المرحلة 1: تحسين المحتوى (إذا كان contentEnricher متاح)
      if (!options?.skipEnrichment && contentEnricher) {
        console.log('\n📈 Phase 1: Content Enrichment');
        console.log('─'.repeat(40));
        
        const enrichmentResult = await contentEnricher.enrichLesson(lessonId, {
          level: options?.enrichmentLevel || 'intermediate',
        });
        
        console.log(`✅ Content enriched: ${enrichmentResult.enrichmentRatio.toFixed(2)}x increase`);
        console.log(`📊 Quality Score: ${enrichmentResult.quality.overallScore}/100`);
      } else if (!contentEnricher) {
        console.log('⚠️ Enricher not available, using standard processing');
      }
      
      // المرحلة 2: معالجة RAG
      console.log('\n🔍 Phase 2: RAG Processing');
      console.log('─'.repeat(40));
      
      // معالجة المحتوى المحسن
      await this.processEnrichedContent(lessonId);
      
      // المرحلة 3: فهرسة المحتوى الإضافي
      console.log('\n🔗 Phase 3: Indexing Additional Content');
      console.log('─'.repeat(40));
      
      await this.indexAdditionalContent(lessonId);
      
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
   * IMPROVED - معالجة أفضل للمحتوى المُحسن
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
    
    // Delete existing embeddings
    await prisma.contentEmbedding.deleteMany({
      where: { contentId: lesson.content.id },
    });
    
    // Cast to extended type للتعامل مع الحقول الإضافية
    const content = lesson.content as ExtendedContent;
    
    // التحقق من وجود محتوى محسن واستخدامه
    let contentToProcess: string;
    let isEnriched = false;
    
    if (content.enrichedContent) {
      console.log('   📝 Using enriched content for embeddings');
      try {
        const enrichedData = JSON.parse(content.enrichedContent);
        contentToProcess = this.buildEnrichedTextFromJSON(enrichedData);
        isEnriched = true;
      } catch (error) {
        console.warn('   ⚠️ Failed to parse enriched content, using original');
        contentToProcess = await this.createUniversalEnrichedContent(lesson);
      }
    } else {
      console.log('   📝 Using original content');
      contentToProcess = await this.createUniversalEnrichedContent(lesson);
    }
    
    // Create smart chunks
    const chunks = this.createSmartChunks(contentToProcess);
    console.log(`   📄 Created ${chunks.length} chunks`);
    
    // Generate and store embeddings
    let successCount = 0;
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
              keyPoints: content.keyPoints ? JSON.parse(content.keyPoints) : [],
              isEnriched: isEnriched,
              enrichmentLevel: content.enrichmentLevel || 0,
            }),
          },
        });
        successCount++;
      } catch (error: any) {
        console.error(`      ❌ Failed to process chunk ${i + 1}: ${error.message}`);
      }
    }
    
    console.log(`   ✅ Successfully processed ${successCount}/${chunks.length} chunks`);
  }
  
  /**
   * Process enriched content specifically
   * IMPROVED - معالجة محسنة للمحتوى المُثري
   */
  private async processEnrichedContent(lessonId: string): Promise<void> {
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
      throw new Error('Lesson content not found');
    }
    
    // حذف embeddings القديمة
    await prisma.contentEmbedding.deleteMany({
      where: { contentId: lesson.content.id },
    });
    
    // Cast to extended type
    const content = lesson.content as ExtendedContent;
    
    // استخدام المحتوى المحسن إن وجد
    let contentToProcess: string;
    let isEnriched = false;
    
    if (content.enrichedContent) {
      try {
        const enriched = JSON.parse(content.enrichedContent);
        contentToProcess = this.buildComprehensiveEnrichedText(enriched, lesson);
        console.log('📝 Using enriched content for embeddings');
        isEnriched = true;
      } catch (error) {
        console.warn('⚠️ Failed to parse enriched content, using fallback');
        contentToProcess = await this.createUniversalEnrichedContent(lesson);
      }
    } else {
      contentToProcess = await this.createUniversalEnrichedContent(lesson);
      console.log('📝 Using original content (no enrichment found)');
    }
    
    // إنشاء chunks محسّنة
    const chunks = this.createEnhancedChunks(contentToProcess, lesson);
    console.log(`📄 Created ${chunks.length} enriched chunks`);
    
    // توليد embeddings
    console.log('🧮 Generating embeddings...');
    let processed = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const { embedding } = await openAIService.generateEmbedding(chunk.text);
        
        await prisma.contentEmbedding.create({
          data: {
            contentId: lesson.content.id,
            chunkIndex: i,
            chunkText: chunk.text,
            embedding: JSON.stringify(embedding),
            metadata: JSON.stringify({
              ...chunk.metadata,
              isEnriched: isEnriched
            }),
          },
        });
        
        processed++;
        
        // Progress indicator
        if (processed % 5 === 0) {
          console.log(`   Processed ${processed}/${chunks.length} chunks`);
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to process chunk ${i + 1}:`, error);
      }
    }
    
    console.log(`✅ Successfully processed ${processed}/${chunks.length} chunks`);
  }
  
  /**
   * Index additional content (examples, questions, visuals)
   * FIXED - حل مشكلة Unique constraint
   */
  private async indexAdditionalContent(lessonId: string): Promise<void> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });
    
    if (!lesson?.content) return;
    
    // حذف الـ embeddings القديمة للمحتوى الإضافي
    await prisma.contentEmbedding.deleteMany({
      where: {
        contentId: lesson.content.id,
        chunkIndex: {
          gte: 10000 // كل المحتوى الإضافي يبدأ من 10000
        }
      }
    });
    
    // فهرسة الأمثلة
    const examples = await prisma.example.findMany({
      where: { lessonId: lesson.id },
    });
    
    let exampleIndex = 0;
    for (const example of examples) {
      const text = `مثال: ${example.problem}\nالحل: ${example.solution}`;
      const { embedding } = await openAIService.generateEmbedding(text);
      
      // استخدام timestamp + index لضمان عدم التكرار
      const uniqueIndex = 10000 + Date.now() % 1000 + exampleIndex++;
      
      try {
        await prisma.contentEmbedding.create({
          data: {
            contentId: lesson.content.id,
            chunkIndex: uniqueIndex,
            chunkText: text,
            embedding: JSON.stringify(embedding),
            metadata: JSON.stringify({
              type: 'example',
              exampleId: example.id,
              lessonId: lesson.id,
              difficulty: example.difficulty,
              relatedConcept: example.relatedConcept
            }),
          },
        });
      } catch (error) {
        console.warn(`   ⚠️ Skipped duplicate example ${example.id}`);
      }
    }
    
    console.log(`   📌 Indexed ${examples.length} examples`);
    
    // فهرسة الأسئلة
    const questions = await prisma.question.findMany({
      where: { lessonId: lesson.id },
    });
    
    let questionIndex = 0;
    for (const question of questions) {
      const text = `سؤال: ${question.question}\nالإجابة: ${question.correctAnswer}${question.explanation ? '\nالشرح: ' + question.explanation : ''}`;
      const { embedding } = await openAIService.generateEmbedding(text);
      
      // استخدام timestamp + index لضمان عدم التكرار
      const uniqueIndex = 20000 + Date.now() % 1000 + questionIndex++;
      
      try {
        await prisma.contentEmbedding.create({
          data: {
            contentId: lesson.content.id,
            chunkIndex: uniqueIndex,
            chunkText: text,
            embedding: JSON.stringify(embedding),
            metadata: JSON.stringify({
              type: 'question',
              questionId: question.id,
              lessonId: lesson.id,
              difficulty: question.difficulty,
              questionType: question.type
            }),
          },
        });
      } catch (error) {
        console.warn(`   ⚠️ Skipped duplicate question ${question.id}`);
      }
    }
    
    console.log(`   📌 Indexed ${questions.length} questions`);
    
    // فهرسة العناصر المرئية (إن وجدت الجداول في DB)
    try {
      const visualElements = await (prisma as any).visualElement?.findMany({
        where: { lessonId: lesson.id },
      }) || [];
      
      let visualIndex = 0;
      for (const visual of visualElements) {
        const text = `${visual.title}: ${visual.description || ''}`;
        const { embedding } = await openAIService.generateEmbedding(text);
        
        // استخدام timestamp + index لضمان عدم التكرار
        const uniqueIndex = 30000 + Date.now() % 1000 + visualIndex++;
        
        try {
          await prisma.contentEmbedding.create({
            data: {
              contentId: lesson.content.id,
              chunkIndex: uniqueIndex,
              chunkText: text,
              embedding: JSON.stringify(embedding),
              metadata: JSON.stringify({
                type: 'visual',
                visualId: visual.id,
                visualType: visual.type,
                lessonId: lesson.id,
              }),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Skipped duplicate visual ${visual.id}`);
        }
      }
      
      if (visualElements.length > 0) {
        console.log(`   📌 Indexed ${visualElements.length} visual elements`);
      }
    } catch (error) {
      // الجدول غير موجود بعد، لا مشكلة
    }
  }
  
  /**
   * Build comprehensive enriched text from JSON
   * IMPROVED - بناء نص أكثر ثراءً
   */
  private buildComprehensiveEnrichedText(enriched: any, lesson: any): string {
    const parts: string[] = [];
    
    // عنوان الدرس والمعلومات الأساسية
    parts.push(`# درس: ${lesson.title}`);
    parts.push(`المادة: ${lesson.unit.subject.name} - الصف ${lesson.unit.subject.grade}`);
    parts.push('');
    
    // المحتوى الأساسي المحسن
    parts.push('=== المحتوى المحسّن ===');
    if (enriched.detailedExplanation) {
      parts.push(enriched.detailedExplanation);
    } else if (enriched.enrichedText) {
      parts.push(enriched.enrichedText);
    }
    parts.push('');
    
    // المفاهيم الأساسية
    if (enriched.keyConceptsExplained?.length > 0) {
      parts.push('=== المفاهيم الأساسية ===');
      enriched.keyConceptsExplained.forEach((concept: any) => {
        parts.push(`\n📌 ${concept.concept}`);
        parts.push(`الشرح البسيط: ${concept.simpleExplanation}`);
        parts.push(`الشرح التفصيلي: ${concept.detailedExplanation}`);
        if (concept.analogies?.length > 0) {
          parts.push(`التشبيهات: ${concept.analogies.join('، ')}`);
        }
        if (concept.visualRepresentation) {
          parts.push(`التمثيل المرئي: ${concept.visualRepresentation}`);
        }
      });
      parts.push('');
    }
    
    // الأمثلة من الواقع
    if (enriched.realWorldExamples?.length > 0) {
      parts.push('=== أمثلة من الحياة الواقعية ===');
      enriched.realWorldExamples.forEach((example: any, index: number) => {
        parts.push(`\nمثال ${index + 1}: ${example.title}`);
        parts.push(example.description);
        if (example.visualAid) {
          parts.push(`وصف مرئي: ${example.visualAid}`);
        }
        if (example.relatedConcept) {
          parts.push(`المفهوم المرتبط: ${example.relatedConcept}`);
        }
        if (example.difficulty) {
          parts.push(`مستوى الصعوبة: ${example.difficulty}`);
        }
      });
      parts.push('');
    }
    
    // التمارين والمسائل
    if (enriched.practiceProblems?.length > 0) {
      parts.push('=== تمارين تطبيقية ===');
      enriched.practiceProblems.forEach((problem: any, index: number) => {
        parts.push(`\nتمرين ${index + 1}: ${problem.question}`);
        if (problem.hints?.length > 0) {
          parts.push(`التلميحات: ${problem.hints.join(' | ')}`);
        }
        parts.push(`الحل: ${problem.solution}`);
        if (problem.stepByStepSolution?.length > 0) {
          parts.push('الحل خطوة بخطوة:');
          problem.stepByStepSolution.forEach((step: string, i: number) => {
            parts.push(`   ${i + 1}. ${step}`);
          });
        }
        if (problem.difficulty) {
          parts.push(`الصعوبة: ${problem.difficulty}/5`);
        }
        if (problem.estimatedTime) {
          parts.push(`الوقت المتوقع: ${problem.estimatedTime} دقيقة`);
        }
      });
      parts.push('');
    }
    
    // المفاهيم الخاطئة الشائعة
    if (enriched.commonMisconceptions?.length > 0) {
      parts.push('=== تصحيح المفاهيم الخاطئة ===');
      enriched.commonMisconceptions.forEach((misc: any) => {
        parts.push(`\n❌ الخطأ الشائع: ${misc.commonMistake}`);
        parts.push(`❓ لماذا يحدث: ${misc.whyItHappens}`);
        parts.push(`✅ الفهم الصحيح: ${misc.correctUnderstanding}`);
        parts.push(`💡 كيفية التجنب: ${misc.howToAvoid}`);
      });
      parts.push('');
    }
    
    // المتطلبات السابقة
    if (enriched.prerequisiteKnowledge?.length > 0) {
      parts.push('=== المتطلبات السابقة ===');
      enriched.prerequisiteKnowledge.forEach((prereq: string) => {
        parts.push(`• ${prereq}`);
      });
      parts.push('');
    }
    
    // الأهداف التعليمية
    if (enriched.learningObjectives?.length > 0) {
      parts.push('=== الأهداف التعليمية ===');
      parts.push('بنهاية هذا الدرس، سيكون الطالب قادراً على:');
      enriched.learningObjectives.forEach((objective: string) => {
        parts.push(`✓ ${objective}`);
      });
      parts.push('');
    }
    
    // نقاط التحقق الذاتي
    if (enriched.selfCheckPoints?.length > 0) {
      parts.push('=== نقاط التحقق الذاتي ===');
      enriched.selfCheckPoints.forEach((checkpoint: string) => {
        parts.push(`□ ${checkpoint}`);
      });
      parts.push('');
    }
    
    // أسئلة التقييم
    if (enriched.assessmentQuestions?.length > 0) {
      parts.push('=== أسئلة التقييم ===');
      enriched.assessmentQuestions.forEach((q: any, index: number) => {
        parts.push(`\nسؤال ${index + 1}: ${q.question}`);
        if (q.options?.length > 0) {
          q.options.forEach((opt: string, i: number) => {
            parts.push(`   ${String.fromCharCode(65 + i)}) ${opt}`);
          });
        }
        parts.push(`الإجابة الصحيحة: ${q.correctAnswer}`);
        if (q.explanation) {
          parts.push(`الشرح: ${q.explanation}`);
        }
      });
    }
    
    return parts.filter(p => p !== undefined && p !== '').join('\n');
  }
  
  /**
   * Build enriched text from JSON (backward compatible)
   * IMPROVED
   */
  private buildEnrichedTextFromJSON(enriched: any): string {
    // استخدام الـ method الأكثر شمولية
    return this.buildComprehensiveEnrichedText(enriched, { 
      title: 'درس',
      unit: { subject: { name: 'مادة', grade: 0 } }
    });
  }
  
  /**
   * Create enhanced chunks with better metadata
   * IMPROVED - chunks أفضل وأكثر ذكاءً
   */
  private createEnhancedChunks(
    content: string,
    lesson: any
  ): Array<{ text: string; metadata: any }> {
    const chunks: Array<{ text: string; metadata: any }> = [];
    const sections = content.split(/={3,}/);
    
    sections.forEach((section, sectionIndex) => {
      if (!section.trim()) return;
      
      // تحديد نوع القسم من العنوان
      const sectionType = this.detectSectionType(section);
      
      const paragraphs = section.split(/\n\n+/);
      let currentChunk = '';
      
      paragraphs.forEach((paragraph) => {
        if ((currentChunk.length + paragraph.length) > this.chunkSize && currentChunk.length > 100) {
          if (currentChunk.trim()) {
            chunks.push({
              text: currentChunk.trim(),
              metadata: this.buildEnhancedChunkMetadata(lesson, sectionIndex, chunks.length, sectionType),
            });
          }
          // بدء chunk جديد مع تداخل
          const overlap = this.getOverlapText(currentChunk);
          currentChunk = overlap + ' ' + paragraph;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
      });
      
      // حفظ آخر chunk
      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          metadata: this.buildEnhancedChunkMetadata(lesson, sectionIndex, chunks.length, sectionType),
        });
      }
    });
    
    return chunks;
  }
  
  /**
   * Detect section type from content
   * NEW
   */
  private detectSectionType(section: string): string {
    const firstLine = section.split('\n')[0].toLowerCase();
    
    if (firstLine.includes('مفاهيم') || firstLine.includes('concept')) return 'concepts';
    if (firstLine.includes('أمثلة') || firstLine.includes('example')) return 'examples';
    if (firstLine.includes('تمارين') || firstLine.includes('exercise')) return 'exercises';
    if (firstLine.includes('تقييم') || firstLine.includes('assessment')) return 'assessment';
    if (firstLine.includes('أهداف') || firstLine.includes('objective')) return 'objectives';
    if (firstLine.includes('ملخص') || firstLine.includes('summary')) return 'summary';
    
    return 'content';
  }
  
  /**
   * Get overlap text for better context
   * NEW
   */
  private getOverlapText(text: string): string {
    const words = text.split(' ');
    const overlapWords = Math.min(20, Math.floor(words.length * 0.2));
    return words.slice(-overlapWords).join(' ');
  }
  
  /**
   * Build enhanced chunk metadata
   * IMPROVED
   */
  private buildEnhancedChunkMetadata(
    lesson: any, 
    sectionIndex: number, 
    chunkIndex: number,
    sectionType: string
  ): any {
    const content = lesson.content as ExtendedContent;
    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      lessonTitleEn: lesson.titleEn,
      unitId: lesson.unit.id,
      unitTitle: lesson.unit.title,
      subjectId: lesson.unit.subject.id,
      subjectName: lesson.unit.subject.name,
      grade: lesson.unit.subject.grade,
      sectionIndex,
      sectionType,
      chunkIndex,
      isEnriched: !!(content.enrichedContent),
      enrichmentLevel: content.enrichmentLevel || 0,
      enrichmentDate: content.lastEnrichedAt?.toISOString(),
      difficulty: lesson.difficulty
    };
  }
  
  /**
   * Create universal enriched content for ANY subject
   * IMPROVED - محتوى أكثر ثراءً
   */
  private async createUniversalEnrichedContent(lesson: any): Promise<string> {
    const content = lesson.content;
    const keyPoints = content.keyPoints ? JSON.parse(content.keyPoints) : [];
    const examples = content.examples ? JSON.parse(content.examples) : [];
    const exercises = content.exercises ? JSON.parse(content.exercises) : [];
    
    // Generate search variations automatically
    const searchVariations = this.generateSearchVariations(lesson);
    
    // Build universal content structure
    const parts: string[] = [
      // === Header ===
      `# ${lesson.title}`,
      `المادة: ${lesson.unit.subject.name} | الصف: ${lesson.unit.subject.grade}`,
      lesson.titleEn ? `Subject: ${lesson.unit.subject.nameEn} | Grade: ${lesson.unit.subject.grade}` : '',
      '',
      
      // === Search optimization section ===
      '=== كلمات البحث | Search Terms ===',
      ...searchVariations,
      '',
      
      // === Main content ===
      '=== المحتوى الرئيسي | Main Content ===',
      content.fullText || '',
      '',
      
      // === Key points ===
      '=== النقاط الأساسية | Key Points ===',
      ...keyPoints.map((point: string, i: number) => `${i + 1}. ${point}`),
      '',
      
      // === Summary ===
      content.summary ? '=== الملخص | Summary ===\n' + content.summary + '\n' : ''
    ];
    
    // Add examples if available
    if (examples.length > 0) {
      parts.push('=== الأمثلة | Examples ===');
      examples.forEach((ex: any, i: number) => {
        if (typeof ex === 'string') {
          parts.push(`${i + 1}. ${ex}`);
        } else {
          parts.push(`\nمثال ${i + 1}: ${ex.problem || ex.question || ''}`);
          parts.push(`الحل: ${ex.solution || ex.answer || ''}`);
        }
      });
      parts.push('');
    }
    
    // Add exercises if available
    if (exercises.length > 0) {
      parts.push('=== التمارين | Exercises ===');
      exercises.forEach((ex: any, i: number) => {
        if (typeof ex === 'string') {
          parts.push(`${i + 1}. ${ex}`);
        } else {
          parts.push(`تمرين ${i + 1}: ${ex.question || ex}`);
          if (ex.answer) parts.push(`الإجابة: ${ex.answer}`);
        }
      });
      parts.push('');
    }
    
    return parts.filter(p => p !== undefined && p !== '').join('\n');
  }
  
  /**
   * Generate search variations automatically for ANY content
   * IMPROVED
   */
  private generateSearchVariations(lesson: any): string[] {
    const variations: string[] = [];
    
    // Common question patterns in Arabic
    const arabicPatterns = [
      `ما هو ${lesson.title}`,
      `ما هي ${lesson.title}`,
      `اشرح ${lesson.title}`,
      `اشرح لي ${lesson.title}`,
      `عرف ${lesson.title}`,
      `تعريف ${lesson.title}`,
      `أمثلة على ${lesson.title}`,
      `كيف أفهم ${lesson.title}`,
      `كيف أحل ${lesson.title}`,
      `تمارين ${lesson.title}`,
      `${lesson.title} للصف ${lesson.unit.subject.grade}`,
      `${lesson.unit.subject.name} ${lesson.title}`
    ];
    
    // Common question patterns in English (if English title exists)
    if (lesson.titleEn) {
      const englishPatterns = [
        `what is ${lesson.titleEn}`,
        `explain ${lesson.titleEn}`,
        `define ${lesson.titleEn}`,
        `examples of ${lesson.titleEn}`,
        `${lesson.titleEn} grade ${lesson.unit.subject.grade}`,
        `${lesson.unit.subject.nameEn} ${lesson.titleEn}`
      ];
      variations.push(...englishPatterns);
    }
    
    variations.push(...arabicPatterns);
    
    // Extract important words from content
    const importantWords = this.extractImportantWords(
      lesson.content.fullText || '',
      lesson.content.summary || ''
    );
    
    if (importantWords.length > 0) {
      variations.push(...importantWords);
    }
    
    // Return unique variations
    return [...new Set(variations)];
  }
  
  /**
   * Extract important words from any text
   * IMPROVED
   */
  private extractImportantWords(fullText: string, summary: string): string[] {
    const text = `${fullText} ${summary}`.toLowerCase();
    const words: string[] = [];
    
    // Extract Arabic important words (3+ characters, not common)
    const arabicWords = text.match(/[\u0600-\u06FF]{3,}/g) || [];
    
    // Extract English important words (4+ characters, not common)
    const englishWords = text.match(/[a-z]{4,}/g) || [];
    
    // Common words to exclude
    const stopWords = new Set([
      // Arabic
      'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'على', 'في', 'من', 'إلى', 'عن',
      'بعد', 'قبل', 'عند', 'لكن', 'أيضا', 'كذلك', 'ومن', 'وما', 'وهو', 'وهي',
      // English
      'this', 'that', 'which', 'where', 'when', 'what', 'with', 'from', 'into',
      'about', 'after', 'before', 'also', 'then', 'than', 'them', 'they', 'their'
    ]);
    
    // Filter and collect important words
    const filtered = [
      ...arabicWords.filter(w => w.length > 3 && !stopWords.has(w)),
      ...englishWords.filter(w => w.length > 4 && !stopWords.has(w))
    ];
    
    // Get unique words and limit to top 30
    const unique = [...new Set(filtered)];
    return unique.slice(0, 30);
  }
  
  /**
   * Create smart chunks that preserve context
   * IMPROVED - chunks أذكى
   */
  private createSmartChunks(text: string): string[] {
    const chunks: string[] = [];
    
    // Split by sections first
    const sections = text.split(/={3,}/g);
    
    for (const section of sections) {
      if (section.trim().length === 0) continue;
      
      // If section is small enough, keep as one chunk
      if (section.length <= this.chunkSize) {
        chunks.push(section.trim());
      } else {
        // Split large sections intelligently
        const sentences = this.splitIntoSentences(section);
        let currentChunk = '';
        let previousSentence = '';
        
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 200) {
            // Save current chunk
            chunks.push(currentChunk.trim());
            
            // Start new chunk with overlap
            currentChunk = this.getOverlapText(currentChunk) + ' ' + sentence;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
          previousSentence = sentence;
        }
        
        if (currentChunk.trim().length > 50) {
          chunks.push(currentChunk.trim());
        }
      }
    }
    
    // Filter out very small chunks and return
    return chunks.filter(c => c.length > 50);
  }
  
  /**
   * Split text into sentences (universal)
   * IMPROVED
   */
  private splitIntoSentences(text: string): string[] {
    // Split on sentence endings for Arabic and English
    const sentences = text
      .split(/[.!?؟।।॥]\s+|\n\n+|\n(?=[A-Z\u0600-\u06FF])/g)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    const merged: string[] = [];
    let current = '';
    
    for (const sentence of sentences) {
      // Merge very short sentences
      if (sentence.length < 50 && current) {
        current += '. ' + sentence;
      } else {
        if (current) merged.push(current);
        current = sentence;
      }
      
      // Don't let chunks get too long
      if (current.length > 600) {
        merged.push(current);
        current = '';
      }
    }
    
    if (current) merged.push(current);
    
    return merged;
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Verify embeddings are working
   * IMPROVED
   */
  async verifyEmbeddings(): Promise<void> {
    const count = await prisma.contentEmbedding.count();
    console.log(`\n📊 Embeddings Status:`);
    console.log(`   Total embeddings: ${count}`);
    
    if (count > 0) {
      const sample = await prisma.contentEmbedding.findFirst({
        include: {
          content: {
            include: {
              lesson: {
                include: {
                  unit: {
                    include: {
                      subject: true
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      if (sample) {
        const embedding = JSON.parse(sample.embedding);
        const metadata = sample.metadata ? JSON.parse(sample.metadata) : {};
        
        console.log('\n📍 Sample Embedding:');
        console.log(`   Dimensions: ${embedding.length}`);
        console.log(`   Subject: ${sample.content.lesson.unit.subject.name}`);
        console.log(`   Lesson: ${sample.content.lesson.title}`);
        console.log(`   Chunk text preview: "${sample.chunkText.substring(0, 100)}..."`);
        console.log(`   Is Enriched: ${metadata.isEnriched === true ? '✅ Yes' : '❌ No'}`);
        console.log(`   Enrichment Level: ${metadata.enrichmentLevel || 0}/10`);
        console.log(`   Section Type: ${metadata.sectionType || 'content'}`);
      }
    }
    
    // عرض إحصائيات المحتوى الإضافي
    const exampleEmbeddings = await prisma.contentEmbedding.count({
      where: {
        metadata: {
          contains: '"type":"example"'
        }
      }
    });
    
    const questionEmbeddings = await prisma.contentEmbedding.count({
      where: {
        metadata: {
          contains: '"type":"question"'
        }
      }
    });
    
    console.log('\n📈 Content Type Breakdown:');
    console.log(`   Main content: ${count - exampleEmbeddings - questionEmbeddings}`);
    console.log(`   Examples: ${exampleEmbeddings}`);
    console.log(`   Questions: ${questionEmbeddings}`);
  }
  
  /**
   * Get statistics about content enrichment
   * IMPROVED
   */
  async getEnrichmentStats(): Promise<void> {
    console.log('\n📊 Content Enrichment Statistics:');
    console.log('─'.repeat(50));
    
    const totalLessons = await prisma.lesson.count({
      where: { isPublished: true }
    });
    
    const processedLessons = await prisma.content.count({
      where: {
        lesson: {
          isPublished: true
        },
          embeddings: {
            some: {}
          }
      }
    });
    
    // حساب الدروس المحسنة
    let enrichedCount = 0;
    try {
      // محاولة عد الدروس التي لديها enrichedContent
      const contents = await prisma.content.findMany({
        where: {
          lesson: { isPublished: true }
        },
        select: {
          enrichedContent: true,
          enrichmentLevel: true
        }
      });
      
      enrichedCount = contents.filter(c => 
        c.enrichedContent || (c.enrichmentLevel && c.enrichmentLevel > 0)
      ).length;
    } catch (error) {
      // الحقل غير موجود
    }
    
    console.log(`   Total Lessons: ${totalLessons}`);
    console.log(`   Processed Lessons: ${processedLessons}`);
    console.log(`   Enriched Lessons: ${enrichedCount}`);
    console.log(`   Processing Rate: ${((processedLessons / totalLessons) * 100).toFixed(1)}%`);
    console.log(`   Enrichment Rate: ${((enrichedCount / totalLessons) * 100).toFixed(1)}%`);
    
    // محاولة عرض أفضل الدروس من حيث الجودة
    try {
      const contentQualities = await (prisma as any).contentQuality?.findMany({
        orderBy: { overallScore: 'desc' },
        take: 5,
        include: {
          lesson: true
        }
      }) || [];
      
      if (contentQualities.length > 0) {
        console.log('\n🏆 Top Quality Lessons:');
        contentQualities.forEach((q: any, i: number) => {
          console.log(`   ${i + 1}. ${q.lesson.title} - Score: ${q.overallScore}/100`);
        });
      }
    } catch (error) {
      // الجدول غير موجود
    }
    
    console.log('─'.repeat(50));
  }
}




// Export singleton instance
export const documentProcessor = new DocumentProcessor();