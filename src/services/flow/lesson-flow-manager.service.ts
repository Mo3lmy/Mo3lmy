// 📍 المكان: src/services/flow/lesson-flow-manager.service.ts
// الوظيفة: القلب المركزي لإدارة تدفق الدرس بـ State Machine - مُصلح ومُحسن

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
  AUDIO_PLAYING = 'audio_playing',         // تشغيل صوت
  
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
  to: FlowState | ((flow: FlowContext) => FlowState);
  event: string;
  condition?: (flow: FlowContext) => boolean;
  action?: (flow: FlowContext) => Promise<void>;
}

/**
 * سياق التدفق الكامل - محسن
 */
export interface FlowContext extends LessonFlow {
  currentState: FlowState;
  previousState: FlowState | null;
  stateHistory: Array<{
    state: FlowState;
    timestamp: Date;
    trigger?: string;
  }>;
  
  // Slide Management
  currentSlideHTML?: string;
  currentSlideReady: boolean;
  slidesGenerated: Map<number, string>; // Cache للشرائح المولدة
  
  // Audio Management
  currentAudioUrl?: string;
  audioQueue: string[];
  isAudioPlaying: boolean;
  audioTimestamp: number;
  
  // Flags
  isInterrupted: boolean;
  isWaitingForResponse: boolean;
  hasUserEngaged: boolean;
  modeSelected: boolean;
  
  // Timers
  stateTimeout?: NodeJS.Timeout;
  idleTimer?: NodeJS.Timeout;
  audioTimer?: NodeJS.Timeout;
  
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
   * إعداد جدول الانتقالات المسموح بها - مُصلح
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
      
      // === Mode Selection - مُصلح بدون تكرار ===
      {
        from: [FlowState.WAITING_FOR_MODE],
        to: (flow: FlowContext) => {
          // Dynamic state selection based on mode
          if (flow.mode === 'chat_only') return FlowState.CHATTING;
          if (flow.mode === 'slides_only' || flow.mode === 'slides_with_voice' || flow.mode === 'interactive') {
            return FlowState.PRESENTING;
          }
          return FlowState.WAITING_FOR_MODE;
        },
        event: 'mode_selected',
        action: async (flow) => {
          flow.modeSelected = true;
          if (flow.mode === 'chat_only') {
            await this.startChatMode(flow);
          } else {
            await this.startPresentation(flow);
          }
        }
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
        to: FlowState.AUDIO_PLAYING,
        event: 'play_audio',
        action: async (flow) => await this.playSlideAudio(flow)
      },
      
      {
        from: [FlowState.AUDIO_PLAYING],
        to: FlowState.PROGRESSIVE_REVEALING,
        event: 'audio_complete',
        action: async (flow) => await this.handleAudioComplete(flow)
      },
      
      {
        from: [FlowState.PROGRESSIVE_REVEALING],
        to: FlowState.PRESENTING,
        event: 'reveal_complete',
        action: async (flow) => await this.handleRevealComplete(flow)
      },
      
      {
        from: [FlowState.PRESENTING, FlowState.PROGRESSIVE_REVEALING, FlowState.AUDIO_PLAYING],
        to: FlowState.PAUSED,
        event: 'pause',
        action: async (flow) => await this.pauseFlow(flow)
      },
      
      {
        from: [FlowState.PAUSED],
        to: (flow: FlowContext) => flow.previousState || FlowState.PRESENTING,
        event: 'resume',
        action: async (flow) => await this.resumeFlow(flow)
      },
      
      // === Interaction Transitions ===
      {
        from: [FlowState.PRESENTING, FlowState.PROGRESSIVE_REVEALING, FlowState.CHATTING, FlowState.AUDIO_PLAYING],
        to: FlowState.ANSWERING_QUESTION,
        event: 'user_question',
        action: async (flow) => await this.handleUserQuestion(flow)
      },
      
      {
        from: [FlowState.ANSWERING_QUESTION],
        to: (flow: FlowContext) => {
          if (flow.mode === 'chat_only') return FlowState.CHATTING;
          return flow.previousState || FlowState.PRESENTING;
        },
        event: 'answer_complete',
        action: async (flow) => {
          if (flow.mode !== 'chat_only') {
            await this.returnToPresentation(flow);
          }
        }
      },
      
      // === Navigation ===
      {
        from: [FlowState.PRESENTING, FlowState.PROGRESSIVE_REVEALING],
        to: FlowState.PRESENTING,
        event: 'next_slide',
        action: async (flow) => await this.navigateToNextSlide(flow)
      },
      
      {
        from: [FlowState.PRESENTING, FlowState.PROGRESSIVE_REVEALING],
        to: FlowState.PRESENTING,
        event: 'previous_slide',
        action: async (flow) => await this.navigateToPreviousSlide(flow)
      },
      
      {
        from: [FlowState.PRESENTING, FlowState.PROGRESSIVE_REVEALING],
        to: FlowState.PRESENTING,
        event: 'repeat_slide',
        action: async (flow) => await this.repeatCurrentSlide(flow)
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
    
    lessonOrchestrator.on('slideGenerated', (data) => {
      this.handleSlideGenerated(data);
    });
    
    lessonOrchestrator.on('audioGenerated', (data) => {
      this.handleAudioGenerated(data);
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
   * إنشاء تدفق جديد للدرس - محسن
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
    
    // Create flow context - محسن
    const flowContext: FlowContext = {
      ...lessonFlow,
      currentState: FlowState.IDLE,
      previousState: null,
      stateHistory: [{
        state: FlowState.IDLE,
        timestamp: new Date(),
        trigger: 'creation'
      }],
      // Slide Management
      currentSlideReady: false,
      slidesGenerated: new Map(),
      
      // Audio Management
      audioQueue: [],
      isAudioPlaying: false,
      audioTimestamp: 0,
      
      // Flags
      isInterrupted: false,
      isWaitingForResponse: false,
      hasUserEngaged: false,
      modeSelected: false,
      
      // Metrics
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
   * الانتقال لحالة جديدة - محسن مع دعم dynamic states
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
    
    // Apply payload to flow if provided
    if (payload) {
      Object.assign(flow, payload);
    }
    
    // Find valid transition
    const validTransition = this.transitions.find(t =>
      t.event === event &&
      t.from.includes(flow.currentState) &&
      (!t.condition || t.condition(flow))
    );
    
    if (!validTransition) {
      console.warn(`⚠️ No valid transition found for: ${flow.currentState} -> ${event}`);
      return false;
    }
    
    // Determine target state (support for dynamic state)
    const targetState = typeof validTransition.to === 'function' 
      ? validTransition.to(flow) 
      : validTransition.to;
    
    console.log(`🔄 State transition: ${flow.currentState} -> ${targetState} (${event})`);
    
    // Update state
    flow.previousState = flow.currentState;
    flow.currentState = targetState;
    flow.stateChanges++;
    
    // Add to history
    flow.stateHistory.push({
      state: targetState,
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
    flow.conversationState.lastUserMessage = message;
    
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
      case FlowState.AUDIO_PLAYING:
        // Interrupt presentation for question
        await this.transition(userId, lessonId, 'user_question', { message });
        break;
        
      case FlowState.CHATTING:
        await this.handleChatMessage(flow, message);
        break;
        
      case FlowState.QUIZ_MODE:
        await this.handleQuizAnswer(flow, message);
        break;
        
      case FlowState.PAUSED:
        // Check if user wants to resume
        if (message.includes('استمر') || message.includes('continue')) {
          await this.transition(userId, lessonId, 'resume');
        } else {
          await this.handleChatMessage(flow, message);
        }
        break;
        
      default:
        // Process through orchestrator
        await lessonOrchestrator.processUserMessage(userId, lessonId, message);
    }
  }
  
  /**
   * التحكم في العرض
   */
  async handlePresentationControl(
    userId: string,
    lessonId: string,
    action: 'pause' | 'resume' | 'next' | 'previous' | 'skip' | 'repeat'
  ): Promise<void> {
    const flow = this.getFlow(userId, lessonId);
    if (!flow) return;
    
    switch(action) {
      case 'pause':
        await this.transition(userId, lessonId, 'pause');
        break;
      case 'resume':
        await this.transition(userId, lessonId, 'resume');
        break;
      case 'next':
        await this.transition(userId, lessonId, 'next_slide');
        break;
      case 'previous':
        await this.transition(userId, lessonId, 'previous_slide');
        break;
      case 'repeat':
        await this.transition(userId, lessonId, 'repeat_slide');
        break;
      case 'skip':
        // Skip to next section
        flow.currentSlide = flow.sections[flow.currentSection].slides.length - 1;
        await this.transition(userId, lessonId, 'next_slide');
        break;
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
      // Clear all timers
      if (flow.stateTimeout) clearTimeout(flow.stateTimeout);
      if (flow.idleTimer) clearTimeout(flow.idleTimer);
      if (flow.audioTimer) clearTimeout(flow.audioTimer);
      
      // Clear progressive reveal timers
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
   * معالج بدء الدرس - محسن
   */
  private async handleLessonStart(flow: FlowContext): Promise<void> {
    console.log(`🎯 Starting lesson flow for ${flow.lessonId}`);
    
    // إرسال رسالة ترحيب مع معلومات أساسية عن الدرس
    const welcomeMessage = `مرحباً بك في درس "${flow.lessonTitle}"! 🌟
    
📚 المادة: ${flow.subjectName}
⏱️ المدة المتوقعة: ${flow.estimatedDuration} دقيقة
📊 عدد الأقسام: ${flow.sections.length}
🎯 الهدف: سنتعلم اليوم ${flow.sections[0]?.objectives?.[0] || 'مفاهيم مهمة في هذا الدرس'}

جاري تحضير الدرس...`;
    
    websocketService.sendToUser(flow.userId, 'lesson_welcome', {
      lessonId: flow.lessonId,
      message: welcomeMessage,
      lessonInfo: {
        title: flow.lessonTitle,
        subject: flow.subjectName,
        grade: flow.grade,
        sections: flow.sections.map(s => ({
          title: s.title,
          slides: s.slides.length
        })),
        totalSlides: flow.totalSlides,
        estimatedDuration: flow.estimatedDuration
      }
    });
    
    // Move to initialized state after brief delay
    setTimeout(() => {
      this.transition(flow.userId, flow.lessonId, 'initialized');
    }, 1500);
  }
  
  /**
   * عرض خيارات طريقة العرض - محسن
   */
  private async presentModeSelection(flow: FlowContext): Promise<void> {
    flow.isWaitingForResponse = true;
    flow.conversationState.waitingForUserChoice = true;
    
    const options = [
      { 
        id: 'slides_with_voice', 
        label: '🎤 شرائح مع شرح صوتي', 
        description: 'أفضل تجربة تعليمية كاملة',
        recommended: true
      },
      { 
        id: 'slides_only', 
        label: '🖼️ شرائح تفاعلية فقط', 
        description: 'عرض مرئي بدون صوت'
      },
      { 
        id: 'chat_only', 
        label: '💬 محادثة تعليمية', 
        description: 'تعلم من خلال الحوار والأسئلة'
      },
      { 
        id: 'interactive', 
        label: '🚀 تجربة تفاعلية كاملة', 
        description: 'شرائح + صوت + محادثة'
      }
    ];
    
    websocketService.sendToUser(flow.userId, 'choose_mode', {
      lessonId: flow.lessonId,
      options,
      message: 'كيف تريد أن نبدأ الدرس؟ اختر الطريقة المناسبة لك:',
      hint: 'يمكنك الكتابة مباشرة مثل: "اشرح بالشرائح والصوت" أو النقر على أحد الخيارات'
    });
    
    // Set timeout for auto-selection (default to recommended)
    flow.stateTimeout = setTimeout(() => {
      if (flow.currentState === FlowState.WAITING_FOR_MODE && !flow.modeSelected) {
        console.log('⏱️ Auto-selecting recommended mode after timeout');
        flow.mode = 'slides_with_voice';
        this.transition(flow.userId, flow.lessonId, 'mode_selected');
      }
    }, 30000); // 30 seconds
  }
  
  /**
   * بدء عرض الشرائح - محسن بدعم كامل
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
    
    // إرسال إشعار ببدء العرض
    websocketService.sendToUser(flow.userId, 'presentation_starting', {
      lessonId: flow.lessonId,
      mode: flow.mode,
      message: this.getModeStartMessage(flow.mode),
      controls: {
        canPause: true,
        canSkip: true,
        canNavigate: true,
        canAskQuestions: true,
        canChangeSpeed: flow.mode === 'slides_with_voice'
      }
    });
    
    // Start generating first slide
    await this.generateAndShowSlide(flow, 0);
    
    // إذا كان هناك صوت، ابدأ توليد الصوت
    if (flow.mode === 'slides_with_voice' || flow.mode === 'interactive') {
      flow.voiceEnabled = true;
      await this.generateSlideAudio(flow, 0);
    }
    
    // Start with orchestrator
    await lessonOrchestrator.startPresentation(flow);
    
    // Set idle timer
    this.setupIdleTimer(flow);
    
    // Auto-start progressive reveal if enabled
    if (flow.progressiveReveal) {
      setTimeout(() => {
        this.transition(flow.userId, flow.lessonId, 'start_progressive');
      }, 2000);
    }
  }
  
  /**
   * توليد وعرض شريحة
   */
  private async generateAndShowSlide(flow: FlowContext, slideNumber: number): Promise<void> {
    const slide = flow.sections[flow.currentSection]?.slides[slideNumber];
    if (!slide) return;
    
    // Check cache first
    if (flow.slidesGenerated.has(slideNumber)) {
      flow.currentSlideHTML = flow.slidesGenerated.get(slideNumber);
      flow.currentSlideReady = true;
    } else {
      // Generate slide HTML locally or through public method
      // Since generateSlideHTML is private, we'll generate it here
      flow.currentSlideHTML = await this.createSlideHTML(slide, flow);
      flow.slidesGenerated.set(slideNumber, flow.currentSlideHTML!);
      flow.currentSlideReady = true;
    }
    
    // Send slide to client
    websocketService.sendToUser(flow.userId, 'slide_ready', {
      lessonId: flow.lessonId,
      slideNumber,
      html: flow.currentSlideHTML,
      slide: {
        ...slide,
        hasAudio: flow.voiceEnabled,
        hasPoints: slide.points && slide.points.length > 0
      },
      navigation: {
        current: slideNumber + 1,
        total: flow.totalSlides,
        canGoBack: slideNumber > 0,
        canGoForward: slideNumber < flow.totalSlides - 1
      }
    });
  }
  
  /**
   * توليد صوت للشريحة
   */
  private async generateSlideAudio(flow: FlowContext, slideNumber: number): Promise<void> {
    const slide = flow.sections[flow.currentSection]?.slides[slideNumber];
    if (!slide || !flow.voiceEnabled) return;
    
    // Generate audio for slide content
    const audioText = this.prepareAudioText(slide);
    
    // This would call audio generation service
    // For now, simulate with mock
    const audioUrl = `/api/audio/slide-${slideNumber}.mp3`;
    flow.currentAudioUrl = audioUrl;
    flow.audioQueue.push(audioUrl);
    
    websocketService.sendToUser(flow.userId, 'audio_ready', {
      lessonId: flow.lessonId,
      slideNumber,
      audioUrl,
      duration: slide.duration || 20,
      text: audioText
    });
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
      message: `ممتاز! سنتعلم درس "${flow.lessonTitle}" من خلال المحادثة.
      
يمكنك أن تسألني عن أي شيء في الدرس، أو تطلب:
• شرح أي مفهوم
• أمثلة توضيحية
• حل تمارين
• اختبار سريع

كيف يمكنني مساعدتك؟`,
      suggestions: [
        'اشرح لي الدرس من البداية',
        'ما هي النقاط الرئيسية؟',
        'أعطني مثال',
        'اختبرني في الدرس'
      ]
    });
    
    // Clear timeout
    if (flow.stateTimeout) {
      clearTimeout(flow.stateTimeout);
    }
  }
  
  /**
   * بدء الكشف التدريجي - محسن
   */
  private async startProgressiveReveal(flow: FlowContext): Promise<void> {
    const slide = flow.sections[flow.currentSection]?.slides[flow.currentSlide];
    if (!slide || !slide.points || slide.points.length === 0) {
      // No points to reveal, complete immediately
      await this.transition(flow.userId, flow.lessonId, 'reveal_complete');
      return;
    }
    
    console.log(`✨ Starting progressive reveal for slide ${flow.currentSlide} with ${slide.points.length} points`);
    
    flow.progressiveState.isRevealing = true;
    flow.progressiveState.currentPointIndex = 0;
    flow.progressiveState.pointsRevealed = [];
    
    // Send notification
    websocketService.sendToUser(flow.userId, 'progressive_reveal_started', {
      lessonId: flow.lessonId,
      slideNumber: flow.currentSlide,
      totalPoints: slide.points.length,
      estimatedDuration: slide.points.length * (flow.revealDelay || 3)
    });
    
    // Start revealing points
    await this.revealNextPoint(flow);
  }
  
  /**
   * كشف النقطة التالية
   */
  private async revealNextPoint(flow: FlowContext): Promise<void> {
    const slide = flow.sections[flow.currentSection]?.slides[flow.currentSlide];
    if (!slide || !slide.points) return;
    
    const currentIndex = flow.progressiveState.currentPointIndex;
    
    if (currentIndex >= slide.points.length) {
      // All points revealed
      await this.transition(flow.userId, flow.lessonId, 'reveal_complete');
      return;
    }
    
    // Reveal current point
    const point = slide.points[currentIndex];
    flow.progressiveState.pointsRevealed.push(currentIndex);
    
    // Send point to client
    websocketService.sendToUser(flow.userId, 'point_revealed', {
      lessonId: flow.lessonId,
      slideNumber: flow.currentSlide,
      pointIndex: currentIndex,
      content: point,
      animation: 'fadeIn',
      remainingPoints: slide.points.length - currentIndex - 1
    });
    
    // If audio enabled, play audio for this point
    if (flow.voiceEnabled && !flow.isPaused) {
      await this.transition(flow.userId, flow.lessonId, 'play_audio', {
        audioText: point,
        pointIndex: currentIndex
      });
    } else {
      // Move to next point after delay
      flow.progressiveState.currentPointIndex++;
      
      if (!flow.isPaused && flow.progressiveState.currentPointIndex < slide.points.length) {
        const delay = (flow.revealDelay || 3) * 1000 / flow.playbackSpeed;
        flow.progressiveState.revealTimers.push(
          setTimeout(() => {
            this.revealNextPoint(flow);
          }, delay)
        );
      }
    }
  }
  
  /**
   * تشغيل صوت الشريحة
   */
  private async playSlideAudio(flow: FlowContext): Promise<void> {
    flow.isAudioPlaying = true;
    const audioText = (flow as any).audioText || '';
    const pointIndex = (flow as any).pointIndex || 0;
    
    // Generate and stream audio
    websocketService.sendToUser(flow.userId, 'audio_playing', {
      lessonId: flow.lessonId,
      slideNumber: flow.currentSlide,
      pointIndex,
      text: audioText,
      isStreaming: true
    });
    
    // Simulate audio duration (would be actual duration in production)
    const duration = this.estimateAudioDuration(audioText);
    
    flow.audioTimer = setTimeout(() => {
      this.transition(flow.userId, flow.lessonId, 'audio_complete');
    }, duration);
  }
  
  /**
   * معالجة اكتمال الصوت
   */
  private async handleAudioComplete(flow: FlowContext): Promise<void> {
    flow.isAudioPlaying = false;
    
    // Move to next point
    flow.progressiveState.currentPointIndex++;
    
    const slide = flow.sections[flow.currentSection]?.slides[flow.currentSlide];
    if (!slide || !slide.points) return;
    
    if (flow.progressiveState.currentPointIndex < slide.points.length) {
      // Continue revealing
      await this.revealNextPoint(flow);
    } else {
      // All points revealed
      await this.transition(flow.userId, flow.lessonId, 'reveal_complete');
    }
  }
  
  /**
   * معالجة اكتمال الكشف التدريجي
   */
  private async handleRevealComplete(flow: FlowContext): Promise<void> {
    flow.progressiveState.isRevealing = false;
    
    websocketService.sendToUser(flow.userId, 'reveal_complete', {
      lessonId: flow.lessonId,
      slideNumber: flow.currentSlide,
      totalPoints: flow.progressiveState.pointsRevealed.length,
      message: 'اكتملت الشريحة، جاهز للانتقال للتالية'
    });
    
    // Auto-advance if enabled
    if (flow.autoAdvance && flow.currentSlide < flow.totalSlides - 1 && !flow.isPaused) {
      flow.stateTimeout = setTimeout(() => {
        this.transition(flow.userId, flow.lessonId, 'next_slide');
      }, 5000);
    }
  }
  
  /**
   * الانتقال للشريحة التالية
   */
  private async navigateToNextSlide(flow: FlowContext): Promise<void> {
    if (flow.currentSlide >= flow.totalSlides - 1) {
      // Last slide, check for next section
      await this.transition(flow.userId, flow.lessonId, 'section_finished');
      return;
    }
    
    flow.currentSlide++;
    flow.progressiveState.pointsRevealed = [];
    flow.progressiveState.currentPointIndex = 0;
    
    // Generate and show new slide
    await this.generateAndShowSlide(flow, flow.currentSlide);
    
    // Generate audio if needed
    if (flow.voiceEnabled) {
      await this.generateSlideAudio(flow, flow.currentSlide);
    }
    
    // Start progressive reveal if enabled
    if (flow.progressiveReveal) {
      setTimeout(() => {
        this.transition(flow.userId, flow.lessonId, 'start_progressive');
      }, 1000);
    }
  }
  
  /**
   * الانتقال للشريحة السابقة
   */
  private async navigateToPreviousSlide(flow: FlowContext): Promise<void> {
    if (flow.currentSlide <= 0) {
      websocketService.sendToUser(flow.userId, 'navigation_blocked', {
        message: 'أنت في البداية بالفعل'
      });
      return;
    }
    
    flow.currentSlide--;
    flow.progressiveState.pointsRevealed = [];
    flow.progressiveState.currentPointIndex = 0;
    
    await this.generateAndShowSlide(flow, flow.currentSlide);
    
    if (flow.voiceEnabled) {
      await this.generateSlideAudio(flow, flow.currentSlide);
    }
  }
  
  /**
   * إعادة الشريحة الحالية
   */
  private async repeatCurrentSlide(flow: FlowContext): Promise<void> {
    flow.progressiveState.pointsRevealed = [];
    flow.progressiveState.currentPointIndex = 0;
    
    // Clear any existing timers
    flow.progressiveState.revealTimers.forEach(timer => clearTimeout(timer));
    flow.progressiveState.revealTimers = [];
    
    // Show slide again
    await this.generateAndShowSlide(flow, flow.currentSlide);
    
    // Generate audio if needed
    if (flow.voiceEnabled) {
      await this.generateSlideAudio(flow, flow.currentSlide);
    }
    
    // Start progressive reveal
    if (flow.progressiveReveal) {
      setTimeout(() => {
        this.transition(flow.userId, flow.lessonId, 'start_progressive');
      }, 1000);
    }
    
    websocketService.sendToUser(flow.userId, 'slide_repeated', {
      message: 'نعيد الشريحة من البداية'
    });
  }
  
  /**
   * إيقاف مؤقت - محسن
   */
  private async pauseFlow(flow: FlowContext): Promise<void> {
    flow.isPaused = true;
    
    // Clear all timers
    if (flow.stateTimeout) {
      clearTimeout(flow.stateTimeout);
      flow.stateTimeout = undefined;
    }
    if (flow.audioTimer) {
      clearTimeout(flow.audioTimer);
      flow.audioTimer = undefined;
    }
    
    // Clear progressive reveal timers
    flow.progressiveState.revealTimers.forEach(timer => clearTimeout(timer));
    flow.progressiveState.revealTimers = [];
    
    // Pause audio if playing
    if (flow.isAudioPlaying) {
      flow.audioTimestamp = Date.now();
    }
    
    await lessonOrchestrator.pausePresentation(flow);
    
    websocketService.sendToUser(flow.userId, 'presentation_paused', {
      lessonId: flow.lessonId,
      message: 'تم إيقاف العرض مؤقتاً',
      canResume: true,
      currentProgress: {
        slide: flow.currentSlide + 1,
        totalSlides: flow.totalSlides,
        pointsRevealed: flow.progressiveState.pointsRevealed.length
      }
    });
  }
  
  /**
   * استئناف - محسن
   */
  private async resumeFlow(flow: FlowContext): Promise<void> {
    flow.isPaused = false;
    
    const targetState = flow.previousState || FlowState.PRESENTING;
    
    await lessonOrchestrator.resumePresentation(flow);
    
    websocketService.sendToUser(flow.userId, 'presentation_resumed', {
      lessonId: flow.lessonId,
      message: 'نستكمل العرض',
      resumedAt: targetState
    });
    
    // Resume based on previous state
    if (targetState === FlowState.PROGRESSIVE_REVEALING) {
      // Continue revealing points
      await this.revealNextPoint(flow);
    } else if (targetState === FlowState.AUDIO_PLAYING && flow.audioTimestamp) {
      // Resume audio
      const remainingDuration = Date.now() - flow.audioTimestamp;
      flow.audioTimer = setTimeout(() => {
        this.transition(flow.userId, flow.lessonId, 'audio_complete');
      }, Math.max(1000, remainingDuration));
    }
    
    // Restart idle timer if needed
    if (flow.autoAdvance) {
      this.setupIdleTimer(flow);
    }
  }
  
  /**
   * معالجة سؤال المستخدم - محسن
   */
  private async handleUserQuestion(flow: FlowContext): Promise<void> {
    flow.totalInterruptions++;
    flow.isInterrupted = true;
    
    const question = flow.conversationState.lastUserMessage || '';
    
    // تحليل السؤال لمعرفة إذا كان متعلق بالدرس
    const isRelatedToLesson = await this.checkQuestionRelevance(flow, question);
    
    // Pause if presenting
    if (flow.isPresenting && !flow.isPaused) {
      await lessonOrchestrator.pausePresentation(flow);
    }
    
    // Send to chat service
    await realtimeChatService.handleUserMessage(
      flow.userId,
      flow.lessonId,
      question,
      ''
    );
    
    // إذا كان السؤال متعلق بالدرس، أظهر إشارة
    if (isRelatedToLesson) {
      websocketService.sendToUser(flow.userId, 'question_context', {
        isRelated: true,
        currentTopic: flow.sections[flow.currentSection]?.title,
        willResume: flow.mode !== 'chat_only'
      });
    } else {
      websocketService.sendToUser(flow.userId, 'question_context', {
        isRelated: false,
        suggestion: 'هذا السؤال خارج نطاق الدرس الحالي، لكن سأجيبك عليه',
        currentLesson: flow.lessonTitle
      });
    }
  }
  
  /**
   * التحقق من صلة السؤال بالدرس
   */
  private async checkQuestionRelevance(flow: FlowContext, question: string): Promise<boolean> {
    // Check if question contains lesson keywords
    const lessonKeywords = [
      flow.lessonTitle,
      ...flow.sections.map(s => s.title),
      ...(flow.sections[flow.currentSection]?.keywords || [])
    ].filter(Boolean);
    
    const questionLower = question.toLowerCase();
    return lessonKeywords.some(keyword => 
      keyword && questionLower.includes(keyword.toLowerCase())
    );
  }
  
  /**
   * إنشاء HTML للشريحة
   */
  private async createSlideHTML(slide: any, flow: FlowContext): Promise<string> {
    // Generate slide HTML based on slide type
    const theme = flow.theme || 'default';
    const isArabic = true; // Default to Arabic
    
    let html = `
      <div class="slide slide-${slide.type || 'content'}" data-slide-number="${slide.number}">
        <div class="slide-content">
    `;
    
    // Add title if exists
    if (slide.content?.title) {
      html += `<h2 class="slide-title">${slide.content.title}</h2>`;
    }
    
    // Add content based on type
    switch (slide.type) {
      case 'title':
        html += `
          <h1 class="main-title">${slide.content.title || flow.lessonTitle}</h1>
          ${slide.content.subtitle ? `<p class="subtitle">${slide.content.subtitle}</p>` : ''}
        `;
        break;
        
      case 'bullet':
      case 'bullets':
        if (slide.content.bullets || slide.points) {
          html += '<ul class="bullet-points">';
          const items = slide.content.bullets || slide.points;
          items.forEach((item: string, index: number) => {
            html += `
              <li class="bullet-item" data-index="${index}" style="animation-delay: ${index * 0.2}s">
                ${item}
              </li>
            `;
          });
          html += '</ul>';
        }
        break;
        
      case 'content':
      default:
        if (slide.content.text) {
          html += `<div class="text-content">${slide.content.text}</div>`;
        }
        if (slide.points && slide.points.length > 0) {
          html += '<div class="progressive-points">';
          slide.points.forEach((point: string, index: number) => {
            html += `
              <div class="point" data-index="${index}" style="display: none;">
                ${point}
              </div>
            `;
          });
          html += '</div>';
        }
        break;
    }
    
    html += `
        </div>
        <div class="slide-footer">
          <span class="slide-number">${slide.number + 1} / ${flow.totalSlides}</span>
        </div>
      </div>
    `;
    
    return html;
  }
  
  // ============= HELPER METHODS =============
  
  /**
   * معالجة اختيار طريقة العرض - محسن
   */
  private async handleModeSelection(flow: FlowContext, message: string): Promise<void> {
    const lowerMessage = message.toLowerCase();
    
    let selectedMode: string | null = null;
    
    // Extended pattern matching
    if (lowerMessage.includes('محادث') || lowerMessage.includes('حوار') || 
        lowerMessage.includes('chat') || lowerMessage.includes('كلام')) {
      selectedMode = 'chat_only';
    } else if ((lowerMessage.includes('شرائح') || lowerMessage.includes('شريح') || 
                lowerMessage.includes('slide')) && 
               (lowerMessage.includes('صوت') || lowerMessage.includes('شرح') ||
                lowerMessage.includes('voice') || lowerMessage.includes('audio'))) {
      selectedMode = 'slides_with_voice';
    } else if (lowerMessage.includes('شرائح') || lowerMessage.includes('عرض') ||
               lowerMessage.includes('slide') || lowerMessage.includes('مرئي')) {
      selectedMode = 'slides_only';
    } else if (lowerMessage.includes('كامل') || lowerMessage.includes('تفاعل') ||
               lowerMessage.includes('interactive') || lowerMessage.includes('الكل')) {
      selectedMode = 'interactive';
    } else if (lowerMessage.includes('اشرح') || lowerMessage.includes('ابدأ')) {
      // Default to recommended mode
      selectedMode = 'slides_with_voice';
    }
    
    if (selectedMode) {
      flow.mode = selectedMode as any;
      flow.conversationState.waitingForUserChoice = false;
      flow.modeSelected = true;
      
      // Clear timeout
      if (flow.stateTimeout) {
        clearTimeout(flow.stateTimeout);
        flow.stateTimeout = undefined;
      }
      
      await this.transition(flow.userId, flow.lessonId, 'mode_selected');
    } else {
      websocketService.sendToUser(flow.userId, 'invalid_choice', {
        message: 'لم أفهم اختيارك. من فضلك اختر إحدى الطرق المتاحة أو اكتب: "شرائح مع صوت" أو "محادثة فقط"',
        showOptions: true
      });
    }
  }
  
  /**
   * معالجة رسالة في وضع المحادثة
   */
  private async handleChatMessage(flow: FlowContext, message: string): Promise<void> {
    // Check for mode switch commands
    if ((message.includes('شرائح') || message.includes('عرض')) && 
        !flow.isPresenting) {
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
   * معالج لتوليد الشريحة من Orchestrator
   */
  private handleSlideGenerated(data: any): void {
    const flow = this.getFlow(data.userId, data.lessonId);
    if (!flow) return;
    
    // Cache the generated slide
    if (data.slideHTML) {
      flow.slidesGenerated.set(data.slideNumber, data.slideHTML);
    }
    
    // If this is the current slide, update
    if (data.slideNumber === flow.currentSlide) {
      flow.currentSlideHTML = data.slideHTML;
      flow.currentSlideReady = true;
    }
  }
  
  /**
   * معالج لتوليد الصوت من Orchestrator
   */
  private handleAudioGenerated(data: any): void {
    const flow = this.getFlow(data.userId, data.lessonId);
    if (!flow) return;
    
    if (data.audioUrl) {
      flow.audioQueue.push(data.audioUrl);
      
      // If this is for current slide, update
      if (data.slideNumber === flow.currentSlide) {
        flow.currentAudioUrl = data.audioUrl;
      }
    }
  }
  
  /**
   * الحصول على رسالة بدء حسب النوع
   */
  private getModeStartMessage(mode: string): string {
    switch(mode) {
      case 'slides_with_voice':
        return 'نبدأ الآن بعرض الشرائح مع الشرح الصوتي. استمع جيداً ويمكنك السؤال في أي وقت.';
      case 'slides_only':
        return 'نعرض الآن الشرائح التفاعلية. اقرأ بتمعن ويمكنك التحكم في السرعة.';
      case 'chat_only':
        return 'نتعلم الآن من خلال المحادثة. اسأل أي سؤال أو اطلب شرح أي جزء.';
      case 'interactive':
        return 'تجربة تفاعلية كاملة! شرائح وصوت ومحادثة. استمتع بالتعلم!';
      default:
        return 'نبدأ الدرس الآن...';
    }
  }
  
  /**
   * تحضير النص للصوت
   */
  private prepareAudioText(slide: any): string {
    let text = '';
    
    if (slide.content.title) {
      text += slide.content.title + '. ';
    }
    
    if (slide.points && slide.points.length > 0) {
      text += slide.points.join('. ') + '.';
    } else if (slide.content.text) {
      text += slide.content.text;
    }
    
    return text;
  }
  
  /**
   * تقدير مدة الصوت
   */
  private estimateAudioDuration(text: string): number {
    // Estimate ~150 words per minute in Arabic
    const words = text.split(' ').length;
    const minutes = words / 150;
    return Math.max(2000, Math.floor(minutes * 60 * 1000)); // minimum 2 seconds
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
          message: 'هل ما زلت متابع؟ 👀',
          suggestions: ['نعم، أكمل', 'توقف قليلاً', 'لدي سؤال', 'أعد الشرح']
        });
      }
    }, 60000); // 1 minute
  }
  
  // ... باقي الـ methods كما هي (لم تتغير)
  
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
      if (currentSlide?.points && currentSlide.points.length > 0 && flow.progressiveReveal) {
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
  
  // ... باقي الـ helper methods كما هي
  
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
      const responseText = typeof quizResponse === 'string' 
        ? quizResponse 
        : (quizResponse as any).content || (quizResponse as any).text || '';
      
      quizData = JSON.parse(responseText);
    } catch {
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
   * معالجة إجابة الاختبار
   */
  private async handleQuizAnswer(flow: FlowContext, answer: string): Promise<void> {
    // Process quiz answer
    websocketService.sendToUser(flow.userId, 'quiz_answer_result', {
      lessonId: flow.lessonId,
      correct: true,
      explanation: 'شرح الإجابة...'
    });
    
    setTimeout(() => {
      this.transition(flow.userId, flow.lessonId, 'quiz_complete');
    }, 3000);
  }
  
  /**
   * معالجة اكتمال الاختبار
   */
  private async handleQuizComplete(flow: FlowContext): Promise<void> {
    flow.comprehensionLevel = Math.min(100, flow.comprehensionLevel + 10);
    
    websocketService.sendToUser(flow.userId, 'quiz_completed', {
      lessonId: flow.lessonId,
      comprehensionLevel: flow.comprehensionLevel,
      message: 'أحسنت! لقد أتممت الاختبار بنجاح'
    });
    
    // Resume presentation
    if (flow.mode !== 'chat_only') {
      await this.resumeFlow(flow);
    }
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
      
      // Continue progressive reveal if was active
      if (flow.progressiveState.isRevealing) {
        await this.revealNextPoint(flow);
      }
    }, 2000);
  }
  
  /**
   * معالجة اختيار عام من المستخدم
   */
  private async handleUserChoice(flow: FlowContext, message: string): Promise<void> {
    const action = await lessonOrchestrator.processUserMessage(
      flow.userId,
      flow.lessonId,
      message
    );
    
    if (action) {
      flow.conversationState.waitingForUserChoice = false;
    }
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
    
    flow.currentSlide = nextSection.slides[0]?.number || 0;
    await lessonOrchestrator.presentSlideProgressive(flow, flow.currentSlide);
  }
  
  /**
   * إكمال الدرس
   */
  private async completeLessson(flow: FlowContext): Promise<void> {
    console.log(`🎉 Lesson completed: ${flow.lessonId}`);
    
    flow.actualDuration = Math.floor((Date.now() - flow.startTime.getTime()) / 1000);
    
    const completionMessage = `تهانينا! 🎉 لقد أكملت درس "${flow.lessonTitle}" بنجاح!
    
📊 إحصائياتك:
• المدة: ${Math.floor(flow.actualDuration / 60)} دقيقة
• الشرائح: ${flow.currentSlide + 1} من ${flow.totalSlides}
• الأسئلة: ${flow.questionsAsked} سؤال
• مستوى الفهم: ${flow.comprehensionLevel}%
• التفاعل: ${flow.engagementScore}/10

استمر في التميز! 🌟`;
    
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
    
    await this.saveCompletion(flow);
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
    
    if (flow.previousState) {
      flow.currentState = flow.previousState;
      flow.previousState = FlowState.ERROR;
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
      await prisma.progress.upsert({
        where: {
          userId_lessonId: {
            userId: flow.userId,
            lessonId: flow.lessonId
          }
        },
        update: {
          completedAt: new Date(),
          completionRate: 100,
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
      progress: ((flow.currentSlide + 1) / flow.totalSlides) * 100,
      mode: flow.mode,
      isPresenting: flow.isPresenting,
      isPaused: flow.isPaused,
      hasAudio: flow.voiceEnabled,
      slidesGenerated: flow.slidesGenerated.size,
      audioQueued: flow.audioQueue.length
    };
  }
}

// Export singleton instance
export const lessonFlowManager = new LessonFlowManagerService();