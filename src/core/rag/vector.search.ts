import { openAIService } from '../../services/ai/openai.service';
import { prisma } from '../../config/database.config';
import type { SearchResult, DocumentChunk } from '../../types/rag.types';

export class VectorSearchService {
  
  /**
   * Search for similar content using vector similarity
   */
  async searchSimilar(
    query: string,
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<SearchResult[]> {
    // Generate embedding for query
    const { embedding: queryEmbedding } = await openAIService.generateEmbedding(query);
    
    // Get all embeddings from database
    // Note: In production, use pgvector for efficient similarity search
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
    
    // Calculate similarities
    const results: SearchResult[] = [];
    
    for (const embedding of allEmbeddings) {
      const storedEmbedding = JSON.parse(embedding.embedding) as number[];
      const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
      
      if (similarity >= threshold) {
        const metadata = embedding.metadata ? JSON.parse(embedding.metadata) : {};
        
        results.push({
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
          score: similarity,
          lessonInfo: {
            id: embedding.content.lesson.id,
            title: embedding.content.lesson.title,
            unitTitle: embedding.content.lesson.unit.title,
            subjectName: embedding.content.lesson.unit.subject.name,
          },
        });
      }
    }
    
    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * Search within a specific lesson
   */
  async searchInLesson(
    lessonId: string,
    query: string,
    limit: number = 3
  ): Promise<SearchResult[]> {
    const { embedding: queryEmbedding } = await openAIService.generateEmbedding(query);
    
    const embeddings = await prisma.contentEmbedding.findMany({
      where: {
        content: {
          lessonId,
        },
      },
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
    // Vector search
    const vectorResults = await this.searchSimilar(query, limit * 2);
    
    // Keyword search if provided
    if (keywords && keywords.length > 0) {
      const keywordResults = await this.keywordSearch(keywords, limit);
      
      // Merge and deduplicate results
      const merged = new Map<string, SearchResult>();
      
      // Add vector results with higher weight
      vectorResults.forEach(result => {
        merged.set(result.chunk.id, {
          ...result,
          score: result.score * 0.7, // 70% weight for vector similarity
        });
      });
      
      // Add or update with keyword results
      keywordResults.forEach(result => {
        const existing = merged.get(result.chunk.id);
        if (existing) {
          existing.score += result.score * 0.3; // 30% weight for keyword match
        } else {
          merged.set(result.chunk.id, {
            ...result,
            score: result.score * 0.3,
          });
        }
      });
      
      // Sort and return top results
      return Array.from(merged.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }
    
    return vectorResults.slice(0, limit);
  }
  
  /**
   * Keyword-based search
   */
  private async keywordSearch(
    keywords: string[],
    limit: number
  ): Promise<SearchResult[]> {
    const embeddings = await prisma.contentEmbedding.findMany({
      where: {
        OR: keywords.map(keyword => ({
          chunkText: {
            contains: keyword,
          },
        })),
      },
      take: limit,
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
    
    return embeddings.map(embedding => ({
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
      score: 1.0, // Fixed score for keyword matches
      lessonInfo: {
        id: embedding.content.lesson.id,
        title: embedding.content.lesson.title,
        unitTitle: embedding.content.lesson.unit.title,
        subjectName: embedding.content.lesson.unit.subject.name,
      },
    }));
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
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
}

// Export singleton instance
export const vectorSearch = new VectorSearchService();