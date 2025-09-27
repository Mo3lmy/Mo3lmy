import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database.config';
import { ragService } from '../../core/rag/rag.service';
import { openAIService } from './openai.service';
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
  private openai: any; // OpenAI instance if available
  
  constructor() {
    // Initialize OpenAI if API key exists
    if (process.env.OPENAI_API_KEY) {
      this.initializeOpenAI();
    }
  }
  
  /**
   * Initialize OpenAI
   */
  private async initializeOpenAI() {
    try {
      const { OpenAI } = await import('openai');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      console.log('✅ OpenAI initialized for ChatService');
    } catch (error) {
      console.warn('⚠️ OpenAI not initialized in ChatService:', error);
    }
  }
  
  /**
   * Process message for realtime chat with context and history
   */
  async processMessage(
    message: string,
    context: any,
    userId: string,
    sessionId?: string
  ): Promise<{ response: string; suggestions?: string[]; sessionId: string }> {
    console.log(`💬 Processing chat message from user ${userId}`);

    // Get or create session to maintain context
    const session = await this.getOrCreateSession(
      userId,
      sessionId,
      context?.lessonId
    );

    try {
      // Build conversation history for context
      const conversationHistory = await this.buildConversationHistory(session.id, userId);

      // Use RAG if lesson context is available
      let ragContext = '';
      let lessonContent = '';

      if (context?.lessonId) {
        try {
          // Get lesson content from database
          const lesson = await prisma.lesson.findUnique({
            where: { id: context.lessonId },
            include: {
              content: true,
              unit: {
                include: {
                  subject: true
                }
              }
            }
          });

          if (lesson) {
            // Build lesson content context
            if (lesson.content?.fullText) {
              lessonContent = `محتوى الدرس: ${lesson.content.fullText.substring(0, 500)}...\n`;
            }
            if (lesson.content?.summary) {
              lessonContent += `ملخص الدرس: ${lesson.content.summary}\n`;
            }
            if (lesson.content?.keyPoints) {
              const keyPoints = typeof lesson.content.keyPoints === 'string'
                ? JSON.parse(lesson.content.keyPoints)
                : lesson.content.keyPoints;
              if (Array.isArray(keyPoints)) {
                lessonContent += `النقاط الرئيسية:\n${keyPoints.map((p, i) => `${i+1}. ${p}`).join('\n')}\n`;
              }
            }

            // Update context with lesson info
            context.lessonTitle = lesson.titleAr || lesson.title;
            context.subject = lesson.unit?.subject?.nameAr || lesson.unit?.subject?.name || '';
            context.unit = (lesson.unit as any)?.nameAr || (lesson.unit as any)?.name || '';
          }

          // Try RAG service
          const ragResponse = await ragService.answerQuestion(
            message,
            context.lessonId,
            userId
          );

          if (ragResponse.confidence > 30) {
            ragContext = `
مصادر ذات صلة من الدرس:
${ragResponse.sources.map((source, i) => `${i+1}. ${source.chunk?.text || source.lessonInfo?.title || 'مصدر'}`).join('\n')}

إجابة مقترحة من المحتوى: ${ragResponse.answer}
`;
          }
        } catch (error) {
          console.warn('Context retrieval error:', error);
        }
      }

      // إذا OpenAI موجود، استخدمه مع السياق الكامل
      if (this.openai) {
        const systemPrompt = `أنت مساعد تعليمي ذكي للمناهج المصرية.

معلومات السياق:
- المادة: ${context?.subject || 'غير محدد'}
- الوحدة: ${context?.unit || 'غير محدد'}
- الدرس: ${context?.lesson || context?.lessonTitle || 'غير محدد'}
- الصف: ${context?.grade || 6}

${lessonContent}

${ragContext}

تعليمات:
1. استخدم محتوى الدرس المتاح عند الإجابة
2. أجب بطريقة بسيطة ومناسبة لمستوى الطالب
3. احتفظ بالسياق من المحادثة السابقة
4. اربط إجابتك بالمحتوى الفعلي للدرس
5. إذا السؤال خارج نطاق الدرس، اذكر ذلك واعرض مساعدة في الدرس الحالي`;

        const messages = [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: message }
        ];

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7,
          max_tokens: 800
        });

        const response = completion.choices[0].message.content || 'عذراً، لم أفهم السؤال.';

        // Save conversation to session
        await this.saveConversationToSession(session.id, userId, message, response, context?.lessonId);

        return {
          response,
          suggestions: this.generateSuggestions(message),
          sessionId: session.id
        };
      }
    } catch (error) {
      console.error('Chat processing error:', error);
    }

    // Fallback response with session tracking
    const fallbackResponse = `تلقيت سؤالك: "${message}". أنا هنا لمساعدتك في فهم الدرس بشكل أفضل!`;

    // Save even fallback conversations
    await this.saveConversationToSession(session.id, userId, message, fallbackResponse, context?.lessonId);

    return {
      response: fallbackResponse,
      suggestions: this.generateSuggestions(message),
      sessionId: session.id
    };
  }
  
  /**
   * Build conversation history for context
   */
  private async buildConversationHistory(sessionId: string, userId: string, limit: number = 10): Promise<Array<{role: string, content: string}>> {
    try {
      // First try to get messages from current session
      let recentMessages = await prisma.chatMessage.findMany({
        where: {
          userId,
          metadata: {
            contains: `"sessionId":"${sessionId}"`
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
      });

      // If no session-specific messages, get recent messages for this user
      if (recentMessages.length === 0) {
        recentMessages = await prisma.chatMessage.findMany({
          where: {
            userId,
          },
          orderBy: { createdAt: 'desc' },
          take: limit * 2,
        });
      }

      const history: Array<{role: string, content: string}> = [];

      for (const msg of recentMessages.reverse()) {
        if (msg.role === 'USER' && msg.userMessage) {
          history.push({ role: 'user', content: msg.userMessage });
        } else if (msg.role === 'ASSISTANT' && msg.aiResponse) {
          history.push({ role: 'assistant', content: msg.aiResponse });
        }
      }

      // الحد من طول التاريخ لتجنب تجاوز حدود الـ token
      return history.slice(-limit);
    } catch (error) {
      console.error('Error building conversation history:', error);
      return [];
    }
  }

  /**
   * Save conversation to session for context
   */
  private async saveConversationToSession(
    sessionId: string,
    userId: string,
    userMessage: string,
    aiResponse: string,
    lessonId?: string
  ): Promise<void> {
    try {
      const timestamp = new Date();
      const metadata = {
        sessionId,
        lessonId,
        timestamp: timestamp.toISOString(),
        userAgent: 'chat-service',
        version: '2.0'
      };

      // Save user message
      await prisma.chatMessage.create({
        data: {
          userId,
          lessonId,
          role: 'USER',
          userMessage,
          aiResponse: '',
          metadata: JSON.stringify(metadata),
          createdAt: timestamp
        }
      });

      // Save AI response
      await prisma.chatMessage.create({
        data: {
          userId,
          lessonId,
          role: 'ASSISTANT',
          userMessage: '',
          aiResponse,
          metadata: JSON.stringify(metadata),
          createdAt: new Date(timestamp.getTime() + 1000) // 1 second after user message
        }
      });

      // Update session in memory with enhanced data
      const session = this.sessions.get(sessionId);
      if (session) {
        session.messageCount += 2;
        session.lastMessageAt = new Date();

        // Update context with recent conversation topics
        if (session.context) {
          const extractedTopics = this.extractTopics([userMessage, aiResponse]);
          session.context.recentTopics = [
            ...extractedTopics,
            ...session.context.recentTopics
          ].slice(0, 5); // Keep only 5 most recent topics
        }

        this.sessions.set(sessionId, session);
      }

      console.log(`💾 Saved conversation to session ${sessionId} for lesson ${lessonId || 'general'}`);
    } catch (error) {
      console.error('Error saving conversation to session:', error);
    }
  }

  /**
   * Generate suggestions based on message
   */
  private generateSuggestions(message: string): string[] {
    const suggestions = [];

    if (!message.includes('مثال')) {
      suggestions.push('أعطني مثال');
    }
    if (!message.includes('شرح')) {
      suggestions.push('اشرح أكثر');
    }
    suggestions.push('اختبرني');
    suggestions.push('ما التالي؟');

    return suggestions.slice(0, 3);
  }
  
  /**
   * Process chat message (Original method with full parameters)
   */
  async processChatMessage(
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
        // Add these for realtime context
        (context as any).subject = lesson.unit.subject.name;
        (context as any).unit = lesson.unit.title;
        (context as any).lesson = lesson.title;
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
    
    context.previousQuestions = recentMessages.map(m => m.userMessage);
    
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
    if (!process.env.OPENAI_API_KEY || !this.openai) {
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
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 300
      });
      
      return completion.choices[0].message.content || 'عذراً، حدث خطأ. حاول مرة أخرى.';
    } catch (error) {
      console.error('Error in general message handler:', error);
      return `شكراً لرسالتك! سأساعدك في فهم ${context?.lessonTitle || 'الدرس'} بشكل أفضل.`;
    }
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
        ...(role === 'user'
          ? { userMessage: content, aiResponse: "" }
          : { aiResponse: content, userMessage: "" }),
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }
  
  /**
   * Get chat history with enhanced filtering
   */
  async getChatHistory(
    userId: string,
    lessonId?: string,
    limit: number = 50,
    sessionId?: string
  ): Promise<DBChatMessage[]> {
    const whereClause: any = { userId };

    if (lessonId) {
      whereClause.lessonId = lessonId;
    }

    if (sessionId) {
      whereClause.metadata = {
        contains: `"sessionId":"${sessionId}"`
      };
    }

    return await prisma.chatMessage.findMany({
      where: whereClause,
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
      .map(m => m.userMessage);
    
    const questionsAnswered = messages
      .filter(m => m.role === 'ASSISTANT')
      .length;
    
    // Extract topics (simplified version)
    const topics = this.extractTopics(
      messages.map(m => m.role === 'USER' ? m.userMessage : m.aiResponse)
    );
    
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
   * Generate smart suggestions based on lesson context and slide
   */
  async generateSmartSuggestions(
    userId: string,
    lessonId?: string,
    slideIndex?: number,
    currentTopic?: string
  ): Promise<string[]> {
    const suggestions: string[] = [];

    try {
      // If we have lesson context, use RAG to generate context-aware suggestions
      if (lessonId && ragService) {
        try {
          // Get relevant content for suggestions
          const relevantContent = await ragService.answerQuestion(
            currentTopic || 'محتوى الدرس',
            lessonId,
            userId
          );

          if (relevantContent.confidence > 20) {
            // Generate context-specific suggestions
            if (currentTopic) {
              suggestions.push(`اشرح لي ${currentTopic} بالتفصيل`);
              suggestions.push(`أعطني مثال على ${currentTopic}`);
              suggestions.push(`ما أهمية ${currentTopic}؟`);
            }

            // Add general lesson suggestions
            suggestions.push('ما هي النقاط المهمة في هذه الشريحة؟');
            suggestions.push('هل يمكنك تبسيط هذا الشرح؟');
            suggestions.push('اختبرني في هذا الموضوع');
          }
        } catch (ragError) {
          console.warn('RAG error in suggestions:', ragError);
        }
      }

      // Add fallback suggestions if no context-specific ones
      if (suggestions.length === 0) {
        suggestions.push(
          'ما هو موضوع الدرس؟',
          'هل يمكنك شرح هذا بطريقة أبسط؟',
          'أعطني مثال على هذا',
          'هل هناك تمارين للممارسة؟',
          'ما هي النقاط المهمة في هذا الدرس؟'
        );
      }

      // Add slide-specific suggestions if we have slide info
      if (typeof slideIndex === 'number') {
        suggestions.push(`اشرح الشريحة رقم ${slideIndex + 1}`);
        if (slideIndex > 0) {
          suggestions.push('راجع الشريحة السابقة');
        }
        suggestions.push('انتقل للشريحة التالية');
      }

      // Personalize based on user history
      const userHistory = await this.getChatHistory(userId, lessonId, 5);
      const recentTopics = userHistory
        .map(msg => this.extractTopics([msg.userMessage || msg.aiResponse || '']))
        .flat()
        .filter(topic => topic.length > 3);

      if (recentTopics.length > 0) {
        const lastTopic = recentTopics[0];
        suggestions.push(`راجع معي ${lastTopic} مرة أخرى`);
      }

      // Limit and return unique suggestions
      return [...new Set(suggestions)].slice(0, 6);
    } catch (error) {
      console.error('Error generating smart suggestions:', error);
      return [
        'ما هو موضوع الدرس؟',
        'اشرح لي هذا',
        'أعطني مثال',
        'اختبرني'
      ];
    }
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
    if (!this.openai) {
      return answer; // Return as-is if no API key
    }
    
    const prompt = `بسط هذا الشرح للأطفال:
${answer}

الشرح المبسط:`;
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 300
      });
      
      return completion.choices[0].message.content || answer;
    } catch (error) {
      console.error('Error simplifying answer:', error);
      return answer;
    }
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