import { openAIService } from '../../services/ai/openai.service';
import { vectorSearch } from './vector.search';
import { documentProcessor } from './document.processor';
import type { RAGContext, RAGResponse } from '../../types/rag.types';

export class RAGService {
  
  /**
   * Answer a question using RAG
   */
  async answerQuestion(
    question: string,
    lessonId?: string,
    userId?: string
  ): Promise<RAGResponse> {
    console.log('🤔 Processing question:', question);
    
    // Search for relevant content
    const relevantChunks = lessonId
      ? await vectorSearch.searchInLesson(lessonId, question, 3)
      : await vectorSearch.searchSimilar(question, 5);
    
    if (relevantChunks.length === 0) {
      return {
        answer: 'عذراً، لم أتمكن من العثور على معلومات كافية للإجابة على سؤالك.',
        sources: [],
        confidence: 0,
      };
    }
    
    // Build context
    const context = this.buildContext(question, relevantChunks);
    
    // Generate answer
    const answer = await this.generateAnswer(context);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(relevantChunks);
    
    return {
      answer,
      sources: relevantChunks,
      confidence,
    };
  }
  
  /**
   * Build context for RAG
   */
  private buildContext(question: string, chunks: any[]): string {
    let context = 'المعلومات المتاحة:\n\n';
    
    chunks.forEach((chunk, index) => {
      context += `[${index + 1}] ${chunk.chunk.text}\n\n`;
    });
    
    return context;
  }
  
  /**
   * Generate answer using LLM
   */
  private async generateAnswer(context: string): Promise<string> {
    const systemPrompt = `أنت مساعد تعليمي ذكي متخصص في المناهج المصرية. مهمتك هي الإجابة على أسئلة الطلاب بطريقة واضحة ومفيدة.

قواعد مهمة:
1. استخدم المعلومات المتوفرة في السياق فقط
2. إذا لم تجد المعلومة في السياق، قل ذلك بوضوح
3. اشرح بطريقة مناسبة لطالب مدرسي
4. استخدم أمثلة عند الضرورة
5. كن دقيقاً وموجزاً`;
    
    const userPrompt = `السياق:
${context}

السؤال: ${context}

الإجابة:`;
    
    const answer = await openAIService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], {
      temperature: 0.5,
      maxTokens: 500,
    });
    
    return answer;
  }
  
  /**
   * Calculate confidence score
   */
  private calculateConfidence(chunks: any[]): number {
    if (chunks.length === 0) return 0;
    
    // Average of top 3 similarity scores
    const topScores = chunks
      .slice(0, 3)
      .map(c => c.score);
    
    const avgScore = topScores.reduce((a, b) => a + b, 0) / topScores.length;
    
    // Convert to percentage
    return Math.round(avgScore * 100);
  }
  
  /**
   * Generate quiz questions from content
   */
  async generateQuizQuestions(lessonId: string, count: number = 5): Promise<any[]> {
    // Get lesson content chunks
    const chunks = await vectorSearch.searchInLesson(lessonId, '', 10);
    
    if (chunks.length === 0) {
      throw new Error('No content found for lesson');
    }
    
    const context = this.buildContext('', chunks);
    
    const prompt = `بناءً على المحتوى التالي، قم بإنشاء ${count} أسئلة اختيار من متعدد للطلاب.

المحتوى:
${context}

قم بإرجاع الأسئلة في صيغة JSON array بالشكل التالي:
[
  {
    "question": "نص السؤال",
    "options": ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
    "correctAnswer": "الخيار الصحيح",
    "explanation": "شرح الإجابة"
  }
]`;
    
    const response = await openAIService.chat([
      { role: 'system', content: 'You are a quiz generator for educational content.' },
      { role: 'user', content: prompt },
    ], {
      temperature: 0.7,
      maxTokens: 1500,
    });
    
    try {
      return JSON.parse(response);
    } catch {
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
    const prompt = `اشرح مفهوم "${concept}" بطريقة بسيطة ومناسبة لطالب في الصف ${gradeLevel}.
    
استخدم:
- لغة بسيطة وواضحة
- أمثلة من الحياة اليومية
- تشبيهات مناسبة للعمر
- شرح متدرج من البسيط للمعقد`;
    
    const response = await openAIService.chat([
      { role: 'system', content: 'أنت معلم متخصص في تبسيط المفاهيم العلمية للطلاب.' },
      { role: 'user', content: prompt },
    ], {
      temperature: 0.6,
      maxTokens: 500,
    });
    
    return response;
  }
  
  /**
   * Process and index a lesson
   */
  async indexLesson(lessonId: string): Promise<void> {
    await documentProcessor.processLessonContent(lessonId);
  }
}

// Export singleton instance
export const ragService = new RAGService();