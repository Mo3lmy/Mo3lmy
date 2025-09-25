import { openAIService } from '../../services/ai/openai.service';
import { prisma } from '../../config/database.config';
import type { SearchResult, DocumentChunk } from '../../types/rag.types';

/**
 * Enhanced Vector Search Service with Performance Optimizations
 * Version: 2.0 - Fully Backward Compatible
 */
export class VectorSearchService {
  // ============= IMPROVED: Better default thresholds =============
  private readonly DEFAULT_THRESHOLD = parseFloat(process.env.RAG_THRESHOLD || '0.3'); // Raised from 0.2
  private readonly MIN_SCORE_FOR_RELEVANCE = 0.15;
  
  // ============= NEW: Feature Flags =============
  private readonly FEATURES = {
    USE_BATCH_SEARCH: process.env.USE_BATCH_SEARCH !== 'false', // Default: true
    USE_QUERY_EXPANSION: process.env.USE_QUERY_EXPANSION !== 'false', // Default: true
    USE_EMBEDDING_CACHE: process.env.USE_EMBEDDING_CACHE !== 'false', // Default: true
    BATCH_SIZE: parseInt(process.env.SEARCH_BATCH_SIZE || '100'), // Process in batches
    LOG_PERFORMANCE: process.env.LOG_PERFORMANCE === 'true',
    MAX_EMBEDDINGS_TO_LOAD: parseInt(process.env.MAX_EMBEDDINGS_TO_LOAD || '1000'),
  };
  
  // ============= NEW: Caches for Performance =============
  private embeddingCache = new Map<string, number[]>(); // Cache parsed embeddings
  private queryEmbeddingCache = new Map<string, number[]>(); // Cache query embeddings
  private readonly CACHE_SIZE = 500;
  
  // ============= NEW: Synonyms for Query Expansion =============
  private readonly ARABIC_SYNONYMS: Record<string, string[]> = {
    'معادلة': ['معادلات', 'المعادلة', 'المعادلات', 'equation'],
    'حل': ['احل', 'حلول', 'الحل', 'يحل', 'نحل', 'solving'],
    'جمع': ['الجمع', 'اجمع', 'يجمع', 'مجموع', 'addition'],
    'طرح': ['الطرح', 'اطرح', 'يطرح', 'subtraction'],
    'ضرب': ['الضرب', 'اضرب', 'يضرب', 'حاصل الضرب', 'multiplication'],
    'قسمة': ['القسمة', 'اقسم', 'يقسم', 'division'],
    'كسر': ['كسور', 'الكسر', 'الكسور', 'fraction'],
    'عدد': ['أعداد', 'العدد', 'الأعداد', 'رقم', 'أرقام', 'number'],
    'مسألة': ['مسائل', 'المسألة', 'المسائل', 'تمرين', 'problem'],
    'درس': ['الدرس', 'دروس', 'الدروس', 'lesson'],
  };
  
  /**
   * OPTIMIZED: Search with batching instead of loading all embeddings
   */
  async searchSimilar(
    query: string,
    limit: number = 5,
    threshold: number = this.DEFAULT_THRESHOLD
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    console.log(`🔍 Searching for: "${query}" with threshold: ${threshold}`);
    
    // ============= IMPROVED: Query Expansion =============
    const expandedQueries = this.FEATURES.USE_QUERY_EXPANSION 
      ? this.expandQuery(query)
      : [query];
    
    // Generate embedding for main query (with caching)
    const queryEmbedding = await this.getQueryEmbedding(expandedQueries[0]);
    
    // ============= CRITICAL FIX: Batch Processing =============
    let results: SearchResult[] = [];
    
    if (this.FEATURES.USE_BATCH_SEARCH) {
      results = await this.batchedSearch(queryEmbedding, threshold);
    } else {
      // Fallback to old method (but with limit!)
      results = await this.originalSearch(queryEmbedding, threshold, this.FEATURES.MAX_EMBEDDINGS_TO_LOAD);
    }
    
    // ============= IMPROVED: Fallback Strategy =============
    if (results.length === 0 && threshold > this.MIN_SCORE_FOR_RELEVANCE) {
      console.log(`⚠️ No results found, trying with lower threshold...`);
      return this.searchSimilar(query, limit, this.MIN_SCORE_FOR_RELEVANCE);
    }
    
    // Sort and limit results
    const sortedResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Performance logging
    if (this.FEATURES.LOG_PERFORMANCE) {
      const duration = Date.now() - startTime;
      console.log(`⚡ Search completed in ${duration}ms | Results: ${sortedResults.length}`);
    }
    
    // Log top results for debugging
    if (sortedResults.length > 0 && process.env.NODE_ENV === 'development') {
      console.log(`\n🎯 Top results:`);
      sortedResults.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.lessonInfo?.title ?? 'N/A'} (score: ${r.score.toFixed(3)})`);
        console.log(`     ${r.chunk.text.substring(0, 100)}...`);
      });
    }
    
    return sortedResults;
  }
  
  /**
   * NEW: Batched search for better performance
   */
  private async batchedSearch(
    queryEmbedding: number[],
    threshold: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    let offset = 0;
    const batchSize = this.FEATURES.BATCH_SIZE;
    let hasMore = true;
    
    // Process embeddings in batches
    while (hasMore && results.length < 100) { // Stop after finding enough results
      const batch = await prisma.contentEmbedding.findMany({
        skip: offset,
        take: batchSize,
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
      
      if (batch.length === 0) {
        hasMore = false;
        break;
      }
      
      // Process batch
      for (const embedding of batch) {
        try {
          const storedEmbedding = await this.getStoredEmbedding(embedding.id, embedding.embedding);
          const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
          
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
      
      // If we have enough good results, stop
      if (results.length >= 20) {
        console.log(`✅ Found enough results (${results.length}), stopping search`);
        break;
      }
      
      offset += batchSize;
      
      // Safety limit
      if (offset > this.FEATURES.MAX_EMBEDDINGS_TO_LOAD) {
        console.log(`⚠️ Reached max embeddings limit (${this.FEATURES.MAX_EMBEDDINGS_TO_LOAD})`);
        break;
      }
    }
    
    console.log(`📊 Processed ${offset} embeddings, found ${results.length} matches`);
    return results;
  }
  
  /**
   * Original search method (improved with limit)
   */
  private async originalSearch(
    queryEmbedding: number[],
    threshold: number,
    maxEmbeddings: number
  ): Promise<SearchResult[]> {
    // IMPORTANT: Add limit to prevent loading all embeddings
    const allEmbeddings = await prisma.contentEmbedding.findMany({
      take: maxEmbeddings, // CRITICAL: Limit the number of embeddings
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
    
    console.log(`📊 Processing ${allEmbeddings.length} embeddings (limited to ${maxEmbeddings})`);
    
    const results: SearchResult[] = [];
    let maxScore = 0;
    let minScore = 1;
    
    for (const embedding of allEmbeddings) {
      try {
        const storedEmbedding = await this.getStoredEmbedding(embedding.id, embedding.embedding);
        const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
        
        if (similarity > maxScore) maxScore = similarity;
        if (similarity < minScore) minScore = similarity;
        
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
    
    return results;
  }
  
  /**
   * Enhanced search with fallback strategies (KEPT AS IS)
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
   * OPTIMIZED: Search within lesson with batching
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
    
    // البحث العادي بـ embeddings (with caching)
    const queryEmbedding = await this.getQueryEmbedding(query);
    
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
      const storedEmbedding = await this.getStoredEmbedding(embedding.id, embedding.embedding);
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
   * Hybrid search: combine vector and keyword search (KEPT AS IS)
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
   * Improved keyword search with Arabic support (KEPT AS IS)
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
            mode: 'insensitive' as any // Cast to any for Prisma compatibility
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
   * Partial search - search with parts of the query (KEPT AS IS)
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
   * IMPROVED: Extract keywords with synonym expansion
   */
  private extractKeywords(text: string): string[] {
    // Remove common Arabic stop words
    const arabicStopWords = ['في', 'من', 'على', 'هي', 'هو', 'ما', 'كيف', 'متى', 'أين', 'لماذا', 'هل', 'أو', 'و'];
    const englishStopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was', 'were', 'for', 'of'];
    
    const words = text
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 2)
      .filter(w => !arabicStopWords.includes(w))
      .filter(w => !englishStopWords.includes(w.toLowerCase()));
    
    // NEW: Add synonyms for important words
    const expandedWords: string[] = [];
    words.forEach(word => {
      expandedWords.push(word);
      if (this.ARABIC_SYNONYMS[word]) {
        expandedWords.push(...this.ARABIC_SYNONYMS[word].slice(0, 2)); // Add max 2 synonyms
      }
    });
    
    // Also add important terms
    const importantTerms: string[] = [];
    
    // Check for math terms
    if (text.includes('ضرب') || text.includes('الضرب')) importantTerms.push('ضرب');
    if (text.includes('جمع') || text.includes('الجمع')) importantTerms.push('جمع');
    if (text.includes('طرح') || text.includes('الطرح')) importantTerms.push('طرح');
    if (text.includes('قسم') || text.includes('القسمة')) importantTerms.push('قسمة');
    if (text.includes('كسر') || text.includes('كسور')) importantTerms.push('كسور');
    if (text.includes('عدد') || text.includes('أعداد')) importantTerms.push('أعداد');
    
    return [...new Set([...expandedWords, ...importantTerms])];
  }
  
  /**
   * NEW: Expand query with synonyms
   */
  private expandQuery(query: string): string[] {
    const queries = [query];
    
    // Check if query contains known terms
    Object.entries(this.ARABIC_SYNONYMS).forEach(([term, synonyms]) => {
      if (query.includes(term)) {
        // Create a variant with the first synonym
        const variant = query.replace(term, synonyms[0]);
        if (variant !== query) {
          queries.push(variant);
        }
      }
    });
    
    return queries.slice(0, 3); // Max 3 query variants
  }
  
  /**
   * NEW: Get query embedding with caching
   */
  private async getQueryEmbedding(query: string): Promise<number[]> {
    if (this.FEATURES.USE_EMBEDDING_CACHE) {
      const cached = this.queryEmbeddingCache.get(query);
      if (cached) {
        return cached;
      }
    }
    
    const { embedding } = await openAIService.generateEmbedding(query);
    
    // Cache it
    if (this.FEATURES.USE_EMBEDDING_CACHE) {
      // Limit cache size
      if (this.queryEmbeddingCache.size > 100) {
        const firstKey = this.queryEmbeddingCache.keys().next().value;
        if (firstKey) {
          this.queryEmbeddingCache.delete(firstKey);
        }
      }
      this.queryEmbeddingCache.set(query, embedding);
    }
    
    return embedding;
  }
  
  /**
   * NEW: Get stored embedding with caching
   */
  private async getStoredEmbedding(id: string, embeddingJson: string): Promise<number[]> {
    if (this.FEATURES.USE_EMBEDDING_CACHE) {
      const cached = this.embeddingCache.get(id);
      if (cached) {
        return cached;
      }
    }
    
    const embedding = JSON.parse(embeddingJson) as number[];
    
    // Cache it
    if (this.FEATURES.USE_EMBEDDING_CACHE) {
      // Limit cache size
      if (this.embeddingCache.size > this.CACHE_SIZE) {
        const firstKey = this.embeddingCache.keys().next().value;
        if (firstKey) {
          this.embeddingCache.delete(firstKey);
        }
      }
      this.embeddingCache.set(id, embedding);
    }
    
    return embedding;
  }
  
  /**
   * Calculate cosine similarity between two vectors (KEPT AS IS)
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
   * Debug method to check embeddings (KEPT AS IS)
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
   * Initialize and verify search system (KEPT AS IS)
   */
  async initialize(): Promise<void> {
    const embeddingCount = await prisma.contentEmbedding.count();
    
    if (embeddingCount === 0) {
      console.log('⚠️ No embeddings found in database!');
      console.log('   Run: npm run content:process');
    } else {
      console.log(`✅ Vector search ready with ${embeddingCount} embeddings`);
      console.log(`🎯 Using batch size: ${this.FEATURES.BATCH_SIZE}`);
      console.log(`📊 Max embeddings per search: ${this.FEATURES.MAX_EMBEDDINGS_TO_LOAD}`);
    }
  }
  
  /**
   * NEW: Clear caches
   */
  clearCaches(): void {
    const querySize = this.queryEmbeddingCache.size;
    const embeddingSize = this.embeddingCache.size;
    
    this.queryEmbeddingCache.clear();
    this.embeddingCache.clear();
    
    console.log(`🗑️ Cleared caches: ${querySize} queries, ${embeddingSize} embeddings`);
  }
  
  /**
   * NEW: Get performance stats
   */
  getStats(): any {
    return {
      queryCacheSize: this.queryEmbeddingCache.size,
      embeddingCacheSize: this.embeddingCache.size,
      features: this.FEATURES,
      threshold: this.DEFAULT_THRESHOLD,
    };
  }
}

// Export singleton instance
export const vectorSearch = new VectorSearchService();

// Add debug method to check on startup (KEPT AS IS)
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    vectorSearch.debugEmbeddings();
  }, 5000);
}

// NEW: Clear caches periodically to prevent memory leaks
setInterval(() => {
  const stats = vectorSearch.getStats();
  if (stats.embeddingCacheSize > 400) {
    console.log('🧹 Auto-clearing large caches...');
    vectorSearch.clearCaches();
  }
}, 1800000); // Every 30 minutes