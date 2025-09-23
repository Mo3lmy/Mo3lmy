// 📍 المكان: src/services/websocket/realtime-chat.service.ts
// الوظيفة: مدرس ذكي متكامل مع prompt templates محسنة

import { websocketService } from './websocket.service';
import { chatService } from '../ai/chat.service';
import { sessionService } from './session.service';
import { lessonOrchestrator } from '../orchestrator/lesson-orchestrator.service';
import { mathSlideGenerator, MathEnabledSlideGenerator } from '../../core/video/enhanced-slide.generator';
import { EnhancedSlideGenerator } from '../../core/video/slide.generator';
import { prisma } from '../../config/database.config';
import { latexRenderer } from '../../core/interactive/math/latex-renderer';
import { openAIService } from '../ai/openai.service';

// 🎯 IMPORT PROMPT TEMPLATES
import { 
  getPrompt, 
  PromptContext,
  getExplanationPrompt,
  getExamplePrompt,
  getSimplificationPrompt,
  getQuizPrompt,
  getChatResponsePrompt,
  getSlideGenerationPrompt,
  getMathProblemPrompt,
  getLessonWelcomePrompt,
  getLessonCompletionPrompt
} from '../../utils/prompt-templates';

// ============= TYPES =============

interface ChatAction {
  type: 'start_lesson' | 'show_slide' | 'explain' | 'example' | 'exercise' | 
        'repeat' | 'next' | 'previous' | 'stop' | 'summary' | 'quiz' | 'help';
  confidence: number;
  parameters?: any;
}

interface LessonFlowState {
  userId: string;
  lessonId: string;
  currentSlide: number;
  totalSlides: number;
  slides: any[];
  isActive: boolean;
  mode: 'chat_only' | 'slides_only' | 'slides_with_voice';
  voiceEnabled: boolean;
  autoAdvance: boolean;
  speed: number;
  comprehensionLevel: number;
  conversationHistory: string[];
  currentSection?: number;
}

// ============= ENHANCED CHAT SERVICE WITH TEMPLATES =============

export class RealtimeChatService {
  private slideGenerator: EnhancedSlideGenerator;
  private activeLessonFlows: Map<string, LessonFlowState> = new Map();
  
  constructor() {
    this.slideGenerator = new EnhancedSlideGenerator();
  }

  /**
   * معالجة رسالة من المستخدم مع Action Detection و Templates
   */
  async handleUserMessage(
    userId: string,
    lessonId: string,
    message: string,
    socketId: string
  ) {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Processing chat message from user ${userId}: "${message}"`);
      
      // 1. إرسال إشعار "typing"
      websocketService.sendToUser(userId, 'ai_typing', {
        lessonId,
        status: 'typing'
      });
      
      // 2. كشف الأوامر في الرسالة
      const action = await this.detectAction(message, lessonId);
      
      // 3. تنفيذ الأمر إذا وجد
      if (action.confidence > 0.7) {
        await this.executeAction(action, userId, lessonId, message);
        return;
      }
      
      // 4. إذا لم يكن أمر، تعامل معه كسؤال عادي مع Templates
      await this.handleNormalChatWithTemplates(userId, lessonId, message);
      
    } catch (error: any) {
      console.error('Chat error:', error);
      this.sendErrorResponse(userId, lessonId);
    }
  }
  
  /**
   * كشف الأوامر في رسالة المستخدم
   */
  private async detectAction(message: string, lessonId: string): Promise<ChatAction> {
    const lowerMessage = message.toLowerCase();
    
    // قائمة الأوامر وكلماتها المفتاحية
    const actionPatterns = {
      start_lesson: [
        'اشرح الدرس', 'ابدأ الشرح', 'اشرحلي', 'ابدأ الدرس', 
        'علمني', 'فهمني', 'وضحلي', 'اشرح لي'
      ],
      show_slide: [
        'اعرض شريحة', 'ورني شريحة', 'اعمل شريحة', 
        'اعملي شريحة', 'شريحة', 'سلايد'
      ],
      explain: [
        'وضح', 'فسر', 'اشرح أكثر', 'مش فاهم', 'وضح اكتر',
        'ما معنى', 'ايه معنى', 'يعني ايه'
      ],
      example: [
        'مثال', 'امثلة', 'طبق', 'ورني مثال', 'اديني مثال',
        'مثلا', 'زي ايه'
      ],
      exercise: [
        'تمرين', 'تدريب', 'حل', 'مسألة', 'سؤال', 
        'اختبرني', 'امتحني'
      ],
      repeat: [
        'أعد', 'اعيد', 'كرر', 'تاني', 'مرة ثانية',
        'من الأول', 'من البداية'
      ],
      next: [
        'التالي', 'بعد كده', 'كمل', 'استمر', 'التالية',
        'الشريحة التالية'
      ],
      previous: [
        'السابق', 'قبل كده', 'ارجع', 'الشريحة السابقة',
        'اللي فات'
      ],
      stop: [
        'توقف', 'اوقف', 'استنى', 'انتظر', 'pause', 'stop'
      ],
      summary: [
        'ملخص', 'لخص', 'الخلاصة', 'النقاط المهمة',
        'اهم حاجات'
      ],
      quiz: [
        'اختبار', 'كويز', 'امتحان', 'أسئلة', 'تقييم'
      ],
      help: [
        'مساعدة', 'ساعدني', 'help', 'مش عارف', 'ايه الأوامر'
      ]
    };
    
    // البحث عن الأمر
    for (const [actionType, patterns] of Object.entries(actionPatterns)) {
      for (const pattern of patterns) {
        if (lowerMessage.includes(pattern)) {
          console.log(`🎯 Detected action: ${actionType} with pattern "${pattern}"`);
          
          return {
            type: actionType as ChatAction['type'],
            confidence: 0.9,
            parameters: this.extractParameters(message, actionType)
          };
        }
      }
    }
    
    // لا يوجد أمر واضح
    return { type: 'help', confidence: 0.3 };
  }
  
  /**
   * استخراج المعاملات من الرسالة
   */
  private extractParameters(message: string, actionType: string): any {
    const params: any = {};
    
    // استخراج الأرقام للانتقال لشريحة معينة
    const numberMatch = message.match(/\d+/);
    if (numberMatch) {
      params.number = parseInt(numberMatch[0]);
    }
    
    // استخراج المواضيع المحددة
    if (actionType === 'explain' || actionType === 'example') {
      // محاولة استخراج الموضوع المطلوب
      const topicKeywords = ['القسمة', 'الضرب', 'الجمع', 'الطرح', 'الكسور', 'المعادلات'];
      for (const keyword of topicKeywords) {
        if (message.includes(keyword)) {
          params.topic = keyword;
          break;
        }
      }
    }
    
    // تحديد نوع العرض
    if (message.includes('صوت')) params.withVoice = true;
    if (message.includes('شرائح فقط')) params.slidesOnly = true;
    if (message.includes('محادثة فقط')) params.chatOnly = true;
    
    return params;
  }
  
  /**
   * تنفيذ الأمر المكتشف مع استخدام Templates
   */
  private async executeAction(
    action: ChatAction,
    userId: string,
    lessonId: string,
    originalMessage: string
  ): Promise<void> {
    console.log(`⚡ Executing action: ${action.type}`);
    
    switch (action.type) {
      case 'start_lesson':
        await this.startLessonFlowWithTemplate(userId, lessonId, action.parameters);
        break;
        
      case 'show_slide':
        await this.generateAndShowSlideWithTemplate(userId, lessonId, originalMessage, action.parameters);
        break;
        
      case 'explain':
        await this.explainConceptWithTemplate(userId, lessonId, action.parameters?.topic || 'current');
        break;
        
      case 'example':
        await this.showExampleWithTemplate(userId, lessonId, action.parameters?.topic);
        break;
        
      case 'exercise':
        await this.showExerciseWithTemplate(userId, lessonId, action.parameters);
        break;
        
      case 'repeat':
        await this.repeatCurrentSlide(userId, lessonId);
        break;
        
      case 'next':
        await this.navigateSlide(userId, lessonId, 'next');
        break;
        
      case 'previous':
        await this.navigateSlide(userId, lessonId, 'previous');
        break;
        
      case 'stop':
        await this.pauseLessonFlow(userId, lessonId);
        break;
        
      case 'summary':
        await this.showLessonSummaryWithTemplate(userId, lessonId);
        break;
        
      case 'quiz':
        await this.startQuizWithTemplate(userId, lessonId);
        break;
        
      case 'help':
        await this.showHelp(userId, lessonId);
        break;
        
      default:
        await this.handleNormalChatWithTemplates(userId, lessonId, originalMessage);
    }
  }
  
  /**
   * بناء السياق للـ Templates
   */
  private async buildPromptContext(
    lessonId: string,
    userId: string,
    userMessage?: string
  ): Promise<PromptContext> {
    // جلب معلومات الدرس
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

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    // جلب آخر جلسة نشطة
    const session = await prisma.learningSession.findFirst({
      where: {
        userId,
        lessonId,
        isActive: true
      }
    });

    // جلب آخر 5 رسائل للسياق
    const chatHistory = await prisma.chatMessage.findMany({
      where: {
        userId,
        lessonId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    // جلب flow state إذا كان موجود
    const flowKey = `${userId}-${lessonId}`;
    const flow = this.activeLessonFlows.get(flowKey);

    // بناء السياق
    const context: PromptContext = {
      lessonTitle: lesson.titleAr || lesson.title,
      subject: lesson.unit.subject.nameAr || lesson.unit.subject.name,
      grade: lesson.unit.subject.grade,
  currentSection: flow?.currentSection !== undefined ? String(flow.currentSection) : undefined,
      currentSlide: flow?.currentSlide || session?.currentSlide || 0,
      comprehensionLevel: flow?.comprehensionLevel || 75,
      userMessage,
      conversationHistory: chatHistory.map(msg => 
        `الطالب: ${msg.userMessage}\nالمساعد: ${msg.aiResponse}`
      ).reverse(),
      isMathLesson: lesson.unit.subject.name.includes('رياضيات') || 
                   lesson.unit.subject.name.toLowerCase().includes('math')
    };

    return context;
  }
  
  /**
   * بدء تدفق الدرس مع Template ترحيب
   */
  private async startLessonFlowWithTemplate(
    userId: string, 
    lessonId: string,
    params: any = {}
  ): Promise<void> {
    try {
      // بناء السياق
      const context = await this.buildPromptContext(lessonId, userId);
      
      // الحصول على رسالة ترحيب من Template
      const welcomePrompt = getLessonWelcomePrompt(context);
      const welcomeMessage = await openAIService.chat([
        { role: 'system', content: welcomePrompt }
      ], {
        temperature: 0.7,
        maxTokens: 200
      });
      
      // إرسال الترحيب
      websocketService.sendToUser(userId, 'lesson_welcome', {
        lessonId,
        message: welcomeMessage,
        lesson: {
          title: context.lessonTitle,
          subject: context.subject,
          grade: context.grade
        }
      });
      
      // جلب معلومات الدرس الكاملة
      const lesson = await this.getLessonDetails(lessonId);
      if (!lesson) {
        throw new Error('Lesson not found');
      }
      
      // إنشاء lesson flow
      const flow: LessonFlowState = {
        userId,
        lessonId,
        currentSlide: 0,
        totalSlides: 0,
        slides: [],
        isActive: true,
        mode: params.chatOnly ? 'chat_only' : 
              params.slidesOnly ? 'slides_only' : 'slides_with_voice',
        voiceEnabled: params.withVoice !== false,
        autoAdvance: params.autoAdvance !== false,
        speed: params.speed || 1,
        comprehensionLevel: 75,
        conversationHistory: [welcomeMessage]
      };
      
      // توليد الشرائح
      const slides = await this.generateLessonSlides(lesson);
      flow.slides = slides;
      flow.totalSlides = slides.length;
      
      // حفظ الـ flow
      const flowKey = `${userId}-${lessonId}`;
      this.activeLessonFlows.set(flowKey, flow);
      
      // بدء عرض أول شريحة
      await this.showSlide(userId, lessonId, 0);
      
      console.log(`✅ Lesson flow started with template: ${flow.totalSlides} slides`);
      
    } catch (error) {
      console.error('Error starting lesson flow:', error);
      websocketService.sendToUser(userId, 'error', {
        message: 'حدث خطأ في بدء الدرس. دعني أحاول بطريقة أخرى.'
      });
    }
  }
  
  /**
   * توليد وعرض شريحة مع Template
   */
  private async generateAndShowSlideWithTemplate(
    userId: string,
    lessonId: string,
    message: string,
    params: any
  ): Promise<void> {
    try {
      // بناء السياق
      const context = await this.buildPromptContext(lessonId, userId, message);
      
      // تحديد نوع الشريحة
      const slideType = params.type || 'content';
      
      // الحصول على prompt لتوليد الشريحة
      const slidePrompt = getSlideGenerationPrompt(context, slideType);
      const slideContentJson = await openAIService.chat([
        { role: 'system', content: slidePrompt }
      ], {
        temperature: 0.7,
        maxTokens: 400
      });
      
      // محاولة parse JSON
      let slideData;
      try {
        slideData = JSON.parse(slideContentJson);
      } catch {
        slideData = {
          type: slideType,
          title: 'شريحة مخصصة',
          content: slideContentJson
        };
      }
      
      // توليد HTML للشريحة
      const slides = await this.slideGenerator.generateSlides(
        [slideData],
        'default'
      );
      const slideHtml = slides[0] || this.generateFallbackSlide({ 
        type: 'custom', 
        content: slideData 
      });
      
      // إرسال الشريحة
      websocketService.sendToUser(userId, 'custom_slide', {
        lessonId,
        html: slideHtml,
        type: slideType,
        message: 'تم إنشاء الشريحة حسب طلبك!'
      });
      
    } catch (error) {
      console.error('Error generating slide with template:', error);
      this.sendErrorResponse(userId, lessonId);
    }
  }
  
  /**
   * شرح مفهوم مع Template
   */
  private async explainConceptWithTemplate(
    userId: string,
    lessonId: string,
    topic: string
  ): Promise<void> {
    try {
      // بناء السياق
      const context = await this.buildPromptContext(lessonId, userId);
      context.currentSection = topic;
      
      // الحصول على prompt الشرح
      const explainPrompt = getExplanationPrompt(context);
      const explanation = await openAIService.chat([
        { role: 'system', content: explainPrompt }
      ], {
        temperature: 0.6,
        maxTokens: 800
      });
      
      // إنشاء شريحة شرح
      const slideContent = {
        title: `شرح: ${topic}`,
        text: explanation,
        bulletPoints: this.extractBulletPoints(explanation)
      };
      
      const slides = await this.slideGenerator.generateSlides(
        [slideContent],
        'default'
      );
      const slideHtml = slides[0] || this.generateFallbackSlide({ 
        type: 'explanation', 
        content: slideContent 
      });
      
      // إرسال الشريحة
      websocketService.sendToUser(userId, 'explanation_slide', {
        lessonId,
        html: slideHtml,
        topic,
        message: 'إليك شرح تفصيلي'
      });
      
      // تحديث comprehension level
      const flowKey = `${userId}-${lessonId}`;
      const flow = this.activeLessonFlows.get(flowKey);
      if (flow) {
        flow.conversationHistory.push(`شرح: ${topic}`);
        flow.conversationHistory.push(explanation);
      }
      
    } catch (error) {
      console.error('Error explaining concept:', error);
      this.sendErrorResponse(userId, lessonId);
    }
  }
  
  /**
   * عرض مثال مع Template
   */
  private async showExampleWithTemplate(
    userId: string,
    lessonId: string,
    topic?: string
  ): Promise<void> {
    try {
      // بناء السياق
      const context = await this.buildPromptContext(lessonId, userId);
      if (topic) context.currentSection = topic;
      
      // الحصول على prompt المثال
      const examplePrompt = getExamplePrompt(context);
      const exampleContent = await openAIService.chat([
        { role: 'system', content: examplePrompt }
      ], {
        temperature: 0.7,
        maxTokens: 600
      });
      
      if (context.isMathLesson) {
        // مثال رياضي مع معادلات
        const mathPrompt = getMathProblemPrompt(context);
        const mathProblemJson = await openAIService.chat([
          { role: 'system', content: mathPrompt }
        ], {
          temperature: 0.5,
          maxTokens: 500
        });
        
        try {
          const mathProblem = JSON.parse(mathProblemJson);
          const slideHtml = await mathSlideGenerator.generateMathProblemSlide(mathProblem);
          
          websocketService.sendToUser(userId, 'example_slide', {
            lessonId,
            html: slideHtml,
            type: 'math',
            message: 'مثال تفاعلي رياضي!'
          });
        } catch {
          // Fallback للمثال العادي
          await this.sendNormalExample(userId, lessonId, exampleContent);
        }
      } else {
        await this.sendNormalExample(userId, lessonId, exampleContent);
      }
      
    } catch (error) {
      console.error('Error showing example:', error);
      this.sendErrorResponse(userId, lessonId);
    }
  }
  
  /**
   * إرسال مثال عادي (helper)
   */
  private async sendNormalExample(
    userId: string,
    lessonId: string,
    exampleContent: string
  ): Promise<void> {
    const slideContent = {
      title: 'مثال توضيحي',
      text: exampleContent,
      bulletPoints: []
    };
    
    const slides = await this.slideGenerator.generateSlides(
      [slideContent],
      'default'
    );
    const slideHtml = slides[0] || this.generateFallbackSlide({ 
      type: 'example', 
      content: slideContent 
    });
    
    websocketService.sendToUser(userId, 'example_slide', {
      lessonId,
      html: slideHtml,
      type: 'normal',
      message: 'مثال توضيحي'
    });
  }
  
  /**
   * عرض تمرين مع Template
   */
  private async showExerciseWithTemplate(
    userId: string,
    lessonId: string,
    params: any
  ): Promise<void> {
    try {
      // بناء السياق
      const context = await this.buildPromptContext(lessonId, userId);
      
      // الحصول على prompt Quiz/Exercise
      const quizPrompt = getQuizPrompt(context);
      const quizJson = await openAIService.chat([
        { role: 'system', content: quizPrompt }
      ], {
        temperature: 0.6,
        maxTokens: 400
      });
      
      try {
        const quiz = JSON.parse(quizJson);
        
        websocketService.sendToUser(userId, 'exercise', {
          lessonId,
          quiz,
          message: 'تمرين للمراجعة'
        });
        
      } catch {
        // Fallback لتمرين بسيط
        websocketService.sendToUser(userId, 'exercise', {
          lessonId,
          exercise: {
            question: quizJson,
            type: 'open_ended'
          },
          message: 'تمرين للمراجعة'
        });
      }
      
    } catch (error) {
      console.error('Error showing exercise:', error);
      this.sendErrorResponse(userId, lessonId);
    }
  }
  
  /**
   * عرض ملخص الدرس مع Template
   */
  private async showLessonSummaryWithTemplate(userId: string, lessonId: string): Promise<void> {
    try {
      // بناء السياق
      const context = await this.buildPromptContext(lessonId, userId);
      
      // الحصول على prompt الملخص
      const completionPrompt = getLessonCompletionPrompt(context);
      const summaryMessage = await openAIService.chat([
        { role: 'system', content: completionPrompt }
      ], {
        temperature: 0.6,
        maxTokens: 500
      });
      
      // إنشاء شريحة الملخص
      const summaryContent = {
        title: 'ملخص الدرس',
        text: summaryMessage,
        bulletPoints: this.extractBulletPoints(summaryMessage)
      };
      
      const slides = await this.slideGenerator.generateSlides(
        [summaryContent],
        'default'
      );
      const slideHtml = slides[0] || this.generateFallbackSlide({ 
        type: 'summary', 
        content: summaryContent 
      });
      
      websocketService.sendToUser(userId, 'summary_slide', {
        lessonId,
        html: slideHtml,
        message: summaryMessage
      });
      
    } catch (error) {
      console.error('Error showing summary:', error);
      this.sendErrorResponse(userId, lessonId);
    }
  }
  
  /**
   * بدء اختبار مع Template
   */
  private async startQuizWithTemplate(userId: string, lessonId: string): Promise<void> {
    try {
      // بناء السياق
      const context = await this.buildPromptContext(lessonId, userId);
      
      // توليد 5 أسئلة
      const questions = [];
      for (let i = 0; i < 5; i++) {
        const quizPrompt = getQuizPrompt(context);
        const questionJson = await openAIService.chat([
          { role: 'system', content: quizPrompt }
        ], {
          temperature: 0.7,
          maxTokens: 300
        });
        
        try {
          const question = JSON.parse(questionJson);
          questions.push(question);
        } catch {
          console.error(`Failed to parse question ${i + 1}`);
        }
      }
      
      websocketService.sendToUser(userId, 'quiz_start', {
        lessonId,
        questions,
        message: 'اختبار تقييمي من 5 أسئلة',
        instructions: 'أجب على كل سؤال واحصل على النتيجة فوراً'
      });
      
    } catch (error) {
      console.error('Error starting quiz:', error);
      this.sendErrorResponse(userId, lessonId);
    }
  }
  
  /**
   * التعامل مع المحادثة العادية مع Templates
   */
  private async handleNormalChatWithTemplates(
    userId: string,
    lessonId: string,
    message: string
  ): Promise<void> {
    try {
      // بناء السياق
      const context = await this.buildPromptContext(lessonId, userId, message);
      
      // الحصول على prompt المحادثة
      const chatPrompt = getChatResponsePrompt(context);
      
      // استدعاء AI
      const aiResponse = await openAIService.chat([
        { role: 'system', content: chatPrompt },
        { role: 'user', content: message }
      ], {
        temperature: 0.7,
        maxTokens: 500
      });
      
      // تحليل الفهم (اختياري)
      const flowKey = `${userId}-${lessonId}`;
      const flow = this.activeLessonFlows.get(flowKey);
      if (flow && flow.conversationHistory.length % 5 === 0) {
        // كل 5 رسائل، حلل مستوى الفهم
        const analysisPrompt = getPrompt('analyze', context);
        const analysisJson = await openAIService.chat([
          { role: 'system', content: analysisPrompt }
        ], {
          temperature: 0.5,
          maxTokens: 200
        });
        
        try {
          const analysis = JSON.parse(analysisJson);
          flow.comprehensionLevel = analysis.comprehensionLevel;
          
          // إرسال تحديث الفهم
          websocketService.sendToUser(userId, 'comprehension_update', {
            lessonId,
            level: analysis.comprehensionLevel,
            feedback: analysis.feedback
          });
        } catch {
          // Ignore analysis errors
        }
      }
      
      // إرسال الرد
      websocketService.sendToUser(userId, 'ai_response', {
        lessonId,
        message: aiResponse,
        suggestions: this.getContextualSuggestions(context),
        timestamp: new Date().toISOString()
      });
      
      // حفظ في قاعدة البيانات
      await this.saveChatInteraction(
        userId,
        lessonId,
        message,
        aiResponse,
        this.getContextualSuggestions(context),
        Date.now()
      );
      
      // تحديث conversation history
      if (flow) {
        flow.conversationHistory.push(`الطالب: ${message}`);
        flow.conversationHistory.push(`المساعد: ${aiResponse}`);
        
        // احتفظ بآخر 20 رسالة فقط
        if (flow.conversationHistory.length > 20) {
          flow.conversationHistory = flow.conversationHistory.slice(-20);
        }
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      // Fallback للرد بدون template
      await this.handleNormalChat(userId, lessonId, message);
    }
  }
  
  /**
   * الحصول على اقتراحات سياقية
   */
  private getContextualSuggestions(context: PromptContext): string[] {
    const suggestions = [];
    
    // اقتراحات حسب المستوى
    if (context.comprehensionLevel && context.comprehensionLevel < 50) {
      suggestions.push('اشرح ببساطة أكثر');
      suggestions.push('أعطني مثال سهل');
    } else if (context.comprehensionLevel && context.comprehensionLevel > 80) {
      suggestions.push('تمرين متقدم');
      suggestions.push('سؤال تحدي');
    }
    
    // اقتراحات عامة
    suggestions.push('التالي');
    suggestions.push('ملخص');
    
    // اقتراحات للرياضيات
    if (context.isMathLesson) {
      suggestions.push('حل معادلة');
      suggestions.push('رسم بياني');
    }
    
    return suggestions.slice(0, 5);
  }
  
  // =============== باقي الدوال من الكود الأصلي (بدون تغيير كبير) ===============
  
  private async navigateSlide(
    userId: string,
    lessonId: string,
    direction: 'next' | 'previous'
  ): Promise<void> {
    const flowKey = `${userId}-${lessonId}`;
    const flow = this.activeLessonFlows.get(flowKey);
    
    if (!flow) {
      websocketService.sendToUser(userId, 'ai_response', {
        lessonId,
        message: 'لم يبدأ الدرس بعد. قل "اشرح الدرس" للبدء.'
      });
      return;
    }
    
    const newSlide = direction === 'next' ? 
      Math.min(flow.currentSlide + 1, flow.totalSlides - 1) :
      Math.max(flow.currentSlide - 1, 0);
    
    if (newSlide !== flow.currentSlide) {
      await this.showSlide(userId, lessonId, newSlide);
    } else {
      const message = direction === 'next' ? 
        'هذه آخر شريحة!' : 'هذه أول شريحة!';
      
      websocketService.sendToUser(userId, 'navigation_limit', {
        lessonId,
        message
      });
    }
  }
  
  private async repeatCurrentSlide(userId: string, lessonId: string): Promise<void> {
    const flowKey = `${userId}-${lessonId}`;
    const flow = this.activeLessonFlows.get(flowKey);
    
    if (!flow) {
      websocketService.sendToUser(userId, 'ai_response', {
        lessonId,
        message: 'لا يوجد درس نشط حالياً.'
      });
      return;
    }
    
    await this.showSlide(userId, lessonId, flow.currentSlide);
    
    websocketService.sendToUser(userId, 'slide_repeated', {
      lessonId,
      message: 'تم إعادة عرض الشريحة',
      slideNumber: flow.currentSlide + 1
    });
  }
  
  private async pauseLessonFlow(userId: string, lessonId: string): Promise<void> {
    const flowKey = `${userId}-${lessonId}`;
    const flow = this.activeLessonFlows.get(flowKey);
    
    if (flow) {
      flow.isActive = false;
      flow.autoAdvance = false;
      
      websocketService.sendToUser(userId, 'lesson_paused', {
        lessonId,
        message: 'تم إيقاف الدرس مؤقتاً. قل "كمل" للاستمرار.',
        currentSlide: flow.currentSlide + 1,
        totalSlides: flow.totalSlides
      });
    }
  }
  
  private async showHelp(userId: string, lessonId: string): Promise<void> {
    const helpMessage = `
🎯 **الأوامر المتاحة:**

📚 **التحكم في الدرس:**
- "اشرح الدرس" - بدء شرح الدرس من البداية
- "التالي" - الانتقال للشريحة التالية
- "السابق" - العودة للشريحة السابقة
- "أعد" - إعادة الشريحة الحالية
- "توقف" - إيقاف الشرح مؤقتاً

📝 **طلب المحتوى:**
- "مثال" - عرض مثال توضيحي
- "تمرين" - عرض تمرين للحل
- "وضح أكثر" - شرح تفصيلي للنقطة الحالية
- "ملخص" - عرض ملخص الدرس

🎨 **التحكم في العرض:**
- "شريحة عن [الموضوع]" - إنشاء شريحة مخصصة
- "مع صوت" - تفعيل التعليق الصوتي
- "شرائح فقط" - عرض شرائح بدون صوت
- "محادثة فقط" - شرح نصي فقط

🎓 **التقييم:**
- "اختبرني" - بدء اختبار سريع
- "أسئلة" - عرض أسئلة للمراجعة

💬 يمكنك أيضاً طرح أي سؤال عن الدرس وسأجيبك!
    `;
    
    websocketService.sendToUser(userId, 'help_message', {
      lessonId,
      message: helpMessage
    });
  }
  
  // Helper methods remain unchanged...
  private async getLessonDetails(lessonId: string): Promise<any> {
    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          unit: {
            include: {
              subject: true
            }
          },
          concepts: true,
          examples: true
        }
      });
      
      if (!lesson) return null;
      
      const processedLesson = {
        ...lesson,
        objectives: lesson.keyPoints ? 
          (typeof lesson.keyPoints === 'string' ? 
            JSON.parse(lesson.keyPoints) : lesson.keyPoints) : 
          ['فهم المفاهيم الأساسية'],
        keyPoints: lesson.keyPoints ? 
          (typeof lesson.keyPoints === 'string' ? 
            JSON.parse(lesson.keyPoints) : lesson.keyPoints) : [],
        concepts: lesson.concepts || []
      };
      
      return processedLesson;
    } catch (error) {
      console.error('Error getting lesson details:', error);
      return null;
    }
  }
  
  private async generateLessonSlides(lesson: any): Promise<any[]> {
    const slides = [];
    const isMathLesson = lesson.unit?.subject?.name?.includes('رياضيات') || 
                         lesson.unit?.subject?.name?.includes('Math');
    
    slides.push({
      type: 'title',
      content: {
        title: lesson.title || 'عنوان الدرس',
        subtitle: `${lesson.unit?.subject?.name || 'المادة'} - ${lesson.unit?.title || 'الوحدة'}`,
        grade: `الصف ${lesson.unit?.subject?.grade || 6}`,
        text: ''
      }
    });
    
    const objectives = lesson.objectives || 
                      (lesson.keyPoints ? JSON.parse(lesson.keyPoints) : null) ||
                      ['فهم المفاهيم الأساسية', 'التطبيق العملي'];
                      
    slides.push({
      type: 'bullet',
      content: {
        title: 'أهداف الدرس',
        bullets: Array.isArray(objectives) ? objectives : [objectives],
        text: ''
      }
    });
    
    const concepts = lesson.concepts || [];
    if (concepts.length === 0) {
      slides.push({
        type: 'content',
        content: {
          title: 'محتوى الدرس',
          text: lesson.description || lesson.summary || 'شرح تفصيلي للدرس',
          bullets: []
        }
      });
    } else {
      for (const concept of concepts) {
        slides.push({
          type: 'content',
          content: {
            title: concept.name || 'مفهوم',
            text: concept.description || '',
            bullets: []
          }
        });
      }
    }
    
    slides.push({
      type: 'summary',
      content: {
        title: 'ملخص الدرس',
        bullets: lesson.keyPoints ? 
                 (typeof lesson.keyPoints === 'string' ? 
                  JSON.parse(lesson.keyPoints) : lesson.keyPoints) : 
                 ['مراجعة النقاط المهمة'],
        text: ''
      }
    });
    
    return slides;
  }
  
  private async showSlide(
    userId: string,
    lessonId: string,
    slideNumber: number
  ): Promise<void> {
    const flowKey = `${userId}-${lessonId}`;
    const flow = this.activeLessonFlows.get(flowKey);
    
    if (!flow || slideNumber >= flow.slides.length) {
      return;
    }
    
    const slide = flow.slides[slideNumber];
    flow.currentSlide = slideNumber;
    
    let slideHtml = '';
    
    if (slide.type === 'math_example' && slide.content.mathExpression) {
      try {
        slideHtml = await mathSlideGenerator.generateMathSlide({
          title: slide.content.title,
          text: slide.content.problem,
          mathExpressions: [{
            id: 'example',
            latex: slide.content.mathExpression,
            description: slide.content.solution,
            type: 'equation',
            isInteractive: true
          }],
          interactive: true
        });
      } catch (error) {
        console.error('Error generating math slide:', error);
        slideHtml = this.generateFallbackSlide(slide);
      }
    } else {
      const slides = await this.slideGenerator.generateSlides(
        [slide.content],
        'default'
      );
      slideHtml = slides[0] || this.generateFallbackSlide(slide);
    }
    
    websocketService.sendToUser(userId, 'slide_ready', {
      lessonId,
      slideNumber,
      totalSlides: flow.totalSlides,
      slideType: slide.type,
      html: slideHtml,
      content: slide.content,
      navigation: {
        canGoBack: slideNumber > 0,
        canGoForward: slideNumber < flow.totalSlides - 1,
        currentSlide: slideNumber + 1,
        totalSlides: flow.totalSlides
      }
    });
    
    if (flow.autoAdvance && slideNumber < flow.totalSlides - 1) {
      const delay = this.calculateSlideDelay(slide) * (1 / flow.speed);
      setTimeout(() => {
        if (flow.isActive) {
          this.showSlide(userId, lessonId, slideNumber + 1);
        }
      }, delay);
    }
  }
  
  private async saveChatInteraction(
    userId: string,
    lessonId: string,
    userMessage: string,
    aiResponse: string,
    suggestions: string[],
    responseTime: number,
    isStreaming: boolean = false
  ): Promise<void> {
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
  
  private sendErrorResponse(userId: string, lessonId: string): void {
    websocketService.sendToUser(userId, 'ai_response', {
      lessonId,
      message: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى أو قول "مساعدة".',
      suggestions: ['مساعدة', 'اشرح الدرس', 'مثال'],
      timestamp: new Date().toISOString()
    });
  }
  
  private calculateSlideDelay(slide: any): number {
    const baseDelay = {
      title: 5000,
      objectives: 8000,
      content: 10000,
      example: 12000,
      exercise: 15000,
      summary: 10000,
      quiz_intro: 5000
    };
    
    return baseDelay[slide.type as keyof typeof baseDelay] || 10000;
  }
  
  private extractBulletPoints(text: string): string[] {
    const sentences = text.split('.').filter(s => s.trim().length > 0);
    return sentences.slice(0, 5).map(s => s.trim());
  }
  
  private generateFallbackSlide(slide: any): string {
    const content = slide.content || {};
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${content.title || 'شريحة'}</title>
        <style>
          body {
            font-family: 'Cairo', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
          }
          .slide-content {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 800px;
            text-align: center;
          }
          h1 { color: #2d3748; margin-bottom: 20px; }
          p { color: #4a5568; font-size: 1.2em; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="slide-content">
          <h1>${content.title || 'محتوى الشريحة'}</h1>
          <p>${content.text || content.message || 'المحتوى سيظهر هنا'}</p>
        </div>
      </body>
      </html>
    `;
  }
  
  // Fallback للمحادثة بدون templates (الكود الأصلي)
  private async handleNormalChat(
    userId: string,
    lessonId: string,
    message: string
  ): Promise<void> {
    const context = await this.getLessonContext(lessonId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { grade: true, firstName: true }
    });
    
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
    } catch (error) {
      aiResponse = {
        response: this.getFallbackResponse(message, user?.firstName || 'الطالب'),
        suggestions: this.getDefaultSuggestions()
      };
    }
    
    websocketService.sendToUser(userId, 'ai_response', {
      lessonId,
      message: aiResponse.response,
      suggestions: aiResponse.suggestions || this.getDefaultSuggestions(),
      timestamp: new Date().toISOString()
    });
    
    await this.saveChatInteraction(
      userId,
      lessonId,
      message,
      aiResponse.response,
      aiResponse.suggestions || [],
      Date.now()
    );
  }
  
  private async getLessonContext(lessonId: string): Promise<any> {
    const lesson = await this.getLessonDetails(lessonId);
    if (!lesson) return null;
    
    return {
      subject: lesson.unit.subject.name,
      unit: lesson.unit.title,
      lesson: lesson.title,
      learningObjectives: lesson.objectives
    };
  }
  
  private getFallbackResponse(message: string, userName: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('مرحبا') || lowerMessage.includes('السلام')) {
      return `أهلاً وسهلاً ${userName}! أنا مدرسك الذكي. قل "اشرح الدرس" لنبدأ، أو اسأل أي سؤال.`;
    }
    
    if (lowerMessage.includes('شرح') || lowerMessage.includes('اشرح')) {
      return 'قل "اشرح الدرس" لأبدأ في شرح الدرس بالشرائح التفاعلية، أو اسأل عن نقطة محددة.';
    }
    
    return `شكراً لسؤالك "${message}". يمكنك قول "اشرح الدرس" للبدء، أو "مساعدة" لمعرفة الأوامر المتاحة.`;
  }
  
  private getDefaultSuggestions(): string[] {
    return [
      'اشرح الدرس',
      'أعطني مثال',
      'اختبرني بسؤال',
      'ما هي النقاط المهمة؟',
      'مساعدة'
    ];
  }
  
  // Streaming support
  async streamResponse(
    userId: string,
    lessonId: string,
    message: string
  ) {
    try {
      websocketService.sendToUser(userId, 'stream_start', { lessonId });
      
      const context = await this.buildPromptContext(lessonId, userId, message);
      const chatPrompt = getChatResponsePrompt(context);
      
      // هنا يمكن استخدام streaming API من OpenAI
      const fullResponse = await openAIService.chat([
        { role: 'system', content: chatPrompt },
        { role: 'user', content: message }
      ]);
      
      const words = fullResponse.split(' ');
      let accumulated = '';
      
      for (const word of words) {
        accumulated += word + ' ';
        
        websocketService.sendToUser(userId, 'stream_chunk', {
          lessonId,
          chunk: word + ' ',
          accumulated: accumulated.trim()
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      websocketService.sendToUser(userId, 'stream_end', {
        lessonId,
        fullResponse: accumulated.trim()
      });
      
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
}

export const realtimeChatService = new RealtimeChatService();