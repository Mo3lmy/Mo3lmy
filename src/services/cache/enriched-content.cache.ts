// src/services/cache/enriched-content.cache.ts
// 🆕 Cache Service for Enriched Educational Content

import NodeCache from 'node-cache';
import { prisma } from '../../config/database.config';

interface CachedContent {
  id: string;
  lessonId: string;
  fullText?: string;
  summary?: string;
  keyPoints: any[];
  examples: any[];
  exercises: any[];
  enrichmentLevel: number;
  // Enriched fields
  realWorldApplications?: any[];
  commonMistakes?: any[];
  studentTips?: string[];
  educationalStories?: any[];
  challenges?: any[];
  visualAids?: any[];
  funFacts?: any[];
  quickReview?: any;
  cachedAt: Date;
  hits?: number;
}

interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: string;
  avgHitTime: number;
}

class EnrichedContentCache {
  private cache: NodeCache;
  private hitTimes: number[] = [];
  private readonly MAX_HIT_TIME_SAMPLES = 100;

  constructor() {
    // Cache configuration
    // TTL: 1 hour (3600 seconds) by default
    // checkperiod: Check for expired keys every 2 minutes
    this.cache = new NodeCache({
      stdTTL: 3600,
      checkperiod: 120,
      useClones: false, // Better performance, but be careful with mutations
      deleteOnExpire: true,
      enableLegacyCallbacks: false
    });

    // Setup event listeners
    this.setupEventListeners();

    console.log('📦 Enriched Content Cache initialized');
  }

  /**
   * Setup cache event listeners
   */
  private setupEventListeners(): void {
    this.cache.on('expired', (key: string) => {
      console.log(`🕒 Cache expired for key: ${key}`);
    });

    this.cache.on('flush', () => {
      console.log('🔄 Cache flushed');
    });

    this.cache.on('del', (key: string) => {
      console.log(`🗑️ Cache deleted for key: ${key}`);
    });
  }

  /**
   * Helper function to safely parse JSON
   */
  private safeParseJSON(data: any, fallback: any = null): any {
    if (!data) return fallback;
    if (typeof data === 'object') return data;
    try {
      return JSON.parse(data);
    } catch {
      return fallback;
    }
  }

  /**
   * Get enriched content with caching
   */
  async getEnrichedContent(lessonId: string): Promise<CachedContent | null> {
    const startTime = Date.now();
    const cacheKey = `enriched_${lessonId}`;

    // Check cache first
    const cached = this.cache.get<CachedContent>(cacheKey);
    if (cached) {
      // Update hit counter
      cached.hits = (cached.hits || 0) + 1;
      this.cache.set(cacheKey, cached);

      // Track hit time
      const hitTime = Date.now() - startTime;
      this.trackHitTime(hitTime);

      console.log(`📦 Cache HIT for lesson ${lessonId} (${hitTime}ms, hits: ${cached.hits})`);
      return cached;
    }

    // Cache miss - fetch from database
    console.log(`📥 Cache MISS for lesson ${lessonId}, fetching from DB`);

    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { content: true }
      });

      if (!lesson?.content) {
        return null;
      }

      // Build cached content object
      const enrichedData: CachedContent = {
        id: lesson.content.id,
        lessonId: lesson.id,
        fullText: lesson.content.fullText || undefined,
        summary: lesson.content.summary || undefined,
        keyPoints: this.safeParseJSON(lesson.content.keyPoints, []),
        examples: this.safeParseJSON(lesson.content.examples, []),
        exercises: this.safeParseJSON(lesson.content.exercises, []),
        enrichmentLevel: lesson.content.enrichmentLevel || 0,
        cachedAt: new Date(),
        hits: 0
      };

      // Parse and add enriched content if it exists
      if (lesson.content.enrichedContent) {
        const parsed = this.safeParseJSON(lesson.content.enrichedContent, {});
        if (parsed) {
          enrichedData.realWorldApplications = parsed.realWorldApplications || [];
          enrichedData.commonMistakes = parsed.commonMistakes || [];
          enrichedData.studentTips = parsed.studentTips || [];
          enrichedData.educationalStories = parsed.educationalStories || [];
          enrichedData.challenges = parsed.challenges || [];
          enrichedData.visualAids = parsed.visualAids || [];
          enrichedData.funFacts = parsed.funFacts || [];
          enrichedData.quickReview = parsed.quickReview || null;

          // Combine exercises from both sources
          if (parsed.exercises && parsed.exercises.length > 0) {
            enrichedData.exercises = [...enrichedData.exercises, ...parsed.exercises];
          }
        }
      }

      // Cache the result
      this.cache.set(cacheKey, enrichedData);

      const fetchTime = Date.now() - startTime;
      console.log(`✅ Cached lesson ${lessonId} (fetch time: ${fetchTime}ms)`);

      return enrichedData;
    } catch (error) {
      console.error(`❌ Error fetching lesson ${lessonId}:`, error);
      return null;
    }
  }

  /**
   * Get specific enriched field from cache
   */
  async getEnrichedField(lessonId: string, fieldName: keyof CachedContent): Promise<any | null> {
    const content = await this.getEnrichedContent(lessonId);
    return content ? content[fieldName] || null : null;
  }

  /**
   * Batch get multiple lessons
   */
  async getBatchEnrichedContent(lessonIds: string[]): Promise<Map<string, CachedContent | null>> {
    const results = new Map<string, CachedContent | null>();

    // Process in parallel for better performance
    const promises = lessonIds.map(async (lessonId) => {
      const content = await this.getEnrichedContent(lessonId);
      results.set(lessonId, content);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Preload content for a subject or unit
   */
  async preloadSubjectContent(subjectId: string): Promise<void> {
    console.log(`📚 Preloading content for subject ${subjectId}`);

    const lessons = await prisma.lesson.findMany({
      where: {
        unit: {
          subjectId
        },
        isPublished: true
      },
      select: { id: true }
    });

    const lessonIds = lessons.map(l => l.id);
    await this.getBatchEnrichedContent(lessonIds);

    console.log(`✅ Preloaded ${lessonIds.length} lessons for subject ${subjectId}`);
  }

  /**
   * Invalidate cache for a specific lesson
   */
  invalidateLesson(lessonId: string): boolean {
    const cacheKey = `enriched_${lessonId}`;
    const deleted = this.cache.del(cacheKey);

    if (deleted) {
      console.log(`🗑️ Cache invalidated for lesson ${lessonId}`);
    }

    return deleted === 1;
  }

  /**
   * Invalidate multiple lessons
   */
  invalidateLessons(lessonIds: string[]): number {
    const cacheKeys = lessonIds.map(id => `enriched_${id}`);
    const deleted = this.cache.del(cacheKeys);

    console.log(`🗑️ Cache invalidated for ${deleted} lessons`);
    return deleted;
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.flushAll();
    this.hitTimes = [];
    console.log('🗑️ All cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const stats = this.cache.getStats();
    const keys = this.cache.keys();

    // Calculate memory usage (approximate)
    let memoryUsage = 0;
    keys.forEach(key => {
      const value = this.cache.get(key);
      if (value) {
        memoryUsage += JSON.stringify(value).length;
      }
    });

    // Calculate average hit time
    const avgHitTime = this.hitTimes.length > 0
      ? this.hitTimes.reduce((a, b) => a + b, 0) / this.hitTimes.length
      : 0;

    return {
      keys: keys.length,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits > 0 ? stats.hits / (stats.hits + stats.misses) : 0,
      memoryUsage: `${(memoryUsage / 1024).toFixed(2)} KB`,
      avgHitTime: Math.round(avgHitTime * 100) / 100
    };
  }

  /**
   * Get cache keys
   */
  getCacheKeys(): string[] {
    return this.cache.keys();
  }

  /**
   * Check if lesson is cached
   */
  isCached(lessonId: string): boolean {
    const cacheKey = `enriched_${lessonId}`;
    return this.cache.has(cacheKey);
  }

  /**
   * Get TTL for a lesson
   */
  getTTL(lessonId: string): number | undefined {
    const cacheKey = `enriched_${lessonId}`;
    return this.cache.getTtl(cacheKey);
  }

  /**
   * Update TTL for a lesson
   */
  updateTTL(lessonId: string, ttl: number): boolean {
    const cacheKey = `enriched_${lessonId}`;
    return this.cache.ttl(cacheKey, ttl);
  }

  /**
   * Track hit time for statistics
   */
  private trackHitTime(time: number): void {
    this.hitTimes.push(time);
    if (this.hitTimes.length > this.MAX_HIT_TIME_SAMPLES) {
      this.hitTimes.shift();
    }
  }

  /**
   * Warm up cache with most popular lessons
   */
  async warmUpCache(): Promise<void> {
    console.log('🔥 Warming up cache with popular lessons');

    try {
      // Get most accessed lessons (you might want to track this in a separate table)
      const popularLessons = await prisma.lesson.findMany({
        where: {
          isPublished: true
        },
        orderBy: {
          createdAt: 'desc' // Or use a popularity metric if available
        },
        take: 20,
        select: { id: true }
      });

      const lessonIds = popularLessons.map(l => l.id);
      await this.getBatchEnrichedContent(lessonIds);

      console.log(`✅ Cache warmed up with ${lessonIds.length} popular lessons`);
    } catch (error) {
      console.error('❌ Error warming up cache:', error);
    }
  }

  /**
   * Get detailed cache info for debugging
   */
  getDebugInfo(): any {
    const stats = this.getStats();
    const keys = this.getCacheKeys();

    const detailedInfo = keys.map(key => {
      const value = this.cache.get<CachedContent>(key);
      const ttl = this.cache.getTtl(key);

      return {
        key,
        lessonId: value?.lessonId,
        enrichmentLevel: value?.enrichmentLevel,
        hits: value?.hits || 0,
        ttl: ttl ? new Date(ttl).toISOString() : 'expired',
        cachedAt: value?.cachedAt
      };
    });

    return {
      stats,
      cache: detailedInfo
    };
  }
}

// Export singleton instance
export const enrichedContentCache = new EnrichedContentCache();

// Export types
export type { CachedContent, CacheStats };