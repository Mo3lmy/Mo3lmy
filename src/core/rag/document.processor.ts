import { openAIService } from '../../services/ai/openai.service';
import { prisma } from '../../config/database.config';
import type { DocumentChunk } from '../../types/rag.types';

export class DocumentProcessor {
  private readonly chunkSize = 500; // characters
  private readonly chunkOverlap = 50; // characters
  
  /**
   * Process ALL lessons in database
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
   * Process lesson content with better chunking
   */
  async processLessonContent(lessonId: string): Promise<void> {
    // Get full lesson info
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
    
    // Prepare rich content for embedding
    const fullContent = this.prepareRichContent(lesson);
    
    // Create smart chunks
    const chunks = this.createSmartChunks(fullContent);
    console.log(`   📄 Created ${chunks.length} chunks`);
    
    // Generate and store embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Generate embedding
        const { embedding } = await openAIService.generateEmbedding(chunk);
        
        // Store in database with rich metadata
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
   * Prepare rich content including all lesson data
   */
  private prepareRichContent(lesson: any): string {
    const content = lesson.content;
    const keyPoints = content.keyPoints ? JSON.parse(content.keyPoints) : [];
    const examples = content.examples ? JSON.parse(content.examples) : [];
    const exercises = content.exercises ? JSON.parse(content.exercises) : [];
    
    // Build comprehensive content
    const parts = [
      `الدرس: ${lesson.title}`,
      lesson.titleEn ? `Lesson: ${lesson.titleEn}` : '',
      `الوحدة: ${lesson.unit.title}`,
      `المادة: ${lesson.unit.subject.name}`,
      `الصف: ${lesson.unit.subject.grade}`,
      '',
      '=== المحتوى الرئيسي ===',
      content.fullText || '',
      '',
      '=== النقاط الأساسية ===',
      ...keyPoints.map((point: string, i: number) => `${i + 1}. ${point}`),
      '',
      '=== الأمثلة التوضيحية ===',
      ...examples.map((ex: any) => {
        if (typeof ex === 'string') return ex;
        return `المثال: ${ex.problem || ex.question || ''}\nالحل: ${ex.solution || ex.answer || ''}`;
      }),
      '',
      '=== الملخص ===',
      content.summary || '',
    ];
    
    // Add exercises if available
    if (exercises.length > 0) {
      parts.push('', '=== التمارين ===');
      parts.push(...exercises.map((ex: any, i: number) => `${i + 1}. ${ex}`));
    }
    
    return parts.filter(p => p !== undefined && p !== '').join('\n');
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
            const overlapWords = words.slice(-10); // Last 10 words
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
    
    return chunks.filter(c => c.length > 20); // Filter out very small chunks
  }
  
  /**
   * Split text into sentences (Arabic & English)
   */
  private splitIntoSentences(text: string): string[] {
    // Enhanced sentence splitting for Arabic and English
    const sentences = text
      .split(/[.!?؟।।॥]\s+|\n\n|\n(?=[A-Z\u0600-\u06FF])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Merge very short sentences
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
   * Process multiple lessons
   */
  async processMultipleLessons(lessonIds: string[]): Promise<void> {
    console.log(`🚀 Processing ${lessonIds.length} lessons...`);
    
    for (const lessonId of lessonIds) {
      try {
        await this.processLessonContent(lessonId);
      } catch (error) {
        console.error(`❌ Failed to process lesson ${lessonId}:`, error);
      }
    }
    
    console.log('✅ Batch processing complete');
  }
  
  /**
   * Clean text for better embedding
   */
  cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/[^\w\s\u0600-\u06FF\u0750-\u077F.!?؟،]/g, ' ')
      .trim();
  }
  
  /**
   * Extract key points from text using AI
   */
  async extractKeyPoints(text: string): Promise<string[]> {
    const prompt = `استخرج 3-5 نقاط رئيسية من هذا النص. أرجع النتيجة كـ JSON array:

النص: ${text}

النقاط الرئيسية (JSON array):`;
    
    const response = await openAIService.chat([
      { role: 'system', content: 'أنت مساعد يستخرج النقاط المهمة من المحتوى التعليمي.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, maxTokens: 200 });
    
    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return [];
    }
  }
  
  /**
   * Generate summary using AI
   */
  async generateSummary(text: string): Promise<string> {
    const prompt = `لخص هذا المحتوى التعليمي في 2-3 جمل بالعربية:

${text}

الملخص:`;
    
    const response = await openAIService.chat([
      { role: 'system', content: 'أنت مساعد يقوم بتلخيص المحتوى التعليمي بإيجاز.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.5, maxTokens: 150 });
    
    return response.trim();
  }
  
  /**
   * Verify embeddings are working
   */
  async verifyEmbeddings(): Promise<void> {
    const count = await prisma.contentEmbedding.count();
    console.log(`\n📊 Embeddings Status:`);
    console.log(`   Total embeddings: ${count}`);
    
    if (count > 0) {
      const sample = await prisma.contentEmbedding.findFirst();
      if (sample) {
        const embedding = JSON.parse(sample.embedding);
        console.log(`   Embedding dimensions: ${embedding.length}`);
        console.log(`   Sample text: ${sample.chunkText.substring(0, 50)}...`);
      }
    }
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();