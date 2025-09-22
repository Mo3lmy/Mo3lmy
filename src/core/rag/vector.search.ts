import { openAIService } from '../../services/ai/openai.service';
import { prisma } from '../../config/database.config';
import type { SearchResult, DocumentChunk } from '../../types/rag.types';

export class VectorSearchService {
  // تقليل الـ threshold للحصول على نتائج أكثر
  private readonly DEFAULT_THRESHOLD = 0.2; // بدلاً من 0.7
  private readonly MIN_SCORE_FOR_RELEVANCE = 0.15;
  
  /**
   * Search for similar content using vector similarity with improved accuracy
   */
  async searchSimilar(
    query: string,
    limit: number = 5,
    threshold: number = this.DEFAULT_THRESHOLD
  ): Promise<SearchResult[]> {
    console.log(`🔍 Searching for: "${query}" with threshold: ${threshold}`);
    
    // Generate embedding for query
    const { embedding: queryEmbedding } = await openAIService.generateEmbedding(query);
    
    // Get all embeddings from database (TODO: optimize with pgvector in production)
    const allEmbeddings = await prisma.contentEmbedding.findMany({
      include: {
        content: {
          include: {
            lesson: {
              include: {
                unit: {
                  include: {
                    subject: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    
    console.log(`📊 Found ${allEmbeddings.length} embeddings to search`);
    
    // Calculate similarities with better scoring
    const results: SearchResult[] = [];
    let maxScore = 0;
    let minScore = 1;
    
    for (const embedding of allEmbeddings) {
      try {
        const storedEmbedding = JSON.parse(embedding.embedding) as number[];
        const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
        
        // Track min/max for debugging
        if (similarity > maxScore) maxScore = similarity;
        if (similarity < minScore) minScore = similarity;
        
        // More lenient threshold
        if (similarity >= threshold) {
          const metadata = embedding.metadata ? JSON.parse(embedding.metadata) : {};
          
          results.push({
            chunk: {
              id: embedding.id,
              text: embedding.chunkText || '',
              metadata: {
                contentId: embedding.contentId,
                lessonId: embedding.content.lessonId,
                chunkIndex: embedding.chunkIndex,
                source: 'lesson',
                title: embedding.content.lesson.title,
                ...metadata
              },
            },
            score: similarity,
            lessonInfo: {
              id: embedding.content.lesson.id,
              title: embedding.content.lesson.title,
              unitTitle: embedding.content.lesson.unit.title,
              subjectName: embedding.content.lesson.unit.subject.name,
            },
          });
        }
      } catch (error) {
        console.error('Error processing embedding:', error);
        continue;
      }
    }
    
    console.log(`📈 Similarity scores: min=${minScore.toFixed(3)}, max=${maxScore.toFixed(3)}`);
    console.log(`✅ Found ${results.length} results above threshold ${threshold}`);
    
    // إذا لم نجد نتائج، قلل الـ threshold تلقائياً
    if (results.length === 0 && threshold > this.MIN_SCORE_FOR_RELEVANCE) {
      console.log(`⚠️ No results found, trying with lower threshold...`);
      return this.searchSimilar(query, limit, this.MIN_SCORE_FOR_RELEVANCE);
    }
    
    // Sort by similarity and return top results
    const sortedResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Log top results for debugging
    if (sortedResults.length > 0) {
      console.log(`\n🎯 Top results:`);
      sortedResults.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.lessonInfo?.title ?? 'N/A'} (score: ${r.score.toFixed(3)})`);
        console.log(`     ${r.chunk.text.substring(0, 100)}...`);
      });
    }
    
    return sortedResults;
  }
  
  /**
   * Enhanced search with fallback strategies
   */
  async enhancedSearch(
    query: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    // 1. جرب البحث العادي
    let results = await this.searchSimilar(query, limit);
    
    // 2. إذا لم تجد نتائج، جرب hybrid search
    if (results.length === 0) {
      console.log('🔄 Trying hybrid search...');
      
      // استخرج الكلمات المفتاحية
      const keywords = this.extractKeywords(query);
      results = await this.hybridSearch(query, keywords, limit);
    }
    
    // 3. إذا مازال لا يوجد نتائج، جرب keyword search فقط
    if (results.length === 0) {
      console.log('🔄 Trying keyword search...');
      const keywords = this.extractKeywords(query);
      results = await this.keywordSearch(keywords, limit);
    }
    
    // 4. أخيراً، جرب البحث بأجزاء من السؤال
    if (results.length === 0) {
      console.log('🔄 Trying partial search...');
      results = await this.partialSearch(query, limit);
    }
    
    return results;
  }
  
  /**
   * Search within a specific lesson with improved accuracy
   */
  async searchInLesson(
    lessonId: string,
    query: string,
    limit: number = 3
  ): Promise<SearchResult[]> {
    // إذا لم يكن هناك query، أرجع كل محتوى الدرس
    if (!query || query.trim() === '') {
      const embeddings = await prisma.contentEmbedding.findMany({
        where: { content: { lessonId } },
        include: {
          content: {
            include: {
              lesson: {
                include: {
                  unit: { include: { subject: true } }
                }
              }
            }
          }
        },
        take: limit
      });
      
      return embeddings.map(embedding => ({
        chunk: {
          id: embedding.id,
          text: embedding.chunkText,
          metadata: {
            contentId: embedding.contentId,
            lessonId,
            chunkIndex: embedding.chunkIndex,
            source: 'lesson',
            title: embedding.content.lesson.title,
          },
        },
        score: 1.0,
        lessonInfo: {
          id: embedding.content.lesson.id,
          title: embedding.content.lesson.title,
          unitTitle: embedding.content.lesson.unit.title,
          subjectName: embedding.content.lesson.unit.subject.name,
        },
      }));
    }
    
    // البحث العادي بـ embeddings
    const { embedding: queryEmbedding } = await openAIService.generateEmbedding(query);
    
    const embeddings = await prisma.contentEmbedding.findMany({
      where: { content: { lessonId } },
      include: {
        content: {
          include: {
            lesson: {
              include: {
                unit: { include: { subject: true } }
              }
            }
          }
        }
      }
    });
    
    const results: SearchResult[] = [];
    
    for (const embedding of embeddings) {
      const storedEmbedding = JSON.parse(embedding.embedding) as number[];
      const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
      
      results.push({
        chunk: {
          id: embedding.id,
          text: embedding.chunkText,
          metadata: {
            contentId: embedding.contentId,
            lessonId,
            chunkIndex: embedding.chunkIndex,
            source: 'lesson',
            title: embedding.content.lesson.title,
          },
        },
        score: similarity,
        lessonInfo: {
          id: embedding.content.lesson.id,
          title: embedding.content.lesson.title,
          unitTitle: embedding.content.lesson.unit.title,
          subjectName: embedding.content.lesson.unit.subject.name,
        },
      });
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * Hybrid search: combine vector and keyword search
   */
  async hybridSearch(
    query: string,
    keywords?: string[],
    limit: number = 5
  ): Promise<SearchResult[]> {
    // Vector search with lower threshold
    const vectorResults = await this.searchSimilar(query, limit * 2, 0.15);
    
    // Extract keywords if not provided
    const searchKeywords = keywords || this.extractKeywords(query);
    
    if (searchKeywords.length > 0) {
      const keywordResults = await this.keywordSearch(searchKeywords, limit);
      
      // Merge results
      const merged = new Map<string, SearchResult>();
      
      // Add vector results (60% weight)
      vectorResults.forEach(result => {
        merged.set(result.chunk.id, {
          ...result,
          score: result.score * 0.6,
        });
      });
      
      // Add keyword results (40% weight)
      keywordResults.forEach(result => {
        const existing = merged.get(result.chunk.id);
        if (existing) {
          existing.score += result.score * 0.4;
        } else {
          merged.set(result.chunk.id, {
            ...result,
            score: result.score * 0.4,
          });
        }
      });
      
      return Array.from(merged.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }
    
    return vectorResults.slice(0, limit);
  }
  
  /**
   * Improved keyword search with Arabic support
   */
  private async keywordSearch(
    keywords: string[],
    limit: number
  ): Promise<SearchResult[]> {
    if (keywords.length === 0) return [];
    
    console.log(`🔤 Keyword search for: ${keywords.join(', ')}`);
    
    const embeddings = await prisma.contentEmbedding.findMany({
      where: {
        OR: keywords.map(keyword => ({
          chunkText: {
            contains: keyword,
            mode: 'insensitive' // Case-insensitive search
          },
        })),
      },
      take: limit * 2, // Get more results to filter
      include: {
        content: {
          include: {
            lesson: {
              include: {
                unit: {
                  include: {
                    subject: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    
    // Score based on keyword frequency
    return embeddings.map(embedding => {
      let score = 0;
      const text = embedding.chunkText.toLowerCase();
      
      keywords.forEach(keyword => {
        const occurrences = (text.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
        score += occurrences * 0.1;
      });
      
      return {
        chunk: {
          id: embedding.id,
          text: embedding.chunkText,
          metadata: {
            contentId: embedding.contentId,
            lessonId: embedding.content.lessonId,
            chunkIndex: embedding.chunkIndex,
            source: 'lesson',
            title: embedding.content.lesson.title,
          },
        },
        score: Math.min(score, 1.0),
        lessonInfo: {
          id: embedding.content.lesson.id,
          title: embedding.content.lesson.title,
          unitTitle: embedding.content.lesson.unit.title,
          subjectName: embedding.content.lesson.unit.subject.name,
        },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  }
  
  /**
   * Partial search - search with parts of the query
   */
  private async partialSearch(
    query: string,
    limit: number
  ): Promise<SearchResult[]> {
    const words = query.split(' ').filter(w => w.length > 2);
    
    if (words.length <= 1) {
      return [];
    }
    
    // Try with first half of query
    const halfQuery = words.slice(0, Math.ceil(words.length / 2)).join(' ');
    console.log(`🔄 Trying partial search with: "${halfQuery}"`);
    
    return this.searchSimilar(halfQuery, limit, 0.15);
  }
  
  /**
   * Extract keywords from Arabic/English text
   */
  private extractKeywords(text: string): string[] {
    // Remove common Arabic stop words
    const arabicStopWords = ['في', 'من', 'على', 'هي', 'هو', 'ما', 'كيف', 'متى', 'أين', 'لماذا'];
    const englishStopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was', 'were'];
    
    const words = text
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 2)
      .filter(w => !arabicStopWords.includes(w))
      .filter(w => !englishStopWords.includes(w.toLowerCase()));
    
    // Also add important terms
    const importantTerms: string[] = [];
    
    // Check for math terms
    if (text.includes('ضرب') || text.includes('الضرب')) importantTerms.push('ضرب');
    if (text.includes('جمع') || text.includes('الجمع')) importantTerms.push('جمع');
    if (text.includes('طرح') || text.includes('الطرح')) importantTerms.push('طرح');
    if (text.includes('قسم') || text.includes('القسمة')) importantTerms.push('قسمة');
    if (text.includes('كسر') || text.includes('كسور')) importantTerms.push('كسور');
    if (text.includes('عدد') || text.includes('أعداد')) importantTerms.push('أعداد');
    
    return [...new Set([...words, ...importantTerms])];
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      console.error(`Vector length mismatch: ${a.length} vs ${b.length}`);
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }
  
  /**
   * Debug method to check embeddings
   */
  async debugEmbeddings(): Promise<void> {
    const count = await prisma.contentEmbedding.count();
    console.log(`\n📊 Embeddings Debug Info:`);
    console.log(`   Total embeddings: ${count}`);
    
    if (count > 0) {
      const sample = await prisma.contentEmbedding.findFirst({
        include: { content: { include: { lesson: true } } }
      });
      
      if (sample) {
        const embedding = JSON.parse(sample.embedding);
        console.log(`   Sample embedding dimensions: ${embedding.length}`);
        console.log(`   Sample lesson: ${sample.content.lesson.title}`);
        console.log(`   Sample text: ${sample.chunkText.substring(0, 100)}...`);
      }
    }
  }
  /**
   * Initialize and verify search system
   */
  async initialize(): Promise<void> {
    const embeddingCount = await prisma.contentEmbedding.count();
    
    if (embeddingCount === 0) {
      console.log('⚠️ No embeddings found in database!');
      console.log('   Run: npm run content:process');
    } else {
      console.log(`✅ Vector search ready with ${embeddingCount} embeddings`);
    }
  }
}

// Export singleton instance with debugging
export const vectorSearch = new VectorSearchService();

// Add debug method to check on startup
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    vectorSearch.debugEmbeddings();
  }, 5000);
 

}

