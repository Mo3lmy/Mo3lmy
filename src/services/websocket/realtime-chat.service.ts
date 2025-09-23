// 📍 المكان: src/services/websocket/realtime-chat.service.ts
// الوظيفة: مدرس ذكي متكامل - يفهم الأوامر ويولد الشرائح ويتحكم في الدرس

import { websocketService } from './websocket.service';
import { chatService } from '../ai/chat.service';
import { sessionService } from './session.service';
import { lessonOrchestrator } from '../orchestrator/lesson-orchestrator.service';
import { mathSlideGenerator, MathEnabledSlideGenerator } from '../../core/video/enhanced-slide.generator';
import { EnhancedSlideGenerator } from '../../core/video/slide.generator';
import { prisma } from '../../config/database.config';
import { latexRenderer } from '../../core/interactive/math/latex-renderer';

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
  speed: number; // سرعة الشرح
}

// ============= ENHANCED CHAT SERVICE =============

export class RealtimeChatService {
  private slideGenerator: EnhancedSlideGenerator;
  private activeLessonFlows: Map<string, LessonFlowState> = new Map();
  
  constructor() {
    this.slideGenerator = new EnhancedSlideGenerator();
  }

  /**
   * معالجة رسالة من المستخدم مع Action Detection
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
        return; // Action تم تنفيذه، لا نحتاج رد عادي
      }
      
      // 4. إذا لم يكن أمر، تعامل معه كسؤال عادي
      await this.handleNormalChat(userId, lessonId, message);
      
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
   * تنفيذ الأمر المكتشف
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
        await this.startLessonFlow(userId, lessonId, action.parameters);
        break;
        
      case 'show_slide':
        await this.generateAndShowSlide(userId, lessonId, originalMessage, action.parameters);
        break;
        
      case 'explain':
        await this.explainConcept(userId, lessonId, action.parameters?.topic || 'current');
        break;
        
      case 'example':
        await this.showExample(userId, lessonId, action.parameters?.topic);
        break;
        
      case 'exercise':
        await this.showExercise(userId, lessonId, action.parameters);
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
        await this.showLessonSummary(userId, lessonId);
        break;
        
      case 'quiz':
        await this.startQuiz(userId, lessonId);
        break;
        
      case 'help':
        await this.showHelp(userId, lessonId);
        break;
        
      default:
        await this.handleNormalChat(userId, lessonId, originalMessage);
    }
  }
  
  /**
   * بدء تدفق الدرس الكامل
   */
  private async startLessonFlow(
    userId: string, 
    lessonId: string,
    params: any = {}
  ): Promise<void> {
    try {
      // جلب معلومات الدرس
      const lesson = await this.getLessonDetails(lessonId);
      if (!lesson) {
        throw new Error('Lesson not found');
      }
      
      // إرسال نظرة عامة على الدرس
      const overview = `
🎯 **درس: ${lesson.title}**
📚 المادة: ${lesson.unit.subject.name}
📖 الوحدة: ${lesson.unit.title}

📋 **أهداف الدرس:**
${lesson.objectives.map((obj: string, i: number) => `${i + 1}. ${obj}`).join('\n')}

⏱️ المدة المتوقعة: ${lesson.estimatedMinutes || 45} دقيقة
📊 عدد الشرائح: ${lesson.concepts.length * 3} شريحة تقريباً

🎬 سأبدأ الآن في عرض الدرس بالتفصيل...
      `;
      
      websocketService.sendToUser(userId, 'lesson_overview', {
        lessonId,
        message: overview,
        lesson: {
          title: lesson.title,
          objectives: lesson.objectives,
          concepts: lesson.concepts,
          estimatedSlides: lesson.concepts.length * 3
        }
      });
      
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
        speed: params.speed || 1
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
      
      // إذا كان الصوت مفعل، ابدأ التعليق الصوتي
      if (flow.voiceEnabled) {
        await this.startVoiceNarration(userId, lessonId, 0);
      }
      
      console.log(`✅ Lesson flow started: ${flow.totalSlides} slides`);
      
    } catch (error) {
      console.error('Error starting lesson flow:', error);
      websocketService.sendToUser(userId, 'error', {
        message: 'حدث خطأ في بدء الدرس. دعني أحاول بطريقة أخرى.'
      });
    }
  }
  
  /**
   * توليد شرائح الدرس
   */
  private async generateLessonSlides(lesson: any): Promise<any[]> {
  const slides = [];
  const isMathLesson = lesson.unit?.subject?.name?.includes('رياضيات') || 
                       lesson.unit?.subject?.name?.includes('Math');
  
  // 1. شريحة العنوان - مع التأكد من وجود البيانات
  slides.push({
    type: 'title',
    content: {
      title: lesson.title || 'عنوان الدرس',
      subtitle: `${lesson.unit?.subject?.name || 'المادة'} - ${lesson.unit?.title || 'الوحدة'}`,
      grade: `الصف ${lesson.unit?.subject?.grade || 6}`,
      text: '' // مهم: إضافة text فارغ
    }
  });
  
  // 2. شريحة الأهداف - مع معالجة الـ objectives
  const objectives = lesson.objectives || 
                    (lesson.keyPoints ? JSON.parse(lesson.keyPoints) : null) ||
                    ['فهم المفاهيم الأساسية', 'التطبيق العملي'];
                    
  slides.push({
    type: 'bullet',
    content: {
      title: 'أهداف الدرس',
      bullets: Array.isArray(objectives) ? objectives : [objectives],
      text: '' // مهم: إضافة text فارغ
    }
  });
  
  // 3. شرائح المحتوى - مع معالجة البيانات الناقصة
  const concepts = lesson.concepts || [];
  if (concepts.length === 0) {
    // إذا لم توجد concepts، أضف شريحة محتوى عامة
    slides.push({
      type: 'content',
      content: {
        title: 'محتوى الدرس',
        text: lesson.description || lesson.summary || 'شرح تفصيلي للدرس',
        bullets: [] // إضافة bullets فارغة
      }
    });
  } else {
    // باقي الكود كما هو للـ concepts
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
  
  // 4. شريحة الملخص
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
  
  /**
   * عرض شريحة محددة
   */
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
    
    // توليد HTML للشريحة
    let slideHtml = '';
    
    // استخدم math slide generator للشرائح الرياضية
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
      // استخدم الـ generator العادي
      // generateSlides يرجع array، نأخذ أول شريحة
      const slides = await this.slideGenerator.generateSlides(
        [slide.content],
        'default'
      );
      slideHtml = slides[0] || this.generateFallbackSlide(slide);
    }
    
    // إرسال الشريحة للمستخدم
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
    
    // إذا كان auto-advance مفعل، انتقل للتالية بعد فترة
    if (flow.autoAdvance && slideNumber < flow.totalSlides - 1) {
      const delay = this.calculateSlideDelay(slide) * (1 / flow.speed);
      setTimeout(() => {
        if (flow.isActive) {
          this.showSlide(userId, lessonId, slideNumber + 1);
        }
      }, delay);
    }
  }
  
  /**
   * توليد وعرض شريحة حسب الطلب
   */
  private async generateAndShowSlide(
    userId: string,
    lessonId: string,
    message: string,
    params: any
  ): Promise<void> {
    // تحليل المحتوى المطلوب
    const content = this.extractSlideContent(message);
    
    // توليد الشريحة - استخدام generateSlides
    const slides = await this.slideGenerator.generateSlides(
      [content],
      'default'
    );
    const slideHtml = slides[0] || this.generateFallbackSlide({ type: 'custom', content });
    
    // إرسال الشريحة
    websocketService.sendToUser(userId, 'custom_slide', {
      lessonId,
      html: slideHtml,
      message: 'تم إنشاء الشريحة حسب طلبك!'
    });
  }
  
  /**
   * شرح مفهوم معين
   */
  private async explainConcept(
    userId: string,
    lessonId: string,
    topic: string
  ): Promise<void> {
    // جلب شرح من AI
    const explanation = await this.getAIExplanation(lessonId, topic);
    
    // إنشاء شريحة شرح
    const slides = await this.slideGenerator.generateSlides(
      [{
        title: `شرح: ${topic}`,
        text: explanation,
        bulletPoints: this.extractBulletPoints(explanation)
      }],
      'default'
    );
    const slideHtml = slides[0] || this.generateFallbackSlide({ 
      type: 'explanation', 
      content: { title: `شرح: ${topic}`, text: explanation } 
    });
    
    websocketService.sendToUser(userId, 'explanation_slide', {
      lessonId,
      html: slideHtml,
      topic,
      message: 'إليك شرح تفصيلي'
    });
  }
  
  /**
   * عرض مثال
   */
  private async showExample(
    userId: string,
    lessonId: string,
    topic?: string
  ): Promise<void> {
    const lesson = await this.getLessonDetails(lessonId);
    const isMath = lesson?.unit.subject.name.includes('رياضيات');
    
    if (isMath) {
      // مثال رياضي تفاعلي
      const mathExample = {
        id: 'example1',
        latex: 'x^2 - 5x + 6 = 0',
        description: 'معادلة تربيعية بسيطة',
        type: 'equation' as const,
        isInteractive: true,
        steps: [
          { stepNumber: 1, latex: 'x^2 - 5x + 6 = 0', explanation: 'المعادلة الأصلية', highlight: [] },
          { stepNumber: 2, latex: '(x - 2)(x - 3) = 0', explanation: 'تحليل المعادلة', highlight: [] },
          { stepNumber: 3, latex: 'x = 2 \\text{ أو } x = 3', explanation: 'الحلول', highlight: [] }
        ]
      };
      
      const slideHtml = await mathSlideGenerator.generateMathSlide({
        title: 'مثال تطبيقي',
        mathExpressions: [mathExample],
        showSteps: true,
        interactive: true
      });
      
      websocketService.sendToUser(userId, 'example_slide', {
        lessonId,
        html: slideHtml,
        type: 'math',
        message: 'مثال تفاعلي - يمكنك التفاعل مع المعادلة!'
      });
    } else {
      // مثال عادي للمواد الأخرى
      await this.handleNormalChat(userId, lessonId, 'أعطني مثال');
    }
  }
  
  /**
   * عرض تمرين
   */
  private async showExercise(
    userId: string,
    lessonId: string,
    params: any
  ): Promise<void> {
    const lesson = await this.getLessonDetails(lessonId);
    const isMath = lesson?.unit.subject.name.includes('رياضيات');
    
    if (isMath) {
      // تمرين رياضي
      const problem = {
        title: 'تمرين',
        question: 'حل المعادلة التالية:',
        equation: '2x + 8 = 20',
        hints: ['اطرح 8 من الطرفين', 'اقسم على 2'],
        solution: 'x = 6'
      };
      
      const slideHtml = await mathSlideGenerator.generateMathProblemSlide(problem);
      
      websocketService.sendToUser(userId, 'exercise_slide', {
        lessonId,
        html: slideHtml,
        type: 'math_problem',
        message: 'حاول حل هذا التمرين!'
      });
    } else {
      // تمرين عادي
      const exercise = {
        question: 'اذكر ثلاث نقاط مهمة من الدرس',
        type: 'open_ended'
      };
      
      websocketService.sendToUser(userId, 'exercise', {
        lessonId,
        exercise,
        message: 'تمرين للمراجعة'
      });
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
  
  /**
   * إعادة الشريحة الحالية
   */
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
    
    // إعادة عرض الشريحة الحالية
    await this.showSlide(userId, lessonId, flow.currentSlide);
    
    // إعادة التعليق الصوتي إذا كان مفعلاً
    if (flow.voiceEnabled) {
      await this.startVoiceNarration(userId, lessonId, flow.currentSlide);
    }
    
    websocketService.sendToUser(userId, 'slide_repeated', {
      lessonId,
      message: 'تم إعادة عرض الشريحة',
      slideNumber: flow.currentSlide + 1
    });
  }
  
  /**
   * إيقاف الدرس مؤقتاً
   */
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
  
  /**
   * عرض ملخص الدرس
   */
  private async showLessonSummary(userId: string, lessonId: string): Promise<void> {
    const lesson = await this.getLessonDetails(lessonId);
    
    if (!lesson) return;
    
    const summary = {
      title: 'ملخص الدرس',
      lessonTitle: lesson.title,
      keyPoints: lesson.keyPoints || [],
      concepts: lesson.concepts.map((c: any) => c.name),
      nextSteps: 'مراجعة التمارين والاستعداد للاختبار'
    };
    
    const slides = await this.slideGenerator.generateSlides(
      [summary],
      'default'
    );
    const slideHtml = slides[0] || this.generateFallbackSlide({ 
      type: 'summary', 
      content: summary 
    });
    
    websocketService.sendToUser(userId, 'summary_slide', {
      lessonId,
      html: slideHtml,
      summary,
      message: 'إليك ملخص شامل للدرس'
    });
  }
  
  /**
   * بدء اختبار تقييمي
   */
  private async startQuiz(userId: string, lessonId: string): Promise<void> {
    websocketService.sendToUser(userId, 'quiz_start', {
      lessonId,
      message: 'سأبدأ اختبار سريع من 5 أسئلة. مستعد؟',
      instructions: 'أجب على كل سؤال واحصل على النتيجة فوراً'
    });
    
    // يمكن ربطه مع quiz service لاحقاً
  }
  
  /**
   * عرض المساعدة والأوامر المتاحة
   */
  private async showHelp(userId: string, lessonId: string): Promise<void> {
    const helpMessage = `
🎯 **الأوامر المتاحة:**

📚 **التحكم في الدرس:**
• "اشرح الدرس" - بدء شرح الدرس من البداية
• "التالي" - الانتقال للشريحة التالية
• "السابق" - العودة للشريحة السابقة
• "أعد" - إعادة الشريحة الحالية
• "توقف" - إيقاف الشرح مؤقتاً

📝 **طلب المحتوى:**
• "مثال" - عرض مثال توضيحي
• "تمرين" - عرض تمرين للحل
• "وضح أكثر" - شرح تفصيلي للنقطة الحالية
• "ملخص" - عرض ملخص الدرس

🎨 **التحكم في العرض:**
• "شريحة عن [الموضوع]" - إنشاء شريحة مخصصة
• "مع صوت" - تفعيل التعليق الصوتي
• "شرائح فقط" - عرض شرائح بدون صوت
• "محادثة فقط" - شرح نصي فقط

🎓 **التقييم:**
• "اختبرني" - بدء اختبار سريع
• "أسئلة" - عرض أسئلة للمراجعة

💬 يمكنك أيضاً طرح أي سؤال عن الدرس وسأجيبك!
    `;
    
    websocketService.sendToUser(userId, 'help_message', {
      lessonId,
      message: helpMessage,
      commands: [
        { command: 'اشرح الدرس', description: 'بدء الشرح' },
        { command: 'مثال', description: 'عرض مثال' },
        { command: 'تمرين', description: 'عرض تمرين' },
        { command: 'ملخص', description: 'ملخص الدرس' }
      ]
    });
  }
  
  /**
   * التعامل مع المحادثة العادية (غير الأوامر)
   */
  private async handleNormalChat(
    userId: string,
    lessonId: string,
    message: string
  ): Promise<void> {
    // الكود الأصلي للـ chat
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
    
    // حفظ في قاعدة البيانات
    await this.saveChatInteraction(
      userId,
      lessonId,
      message,
      aiResponse.response,
      aiResponse.suggestions || [],
      Date.now()
    );
  }
  
  /**
   * بدء التعليق الصوتي (تحضير لـ ElevenLabs)
   */
  private async startVoiceNarration(
    userId: string,
    lessonId: string,
    slideNumber: number
  ): Promise<void> {
    // TODO: سيتم تنفيذه مع ElevenLabs
    console.log(`🎤 Voice narration prepared for slide ${slideNumber}`);
    
    // مؤقتاً: إرسال إشعار فقط
    websocketService.sendToUser(userId, 'voice_status', {
      lessonId,
      slideNumber,
      status: 'ready',
      message: 'التعليق الصوتي جاهز (سيتم تفعيله قريباً)'
    });
  }
  
  // =============== Helper Functions (من الكود الأصلي) ===============
  
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
      
      // معالجة البيانات
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
  
  private calculateSlideDelay(slide: any): number {
    // حساب الوقت حسب نوع الشريحة
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
  
  private extractSlideContent(message: string): any {
    // استخراج المحتوى من الرسالة لإنشاء شريحة
    return {
      title: 'شريحة مخصصة',
      text: message,
      bulletPoints: []
    };
  }
  
  private extractBulletPoints(text: string): string[] {
    // تحويل النص لنقاط
    const sentences = text.split('.').filter(s => s.trim().length > 0);
    return sentences.slice(0, 5).map(s => s.trim());
  }
  
  private async getAIExplanation(lessonId: string, topic: string): Promise<string> {
    // جلب شرح من AI
    try {
      const response = await chatService.processMessage(
        `اشرح ${topic} بالتفصيل`,
        await this.getLessonContext(lessonId),
        'system'
      );
      return response.response;
    } catch {
      return `${topic} هو مفهوم مهم في هذا الدرس. دعني أوضح لك بالتفصيل...`;
    }
  }
  
  private sendErrorResponse(userId: string, lessonId: string): void {
    websocketService.sendToUser(userId, 'ai_response', {
      lessonId,
      message: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى أو قول "مساعدة".',
      suggestions: this.getDefaultSuggestions(),
      timestamp: new Date().toISOString()
    });
  }
  
  // =============== Streaming Support (من الكود الأصلي) ===============
  
  async streamResponse(
    userId: string,
    lessonId: string,
    message: string
  ) {
    try {
      websocketService.sendToUser(userId, 'stream_start', { lessonId });
      
      const context = await this.getLessonContext(lessonId);
      const fullResponse = await this.getStreamedResponse(message, context);
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
  
  private async getStreamedResponse(message: string, context: any): Promise<string> {
    const response = `هذا رد تفصيلي على سؤالك: "${message}". `;
    
    if (context) {
      return response + `في درس ${context.lesson} من وحدة ${context.unit}، نتعلم مفاهيم مهمة جداً. دعني أشرح لك بالتفصيل...`;
    }
    
    return response + 'دعني أساعدك في فهم هذا الموضوع خطوة بخطوة...';
  }
  
  /**
   * توليد شريحة احتياطية في حالة الفشل
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
}

export const realtimeChatService = new RealtimeChatService();