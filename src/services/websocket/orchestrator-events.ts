// 📍 المكان: src/services/websocket/orchestrator-events.ts
// الوظيفة: ربط Orchestrator مع WebSocket events مع دعم Flow Manager والمكونات الرياضية

import { Socket } from 'socket.io';
import { lessonFlowManager, FlowState } from '../flow/lesson-flow-manager.service';
import { lessonOrchestrator } from '../orchestrator/lesson-orchestrator.service';
import { websocketService } from './websocket.service';
import { sessionService } from './session.service';
import { realtimeChatService } from './realtime-chat.service';
import { prisma } from '../../config/database.config';

// استيراد المكونات الرياضية
import { latexRenderer, type MathExpression } from '../../core/interactive/math/latex-renderer';
import { mathSlideGenerator } from '../../core/video/enhanced-slide.generator';

/**
 * إضافة Event Handlers للـ Orchestrator مع Flow Manager
 */
export function setupOrchestratorEvents(socket: Socket, user: any): void {
  
  // ============= LESSON FLOW EVENTS (محدث مع Flow Manager) =============
  
  /**
   * بدء درس بنظام Flow Manager الذكي
   */
  socket.on('start_orchestrated_lesson', async (data: {
    lessonId: string;
    startWithChat?: boolean;
    preferences?: {
      mode?: 'chat_only' | 'slides_only' | 'slides_with_voice' | 'interactive';
      autoAdvance?: boolean;
      voiceEnabled?: boolean;
      playbackSpeed?: number;
      mathInteractive?: boolean;
      progressiveReveal?: boolean;
    };
  }) => {
    try {
      console.log(`🎯 Starting orchestrated lesson with Flow Manager for ${user.email}`);
      
      // Get or create session
      const session = await sessionService.getOrCreateSession(
        user.id,
        data.lessonId,
        socket.id
      );
      
      // Create flow using Flow Manager instead of Orchestrator
      const flowContext = await lessonFlowManager.createFlow(
        user.id,
        data.lessonId,
        session.id,
        {
          mode: data.preferences?.mode || 'interactive',
          autoAdvance: data.preferences?.autoAdvance ?? true,
          voiceEnabled: data.preferences?.voiceEnabled ?? true,
          progressiveReveal: data.preferences?.progressiveReveal ?? true,
          startWithChat: data.startWithChat
        }
      );
      
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
      
      // Listen for flow state changes
      lessonFlowManager.on('stateChanged', (stateData) => {
        if (stateData.userId === user.id) {
          socket.emit('flow_state_changed', {
            lessonId: stateData.lessonId,
            currentState: stateData.currentState,
            previousState: stateData.previousState,
            event: stateData.event
          });
        }
      });
      
      // Listen for orchestrator events (still needed for slides)
      lessonOrchestrator.on('slideChanged', (data) => {
        if (data.userId === user.id) {
          socket.emit('slide_changed', data);
        }
      });
      
      lessonOrchestrator.on('pointRevealed', (data) => {
        if (data.userId === user.id) {
          socket.emit('point_revealed', data);
        }
      });
      
      lessonOrchestrator.on('sectionChanged', (data) => {
        if (data.userId === user.id) {
          socket.emit('section_changed', data);
        }
      });
      
      console.log(`✅ Flow Manager lesson started: ${flowContext.totalSlides} slides in ${flowContext.mode} mode`);
      
    } catch (error: any) {
      console.error('Failed to start orchestrated lesson:', error);
      socket.emit('error', {
        code: 'ORCHESTRATION_FAILED',
        message: 'فشل بدء الدرس التفاعلي'
      });
    }
  });
  
  /**
   * معالجة اختيار المستخدم لطريقة العرض (محدث)
   */
  socket.on('user_mode_choice', async (data: {
    lessonId: string;
    choice: 'chat_only' | 'slides_only' | 'slides_with_voice' | 'interactive';
  }) => {
    try {
      // Process through Flow Manager
      await lessonFlowManager.handleUserMessage(
        user.id,
        data.lessonId,
        data.choice
      );
      
      // Transition to appropriate state
      await lessonFlowManager.transition(
        user.id,
        data.lessonId,
        'mode_selected',
        { mode: data.choice }
      );
      
      socket.emit('mode_selected', {
        mode: data.choice,
        message: `تم اختيار ${
          data.choice === 'chat_only' ? 'المحادثة فقط' :
          data.choice === 'slides_only' ? 'الشرائح التفاعلية' :
          data.choice === 'slides_with_voice' ? 'الشرائح مع الشرح الصوتي' :
          'التجربة التفاعلية الكاملة'
        }`
      });
      
    } catch (error) {
      socket.emit('choice_error', {
        message: 'فشل معالجة الاختيار'
      });
    }
  });
  
  /**
   * التنقل الذكي بين الشرائح (محدث للعمل مع Flow Manager)
   */
  socket.on('navigate_smart', async (data: {
    lessonId: string;
    direction: 'next' | 'previous' | 'section' | 'slide';
    target?: number | string;
  }) => {
    try {
      const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
      if (!flow) {
        socket.emit('navigation_error', {
          message: 'لا يوجد درس نشط'
        });
        return;
      }
      
      let slide = null;
      
      // Still use orchestrator for navigation (it manages slides)
      switch (data.direction) {
        case 'next':
          slide = await lessonOrchestrator.navigateNext(user.id, data.lessonId);
          break;
          
        case 'previous':
          slide = await lessonOrchestrator.navigatePrevious(user.id, data.lessonId);
          break;
          
        case 'section':
          if (typeof data.target === 'string') {
            const sectionIndex = flow.sections.findIndex(s => s.id === data.target);
            if (sectionIndex >= 0) {
              const firstSlideOfSection = flow.sections
                .slice(0, sectionIndex)
                .reduce((sum, s) => sum + s.slides.length, 0);
              slide = await lessonOrchestrator.jumpToSlide(
                user.id, 
                data.lessonId, 
                firstSlideOfSection
              );
            }
          }
          break;
          
        case 'slide':
          if (typeof data.target === 'number') {
            slide = await lessonOrchestrator.jumpToSlide(
              user.id,
              data.lessonId,
              data.target
            );
          }
          break;
      }
      
      if (slide && slide.html) {
        socket.emit('slide_ready', {
          slideNumber: slide.number,
          html: slide.html,
          type: slide.type,
          duration: slide.duration,
          progressive: slide.points ? {
            totalPoints: slide.points.length,
            currentPoint: 0,
            timings: slide.pointTimings
          } : null,
          navigation: {
            canGoBack: slide.number > 0,
            canGoForward: slide.number < (flow?.totalSlides || 0) - 1,
            currentSlide: slide.number + 1,
            totalSlides: flow?.totalSlides || 0
          }
        });
      } else if (!slide && data.direction === 'next') {
        // Lesson completed - transition to completion state
        await lessonFlowManager.transition(
          user.id,
          data.lessonId,
          'next_section'
        );
      }
      
    } catch (error) {
      socket.emit('navigation_error', {
        message: 'فشل الانتقال'
      });
    }
  });
  
  /**
   * معالجة رسالة مع تحليل الإجراءات (محدث للعمل مع Flow Manager)
   */
  socket.on('chat_with_action', async (data: {
    lessonId: string;
    message: string;
  }) => {
    try {
      console.log(`💬 Chat with action analysis via Flow Manager: "${data.message}"`);
      
      // Process message through Flow Manager
      await lessonFlowManager.handleUserMessage(
        user.id,
        data.lessonId,
        data.message
      );
      
      // Also send through realtime chat for response
      await realtimeChatService.handleUserMessage(
        user.id,
        data.lessonId,
        data.message,
        socket.id
      );
      
      // Check flow state to determine if action was taken
      const flowState = lessonFlowManager.getFlowState(user.id, data.lessonId);
      
      if (flowState !== null && 
          (flowState === FlowState.ANSWERING_QUESTION || flowState === FlowState.SHOWING_EXAMPLE)) {
        socket.emit('action_detected', {
          state: flowState,
          message: data.message,
          executing: true
        });
      }
      
    } catch (error: any) {
      console.error('Chat action processing failed:', error);
      socket.emit('chat_error', {
        message: 'فشل معالجة الرسالة'
      });
    }
  });
  
  /**
   * إيقاف/استئناف العرض (محدث للعمل مع Flow Manager)
   */
  socket.on('control_presentation', async (data: {
    lessonId: string;
    action: 'pause' | 'resume' | 'restart' | 'skip_point' | 'repeat_point';
  }) => {
    try {
      const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
      if (!flow) {
        socket.emit('control_error', {
          action: data.action,
          message: 'لا يوجد درس نشط'
        });
        return;
      }
      
      let transitionEvent = '';
      let message = '';
      
      switch (data.action) {
        case 'pause':
          transitionEvent = 'pause';
          message = 'تم إيقاف العرض';
          break;
          
        case 'resume':
          transitionEvent = 'resume';
          message = 'تم استئناف العرض';
          break;
          
        case 'restart':
          // Restart current slide from beginning
          flow.progressiveState.currentPointIndex = 0;
          flow.progressiveState.pointsRevealed = [];
          await lessonOrchestrator.presentSlideProgressive(flow, flow.currentSlide);
          socket.emit('slide_restarted', {
            slideNumber: flow.currentSlide
          });
          message = 'تمت إعادة الشريحة';
          break;
          
        case 'skip_point':
          // Skip to next point immediately
          const currentSection = flow.sections[flow.currentSection];
          const currentSlideIndex = flow.currentSlide - flow.sections
            .slice(0, flow.currentSection)
            .reduce((sum, s) => sum + s.slides.length, 0);
          const currentSlide = currentSection.slides[currentSlideIndex];
          
          if (currentSlide?.points && 
              flow.progressiveState.currentPointIndex < currentSlide.points.length - 1) {
            flow.progressiveState.currentPointIndex++;
            socket.emit('point_skipped', {
              newPointIndex: flow.progressiveState.currentPointIndex
            });
          }
          message = 'تم تخطي النقطة';
          break;
          
        case 'repeat_point':
          // Repeat current point
          const pointIndex = flow.progressiveState.currentPointIndex;
          const section = flow.sections[flow.currentSection];
          const slideIdx = flow.currentSlide - flow.sections
            .slice(0, flow.currentSection)
            .reduce((sum, s) => sum + s.slides.length, 0);
          const slide = section.slides[slideIdx];
          
          socket.emit('repeat_point', {
            pointIndex,
            content: slide?.points?.[pointIndex]
          });
          message = 'تم تكرار النقطة';
          break;
      }
      
      // Transition if needed
      if (transitionEvent) {
        await lessonFlowManager.transition(
          user.id,
          data.lessonId,
          transitionEvent
        );
      }
      
      socket.emit('control_success', {
        action: data.action,
        message
      });
      
    } catch (error) {
      socket.emit('control_error', {
        action: data.action,
        message: 'فشل التحكم في العرض'
      });
    }
  });
  
  /**
   * معالجة مقاطعة أثناء العرض (محدث للعمل مع Flow Manager)
   */
  socket.on('interrupt_presentation', async (data: {
    lessonId: string;
    question: string;
  }) => {
    try {
      // Process interruption through Flow Manager
      await lessonFlowManager.handleUserMessage(
        user.id,
        data.lessonId,
        data.question
      );
      
      // Transition to answering question state
      await lessonFlowManager.transition(
        user.id,
        data.lessonId,
        'user_question',
        { question: data.question }
      );
      
      socket.emit('interruption_handled', {
        question: data.question,
        presentationPaused: true,
        waitingForResponse: true
      });
      
      // The answer will come through chat
      await realtimeChatService.handleUserMessage(
        user.id,
        data.lessonId,
        data.question,
        socket.id
      );
      
    } catch (error) {
      socket.emit('interruption_error', {
        message: 'فشل معالجة السؤال'
      });
    }
  });
  
  /**
   * تغيير سرعة العرض
   */
  socket.on('change_speed', async (data: {
    lessonId: string;
    speed: number; // 0.5, 0.75, 1, 1.25, 1.5, 2
  }) => {
    try {
      const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
      if (flow) {
        flow.playbackSpeed = data.speed;
        flow.revealDelay = 3 / data.speed; // Adjust reveal delay
        
        socket.emit('speed_changed', {
          speed: data.speed,
          message: `السرعة الآن ${data.speed}x`
        });
      }
    } catch (error) {
      socket.emit('speed_error', {
        message: 'فشل تغيير السرعة'
      });
    }
  });
  
  // ============= MATH-SPECIFIC EVENTS (كما هي) =============
  
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
          slideHtml = await mathSlideGenerator.generateMathProblemSlide({
            title: data.content?.title || 'مسألة رياضية',
            question: data.content?.problem || 'احسب قيمة x',
            equation: data.content?.equation,
            solution: data.content?.solution,
            hints: ['فكر في القانون العام', 'احسب المميز أولاً']
          });
          break;
          
        case 'comparison':
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
      
      const expression: MathExpression = {
        id: 'solve',
        latex: data.equation,
        type: 'equation',
        isInteractive: false,
        steps: []
      };
      
      const solution = {
        equation: data.equation,
        steps: [
          {
            stepNumber: 1,
            latex: data.equation,
            explanation: 'المعادلة الأصلية'
          }
        ],
        answer: 'x = 2'
      };
      
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
  
  // ============= ACTION & STATUS EVENTS =============
  
  /**
   * طلب إجراء مباشر
   */
  socket.on('request_action', async (data: {
    lessonId: string;
    action: 'explain' | 'example' | 'quiz' | 'simplify' | 'video' | 'math_equation';
    context?: string;
  }) => {
    try {
      console.log(`🎯 Direct action requested: ${data.action}`);
      
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
      
      // Process action through Flow Manager
      const actionMessage = data.context || `طلب ${data.action}`;
      await lessonFlowManager.handleUserMessage(
        user.id,
        data.lessonId,
        actionMessage
      );
      
      socket.emit('action_completed', {
        action: data.action,
        success: true
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
    const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
    if (flow) {
      // Convert string level to number
      let levelNum = 50;
      if (data.level === 'low') levelNum = 25;
      else if (data.level === 'high') levelNum = 90;
      flow.comprehensionLevel = levelNum;
    }
    
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
      type: 'click' | 'hover' | 'focus' | 'quiz_answer' | 'math_interaction';
      element?: string;
      value?: any;
      duration?: number;
    };
  }) => {
    console.log(`📊 Interaction tracked: ${data.interaction.type} on slide ${data.slideNumber}`);
    
    if (data.interaction.type === 'math_interaction') {
      console.log(`🧮 Math interaction: ${data.interaction.element} = ${data.interaction.value}`);
    }
    
    const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
    if (flow) {
      flow.engagementScore = Math.min(100, flow.engagementScore + 1);
    }
  });
  
  /**
   * طلب معلومات عن التقدم
   */
  socket.on('get_lesson_progress', async (data: {
    lessonId: string;
  }) => {
    const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
    
    if (flow) {
      const stats = lessonFlowManager.getFlowStats(user.id, data.lessonId);
      
      socket.emit('lesson_progress', {
        lessonId: data.lessonId,
        currentSlide: flow.currentSlide,
        totalSlides: flow.totalSlides,
        sectionsCompleted: flow.sections.filter(s => s.completed).length,
        totalSections: flow.sections.length,
        estimatedTimeRemaining: Math.max(0, 
          flow.estimatedDuration - Math.floor(flow.actualDuration / 60)),
        questionsAsked: flow.questionsAsked,
        engagementScore: flow.engagementScore,
        mathProblemsolved: flow.mathProblemsSolved || 0,
        progressiveState: {
          isRevealing: flow.progressiveState.isRevealing,
          currentPoint: flow.progressiveState.currentPointIndex,
          pointsRevealed: flow.progressiveState.pointsRevealed.length
        },
        flowState: stats?.currentState,
        flowStats: stats
      });
    } else {
      socket.emit('lesson_progress', {
        lessonId: data.lessonId,
        error: 'No active lesson'
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
}

// ============= HELPER FUNCTIONS =============

/**
 * Broadcast slide to all in lesson
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
 * Send section change notification
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
      estimatedDuration: section.duration,
      hasProgressiveContent: section.hasProgressiveContent
    }
  });
}

/**
 * توليد LaTeX مع متغيرات
 */
function generateLatexWithVariables(variables: Record<string, number>): string {
  const a = variables.a || 1;
  const b = variables.b || 0;
  const c = variables.c || 0;
  
  return `${a}x^2 ${b >= 0 ? '+' : ''} ${b}x ${c >= 0 ? '+' : ''} ${c} = 0`;
}