// src/core/rag/document.processor.ts (النسخة العامة الكاملة)

import { openAIService } from '../../services/ai/openai.service';
import { prisma } from '../../config/database.config';
import type { DocumentChunk } from '../../types/rag.types';

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
    
    // Delete existing embeddings
    await prisma.contentEmbedding.deleteMany({
      where: { contentId: lesson.content.id },
    });
    
    // Create universal enriched content
    const enrichedContent = await this.createUniversalEnrichedContent(lesson);
    
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
  }
  
  /**
   * Create universal enriched content for ANY subject
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
  
  // باقي الدوال كما هي...
  
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
        console.log(`   Embedding dimensions: ${embedding.length}`);
        console.log(`   Subject: ${sample.content.lesson.unit.subject.name}`);
        console.log(`   Lesson: ${sample.content.lesson.title}`);
        console.log(`   Sample text: ${sample.chunkText.substring(0, 50)}...`);
      }
    }
  }
}

export const documentProcessor = new DocumentProcessor();