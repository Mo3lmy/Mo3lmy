// 📍 المكان: src/services/websocket/realtime-chat.service.ts
// الوظيفة: مدرس ذكي متكامل مع Flow Manager و Prompt Templates

import { websocketService } from './websocket.service';
import { chatService } from '../ai/chat.service';
import { sessionService } from './session.service';
import { lessonFlowManager, FlowState } from '../flow/lesson-flow-manager.service';
import { lessonOrchestrator } from '../orchestrator/lesson-orchestrator.service';
import { mathSlideGenerator } from '../../core/video/enhanced-slide.generator';
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

// ============= ENHANCED CHAT SERVICE WITH FLOW MANAGER =============

export class RealtimeChatService {
  private slideGenerator: EnhancedSlideGenerator;
  
  constructor() {
    this.slideGenerator = new EnhancedSlideGenerator();
  }

  /**
   * معالجة رسالة من المستخدم مع Flow Manager
   */
  async handleUserMessage(
    userId: string,
    lessonId: string,
    message: string,
    socketId: string
  ) {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Processing chat message with Flow Manager: "${message}"`);
      
      // 1. إرسال إشعار "typing"
      websocketService.sendToUser(userId, 'ai_typing', {
        lessonId,
        status: 'typing'
      });
      
      // 2. التحقق من وجود flow نشط
      let flow = lessonFlowManager.getFlow(userId, lessonId);
      const flowState = lessonFlowManager.getFlowState(userId, lessonId);
      
      // 3. إذا لم يكن هناك flow، اكتشف إذا كان يريد بدء الدرس
      if (!flow) {
        const action = await this.detectAction(message, lessonId);
        if (action.type === 'start_lesson' && action.confidence > 0.7) {
          // بدء درس جديد عبر Flow Manager
          const session = await sessionService.getOrCreateSession(userId, lessonId, socketId);
          flow = await lessonFlowManager.createFlow(userId, lessonId, session.id, {
            startWithChat: true
          });
          return; // Flow Manager will handle the rest
        } else {
          // رد بدون flow
          await this.handleChatWithoutFlow(userId, lessonId, message);
          return;
        }
      }
      
      // 4. معالجة الرسالة حسب الحالة الحالية
      if (flowState === FlowState.WAITING_FOR_MODE || flowState === FlowState.WAITING_FOR_CHOICE) {
        // دع Flow Manager يعالج الاختيار
        await lessonFlowManager.handleUserMessage(userId, lessonId, message);
        return;
      }
      
      // 5. كشف الأوامر في الرسالة
      const action = await this.detectAction(message, lessonId);
      
      // 6. تنفيذ الأمر أو معالجته كسؤال
      if (action.confidence > 0.7) {
        await this.executeActionWithFlowManager(action, userId, lessonId, message);
      } else {
        // معالجة كرسالة عادية عبر Flow Manager
        await lessonFlowManager.handleUserMessage(userId, lessonId, message);
        
        // إرسال رد AI
        await this.sendAIResponseWithTemplate(userId, lessonId, message);
      }
      
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
   * تنفيذ الأمر مع Flow Manager
   */
  private async executeActionWithFlowManager(
    action: ChatAction,
    userId: string,
    lessonId: string,
    originalMessage: string
  ): Promise<void> {
    console.log(`⚡ Executing action with Flow Manager: ${action.type}`);
    
    const flow = lessonFlowManager.getFlow(userId, lessonId);
    if (!flow && action.type !== 'start_lesson') {
      await this.handleChatWithoutFlow(userId, lessonId, originalMessage);
      return;
    }
    
    switch (action.type) {
      case 'show_slide':
        // Transition to showing slide
        await lessonFlowManager.transition(userId, lessonId, 'user_question', {
          question: originalMessage,
          action: 'show_slide'
        });
        await this.generateAndShowSlideWithTemplate(userId, lessonId, originalMessage, action.parameters);
        break;
        
      case 'explain':
        // Transition to explaining
        await lessonFlowManager.transition(userId, lessonId, 'user_question', {
          question: originalMessage,
          action: 'explain'
        });
        await this.explainConceptWithTemplate(userId, lessonId, action.parameters?.topic || 'current');
        break;
        
      case 'example':
        // Transition to showing example
        await lessonFlowManager.transition(userId, lessonId, 'user_question', {
          question: originalMessage,
          action: 'example'
        });
        await this.showExampleWithTemplate(userId, lessonId, action.parameters?.topic);
        break;
        
      case 'exercise':
      case 'quiz':
        // Transition to quiz mode
        await lessonFlowManager.transition(userId, lessonId, 'start_quiz');
        await this.showExerciseWithTemplate(userId, lessonId, action.parameters);
        break;
        
      case 'next':
      case 'previous':
        // Navigation through orchestrator
        await this.navigateSlide(userId, lessonId, action.type);
        break;
        
      case 'stop':
        // Pause through Flow Manager
        await lessonFlowManager.transition(userId, lessonId, 'pause');
        break;
        
      case 'summary':
        await this.showLessonSummaryWithTemplate(userId, lessonId);
        break;
        
      case 'help':
        await this.showHelp(userId, lessonId);
        break;
        
      default:
        await this.sendAIResponseWithTemplate(userId, lessonId, originalMessage);
    }
    
    // Return to appropriate state after action
    if (flow && action.type !== 'quiz' && action.type !== 'stop') {
      setTimeout(async () => {
        await lessonFlowManager.transition(userId, lessonId, 'answer_complete');
      }, 2000);
    }
  }
  
  /**
   * بناء السياق للـ Templates من Flow Manager
   */
  private async buildPromptContext(
    lessonId: string,
    userId: string,
    userMessage?: string
  ): Promise<PromptContext> {
    // الحصول على Flow من Flow Manager
    const flow = lessonFlowManager.getFlow(userId, lessonId);
    
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

    // بناء السياق من Flow Manager data
    const context: PromptContext = {
      lessonTitle: flow?.lessonTitle || lesson.titleAr || lesson.title,
      subject: flow?.subjectName || lesson.unit.subject.nameAr || lesson.unit.subject.name,
      grade: flow?.grade || lesson.unit.subject.grade,
      currentSection: flow ? flow.sections[flow.currentSection]?.title : undefined,
      currentSlide: flow?.currentSlide || 0,
      comprehensionLevel: flow?.comprehensionLevel || 75,
      userMessage,
      conversationHistory: flow?.conversationState.messageHistory
        .slice(-5)
        .map(msg => `${msg.role === 'user' ? 'الطالب' : 'المساعد'}: ${msg.content}`) || [],
      isMathLesson: flow?.isMathLesson || 
                   lesson.unit.subject.name.includes('رياضيات') || 
                   lesson.unit.subject.name.toLowerCase().includes('math')
    };

    return context;
  }
  
  /**
   * إرسال رد AI مع Template
   */
  private async sendAIResponseWithTemplate(
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
        Date.now() - Date.now() // Calculate actual response time
      );
      
    } catch (error) {
      console.error('Error sending AI response:', error);
      await this.handleChatWithoutFlow(userId, lessonId, message);
    }
  }
  
  /**
   * معالجة محادثة بدون Flow نشط
   */
  private async handleChatWithoutFlow(
    userId: string,
    lessonId: string,
    message: string
  ): Promise<void> {
    // محاولة الحصول على معلومات الدرس
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
      websocketService.sendToUser(userId, 'ai_response', {
        lessonId,
        message: 'عذراً، لم أتمكن من العثور على الدرس. تأكد من اختيار درس صحيح.',
        suggestions: ['العودة للقائمة', 'مساعدة']
      });
      return;
    }
    
    // رد بسيط بدون flow
    const response = `مرحباً! أنا مدرسك الذكي لدرس "${lesson.title}". 
قل "اشرح الدرس" لنبدأ رحلة التعلم معاً، أو اسأل أي سؤال عن ${lesson.unit.subject.name}.`;
    
    websocketService.sendToUser(userId, 'ai_response', {
      lessonId,
      message: response,
      suggestions: ['اشرح الدرس', 'أعطني نبذة', 'ما أهمية هذا الدرس؟', 'مساعدة']
    });
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
      const context = await this.buildPromptContext(lessonId, userId, message);
      const slideType = params.type || 'content';
      
      const slidePrompt = getSlideGenerationPrompt(context, slideType);
      const slideContentJson = await openAIService.chat([
        { role: 'system', content: slidePrompt }
      ], {
        temperature: 0.7,
        maxTokens: 400
      });
      
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
      
      const slides = await this.slideGenerator.generateSlides(
        [slideData],
        'default'
      );
      const slideHtml = slides[0] || this.generateFallbackSlide({ 
        type: 'custom', 
        content: slideData 
      });
      
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
      const context = await this.buildPromptContext(lessonId, userId);
      context.currentSection = topic;
      
      const explainPrompt = getExplanationPrompt(context);
      const explanation = await openAIService.chat([
        { role: 'system', content: explainPrompt }
      ], {
        temperature: 0.6,
        maxTokens: 800
      });
      
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
      
      websocketService.sendToUser(userId, 'explanation_slide', {
        lessonId,
        html: slideHtml,
        topic,
        message: 'إليك شرح تفصيلي'
      });
      
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
      const context = await this.buildPromptContext(lessonId, userId);
      if (topic) context.currentSection = topic;
      
      const examplePrompt = getExamplePrompt(context);
      const exampleContent = await openAIService.chat([
        { role: 'system', content: examplePrompt }
      ], {
        temperature: 0.7,
        maxTokens: 600
      });
      
      if (context.isMathLesson) {
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
   * إرسال مثال عادي
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
      const context = await this.buildPromptContext(lessonId, userId);
      
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
   * عرض ملخص الدرس
   */
  private async showLessonSummaryWithTemplate(userId: string, lessonId: string): Promise<void> {
    try {
      const context = await this.buildPromptContext(lessonId, userId);
      
      const completionPrompt = getLessonCompletionPrompt(context);
      const summaryMessage = await openAIService.chat([
        { role: 'system', content: completionPrompt }
      ], {
        temperature: 0.6,
        maxTokens: 500
      });
      
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
   * التنقل بين الشرائح
   */
  private async navigateSlide(
    userId: string,
    lessonId: string,
    direction: 'next' | 'previous'
  ): Promise<void> {
    const flow = lessonFlowManager.getFlow(userId, lessonId);
    
    if (!flow) {
      websocketService.sendToUser(userId, 'ai_response', {
        lessonId,
        message: 'لم يبدأ الدرس بعد. قل "اشرح الدرس" للبدء.'
      });
      return;
    }
    
    // Use orchestrator for navigation (it manages slides)
    const slide = direction === 'next' 
      ? await lessonOrchestrator.navigateNext(userId, lessonId)
      : await lessonOrchestrator.navigatePrevious(userId, lessonId);
    
    if (!slide) {
      const message = direction === 'next' ? 
        'هذه آخر شريحة!' : 'هذه أول شريحة!';
      
      websocketService.sendToUser(userId, 'navigation_limit', {
        lessonId,
        message
      });
    }
  }
  
  /**
   * عرض المساعدة
   */
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
  
  /**
   * حفظ تفاعل المحادثة
   */
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
  
  /**
   * إرسال رد خطأ
   */
  private sendErrorResponse(userId: string, lessonId: string): void {
    websocketService.sendToUser(userId, 'ai_response', {
      lessonId,
      message: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى أو قول "مساعدة".',
      suggestions: ['مساعدة', 'اشرح الدرس', 'مثال'],
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * استخراج النقاط الرئيسية
   */
  private extractBulletPoints(text: string): string[] {
    const sentences = text.split('.').filter(s => s.trim().length > 0);
    return sentences.slice(0, 5).map(s => s.trim());
  }
  
  /**
   * توليد شريحة fallback
   */
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
  
  /**
   * Streaming support
   */
  async streamResponse(
    userId: string,
    lessonId: string,
    message: string
  ) {
    try {
      websocketService.sendToUser(userId, 'stream_start', { lessonId });
      
      const context = await this.buildPromptContext(lessonId, userId, message);
      const chatPrompt = getChatResponsePrompt(context);
      
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