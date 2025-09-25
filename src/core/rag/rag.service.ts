import { openAIService } from '../../services/ai/openai.service';
import { vectorSearch } from './vector.search';
import { documentProcessor } from './document.processor';
import type { RAGContext, RAGResponse, SearchResult } from '../../types/rag.types';

/**
 * Enhanced RAG Service with Smart Features
 * Version: 3.0 - Optimized for Performance & Quality
 */
export class RAGService {
  private cache: Map<string, { answer: string; timestamp: number; hits: number; confidence: number }> = new Map();
  private readonly CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600') * 1000;
  
  // ============= Feature Flags =============
  private readonly FEATURES = {
    USE_CACHE: process.env.USE_CACHE !== 'false',
    USE_SMART_CONTEXT: process.env.USE_SMART_CONTEXT !== 'false',
    USE_FALLBACK_SEARCH: process.env.USE_FALLBACK_SEARCH !== 'false',
    LOG_PERFORMANCE: process.env.LOG_PERFORMANCE === 'true',
    CACHE_CONFIDENCE_THRESHOLD: parseInt(process.env.CACHE_CONFIDENCE_THRESHOLD || '40'),
    MAX_CACHE_SIZE: parseInt(process.env.MAX_CACHE_SIZE || '300'),
    // 🆕 New features
    USE_SMART_MODEL: process.env.USE_SMART_MODEL !== 'false',
    ADAPTIVE_DIFFICULTY: process.env.ADAPTIVE_DIFFICULTY !== 'false',
  };

  // ============= Performance Metrics =============
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    totalQuestions: 0,
    averageConfidence: 0,
    averageResponseTime: 0,
    modelUsage: new Map<string, number>(),
  };
  
  // 🆕 User learning profiles (simple in-memory)
  private userProfiles: Map<string, {
    level: number;
    correctAnswers: number;
    totalAttempts: number;
    weakTopics: string[];
    strongTopics: string[];
  }> = new Map();

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
    
    console.log('🤔 Processing:', question.substring(0, 50) + '...');
    
    // ============= Cache Check =============
    if (this.FEATURES.USE_CACHE) {
      const cacheKey = this.generateCacheKey(question, lessonId);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        const hitRate = Math.round((this.metrics.cacheHits / this.metrics.totalQuestions) * 100);
        console.log(`📦 Cache hit! (${hitRate}% hit rate)`);
        
        return {
          answer: cached.answer,
          sources: [],
          confidence: cached.confidence,
        };
      }
      this.metrics.cacheMisses++;
    }
    
    // ============= Smart Search =============
    let relevantChunks: SearchResult[] = [];
    
    try {
      relevantChunks = lessonId
        ? await vectorSearch.searchInLesson(lessonId, question, 5)
        : await vectorSearch.enhancedSearch(question, 8);
      
      // Fallback if needed
      if (relevantChunks.length === 0 && this.FEATURES.USE_FALLBACK_SEARCH && lessonId) {
        console.log('🔄 Fallback to broader search...');
        relevantChunks = await vectorSearch.enhancedSearch(question, 5);
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      relevantChunks = await vectorSearch.searchSimilar(question, 5);
    }
    
    if (relevantChunks.length === 0) {
      return {
        answer: 'عذراً، لم أجد معلومات كافية. حاول صياغة السؤال بطريقة أخرى أو حدد الدرس.',
        sources: [],
        confidence: 0,
      };
    }
    
    // ============= Context Building =============
    const context = this.FEATURES.USE_SMART_CONTEXT 
      ? this.buildSmartContext(question, relevantChunks)
      : this.buildContext(question, relevantChunks);
    
    // 🆕 Get user profile for personalization
    const userProfile = userId ? this.getUserProfile(userId) : null;
    
    // ============= Generate Answer with Smart Model Selection =============
    const answer = await this.generateAnswer(context, question, userProfile);
    
    // Calculate confidence
    const confidence = this.calculateEnhancedConfidence(relevantChunks, question);
    
    // Update metrics
    this.updateMetrics(confidence, Date.now() - startTime);
    
    // Cache if good confidence
    if (this.FEATURES.USE_CACHE && confidence > this.FEATURES.CACHE_CONFIDENCE_THRESHOLD) {
      const cacheKey = this.generateCacheKey(question, lessonId);
      this.saveToCache(cacheKey, answer, confidence);
    }
    
    // Log performance
    if (this.FEATURES.LOG_PERFORMANCE) {
      const duration = Date.now() - startTime;
      console.log(`⚡ ${duration}ms | Confidence: ${confidence}% | Chunks: ${relevantChunks.length}`);
    }
    
    return {
      answer,
      sources: relevantChunks,
      confidence,
    };
  }
  
  /**
   * 🆕 Generate answer with smart model selection
   */
  private async generateAnswer(
    context: string, 
    question: string,
    userProfile?: any
  ): Promise<string> {
    // Build personalized prompt
    const systemPrompt = this.buildPersonalizedPrompt(userProfile);
    
    const userPrompt = `السياق التعليمي:
=====================================
${context}
=====================================

سؤال الطالب: ${question}

أجب بوضوح مع مراعاة مستوى الطالب.`;
    
    try {
      // 🆕 Smart model selection based on question type
      const options: any = {
        temperature: 0.5,
        maxTokens: 800,
        autoSelectModel: this.FEATURES.USE_SMART_MODEL,
      };
      
      // Detect task type for better model selection
      if (question.includes('حل') || question.includes('معادلة')) {
        options.taskType = 'math';
      } else if (question.includes('اشرح') || question.includes('explain')) {
        options.taskType = 'explanation';
      } else if (question.includes('quiz') || question.includes('اختبار')) {
        options.taskType = 'quiz';
      }
      
      const answer = await openAIService.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], options);
      
      return answer;
    } catch (error) {
      console.error('Error generating answer:', error);
      return 'عذراً، حدث خطأ. حاول مرة أخرى.';
    }
  }
  
  /**
   * 🆕 Build personalized system prompt
   */
  private buildPersonalizedPrompt(userProfile?: any): string {
    let basePrompt = `أنت مساعد تعليمي ذكي متخصص في المناهج المصرية.

دورك:
- الإجابة بوضوح ودقة
- استخدام السياق المُعطى
- الشرح المناسب للمستوى
- إعطاء أمثلة عند الحاجة
- اللغة العربية الفصحى البسيطة`;
    
    if (userProfile) {
      // Add personalization
      if (userProfile.level < 5) {
        basePrompt += '\n\n💡 الطالب مبتدئ: استخدم لغة بسيطة جداً وأمثلة كثيرة.';
      } else if (userProfile.level > 8) {
        basePrompt += '\n\n🚀 الطالب متقدم: يمكنك استخدام مفاهيم متقدمة.';
      }
      
      if (userProfile.weakTopics?.length > 0) {
        basePrompt += `\n⚠️ نقاط ضعف: ${userProfile.weakTopics.join(', ')} - اشرح بتفصيل أكثر.`;
      }
    }
    
    return basePrompt;
  }
  
  /**
   * 🆕 Enhanced confidence calculation
   */
  private calculateEnhancedConfidence(chunks: SearchResult[], question: string): number {
    if (chunks.length === 0) return 0;
    
    // Base confidence from scores
    const topChunks = chunks.slice(0, 3);
    const avgScore = topChunks.reduce((sum, c) => sum + (c.score || 0), 0) / topChunks.length;
    
    // Bonuses
    let confidence = avgScore * 100;
    
    // Diversity bonus (multiple good sources)
    const highQuality = chunks.filter(c => c.score > 0.6).length;
    confidence += Math.min(highQuality * 5, 15);
    
    // Keyword match bonus
    const questionWords = question.toLowerCase().split(' ');
    const contextWords = chunks[0]?.chunk.text.toLowerCase().split(' ') || [];
    const matchCount = questionWords.filter(w => contextWords.includes(w)).length;
    confidence += Math.min(matchCount * 3, 10);
    
    // Adjacent chunks bonus (continuity)
    const hasAdjacentChunks = this.checkAdjacentChunks(chunks);
    if (hasAdjacentChunks) confidence += 5;
    
    return Math.min(Math.round(confidence), 100);
  }
  
  /**
   * 🆕 Check if we have adjacent chunks (better context)
   */
  private checkAdjacentChunks(chunks: SearchResult[]): boolean {
    const indices = chunks
      .map(c => c.chunk.metadata?.chunkIndex)
      .filter(i => i !== undefined)
      .sort((a, b) => a - b);
    
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] - indices[i-1] === 1) return true;
    }
    return false;
  }
  
  /**
   * 🆕 ENHANCED Quiz Generation - Dynamic & Adaptive
   */
  async generateQuizQuestions(
    lessonId: string, 
    count: number = 5,
    userId?: string
  ): Promise<any[]> {
    console.log(`📝 Generating ${count} adaptive quiz questions`);
    
    // Get lesson content
    const chunks = await vectorSearch.searchInLesson(lessonId, '', 15);
    if (chunks.length === 0) {
      throw new Error('No content found');
    }
    
    const context = this.buildSmartContext('', chunks);
    
    // 🆕 Get user profile for adaptive difficulty
    const userProfile = userId ? this.getUserProfile(userId) : null;
    const difficulty = this.determineQuizDifficulty(userProfile);
    
    // 🆕 Enhanced quiz prompt with variety
    const systemPrompt = `أنت خبير في إنشاء أسئلة تعليمية متنوعة وذكية.

مستوى الصعوبة: ${difficulty}
أنواع الأسئلة المطلوبة:
- اختيار من متعدد (MCQ)
- صح أو خطأ 
- أكمل الفراغات
- مسائل تطبيقية

قواعد مهمة:
1. نوّع الأسئلة (لا تكرر نفس النمط)
2. الخيارات الخاطئة يجب أن تكون منطقية
3. تدرج في الصعوبة
4. اربط بالحياة اليومية عند الإمكان
5. أضف تلميحات للأسئلة الصعبة`;
    
    const userPrompt = `من المحتوى التالي:
=====================================
${context}
=====================================

أنشئ ${count} أسئلة متنوعة.

الصيغة المطلوبة (JSON):
[
  {
    "type": "mcq|true_false|fill_blank|problem",
    "question": "نص السؤال",
    "options": ["خيار1", "خيار2", "خيار3", "خيار4"],
    "correctAnswer": "الإجابة الصحيحة",
    "explanation": "شرح مختصر",
    "hint": "تلميح مساعد",
    "difficulty": "easy|medium|hard",
    "points": 1-5,
    "tags": ["tag1", "tag2"]
  }
]`;
    
    try {
      // Use smart model selection for quiz generation
      const questions = await openAIService.chatJSON([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        temperature: 0.8, // Higher for variety
        maxTokens: 2000,
        model: 'gpt-4o-mini', // Good for structured output
      });
      
      // 🆕 Enhance questions with adaptive features
      return this.enhanceQuizQuestions(questions, userProfile);
      
    } catch (error) {
      console.error('Quiz generation error:', error);
      return this.generateFallbackQuestions(count);
    }
  }
  
  /**
   * 🆕 Determine quiz difficulty based on user profile
   */
  private determineQuizDifficulty(userProfile: any): string {
    if (!userProfile) return 'متوسط';
    
    const successRate = userProfile.totalAttempts > 0
      ? userProfile.correctAnswers / userProfile.totalAttempts
      : 0.5;
    
    if (successRate > 0.8 && userProfile.level > 7) return 'صعب';
    if (successRate < 0.4 || userProfile.level < 4) return 'سهل';
    return 'متوسط';
  }
  
  /**
   * 🆕 Enhance quiz questions with adaptive features
   */
  private enhanceQuizQuestions(questions: any[], userProfile: any): any[] {
    if (!Array.isArray(questions)) return [];
    
    return questions.map((q, index) => {
      // Add adaptive difficulty
      if (userProfile && this.FEATURES.ADAPTIVE_DIFFICULTY) {
        // Make first question easier, last harder
        if (index === 0 && userProfile.level < 5) {
          q.difficulty = 'easy';
          q.hint = q.hint || 'تذكر الأساسيات';
        } else if (index === questions.length - 1 && userProfile.level > 7) {
          q.difficulty = 'hard';
          q.points = (q.points || 1) + 2;
        }
      }
      
      // Add variety validation
      if (!q.type) {
        // Assign type based on index for variety
        const types = ['mcq', 'true_false', 'fill_blank', 'problem'];
        q.type = types[index % types.length];
      }
      
      // Ensure all fields
      return {
        ...q,
        id: `q_${Date.now()}_${index}`,
        points: q.points || (q.difficulty === 'hard' ? 3 : q.difficulty === 'easy' ? 1 : 2),
        tags: q.tags || [],
        createdAt: new Date().toISOString()
      };
    });
  }
  
  /**
   * 🆕 Fallback questions if generation fails
   */
  private generateFallbackQuestions(count: number): any[] {
    const questions = [];
    const types = ['mcq', 'true_false', 'fill_blank'];
    
    for (let i = 0; i < count; i++) {
      questions.push({
        type: types[i % types.length],
        question: `سؤال ${i + 1}: ما هو...؟`,
        options: ['خيار أ', 'خيار ب', 'خيار ج', 'خيار د'],
        correctAnswer: 'خيار أ',
        explanation: 'هذا سؤال تجريبي',
        difficulty: 'medium',
        points: 2,
        hint: 'فكر في الدرس',
        tags: ['تجريبي']
      });
    }
    return questions;
  }
  
  /**
   * 🆕 Explain wrong answer with personalized feedback
   */
  async explainWrongAnswer(
    question: string,
    userAnswer: string,
    correctAnswer: string,
    userId?: string
  ): Promise<string> {
    const userProfile = userId ? this.getUserProfile(userId) : null;
    
    const prompt = `الطالب أجاب خطأ على هذا السؤال:
السؤال: ${question}
إجابة الطالب: ${userAnswer}
الإجابة الصحيحة: ${correctAnswer}

${userProfile?.level < 5 ? 'الطالب مبتدئ، اشرح ببساطة شديدة.' : ''}

اشرح:
1. لماذا الإجابة خاطئة (بدون إحراج)
2. الإجابة الصحيحة مع السبب
3. نصيحة لتجنب هذا الخطأ
4. مثال توضيحي

كن مشجعاً وإيجابياً.`;
    
    try {
      const explanation = await openAIService.chat([
        { role: 'system', content: 'أنت معلم صبور ومشجع.' },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.7,
        maxTokens: 400,
        model: 'gpt-3.5-turbo' // Fast for feedback
      });
      
      // Track weak areas
      if (userId) {
        this.updateUserWeakAreas(userId, question);
      }
      
      return explanation;
    } catch (error) {
      return 'لا بأس، الخطأ جزء من التعلم! حاول مرة أخرى وركز على المعطيات.';
    }
  }
  
  /**
   * Explain a concept with grade-appropriate language
   */
  async explainConcept(
    concept: string,
    gradeLevel: number
  ): Promise<string> {
    console.log(`💡 Explaining "${concept}" for grade ${gradeLevel}`);
    
    // Check cache
    const cacheKey = `explain_${concept}_${gradeLevel}`;
    if (this.FEATURES.USE_CACHE) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached.answer;
    }
    
    const ageGroup = gradeLevel <= 6 ? 'الابتدائية' : gradeLevel <= 9 ? 'الإعدادية' : 'الثانوية';
    
    const systemPrompt = `أنت معلم متميز للمرحلة ${ageGroup}.
تشرح بأسلوب:
- ${gradeLevel <= 6 ? 'قصصي ممتع مع شخصيات' : 'علمي مبسط'}
- ${gradeLevel <= 9 ? 'أمثلة من الحياة اليومية' : 'ربط بالتطبيقات العملية'}
- تشبيهات مناسبة للعمر`;
    
    const userPrompt = `اشرح "${concept}" لطالب في الصف ${gradeLevel}.

الشرح يجب أن يتضمن:
1. تعريف بسيط (سطر واحد)
2. ${gradeLevel <= 6 ? 'قصة قصيرة أو شخصية كرتونية' : 'مثال من الحياة'}
3. ${gradeLevel <= 9 ? 'نشاط عملي بسيط' : 'تطبيق علمي'}
4. خلاصة في جملة

اجعله ${gradeLevel <= 6 ? 'ممتع جداً! 🌟' : 'مشوق ومفيد'}`;
    
    try {
      const explanation = await openAIService.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.7,
        maxTokens: 600,
        autoSelectModel: true
      });
      
      // Cache good explanations
      if (this.FEATURES.USE_CACHE) {
        this.saveToCache(cacheKey, explanation, 95);
      }
      
      return explanation;
    } catch (error) {
      return `${concept} هو مفهوم مهم في المنهج. راجع الكتاب المدرسي.`;
    }
  }
  
  /**
   * 🆕 Generate personalized study plan
   */
  async generateStudyPlan(
    userId: string,
    lessonId: string,
    targetDate?: Date
  ): Promise<any> {
    const userProfile = this.getUserProfile(userId);
    
    const daysUntilTarget = targetDate 
      ? Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 7;
    
    const prompt = `أنشئ خطة دراسية مخصصة:
- المدة: ${daysUntilTarget} أيام
- مستوى الطالب: ${userProfile.level}/10
- نقاط الضعف: ${userProfile.weakTopics.join(', ') || 'عام'}
- نقاط القوة: ${userProfile.strongTopics.join(', ') || 'عام'}

الخطة يجب أن تتضمن:
1. جدول يومي (وقت + موضوع)
2. تمارين متدرجة
3. مراجعات دورية
4. نصائح للحفظ
5. وقت للراحة

صيغة JSON.`;
    
    try {
      const plan = await openAIService.chatJSON([
        { role: 'system', content: 'أنت مخطط تعليمي خبير.' },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.6,
        model: 'gpt-4o-mini'
      });
      
      return plan;
    } catch (error) {
      // Simple fallback plan
      return {
        days: daysUntilTarget,
        dailyPlan: [
          { day: 1, topic: 'مراجعة الأساسيات', time: '30 دقيقة' },
          { day: 2, topic: 'حل تمارين', time: '45 دقيقة' }
        ],
        tips: ['راجع يومياً', 'اكتب ملخصات', 'احل تمارين متنوعة']
      };
    }
  }
  
  /**
   * 🆕 Smart Context Building with relevance scoring
   */
  private buildSmartContext(question: string, chunks: SearchResult[]): string {
    // Group by lesson and sort
    const chunksByLesson = new Map<string, SearchResult[]>();
    
    chunks.forEach(chunk => {
      const lessonId = chunk.lessonInfo?.id || 'unknown';
      if (!chunksByLesson.has(lessonId)) {
        chunksByLesson.set(lessonId, []);
      }
      chunksByLesson.get(lessonId)!.push(chunk);
    });
    
    // Smart selection
    const selectedChunks: SearchResult[] = [];
    
    // Top scoring chunks
    const topScored = chunks
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    selectedChunks.push(...topScored);
    
    // Add adjacent chunks for continuity
    topScored.forEach(chunk => {
      const lessonChunks = chunksByLesson.get(chunk.lessonInfo?.id || '');
      if (lessonChunks && lessonChunks.length > 1) {
        const currentIndex = chunk.chunk.metadata?.chunkIndex || 0;
        const adjacent = lessonChunks.filter(c => {
          const idx = c.chunk.metadata?.chunkIndex || 0;
          return Math.abs(idx - currentIndex) === 1 && !selectedChunks.includes(c);
        });
        selectedChunks.push(...adjacent.slice(0, 1));
      }
    });
    
    // Remove duplicates and build context
    const uniqueChunks = Array.from(new Set(selectedChunks));
    let context = 'معلومات ذات صلة:\n\n';
    let currentLesson = '';
    
    uniqueChunks.forEach((chunk, index) => {
      if (chunk.lessonInfo?.title && chunk.lessonInfo.title !== currentLesson) {
        currentLesson = chunk.lessonInfo.title;
        context += `\n📚 ${currentLesson}\n${'─'.repeat(30)}\n`;
      }
      
      context += `[${index + 1}] ${chunk.chunk.text}\n`;
      
      if (chunk.score > 0.7) {
        context += `✅ صلة قوية (${Math.round(chunk.score * 100)}%)\n`;
      }
      context += '\n';
    });
    
    return context;
  }
  
  /**
   * Original context building (backward compatible)
   */
  private buildContext(question: string, chunks: SearchResult[]): string {
    let context = 'معلومات من المنهج:\n\n';
    
    chunks.sort((a, b) => b.score - a.score);
    
    chunks.forEach((chunk, index) => {
      context += `[${index + 1}]:\n${chunk.chunk.text}\n`;
      if (chunk.lessonInfo) {
        context += `(${chunk.lessonInfo.title})\n`;
      }
      context += '\n---\n\n';
    });
    
    return context;
  }
  
  /**
   * 🆕 User Profile Management
   */
  private getUserProfile(userId: string): any {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        level: 5,
        correctAnswers: 0,
        totalAttempts: 0,
        weakTopics: [],
        strongTopics: []
      });
    }
    return this.userProfiles.get(userId);
  }
  
  /**
   * 🆕 Update user weak areas
   */
  private updateUserWeakAreas(userId: string, topic: string): void {
    const profile = this.getUserProfile(userId);
    if (!profile.weakTopics.includes(topic)) {
      profile.weakTopics.push(topic);
      // Keep only last 5 weak topics
      if (profile.weakTopics.length > 5) {
        profile.weakTopics.shift();
      }
    }
  }
  
  /**
   * 🆕 Update user performance
   */
  updateUserPerformance(
    userId: string,
    correct: boolean,
    topic?: string
  ): void {
    const profile = this.getUserProfile(userId);
    profile.totalAttempts++;
    if (correct) {
      profile.correctAnswers++;
      // Update strong topics
      if (topic && !profile.strongTopics.includes(topic)) {
        profile.strongTopics.push(topic);
        if (profile.strongTopics.length > 5) {
          profile.strongTopics.shift();
        }
      }
    }
    
    // Update level
    const successRate = profile.correctAnswers / profile.totalAttempts;
    if (successRate > 0.8 && profile.totalAttempts > 10) {
      profile.level = Math.min(10, profile.level + 1);
    } else if (successRate < 0.4 && profile.totalAttempts > 10) {
      profile.level = Math.max(1, profile.level - 1);
    }
  }
  
  /**
   * Cache management
   */
  private getFromCache(key: string): { answer: string; confidence: number } | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    cached.hits++;
    return { answer: cached.answer, confidence: cached.confidence };
  }
  
  private generateCacheKey(question: string, lessonId?: string): string {
    const normalized = question
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[؟?!.،,؛:]/g, '')
      .replace(/[ًٌٍَُِّْ]/g, '');
    
    return `rag_${normalized}_${lessonId || 'general'}`;
  }
  
  private saveToCache(key: string, answer: string, confidence: number): void {
    // Manage cache size
    if (this.cache.size >= this.FEATURES.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => (a[1].hits || 0) - (b[1].hits || 0));
      
      const toRemove = Math.ceil(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
    
    this.cache.set(key, {
      answer,
      confidence,
      timestamp: Date.now(),
      hits: 0,
    });
  }
  
  /**
   * 🆕 Update metrics
   */
  private updateMetrics(confidence: number, responseTime: number): void {
    this.metrics.averageConfidence = 
      (this.metrics.averageConfidence * (this.metrics.totalQuestions - 1) + confidence) / 
      this.metrics.totalQuestions;
    
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalQuestions - 1) + responseTime) / 
      this.metrics.totalQuestions;
  }
  
  /**
   * Get performance metrics
   */
  getMetrics(): any {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      cacheHitRate: this.metrics.totalQuestions > 0 
        ? Math.round((this.metrics.cacheHits / this.metrics.totalQuestions) * 100) 
        : 0,
      avgResponseTime: Math.round(this.metrics.averageResponseTime),
      userProfiles: this.userProfiles.size
    };
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Cleared ${size} cache entries`);
  }
  
  /**
   * Get feature status
   */
  getFeatureStatus(): any {
    return this.FEATURES;
  }
}

// Export singleton
export const ragService = new RAGService();

// Cache cleanup interval
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
    
    if (removed > 0) {
      console.log(`🧹 Cleaned ${removed} expired entries`);
    }
  }
}, 3600000);