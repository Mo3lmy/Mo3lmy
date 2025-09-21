import { openAIService } from '../../services/ai/openai.service';
import { prisma } from '../../config/database.config';
import type { DocumentChunk } from '../../types/rag.types';

export class DocumentProcessor {
  private readonly chunkSize = 500; // characters
  private readonly chunkOverlap = 50; // characters
  
  /**
   * Process lesson content and generate embeddings
   */
  async processLessonContent(lessonId: string): Promise<void> {
    console.log(`📄 Processing content for lesson: ${lessonId}`);
    
    // Get lesson content
    const content = await prisma.content.findUnique({
      where: { lessonId },
    });
    
    if (!content) {
      throw new Error('Content not found for lesson');
    }
    
    // Create chunks
    const chunks = this.createChunks(content.fullText);
    console.log(`📝 Created ${chunks.length} chunks`);
    
    // Delete existing embeddings
    await prisma.contentEmbedding.deleteMany({
      where: { contentId: content.id },
    });
    
    // Generate and store embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}`);
      
      // Generate embedding
      const { embedding } = await openAIService.generateEmbedding(chunk);
      
      // Store in database
      await prisma.contentEmbedding.create({
        data: {
          contentId: content.id,
          chunkIndex: i,
          chunkText: chunk,
          embedding: JSON.stringify(embedding),
          metadata: JSON.stringify({
            lessonId,
            chunkLength: chunk.length,
            position: i,
            total: chunks.length,
          }),
        },
      });
    }
    
    console.log(`✅ Successfully processed lesson content`);
  }
  
  /**
   * Create text chunks with overlap
   */
  createChunks(text: string): string[] {
    const chunks: string[] = [];
    const sentences = this.splitIntoSentences(text);
    
    let currentChunk = '';
    let overlap = '';
    
    for (const sentence of sentences) {
      // If adding this sentence exceeds chunk size, save current chunk
      if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Keep last part for overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(this.chunkOverlap / 5));
        overlap = overlapWords.join(' ');
        
        currentChunk = overlap + ' ' + sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }
    
    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  /**
   * Split text into sentences (works with Arabic and English)
   */
  private splitIntoSentences(text: string): string[] {
    // Split by common sentence endings
    const sentences = text.split(/[.!?؟।।॥]\s+|\n\n/);
    
    return sentences
      .map(s => s.trim())
      .filter(s => s.length > 0);
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
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove special characters but keep Arabic
      .replace(/[^\w\s\u0600-\u06FF\u0750-\u077F]/g, ' ')
      .trim();
  }
  
  /**
   * Extract key points from text using AI
   */
  async extractKeyPoints(text: string): Promise<string[]> {
    const prompt = `Extract 3-5 key points from this text. Return as a JSON array of strings:

Text: ${text}

Key points (JSON array):`;
    
    const response = await openAIService.chat([
      { role: 'system', content: 'You are a helpful assistant that extracts key points from educational content.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, maxTokens: 200 });
    
    try {
      return JSON.parse(response);
    } catch {
      return [];
    }
  }
  
  /**
   * Generate summary using AI
   */
  async generateSummary(text: string): Promise<string> {
    const prompt = `Summarize this educational content in 2-3 sentences in Arabic:

${text}

Summary:`;
    
    const response = await openAIService.chat([
      { role: 'system', content: 'You are a helpful assistant that creates concise summaries of educational content in Arabic.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.5, maxTokens: 150 });
    
    return response.trim();
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();