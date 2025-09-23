// src/core/rag/document.processor.ts (النسخة المحدثة مع إصلاح الأخطاء)

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
  private readonly chunkSize = 500;
  private readonly chunkOverlap = 50;
  
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
        await this.delay(5000);
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
   * NEW METHOD - يحسن المحتوى قبل معالجته
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
        
        console.log(`✅ Content enriched: ${enrichmentResult.enrichmentRatio}x increase`);
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
   * UPDATED to handle enriched content if available
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
    
    // التحقق من وجود محتوى محسن
    let contentToProcess: string;
    
    if (content.enrichedContent) {
      console.log('   📝 Using enriched content for embeddings');
      contentToProcess = this.buildEnrichedText(lesson);
    } else {
      console.log('   📝 Using original content');
      contentToProcess = await this.createUniversalEnrichedContent(lesson);
    }
    
    // Create smart chunks
    const chunks = this.createSmartChunks(contentToProcess);
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
              isEnriched: !!(content.enrichedContent),
              enrichmentLevel: content.enrichmentLevel || 0,
            }),
          },
        });
      } catch (error: any) {
        console.error(`      ❌ Failed to process chunk ${i + 1}: ${error.message}`);
      }
    }
  }
  
  /**
   * Process enriched content specifically
   * NEW METHOD
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
    
    if (content.enrichedContent) {
      const enriched = JSON.parse(content.enrichedContent);
      contentToProcess = this.buildEnrichedTextFromJSON(enriched);
      console.log('📝 Using enriched content for embeddings');
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
            metadata: JSON.stringify(chunk.metadata),
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
   * NEW METHOD
   */
  private async indexAdditionalContent(lessonId: string): Promise<void> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });
    
    if (!lesson?.content) return;
    
    // فهرسة الأمثلة
    const examples = await prisma.example.findMany({
      where: { lessonId: lesson.id },
    });
    
    for (const example of examples) {
      const text = `مثال: ${example.problem}\nالحل: ${example.solution}`;
      const { embedding } = await openAIService.generateEmbedding(text);
      
      // توليد index number آمن
      const indexNum = 10000 + (parseInt(example.id.replace(/[^0-9]/g, '').substring(0, 4)) || 0);
      
      await prisma.contentEmbedding.create({
        data: {
          contentId: lesson.content.id,
          chunkIndex: indexNum,
          chunkText: text,
          embedding: JSON.stringify(embedding),
          metadata: JSON.stringify({
            type: 'example',
            exampleId: example.id,
            lessonId: lesson.id,
          }),
        },
      }).catch(() => {});
    }
    
    console.log(`   📌 Indexed ${examples.length} examples`);
    
    // فهرسة الأسئلة
    const questions = await prisma.question.findMany({
      where: { lessonId: lesson.id },
    });
    
    for (const question of questions) {
      const text = `سؤال: ${question.question}\nالإجابة: ${question.correctAnswer}${question.explanation ? '\nالشرح: ' + question.explanation : ''}`;
      const { embedding } = await openAIService.generateEmbedding(text);
      
      // توليد index number آمن
      const indexNum = 20000 + (parseInt(question.id.replace(/[^0-9]/g, '').substring(0, 4)) || 0);
      
      await prisma.contentEmbedding.create({
        data: {
          contentId: lesson.content.id,
          chunkIndex: indexNum,
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
    
    console.log(`   📌 Indexed ${questions.length} questions`);
    
    // فهرسة العناصر المرئية (إن وجدت الجداول في DB)
    try {
      const visualElements = await (prisma as any).visualElement?.findMany({
        where: { lessonId: lesson.id },
      }) || [];
      
      for (const visual of visualElements) {
        const text = `${visual.title}: ${visual.description || ''}`;
        const { embedding } = await openAIService.generateEmbedding(text);
        
        // توليد index number آمن
        const indexNum = 30000 + (parseInt(visual.id.replace(/[^0-9]/g, '').substring(0, 4)) || 0);
        
        await prisma.contentEmbedding.create({
          data: {
            contentId: lesson.content.id,
            chunkIndex: indexNum,
            chunkText: text,
            embedding: JSON.stringify(embedding),
            metadata: JSON.stringify({
              type: 'visual',
              visualId: visual.id,
              visualType: visual.type,
              lessonId: lesson.id,
            }),
          },
        }).catch(() => {});
      }
      
      if (visualElements.length > 0) {
        console.log(`   📌 Indexed ${visualElements.length} visual elements`);
      }
    } catch (error) {
      // الجدول غير موجود بعد، لا مشكلة
    }
  }
  
  /**
   * Build enriched text from JSON
   * NEW METHOD
   */
  private buildEnrichedTextFromJSON(enriched: any): string {
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
    
    // المفاهيم الخاطئة الشائعة
    if (enriched.commonMisconceptions?.length > 0) {
      parts.push('\n=== تصحيح المفاهيم الخاطئة ===');
      enriched.commonMisconceptions.forEach((misc: any) => {
        parts.push(`\n❌ الخطأ الشائع: ${misc.commonMistake}`);
        parts.push(`✅ الفهم الصحيح: ${misc.correctUnderstanding}`);
      });
    }
    
    // الأهداف التعليمية
    if (enriched.learningObjectives?.length > 0) {
      parts.push('\n=== الأهداف التعليمية ===');
      enriched.learningObjectives.forEach((objective: string) => {
        parts.push(`• ${objective}`);
      });
    }
    
    return parts.filter(p => p).join('\n');
  }
  
  /**
   * Build enriched text from existing content
   * NEW METHOD - للتوافق مع الكود القديم
   */
  private buildEnrichedText(lesson: any): string {
    const content = lesson.content as ExtendedContent;
    if (content.enrichedContent) {
      const enriched = JSON.parse(content.enrichedContent);
      return this.buildEnrichedTextFromJSON(enriched);
    }
    
    // Fallback to original content
    return this.createUniversalEnrichedContentSync(lesson);
  }
  
  /**
   * Create enhanced chunks with better metadata
   * NEW METHOD
   */
  private createEnhancedChunks(
    content: string,
    lesson: any
  ): Array<{ text: string; metadata: any }> {
    const chunks: Array<{ text: string; metadata: any }> = [];
    const sections = content.split(/={3,}/);
    
    sections.forEach((section, sectionIndex) => {
      if (!section.trim()) return;
      
      const paragraphs = section.split(/\n\n+/);
      let currentChunk = '';
      
      paragraphs.forEach((paragraph) => {
        if ((currentChunk.length + paragraph.length) > 800) {
          if (currentChunk.trim()) {
            chunks.push({
              text: currentChunk.trim(),
              metadata: this.buildChunkMetadata(lesson, sectionIndex, chunks.length),
            });
          }
          currentChunk = paragraph;
        } else {
          currentChunk += '\n\n' + paragraph;
        }
      });
      
      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          metadata: this.buildChunkMetadata(lesson, sectionIndex, chunks.length),
        });
      }
    });
    
    return chunks;
  }
  
  /**
   * Build metadata for chunk
   * NEW METHOD
   */
  private buildChunkMetadata(lesson: any, sectionIndex: number, chunkIndex: number): any {
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
      chunkIndex,
      isEnriched: true,
      enrichmentDate: new Date().toISOString(),
      enrichmentLevel: content.enrichmentLevel || 0,
    };
  }
  
  /**
   * Synchronous version of createUniversalEnrichedContent
   * NEW METHOD - للتوافق
   */
  private createUniversalEnrichedContentSync(lesson: any): string {
    return this.createUniversalEnrichedContentInternal(lesson);
  }
  
  /**
   * Create universal enriched content for ANY subject
   * UPDATED - جعلها async/sync compatible
   */
  private async createUniversalEnrichedContent(lesson: any): Promise<string> {
    return this.createUniversalEnrichedContentInternal(lesson);
  }
  
  /**
   * Internal method for content creation
   * EXTRACTED للاستخدام من كلا النوعين
   */
  private createUniversalEnrichedContentInternal(lesson: any): string {
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
      content.fullText || '',
      '',
      
      // === Key points ===
      '=== النقاط الأساسية | Key Points ===',
      ...keyPoints.map((point: string, i: number) => `${i + 1}. ${point}`),
      '',
      
      // === Summary ===
      '=== الملخص | Summary ===',
      content.summary || '',
      ''
    ];
    
    // Add examples if available
    if (examples.length > 0) {
      parts.push('=== الأمثلة | Examples ===');
      examples.forEach((ex: any) => {
        if (typeof ex === 'string') {
          parts.push(ex);
        } else {
          parts.push(`المثال | Example: ${ex.problem || ex.question || ''}`);
          parts.push(`الحل | Solution: ${ex.solution || ex.answer || ''}`);
        }
      });
      parts.push('');
    }
    
    // Add exercises if available
    if (exercises.length > 0) {
      parts.push('=== التمارين | Exercises ===');
      parts.push(...exercises.map((ex: any, i: number) => `${i + 1}. ${ex}`));
      parts.push('');
    }
    
    return parts.filter(p => p !== undefined && p !== '').join('\n');
  }
  
  /**
   * Generate search variations automatically for ANY content
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
      `مثال على ${lesson.title}`,
      `كيف أفهم ${lesson.title}`,
      `كيف أحل ${lesson.title}`,
      `تمارين ${lesson.title}`,
      `${lesson.title} للصف ${lesson.unit.subject.grade}`,
    ];
    
    // Common question patterns in English (if English title exists)
    const englishPatterns = lesson.titleEn ? [
      `what is ${lesson.titleEn}`,
      `explain ${lesson.titleEn}`,
      `define ${lesson.titleEn}`,
      `examples of ${lesson.titleEn}`,
      `how to solve ${lesson.titleEn}`,
      `${lesson.titleEn} grade ${lesson.unit.subject.grade}`,
    ] : [];
    
    // Add all patterns
    variations.push(...arabicPatterns);
    variations.push(...englishPatterns);
    
    // Add subject-specific terms
    variations.push(`${lesson.unit.subject.name} ${lesson.title}`);
    if (lesson.unit.subject.nameEn) {
      variations.push(`${lesson.unit.subject.nameEn} ${lesson.titleEn || lesson.title}`);
    }
    
    // Extract important words from content
    const importantWords = this.extractImportantWords(
      lesson.content.fullText || '',
      lesson.content.summary || ''
    );
    
    if (importantWords.length > 0) {
      variations.push(importantWords.join(' | '));
    }
    
    // Return as formatted lines
    return [variations.join(' | ')];
  }
  
  /**
   * Extract important words from any text
   */
  private extractImportantWords(fullText: string, summary: string): string[] {
    const text = `${fullText} ${summary}`.toLowerCase();
    const words: string[] = [];
    
    // Extract Arabic important words (3+ characters, not common)
    const arabicWords = text.match(/[\u0600-\u06FF]{3,}/g) || [];
    
    // Extract English important words (4+ characters, not common)
    const englishWords = text.match(/[a-z]{4,}/g) || [];
    
    // Common words to exclude (expandable)
    const stopWords = new Set([
      // Arabic
      'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'التي', 'على', 'في', 'من', 'إلى',
      // English
      'this', 'that', 'which', 'where', 'when', 'what', 'with', 'from', 'into'
    ]);
    
    // Filter and collect important words
    const filtered = [
      ...arabicWords.filter(w => !stopWords.has(w)),
      ...englishWords.filter(w => !stopWords.has(w))
    ];
    
    // Get unique words and limit to top 20
    const unique = [...new Set(filtered)];
    return unique.slice(0, 20);
  }
  
  /**
   * Create smart chunks that preserve context
   */
  private createSmartChunks(text: string): string[] {
    const chunks: string[] = [];
    
    // Split by sections first
    const sections = text.split(/===/g);
    
    for (const section of sections) {
      if (section.trim().length === 0) continue;
      
      // If section is small enough, keep as one chunk
      if (section.length <= this.chunkSize) {
        chunks.push(section.trim());
      } else {
        // Split large sections into sentences
        const sentences = this.splitIntoSentences(section);
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            
            // Add overlap from previous chunk
            const words = currentChunk.split(' ');
            const overlapWords = words.slice(-10);
            currentChunk = overlapWords.join(' ') + ' ' + sentence;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
        
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
        }
      }
    }
    
    return chunks.filter(c => c.length > 20);
  }
  
  /**
   * Split text into sentences (universal)
   */
  private splitIntoSentences(text: string): string[] {
    const sentences = text
      .split(/[.!?؟।।॥]\s+|\n\n|\n(?=[A-Z\u0600-\u06FF])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    const merged: string[] = [];
    let current = '';
    
    for (const sentence of sentences) {
      if (sentence.length < 30 && current) {
        current += '. ' + sentence;
      } else {
        if (current) merged.push(current);
        current = sentence;
      }
    }
    
    if (current) merged.push(current);
    
    return merged;
  }
  
  /**
   * Delay helper
   * NEW METHOD
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Verify embeddings are working
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
        console.log(`   Embedding dimensions: ${embedding.length}`);
        console.log(`   Subject: ${sample.content.lesson.unit.subject.name}`);
        console.log(`   Lesson: ${sample.content.lesson.title}`);
        console.log(`   Sample text: ${sample.chunkText.substring(0, 50)}...`);
        console.log(`   Is Enriched: ${metadata.isEnriched || false}`);
        console.log(`   Enrichment Level: ${metadata.enrichmentLevel || 0}`);
      }
    }
  }
  
  /**
   * Get statistics about content enrichment
   * NEW METHOD
   */
  async getEnrichmentStats(): Promise<void> {
    console.log('\n📊 Content Enrichment Statistics:');
    console.log('─'.repeat(50));
    
    const totalLessons = await prisma.lesson.count({
      where: { isPublished: true }
    });
    
    // التعامل مع عدم وجود حقل enrichedContent
    const enrichedLessons = await prisma.content.count({
  where: {
    lesson: {
      isPublished: true
    }
  }
});
    
    // محاولة الحصول على contentQuality إذا كان موجود
    let contentQualities: any[] = [];
    try {
      contentQualities = await (prisma as any).contentQuality?.findMany({
        orderBy: { overallScore: 'desc' },
        take: 5,
        include: {
          lesson: true
        }
      }) || [];
    } catch (error) {
      // الجدول غير موجود، لا مشكلة
    }
    
    console.log(`   Total Lessons: ${totalLessons}`);
    console.log(`   Processed Lessons: ${enrichedLessons}`);
    console.log(`   Processing Rate: ${((enrichedLessons / totalLessons) * 100).toFixed(1)}%`);
    
    if (contentQualities.length > 0) {
      console.log('\n   Top Quality Lessons:');
      contentQualities.forEach((q: any, i: number) => {
        console.log(`   ${i + 1}. ${q.lesson.title} - Score: ${q.overallScore}/100`);
      });
    }
    
    console.log('─'.repeat(50));
  }
}

export const documentProcessor = new DocumentProcessor();