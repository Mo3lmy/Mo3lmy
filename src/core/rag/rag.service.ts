import { openAIService } from '../../services/ai/openai.service';
import { vectorSearch } from './vector.search';
import { documentProcessor } from './document.processor';
import type { RAGContext, RAGResponse } from '../../types/rag.types';

export class RAGService {
  private cache: Map<string, { answer: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600') * 1000; // Convert to ms
  
  /**
   * Answer a question using RAG
   */
  async answerQuestion(
    question: string,
    lessonId?: string,
    userId?: string
  ): Promise<RAGResponse> {
    console.log('🤔 Processing question:', question);
    
    // Check cache first if enabled
    if (process.env.USE_CACHE === 'true') {
      const cacheKey = `${question}-${lessonId || 'general'}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('📦 Returning cached answer');
        return {
          answer: cached,
          sources: [],
          confidence: 100,
        };
      }
    }
    
    // Search for relevant content
    const relevantChunks = lessonId
     ? await vectorSearch.searchInLesson(lessonId, question, 5)
     : await vectorSearch.enhancedSearch(question, 8);
    
    if (relevantChunks.length === 0) {
      return {
        answer: 'عذراً، لم أتمكن من العثور على معلومات كافية للإجابة على سؤالك. يُرجى محاولة صياغة السؤال بطريقة مختلفة أو تحديد الدرس المطلوب.',
        sources: [],
        confidence: 0,
      };
    }
    
    // Build context from chunks
    const context = this.buildContext(question, relevantChunks);
    
    // Generate answer using OpenAI
    const answer = await this.generateAnswer(context, question);
    
    // Calculate confidence based on relevance scores
    const confidence = this.calculateConfidence(relevantChunks);
    
    // Cache the answer if enabled
    if (process.env.USE_CACHE === 'true' && confidence > 50) {
      const cacheKey = `${question}-${lessonId || 'general'}`;
      this.saveToCache(cacheKey, answer);
    }
    
    return {
      answer,
      sources: relevantChunks,
      confidence,
    };
  }
  
  /**
   * Build context for RAG from retrieved chunks
   */
  private buildContext(question: string, chunks: any[]): string {
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
   * Calculate confidence score based on similarity scores
   */
  private calculateConfidence(chunks: any[]): number {
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
    
    // Convert to percentage (0-100)
    return Math.min(Math.round(avgScore * 100), 100);
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
    
    const context = this.buildContext('', chunks);
    
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
    if (process.env.USE_CACHE === 'true') {
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
      if (process.env.USE_CACHE === 'true') {
        this.saveToCache(cacheKey, explanation);
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
   * Cache management
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
  
  private saveToCache(key: string, answer: string): void {
    // Limit cache size
    if (this.cache.size > 100) {
      // Remove oldest entries
      const firstKey = this.cache.keys().next().value;
      if (typeof firstKey === 'string') {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      answer,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ RAG cache cleared');
  }
}

// Export singleton instance
export const ragService = new RAGService();

// Clear old cache entries periodically
setInterval(() => {
  const now = Date.now();
  const cacheMap = (ragService as any).cache;
  const cacheTTL = (ragService as any).CACHE_TTL;
  
  if (cacheMap && cacheTTL) {
    for (const [key, value] of cacheMap) {
      if (now - value.timestamp > cacheTTL) {
        cacheMap.delete(key);
      }
    }
  }
}, 3600000); // Every hour