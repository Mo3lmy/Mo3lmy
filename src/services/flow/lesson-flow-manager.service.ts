// 📍 المكان: src/services/flow/lesson-flow-manager.service.ts
// الوظيفة: القلب المركزي لإدارة تدفق الدرس بـ State Machine

import { EventEmitter } from 'events';
import { lessonOrchestrator, type LessonFlow } from '../orchestrator/lesson-orchestrator.service';
import { realtimeChatService } from '../websocket/realtime-chat.service';
import { websocketService } from '../websocket/websocket.service';
import { prisma } from '../../config/database.config';
import { openAIService } from '../ai/openai.service';
import { 
  getPrompt, 
  PromptContext 
} from '../../utils/prompt-templates';

// ============= TYPES =============

/**
 * حالات التدفق الممكنة للدرس
 */
export enum FlowState {
  // Initial States
  IDLE = 'idle',                           // لم يبدأ بعد
  INITIALIZING = 'initializing',           // جاري التحضير
  
  // Choice States
  WAITING_FOR_MODE = 'waiting_for_mode',   // ينتظر اختيار طريقة العرض
  WAITING_FOR_CHOICE = 'waiting_for_choice', // ينتظر اختيار من المستخدم
  
  // Presentation States
  PRESENTING = 'presenting',               // عرض الشرائح
  PROGRESSIVE_REVEALING = 'progressive_revealing', // كشف تدريجي للنقاط
  PAUSED = 'paused',                       // متوقف مؤقتاً
  
  // Interaction States
  CHATTING = 'chatting',                   // محادثة نشطة
  ANSWERING_QUESTION = 'answering_question', // يجيب على سؤال
  SHOWING_EXAMPLE = 'showing_example',     // يعرض مثال
  
  // Activity States
  QUIZ_MODE = 'quiz_mode',                 // في وضع الاختبار
  PRACTICE_MODE = 'practice_mode',         // في وضع التمرين
  
  // Completion States
  SECTION_COMPLETE = 'section_complete',   // انتهى من قسم
  LESSON_COMPLETE = 'lesson_complete',     // انتهى من الدرس
  ERROR = 'error'                          // حالة خطأ
}

/**
 * الانتقالات المسموح بها بين الحالات
 */
export interface StateTransition {
  from: FlowState[];
  to: FlowState;
  event: string;
  condition?: (flow: FlowContext) => boolean;
  action?: (flow: FlowContext) => Promise<void>;
}

/**
 * سياق التدفق الكامل
 */
export interface FlowContext extends LessonFlow {
  currentState: FlowState;
  previousState: FlowState | null;
  stateHistory: Array<{
    state: FlowState;
    timestamp: Date;
    trigger?: string;
  }>;
  
  // Flags
  isInterrupted: boolean;
  isWaitingForResponse: boolean;
  hasUserEngaged: boolean;
  
  // Timers
  stateTimeout?: NodeJS.Timeout;
  idleTimer?: NodeJS.Timeout;
  
  // Metrics
  stateChanges: number;
  totalInterruptions: number;
  averageResponseTime: number;
}

/**
 * أحداث التدفق
 */
export interface FlowEvent {
  type: string;
  payload?: any;
  timestamp: Date;
  userId: string;
  lessonId: string;
}

// ============= STATE MACHINE SERVICE =============

export class LessonFlowManagerService extends EventEmitter {
  private flows: Map<string, FlowContext> = new Map();
  private transitions: StateTransition[] = [];
  
  constructor() {
    super();
    this.setupTransitions();
    this.setupEventHandlers();
  }
  
  /**
   * إعداد جدول الانتقالات المسموح بها
   */
  private setupTransitions(): void {
    this.transitions = [
      // === Initial Transitions ===
      {
        from: [FlowState.IDLE],
        to: FlowState.INITIALIZING,
        event: 'start_lesson',
        action: async (flow) => await this.handleLessonStart(flow)
      },
      
      {
        from: [FlowState.INITIALIZING],
        to: FlowState.WAITING_FOR_MODE,
        event: 'initialized',
        action: async (flow) => await this.presentModeSelection(flow)
      },
      
      // === Mode Selection ===
      {
        from: [FlowState.WAITING_FOR_MODE],
        to: FlowState.PRESENTING,
        event: 'mode_selected',
        condition: (flow) => flow.mode === 'slides_only' || flow.mode === 'slides_with_voice',
        action: async (flow) => await this.startPresentation(flow)
      },
      
      {
        from: [FlowState.WAITING_FOR_MODE],
        to: FlowState.CHATTING,
        event: 'mode_selected',
        condition: (flow) => flow.mode === 'chat_only',
        action: async (flow) => await this.startChatMode(flow)
      },
      
      // === Presentation Transitions ===
      {
        from: [FlowState.PRESENTING],
        to: FlowState.PROGRESSIVE_REVEALING,
        event: 'start_progressive',
        action: async (flow) => await this.startProgressiveReveal(flow)
      },
      
      {
        from: [FlowState.PROGRESSIVE_REVEALING],
        to: FlowState.PRESENTING,
        event: 'reveal_complete',
        action: async (flow) => await this.handleRevealComplete(flow)
      },
      
      {
        from: [FlowState.PRESENTING, FlowState.PROGRESSIVE_REVEALING],
        to: FlowState.PAUSED,
        event: 'pause',
        action: async (flow) => await this.pauseFlow(flow)
      },
      
      {
        from: [FlowState.PAUSED],
        to: FlowState.PRESENTING,
        event: 'resume',
        action: async (flow) => await this.resumeFlow(flow)
      },
      
      // === Interaction Transitions ===
      {
        from: [FlowState.PRESENTING, FlowState.PROGRESSIVE_REVEALING, FlowState.CHATTING],
        to: FlowState.ANSWERING_QUESTION,
        event: 'user_question',
        action: async (flow) => await this.handleUserQuestion(flow)
      },
      
      {
        from: [FlowState.ANSWERING_QUESTION],
        to: FlowState.PRESENTING,
        event: 'answer_complete',
        condition: (flow) => flow.mode !== 'chat_only',
        action: async (flow) => await this.returnToPresentation(flow)
      },
      
      {
        from: [FlowState.ANSWERING_QUESTION],
        to: FlowState.CHATTING,
        event: 'answer_complete',
        condition: (flow) => flow.mode === 'chat_only'
      },
      
      // === Activity Transitions ===
      {
        from: [FlowState.PRESENTING, FlowState.CHATTING],
        to: FlowState.QUIZ_MODE,
        event: 'start_quiz',
        action: async (flow) => await this.startQuizMode(flow)
      },
      
      {
        from: [FlowState.QUIZ_MODE],
        to: FlowState.PRESENTING,
        event: 'quiz_complete',
        action: async (flow) => await this.handleQuizComplete(flow)
      },
      
      // === Completion Transitions ===
      {
        from: [FlowState.PRESENTING, FlowState.CHATTING],
        to: FlowState.SECTION_COMPLETE,
        event: 'section_finished',
        action: async (flow) => await this.handleSectionComplete(flow)
      },
      
      {
        from: [FlowState.SECTION_COMPLETE],
        to: FlowState.PRESENTING,
        event: 'next_section',
        condition: (flow) => flow.currentSection < flow.sections.length - 1,
        action: async (flow) => await this.moveToNextSection(flow)
      },
      
      {
        from: [FlowState.SECTION_COMPLETE],
        to: FlowState.LESSON_COMPLETE,
        event: 'next_section',
        condition: (flow) => flow.currentSection >= flow.sections.length - 1,
        action: async (flow) => await this.completeLessson(flow)
      },
      
      // === Error Handling ===
      {
        from: Object.values(FlowState) as FlowState[],
        to: FlowState.ERROR,
        event: 'error',
        action: async (flow) => await this.handleError(flow)
      }
    ];
  }
  
  /**
   * إعداد معالجات الأحداث
   */
  private setupEventHandlers(): void {
    // Listen to orchestrator events
    lessonOrchestrator.on('slideChanged', (data) => {
      this.handleOrchestratorEvent('slide_changed', data);
    });
    
    lessonOrchestrator.on('pointRevealed', (data) => {
      this.handleOrchestratorEvent('point_revealed', data);
    });
    
    lessonOrchestrator.on('sectionCompleted', (data) => {
      this.transition(data.userId, data.lessonId, 'section_finished');
    });
    
    lessonOrchestrator.on('lessonCompleted', (data) => {
      this.transition(data.userId, data.lessonId, 'lesson_finished');
    });
  }
  
  // ============= PUBLIC API =============
  
  /**
   * إنشاء تدفق جديد للدرس
   */
  async createFlow(
    userId: string, 
    lessonId: string,
    sessionId: string,
    options?: any
  ): Promise<FlowContext> {
    const flowKey = `${userId}-${lessonId}`;
    
    // Check if flow already exists
    if (this.flows.has(flowKey)) {
      console.log(`📌 Flow already exists for ${flowKey}`);
      return this.flows.get(flowKey)!;
    }
    
    // Initialize lesson with orchestrator
    const lessonFlow = await lessonOrchestrator.startLesson(
      userId,
      lessonId,
      sessionId,
      options
    );
    
    // Create flow context
    const flowContext: FlowContext = {
      ...lessonFlow,
      currentState: FlowState.IDLE,
      previousState: null,
      stateHistory: [{
        state: FlowState.IDLE,
        timestamp: new Date(),
        trigger: 'creation'
      }],
      isInterrupted: false,
      isWaitingForResponse: false,
      hasUserEngaged: false,
      stateChanges: 0,
      totalInterruptions: 0,
      averageResponseTime: 0
    };
    
    this.flows.set(flowKey, flowContext);
    
    // Start initialization
    await this.transition(userId, lessonId, 'start_lesson');
    
    return flowContext;
  }
  
  /**
   * الانتقال لحالة جديدة
   */
  async transition(
    userId: string,
    lessonId: string,
    event: string,
    payload?: any
  ): Promise<boolean> {
    const flowKey = `${userId}-${lessonId}`;
    const flow = this.flows.get(flowKey);
    
    if (!flow) {
      console.error(`❌ No flow found for ${flowKey}`);
      return false;
    }
    
    // Find valid transition
    const validTransition = this.transitions.find(t =>
      t.event === event &&
      t.from.includes(flow.currentState) &&
      (!t.condition || t.condition(flow))
    );
    
    if (!validTransition) {
      console.warn(`⚠️ Invalid transition: ${flow.currentState} -> ${event}`);
      return false;
    }
    
    console.log(`🔄 State transition: ${flow.currentState} -> ${validTransition.to} (${event})`);
    
    // Update state
    flow.previousState = flow.currentState;
    flow.currentState = validTransition.to;
    flow.stateChanges++;
    
    // Add to history
    flow.stateHistory.push({
      state: validTransition.to,
      timestamp: new Date(),
      trigger: event
    });
    
    // Keep only last 50 state changes
    if (flow.stateHistory.length > 50) {
      flow.stateHistory = flow.stateHistory.slice(-50);
    }
    
    // Execute transition action
    if (validTransition.action) {
      try {
        await validTransition.action(flow);
      } catch (error) {
        console.error(`❌ Transition action failed:`, error);
        await this.transition(userId, lessonId, 'error');
        return false;
      }
    }
    
    // Emit state change event
    this.emit('stateChanged', {
      userId,
      lessonId,
      previousState: flow.previousState,
      currentState: flow.currentState,
      event,
      payload
    });
    
    // Send to client
    websocketService.sendToUser(userId, 'flow_state_changed', {
      lessonId,
      previousState: flow.previousState,
      currentState: flow.currentState,
      event,
      timestamp: new Date()
    });
    
    return true;
  }
  
  /**
   * معالجة رسالة من المستخدم
   */
  async handleUserMessage(
    userId: string,
    lessonId: string,
    message: string
  ): Promise<void> {
    const flow = this.getFlow(userId, lessonId);
    if (!flow) return;
    
    flow.hasUserEngaged = true;
    
    // Handle based on current state
    switch (flow.currentState) {
      case FlowState.WAITING_FOR_MODE:
        await this.handleModeSelection(flow, message);
        break;
        
      case FlowState.WAITING_FOR_CHOICE:
        await this.handleUserChoice(flow, message);
        break;
        
      case FlowState.PRESENTING:
      case FlowState.PROGRESSIVE_REVEALING:
        // Interrupt presentation for question
        await this.transition(userId, lessonId, 'user_question', { message });
        break;
        
      case FlowState.CHATTING:
        await this.handleChatMessage(flow, message);
        break;
        
      case FlowState.QUIZ_MODE:
        await this.handleQuizAnswer(flow, message);
        break;
        
      default:
        // Process through orchestrator
        await lessonOrchestrator.processUserMessage(userId, lessonId, message);
    }
  }
  
  /**
   * الحصول على حالة التدفق الحالية
   */
  getFlowState(userId: string, lessonId: string): FlowState | null {
    const flow = this.getFlow(userId, lessonId);
    return flow?.currentState || null;
  }
  
  /**
   * الحصول على التدفق
   */
  getFlow(userId: string, lessonId: string): FlowContext | undefined {
    return this.flows.get(`${userId}-${lessonId}`);
  }
  
  /**
   * إيقاف التدفق
   */
  async stopFlow(userId: string, lessonId: string): Promise<void> {
    const flowKey = `${userId}-${lessonId}`;
    const flow = this.flows.get(flowKey);
    
    if (flow) {
      // Clear timers
      if (flow.stateTimeout) clearTimeout(flow.stateTimeout);
      if (flow.idleTimer) clearTimeout(flow.idleTimer);
      
      // Clear progressive reveal timers
      // Using public method or handling internally
      if (flow.progressiveState.revealTimers.length > 0) {
        flow.progressiveState.revealTimers.forEach(timer => clearTimeout(timer));
        flow.progressiveState.revealTimers = [];
      }
      
      // Save final state
      await this.saveFinalState(flow);
      
      // Remove from memory
      this.flows.delete(flowKey);
      
      console.log(`🛑 Flow stopped for ${flowKey}`);
    }
  }
  
  // ============= STATE HANDLERS =============
  
  /**
   * معالج بدء الدرس
   */
  private async handleLessonStart(flow: FlowContext): Promise<void> {
    console.log(`🎯 Starting lesson flow for ${flow.lessonId}`);
    
    // Send welcome message with prompt template
    const context: PromptContext = {
      lessonTitle: flow.lessonTitle || '',
      subject: flow.subjectName || '',
      grade: flow.grade || 6,
      comprehensionLevel: flow.comprehensionLevel
    };
    
    // Generate welcome message using prompt template
    const welcomePrompt = getPrompt('welcome', context);
    const welcomeResponse = await openAIService.createCompletion({
      prompt: welcomePrompt,
      temperature: 0.7,
      maxTokens: 150
    });
    
    // Extract the message text from response
    const welcomeMessage = typeof welcomeResponse === 'string' 
      ? welcomeResponse 
      : (welcomeResponse as any).content || 
        (welcomeResponse as any).text || 
        `مرحباً بك في درس ${flow.lessonTitle}! هيا نبدأ رحلة التعلم معاً.`;
    
    websocketService.sendToUser(flow.userId, 'lesson_welcome', {
      lessonId: flow.lessonId,
      message: welcomeMessage,
      lessonTitle: flow.lessonTitle,
      totalSlides: flow.totalSlides,
      estimatedDuration: flow.estimatedDuration
    });
    
    // Move to initialized state
    setTimeout(() => {
      this.transition(flow.userId, flow.lessonId, 'initialized');
    }, 1000);
  }
  
  /**
   * عرض خيارات طريقة العرض
   */
  private async presentModeSelection(flow: FlowContext): Promise<void> {
    flow.isWaitingForResponse = true;
    flow.conversationState.waitingForUserChoice = true;
    
    const options = [
      { id: 'chat_only', label: '💬 محادثة فقط', description: 'تعلم من خلال الحوار' },
      { id: 'slides_only', label: '🖼️ شرائح تفاعلية', description: 'عرض مرئي متدرج' },
      { id: 'slides_with_voice', label: '🎤 شرائح مع صوت', description: 'عرض كامل مع شرح صوتي' },
      { id: 'interactive', label: '🚀 تجربة كاملة', description: 'كل الميزات التفاعلية' }
    ];
    
    websocketService.sendToUser(flow.userId, 'choose_mode', {
      lessonId: flow.lessonId,
      options,
      message: 'كيف تفضل أن نبدأ الدرس؟'
    });
    
    // Set timeout for auto-selection
    flow.stateTimeout = setTimeout(() => {
      if (flow.currentState === FlowState.WAITING_FOR_MODE) {
        flow.mode = 'interactive';
        this.transition(flow.userId, flow.lessonId, 'mode_selected');
      }
    }, 30000); // 30 seconds timeout
  }
  
  /**
   * بدء عرض الشرائح
   */
  private async startPresentation(flow: FlowContext): Promise<void> {
    console.log(`🎬 Starting presentation in ${flow.mode} mode`);
    
    flow.isPresenting = true;
    flow.conversationState.waitingForUserChoice = false;
    
    // Clear timeout
    if (flow.stateTimeout) {
      clearTimeout(flow.stateTimeout);
      flow.stateTimeout = undefined;
    }
    
    // Start with orchestrator
    await lessonOrchestrator.startPresentation(flow);
    
    // Set idle timer
    this.setupIdleTimer(flow);
  }
  
  /**
   * بدء وضع المحادثة
   */
  private async startChatMode(flow: FlowContext): Promise<void> {
    console.log(`💬 Starting chat-only mode`);
    
    flow.conversationState.isActive = true;
    flow.conversationState.waitingForUserChoice = false;
    
    websocketService.sendToUser(flow.userId, 'chat_mode_started', {
      lessonId: flow.lessonId,
      message: 'ممتاز! هيا نتعلم من خلال المحادثة. اسأل أي سؤال أو قل "اشرح" لنبدأ.',
      suggestions: ['اشرح الدرس', 'أعطني مثال', 'ما أهمية هذا؟', 'اختبرني']
    });
  }
  
  /**
   * بدء الكشف التدريجي
   */
  private async startProgressiveReveal(flow: FlowContext): Promise<void> {
    console.log(`✨ Starting progressive reveal for slide ${flow.currentSlide}`);
    
    flow.progressiveState.isRevealing = true;
    flow.progressiveState.currentPointIndex = 0;
    
    await lessonOrchestrator.presentSlideProgressive(flow, flow.currentSlide);
  }
  
  /**
   * معالجة اكتمال الكشف التدريجي
   */
  private async handleRevealComplete(flow: FlowContext): Promise<void> {
    flow.progressiveState.isRevealing = false;
    
    websocketService.sendToUser(flow.userId, 'reveal_complete', {
      lessonId: flow.lessonId,
      slideNumber: flow.currentSlide,
      totalPoints: flow.progressiveState.pointsRevealed.length
    });
    
    // Auto-advance if enabled
    if (flow.autoAdvance && flow.currentSlide < flow.totalSlides - 1) {
      flow.stateTimeout = setTimeout(() => {
        lessonOrchestrator.navigateNext(flow.userId, flow.lessonId);
      }, 5000);
    }
  }
  
  /**
   * إيقاف مؤقت
   */
  private async pauseFlow(flow: FlowContext): Promise<void> {
    flow.isPaused = true;
    
    // Clear timers
    if (flow.stateTimeout) {
      clearTimeout(flow.stateTimeout);
      flow.stateTimeout = undefined;
    }
    
    await lessonOrchestrator.pausePresentation(flow);
  }
  
  /**
   * استئناف
   */
  private async resumeFlow(flow: FlowContext): Promise<void> {
    flow.isPaused = false;
    
    await lessonOrchestrator.resumePresentation(flow);
    
    // Restart timers if needed
    if (flow.autoAdvance) {
      this.setupIdleTimer(flow);
    }
  }
  
  /**
   * معالجة سؤال المستخدم
   */
  private async handleUserQuestion(flow: FlowContext): Promise<void> {
    flow.totalInterruptions++;
    flow.isInterrupted = true;
    
    // Pause if presenting
    if (flow.isPresenting) {
      await lessonOrchestrator.pausePresentation(flow);
    }
    
    // Process through chat service
    const message = flow.conversationState.lastUserMessage || '';
    await realtimeChatService.handleUserMessage(
      flow.userId,
      flow.lessonId,
      message,
      ''
    );
  }
  
  /**
   * العودة للعرض
   */
  private async returnToPresentation(flow: FlowContext): Promise<void> {
    flow.isInterrupted = false;
    
    websocketService.sendToUser(flow.userId, 'returning_to_presentation', {
      lessonId: flow.lessonId,
      message: 'نعود الآن لمتابعة الدرس...',
      currentSlide: flow.currentSlide
    });
    
    // Resume after delay
    setTimeout(async () => {
      await lessonOrchestrator.resumePresentation(flow);
    }, 2000);
  }
  
  /**
   * بدء وضع الاختبار
   */
  private async startQuizMode(flow: FlowContext): Promise<void> {
    console.log(`📝 Starting quiz mode`);
    
    flow.isPaused = true;
    
    // Generate quiz question based on context
    const context: PromptContext = {
      lessonTitle: flow.lessonTitle || '',
      subject: flow.subjectName || '',
      grade: flow.grade || 6,
      currentSection: flow.sections[flow.currentSection]?.title,
      comprehensionLevel: flow.comprehensionLevel
    };
    
    // Generate quiz using prompt template
    const quizPrompt = getPrompt('start_quiz', context);
    const quizResponse = await openAIService.createCompletion({
      prompt: quizPrompt,
      temperature: 0.7,
      maxTokens: 500
    });
    
    // Parse the quiz data
    let quizData;
    try {
      // Handle the response based on the actual structure
      const responseText = typeof quizResponse === 'string' 
        ? quizResponse 
        : (quizResponse as any).content || (quizResponse as any).text || '';
      
      quizData = JSON.parse(responseText);
    } catch {
      // If parsing fails, create a default quiz structure
      quizData = {
        question: 'سؤال تجريبي عن الدرس',
        options: ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'],
        correct: 0,
        hint: 'فكر جيداً'
      };
    }
    
    websocketService.sendToUser(flow.userId, 'quiz_started', {
      lessonId: flow.lessonId,
      quiz: quizData
    });
  }
  
  /**
   * معالجة اكتمال الاختبار
   */
  private async handleQuizComplete(flow: FlowContext): Promise<void> {
    // Update comprehension based on quiz results
    // This would be based on actual quiz performance
    flow.comprehensionLevel = Math.min(100, flow.comprehensionLevel + 10);
    
    websocketService.sendToUser(flow.userId, 'quiz_completed', {
      lessonId: flow.lessonId,
      comprehensionLevel: flow.comprehensionLevel,
      message: 'أحسنت! لقد أتممت الاختبار بنجاح'
    });
  }
  
  /**
   * معالجة اكتمال القسم
   */
  private async handleSectionComplete(flow: FlowContext): Promise<void> {
    const section = flow.sections[flow.currentSection];
    section.completed = true;
    
    websocketService.sendToUser(flow.userId, 'section_completed', {
      lessonId: flow.lessonId,
      sectionTitle: section.title,
      sectionIndex: flow.currentSection,
      totalSections: flow.sections.length,
      message: `ممتاز! أكملت ${section.title}`
    });
  }
  
  /**
   * الانتقال للقسم التالي
   */
  private async moveToNextSection(flow: FlowContext): Promise<void> {
    flow.currentSection++;
    const nextSection = flow.sections[flow.currentSection];
    
    websocketService.sendToUser(flow.userId, 'moving_to_section', {
      lessonId: flow.lessonId,
      sectionTitle: nextSection.title,
      sectionIndex: flow.currentSection,
      objectives: nextSection.objectives
    });
    
    // Reset slide to first in section
    flow.currentSlide = nextSection.slides[0]?.number || 0;
    
    // Continue presentation
    await lessonOrchestrator.presentSlideProgressive(flow, flow.currentSlide);
  }
  
  /**
   * إكمال الدرس
   */
  private async completeLessson(flow: FlowContext): Promise<void> {
    console.log(`🎉 Lesson completed: ${flow.lessonId}`);
    
    flow.actualDuration = Math.floor((Date.now() - flow.startTime.getTime()) / 1000);
    
    // Generate completion message with template
    const context: PromptContext = {
      lessonTitle: flow.lessonTitle || '',
      subject: flow.subjectName || '',
      grade: flow.grade || 6,
      comprehensionLevel: flow.comprehensionLevel
    };
    
    // Generate completion message using prompt template
    const completionPrompt = getPrompt('complete', context);
    const completionResponse = await openAIService.createCompletion({
      prompt: completionPrompt,
      temperature: 0.8,
      maxTokens: 200
    });
    
    // Extract the message text from response
    const completionMessage = typeof completionResponse === 'string' 
      ? completionResponse 
      : (completionResponse as any).content || 
        (completionResponse as any).text || 
        `تهانينا! لقد أكملت درس ${flow.lessonTitle} بنجاح! 🎉`;
    
    websocketService.sendToUser(flow.userId, 'lesson_completed', {
      lessonId: flow.lessonId,
      message: completionMessage,
      stats: {
        duration: flow.actualDuration,
        slidesViewed: flow.currentSlide + 1,
        totalSlides: flow.totalSlides,
        questionsAsked: flow.questionsAsked,
        comprehensionLevel: flow.comprehensionLevel,
        engagementScore: flow.engagementScore
      }
    });
    
    // Save completion to database
    await this.saveCompletion(flow);
    
    // Clean up
    await this.stopFlow(flow.userId, flow.lessonId);
  }
  
  /**
   * معالجة الأخطاء
   */
  private async handleError(flow: FlowContext): Promise<void> {
    console.error(`❌ Flow error for ${flow.lessonId}`);
    
    websocketService.sendToUser(flow.userId, 'flow_error', {
      lessonId: flow.lessonId,
      message: 'حدث خطأ. سنحاول إعادة المحاولة...',
      previousState: flow.previousState
    });
    
    // Try to recover
    if (flow.previousState) {
      flow.currentState = flow.previousState;
      flow.previousState = FlowState.ERROR;
    }
  }
  
  // ============= HELPER METHODS =============
  
  /**
   * معالجة اختيار طريقة العرض
   */
  private async handleModeSelection(flow: FlowContext, message: string): Promise<void> {
    const lowerMessage = message.toLowerCase();
    
    let selectedMode: string | null = null;
    
    if (lowerMessage.includes('محادثة') || lowerMessage.includes('chat')) {
      selectedMode = 'chat_only';
    } else if (lowerMessage.includes('شرائح') && lowerMessage.includes('صوت')) {
      selectedMode = 'slides_with_voice';
    } else if (lowerMessage.includes('شرائح')) {
      selectedMode = 'slides_only';
    } else if (lowerMessage.includes('كامل') || lowerMessage.includes('تفاعل')) {
      selectedMode = 'interactive';
    }
    
    if (selectedMode) {
      flow.mode = selectedMode as any;
      flow.conversationState.waitingForUserChoice = false;
      await this.transition(flow.userId, flow.lessonId, 'mode_selected');
    } else {
      websocketService.sendToUser(flow.userId, 'invalid_choice', {
        message: 'من فضلك اختر إحدى الطرق المتاحة'
      });
    }
  }
  
  /**
   * معالجة اختيار عام من المستخدم
   */
  private async handleUserChoice(flow: FlowContext, message: string): Promise<void> {
    // Process through orchestrator
    const action = await lessonOrchestrator.processUserMessage(
      flow.userId,
      flow.lessonId,
      message
    );
    
    if (action) {
      flow.conversationState.waitingForUserChoice = false;
      // Handle based on action type
      // This would trigger appropriate state transition
    }
  }
  
  /**
   * معالجة رسالة في وضع المحادثة
   */
  private async handleChatMessage(flow: FlowContext, message: string): Promise<void> {
    // Check for commands
    if (message.includes('شرائح') || message.includes('عرض')) {
      flow.mode = 'slides_with_voice';
      await this.transition(flow.userId, flow.lessonId, 'mode_selected');
      return;
    }
    
    if (message.includes('اختبر') || message.includes('quiz')) {
      await this.transition(flow.userId, flow.lessonId, 'start_quiz');
      return;
    }
    
    // Process normal chat
    await realtimeChatService.handleUserMessage(
      flow.userId,
      flow.lessonId,
      message,
      ''
    );
  }
  
  /**
   * معالجة إجابة الاختبار
   */
  private async handleQuizAnswer(flow: FlowContext, answer: string): Promise<void> {
    // Process quiz answer
    // This would validate answer and update score
    
    websocketService.sendToUser(flow.userId, 'quiz_answer_result', {
      lessonId: flow.lessonId,
      correct: true, // Would be determined by actual validation
      explanation: 'شرح الإجابة...'
    });
    
    // Move to next question or complete
    setTimeout(() => {
      this.transition(flow.userId, flow.lessonId, 'quiz_complete');
    }, 3000);
  }
  
  /**
   * إعداد مؤقت الخمول
   */
  private setupIdleTimer(flow: FlowContext): void {
    if (flow.idleTimer) {
      clearTimeout(flow.idleTimer);
    }
    
    flow.idleTimer = setTimeout(() => {
      if (!flow.hasUserEngaged && flow.currentState === FlowState.PRESENTING) {
        websocketService.sendToUser(flow.userId, 'idle_check', {
          lessonId: flow.lessonId,
          message: 'هل ما زلت متابع؟',
          suggestions: ['نعم، أكمل', 'توقف قليلاً', 'لدي سؤال']
        });
      }
    }, 60000); // 1 minute
  }
  
  /**
   * معالجة أحداث من Orchestrator
   */
  private handleOrchestratorEvent(event: string, data: any): void {
    const flow = this.getFlow(data.userId, data.lessonId);
    if (!flow) return;
    
    // Update flow state based on orchestrator events
    if (event === 'slide_changed' && flow.currentState === FlowState.PRESENTING) {
      flow.currentSlide = data.slideNumber;
      
      // Check if slide has progressive content
      const currentSlide = flow.sections[flow.currentSection]?.slides[flow.currentSlide];
      if (currentSlide?.points && currentSlide.points.length > 0) {
        this.transition(data.userId, data.lessonId, 'start_progressive');
      }
    }
    
    if (event === 'point_revealed') {
      flow.progressiveState.currentPointIndex = data.pointIndex;
      flow.progressiveState.pointsRevealed.push(data.pointIndex);
      
      // Check if all points revealed
      const currentSlide = flow.sections[flow.currentSection]?.slides[flow.currentSlide];
      if (currentSlide?.points && 
          flow.progressiveState.pointsRevealed.length >= currentSlide.points.length) {
        this.transition(data.userId, data.lessonId, 'reveal_complete');
      }
    }
  }
  
  /**
   * حفظ حالة نهائية
   */
  private async saveFinalState(flow: FlowContext): Promise<void> {
    try {
      await prisma.learningSession.update({
        where: { id: flow.sessionId },
        data: {
          completedAt: new Date(),
          currentSlide: flow.currentSlide,
          chatHistory: JSON.stringify(flow.conversationState.messageHistory),
          userPreferences: JSON.stringify({
            mode: flow.mode,
            autoAdvance: flow.autoAdvance,
            voiceEnabled: flow.voiceEnabled,
            progressiveReveal: flow.progressiveReveal
          })
        }
      });
    } catch (error) {
      console.error('Failed to save final state:', error);
    }
  }
  
  /**
   * حفظ إكمال الدرس
   */
  private async saveCompletion(flow: FlowContext): Promise<void> {
    try {
      // Update existing progress or create new one
      await prisma.progress.upsert({
        where: {
          userId_lessonId: {
            userId: flow.userId,
            lessonId: flow.lessonId
          }
        },
        update: {
          completedAt: new Date(),
          completionRate: 100, // 100% completed
          status: 'COMPLETED',
          timeSpent: flow.actualDuration,
          lastAccessedAt: new Date()
        },
        create: {
          userId: flow.userId,
          lessonId: flow.lessonId,
          completedAt: new Date(),
          completionRate: 100,
          status: 'COMPLETED',
          timeSpent: flow.actualDuration,
          lastAccessedAt: new Date()
        }
      });
      
      // Save quiz attempt if there were questions
      if (flow.questionsAsked > 0) {
        await prisma.chatMessage.create({
          data: {
            userId: flow.userId,
            lessonId: flow.lessonId,
            sessionId: flow.sessionId,
            userMessage: '',
            aiResponse: '',
            role: 'SYSTEM',
            metadata: JSON.stringify({
              type: 'lesson_completion',
              questionsAsked: flow.questionsAsked,
              comprehensionLevel: flow.comprehensionLevel,
              engagementScore: flow.engagementScore
            })
          }
        });
      }
    } catch (error) {
      console.error('Failed to save completion:', error);
    }
  }
  
  /**
   * الحصول على إحصائيات التدفق
   */
  getFlowStats(userId: string, lessonId: string): any {
    const flow = this.getFlow(userId, lessonId);
    if (!flow) return null;
    
    return {
      currentState: flow.currentState,
      stateChanges: flow.stateChanges,
      totalInterruptions: flow.totalInterruptions,
      timeInState: Date.now() - flow.stateHistory[flow.stateHistory.length - 1].timestamp.getTime(),
      comprehensionLevel: flow.comprehensionLevel,
      engagementScore: flow.engagementScore,
      progress: ((flow.currentSlide + 1) / flow.totalSlides) * 100
    };
  }
}

// Export singleton instance
export const lessonFlowManager = new LessonFlowManagerService();
