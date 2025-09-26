// src/core/rag/rag.service.ts

import { openAIService } from '../../services/ai/openai.service';
import { vectorSearch } from './vector.search';
import { documentProcessor } from './document.processor';
import type { RAGContext, RAGResponse, SearchResult } from '../../types/rag.types';

/**
 * Enhanced RAG Service with Smart Features & Emotional Intelligence
 * Version: 4.0 - Advanced Pattern Analysis & Predictive Learning
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
    // 🆕 Enhanced features
    USE_SMART_MODEL: process.env.USE_SMART_MODEL !== 'false',
    ADAPTIVE_DIFFICULTY: process.env.ADAPTIVE_DIFFICULTY !== 'false',
    PATTERN_ANALYSIS: true,
    PREDICTIVE_LEARNING: true,
    EMOTIONAL_AWARENESS: true,
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
  
  // 🆕 Enhanced User Learning Profiles
  private userProfiles: Map<string, StudentLearningProfile> = new Map();
  
  // 🆕 Pattern Analysis Data
  private learningPatterns: Map<string, LearningPattern[]> = new Map();
  
  // 🆕 Predictive Models (simple heuristics)
  private predictions: Map<string, PredictiveInsights> = new Map();

  /**
   * Answer a question using RAG - ULTRA ENHANCED VERSION
   */
  async answerQuestion(
    question: string,
    lessonId?: string,
    userId?: string
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    this.metrics.totalQuestions++;
    
    console.log('🤔 Processing:', question.substring(0, 50) + '...');
    
    // 🆕 Analyze question pattern first
    const questionPattern = this.analyzeQuestionPattern(question, userId);
    
    // ============= Cache Check with Pattern Awareness =============
    if (this.FEATURES.USE_CACHE) {
      const cacheKey = this.generateCacheKey(question, lessonId);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        const hitRate = Math.round((this.metrics.cacheHits / this.metrics.totalQuestions) * 100);
        console.log(`📦 Cache hit! (${hitRate}% hit rate)`);
        
        // 🆕 Track pattern even for cached responses
        if (userId) {
          this.trackUserInteraction(userId, question, cached.answer, true);
        }
        
        return {
          answer: cached.answer,
          sources: [],
          confidence: cached.confidence,
        };
      }
      this.metrics.cacheMisses++;
    }
    
    // ============= Smart Search with Pattern Enhancement =============
    let relevantChunks: SearchResult[] = [];
    
    try {
      // 🆕 Use pattern insights for better search
      const searchQuery = questionPattern.suggestedSearchTerms 
        ? `${question} ${questionPattern.suggestedSearchTerms.join(' ')}`
        : question;
      
      relevantChunks = lessonId
        ? await vectorSearch.searchInLesson(lessonId, searchQuery, 5)
        : await vectorSearch.enhancedSearch(searchQuery, 8);
      
      // Enhanced fallback with pattern awareness
      if (relevantChunks.length === 0 && this.FEATURES.USE_FALLBACK_SEARCH) {
        console.log('🔄 Pattern-aware fallback search...');
        
        // Try searching for related concepts from user's history
        if (userId && questionPattern.relatedConcepts.length > 0) {
          for (const concept of questionPattern.relatedConcepts) {
            const conceptChunks = await vectorSearch.searchSimilar(concept, 3);
            relevantChunks.push(...conceptChunks);
          }
        }
        
        // If still nothing, broader search
        if (relevantChunks.length === 0) {
          relevantChunks = await vectorSearch.enhancedSearch(question, 5);
        }
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      relevantChunks = await vectorSearch.searchSimilar(question, 5);
    }
    
    if (relevantChunks.length === 0) {
      const fallbackAnswer = this.generateFallbackAnswer(question, userId);
      return {
        answer: fallbackAnswer,
        sources: [],
        confidence: 0,
      };
    }
    
    // ============= Context Building with Intelligence =============
    const userProfile = userId ? this.getEnhancedUserProfile(userId) : null;
    const context = this.buildIntelligentContext(question, relevantChunks, userProfile, questionPattern);
    
    // ============= Generate Answer with Full Personalization =============
    const answer = await this.generatePersonalizedAnswer(context, question, userProfile, questionPattern);
    
    // Calculate confidence
    const confidence = this.calculateEnhancedConfidence(relevantChunks, question);
    
    // 🆕 Track interaction for pattern analysis
    if (userId) {
      this.trackUserInteraction(userId, question, answer, false);
      this.updatePredictions(userId, question, confidence);
    }
    
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
   * 🆕 Calculate enhanced confidence
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
   * Cache management methods
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
   * 🆕 Build smart context with relevance scoring
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
   * 🆕 Analyze question pattern for insights
   */
  private analyzeQuestionPattern(question: string, userId?: string): QuestionPattern {
    const pattern: QuestionPattern = {
      type: this.detectQuestionType(question),
      difficulty: this.assessQuestionDifficulty(question),
      relatedConcepts: [],
      suggestedSearchTerms: [],
      emotionalTone: 'neutral',
      learningStage: 'learning'
    };
    
    // Analyze emotional tone
    if (question.includes('مش فاهم') || question.includes('صعب')) {
      pattern.emotionalTone = 'frustrated';
    } else if (question.includes('ممكن') || question.includes('لو سمحت')) {
      pattern.emotionalTone = 'polite';
    } else if (question.includes('!') || question.includes('؟؟')) {
      pattern.emotionalTone = 'urgent';
    }
    
    // Detect learning stage
    if (question.includes('ليه') || question.includes('ازاي')) {
      pattern.learningStage = 'understanding';
    } else if (question.includes('حل') || question.includes('احسب')) {
      pattern.learningStage = 'application';
    } else if (question.includes('مراجعة') || question.includes('ملخص')) {
      pattern.learningStage = 'review';
    }
    
    // Get user-specific patterns
    if (userId) {
      const userPatterns = this.learningPatterns.get(userId) || [];
      
      // Find related concepts from history
      const recentTopics = userPatterns
        .slice(-10)
        .map(p => p.topic)
        .filter((v, i, a) => a.indexOf(v) === i);
      
      pattern.relatedConcepts = recentTopics.slice(0, 3);
      
      // Suggest search terms based on weak areas
      const userProfile = this.getEnhancedUserProfile(userId);
      if (userProfile.weakAreas.length > 0) {
        pattern.suggestedSearchTerms = userProfile.weakAreas.slice(0, 2);
      }
    }
    
    return pattern;
  }
  
  /**
   * 🆕 Build intelligent context with pattern awareness
   */
  private buildIntelligentContext(
    question: string,
    chunks: SearchResult[],
    userProfile: StudentLearningProfile | null,
    pattern: QuestionPattern
  ): string {
    let context = '';
    
    // Add emotional context if needed
    if (pattern.emotionalTone === 'frustrated' && userProfile) {
      context += '💡 ملاحظة: الطالب يواجه صعوبة، اشرح ببساطة شديدة.\n\n';
    }
    
    // Add learning stage context
    context += `📚 مرحلة التعلم: ${this.getLearningStageArabic(pattern.learningStage)}\n`;
    context += '=====================================\n\n';
    
    // Smart chunk selection based on user profile
    const selectedChunks = this.selectOptimalChunks(chunks, userProfile, pattern);
    
    // Group by relevance and structure
    const highRelevance = selectedChunks.filter(c => c.score > 0.7);
    const mediumRelevance = selectedChunks.filter(c => c.score > 0.5 && c.score <= 0.7);
    const supportingInfo = selectedChunks.filter(c => c.score <= 0.5);
    
    // Add high relevance first
    if (highRelevance.length > 0) {
      context += '🎯 معلومات أساسية:\n';
      highRelevance.forEach((chunk, i) => {
        context += `[${i + 1}] ${chunk.chunk.text}\n`;
        if (chunk.lessonInfo?.title) {
          context += `📖 المصدر: ${chunk.lessonInfo.title}\n`;
        }
        context += '\n';
      });
    }
    
    // Add medium relevance
    if (mediumRelevance.length > 0) {
      context += '\n📝 معلومات إضافية:\n';
      mediumRelevance.forEach((chunk, i) => {
        context += `• ${chunk.chunk.text.substring(0, 200)}...\n`;
      });
    }
    
    // Add user's previous successful examples if available
    if (userProfile && userProfile.successfulExamples.length > 0) {
      context += '\n✅ أمثلة نجح فيها الطالب سابقاً:\n';
      userProfile.successfulExamples.slice(-2).forEach(ex => {
        context += `• ${ex}\n`;
      });
    }
    
    return context;
  }
  
  /**
   * 🆕 Generate fully personalized answer
   */
  private async generatePersonalizedAnswer(
    context: string,
    question: string,
    userProfile: StudentLearningProfile | null,
    pattern: QuestionPattern
  ): Promise<string> {
    // Build ultra-personalized prompt
    let systemPrompt = this.buildAdaptiveSystemPrompt(userProfile, pattern);
    
    // Add predictive insights if available
    const predictions = userProfile ? this.predictions.get(userProfile.id) : null;
    if (predictions?.nextLikelyQuestion) {
      systemPrompt += `\n\n🔮 توقع: الطالب قد يسأل بعد ذلك عن "${predictions.nextLikelyQuestion}"`;
    }
    
    const userPrompt = `السياق التعليمي:
${context}

سؤال الطالب: ${question}

${pattern.emotionalTone === 'frustrated' ? '⚠️ الطالب محبط، كن مشجعاً جداً!' : ''}
${pattern.learningStage === 'review' ? '📝 الطالب في مرحلة المراجعة، قدم ملخصاً مركزاً' : ''}

أجب بما يناسب مستوى وحالة الطالب.`;
    
    try {
      const options: any = {
        temperature: pattern.emotionalTone === 'frustrated' ? 0.7 : 0.5,
        maxTokens: pattern.learningStage === 'review' ? 400 : 800,
        autoSelectModel: this.FEATURES.USE_SMART_MODEL,
      };
      
      // Smart model selection based on pattern
      if (pattern.type === 'mathematical') {
        options.preferredModel = 'gpt-4o';
      } else if (pattern.difficulty === 'simple') {
        options.preferredModel = 'gpt-3.5-turbo';
      }
      
      const answer = await openAIService.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], options);
      
      // Add motivational suffix if needed
      if (pattern.emotionalTone === 'frustrated' && userProfile) {
        return answer + '\n\n💪 أنت تستطيع! كل خطوة صغيرة تقربك من الهدف.';
      }
      
      return answer;
    } catch (error) {
      console.error('Error generating answer:', error);
      return this.generateFallbackAnswer(question, userProfile?.id);
    }
  }
  
  /**
   * 🆕 Build adaptive system prompt based on full context
   */
  private buildAdaptiveSystemPrompt(
    userProfile: StudentLearningProfile | null,
    pattern: QuestionPattern
  ): string {
    let prompt = `أنت معلم ذكي ومتعاطف، متخصص في المناهج المصرية.

الشخصية: ${pattern.emotionalTone === 'frustrated' ? 'صبور جداً ومشجع' : 'ودود ومحفز'}
الأسلوب: ${pattern.learningStage === 'understanding' ? 'شرح تفصيلي بأمثلة' : 'مباشر ومركز'}`;
    
    if (userProfile) {
      // Learning level adaptation
      if (userProfile.level < 4) {
        prompt += '\n\n👶 المستوى: مبتدئ\n- استخدم لغة بسيطة جداً\n- أمثلة من الحياة اليومية\n- خطوات صغيرة جداً';
      } else if (userProfile.level > 7) {
        prompt += '\n\n🎓 المستوى: متقدم\n- يمكنك استخدام مصطلحات متقدمة\n- ركز على التطبيقات\n- تحدي الطالب قليلاً';
      }
      
      // Learning style adaptation - Fixed the type issue
      if (userProfile.learningStyle === 'visual') {
        prompt += '\n📊 أسلوب التعلم: بصري - استخدم أوصاف مرئية ورموز';
      } else if (userProfile.learningStyle === 'kinesthetic') {
        prompt += '\n🔧 أسلوب التعلم: حركي - ركز على التطبيقات العملية';
      } else if (userProfile.learningStyle === 'auditory') {
        prompt += '\n🎵 أسلوب التعلم: سمعي - اذكر أمثلة صوتية';
      }
      
      // Weak areas awareness
      if (userProfile.weakAreas.length > 0) {
        prompt += `\n\n⚠️ نقاط ضعف معروفة: ${userProfile.weakAreas.join(', ')}`;
        prompt += '\n- اشرح هذه النقاط بعناية خاصة';
      }
      
      // Time of day adaptation
      const hour = new Date().getHours();
      if (hour < 12) {
        prompt += '\n\n🌅 الوقت: صباح - الطالب نشيط، يمكن شرح مفاهيم جديدة';
      } else if (hour > 20) {
        prompt += '\n\n🌙 الوقت: مساء - الطالب قد يكون متعباً، اختصر';
      }
    }
    
    return prompt;
  }
  
  /**
   * 🆕 Track user interaction for pattern analysis
   */
  private trackUserInteraction(
    userId: string,
    question: string,
    answer: string,
    fromCache: boolean
  ): void {
    if (!this.FEATURES.PATTERN_ANALYSIS) return;
    
    const patterns = this.learningPatterns.get(userId) || [];
    const pattern: LearningPattern = {
      timestamp: Date.now(),
      topic: this.extractTopic(question),
      questionType: this.detectQuestionType(question),
      responseTime: fromCache ? 0 : 1000, // Estimate if not cached
      success: true, // Assume success for now
      difficulty: this.assessQuestionDifficulty(question),
      emotionalState: this.detectEmotionalState(question)
    };
    
    patterns.push(pattern);
    
    // Keep only last 100 patterns
    if (patterns.length > 100) {
      patterns.shift();
    }
    
    this.learningPatterns.set(userId, patterns);
    
    // Analyze patterns for insights
    this.analyzePatterns(userId);
  }
  
  /**
   * 🆕 Analyze learning patterns for predictive insights
   */
  private analyzePatterns(userId: string): void {
    const patterns = this.learningPatterns.get(userId) || [];
    if (patterns.length < 5) return;
    
    const insights: PredictiveInsights = {
      nextLikelyQuestion: '',
      suggestedTopics: [],
      optimalLearningTime: '',
      predictedDifficulties: [],
      motivationLevel: 'medium'
    };
    
    // Analyze topic progression
    const recentTopics = patterns.slice(-10).map(p => p.topic);
    const topicFrequency = new Map<string, number>();
    recentTopics.forEach(topic => {
      topicFrequency.set(topic, (topicFrequency.get(topic) || 0) + 1);
    });
    
    // Predict next question based on patterns
    const lastTopic = patterns[patterns.length - 1].topic;
    const relatedTopics = this.getRelatedTopics(lastTopic);
    insights.nextLikelyQuestion = relatedTopics[0] || lastTopic;
    insights.suggestedTopics = relatedTopics;
    
    // Find optimal learning time
    const successfulPatterns = patterns.filter(p => p.success);
    const timeDistribution = new Map<number, number>();
    successfulPatterns.forEach(p => {
      const hour = new Date(p.timestamp).getHours();
      timeDistribution.set(hour, (timeDistribution.get(hour) || 0) + 1);
    });
    
    let maxHour = 0;
    let maxCount = 0;
    timeDistribution.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count;
        maxHour = hour;
      }
    });
    insights.optimalLearningTime = `${maxHour}:00 - ${maxHour + 1}:00`;
    
    // Predict difficulties
    const difficultTopics = patterns
      .filter(p => p.difficulty === 'hard' && !p.success)
      .map(p => p.topic);
    insights.predictedDifficulties = [...new Set(difficultTopics)];
    
    // Assess motivation level
    const recentEmotions = patterns.slice(-5).map(p => p.emotionalState);
    const frustrationCount = recentEmotions.filter(e => e === 'frustrated').length;
    if (frustrationCount >= 3) {
      insights.motivationLevel = 'low';
    } else if (recentEmotions.filter(e => e === 'excited').length >= 3) {
      insights.motivationLevel = 'high';
    }
    
    this.predictions.set(userId, insights);
  }
  
  /**
   * 🆕 Update predictive insights
   */
  private updatePredictions(userId: string, question: string, confidence: number): void {
    if (!this.FEATURES.PREDICTIVE_LEARNING) return;
    
    const predictions = this.predictions.get(userId) || {
      nextLikelyQuestion: '',
      suggestedTopics: [],
      optimalLearningTime: '',
      predictedDifficulties: [],
      motivationLevel: 'medium'
    };
    
    // Update based on current interaction
    if (confidence < 50) {
      const topic = this.extractTopic(question);
      if (!predictions.predictedDifficulties.includes(topic)) {
        predictions.predictedDifficulties.push(topic);
      }
    }
    
    this.predictions.set(userId, predictions);
  }
  
  /**
   * 🆕 Generate smart fallback answer
   */
  private generateFallbackAnswer(question: string, userId?: string): string {
    const userProfile = userId ? this.getEnhancedUserProfile(userId) : null;
    
    if (userProfile?.weakAreas.includes(this.extractTopic(question))) {
      return `هذا الموضوع من النقاط التي تحتاج مراجعة إضافية. 
      
دعني أساعدك:
1. راجع الأساسيات أولاً
2. حل أمثلة بسيطة
3. اسأل عن أي جزء غير واضح

💡 نصيحة: ${userProfile.lastSuccessfulTopic ? `راجع ${userProfile.lastSuccessfulTopic} أولاً، فهو مرتبط بهذا الموضوع` : 'ابدأ بالأمثلة البسيطة'}`;
    }
    
    return `عذراً، لم أجد معلومات كافية عن هذا السؤال.

💡 جرب:
- صياغة السؤال بطريقة أخرى
- تحديد الدرس المطلوب
- السؤال عن جزء محدد

أنا هنا لمساعدتك! 😊`;
  }
  
  /**
   * 🆕 Enhanced Quiz Generation with Full Personalization
   */
  async generateQuizQuestions(
    lessonId: string, 
    count: number = 5,
    userId?: string
  ): Promise<any[]> {
    console.log(`📝 Generating ${count} personalized quiz questions`);
    
    // Get user profile for full adaptation
    const userProfile = userId ? this.getEnhancedUserProfile(userId) : null;
    const predictions = userId ? this.predictions.get(userId) : undefined;
    
    // Get lesson content
    const chunks = await vectorSearch.searchInLesson(lessonId, '', 15);
    if (chunks.length === 0) {
      throw new Error('No content found');
    }
    
    const context = this.buildSmartContext('', chunks);
    
    // Build personalized quiz prompt - Fixed the type issue
    const systemPrompt = this.buildPersonalizedQuizPrompt(userProfile, predictions || null);
    
    const userPrompt = `من المحتوى التالي:
=====================================
${context}
=====================================

أنشئ ${count} أسئلة متنوعة ومناسبة للطالب.

${userProfile?.weakAreas.length ? `⚠️ ركز على: ${userProfile.weakAreas.join(', ')}` : ''}
${predictions?.predictedDifficulties.length ? `📍 تجنب التعقيد في: ${predictions.predictedDifficulties.join(', ')}` : ''}

الصيغة المطلوبة (JSON):
[
  {
    "type": "mcq|true_false|fill_blank|problem|short_answer|essay",
    "question": "نص السؤال",
    "options": ["خيار1", "خيار2", "خيار3", "خيار4"],
    "correctAnswer": "الإجابة الصحيحة",
    "explanation": "شرح مختصر",
    "hint": "تلميح مساعد",
    "difficulty": "easy|medium|hard",
    "points": 1-5,
    "tags": ["tag1", "tag2"],
    "encouragement": "رسالة تحفيزية",
    "stepByStepSolution": ["خطوة 1", "خطوة 2", "خطوة 3"],
    "requiresSteps": true
  }
]`;
    
    try {
      const questions = await openAIService.chatJSON([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        temperature: 0.8,
        maxTokens: 2000,
        model: 'gpt-4o-mini',
      });
      
      return this.personalizeQuizQuestions(questions, userProfile);
      
    } catch (error) {
      console.error('Quiz generation error:', error);
      return this.generateFallbackQuestions(count);
    }
  }
  
  /**
   * 🆕 Build personalized quiz prompt
   */
  private buildPersonalizedQuizPrompt(
    userProfile: StudentLearningProfile | null,
    predictions: PredictiveInsights | null
  ): string {
    let prompt = `أنت خبير في إنشاء اختبارات تعليمية مخصصة وذكية.

القواعد الأساسية:
1. نوّع الأسئلة لتناسب أساليب التعلم المختلفة
2. تدرج في الصعوبة بذكاء
3. أضف عناصر تحفيزية`;
    
    if (userProfile) {
      // Level-based adaptation
      prompt += `\n\n📊 مستوى الطالب: ${userProfile.level}/10`;
      if (userProfile.level < 4) {
        prompt += '\n- ابدأ بأسئلة سهلة جداً لبناء الثقة';
        prompt += '\n- استخدم كلمات بسيطة';
        prompt += '\n- أضف صور توضيحية (emoji) للتوضيح';
      } else if (userProfile.level > 7) {
        prompt += '\n- أضف أسئلة تحدي';
        prompt += '\n- اربط بتطبيقات الحياة';
        prompt += '\n- أسئلة تحليلية';
      }
      
      // Learning style adaptation
      if (userProfile.learningStyle === 'visual') {
        prompt += '\n\n🎨 الطالب بصري: استخدم أوصاف مرئية';
      } else if (userProfile.learningStyle === 'auditory') {
        prompt += '\n\n🎵 الطالب سمعي: اذكر أمثلة صوتية';
      }
      
      // Emotional state awareness
      if (userProfile.currentMood === 'frustrated') {
        prompt += '\n\n😔 الطالب محبط: أسئلة محفزة وليست محبطة';
      } else if (userProfile.currentMood === 'excited') {
        prompt += '\n\n😊 الطالب متحمس: يمكن زيادة التحدي';
      }
    }
    
    if (predictions?.motivationLevel === 'low') {
      prompt += '\n\n⚠️ المعنويات منخفضة: أضف تحفيز إضافي ونجاحات صغيرة';
    }
    
    return prompt;
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
   * 🆕 Personalize quiz questions after generation
   */
  private personalizeQuizQuestions(questions: any[], userProfile: StudentLearningProfile | null): any[] {
    if (!Array.isArray(questions)) return [];
    
    return questions.map((q, index) => {
      // Add personalized encouragement
      if (!q.encouragement && userProfile) {
        if (userProfile.currentMood === 'frustrated') {
          q.encouragement = 'أنت قادر! خطوة بخطوة';
        } else if (userProfile.level > 7) {
          q.encouragement = 'ممتاز! استمر في التفوق';
        } else {
          q.encouragement = 'أحسنت! كل محاولة تقربك من الهدف';
        }
      }
      
      // Adjust difficulty based on performance - Fixed undefined check
      if (userProfile && index === 0 && userProfile.recentFailures && userProfile.recentFailures > 2) {
        q.difficulty = 'easy';
        q.hint = 'ابدأ بالأساسيات';
      }
      
      // Add metadata
      return {
        ...q,
        id: `q_${Date.now()}_${index}`,
        personalized: true,
        userId: userProfile?.id,
        timestamp: new Date().toISOString()
      };
    });
  }
  
  /**
   * 🆕 Explain wrong answer with emotional intelligence
   */
  async explainWrongAnswer(
    question: string,
    userAnswer: string,
    correctAnswer: string,
    userId?: string
  ): Promise<string> {
    const userProfile = userId ? this.getEnhancedUserProfile(userId) : null;
    
    // Update failure tracking
    if (userProfile && userProfile.recentFailures !== undefined) {
      userProfile.recentFailures++;
      if (userProfile.recentFailures > 3) {
        userProfile.currentMood = 'frustrated';
      }
      
      const topic = this.extractTopic(question);
      if (!userProfile.weakAreas.includes(topic)) {
        userProfile.weakAreas.push(topic);
      }
    }
    
    const emotionalContext = userProfile?.currentMood === 'frustrated'
      ? 'الطالب محبط، كن لطيفاً جداً ومشجعاً'
      : 'اشرح بإيجابية';
    
    const prompt = `${emotionalContext}

السؤال: ${question}
إجابة الطالب: ${userAnswer}
الإجابة الصحيحة: ${correctAnswer}

قدم شرحاً:
1. ابدأ بتقدير المحاولة (حتى لو خاطئة)
2. اشرح الخطأ بلطف
3. وضح الإجابة الصحيحة
4. قدم طريقة لتذكر الإجابة
5. شجع الطالب

${userProfile && userProfile.level < 5 ? 'استخدم لغة بسيطة جداً' : ''}`;
    
    try {
      const explanation = await openAIService.chat([
        { role: 'system', content: 'أنت معلم متفهم وصبور، تحول الأخطاء لفرص تعلم.' },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-3.5-turbo'
      });
      
      // Add personalized motivation
      if (userProfile?.recentFailures && userProfile.recentFailures > 3) {
        return explanation + '\n\n💝 تذكر: العباقرة يخطئون أيضاً! المهم أننا نتعلم. أنت تتحسن مع كل محاولة.';
      }
      
      return explanation;
    } catch (error) {
      return this.getEncouragingFallback();
    }
  }
  
  /**
   * Explain a concept with grade-appropriate language
   */
  async explainConcept(
    concept: string,
    gradeLevel?: number
  ): Promise<string> {
    const grade = gradeLevel || 6;
    console.log(`💡 Explaining "${concept}" for grade ${grade}`);
    
    // Check cache
    const cacheKey = `explain_${concept}_${grade}`;
    if (this.FEATURES.USE_CACHE) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached.answer;
    }
    
    const ageGroup = grade <= 6 ? 'الابتدائية' : grade <= 9 ? 'الإعدادية' : 'الثانوية';
    
    const systemPrompt = `أنت معلم متميز للمرحلة ${ageGroup}.
تشرح بأسلوب:
- ${grade <= 6 ? 'قصصي ممتع مع شخصيات' : 'علمي مبسط'}
- ${grade <= 9 ? 'أمثلة من الحياة اليومية' : 'ربط بالتطبيقات العملية'}
- تشبيهات مناسبة للعمر`;
    
    const userPrompt = `اشرح "${concept}" لطالب في الصف ${grade}.

الشرح يجب أن يتضمن:
1. تعريف بسيط (سطر واحد)
2. ${grade <= 6 ? 'قصة قصيرة أو شخصية كرتونية' : 'مثال من الحياة'}
3. ${grade <= 9 ? 'نشاط عملي بسيط' : 'تطبيق علمي'}
4. خلاصة في جملة

اجعله ${grade <= 6 ? 'ممتع جداً! 🌟' : 'مشوق ومفيد'}`;
    
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
   * 🆕 Generate personalized study plan with predictions
   */
  async generatePersonalizedStudyPlan(
    userId: string,
    weaknesses: string[]
  ): Promise<any> {
    const userProfile = this.getEnhancedUserProfile(userId);
    const predictions = this.predictions.get(userId);
    const patterns = this.learningPatterns.get(userId) || [];
    
    // Analyze best study times
    const optimalTime = predictions?.optimalLearningTime || '4:00 PM - 6:00 PM';
    
    // Calculate realistic daily load
    const dailyCapacity = userProfile.level > 6 ? 45 : 30; // minutes
    
    const prompt = `أنشئ خطة دراسية مخصصة تماماً:

الطالب:
- المستوى: ${userProfile.level}/10
- أسلوب التعلم: ${userProfile.learningStyle}
- أفضل وقت للدراسة: ${optimalTime}
- السعة اليومية: ${dailyCapacity} دقيقة

نقاط الضعف: ${weaknesses.join(', ')}
نقاط القوة: ${userProfile.strongAreas.join(', ')}

الخطة يجب أن:
1. تبدأ بمراجعة نقاط القوة (لبناء الثقة)
2. تعالج نقاط الضعف تدريجياً
3. تتضمن فترات راحة
4. تحتوي على مكافآت صغيرة
5. تكون واقعية وقابلة للتنفيذ

صيغة JSON مفصلة.`;
    
    try {
      const plan = await openAIService.chatJSON([
        { role: 'system', content: 'أنت مخطط تعليمي خبير في التعلم التكيفي.' },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.6,
        model: 'gpt-4o-mini'
      });
      
      // Add tracking and gamification
      return {
        ...plan,
        dailyGoals: this.generateDailyGoals(userProfile),
        rewards: this.generateRewardSystem(userProfile.level),
        parentReport: this.generateParentGuidance(userProfile, weaknesses)
      };
    } catch (error) {
      return this.generateBasicStudyPlan(weaknesses, dailyCapacity);
    }
  }
  
  /**
   * 🆕 Helper methods for pattern analysis
   */
  private detectQuestionType(question: string): string {
    if (question.includes('حل') || question.includes('احسب')) return 'mathematical';
    if (question.includes('اشرح') || question.includes('وضح')) return 'explanation';
    if (question.includes('عرف') || question.includes('ما هو')) return 'definition';
    if (question.includes('مثال') || question.includes('طبق')) return 'application';
    return 'general';
  }
  
  private assessQuestionDifficulty(question: string): 'simple' | 'moderate' | 'hard' {
    const words = question.split(' ').length;
    const hasMultipleConcepts = (question.match(/و|أو|ثم/g) || []).length > 2;
    const hasMathSymbols = /[\+\-\*\/\=\^]/.test(question);
    
    if (words < 5 && !hasMathSymbols) return 'simple';
    if (words > 15 || hasMultipleConcepts) return 'hard';
    return 'moderate';
  }
  
  private detectEmotionalState(text: string): string {
    if (text.includes('مش فاهم') || text.includes('صعب') || text.includes('معقد')) return 'frustrated';
    if (text.includes('!') || text.includes('رائع') || text.includes('فهمت')) return 'excited';
    if (text.includes('ممل') || text.includes('طويل')) return 'bored';
    if (text.includes('😊') || text.includes('😄')) return 'happy';
    return 'neutral';
  }
  
  private extractTopic(question: string): string {
    // Simple topic extraction - can be enhanced with NLP
    const keywords = question.split(' ')
      .filter(word => word.length > 3)
      .slice(0, 2)
      .join(' ');
    return keywords || 'عام';
  }
  
  private getRelatedTopics(topic: string): string[] {
    // Simple related topics - can be enhanced with knowledge graph
    const relatedMap: Record<string, string[]> = {
      'كسور': ['أعداد', 'قسمة', 'ضرب'],
      'معادلة': ['جبر', 'متغيرات', 'حل'],
      'هندسة': ['أشكال', 'مساحة', 'محيط'],
    };
    
    for (const [key, related] of Object.entries(relatedMap)) {
      if (topic.includes(key)) return related;
    }
    return [];
  }
  
  private getLearningStageArabic(stage: string): string {
    const stages: Record<string, string> = {
      'understanding': 'فهم المفهوم',
      'application': 'التطبيق العملي',
      'review': 'المراجعة والتلخيص',
      'learning': 'التعلم الأولي'
    };
    return stages[stage] || stage;
  }
  
  /**
   * 🆕 Generate daily goals
   */
  private generateDailyGoals(userProfile: StudentLearningProfile): any[] {
    const goals = [];
    const baseGoal = userProfile.level > 5 ? 30 : 20; // minutes
    
    for (let day = 1; day <= 7; day++) {
      goals.push({
        day,
        studyMinutes: baseGoal + (day * 5),
        topics: day <= 3 ? userProfile.strongAreas : userProfile.weakAreas,
        exercises: Math.ceil(userProfile.level / 2) + day,
        reward: day % 3 === 0 ? 'مكافأة خاصة!' : 'نقاط إضافية'
      });
    }
    
    return goals;
  }
  
  /**
   * 🆕 Generate reward system
   */
  private generateRewardSystem(level: number): any {
    return {
      points: {
        perCorrectAnswer: level > 5 ? 10 : 15,
        perStreak: 5,
        dailyBonus: 50,
        weeklyBonus: 200
      },
      badges: [
        { name: 'المثابر', condition: 'أكمل 3 أيام متتالية', icon: '🏆' },
        { name: 'النجم', condition: '100% في اختبار', icon: '⭐' },
        { name: 'المتعلم السريع', condition: 'أنه درس في 20 دقيقة', icon: '⚡' }
      ],
      rewards: [
        { points: 100, reward: 'استراحة إضافية' },
        { points: 500, reward: 'اختر الموضوع التالي' },
        { points: 1000, reward: 'شهادة تقدير' }
      ]
    };
  }
  
  /**
   * 🆕 Generate parent guidance
   */
  private generateParentGuidance(
    userProfile: StudentLearningProfile,
    weaknesses: string[]
  ): any {
    return {
      summary: `الطالب في المستوى ${userProfile.level}/10`,
      currentMood: userProfile.currentMood === 'frustrated' ? 'يحتاج دعم معنوي' : 'حالة جيدة',
      recommendations: [
        userProfile.currentMood === 'frustrated' ? 'شجعوه على المحاولة دون ضغط' : 'استمروا في التشجيع',
        weaknesses.length > 3 ? 'ركزوا على موضوع واحد في كل مرة' : 'راجعوا معه الدروس',
        'خصصوا وقت ثابت يومياً للدراسة',
        userProfile.level < 5 ? 'ابدأوا بالأساسيات' : 'حلوا مسائل متقدمة'
      ],
      doNot: [
        'لا تقارنوه بالآخرين',
        'لا تضغطوا عليه وقت التعب',
        'لا تعاقبوه على الأخطاء'
      ],
      weeklyMeeting: `أفضل وقت للمراجعة: ${this.predictions.get(userProfile.id)?.optimalLearningTime || 'بعد العصر'}`
    };
  }
  
  /**
   * 🆕 Get encouraging fallback message
   */
  private getEncouragingFallback(): string {
    const messages = [
      'لا بأس! الخطأ جزء من التعلم. المحاولة القادمة ستكون أفضل! 💪',
      'كل عالم عظيم بدأ بأخطاء. أنت في الطريق الصحيح! 🌟',
      'ممتاز أنك تحاول! هذه شجاعة. هيا نحاول مرة أخرى! 🚀',
      'الأبطال لا يستسلمون! خذ نفس عميق وحاول مرة أخرى! 💖'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  
  /**
   * 🆕 Select optimal chunks based on user profile
   */
  private selectOptimalChunks(
    chunks: SearchResult[],
    userProfile: StudentLearningProfile | null,
    pattern: QuestionPattern
  ): SearchResult[] {
    if (!userProfile) return chunks.slice(0, 5);
    
    // Prioritize chunks based on user level
    const sorted = chunks.sort((a, b) => {
      // Prefer chunks matching user's level
      const aComplexity = this.assessChunkComplexity(a.chunk.text);
      const bComplexity = this.assessChunkComplexity(b.chunk.text);
      
      const aDiff = Math.abs(aComplexity - userProfile.level);
      const bDiff = Math.abs(bComplexity - userProfile.level);
      
      if (aDiff !== bDiff) return aDiff - bDiff;
      
      // Then sort by relevance
      return b.score - a.score;
    });
    
    return sorted.slice(0, 6);
  }
  
  /**
   * 🆕 Assess chunk complexity
   */
  private assessChunkComplexity(text: string): number {
    const factors = {
      length: text.length / 100,
      technicalTerms: (text.match(/[A-Za-z]+/g) || []).length / 10,
      numbers: (text.match(/\d+/g) || []).length / 5,
      sentences: text.split(/[.!?]/).length / 3
    };
    
    const complexity = Object.values(factors).reduce((sum, val) => sum + val, 0);
    return Math.min(10, Math.round(complexity));
  }
  
  /**
   * 🆕 Get enhanced user profile
   */
  private getEnhancedUserProfile(userId: string): StudentLearningProfile {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        id: userId,
        name: userId,
        level: 5,  // Default value - always present
        correctAnswers: 0,
        totalAttempts: 0,
        weakAreas: [],
        strongAreas: [],
        learningStyle: 'mixed',
        currentMood: 'neutral',
        recentFailures: 0,
        successfulExamples: [],
        lastSuccessfulTopic: '',
        preferredExplanationLength: 'medium',
        studyStreak: 0,
        lastActive: new Date()
      });
    }
    
    const profile = this.userProfiles.get(userId)!;
    
    // Update last active
    profile.lastActive = new Date();
    
    return profile;
  }
  
  /**
   * 🆕 Generate basic study plan (fallback)
   */
  private generateBasicStudyPlan(weaknesses: string[], dailyMinutes: number): any {
    const days = 7;
    const plan = {
      duration: `${days} أيام`,
      dailySchedule: [] as any[],
      tips: [
        'ابدأ بالأسهل',
        'خذ فترات راحة',
        'راجع يومياً',
        'اسأل عند الحاجة'
      ]
    };
    
    for (let day = 1; day <= days; day++) {
      plan.dailySchedule.push({
        day,
        topic: weaknesses[day % weaknesses.length] || 'مراجعة عامة',
        duration: `${dailyMinutes} دقيقة`,
        activities: [
          'قراءة الدرس',
          'حل 3 تمارين',
          'مراجعة الأخطاء'
        ]
      });
    }
    
    return plan;
  }
  
  /**
   * Update user performance
   */
  updateUserPerformance(
    userId: string,
    correct: boolean,
    topic?: string
  ): void {
    const profile = this.getEnhancedUserProfile(userId);
    profile.totalAttempts++;
    if (correct) {
      profile.correctAnswers++;
      // Update strong topics
      if (topic && !profile.strongAreas.includes(topic)) {
        profile.strongAreas.push(topic);
        if (profile.strongAreas.length > 5) {
          profile.strongAreas.shift();
        }
      }
    }
    
    // Update level - now level is guaranteed to have a value
    const successRate = profile.correctAnswers / profile.totalAttempts;
    if (successRate > 0.8 && profile.totalAttempts > 10) {
      profile.level = Math.min(10, profile.level + 1);
    } else if (successRate < 0.4 && profile.totalAttempts > 10) {
      profile.level = Math.max(1, profile.level - 1);
    }
  }
  
  /**
   * Get comprehensive metrics
   */
  getMetrics(): any {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      cacheHitRate: this.metrics.totalQuestions > 0 
        ? Math.round((this.metrics.cacheHits / this.metrics.totalQuestions) * 100) 
        : 0,
      avgResponseTime: Math.round(this.metrics.averageResponseTime),
      userProfiles: this.userProfiles.size,
      patternsAnalyzed: Array.from(this.learningPatterns.values())
        .reduce((sum, patterns) => sum + patterns.length, 0),
      predictionsGenerated: this.predictions.size
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

// Type definitions
interface StudentLearningProfile {
  id: string;
  name: string;
  level: number;  // Required - no longer optional
  correctAnswers: number;
  totalAttempts: number;
  weakAreas: string[];
  strongAreas: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  currentMood: 'happy' | 'neutral' | 'frustrated' | 'excited' | 'tired';
  recentFailures?: number;
  successfulExamples: string[];
  lastSuccessfulTopic: string;
  preferredExplanationLength: 'short' | 'medium' | 'long';
  studyStreak: number;
  lastActive: Date;
}

interface LearningPattern {
  timestamp: number;
  topic: string;
  questionType: string;
  responseTime: number;
  success: boolean;
  difficulty: 'simple' | 'moderate' | 'hard';
  emotionalState: string;
}

interface PredictiveInsights {
  nextLikelyQuestion: string;
  suggestedTopics: string[];
  optimalLearningTime: string;
  predictedDifficulties: string[];
  motivationLevel: 'low' | 'medium' | 'high';
}

interface QuestionPattern {
  type: string;
  difficulty: 'simple' | 'moderate' | 'hard';
  relatedConcepts: string[];
  suggestedSearchTerms: string[];
  emotionalTone: string;
  learningStage: string;
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