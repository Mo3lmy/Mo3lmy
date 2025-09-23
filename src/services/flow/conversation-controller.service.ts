// 📍 المكان: src/services/flow/conversation-controller.service.ts
// الوظيفة: التحكم العميق في سير المحادثات وتوجيه الأسئلة

import { EventEmitter } from 'events';
import { lessonFlowManager, FlowState, type FlowContext } from './lesson-flow-manager.service';
import { openAIService } from '../ai/openai.service';
import { websocketService } from '../websocket/websocket.service';
import { prisma } from '../../config/database.config';
import { 
  getPrompt, 
  PromptContext,
  getChatResponsePrompt,
  getSimplificationPrompt
} from '../../utils/prompt-templates';

// ============= TYPES =============

/**
 * نوع السؤال المكتشف
 */
export enum QuestionType {
  CONTENT_RELATED = 'content_related',      // سؤال عن المحتوى
  CLARIFICATION = 'clarification',          // طلب توضيح
  EXAMPLE_REQUEST = 'example_request',      // طلب مثال
  DIFFICULTY = 'difficulty',                // صعوبة في الفهم
  OFF_TOPIC = 'off_topic',                 // خارج الموضوع
  TECHNICAL = 'technical',                  // سؤال تقني
  NAVIGATION = 'navigation',                // طلب انتقال
  META = 'meta'                            // سؤال عن النظام نفسه
}

/**
 * مستوى الاستجابة المطلوب
 */
export enum ResponseLevel {
  BRIEF = 'brief',           // إجابة مختصرة
  STANDARD = 'standard',     // إجابة عادية
  DETAILED = 'detailed',     // إجابة مفصلة
  SIMPLIFIED = 'simplified'  // إجابة مبسطة
}

/**
 * سياق المحادثة الموسع
 */
export interface ConversationContext {
  userId: string;
  lessonId: string;
  flowContext: FlowContext;
  currentTopic: string;
  recentQuestions: Array<{
    question: string;
    type: QuestionType;
    timestamp: Date;
  }>;
  comprehensionIndicators: {
    questionsAsked: number;
    clarificationsNeeded: number;
    examplesRequested: number;
    offTopicCount: number;
    averageResponseTime: number;
  };
  emotionalState: 'neutral' | 'confused' | 'frustrated' | 'engaged' | 'excited';
}

/**
 * قرار التوجيه
 */
export interface RoutingDecision {
  action: 'answer' | 'redirect' | 'clarify' | 'escalate' | 'pause_lesson';
  responseLevel: ResponseLevel;
  suggestResources: boolean;
  transitionNeeded: boolean;
  targetState?: FlowState;
  confidence: number;
}

// ============= CONVERSATION CONTROLLER SERVICE =============

export class ConversationControllerService extends EventEmitter {
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private questionPatterns: Map<string, RegExp[]> = new Map();
  
  constructor() {
    super();
    this.initializeQuestionPatterns();
  }
  
  /**
   * تهيئة أنماط الأسئلة للتصنيف
   */
  private initializeQuestionPatterns(): void {
    this.questionPatterns.set(QuestionType.CLARIFICATION, [
      /ما معنى/i,
      /يعني ايه/i,
      /مش فاهم/i,
      /ممكن توضح/i,
      /اشرح تاني/i,
      /وضح أكثر/i
    ]);
    
    this.questionPatterns.set(QuestionType.EXAMPLE_REQUEST, [
      /مثال/i,
      /مثلا/i,
      /زي ايه/i,
      /أمثلة/i,
      /طبق/i,
      /ورني مثال/i
    ]);
    
    this.questionPatterns.set(QuestionType.DIFFICULTY, [
      /صعب/i,
      /معقد/i,
      /مش قادر/i,
      /مش عارف/i,
      /محتاج مساعدة/i,
      /بساطة/i
    ]);
    
    this.questionPatterns.set(QuestionType.NAVIGATION, [
      /التالي/i,
      /السابق/i,
      /ارجع/i,
      /كمل/i,
      /انتقل/i,
      /الشريحة/i
    ]);
    
    this.questionPatterns.set(QuestionType.TECHNICAL, [
      /كيف أستخدم/i,
      /ازاي اعمل/i,
      /الأوامر/i,
      /النظام/i,
      /البرنامج/i
    ]);
  }
  
  /**
   * معالجة سؤال من المستخدم
   */
  async processQuestion(
    userId: string,
    lessonId: string,
    question: string
  ): Promise<RoutingDecision> {
    console.log(`🤔 Processing question: "${question}"`);
    
    // الحصول على أو إنشاء سياق المحادثة
    const context = await this.getOrCreateContext(userId, lessonId);
    
    // تصنيف السؤال
    const questionType = this.classifyQuestion(question, context);
    
    // تحديث السياق
    this.updateContext(context, question, questionType);
    
    // تحليل الحالة العاطفية
    const emotionalState = await this.analyzeEmotionalState(context);
    context.emotionalState = emotionalState;
    
    // اتخاذ قرار التوجيه
    const decision = this.makeRoutingDecision(questionType, context);
    
    // تنفيذ القرار
    await this.executeDecision(decision, context, question);
    
    // إرسال أحداث للمتابعة
    this.emit('question_processed', {
      userId,
      lessonId,
      question,
      type: questionType,
      decision
    });
    
    return decision;
  }
  
  /**
   * تصنيف السؤال
   */
  private classifyQuestion(
    question: string,
    context: ConversationContext
  ): QuestionType {
    const lowerQuestion = question.toLowerCase();
    
    // فحص الأنماط المعروفة
    for (const [type, patterns] of this.questionPatterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(lowerQuestion)) {
          console.log(`📝 Question classified as: ${type}`);
          return type as QuestionType;
        }
      }
    }
    
    // تحليل السياق للتصنيف الأعمق
    if (this.isRelatedToCurrentContent(question, context)) {
      return QuestionType.CONTENT_RELATED;
    }
    
    // افتراضي: خارج الموضوع إذا لم يتطابق مع أي شيء
    const currentSection = context.flowContext.sections[context.flowContext.currentSection];
    if (!this.checkRelevance(question, currentSection.title)) {
      return QuestionType.OFF_TOPIC;
    }
    
    return QuestionType.CONTENT_RELATED;
  }
  
  /**
   * فحص الصلة بالمحتوى الحالي
   */
  private isRelatedToCurrentContent(
    question: string,
    context: ConversationContext
  ): boolean {
    const currentSection = context.flowContext.sections[context.flowContext.currentSection];
    const keywords = currentSection.keywords || [];
    
    const lowerQuestion = question.toLowerCase();
    for (const keyword of keywords) {
      if (lowerQuestion.includes(keyword.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * فحص صلة السؤال بالموضوع
   */
  private checkRelevance(question: string, topic: string): boolean {
    // هنا يمكن استخدام AI لفحص أعمق
    const topicWords = topic.toLowerCase().split(' ');
    const questionWords = question.toLowerCase().split(' ');
    
    const commonWords = topicWords.filter(word => 
      questionWords.includes(word)
    );
    
    return commonWords.length > 0;
  }
  
  /**
   * تحليل الحالة العاطفية
   */
  private async analyzeEmotionalState(
    context: ConversationContext
  ): Promise<ConversationContext['emotionalState']> {
    const indicators = context.comprehensionIndicators;
    
    // قواعد تحديد الحالة
    if (indicators.offTopicCount > 3) {
      return 'frustrated';
    }
    
    if (indicators.clarificationsNeeded > indicators.questionsAsked * 0.5) {
      return 'confused';
    }
    
    if (indicators.examplesRequested > 2 && indicators.questionsAsked > 5) {
      return 'engaged';
    }
    
    if (context.recentQuestions.length > 5 && 
        indicators.clarificationsNeeded < 2) {
      return 'excited';
    }
    
    return 'neutral';
  }
  
  /**
   * اتخاذ قرار التوجيه
   */
  private makeRoutingDecision(
    questionType: QuestionType,
    context: ConversationContext
  ): RoutingDecision {
    const decision: RoutingDecision = {
      action: 'answer',
      responseLevel: ResponseLevel.STANDARD,
      suggestResources: false,
      transitionNeeded: false,
      confidence: 0.8
    };
    
    // تحديد الإجراء حسب نوع السؤال
    switch (questionType) {
      case QuestionType.DIFFICULTY:
        decision.action = 'clarify';
        decision.responseLevel = ResponseLevel.SIMPLIFIED;
        decision.suggestResources = true;
        
        // إذا كانت الصعوبة مستمرة، أوقف مؤقتاً
        if (context.emotionalState === 'confused' || 
            context.emotionalState === 'frustrated') {
          decision.action = 'pause_lesson';
          decision.transitionNeeded = true;
          decision.targetState = FlowState.PAUSED;
        }
        break;
        
      case QuestionType.CLARIFICATION:
        decision.action = 'clarify';
        decision.responseLevel = context.comprehensionIndicators.clarificationsNeeded > 2
          ? ResponseLevel.SIMPLIFIED
          : ResponseLevel.DETAILED;
        break;
        
      case QuestionType.EXAMPLE_REQUEST:
        decision.action = 'answer';
        decision.responseLevel = ResponseLevel.DETAILED;
        decision.transitionNeeded = true;
        decision.targetState = FlowState.SHOWING_EXAMPLE;
        break;
        
      case QuestionType.OFF_TOPIC:
        decision.action = 'redirect';
        decision.responseLevel = ResponseLevel.BRIEF;
        
        // إذا تكرر كثيراً، قد نحتاج للتصعيد
        if (context.comprehensionIndicators.offTopicCount > 5) {
          decision.action = 'escalate';
        }
        break;
        
      case QuestionType.NAVIGATION:
        decision.action = 'answer';
        decision.responseLevel = ResponseLevel.BRIEF;
        decision.transitionNeeded = false; // Navigation handled separately
        break;
        
      case QuestionType.TECHNICAL:
      case QuestionType.META:
        decision.action = 'answer';
        decision.responseLevel = ResponseLevel.STANDARD;
        decision.suggestResources = true;
        break;
        
      case QuestionType.CONTENT_RELATED:
      default:
        // تحديد مستوى الإجابة حسب الفهم
        if (context.flowContext.comprehensionLevel < 50) {
          decision.responseLevel = ResponseLevel.SIMPLIFIED;
        } else if (context.flowContext.comprehensionLevel > 80) {
          decision.responseLevel = ResponseLevel.DETAILED;
        }
        break;
    }
    
    // تعديل القرار حسب الحالة العاطفية
    if (context.emotionalState === 'frustrated') {
      decision.responseLevel = ResponseLevel.SIMPLIFIED;
      decision.suggestResources = true;
    } else if (context.emotionalState === 'excited') {
      decision.responseLevel = ResponseLevel.DETAILED;
    }
    
    return decision;
  }
  
  /**
   * تنفيذ قرار التوجيه
   */
  private async executeDecision(
    decision: RoutingDecision,
    context: ConversationContext,
    question: string
  ): Promise<void> {
    console.log(`🎬 Executing decision: ${decision.action} at level ${decision.responseLevel}`);
    
    // التحقق من الحاجة لانتقال في الحالة
    if (decision.transitionNeeded && decision.targetState) {
      await lessonFlowManager.transition(
        context.userId,
        context.lessonId,
        this.getTransitionEvent(decision.targetState),
        { question }
      );
    }
    
    // تنفيذ الإجراء
    switch (decision.action) {
      case 'pause_lesson':
        await this.pauseAndClarify(context, question);
        break;
        
      case 'redirect':
        await this.redirectToTopic(context, question);
        break;
        
      case 'clarify':
        await this.provideClarification(context, question, decision.responseLevel);
        break;
        
      case 'escalate':
        await this.escalateToHumanOrAdvanced(context, question);
        break;
        
      case 'answer':
        // الإجابة العادية تتم في chat service
        if (decision.suggestResources) {
          await this.suggestAdditionalResources(context);
        }
        break;
    }
  }
  
  /**
   * إيقاف مؤقت وتوضيح
   */
  private async pauseAndClarify(
    context: ConversationContext,
    question: string
  ): Promise<void> {
    // إيقاف العرض
    const flow = context.flowContext;
    if (flow.isPresenting) {
      await lessonFlowManager.transition(
        context.userId,
        context.lessonId,
        'pause'
      );
    }
    
    // رسالة تشجيعية
    const encouragement = this.getEncouragementMessage(context.emotionalState);
    
    websocketService.sendToUser(context.userId, 'lesson_paused_for_clarification', {
      lessonId: context.lessonId,
      message: `${encouragement} دعني أوضح لك هذه النقطة بطريقة أبسط.`,
      options: [
        'أعد الشرح ببساطة',
        'أعطني مثال سهل',
        'تخطى هذا الجزء',
        'خذ استراحة'
      ]
    });
    
    // توليد شرح مبسط
    const simplifiedContext = await this.buildSimplifiedContext(context);
    const simplifiedPrompt = getSimplificationPrompt(simplifiedContext);
    
    const response = await openAIService.chat([
      { role: 'system', content: simplifiedPrompt },
      { role: 'user', content: question }
    ], {
      temperature: 0.7,
      maxTokens: 500
    });
    
    websocketService.sendToUser(context.userId, 'simplified_explanation', {
      lessonId: context.lessonId,
      explanation: response,
      visualAids: true // طلب إضافة وسائل بصرية
    });
  }
  
  /**
   * إعادة التوجيه للموضوع
   */
  private async redirectToTopic(
    context: ConversationContext,
    question: string
  ): Promise<void> {
    const currentTopic = context.flowContext.sections[context.flowContext.currentSection].title;
    
    const redirectMessage = `سؤالك مهم، لكن دعنا نركز أولاً على ${currentTopic}. 
يمكننا العودة لسؤالك "${question}" لاحقاً. هل تريد أن أحفظه لك؟`;
    
    websocketService.sendToUser(context.userId, 'topic_redirect', {
      lessonId: context.lessonId,
      message: redirectMessage,
      currentTopic,
      savedQuestion: question,
      options: [
        'احفظ السؤال وكمل',
        'أجب الآن بإيجاز',
        'تجاهل وكمل'
      ]
    });
    
    // حفظ السؤال للإجابة لاحقاً
    await this.saveQuestionForLater(context, question);
  }
  
  /**
   * توفير توضيح
   */
  private async provideClarification(
    context: ConversationContext,
    question: string,
    level: ResponseLevel
  ): Promise<void> {
    const promptContext = await this.buildPromptContextFromConversation(context);
    
    let prompt: string;
    switch (level) {
      case ResponseLevel.SIMPLIFIED:
        prompt = getSimplificationPrompt(promptContext);
        break;
      case ResponseLevel.DETAILED:
        prompt = getPrompt('explain', promptContext);
        break;
      default:
        prompt = getChatResponsePrompt(promptContext);
    }
    
    const response = await openAIService.chat([
      { role: 'system', content: prompt },
      { role: 'user', content: question }
    ], {
      temperature: level === ResponseLevel.SIMPLIFIED ? 0.5 : 0.7,
      maxTokens: level === ResponseLevel.DETAILED ? 800 : 500
    });
    
    websocketService.sendToUser(context.userId, 'clarification', {
      lessonId: context.lessonId,
      message: response,
      level,
      followUpSuggestions: this.getFollowUpSuggestions(context, level)
    });
  }
  
  /**
   * التصعيد لمساعدة متقدمة
   */
  private async escalateToHumanOrAdvanced(
    context: ConversationContext,
    question: string
  ): Promise<void> {
    console.log(`🚨 Escalating question for user ${context.userId}`);
    
    // حفظ السؤال للمراجعة
    await prisma.chatMessage.create({
      data: {
        userId: context.userId,
        lessonId: context.lessonId,
        userMessage: question,
        aiResponse: '',
        metadata: JSON.stringify({
          escalated: true,
          reason: 'repeated_off_topic',
          context: {
            emotionalState: context.emotionalState,
            comprehensionLevel: context.flowContext.comprehensionLevel
          }
        })
      }
    });
    
    websocketService.sendToUser(context.userId, 'escalation_notice', {
      lessonId: context.lessonId,
      message: `يبدو أن لديك أسئلة خارج نطاق الدرس الحالي. 
هل تريد التواصل مع مدرس بشري أو الانتقال لموضوع آخر؟`,
      options: [
        'طلب مساعدة مدرس',
        'العودة للدرس',
        'تغيير الموضوع',
        'إنهاء الجلسة'
      ]
    });
  }
  
  /**
   * اقتراح موارد إضافية
   */
  private async suggestAdditionalResources(
    context: ConversationContext
  ): Promise<void> {
    const resources = await this.findRelevantResources(context);
    
    if (resources.length > 0) {
      websocketService.sendToUser(context.userId, 'suggested_resources', {
        lessonId: context.lessonId,
        resources,
        message: 'قد تفيدك هذه الموارد الإضافية:'
      });
    }
  }
  
  // ============= HELPER METHODS =============
  
  /**
   * الحصول على أو إنشاء سياق المحادثة
   */
  private async getOrCreateContext(
    userId: string,
    lessonId: string
  ): Promise<ConversationContext> {
    const key = `${userId}-${lessonId}`;
    
    if (this.conversationContexts.has(key)) {
      return this.conversationContexts.get(key)!;
    }
    
    const flowContext = lessonFlowManager.getFlow(userId, lessonId);
    if (!flowContext) {
      throw new Error('No active flow found');
    }
    
    const context: ConversationContext = {
      userId,
      lessonId,
      flowContext,
      currentTopic: flowContext.sections[flowContext.currentSection].title,
      recentQuestions: [],
      comprehensionIndicators: {
        questionsAsked: 0,
        clarificationsNeeded: 0,
        examplesRequested: 0,
        offTopicCount: 0,
        averageResponseTime: 0
      },
      emotionalState: 'neutral'
    };
    
    this.conversationContexts.set(key, context);
    return context;
  }
  
  /**
   * تحديث سياق المحادثة
   */
  private updateContext(
    context: ConversationContext,
    question: string,
    type: QuestionType
  ): void {
    // إضافة السؤال للتاريخ
    context.recentQuestions.push({
      question,
      type,
      timestamp: new Date()
    });
    
    // الاحتفاظ بآخر 10 أسئلة فقط
    if (context.recentQuestions.length > 10) {
      context.recentQuestions.shift();
    }
    
    // تحديث المؤشرات
    context.comprehensionIndicators.questionsAsked++;
    
    switch (type) {
      case QuestionType.CLARIFICATION:
      case QuestionType.DIFFICULTY:
        context.comprehensionIndicators.clarificationsNeeded++;
        break;
      case QuestionType.EXAMPLE_REQUEST:
        context.comprehensionIndicators.examplesRequested++;
        break;
      case QuestionType.OFF_TOPIC:
        context.comprehensionIndicators.offTopicCount++;
        break;
    }
    
    // تحديث الموضوع الحالي
    context.currentTopic = context.flowContext.sections[
      context.flowContext.currentSection
    ].title;
  }
  
  /**
   * الحصول على رسالة تشجيع
   */
  private getEncouragementMessage(emotionalState: string): string {
    const messages = {
      confused: 'لا تقلق، الموضوع يحتاج بعض التركيز.',
      frustrated: 'أعلم أن الأمر قد يبدو صعباً، لكنك تستطيع فهمه.',
      neutral: 'دعني أوضح لك أكثر.',
      engaged: 'أسئلتك ممتازة!',
      excited: 'رائع! أرى حماسك للتعلم.'
    };
    
    return messages[emotionalState as keyof typeof messages] || messages.neutral;
  }
  
  /**
   * بناء سياق مبسط
   */
  private async buildSimplifiedContext(
    context: ConversationContext
  ): Promise<PromptContext> {
    const flow = context.flowContext;
    
    return {
      lessonTitle: flow.lessonTitle || '',
      subject: flow.subjectName || '',
      grade: flow.grade || 6,
      currentSection: context.currentTopic,
      currentSlide: flow.currentSlide,
      comprehensionLevel: Math.max(25, flow.comprehensionLevel - 25), // خفض المستوى
      userMessage: context.recentQuestions[context.recentQuestions.length - 1]?.question,
      conversationHistory: flow.conversationState.messageHistory
        .slice(-3)
        .map(msg => `${msg.role}: ${msg.content}`),
      isMathLesson: flow.isMathLesson
    };
  }
  
  /**
   * بناء سياق من المحادثة
   */
  private async buildPromptContextFromConversation(
    context: ConversationContext
  ): Promise<PromptContext> {
    const flow = context.flowContext;
    
    return {
      lessonTitle: flow.lessonTitle || '',
      subject: flow.subjectName || '',
      grade: flow.grade || 6,
      currentSection: context.currentTopic,
      currentSlide: flow.currentSlide,
      comprehensionLevel: flow.comprehensionLevel,
      userMessage: context.recentQuestions[context.recentQuestions.length - 1]?.question,
      conversationHistory: flow.conversationState.messageHistory
        .slice(-5)
        .map(msg => `${msg.role}: ${msg.content}`),
      isMathLesson: flow.isMathLesson
    };
  }
  
  /**
   * الحصول على حدث الانتقال
   */
  private getTransitionEvent(targetState: FlowState): string {
    const eventMap: Record<string, string> = {
      [FlowState.SHOWING_EXAMPLE]: 'show_example',
      [FlowState.ANSWERING_QUESTION]: 'user_question',
      [FlowState.QUIZ_MODE]: 'start_quiz',
      [FlowState.PAUSED]: 'pause'
    };
    
    return eventMap[targetState] || 'transition';
  }
  
  /**
   * حفظ السؤال للإجابة لاحقاً
   */
  private async saveQuestionForLater(
    context: ConversationContext,
    question: string
  ): Promise<void> {
    await prisma.chatMessage.create({
      data: {
        userId: context.userId,
        lessonId: context.lessonId,
        userMessage: question,
        aiResponse: '',
        metadata: JSON.stringify({
          savedForLater: true,
          originalTopic: context.currentTopic,
          timestamp: new Date()
        })
      }
    });
  }
  
  /**
   * الحصول على اقتراحات متابعة
   */
  private getFollowUpSuggestions(
    context: ConversationContext,
    level: ResponseLevel
  ): string[] {
    const suggestions = [];
    
    if (level === ResponseLevel.SIMPLIFIED) {
      suggestions.push('مثال أبسط', 'كمل ببطء', 'خذ استراحة');
    } else if (level === ResponseLevel.DETAILED) {
      suggestions.push('تعمق أكثر', 'تطبيق عملي', 'تمرين متقدم');
    } else {
      suggestions.push('مثال', 'التالي', 'سؤال آخر');
    }
    
    // إضافة اقتراحات حسب الحالة العاطفية
    if (context.emotionalState === 'confused') {
      suggestions.push('ابدأ من البداية');
    } else if (context.emotionalState === 'excited') {
      suggestions.push('تحدي');
    }
    
    return suggestions;
  }
  
  /**
   * البحث عن موارد ذات صلة
   */
  private async findRelevantResources(
    context: ConversationContext
  ): Promise<Array<{ type: string; title: string; url?: string }>> {
    const resources = [];
    
    // موارد حسب الموضوع
    if (context.flowContext.isMathLesson) {
      resources.push({
        type: 'calculator',
        title: 'آلة حاسبة تفاعلية'
      });
      
      resources.push({
        type: 'video',
        title: 'فيديو شرح إضافي'
      });
    }
    
    // موارد حسب مستوى الصعوبة
    if (context.comprehensionIndicators.clarificationsNeeded > 3) {
      resources.push({
        type: 'simplified',
        title: 'نسخة مبسطة من الدرس'
      });
    }
    
    // موارد حسب الحالة العاطفية
    if (context.emotionalState === 'frustrated') {
      resources.push({
        type: 'game',
        title: 'لعبة تعليمية للموضوع'
      });
    }
    
    return resources;
  }
  
  /**
   * تنظيف السياقات القديمة
   */
  cleanupOldContexts(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    for (const [key, context] of this.conversationContexts.entries()) {
      const lastQuestion = context.recentQuestions[context.recentQuestions.length - 1];
      if (lastQuestion) {
        const age = now - lastQuestion.timestamp.getTime();
        if (age > maxAge) {
          this.conversationContexts.delete(key);
          console.log(`🧹 Cleaned up old context for ${key}`);
        }
      }
    }
  }
}

// Export singleton instance
export const conversationController = new ConversationControllerService();

// Cleanup old contexts periodically
setInterval(() => {
  conversationController.cleanupOldContexts();
}, 5 * 60 * 1000); // Every 5 minutes