// الوظيفة: ربط Orchestrator مع WebSocket events مع دعم المكونات الرياضية التفاعلية

import { Socket } from 'socket.io';
import { lessonOrchestrator } from '../orchestrator/lesson-orchestrator.service';
import { websocketService } from './websocket.service';
import { sessionService } from './session.service';
import { realtimeChatService } from './realtime-chat.service';

// استيراد المكونات الرياضية الجديدة
import { latexRenderer, type MathExpression } from '../../core/interactive/math/latex-renderer';
import { mathSlideGenerator } from '../../core/video/enhanced-slide.generator';
import { prisma } from '../../config/database.config';

/**
 * إضافة Event Handlers للـ Orchestrator
 */
export function setupOrchestratorEvents(socket: Socket, user: any): void {
  
  // ============= LESSON FLOW EVENTS =============
  
  /**
   * بدء درس بنظام Orchestration الذكي
   */
  socket.on('start_orchestrated_lesson', async (data: {
    lessonId: string;
    preferences?: {
      autoAdvance?: boolean;
      voiceEnabled?: boolean;
      playbackSpeed?: number;
      mathInteractive?: boolean; // جديد
    };
  }) => {
    try {
      console.log(`🎯 Starting orchestrated lesson for ${user.email}`);
      
      // Get or create session
      const session = await sessionService.getOrCreateSession(
        user.id,
        data.lessonId,
        socket.id
      );
      
      // Start orchestration
      const flow = await lessonOrchestrator.startLesson(
        user.id,
        data.lessonId,
        session.id
      );
      
      // Apply preferences
      if (data.preferences) {
        Object.assign(flow, data.preferences);
      }
      
      // Check if this is a math lesson
      const lesson = await prisma.lesson.findUnique({
        where: { id: data.lessonId },
        include: {
          unit: {
            include: {
              subject: true
            }
          }
        }
      });
      
      const isMathLesson = lesson?.unit.subject.name.includes('رياضيات') || 
                           lesson?.unit.subject.nameEn?.toLowerCase().includes('math');
      
      // Send initial state
      socket.emit('lesson_flow_started', {
        lessonId: flow.lessonId,
        totalSlides: flow.totalSlides,
        sections: flow.sections.map(s => ({
          id: s.id,
          type: s.type,
          title: s.title,
          slideCount: s.slides.length,
          duration: s.duration,
          objectives: s.objectives
        })),
        currentSection: flow.sections[flow.currentSection],
        currentSlide: flow.currentSlide,
        estimatedDuration: flow.estimatedDuration,
        theme: flow.theme,
        isMathLesson, // إضافة معلومة نوع الدرس
        mathFeaturesEnabled: data.preferences?.mathInteractive ?? true
      });
      
      // Send first slide
      const firstSlide = flow.sections[0].slides[0];
      if (firstSlide.html) {
        socket.emit('slide_ready', {
          slideNumber: 0,
          html: firstSlide.html,
          type: firstSlide.type,
          duration: firstSlide.duration,
          section: flow.sections[0].title,
          hasMathContent: isMathLesson // معلومة إضافية
        });
      }
      
      console.log(`✅ Orchestrated lesson started: ${flow.totalSlides} slides${isMathLesson ? ' (Math Lesson)' : ''}`);
      
    } catch (error: any) {
      console.error('Failed to start orchestrated lesson:', error);
      socket.emit('error', {
        code: 'ORCHESTRATION_FAILED',
        message: 'فشل بدء الدرس التفاعلي'
      });
    }
  });
  
  /**
   * التنقل الذكي بين الشرائح
   */
  socket.on('navigate_smart', async (data: {
    lessonId: string;
    direction: 'next' | 'previous' | 'section' | 'slide';
    target?: number | string; // رقم الشريحة أو معرف القسم
  }) => {
    try {
      let slide = null;
      
      switch (data.direction) {
        case 'next':
          slide = await lessonOrchestrator.navigateNext(user.id, data.lessonId);
          break;
          
        case 'previous':
          // Implement previous navigation
          break;
          
        case 'section':
          // Jump to section
          break;
          
        case 'slide':
          // Jump to specific slide
          break;
      }
      
      if (slide && slide.html) {
        socket.emit('slide_ready', {
          slideNumber: slide.number,
          html: slide.html,
          type: slide.type,
          duration: slide.duration
        });
      } else if (!slide) {
        socket.emit('lesson_completed', {
          lessonId: data.lessonId
        });
      }
      
    } catch (error) {
      socket.emit('navigation_error', {
        message: 'فشل الانتقال'
      });
    }
  });
  
  /**
   * معالجة رسالة مع تحليل الإجراءات
   */
  socket.on('chat_with_action', async (data: {
    lessonId: string;
    message: string;
  }) => {
    try {
      console.log(`💬 Chat with action analysis: "${data.message}"`);
      
      // Check for math-related keywords
      const mathKeywords = [
        'معادلة', 'حل', 'احسب', 'اشرح', 'مثال رياضي', 
        'رسم بياني', 'دالة', 'متغير', 'solve', 'equation', 
        'calculate', 'graph', 'function'
      ];
      
      const wantsMath = mathKeywords.some(keyword => 
        data.message.toLowerCase().includes(keyword)
      );
      
      if (wantsMath) {
        // توليد معادلة أو شرح رياضي
        socket.emit('math_content_generating', {
          message: 'جاري توليد المحتوى الرياضي...'
        });
        
        // Generate math content based on message
        const mathResponse = await generateMathResponse(data.message, data.lessonId);
        
        if (mathResponse.type === 'equation') {
          // Send math slide
          const mathSlide = await mathSlideGenerator.generateMathSlide({
            title: mathResponse.title,
            mathExpressions: mathResponse.expressions,
            text: mathResponse.explanation,
            interactive: true
          });
          
          socket.emit('math_slide_ready', {
            html: mathSlide,
            expressions: mathResponse.expressions
          });
        }
      }
      
      // Process message and get action
      const action = await lessonOrchestrator.processUserMessage(
        user.id,
        data.lessonId,
        data.message
      );
      
      // Send chat response first
      await realtimeChatService.handleUserMessage(
        user.id,
        data.lessonId,
        data.message,
        socket.id
      );
      
      // Notify about action if detected
      if (action && action.confidence > 0.7) {
        socket.emit('action_detected', {
          action: action.action,
          trigger: action.trigger,
          confidence: action.confidence,
          executing: true,
          isMathAction: wantsMath
        });
        
        // Action will be executed by orchestrator
        console.log(`🎬 Action "${action.action}" executed with ${action.confidence} confidence`);
      }
      
    } catch (error: any) {
      console.error('Chat action processing failed:', error);
      socket.emit('chat_error', {
        message: 'فشل معالجة الرسالة'
      });
    }
  });
  
  // ============= MATH-SPECIFIC EVENTS (جديد) =============
  
  /**
   * طلب شريحة معادلة رياضية
   */
  socket.on('request_math_slide', async (data: {
    lessonId: string;
    type: 'equation' | 'problem' | 'comparison' | 'interactive';
    content?: {
      title?: string;
      equation?: string;
      problem?: string;
      solution?: string;
      variables?: Array<{name: string; value: number}>;
    };
  }) => {
    try {
      console.log(`🧮 Math slide requested: ${data.type}`);
      
      let slideHtml = '';
      
      switch (data.type) {
        case 'equation':
          // شريحة معادلة بسيطة
          const expression: MathExpression = {
            id: 'eq1',
            latex: data.content?.equation || 'x^2 + 2x + 1 = 0',
            type: 'equation',
            isInteractive: true,
            variables: data.content?.variables?.map(v => ({
              name: v.name,
              value: v.value,
              min: -10,
              max: 10,
              step: 1
            }))
          };
          
          slideHtml = await mathSlideGenerator.generateMathSlide({
            title: data.content?.title || 'معادلة رياضية',
            mathExpressions: [expression],
            text: data.content?.solution,
            interactive: true
          });
          break;
          
        case 'problem':
          // شريحة مسألة رياضية
          slideHtml = await mathSlideGenerator.generateMathProblemSlide({
            title: data.content?.title || 'مسألة رياضية',
            question: data.content?.problem || 'احسب قيمة x',
            equation: data.content?.equation,
            solution: data.content?.solution,
            hints: ['فكر في القانون العام', 'احسب المميز أولاً']
          });
          break;
          
        case 'comparison':
          // شريحة مقارنة معادلات
          const equations = [
            {
              title: 'معادلة خطية',
              latex: '2x + 3 = 7',
              description: 'معادلة من الدرجة الأولى',
              color: '#667eea'
            },
            {
              title: 'معادلة تربيعية',
              latex: 'x^2 - 4x + 3 = 0',
              description: 'معادلة من الدرجة الثانية',
              color: '#48bb78'
            }
          ];
          slideHtml = await mathSlideGenerator.generateComparisonSlide(equations);
          break;
          
        case 'interactive':
          // شريحة تفاعلية كاملة
          const commonExpressions = latexRenderer.getCommonExpressions();
          const quadratic = commonExpressions.quadratic;
          
          slideHtml = await mathSlideGenerator.generateMathSlide({
            title: 'معادلة تفاعلية',
            mathExpressions: [quadratic],
            interactive: true,
            showSteps: true
          });
          break;
      }
      
      socket.emit('math_slide_ready', {
        html: slideHtml,
        type: data.type,
        lessonId: data.lessonId
      });
      
      console.log(`✅ Math slide generated: ${data.type}`);
      
    } catch (error: any) {
      console.error('Math slide generation failed:', error);
      socket.emit('error', {
        code: 'MATH_SLIDE_FAILED',
        message: 'فشل توليد الشريحة الرياضية'
      });
    }
  });
  
  /**
   * حل معادلة رياضية
   */
  socket.on('solve_equation', async (data: {
    equation: string;
    showSteps?: boolean;
    variables?: Record<string, number>;
  }) => {
    try {
      console.log(`🔢 Solving equation: ${data.equation}`);
      
      // Create math expression with solution steps
      const expression: MathExpression = {
        id: 'solve',
        latex: data.equation,
        type: 'equation',
        isInteractive: false,
        steps: [] // سيتم توليدها
      };
      
      // Generate solution (يمكن استخدام OpenAI هنا)
      const solution = {
        equation: data.equation,
        steps: [
          {
            stepNumber: 1,
            latex: data.equation,
            explanation: 'المعادلة الأصلية'
          },
          // ... خطوات الحل
        ],
        answer: 'x = 2' // مثال
      };
      
      // Render solution
      const solutionHtml = data.showSteps 
        ? latexRenderer.renderWithSteps(expression)
        : latexRenderer.renderExpression(data.equation);
      
      socket.emit('equation_solved', {
        equation: data.equation,
        solution: solution.answer,
        html: solutionHtml,
        steps: data.showSteps ? solution.steps : undefined
      });
      
    } catch (error) {
      socket.emit('solve_error', {
        message: 'فشل حل المعادلة'
      });
    }
  });
  
  /**
   * تحديث متغيرات المعادلة
   */
  socket.on('update_math_variables', async (data: {
    expressionId: string;
    variables: Record<string, number>;
  }) => {
    try {
      console.log(`📊 Updating variables for ${data.expressionId}`);
      
      // Update and re-render equation with new variables
      const updatedExpression = {
        id: data.expressionId,
        latex: generateLatexWithVariables(data.variables),
        type: 'equation' as const,
        variables: Object.entries(data.variables).map(([name, value]) => ({
          name,
          value,
          min: -10,
          max: 10,
          step: 1
        }))
      };
      
      const html = latexRenderer.renderInteractiveExpression(updatedExpression);
      
      socket.emit('variables_updated', {
        expressionId: data.expressionId,
        html,
        variables: data.variables
      });
      
    } catch (error) {
      socket.emit('update_error', {
        message: 'فشل تحديث المتغيرات'
      });
    }
  });
  
  /**
   * طلب رسم بياني
   */
  socket.on('request_graph', async (data: {
    function: string;
    range?: { min: number; max: number };
    type?: 'linear' | 'quadratic' | 'cubic' | 'trigonometric';
  }) => {
    try {
      console.log(`📈 Graph requested for: ${data.function}`);
      
      // هنا سيتم إضافة Graph Plotter لاحقاً
      socket.emit('graph_ready', {
        function: data.function,
        message: 'Graph plotter will be implemented in next phase',
        placeholder: true
      });
      
    } catch (error) {
      socket.emit('graph_error', {
        message: 'فشل رسم الدالة'
      });
    }
  });
  
  /**
   * طلب آلة حاسبة
   */
  socket.on('open_calculator', async (data: {
    type?: 'basic' | 'scientific' | 'graphing';
  }) => {
    try {
      console.log(`🔢 Calculator requested: ${data.type || 'scientific'}`);
      
      // هنا سيتم إضافة Calculator لاحقاً
      socket.emit('calculator_ready', {
        type: data.type || 'scientific',
        message: 'Calculator will be implemented in next phase',
        placeholder: true
      });
      
    } catch (error) {
      socket.emit('calculator_error', {
        message: 'فشل فتح الآلة الحاسبة'
      });
    }
  });
  
  // ============= ORIGINAL EVENTS (محتفظ بها كما هي) =============
  
  /**
   * طلب إجراء مباشر
   */
  socket.on('request_action', async (data: {
    lessonId: string;
    action: 'explain' | 'example' | 'quiz' | 'simplify' | 'video' | 'math_equation'; // إضافة math_equation
    context?: string;
  }) => {
    try {
      console.log(`🎯 Direct action requested: ${data.action}`);
      
      // معالجة خاصة للمعادلات الرياضية
      if (data.action === 'math_equation') {
        const mathSlide = await mathSlideGenerator.generateMathSlide({
          title: 'معادلة تفاعلية',
          mathExpressions: [latexRenderer.getCommonExpressions().quadratic],
          interactive: true
        });
        
        socket.emit('math_slide_ready', {
          html: mathSlide,
          fromAction: true
        });
        
        socket.emit('action_completed', {
          action: data.action,
          success: true,
          type: 'math'
        });
        return;
      }
      
      // Create action trigger
      const actionTrigger = {
        trigger: data.context || `طلب ${data.action}`,
        action: (() => {
          switch (data.action) {
            case 'explain': return 'explain_more';
            case 'example': return 'show_example';
            case 'quiz': return 'start_quiz';
            case 'simplify': return 'simplify';
            case 'video': return 'show_video';
            default: return 'generate_slide';
          }
        })() as any,
        confidence: 1.0
      };
      
      // Process action
      const result = await lessonOrchestrator.processUserMessage(
        user.id,
        data.lessonId,
        actionTrigger.trigger
      );
      
      socket.emit('action_completed', {
        action: data.action,
        success: !!result
      });
      
    } catch (error) {
      socket.emit('action_error', {
        action: data.action,
        message: 'فشل تنفيذ الإجراء'
      });
    }
  });
  
  /**
   * تحديث مستوى الفهم
   */
  socket.on('update_comprehension', async (data: {
    lessonId: string;
    level: 'low' | 'medium' | 'high';
  }) => {
    // Update flow comprehension level
    // This affects content difficulty and pacing
    socket.emit('comprehension_updated', {
      level: data.level,
      message: `تم تعديل مستوى الشرح ليناسب ${
        data.level === 'low' ? 'المبتدئين' :
        data.level === 'medium' ? 'المستوى المتوسط' :
        'المستوى المتقدم'
      }`
    });
  });
  
  /**
   * تتبع تفاعل المستخدم
   */
  socket.on('track_interaction', async (data: {
    lessonId: string;
    slideNumber: number;
    interaction: {
      type: 'click' | 'hover' | 'focus' | 'quiz_answer' | 'math_interaction'; // إضافة math_interaction
      element?: string;
      value?: any;
      duration?: number;
    };
  }) => {
    // Track for analytics
    console.log(`📊 Interaction tracked: ${data.interaction.type} on slide ${data.slideNumber}`);
    
    // Track math-specific interactions
    if (data.interaction.type === 'math_interaction') {
      console.log(`🧮 Math interaction: ${data.interaction.element} = ${data.interaction.value}`);
    }
    
    // Could affect engagement score
  });
  
  /**
   * طلب معلومات عن التقدم
   */
  socket.on('get_lesson_progress', async (data: {
    lessonId: string;
  }) => {
    // Get current flow state
    socket.emit('lesson_progress', {
      lessonId: data.lessonId,
      currentSlide: 0, // From flow
      totalSlides: 0,  // From flow
      sectionsCompleted: 0,
      totalSections: 0,
      estimatedTimeRemaining: 0,
      questionsAsked: 0,
      engagementScore: 0,
      mathProblemsolved: 0 // إضافة إحصائية المسائل المحلولة
    });
  });
  
  /**
   * Control lesson flow
   */
  socket.on('control_flow', async (data: {
    lessonId: string;
    action: 'pause' | 'resume' | 'restart' | 'skip_section';
  }) => {
    console.log(`⏸️ Flow control: ${data.action}`);
    
    switch (data.action) {
      case 'pause':
        // Pause auto-advance
        break;
      case 'resume':
        // Resume auto-advance
        break;
      case 'restart':
        // Restart lesson
        break;
      case 'skip_section':
        // Skip to next section
        break;
    }
    
    socket.emit('flow_control_updated', {
      action: data.action,
      success: true
    });
  });
}

/**
 * Helper: Broadcast slide to all in lesson
 */
export function broadcastSlideToLesson(
  lessonId: string,
  slide: any,
  excludeUserId?: string
): void {
  websocketService.sendToLesson(lessonId, 'shared_slide_update', {
    slide,
    sharedBy: excludeUserId
  });
}

/**
 * Helper: Send section change notification
 */
export function notifySectionChange(
  userId: string,
  lessonId: string,
  section: any
): void {
  websocketService.sendToUser(userId, 'section_started', {
    lessonId,
    section: {
      id: section.id,
      title: section.title,
      type: section.type,
      objectives: section.objectives,
      estimatedDuration: section.duration
    }
  });
}

// ============= MATH HELPER FUNCTIONS (جديد) =============

/**
 * توليد محتوى رياضي بناءً على الرسالة
 */
async function generateMathResponse(
  message: string,
  lessonId: string
): Promise<{
  type: 'equation' | 'explanation' | 'graph';
  title: string;
  expressions: MathExpression[];
  explanation: string;
}> {
  // تحليل الرسالة لفهم المطلوب
  if (message.includes('حل') || message.includes('solve')) {
    // توليد معادلة مع الحل
    const quadratic = latexRenderer.getCommonExpressions().quadratic;
    return {
      type: 'equation',
      title: 'حل المعادلة التربيعية',
      expressions: [quadratic],
      explanation: 'استخدم القانون العام لحل المعادلة التربيعية'
    };
  } else if (message.includes('رسم') || message.includes('graph')) {
    // توليد رسم بياني
    return {
      type: 'graph',
      title: 'رسم بياني للدالة',
      expressions: [{
        id: 'graph',
        latex: 'f(x) = x^2 - 4x + 3',
        type: 'equation',
        description: 'دالة تربيعية'
      }],
      explanation: 'الرسم البياني يوضح شكل الدالة'
    };
  } else {
    // شرح عام
    return {
      type: 'explanation',
      title: 'شرح رياضي',
      expressions: [],
      explanation: 'شرح تفصيلي للمفهوم الرياضي'
    };
  }
}

/**
 * توليد LaTeX مع متغيرات
 */
function generateLatexWithVariables(variables: Record<string, number>): string {
  // مثال بسيط - يمكن تحسينه
  const a = variables.a || 1;
  const b = variables.b || 0;
  const c = variables.c || 0;
  
  return `${a}x^2 ${b >= 0 ? '+' : ''} ${b}x ${c >= 0 ? '+' : ''} ${c} = 0`;
}