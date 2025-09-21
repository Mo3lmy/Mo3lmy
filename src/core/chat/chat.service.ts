import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database.config';
import { ragService } from '../rag/rag.service';
import { openAIService } from '../../services/ai/openai.service';
import { NotFoundError } from '../../utils/errors';
import type {
  ChatSession,
  ChatContext,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatMessageMetadata,
  SuggestedAction,
  ConversationSummary,
} from '../../types/chat.types';
import type { ChatMessage as DBChatMessage } from '@prisma/client';

export class ChatService {
  private sessions: Map<string, ChatSession> = new Map();
  
  /**
   * Start or continue a chat session
   */
  async processMessage(
    userId: string,
    request: ChatRequest
  ): Promise<ChatResponse> {
    console.log(`💬 Processing chat message from user ${userId}`);
    
    // Get or create session
    const session = await this.getOrCreateSession(
      userId,
      request.sessionId,
      request.lessonId
    );
    
    // Save user message
    await this.saveMessage(
      session.id,
      userId,
      'user',
      request.message,
      request.lessonId
    );
    
    // Analyze message intent
    const intent = await this.analyzeIntent(request.message);
    
    // Generate response based on intent
    let response: string;
    let metadata: ChatMessageMetadata;
    
    switch (intent) {
      case 'question':
        const ragResponse = await this.handleQuestion(
          request.message,
          request.lessonId,
          session.context
        );
        response = ragResponse.answer;
        metadata = {
          intent,
          confidence: ragResponse.confidence,
          sources: ragResponse.sources,
          suggestedActions: await this.generateSuggestedActions(
            request.message,
            request.lessonId
          ),
        };
        break;
        
      case 'explanation':
        response = await this.handleExplanationRequest(
          request.message,
          session.context
        );
        metadata = {
          intent,
          confidence: 0.8,
          suggestedActions: [
            {
              type: 'practice',
              label: 'جرب بعض التمارين',
              description: 'تدرب على ما تعلمته',
            },
          ],
        };
        break;
        
      case 'greeting':
        response = await this.handleGreeting(userId, session.context);
        metadata = { intent };
        break;
        
      case 'help':
        response = await this.handleHelpRequest();
        metadata = { intent };
        break;
        
      default:
        response = await this.handleGeneralMessage(
          request.message,
          session.context
        );
        metadata = { intent: 'other' };
    }
    
    // Save assistant response
    await this.saveMessage(
      session.id,
      userId,
      'assistant',
      response,
      request.lessonId,
      metadata
    );
    
    // Update session
    session.messageCount += 2;
    session.lastMessageAt = new Date();
    this.sessions.set(session.id, session);
    
    // Generate follow-up questions
    const followUp = await this.generateFollowUpQuestions(
      request.message,
      response,
      session.context
    );
    
    return {
      message: response,
      sessionId: session.id,
      metadata,
      followUp,
    };
  }
  
  /**
   * Get or create chat session
   */
  private async getOrCreateSession(
    userId: string,
    sessionId?: string,
    lessonId?: string
  ): Promise<ChatSession> {
    // Check in-memory sessions
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }
    
    // Create new session
    const newSession: ChatSession = {
      id: sessionId || uuidv4(),
      userId,
      lessonId,
      startedAt: new Date(),
      lastMessageAt: new Date(),
      messageCount: 0,
      context: await this.buildContext(userId, lessonId),
    };
    
    this.sessions.set(newSession.id, newSession);
    return newSession;
  }
  
  /**
   * Build chat context
   */
  private async buildContext(
    userId: string,
    lessonId?: string
  ): Promise<ChatContext> {
    const context: ChatContext = {
      recentTopics: [],
      userLevel: 'beginner',
      language: 'ar',
      previousQuestions: [],
    };
    
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (user) {
      context.grade = user.grade || undefined;
    }
    
    // Get lesson info if provided
    if (lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          unit: {
            include: {
              subject: true,
            },
          },
        },
      });
      
      if (lesson) {
        context.lessonTitle = lesson.title;
        context.subjectName = lesson.unit.subject.name;
      }
    }
    
    // Get recent chat history for context
    const recentMessages = await prisma.chatMessage.findMany({
      where: {
        userId,
        role: 'USER',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    context.previousQuestions = recentMessages.map(m => m.content);
    
    // Determine user level based on progress
    const progress = await prisma.progress.findMany({
      where: { userId },
    });
    
    if (progress.length > 10) {
      context.userLevel = 'advanced';
    } else if (progress.length > 5) {
      context.userLevel = 'intermediate';
    }
    
    return context;
  }
  
  /**
   * Analyze message intent
   */
  private async analyzeIntent(
    message: string
  ): Promise<'question' | 'explanation' | 'example' | 'help' | 'greeting' | 'other'> {
    const lowerMessage = message.toLowerCase();
    
    // Check for greetings
    const greetings = ['مرحبا', 'أهلا', 'صباح', 'مساء', 'السلام', 'hello', 'hi'];
    if (greetings.some(g => lowerMessage.includes(g))) {
      return 'greeting';
    }
    
    // Check for help requests
    const helpKeywords = ['مساعدة', 'help', 'ساعدني', 'كيف استخدم'];
    if (helpKeywords.some(h => lowerMessage.includes(h))) {
      return 'help';
    }
    
    // Check for questions
    const questionWords = ['ما', 'من', 'متى', 'أين', 'كيف', 'لماذا', 'هل', '؟'];
    if (questionWords.some(q => lowerMessage.includes(q))) {
      return 'question';
    }
    
    // Check for explanation requests
    const explainWords = ['اشرح', 'وضح', 'فسر', 'explain', 'بسط'];
    if (explainWords.some(e => lowerMessage.includes(e))) {
      return 'explanation';
    }
    
    // Check for example requests
    const exampleWords = ['مثال', 'مثل', 'example', 'أمثلة'];
    if (exampleWords.some(e => lowerMessage.includes(e))) {
      return 'example';
    }
    
    return 'other';
  }
  
  /**
   * Handle question using RAG
   */
  private async handleQuestion(
    question: string,
    lessonId?: string,
    context?: ChatContext
  ): Promise<{
    answer: string;
    confidence: number;
    sources: string[];
  }> {
    // Use RAG to answer the question
    const ragResponse = await ragService.answerQuestion(
      question,
      lessonId
    );
    
    // Enhance answer based on context
    if (context?.userLevel === 'beginner') {
      // Simplify answer for beginners
      ragResponse.answer = await this.simplifyAnswer(ragResponse.answer);
    }
    
    return {
      answer: ragResponse.answer,
      confidence: ragResponse.confidence / 100,
      sources: ragResponse.sources.map(s => s.lessonInfo?.title || 'Unknown'),
    };
  }
  
  /**
   * Handle explanation request
   */
  private async handleExplanationRequest(
    message: string,
    context?: ChatContext
  ): Promise<string> {
    // Extract concept to explain
    const concept = this.extractConcept(message);
    
    if (!concept) {
      return 'من فضلك حدد الموضوع الذي تريد شرحه بشكل أوضح.';
    }
    
    // Generate explanation based on grade level
    const grade = context?.grade || 6;
    const explanation = await ragService.explainConcept(concept, grade);
    
    return explanation;
  }
  
  /**
   * Handle greeting
   */
  private async handleGreeting(
    userId: string,
    context?: ChatContext
  ): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    const name = user?.firstName || 'صديقي';
    const timeOfDay = this.getTimeOfDay();
    
    let greeting = `${timeOfDay} ${name}! 🌟\n\n`;
    
    if (context?.lessonTitle) {
      greeting += `أراك تدرس "${context.lessonTitle}". كيف يمكنني مساعدتك اليوم؟`;
    } else {
      greeting += 'كيف يمكنني مساعدتك في دراستك اليوم؟';
    }
    
    return greeting;
  }
  
  /**
   * Handle help request
   */
  private async handleHelpRequest(): Promise<string> {
    return `يمكنني مساعدتك في:

📚 **شرح الدروس**: اسأل عن أي موضوع في المنهج
❓ **الإجابة على الأسئلة**: استفسر عن أي شيء غير واضح
💡 **تقديم أمثلة**: اطلب أمثلة توضيحية
🎯 **حل التمارين**: ساعدك في فهم طريقة الحل
📝 **المراجعة**: ألخص لك النقاط المهمة

فقط اكتب سؤالك وسأساعدك فوراً! 😊`;
  }
  
  /**
   * Handle general message
   */
  private async handleGeneralMessage(
    message: string,
    context?: ChatContext
  ): Promise<string> {
    // If no OpenAI key, return helpful response
    if (!process.env.OPENAI_API_KEY) {
      return `شكراً لرسالتك! أنا هنا لمساعدتك في دراستك.

إذا كان لديك سؤال محدد عن ${context?.lessonTitle || 'الدرس'}، لا تتردد في طرحه.

يمكنك أيضاً:
- طلب شرح لأي مفهوم
- طلب أمثلة توضيحية
- السؤال عن التمارين`;
    }
    
    // Use AI to generate contextual response
    const systemPrompt = `أنت مساعد تعليمي ذكي للمناهج المصرية. 
المستخدم في الصف ${context?.grade || 'الدراسي'}.
${context?.lessonTitle ? `يدرس حالياً: ${context.lessonTitle}` : ''}
اجب بطريقة ودية ومفيدة ومناسبة للعمر.`;
    
    const response = await openAIService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ], {
      temperature: 0.7,
      maxTokens: 300,
    });
    
    return response;
  }
  
  /**
   * Generate suggested actions
   */
  private async generateSuggestedActions(
    message: string,
    lessonId?: string
  ): Promise<SuggestedAction[]> {
    const actions: SuggestedAction[] = [];
    
    if (lessonId) {
      // Check if video exists
      const video = await prisma.video.findUnique({
        where: { lessonId },
      });
      
      if (video && video.status === 'COMPLETED') {
        actions.push({
          type: 'watch_video',
          label: 'شاهد فيديو الشرح',
          lessonId,
          description: 'فيديو توضيحي للدرس',
        });
      }
      
      // Always suggest quiz
      actions.push({
        type: 'take_quiz',
        label: 'جرب الاختبار',
        lessonId,
        description: 'اختبر فهمك للدرس',
      });
    }
    
    // Suggest practice if struggling
    if (message.toLowerCase().includes('صعب') || message.includes('مش فاهم')) {
      actions.push({
        type: 'practice',
        label: 'مزيد من التمارين',
        description: 'تدرب أكثر لتحسين الفهم',
      });
    }
    
    return actions;
  }
  
  /**
   * Generate follow-up questions
   */
  private async generateFollowUpQuestions(
    userMessage: string,
    assistantResponse: string,
    context?: ChatContext
  ): Promise<string[]> {
    const followUps: string[] = [];
    
    // Based on context, suggest relevant follow-ups
    if (context?.lessonTitle) {
      followUps.push(`هل تريد المزيد من الأمثلة عن ${context.lessonTitle}؟`);
    }
    
    // Generic educational follow-ups
    followUps.push(
      'هل الشرح واضح أم تحتاج توضيح أكثر؟',
      'هل تريد أن نحل تمرين معاً؟'
    );
    
    // Limit to 3 follow-ups
    return followUps.slice(0, 3);
  }
  
  /**
   * Save message to database
   */
  private async saveMessage(
    sessionId: string,
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    lessonId?: string,
    metadata?: ChatMessageMetadata
  ): Promise<void> {
    await prisma.chatMessage.create({
      data: {
        userId,
        lessonId,
        role: role.toUpperCase() as any,
        content,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }
  
  /**
   * Get chat history
   */
  async getChatHistory(
    userId: string,
    lessonId?: string,
    limit: number = 50
  ): Promise<DBChatMessage[]> {
    return await prisma.chatMessage.findMany({
      where: {
        userId,
        ...(lessonId && { lessonId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
  
  /**
   * Get conversation summary
   */
  async getConversationSummary(
    sessionId: string
  ): Promise<ConversationSummary | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    // Get all messages in session
    const messages = await prisma.chatMessage.findMany({
      where: {
        userId: session.userId,
        createdAt: {
          gte: session.startedAt,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    
    // Analyze conversation
    const questionsAsked = messages
      .filter(m => m.role === 'USER')
      .map(m => m.content);
    
    const questionsAnswered = messages
      .filter(m => m.role === 'ASSISTANT')
      .length;
    
    // Extract topics (simplified version)
    const topics = this.extractTopics(messages.map(m => m.content));
    
    // Calculate duration
    const duration = session.lastMessageAt.getTime() - session.startedAt.getTime();
    
    return {
      sessionId,
      userId: session.userId,
      date: session.startedAt,
      duration: Math.round(duration / 1000), // in seconds
      messageCount: messages.length,
      topics,
      questionsAsked,
      questionsAnswered,
      conceptsExplained: topics,
      userSentiment: 'neutral', // Would need sentiment analysis
      keyInsights: [`تمت مناقشة ${topics.length} مواضيع`],
    };
  }
  
  /**
   * Clear old sessions from memory
   */
  clearOldSessions(): void {
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    for (const [id, session] of this.sessions) {
      if (session.lastMessageAt < oneHourAgo) {
        this.sessions.delete(id);
      }
    }
  }
  
  /**
   * Helper: Extract concept from message
   */
  private extractConcept(message: string): string | null {
    const cleanMessage = message
      .replace(/اشرح|وضح|فسر|explain|بسط/gi, '')
      .trim();
    
    return cleanMessage.length > 2 ? cleanMessage : null;
  }
  
  /**
   * Helper: Simplify answer for beginners
   */
  private async simplifyAnswer(answer: string): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      return answer; // Return as-is if no API key
    }
    
    const prompt = `بسط هذا الشرح للأطفال:
${answer}

الشرح المبسط:`;
    
    const simplified = await openAIService.chat([
      { role: 'user', content: prompt },
    ], {
      temperature: 0.5,
      maxTokens: 300,
    });
    
    return simplified;
  }
  
  /**
   * Helper: Extract topics from messages
   */
  private extractTopics(messages: string[]): string[] {
    const topics = new Set<string>();
    
    // Simple keyword extraction (would be better with NLP)
    const keywords = [
      'الأعداد', 'الجمع', 'الطرح', 'الضرب', 'القسمة',
      'الهندسة', 'المثلث', 'المربع', 'الدائرة',
      'العلوم', 'الفيزياء', 'الكيمياء', 'الأحياء',
    ];
    
    for (const message of messages) {
      for (const keyword of keywords) {
        if (message.includes(keyword)) {
          topics.add(keyword);
        }
      }
    }
    
    return Array.from(topics);
  }
  
  /**
   * Helper: Get time of day greeting
   */
  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    
    if (hour < 12) return 'صباح الخير';
    if (hour < 17) return 'مساء الخير';
    return 'مساء الخير';
  }
}

// Export singleton instance
export const chatService = new ChatService();

// Clear old sessions periodically
setInterval(() => {
  chatService.clearOldSessions();
}, 3600000); // Every hour