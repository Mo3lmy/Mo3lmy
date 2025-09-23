// 📍 المكان: src/services/websocket/orchestrator-events.ts
// الوظيفة: ربط Orchestrator مع WebSocket events مع دعم Flow Manager والشرائح التفاعلية

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
 * إضافة Event Handlers للـ Orchestrator مع Flow Manager المحسن
 */
export function setupOrchestratorEvents(socket: Socket, user: any): void {
  
  // ============= LESSON FLOW EVENTS (محسن) =============
  
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
      
      // Create flow using Flow Manager
      const flowContext = await lessonFlowManager.createFlow(
        user.id,
        data.lessonId,
        session.id,
        {
          mode: data.preferences?.mode || 'interactive',
          autoAdvance: data.preferences?.autoAdvance ?? true,
          voiceEnabled: data.preferences?.voiceEnabled ?? true,
          progressiveReveal: data.preferences?.progressiveReveal ?? true,
          playbackSpeed: data.preferences?.playbackSpeed || 1,
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
      
      if (isMathLesson && flowContext) {
        flowContext.isMathLesson = true;
        flowContext.mathInteractive = data.preferences?.mathInteractive ?? true;
      }
      
      // Setup event listeners ONCE per lesson
      setupFlowEventListeners(socket, user.id, data.lessonId);
      
      // Send success response
      socket.emit('lesson_started', {
        success: true,
        lessonId: data.lessonId,
        sessionId: session.id,
        mode: flowContext.mode,
        totalSlides: flowContext.totalSlides,
        isMathLesson,
        features: {
          voiceEnabled: flowContext.voiceEnabled,
          progressiveReveal: flowContext.progressiveReveal,
          autoAdvance: flowContext.autoAdvance,
          mathInteractive: isMathLesson && flowContext.mathInteractive
        }
      });
      
      console.log(`✅ Lesson started successfully: ${flowContext.totalSlides} slides in ${flowContext.mode} mode`);
      
    } catch (error: any) {
      console.error('Failed to start orchestrated lesson:', error);
      socket.emit('error', {
        code: 'ORCHESTRATION_FAILED',
        message: 'فشل بدء الدرس التفاعلي',
        details: error.message
      });
    }
  });
  
  /**
   * معالجة اختيار المستخدم لطريقة العرض (محسن)
   */
  socket.on('user_mode_choice', async (data: {
    lessonId: string;
    choice: 'chat_only' | 'slides_only' | 'slides_with_voice' | 'interactive' | string;
  }) => {
    try {
      // Handle both button clicks and text input
      let mode = data.choice;
      
      // If it's text input, process through Flow Manager
      if (!['chat_only', 'slides_only', 'slides_with_voice', 'interactive'].includes(mode)) {
        await lessonFlowManager.handleUserMessage(user.id, data.lessonId, mode);
        return;
      }
      
      // Direct mode selection
      await lessonFlowManager.transition(
        user.id,
        data.lessonId,
        'mode_selected',
        { mode }
      );
      
      socket.emit('mode_selected', {
        success: true,
        mode,
        message: getModeMessage(mode)
      });
      
    } catch (error: any) {
      socket.emit('choice_error', {
        message: 'فشل معالجة الاختيار',
        error: error.message
      });
    }
  });
  
  /**
   * عرض الشريحة عندما تكون جاهزة (جديد)
   */
  socket.on('request_slide', async (data: {
    lessonId: string;
    slideNumber?: number;
  }) => {
    try {
      const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
      if (!flow) {
        socket.emit('slide_error', { message: 'لا يوجد درس نشط' });
        return;
      }
      
      const slideNumber = data.slideNumber ?? flow.currentSlide;
      
      // Check if slide is already generated
      if (flow.slidesGenerated?.has(slideNumber)) {
        socket.emit('slide_ready', {
          slideNumber,
          html: flow.slidesGenerated.get(slideNumber),
          fromCache: true,
          navigation: getNavigationInfo(flow, slideNumber)
        });
      } else {
        // Request slide generation
        const slide = flow.sections[flow.currentSection]?.slides[slideNumber];
        if (slide) {
          socket.emit('generating_slide', { slideNumber });
          
          // Generate slide HTML (will be cached in Flow Manager)
          await lessonFlowManager.transition(user.id, data.lessonId, 'generate_slide', {
            slideNumber
          });
        }
      }
    } catch (error: any) {
      socket.emit('slide_error', { 
        message: 'فشل عرض الشريحة',
        error: error.message
      });
    }
  });
  
  /**
   * التحكم في العرض التقديمي (محسن)
   */
  socket.on('presentation_control', async (data: {
    lessonId: string;
    action: 'pause' | 'resume' | 'next' | 'previous' | 'skip' | 'repeat';
  }) => {
    try {
      await lessonFlowManager.handlePresentationControl(
        user.id,
        data.lessonId,
        data.action
      );
      
      socket.emit('control_success', {
        action: data.action,
        message: getControlMessage(data.action)
      });
      
    } catch (error: any) {
      socket.emit('control_error', {
        action: data.action,
        message: 'فشل التحكم في العرض',
        error: error.message
      });
    }
  });
  
  /**
   * التنقل الذكي بين الشرائح (محسن)
   */
  socket.on('navigate_smart', async (data: {
    lessonId: string;
    direction: 'next' | 'previous' | 'section' | 'slide';
    target?: number | string;
  }) => {
    try {
      const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
      if (!flow) {
        socket.emit('navigation_error', { message: 'لا يوجد درس نشط' });
        return;
      }
      
      let targetSlide: number | null = null;
      
      switch (data.direction) {
        case 'next':
          targetSlide = flow.currentSlide + 1;
          if (targetSlide < flow.totalSlides) {
            await lessonFlowManager.transition(user.id, data.lessonId, 'next_slide');
          } else {
            await lessonFlowManager.transition(user.id, data.lessonId, 'section_finished');
          }
          break;
          
        case 'previous':
          if (flow.currentSlide > 0) {
            await lessonFlowManager.transition(user.id, data.lessonId, 'previous_slide');
          }
          break;
          
        case 'section':
          if (typeof data.target === 'string') {
            const sectionIndex = flow.sections.findIndex(s => s.id === data.target);
            if (sectionIndex >= 0) {
              flow.currentSection = sectionIndex;
              flow.currentSlide = flow.sections[sectionIndex].slides[0]?.number || 0;
              await notifySlideChange(socket, flow);
            }
          }
          break;
          
        case 'slide':
          if (typeof data.target === 'number' && data.target >= 0 && data.target < flow.totalSlides) {
            flow.currentSlide = data.target;
            await notifySlideChange(socket, flow);
          }
          break;
      }
      
    } catch (error: any) {
      socket.emit('navigation_error', {
        message: 'فشل الانتقال',
        error: error.message
      });
    }
  });
  
  /**
   * معالجة رسالة مع تحليل الإجراءات (محسن)
   */
  socket.on('chat_with_action', async (data: {
    lessonId: string;
    message: string;
  }) => {
    try {
      console.log(`💬 Processing message: "${data.message}"`);
      
      // Process through Flow Manager
      await lessonFlowManager.handleUserMessage(
        user.id,
        data.lessonId,
        data.message
      );
      
      // Get response from chat service
      await realtimeChatService.handleUserMessage(
        user.id,
        data.lessonId,
        data.message,
        socket.id
      );
      
      // Check if any action was triggered
      const flowState = lessonFlowManager.getFlowState(user.id, data.lessonId);
      
      if (flowState && isActionState(flowState)) {
        socket.emit('action_detected', {
          state: flowState,
          message: data.message,
          executing: true
        });
      }
      
    } catch (error: any) {
      console.error('Chat action processing failed:', error);
      socket.emit('chat_error', {
        message: 'فشل معالجة الرسالة',
        error: error.message
      });
    }
  });
  
  /**
   * معالجة مقاطعة أثناء العرض (محسن)
   */
  socket.on('interrupt_presentation', async (data: {
    lessonId: string;
    question: string;
  }) => {
    try {
      const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
      if (!flow) {
        socket.emit('interruption_error', { message: 'لا يوجد درس نشط' });
        return;
      }
      
      // Pause presentation
      if (!flow.isPaused) {
        await lessonFlowManager.handlePresentationControl(user.id, data.lessonId, 'pause');
      }
      
      // Process question
      await lessonFlowManager.transition(
        user.id,
        data.lessonId,
        'user_question',
        { question: data.question }
      );
      
      socket.emit('interruption_handled', {
        question: data.question,
        presentationPaused: true,
        waitingForResponse: true,
        willResume: flow.mode !== 'chat_only'
      });
      
      // Get answer through chat
      await realtimeChatService.handleUserMessage(
        user.id,
        data.lessonId,
        data.question,
        socket.id
      );
      
      // Auto-resume after delay if not chat mode
      if (flow.mode !== 'chat_only') {
        setTimeout(async () => {
          if (flow.isPaused && !flow.isInterrupted) {
            await lessonFlowManager.handlePresentationControl(user.id, data.lessonId, 'resume');
            socket.emit('presentation_resumed', {
              message: 'نستكمل الدرس...'
            });
          }
        }, 5000);
      }
      
    } catch (error: any) {
      socket.emit('interruption_error', {
        message: 'فشل معالجة السؤال',
        error: error.message
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
        flow.playbackSpeed = Math.max(0.5, Math.min(2, data.speed));
        flow.revealDelay = 3 / flow.playbackSpeed;
        
        socket.emit('speed_changed', {
          speed: flow.playbackSpeed,
          message: `سرعة العرض الآن ${flow.playbackSpeed}x`
        });
      }
    } catch (error: any) {
      socket.emit('speed_error', {
        message: 'فشل تغيير السرعة',
        error: error.message
      });
    }
  });
  
  /**
   * طلب صوت الشريحة (جديد)
   */
  socket.on('request_slide_audio', async (data: {
    lessonId: string;
    slideNumber: number;
  }) => {
    try {
      const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
      if (!flow || !flow.voiceEnabled) {
        socket.emit('audio_not_available', { 
          message: 'الصوت غير متاح' 
        });
        return;
      }
      
      // Check audio queue/cache
      if (flow.audioQueue && flow.audioQueue.length > data.slideNumber) {
        socket.emit('audio_ready', {
          slideNumber: data.slideNumber,
          audioUrl: flow.audioQueue[data.slideNumber],
          duration: 15, // Default duration
          fromCache: true
        });
      } else {
        // Generate audio
        socket.emit('generating_audio', { slideNumber: data.slideNumber });
        
        // This would trigger audio generation through appropriate service
        const slide = flow.sections[flow.currentSection]?.slides[data.slideNumber];
        if (slide) {
          // Simulate audio generation (replace with actual service call)
          setTimeout(() => {
            socket.emit('audio_ready', {
              slideNumber: data.slideNumber,
              audioUrl: `/api/audio/slide-${data.slideNumber}.mp3`,
              duration: slide.duration || 20
            });
          }, 1000);
        }
      }
    } catch (error: any) {
      socket.emit('audio_error', {
        message: 'فشل توليد الصوت',
        error: error.message
      });
    }
  });
  
  // ============= MATH-SPECIFIC EVENTS =============
  
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
      
      // Update flow if exists
      const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
      if (flow) {
        flow.mathProblemsAttempted = (flow.mathProblemsAttempted || 0) + 1;
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
        message: 'فشل توليد الشريحة الرياضية',
        error: error.message
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
          },
          // Add more solution steps here
        ],
        answer: 'x = 2' // Placeholder - would use actual solver
      };
      
      const solutionHtml = data.showSteps 
        ? latexRenderer.renderWithSteps(expression)
        : latexRenderer.renderExpression(data.equation);
      
      // Update flow stats
      const flow = lessonFlowManager.getFlow(user.id, data.equation); // lessonId from context
      if (flow) {
        flow.mathProblemsSolved = (flow.mathProblemsSolved || 0) + 1;
      }
      
      socket.emit('equation_solved', {
        equation: data.equation,
        solution: solution.answer,
        html: solutionHtml,
        steps: data.showSteps ? solution.steps : undefined
      });
      
    } catch (error: any) {
      socket.emit('solve_error', {
        message: 'فشل حل المعادلة',
        error: error.message
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
      
    } catch (error: any) {
      socket.emit('update_error', {
        message: 'فشل تحديث المتغيرات',
        error: error.message
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
      
      const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
      
      if (data.action === 'math_equation' && flow?.isMathLesson) {
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
      const actionMessage = `${data.action} ${data.context || ''}`.trim();
      await lessonFlowManager.handleUserMessage(
        user.id,
        data.lessonId,
        actionMessage
      );
      
      socket.emit('action_completed', {
        action: data.action,
        success: true
      });
      
    } catch (error: any) {
      socket.emit('action_error', {
        action: data.action,
        message: 'فشل تنفيذ الإجراء',
        error: error.message
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
      flow.comprehensionLevel = 
        data.level === 'low' ? 25 :
        data.level === 'high' ? 90 : 50;
      
      socket.emit('comprehension_updated', {
        level: data.level,
        message: `تم تعديل مستوى الشرح ليناسب ${
          data.level === 'low' ? 'المبتدئين' :
          data.level === 'medium' ? 'المستوى المتوسط' :
          'المستوى المتقدم'
        }`
      });
    }
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
    
    const flow = lessonFlowManager.getFlow(user.id, data.lessonId);
    if (flow) {
      flow.engagementScore = Math.min(100, flow.engagementScore + 1);
      flow.hasUserEngaged = true;
      
      if (data.interaction.type === 'math_interaction') {
        console.log(`🧮 Math interaction: ${data.interaction.element} = ${data.interaction.value}`);
      }
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
      const currentSection = flow.sections[flow.currentSection];
      
      socket.emit('lesson_progress', {
        lessonId: data.lessonId,
        current: {
          slide: flow.currentSlide + 1,
          section: flow.currentSection + 1,
          sectionTitle: currentSection?.title,
          slideReady: flow.currentSlideReady
        },
        total: {
          slides: flow.totalSlides,
          sections: flow.sections.length
        },
        completion: {
          sectionsCompleted: flow.sections.filter(s => s.completed).length,
          slidesViewed: flow.currentSlide + 1,
          percentComplete: Math.round(((flow.currentSlide + 1) / flow.totalSlides) * 100)
        },
        time: {
          elapsed: Math.floor(flow.actualDuration / 60),
          estimated: flow.estimatedDuration,
          remaining: Math.max(0, flow.estimatedDuration - Math.floor(flow.actualDuration / 60))
        },
        engagement: {
          questionsAsked: flow.questionsAsked,
          engagementScore: flow.engagementScore,
          comprehensionLevel: flow.comprehensionLevel,
          mathProblemsSolved: flow.mathProblemsSolved || 0
        },
        progressive: {
          isRevealing: flow.progressiveState.isRevealing,
          currentPoint: flow.progressiveState.currentPointIndex,
          pointsRevealed: flow.progressiveState.pointsRevealed.length
        },
        state: {
          current: stats?.currentState,
          isPaused: flow.isPaused,
          isPresenting: flow.isPresenting,
          mode: flow.mode
        },
        audio: {
          enabled: flow.voiceEnabled,
          playing: flow.isAudioPlaying,
          currentAudio: flow.currentAudioUrl
        }
      });
    } else {
      socket.emit('lesson_progress', {
        lessonId: data.lessonId,
        error: 'No active lesson'
      });
    }
  });
  
  /**
   * إنهاء الدرس
   */
  socket.on('end_lesson', async (data: {
    lessonId: string;
    reason?: string;
  }) => {
    try {
      await lessonFlowManager.stopFlow(user.id, data.lessonId);
      
      socket.emit('lesson_ended', {
        lessonId: data.lessonId,
        reason: data.reason || 'user_request',
        message: 'تم إنهاء الدرس'
      });
      
    } catch (error: any) {
      socket.emit('end_error', {
        message: 'فشل إنهاء الدرس',
        error: error.message
      });
    }
  });
}

// ============= HELPER FUNCTIONS =============

/**
 * Setup flow event listeners
 */
function setupFlowEventListeners(socket: Socket, userId: string, lessonId: string): void {
  // Remove old listeners first
  lessonFlowManager.removeAllListeners('stateChanged');
  lessonOrchestrator.removeAllListeners('slideChanged');
  lessonOrchestrator.removeAllListeners('pointRevealed');
  lessonOrchestrator.removeAllListeners('sectionChanged');
  
  // Listen for flow state changes
  lessonFlowManager.on('stateChanged', (stateData) => {
    if (stateData.userId === userId && stateData.lessonId === lessonId) {
      socket.emit('flow_state_changed', {
        lessonId: stateData.lessonId,
        currentState: stateData.currentState,
        previousState: stateData.previousState,
        event: stateData.event,
        timestamp: new Date()
      });
    }
  });
  
  // Listen for slide changes
  lessonOrchestrator.on('slideChanged', (data) => {
    if (data.userId === userId) {
      socket.emit('slide_changed', data);
    }
  });
  
  // Listen for point reveals
  lessonOrchestrator.on('pointRevealed', (data) => {
    if (data.userId === userId) {
      socket.emit('point_revealed', data);
    }
  });
  
  // Listen for section changes
  lessonOrchestrator.on('sectionChanged', (data) => {
    if (data.userId === userId) {
      socket.emit('section_changed', data);
    }
  });
}

/**
 * Get mode message
 */
function getModeMessage(mode: string): string {
  const messages: Record<string, string> = {
    'chat_only': 'تم اختيار المحادثة التعليمية',
    'slides_only': 'تم اختيار الشرائح التفاعلية',
    'slides_with_voice': 'تم اختيار الشرائح مع الشرح الصوتي',
    'interactive': 'تم اختيار التجربة التفاعلية الكاملة'
  };
  return messages[mode] || 'تم اختيار طريقة العرض';
}

/**
 * Get control message
 */
function getControlMessage(action: string): string {
  const messages: Record<string, string> = {
    'pause': 'تم إيقاف العرض مؤقتاً',
    'resume': 'تم استئناف العرض',
    'next': 'الانتقال للشريحة التالية',
    'previous': 'الرجوع للشريحة السابقة',
    'skip': 'تم تخطي الشريحة',
    'repeat': 'إعادة الشريحة'
  };
  return messages[action] || 'تم تنفيذ الأمر';
}

/**
 * Get navigation info
 */
function getNavigationInfo(flow: any, slideNumber: number): any {
  return {
    current: slideNumber + 1,
    total: flow.totalSlides,
    canGoBack: slideNumber > 0,
    canGoForward: slideNumber < flow.totalSlides - 1,
    section: flow.currentSection + 1,
    totalSections: flow.sections.length
  };
}

/**
 * Check if state is action state
 */
function isActionState(state: FlowState): boolean {
  return [
    FlowState.ANSWERING_QUESTION,
    FlowState.SHOWING_EXAMPLE,
    FlowState.QUIZ_MODE,
    FlowState.PRACTICE_MODE
  ].includes(state);
}

/**
 * Notify slide change
 */
async function notifySlideChange(socket: Socket, flow: any): Promise<void> {
  socket.emit('slide_changed', {
    slideNumber: flow.currentSlide,
    sectionIndex: flow.currentSection,
    navigation: getNavigationInfo(flow, flow.currentSlide)
  });
}

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
  
  let equation = '';
  
  // Build equation string based on values
  if (a !== 0) {
    equation += a === 1 ? 'x^2' : a === -1 ? '-x^2' : `${a}x^2`;
  }
  
  if (b !== 0) {
    equation += b > 0 ? ` + ${b}x` : ` - ${Math.abs(b)}x`;
  }
  
  if (c !== 0) {
    equation += c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`;
  }
  
  equation += ' = 0';
  
  return equation.trim();
}