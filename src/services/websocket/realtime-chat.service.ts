import { websocketService } from './websocket.service';
import { chatService } from '../ai/chat.service';
import { sessionService } from './session.service';
import { prisma } from '../../config/database.config';

export class RealtimeChatService {
  /**
   * معالجة رسالة من المستخدم عبر WebSocket
   */
  async handleUserMessage(
    userId: string,
    lessonId: string,
    message: string,
    socketId: string
  ) {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Processing chat message from user ${userId}`);
      
      // 1. أرسل إشعار "typing"
      websocketService.sendToUser(userId, 'ai_typing', {
        lessonId,
        status: 'typing'
      });
      
      // 2. احصل على السياق
      const context = await this.getLessonContext(lessonId);
      
      // 3. احصل على user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { grade: true, firstName: true }
      });
      
      // أضف grade للـ context
      if (context && user?.grade) {
  (context as any).grade = user.grade;
}
      
      // 4. أرسل للـ AI مع fallback
      let aiResponse;
      try {
        aiResponse = await chatService.processMessage(
          message,
          context || { 
            subject: 'تعليم عام',
            unit: 'درس عام', 
            lesson: 'محادثة عامة',
            grade: user?.grade || 6 
          },
          userId
        );
      } catch (aiError) {
        console.error('AI Service error:', aiError);
        // Fallback response
        aiResponse = {
          response: this.getFallbackResponse(message, user?.firstName || 'الطالب'),
          suggestions: this.getDefaultSuggestions()
        };
      }
      
      const responseTime = Date.now() - startTime;
      
      // 5. أرسل الرد للمستخدم
      websocketService.sendToUser(userId, 'ai_response', {
        lessonId,
        message: aiResponse.response,
        suggestions: aiResponse.suggestions || this.getDefaultSuggestions(),
        timestamp: new Date().toISOString()
      });
      
      // 6. احفظ في قاعدة البيانات
      await this.saveChatInteraction(
        userId,
        lessonId,
        message,
        aiResponse.response,
        aiResponse.suggestions || [],
        responseTime
      );
      
      // 7. حدّث الـ session
      const session = await sessionService.getSessionByUserAndLesson(
        userId,
        lessonId
      );
      
      if (session) {
        await sessionService.addChatMessage(session.id, {
          user: message,
          ai: aiResponse.response,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`✅ Chat response sent in ${responseTime}ms`);
      
    } catch (error: any) {
      console.error('Chat error:', error);
      
      // Send friendly error message
      websocketService.sendToUser(userId, 'ai_response', {
        lessonId,
        message: 'عذراً، أواجه صعوبة في الرد الآن. دعني أحاول مساعدتك بطريقة أخرى. ما الذي تريد معرفته؟',
        suggestions: this.getDefaultSuggestions(),
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Stream response للرسائل الطويلة
   */
  async streamResponse(
    userId: string,
    lessonId: string,
    message: string
  ) {
    try {
      // أرسل البداية
      websocketService.sendToUser(userId, 'stream_start', { lessonId });
      
      // احصل على السياق
      const context = await this.getLessonContext(lessonId);
      
      // Simulate streaming with fallback
      const fullResponse = await this.getStreamedResponse(message, context);
      const words = fullResponse.split(' ');
      
      let accumulated = '';
      
      for (const word of words) {
        accumulated += word + ' ';
        
        // أرسل كل chunk
        websocketService.sendToUser(userId, 'stream_chunk', {
          lessonId,
          chunk: word + ' ',
          accumulated: accumulated.trim()
        });
        
        // تأخير صغير لتحسين التجربة
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // أرسل النهاية
      websocketService.sendToUser(userId, 'stream_end', {
        lessonId,
        fullResponse: accumulated.trim()
      });
      
      // احفظ في قاعدة البيانات
      await this.saveChatInteraction(
        userId,
        lessonId,
        message,
        accumulated.trim(),
        [],
        0,
        true
      );
      
    } catch (error: any) {
      console.error('Stream error:', error);
      websocketService.sendToUser(userId, 'stream_error', {
        message: 'خطأ في البث',
        error: error.message
      });
    }
  }
  
  /**
   * الحصول على سياق الدرس
   */
  private async getLessonContext(lessonId: string) {
    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          unit: {
            include: {
              subject: true
            }
          }
        }
      });
      
      if (!lesson) return null;
      
      return {
        subject: lesson.unit.subject.name,
        unit: lesson.unit.title,
        lesson: lesson.title,
        learningObjectives: lesson.keyPoints ? 
          (typeof lesson.keyPoints === 'string' ? JSON.parse(lesson.keyPoints) : lesson.keyPoints) : []
      };
    } catch (error) {
      console.error('Error getting lesson context:', error);
      return null;
    }
  }
  
  /**
   * حفظ التفاعل في قاعدة البيانات
   */
  private async saveChatInteraction(
    userId: string,
    lessonId: string,
    userMessage: string,
    aiResponse: string,
    suggestions: string[],
    responseTime: number,
    isStreaming: boolean = false
  ) {
    try {
      await prisma.chatMessage.create({
        data: {
          userId,
          lessonId,
          userMessage,
          aiResponse,
          metadata: JSON.stringify({
            suggestions,
            timestamp: new Date().toISOString()
          }),
          responseTime,
          isStreaming
        }
      });
    } catch (error) {
      console.error('Error saving chat interaction:', error);
    }
  }
  
  /**
   * Fallback response when AI is not available
   */
  private getFallbackResponse(message: string, userName: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('مرحبا') || lowerMessage.includes('السلام')) {
      return `أهلاً وسهلاً ${userName}! كيف يمكنني مساعدتك في دراستك اليوم؟`;
    }
    
    if (lowerMessage.includes('شرح') || lowerMessage.includes('اشرح')) {
      return 'سأشرح لك بطريقة بسيطة. ما الموضوع الذي تريد شرحه بالتحديد؟';
    }
    
    if (lowerMessage.includes('مثال') || lowerMessage.includes('أمثلة')) {
      return 'إليك مثال توضيحي: في الرياضيات، الأعداد الطبيعية هي 1، 2، 3، 4... هل تريد مزيد من الأمثلة؟';
    }
    
    if (lowerMessage.includes('اختبر') || lowerMessage.includes('سؤال')) {
      return 'سؤال للاختبار: ما هو أصغر عدد طبيعي؟ فكر في الإجابة وأخبرني!';
    }
    
    return `شكراً لسؤالك "${message}". دعني أفكر في أفضل طريقة لمساعدتك. هل يمكنك توضيح ما تحتاج معرفته بالتحديد؟`;
  }
  
  /**
   * Get default suggestions
   */
  private getDefaultSuggestions(): string[] {
    return [
      'اشرح لي هذا الدرس',
      'أعطني مثال',
      'اختبرني بسؤال',
      'ما هي النقاط المهمة؟'
    ];
  }
  
  /**
   * Get streamed response (simulation)
   */
  private async getStreamedResponse(message: string, context: any): Promise<string> {
    // Simulate a longer response for streaming
    const response = `هذا رد تفصيلي على سؤالك: "${message}". `;
    
    if (context) {
      return response + `في درس ${context.lesson} من وحدة ${context.unit}، نتعلم مفاهيم مهمة جداً. دعني أشرح لك بالتفصيل...`;
    }
    
    return response + 'دعني أساعدك في فهم هذا الموضوع خطوة بخطوة...';
  }
}

export const realtimeChatService = new RealtimeChatService();