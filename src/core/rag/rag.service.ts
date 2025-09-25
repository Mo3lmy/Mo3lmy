import { openAIService } from '../../services/ai/openai.service';
import { vectorSearch } from './vector.search';
import { documentProcessor } from './document.processor';
import type { RAGContext, RAGResponse, SearchResult } from '../../types/rag.types';

/**
 * Enhanced RAG Service with Safe Optimizations
 * Version: 2.0 - Backward Compatible
 */
export class RAGService {
  private cache: Map<string, { answer: string; timestamp: number; hits: number }> = new Map();
  private readonly CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600') * 1000; // Convert to ms
  
  // ============= NEW: Feature Flags for Safe Control =============
  private readonly FEATURES = {
    USE_CACHE: process.env.USE_CACHE !== 'false', // Default: true (changed from === 'true')
    USE_SMART_CONTEXT: process.env.USE_SMART_CONTEXT !== 'false', // Default: true
    USE_FALLBACK_SEARCH: process.env.USE_FALLBACK_SEARCH !== 'false', // Default: true
    LOG_PERFORMANCE: process.env.LOG_PERFORMANCE === 'true', // Default: false
    CACHE_CONFIDENCE_THRESHOLD: parseInt(process.env.CACHE_CONFIDENCE_THRESHOLD || '40'), // Lowered from 50
    MAX_CACHE_SIZE: parseInt(process.env.MAX_CACHE_SIZE || '200'), // Increased from 100
  };

  // ============= NEW: Performance Metrics =============
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    totalQuestions: 0,
    averageConfidence: 0,
  };

  /**
   * Answer a question using RAG - ENHANCED VERSION
   */
  async answerQuestion(
    question: string,
    lessonId?: string,
    userId?: string
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    this.metrics.totalQuestions++;
    
    console.log('🤔 Processing question:', question);
    
    // ============= IMPROVED: Better Cache Check =============
    if (this.FEATURES.USE_CACHE) {
      const cacheKey = this.generateCacheKey(question, lessonId);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        console.log(`📦 Cache hit! (${this.metrics.cacheHits}/${this.metrics.totalQuestions} = ${Math.round(this.metrics.cacheHits/this.metrics.totalQuestions*100)}%)`);
        
        // Update cache hit counter
        const cacheEntry = this.cache.get(cacheKey);
        if (cacheEntry) {
          cacheEntry.hits++;
        }
        
        return {
          answer: cached,
          sources: [],
          confidence: 100,
        };
      }
      this.metrics.cacheMisses++;
    }
    
    // ============= ENHANCED: Search with Fallback =============
    let relevantChunks: SearchResult[] = [];
    
    try {
      relevantChunks = lessonId
        ? await vectorSearch.searchInLesson(lessonId, question, 5)
        : await vectorSearch.enhancedSearch(question, 8); // Already using enhanced!
      
      // NEW: If no results and fallback enabled, try broader search
      if (relevantChunks.length === 0 && this.FEATURES.USE_FALLBACK_SEARCH && lessonId) {
        console.log('🔄 No results in lesson, trying broader search...');
        relevantChunks = await vectorSearch.enhancedSearch(question, 5);
      }
    } catch (error) {
      console.error('❌ Search error, using fallback:', error);
      // Fallback to basic search if enhanced fails
      try {
        relevantChunks = await vectorSearch.searchSimilar(question, 5);
      } catch (fallbackError) {
        console.error('❌ Fallback search also failed:', fallbackError);
      }
    }
    
    if (relevantChunks.length === 0) {
      return {
        answer: 'عذراً، لم أتمكن من العثور على معلومات كافية للإجابة على سؤالك. يُرجى محاولة صياغة السؤال بطريقة مختلفة أو تحديد الدرس المطلوب.',
        sources: [],
        confidence: 0,
      };
    }
    
    // ============= IMPROVED: Smart Context Building =============
    const context = this.FEATURES.USE_SMART_CONTEXT 
      ? this.buildSmartContext(question, relevantChunks)
      : this.buildContext(question, relevantChunks);
    
    // Generate answer using OpenAI
    const answer = await this.generateAnswer(context, question);
    
    // Calculate confidence based on relevance scores
    const confidence = this.calculateConfidence(relevantChunks);
    
    // Update average confidence metric
    this.metrics.averageConfidence = 
      (this.metrics.averageConfidence * (this.metrics.totalQuestions - 1) + confidence) / 
      this.metrics.totalQuestions;
    
    // ============= IMPROVED: Better Caching Strategy =============
    if (this.FEATURES.USE_CACHE && confidence > this.FEATURES.CACHE_CONFIDENCE_THRESHOLD) {
      const cacheKey = this.generateCacheKey(question, lessonId);
      this.saveToCache(cacheKey, answer, confidence);
    }
    
    // Log performance if enabled
    if (this.FEATURES.LOG_PERFORMANCE) {
      const duration = Date.now() - startTime;
      console.log(`⚡ Performance: ${duration}ms | Confidence: ${confidence}% | Chunks: ${relevantChunks.length}`);
    }
    
    return {
      answer,
      sources: relevantChunks,
      confidence,
    };
  }
  
  /**
   * NEW: Smart context building for better answers
   */
  private buildSmartContext(question: string, chunks: SearchResult[]): string {
    // Group chunks by lesson
    const chunksByLesson = new Map<string, SearchResult[]>();
    
    chunks.forEach(chunk => {
      const lessonId = chunk.lessonInfo?.id || 'unknown';
      if (!chunksByLesson.has(lessonId)) {
        chunksByLesson.set(lessonId, []);
      }
      chunksByLesson.get(lessonId)!.push(chunk);
    });
    
    // Smart selection strategy
    const selectedChunks: SearchResult[] = [];
    
    // 1. Take top 3 highest scoring chunks
    const topScored = chunks
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    selectedChunks.push(...topScored);
    
    // 2. Add adjacent chunks if they're from the same lesson
    topScored.forEach(chunk => {
      const lessonChunks = chunksByLesson.get(chunk.lessonInfo?.id || '');
      if (lessonChunks && lessonChunks.length > 1) {
        // Find adjacent chunks (by chunkIndex)
        const currentIndex = chunk.chunk.metadata?.chunkIndex || 0;
        const adjacent = lessonChunks.filter(c => {
          const idx = c.chunk.metadata?.chunkIndex || 0;
          return Math.abs(idx - currentIndex) === 1 && !selectedChunks.includes(c);
        });
        selectedChunks.push(...adjacent.slice(0, 1)); // Add max 1 adjacent
      }
    });
    
    // 3. Remove duplicates and sort by lesson + chunk index
    const uniqueChunks = Array.from(new Set(selectedChunks));
    uniqueChunks.sort((a, b) => {
      // First by lesson
      const lessonCompare = (a.lessonInfo?.id || '').localeCompare(b.lessonInfo?.id || '');
      if (lessonCompare !== 0) return lessonCompare;
      
      // Then by chunk index
      return (a.chunk.metadata?.chunkIndex || 0) - (b.chunk.metadata?.chunkIndex || 0);
    });
    
    // Build context with better formatting
    let context = 'معلومات من المنهج ذات الصلة:\n\n';
    let currentLesson = '';
    
    uniqueChunks.forEach((chunk, index) => {
      // Add lesson header if changed
      if (chunk.lessonInfo?.title && chunk.lessonInfo.title !== currentLesson) {
        currentLesson = chunk.lessonInfo.title;
        context += `\n📚 من درس: ${currentLesson}\n`;
        context += '─'.repeat(40) + '\n';
      }
      
      context += `[معلومة ${index + 1}]:\n`;
      context += `${chunk.chunk.text}\n`;
      
      // Add relevance indicator
      if (chunk.score > 0.7) {
        context += `✅ (صلة قوية: ${Math.round(chunk.score * 100)}%)\n`;
      } else if (chunk.score > 0.4) {
        context += `✓ (صلة متوسطة: ${Math.round(chunk.score * 100)}%)\n`;
      }
      
      context += '\n';
    });
    
    return context;
  }
  
  /**
   * Original context building (kept for backward compatibility)
   */
  private buildContext(question: string, chunks: SearchResult[]): string {
    let context = 'معلومات من المنهج ذات الصلة:\n\n';
    
    // Sort chunks by relevance score
    const sortedChunks = chunks.sort((a, b) => b.score - a.score);
    
    // Take top chunks and format them
    sortedChunks.forEach((chunk, index) => {
      context += `[معلومة ${index + 1}]:\n`;
      context += `${chunk.chunk.text}\n`;
      
      // Add lesson info if available
      if (chunk.lessonInfo) {
        context += `(من درس: ${chunk.lessonInfo.title})\n`;
      }
      context += '\n---\n\n';
    });
    
    return context;
  }
  
  /**
   * Generate answer using OpenAI with improved prompting
   */
  private async generateAnswer(context: string, question: string): Promise<string> {
    const systemPrompt = `أنت مساعد تعليمي ذكي متخصص في المناهج المصرية للمرحلة الابتدائية والإعدادية والثانوية.

دورك:
- الإجابة على أسئلة الطلاب بوضوح ودقة
- استخدام المعلومات من السياق المُعطى فقط
- الشرح بطريقة مناسبة لمستوى الطالب
- إعطاء أمثلة توضيحية عند الحاجة
- استخدام لغة عربية فصحى بسيطة

قواعد مهمة:
1. اعتمد على المعلومات في السياق المُعطى فقط
2. إذا لم تجد الإجابة في السياق، قل ذلك بوضوح
3. لا تختلق معلومات غير موجودة
4. اجعل إجابتك منظمة ومرتبة
5. استخدم التنقيط والترقيم عند الحاجة`;
    
    const userPrompt = `السياق التعليمي من المنهج:
=====================================
${context}
=====================================

سؤال الطالب: ${question}

من فضلك أجب على السؤال بناءً على المعلومات المتوفرة في السياق أعلاه.
إذا كانت المعلومات غير كافية، اذكر ذلك بوضوح.`;
    
    try {
      const answer = await openAIService.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        temperature: 0.5, // Lower temperature for more consistent educational answers
        maxTokens: 800,
      });
      
      return answer;
    } catch (error) {
      console.error('Error generating answer:', error);
      return 'عذراً، حدث خطأ أثناء معالجة السؤال. يُرجى المحاولة مرة أخرى.';
    }
  }
  
  /**
   * ENHANCED: Better confidence calculation
   */
  private calculateConfidence(chunks: SearchResult[]): number {
    if (chunks.length === 0) return 0;
    
    // Take top 3 chunks for confidence calculation
    const topChunks = chunks.slice(0, 3);
    const topScores = topChunks.map(c => c.score || 0);
    
    // Calculate weighted average (first result weighs more)
    const weights = [0.5, 0.3, 0.2];
    let weightedSum = 0;
    let weightTotal = 0;
    
    topScores.forEach((score, index) => {
      const weight = weights[index] || 0.1;
      weightedSum += score * weight;
      weightTotal += weight;
    });
    
    const avgScore = weightTotal > 0 ? weightedSum / weightTotal : 0;
    
    // Bonus for multiple high-quality sources
    const highQualityCount = chunks.filter(c => c.score > 0.6).length;
    const diversityBonus = Math.min(highQualityCount * 0.05, 0.15);
    
    // Convert to percentage (0-100)
    return Math.min(Math.round((avgScore + diversityBonus) * 100), 100);
  }
  
  /**
   * Generate quiz questions from lesson content
   */
  async generateQuizQuestions(lessonId: string, count: number = 5): Promise<any[]> {
    console.log(`📝 Generating ${count} quiz questions for lesson ${lessonId}`);
    
    // Get lesson content chunks
    const chunks = await vectorSearch.searchInLesson(lessonId, '', 10);
    
    if (chunks.length === 0) {
      throw new Error('No content found for lesson');
    }
    
    const context = this.FEATURES.USE_SMART_CONTEXT
      ? this.buildSmartContext('', chunks)
      : this.buildContext('', chunks);
    
    const systemPrompt = `أنت مُعلم متخصص في إنشاء أسئلة اختبارات تعليمية للمناهج المصرية.

مهمتك: إنشاء أسئلة اختيار من متعدد بناءً على المحتوى المُعطى.

قواعد الأسئلة:
1. يجب أن تكون واضحة ومحددة
2. الخيارات يجب أن تكون متقاربة لتجنب الإجابات الواضحة
3. يجب أن تغطي نقاط مختلفة من المحتوى
4. مناسبة لمستوى الطالب
5. باللغة العربية الفصحى البسيطة`;
    
    const userPrompt = `بناءً على المحتوى التعليمي التالي:
=====================================
${context}
=====================================

قم بإنشاء ${count} أسئلة اختيار من متعدد.

يجب أن يكون الرد في صيغة JSON array بالشكل التالي بالضبط:
[
  {
    "question": "نص السؤال هنا",
    "options": ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
    "correctAnswer": "الخيار الصحيح (يجب أن يكون أحد الخيارات بالضبط)",
    "explanation": "شرح مختصر للإجابة الصحيحة"
  }
]

مهم جداً: الرد يجب أن يكون JSON صالح فقط، بدون أي نص إضافي أو markdown.`;
    
    try {
      const response = await openAIService.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        temperature: 0.7,
        maxTokens: 1500,
      });
      
      // Clean response from any markdown
      const cleanedResponse = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      try {
        const questions = JSON.parse(cleanedResponse);
        
        // Validate structure
        if (Array.isArray(questions)) {
          return questions.slice(0, count);
        }
        return [];
      } catch (parseError) {
        console.error('Failed to parse quiz questions:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Error generating quiz questions:', error);
      return [];
    }
  }
  
  /**
   * Explain a concept in simple terms
   */
  async explainConcept(
    concept: string,
    gradeLevel: number
  ): Promise<string> {
    console.log(`💡 Explaining concept "${concept}" for grade ${gradeLevel}`);
    
    // Check cache
    const cacheKey = `explain-${concept}-${gradeLevel}`;
    if (this.FEATURES.USE_CACHE) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('📦 Returning cached explanation');
        return cached;
      }
    }
    
    const ageGroup = gradeLevel <= 6 ? 'الابتدائية' : gradeLevel <= 9 ? 'الإعدادية' : 'الثانوية';
    
    const systemPrompt = `أنت معلم متميز متخصص في تبسيط المفاهيم العلمية للطلاب.
تشرح للطلاب في المرحلة ${ageGroup} (الصف ${gradeLevel}).

أسلوبك في الشرح:
1. استخدم لغة بسيطة مناسبة للعمر
2. أعط أمثلة من الحياة اليومية
3. استخدم التشبيهات المناسبة
4. ابدأ بالأساسيات ثم تدرج
5. تجنب المصطلحات المعقدة`;
    
    const userPrompt = `اشرح مفهوم "${concept}" بطريقة بسيطة وواضحة.

الشرح يجب أن يشمل:
- تعريف بسيط
- أمثلة من الحياة اليومية (2-3 أمثلة)
- تشبيه مناسب للفهم
- الفائدة من تعلم هذا المفهوم

اجعل الشرح ممتعاً ومشوقاً للطالب.`;
    
    try {
      const explanation = await openAIService.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        temperature: 0.6,
        maxTokens: 600,
      });
      
      // Cache the explanation
      if (this.FEATURES.USE_CACHE) {
        this.saveToCache(cacheKey, explanation, 95);
      }
      
      return explanation;
    } catch (error) {
      console.error('Error explaining concept:', error);
      return `${concept} هو أحد المفاهيم المهمة في المنهج. يُرجى مراجعة الكتاب المدرسي أو سؤال المعلم للحصول على شرح مفصل.`;
    }
  }
  
  /**
   * Generate study tips for a topic
   */
  async generateStudyTips(
    topic: string,
    gradeLevel: number
  ): Promise<string[]> {
    console.log(`📚 Generating study tips for "${topic}"`);
    
    const prompt = `قدم 5 نصائح دراسية فعالة لطالب في الصف ${gradeLevel} لدراسة موضوع "${topic}".

النصائح يجب أن تكون:
- عملية وسهلة التطبيق
- مناسبة للعمر
- متنوعة (ذاكرة، فهم، تطبيق)
- محفزة للطالب

أرجع النصائح في صيغة JSON array من النصوص فقط.`;
    
    try {
      const response = await openAIService.chat([
        { role: 'system', content: 'أنت مستشار تعليمي متخصص في تقنيات الدراسة الفعالة.' },
        { role: 'user', content: prompt },
      ], {
        temperature: 0.7,
        maxTokens: 400,
      });
      
      // Try to parse as JSON array
      try {
        const cleanedResponse = response
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        return JSON.parse(cleanedResponse);
      } catch {
        // If not JSON, split by lines
        return response
          .split('\n')
          .filter(line => line.trim().length > 0)
          .slice(0, 5);
      }
    } catch (error) {
      console.error('Error generating study tips:', error);
      return [
        'اقرأ الدرس بتركيز وحدد النقاط المهمة',
        'اكتب ملخص بكلماتك الخاصة',
        'حل تمارين متنوعة للتطبيق',
        'راجع الدرس بانتظام',
        'اسأل عن الأجزاء الصعبة',
      ];
    }
  }
  
  /**
   * Process and index a lesson for RAG
   */
  async indexLesson(lessonId: string): Promise<void> {
    console.log(`🔄 Indexing lesson ${lessonId} for RAG`);
    await documentProcessor.processLessonContent(lessonId);
  }
  
  /**
   * Summarize lesson content
   */
  async summarizeLesson(lessonId: string): Promise<string> {
    console.log(`📋 Summarizing lesson ${lessonId}`);
    
    // Get lesson content
    const chunks = await vectorSearch.searchInLesson(lessonId, '', 20);
    
    if (chunks.length === 0) {
      return 'لا يوجد محتوى متاح للتلخيص';
    }
    
    const context = chunks.map(c => c.chunk.text).join('\n\n');
    
    const prompt = `لخص المحتوى التعليمي التالي في فقرة واحدة واضحة:

${context}

التلخيص يجب أن يشمل:
- الأفكار الرئيسية
- المفاهيم المهمة
- النقاط الأساسية للحفظ

اجعل التلخيص في حدود 150-200 كلمة.`;
    
    try {
      return await openAIService.chat([
        { role: 'system', content: 'أنت متخصص في تلخيص المحتوى التعليمي بشكل واضح ومفيد.' },
        { role: 'user', content: prompt },
      ], {
        temperature: 0.5,
        maxTokens: 400,
      });
    } catch (error) {
      console.error('Error summarizing lesson:', error);
      return 'عذراً، لم أتمكن من تلخيص الدرس.';
    }
  }
  
  /**
   * IMPROVED: Better cache management
   */
  private getFromCache(key: string): string | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.answer;
  }
  
  /**
   * ENHANCED: Generate better cache keys
   */
  private generateCacheKey(question: string, lessonId?: string): string {
  const normalized = question
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[؟?!.،,؛:]/g, '') 
    .replace(/[ًٌٍَُِّْ]/g, ''); 
    
  return `rag_${normalized}_${lessonId || 'general'}`;
}
  
  /**
   * IMPROVED: Save to cache with metadata
   */
  private saveToCache(key: string, answer: string, confidence: number): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.FEATURES.MAX_CACHE_SIZE) {
      // Find and remove least frequently used entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => (a[1].hits || 0) - (b[1].hits || 0));
      
      // Remove bottom 20%
      const toRemove = Math.ceil(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
    
    this.cache.set(key, {
      answer,
      timestamp: Date.now(),
      hits: 0,
    });
    
    // Log cache status
    if (this.FEATURES.LOG_PERFORMANCE) {
      console.log(`💾 Cache: ${this.cache.size}/${this.FEATURES.MAX_CACHE_SIZE} entries`);
    }
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ RAG cache cleared (${size} entries removed)`);
  }
  
  /**
   * NEW: Get performance metrics
   */
  getMetrics(): any {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      cacheHitRate: this.metrics.totalQuestions > 0 
        ? Math.round((this.metrics.cacheHits / this.metrics.totalQuestions) * 100) 
        : 0,
    };
  }
  
  /**
   * NEW: Get feature status
   */
  getFeatureStatus(): any {
    return this.FEATURES;
  }
}

// Export singleton instance
export const ragService = new RAGService();

// ============= IMPROVED: Better cache cleanup =============
setInterval(() => {
  const now = Date.now();
  const service = ragService as any;
  const cache = service.cache;
  const cacheTTL = service.CACHE_TTL;
  
  if (cache && cacheTTL) {
    let removed = 0;
    for (const [key, value] of cache) {
      if (now - value.timestamp > cacheTTL) {
        cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0 && service.FEATURES?.LOG_PERFORMANCE) {
      console.log(`🧹 Cache cleanup: removed ${removed} expired entries`);
    }
  }
}, 3600000); // Every hour