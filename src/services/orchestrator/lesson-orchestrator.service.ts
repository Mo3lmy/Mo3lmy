// 📍 المكان: src/services/orchestrator/lesson-orchestrator.service.ts
// الوظيفة: تنسيق كل الخدمات وإدارة تدفق الدرس - محسن للشرائح التفاعلية والصوت

import { prisma } from '../../config/database.config';
import { websocketService } from '../websocket/websocket.service';
import { sessionService } from '../websocket/session.service';
import { slideGenerator } from '../../core/video/slide.generator';
import { ragService } from '../../core/rag/rag.service';
import { openAIService } from '../ai/openai.service';
import type { Lesson, Unit, Subject } from '@prisma/client';
import { EventEmitter } from 'events';

// استيراد المكونات الرياضية
import { latexRenderer, type MathExpression } from '../../core/interactive/math/latex-renderer';
import { mathSlideGenerator } from '../../core/video/enhanced-slide.generator';

// 🎯 استيراد PROMPT TEMPLATES
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

// ============= ENHANCED TYPES =============

export interface ConversationState {
  isActive: boolean;
  currentContext: string;
  lastUserMessage?: string;
  lastBotResponse?: string;
  waitingForUserChoice: boolean;
  choiceOptions?: Array<{
    id: string;
    label: string;
    icon?: string;
  }>;
  messageHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

export interface ProgressiveRevealState {
  isRevealing: boolean;
  currentPointIndex: number;
  pointsRevealed: number[];
  revealTimers: NodeJS.Timeout[];
  lastRevealTime: Date;
}

export interface LessonFlow {
  id: string;
  lessonId: string;
  userId: string;
  sessionId: string;
  
  // Content Structure
  sections: LessonSection[];
  currentSection: number;
  currentSlide: number;
  totalSlides: number;
  
  // Progressive Display State
  progressiveState: ProgressiveRevealState;
  
  // Conversation State
  conversationState: ConversationState;
  
  // Presentation Mode
  mode: 'chat_only' | 'slides_only' | 'slides_with_voice' | 'interactive';
  isPaused: boolean;
  isPresenting: boolean;
  
  // Timing
  estimatedDuration: number;
  actualDuration: number;
  startTime: Date;
  lastInteractionTime: Date;
  
  // User State
  comprehensionLevel: number;
  engagementScore: number;
  questionsAsked: number;
  interruptionCount: number;
  
  // Settings
  autoAdvance: boolean;
  voiceEnabled: boolean;
  playbackSpeed: number;
  theme: string;
  progressiveReveal: boolean;
  revealDelay: number;
  
  // Math Settings
  isMathLesson?: boolean;
  mathInteractive?: boolean;
  mathProblemsAttempted?: number;
  mathProblemsSolved?: number;
  
  // Lesson Details (للـ Templates)
  lessonTitle?: string;
  subjectName?: string;
  unitTitle?: string;
  grade?: number;
  
  // Audio Management
  audioQueue?: string[];
  currentAudioUrl?: string;
  isAudioPlaying?: boolean;
  
  // Slide Management
  slidesGenerated?: Map<number, string>;
  currentSlideHTML?: string;
  currentSlideReady?: boolean;
}

export interface LessonSection {
  id: string;
  type: 'intro' | 'concept' | 'example' | 'practice' | 'quiz' | 'summary' | 'math-concept' | 'math-practice';
  title: string;
  slides: GeneratedSlide[];
  duration: number;
  completed: boolean;
  
  hasProgressiveContent: boolean;
  progressivePoints?: Array<{
    content: string;
    revealAt: number;
    audioSegment?: string;
    animation?: string;
  }>;
  
  objectives: string[];
  keywords: string[];
  anticipatedQuestions: string[];
  
  mathExpressions?: MathExpression[];
  hasMathContent?: boolean;
}

export interface GeneratedSlide {
  number: number;
  type: string;
  content: any;
  html?: string;
  audioUrl?: string;
  audioSegments?: string[];
  duration: number;
  userSpentTime?: number;
  interactions?: SlideInteraction[];
  
  points?: string[];
  pointTimings?: number[];
  currentRevealedPoint?: number;
  fullyRevealed?: boolean;
  
  isMathSlide?: boolean;
  mathExpressions?: MathExpression[];
}

export interface SlideInteraction {
  type: 'click' | 'question' | 'replay' | 'skip' | 'pause' | 'resume' | 'math-variable-change' | 'equation-solve';
  timestamp: Date;
  data?: any;
}

export interface ActionTrigger {
  trigger: string;
  action: 'generate_slide' | 'show_example' | 'start_quiz' | 'explain_more' | 'simplify' | 'show_video' | 'show_math' | 'solve_equation';
  confidence: number;
  mathRelated?: boolean;
}

// ============= MAIN SERVICE (محسن) =============

export class LessonOrchestratorService extends EventEmitter {
  public activeLessons: Map<string, LessonFlow> = new Map();
  public revealTimers: Map<string, NodeJS.Timeout[]> = new Map();
  private slideCache: Map<string, string> = new Map(); // Cache للشرائح
  private audioCache: Map<string, string> = new Map(); // Cache للصوت
  
  constructor() {
    super();
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.on('slideChanged', (data) => {
      console.log(`📍 Slide changed: ${data.slideNumber}`);
    });
    
    this.on('pointRevealed', (data) => {
      console.log(`✨ Point revealed: ${data.pointIndex} on slide ${data.slideNumber}`);
    });
    
    this.on('slideGenerated', (data) => {
      console.log(`🖼️ Slide generated: ${data.slideNumber}`);
    });
    
    this.on('audioGenerated', (data) => {
      console.log(`🔊 Audio generated for slide: ${data.slideNumber}`);
    });
  }
  
  /**
   * بدء درس جديد محسن
   */
  async startLesson(
    userId: string,
    lessonId: string,
    sessionId: string,
    options?: {
      mode?: 'chat_only' | 'slides_only' | 'slides_with_voice' | 'interactive';
      autoAdvance?: boolean;
      voiceEnabled?: boolean;
      progressiveReveal?: boolean;
      playbackSpeed?: number;
    }
  ): Promise<LessonFlow> {
    console.log('🎯 Starting Enhanced Lesson with Interactive Slides');
    
    const flowKey = `${userId}-${lessonId}`;
    
    // Check existing flow
    if (this.activeLessons.has(flowKey)) {
      console.log('📚 Resuming existing lesson flow');
      const existingFlow = this.activeLessons.get(flowKey)!;
      
      if (options) {
        Object.assign(existingFlow, options);
      }
      
      return existingFlow;
    }
    
    // Load lesson data
    const lesson = await this.loadLessonWithContent(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }
    
    const isMathLesson = this.checkIfMathLesson(lesson);
    const sections = await this.createLessonSectionsWithProgressive(lesson, isMathLesson);
    const totalSlides = sections.reduce((sum, section) => sum + section.slides.length, 0);
    
    // Create flow
    const flow: LessonFlow = {
      id: `flow-${Date.now()}`,
      lessonId,
      userId,
      sessionId,
      sections,
      currentSection: 0,
      currentSlide: 0,
      totalSlides,
      
      progressiveState: {
        isRevealing: false,
        currentPointIndex: 0,
        pointsRevealed: [],
        revealTimers: [],
        lastRevealTime: new Date()
      },
      
      conversationState: {
        isActive: true,
        currentContext: lesson.title,
        waitingForUserChoice: false,
        messageHistory: []
      },
      
      mode: options?.mode || 'interactive',
      isPaused: false,
      isPresenting: false,
      
      estimatedDuration: Math.ceil(totalSlides * 0.5),
      actualDuration: 0,
      startTime: new Date(),
      lastInteractionTime: new Date(),
      
      comprehensionLevel: 75,
      engagementScore: 100,
      questionsAsked: 0,
      interruptionCount: 0,
      
      autoAdvance: options?.autoAdvance ?? true,
      voiceEnabled: options?.voiceEnabled ?? true,
      playbackSpeed: options?.playbackSpeed || 1,
      theme: this.getThemeByGrade(lesson.unit.subject.grade),
      progressiveReveal: options?.progressiveReveal ?? true,
      revealDelay: 3,
      
      isMathLesson,
      mathInteractive: isMathLesson,
      mathProblemsAttempted: 0,
      mathProblemsSolved: 0,
      
      lessonTitle: lesson.titleAr || lesson.title,
      subjectName: lesson.unit.subject.nameAr || lesson.unit.subject.name,
      unitTitle: lesson.unit.title,
      grade: lesson.unit.subject.grade,
      
      // Audio & Slide Management
      audioQueue: [],
      slidesGenerated: new Map(),
      currentSlideReady: false
    };
    
    this.activeLessons.set(flowKey, flow);
    
    // Pre-generate initial slides
    await this.generateInitialSlides(flow);
    
    // Send welcome message
    await this.sendLessonWelcome(flow);
    
    this.emit('flowStarted', {
      userId,
      lessonId,
      flowId: flow.id,
      mode: flow.mode,
      totalSlides,
      voiceEnabled: flow.voiceEnabled
    });
    
    console.log(`✅ Lesson flow created: ${totalSlides} slides in ${sections.length} sections`);
    
    return flow;
  }
  
  /**
   * توليد HTML للشريحة - PUBLIC METHOD للـ Flow Manager
   */
  public async generateSlideHTML(flow: LessonFlow, slide: GeneratedSlide): Promise<string> {
    // Check cache first
    const cacheKey = `${flow.lessonId}-${slide.number}`;
    if (this.slideCache.has(cacheKey)) {
      return this.slideCache.get(cacheKey)!;
    }
    
    let html = '';
    
    if (slide.isMathSlide) {
      html = await this.generateMathSlideHTML(slide, flow);
    } else {
      html = await this.generateRegularSlideHTML(slide, flow);
    }
    
    // Cache the result
    this.slideCache.set(cacheKey, html);
    
    // Emit event
    this.emit('slideGenerated', {
      userId: flow.userId,
      lessonId: flow.lessonId,
      slideNumber: slide.number,
      slideHTML: html
    });
    
    return html;
  }
  
  /**
   * توليد صوت للشريحة - PUBLIC METHOD
   */
  public async generateSlideAudio(flow: LessonFlow, slide: GeneratedSlide): Promise<string> {
    // Check cache first
    const cacheKey = `audio-${flow.lessonId}-${slide.number}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }
    
    // Prepare audio text
    let audioText = '';
    
    if (slide.content.title) {
      audioText += slide.content.title + '. ';
    }
    
    if (slide.points && slide.points.length > 0) {
      audioText += slide.points.join('. ') + '.';
    } else if (slide.content.text) {
      audioText += slide.content.text;
    }
    
    // Generate audio URL (mock for now)
    const audioUrl = `/api/audio/lesson-${flow.lessonId}/slide-${slide.number}.mp3`;
    
    // Cache the result
    this.audioCache.set(cacheKey, audioUrl);
    
    // Emit event
    this.emit('audioGenerated', {
      userId: flow.userId,
      lessonId: flow.lessonId,
      slideNumber: slide.number,
      audioUrl,
      audioText,
      duration: this.estimateAudioDuration(audioText)
    });
    
    return audioUrl;
  }
  
  /**
   * معالجة رسالة من المستخدم مع دعم محسن
   */
  async processUserMessage(
    userId: string,
    lessonId: string,
    message: string
  ): Promise<ActionTrigger | null> {
    const flow = this.getFlow(userId, lessonId);
    if (!flow) return null;
    
    // Update conversation state
    flow.conversationState.lastUserMessage = message;
    flow.conversationState.messageHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });
    flow.questionsAsked++;
    flow.lastInteractionTime = new Date();
    
    // Check for special states
    if (flow.conversationState.waitingForUserChoice) {
      const handled = await this.handleUserChoice(flow, message);
      return handled ? { trigger: message, action: 'generate_slide', confidence: 0.8 } : null;
    }
    
    // Check for interruption during presentation
    if (flow.isPresenting && !flow.isPaused) {
      const handled = await this.handleInterruption(flow, message);
      return handled ? { trigger: message, action: 'explain_more', confidence: 0.8 } : null;
    }
    
    // Analyze intent
    const action = await this.analyzeMessageIntent(message, flow);
    
    if (action && action.confidence > 0.7) {
      await this.executeAction(flow, action);
      return action;
    }
    
    // Check if question is about current content
    if (this.isQuestionAboutCurrentContent(message, flow)) {
      await this.answerContextualQuestion(flow, message);
      return { trigger: message, action: 'explain_more', confidence: 0.6 };
    }
    
    return null;
  }
  
  /**
   * بدء العرض التقديمي
   */
  public async startPresentation(flow: LessonFlow): Promise<void> {
    flow.isPresenting = true;
    flow.isPaused = false;
    
    // Generate slide if not ready
    const slide = this.getSlideByNumber(flow, flow.currentSlide);
    if (slide && !slide.html) {
      slide.html = await this.generateSlideHTML(flow, slide);
    }
    
    // Generate audio if voice enabled
    if (flow.voiceEnabled && slide) {
      slide.audioUrl = await this.generateSlideAudio(flow, slide);
    }
    
    await this.presentSlideProgressive(flow, flow.currentSlide);
  }
  
  /**
   * عرض شريحة بشكل تدريجي
   */
  public async presentSlideProgressive(flow: LessonFlow, slideNumber: number): Promise<void> {
    const slide = this.getSlideByNumber(flow, slideNumber);
    if (!slide) return;
    
    flow.currentSlide = slideNumber;
    flow.progressiveState.isRevealing = true;
    flow.progressiveState.currentPointIndex = 0;
    flow.progressiveState.pointsRevealed = [];
    
    // Clear any existing timers
    this.clearRevealTimers(flow.id);
    
    // Send slide started event
    websocketService.sendToUser(flow.userId, 'slide_started', {
      lessonId: flow.lessonId,
      slideNumber,
      title: slide.content.title,
      totalPoints: slide.points?.length || 1,
      mode: flow.mode,
      hasAudio: !!slide.audioUrl
    });
    
    // Start reveal process
    if (flow.progressiveReveal && slide.points && slide.points.length > 0) {
      await this.revealPointsSequentially(flow, slide);
    } else {
      await this.revealSlideCompletely(flow, slide);
    }
  }
  
  /**
   * كشف النقاط بشكل تدريجي
   */
  private async revealPointsSequentially(flow: LessonFlow, slide: GeneratedSlide): Promise<void> {
    const points = slide.points || [];
    const timers: NodeJS.Timeout[] = [];
    
    for (let i = 0; i < points.length; i++) {
      if (flow.isPaused) break;
      
      const delay = i * flow.revealDelay * 1000 / flow.playbackSpeed;
      
      const timer = setTimeout(async () => {
        if (!flow.isPaused && flow.isPresenting) {
          flow.progressiveState.currentPointIndex = i;
          flow.progressiveState.pointsRevealed.push(i);
          
          // Send point reveal event
          websocketService.sendToUser(flow.userId, 'reveal_point', {
            lessonId: flow.lessonId,
            slideNumber: flow.currentSlide,
            pointIndex: i,
            content: points[i],
            animation: 'fadeIn',
            duration: 500,
            remainingPoints: points.length - i - 1
          });
          
          // Play audio segment if available
          if (flow.voiceEnabled && slide.audioSegments?.[i]) {
            await this.playAudioSegment(flow, slide.audioSegments[i]);
          }
          
          // Emit event
          this.emit('pointRevealed', {
            userId: flow.userId,
            lessonId: flow.lessonId,
            slideNumber: flow.currentSlide,
            pointIndex: i,
            totalPoints: points.length
          });
          
          // Auto-advance on last point
          if (i === points.length - 1 && flow.autoAdvance) {
            setTimeout(() => {
              if (!flow.isPaused && flow.currentSlide < flow.totalSlides - 1) {
                this.navigateNext(flow.userId, flow.lessonId);
              }
            }, 5000 / flow.playbackSpeed);
          }
        }
      }, delay);
      
      timers.push(timer);
    }
    
    this.revealTimers.set(flow.id, timers);
  }
  
  /**
   * عرض الشريحة كاملة
   */
  private async revealSlideCompletely(flow: LessonFlow, slide: GeneratedSlide): Promise<void> {
    // Generate HTML if not ready
    if (!slide.html) {
      slide.html = await this.generateSlideHTML(flow, slide);
    }
    
    // Send complete slide
    websocketService.sendToUser(flow.userId, 'slide_ready', {
      lessonId: flow.lessonId,
      slideNumber: flow.currentSlide,
      html: slide.html,
      content: slide.content,
      fullyRevealed: true,
      hasAudio: !!slide.audioUrl,
      audioUrl: slide.audioUrl
    });
    
    slide.fullyRevealed = true;
    
    // Play audio if available
    if (flow.voiceEnabled && slide.audioUrl) {
      await this.playAudio(flow, slide.audioUrl);
    }
    
    // Auto-advance if enabled
    if (flow.autoAdvance && flow.currentSlide < flow.totalSlides - 1) {
      const duration = slide.duration * 1000 / flow.playbackSpeed;
      setTimeout(() => {
        if (!flow.isPaused) {
          this.navigateNext(flow.userId, flow.lessonId);
        }
      }, duration);
    }
  }
  
  /**
   * إيقاف العرض مؤقتاً
   */
  public async pausePresentation(flow: LessonFlow): Promise<void> {
    flow.isPaused = true;
    flow.progressiveState.isRevealing = false;
    
    // Clear timers
    this.clearRevealTimers(flow.id);
    
    // Send pause event
    websocketService.sendToUser(flow.userId, 'presentation_paused', {
      lessonId: flow.lessonId,
      currentSlide: flow.currentSlide,
      currentPoint: flow.progressiveState.currentPointIndex,
      message: 'تم إيقاف العرض مؤقتاً'
    });
    
    this.emit('presentationPaused', {
      flowId: flow.id,
      slideNumber: flow.currentSlide
    });
  }
  
  /**
   * استئناف العرض
   */
  public async resumePresentation(flow: LessonFlow): Promise<void> {
    flow.isPaused = false;
    
    const slide = this.getSlideByNumber(flow, flow.currentSlide);
    
    // Resume progressive reveal if needed
    if (slide && slide.points && flow.progressiveState.currentPointIndex < slide.points.length - 1) {
      const remainingPoints = slide.points.slice(flow.progressiveState.currentPointIndex + 1);
      const timers: NodeJS.Timeout[] = [];
      
      remainingPoints.forEach((point, index) => {
        const delay = index * flow.revealDelay * 1000 / flow.playbackSpeed;
        const timer = setTimeout(() => {
          if (!flow.isPaused) {
            const actualIndex = flow.progressiveState.currentPointIndex + index + 1;
            flow.progressiveState.currentPointIndex = actualIndex;
            flow.progressiveState.pointsRevealed.push(actualIndex);
            
            websocketService.sendToUser(flow.userId, 'reveal_point', {
              lessonId: flow.lessonId,
              slideNumber: flow.currentSlide,
              pointIndex: actualIndex,
              content: point,
              animation: 'fadeIn'
            });
          }
        }, delay);
        
        timers.push(timer);
      });
      
      this.revealTimers.set(flow.id, timers);
    }
    
    // Send resume event
    websocketService.sendToUser(flow.userId, 'presentation_resumed', {
      lessonId: flow.lessonId,
      currentSlide: flow.currentSlide,
      message: 'تم استئناف العرض'
    });
    
    this.emit('presentationResumed', {
      flowId: flow.id,
      slideNumber: flow.currentSlide
    });
  }
  
  /**
   * التنقل للشريحة التالية
   */
  async navigateNext(userId: string, lessonId: string): Promise<GeneratedSlide | null> {
    const flow = this.getFlow(userId, lessonId);
    if (!flow) return null;
    
    // Clear timers
    this.clearRevealTimers(flow.id);
    
    // Check if last slide
    if (flow.currentSlide >= flow.totalSlides - 1) {
      await this.completeLessonFlow(flow);
      return null;
    }
    
    flow.currentSlide++;
    
    // Update section if needed
    const currentSectionSlides = flow.sections[flow.currentSection].slides.length;
    const sectionStartSlide = this.getSectionStartSlide(flow, flow.currentSection);
    
    if (flow.currentSlide >= sectionStartSlide + currentSectionSlides) {
      flow.currentSection++;
      
      websocketService.sendToUser(userId, 'section_changed', {
        section: flow.sections[flow.currentSection].title,
        type: flow.sections[flow.currentSection].type,
        hasMathContent: flow.sections[flow.currentSection].hasMathContent
      });
      
      this.emit('sectionChanged', {
        userId,
        lessonId,
        section: flow.sections[flow.currentSection]
      });
    }
    
    // Get slide
    const slide = this.getSlideByNumber(flow, flow.currentSlide);
    if (!slide) return null;
    
    // Generate HTML if not ready
    if (!slide.html) {
      slide.html = await this.generateSlideHTML(flow, slide);
    }
    
    // Generate audio if needed
    if (flow.voiceEnabled && !slide.audioUrl) {
      slide.audioUrl = await this.generateSlideAudio(flow, slide);
    }
    
    // Present slide
    if (flow.progressiveReveal && flow.isPresenting) {
      await this.presentSlideProgressive(flow, flow.currentSlide);
    } else {
      await this.revealSlideCompletely(flow, slide);
    }
    
    // Pre-generate upcoming slides
    this.preGenerateUpcomingSlides(flow, 2);
    
    // Update session
    await sessionService.updateSlidePosition(
      flow.sessionId,
      flow.currentSlide,
      flow.totalSlides
    );
    
    // Track engagement
    this.trackSlideEngagement(flow, slide);
    
    // Emit event
    this.emit('slideChanged', {
      userId,
      lessonId,
      slideNumber: flow.currentSlide,
      slide
    });
    
    return slide;
  }
  
  /**
   * التنقل للشريحة السابقة
   */
  async navigatePrevious(userId: string, lessonId: string): Promise<GeneratedSlide | null> {
    const flow = this.getFlow(userId, lessonId);
    if (!flow || flow.currentSlide <= 0) return null;
    
    this.clearRevealTimers(flow.id);
    
    flow.currentSlide--;
    
    // Update section if needed
    if (flow.currentSlide < this.getSectionStartSlide(flow, flow.currentSection)) {
      flow.currentSection--;
      
      websocketService.sendToUser(userId, 'section_changed', {
        section: flow.sections[flow.currentSection].title,
        type: flow.sections[flow.currentSection].type
      });
    }
    
    const slide = this.getSlideByNumber(flow, flow.currentSlide);
    if (!slide) return null;
    
    // Reset slide state
    slide.currentRevealedPoint = 0;
    slide.fullyRevealed = false;
    
    // Generate HTML if not ready
    if (!slide.html) {
      slide.html = await this.generateSlideHTML(flow, slide);
    }
    
    await this.revealSlideCompletely(flow, slide);
    
    return slide;
  }
  
  /**
   * القفز لشريحة محددة
   */
  async jumpToSlide(userId: string, lessonId: string, slideNumber: number): Promise<GeneratedSlide | null> {
    const flow = this.getFlow(userId, lessonId);
    if (!flow || slideNumber < 0 || slideNumber >= flow.totalSlides) return null;
    
    this.clearRevealTimers(flow.id);
    
    flow.currentSlide = slideNumber;
    
    // Find correct section
    let slideCount = 0;
    for (let i = 0; i < flow.sections.length; i++) {
      const sectionSlides = flow.sections[i].slides.length;
      if (slideNumber < slideCount + sectionSlides) {
        flow.currentSection = i;
        break;
      }
      slideCount += sectionSlides;
    }
    
    const slide = this.getSlideByNumber(flow, slideNumber);
    if (slide) {
      if (!slide.html) {
        slide.html = await this.generateSlideHTML(flow, slide);
      }
      await this.revealSlideCompletely(flow, slide);
    }
    
    return slide;
  }
  
  // ============= HELPER METHODS =============
  
  /**
   * الحصول على التدفق
   */
  public getFlow(userId: string, lessonId: string): LessonFlow | undefined {
    return this.activeLessons.get(`${userId}-${lessonId}`);
  }
  
  /**
   * الحصول على الشريحة بالرقم
   */
  private getSlideByNumber(flow: LessonFlow, slideNumber: number): GeneratedSlide | null {
    let count = 0;
    for (const section of flow.sections) {
      for (const slide of section.slides) {
        if (count === slideNumber) return slide;
        count++;
      }
    }
    return null;
  }
  
  /**
   * الحصول على رقم بداية القسم
   */
  public getSectionStartSlide(flow: LessonFlow, sectionIndex: number): number {
    let count = 0;
    for (let i = 0; i < sectionIndex; i++) {
      count += flow.sections[i].slides.length;
    }
    return count;
  }
  
  /**
   * توليد HTML للشريحة العادية
   */
  private async generateRegularSlideHTML(slide: GeneratedSlide, flow: LessonFlow): Promise<string> {
    return slideGenerator.generateRealtimeSlideHTML(
      {
        id: `slide-${slide.number}`,
        type: slide.type as any,
        content: slide.content,
        duration: slide.duration,
        transitions: { in: 'fade', out: 'fade' }
      },
      flow.theme as any
    );
  }
  
  /**
   * توليد HTML للشريحة الرياضية
   */
  private async generateMathSlideHTML(slide: GeneratedSlide, flow: LessonFlow): Promise<string> {
    const content = slide.content;
    
    switch (slide.type) {
      case 'math-content':
        const expression = content.mathExpression || this.createDefaultExpression(content.title);
        return await mathSlideGenerator.generateMathSlide({
          title: content.title,
          mathExpressions: [expression],
          text: content.text,
          interactive: flow.mathInteractive || false
        });
        
      case 'math-example':
        return await mathSlideGenerator.generateMathProblemSlide({
          title: content.title,
          question: content.problem,
          equation: content.equation,
          solution: content.solution,
          hints: ['فكر في الخطوات', 'راجع القانون']
        });
        
      case 'math-problem':
        return await mathSlideGenerator.generateMathProblemSlide({
          title: content.title,
          question: content.problem,
          hints: content.hints,
          solution: content.solution
        });
        
      case 'math-quiz':
        return await mathSlideGenerator.generateMathProblemSlide({
          title: content.quiz?.question || 'سؤال',
          question: content.quiz?.question,
          equation: content.quiz?.equation,
          solution: content.quiz?.solution,
          hints: content.quiz?.hints
        });
        
      default:
        return this.generateRegularSlideHTML(slide, flow);
    }
  }
  
  /**
   * تحضير الشرائح القادمة
   */
  private async preGenerateUpcomingSlides(flow: LessonFlow, count: number): Promise<void> {
    setTimeout(async () => {
      for (let i = 1; i <= count; i++) {
        const slideNum = flow.currentSlide + i;
        if (slideNum >= flow.totalSlides) break;
        
        const slide = this.getSlideByNumber(flow, slideNum);
        if (slide && !slide.html) {
          slide.html = await this.generateSlideHTML(flow, slide);
        }
        
        if (flow.voiceEnabled && slide && !slide.audioUrl) {
          slide.audioUrl = await this.generateSlideAudio(flow, slide);
        }
      }
    }, 100);
  }
  
  /**
   * تقدير مدة الصوت
   */
  private estimateAudioDuration(text: string): number {
    // Estimate ~150 words per minute in Arabic
    const words = text.split(' ').length;
    const minutes = words / 150;
    return Math.max(2, Math.floor(minutes * 60)); // minimum 2 seconds
  }
  
  /**
   * تشغيل مقطع صوتي
   */
  private async playAudioSegment(flow: LessonFlow, audioUrl: string): Promise<void> {
    websocketService.sendToUser(flow.userId, 'play_audio', {
      lessonId: flow.lessonId,
      audioUrl,
      playbackSpeed: flow.playbackSpeed
    });
  }
  
  /**
   * تشغيل الصوت
   */
  private async playAudio(flow: LessonFlow, audioUrl: string): Promise<void> {
    flow.isAudioPlaying = true;
    flow.currentAudioUrl = audioUrl;
    
    websocketService.sendToUser(flow.userId, 'play_audio', {
      lessonId: flow.lessonId,
      audioUrl,
      playbackSpeed: flow.playbackSpeed,
      fullAudio: true
    });
  }
  
  /**
   * مسح مؤقتات الكشف
   */
  private clearRevealTimers(flowId: string): void {
    const timers = this.revealTimers.get(flowId);
    if (timers) {
      timers.forEach(timer => clearTimeout(timer));
      this.revealTimers.delete(flowId);
    }
  }
  
  /**
   * تتبع تفاعل الطالب مع الشريحة
   */
  private trackSlideEngagement(flow: LessonFlow, slide: GeneratedSlide): void {
    if (!slide.userSpentTime) slide.userSpentTime = 0;
    
    flow.engagementScore = Math.max(0, Math.min(100, 
      flow.engagementScore - (slide.userSpentTime > slide.duration * 2 ? 5 : 0)
    ));
    
    if (!slide.interactions) slide.interactions = [];
    slide.interactions.push({
      type: slide.isMathSlide ? 'math-variable-change' : 'click',
      timestamp: new Date()
    });
  }
  
  /**
   * إنشاء أقسام الدرس مع المحتوى التدريجي
   */
  private async createLessonSectionsWithProgressive(lesson: any, isMathLesson: boolean): Promise<LessonSection[]> {
    const sections: LessonSection[] = [];
    const keyPoints = JSON.parse(lesson.keyPoints || '[]');
    const objectives = JSON.parse(lesson.objectives || '[]');
    
    // Introduction section
    sections.push({
      id: 'intro',
      type: 'intro',
      title: 'مقدمة الدرس',
      slides: [
        {
          number: 0,
          type: 'title',
          content: {
            title: lesson.titleAr || lesson.title,
            subtitle: lesson.unit.title
          },
          duration: 5,
          isMathSlide: false,
          points: [
            `مرحباً! سنتعلم اليوم عن ${lesson.titleAr || lesson.title}`,
            `هذا الدرس جزء من ${lesson.unit.title}`,
            `هيا نبدأ رحلة التعلم معاً!`
          ],
          pointTimings: [0, 2, 4]
        },
        {
          number: 1,
          type: 'bullet',
          content: {
            title: 'أهداف الدرس',
            bullets: objectives.length > 0 ? objectives : [
              'فهم المفاهيم الأساسية',
              'تطبيق ما تعلمناه',
              'حل التمارين'
            ]
          },
          duration: 10,
          isMathSlide: false,
          points: objectives.length > 0 ? objectives : ['الهدف الأول', 'الهدف الثاني', 'الهدف الثالث'],
          pointTimings: [0, 3, 6]
        }
      ],
      duration: 15,
      completed: false,
      hasProgressiveContent: true,
      objectives: objectives.length > 0 ? objectives : ['فهم موضوع الدرس'],
      keywords: ['مقدمة', 'أهداف'],
      anticipatedQuestions: ['ما هو موضوع الدرس؟', 'ماذا سنتعلم؟'],
      hasMathContent: false
    });
    
    // Content sections
    for (let i = 0; i < keyPoints.length; i++) {
      const point = keyPoints[i];
      const sectionSlides: GeneratedSlide[] = [];
      const hasMathInPoint = isMathLesson && this.detectMathContent(point);
      
      // Main content slide
      sectionSlides.push({
        number: sections.length * 2 + i * 2,
        type: hasMathInPoint ? 'math-content' : 'content',
        content: {
          title: point,
          text: `شرح تفصيلي عن ${point}`,
          mathExpression: hasMathInPoint ? this.extractMathExpression(point) : undefined
        },
        duration: 20,
        isMathSlide: hasMathInPoint,
        points: this.generatePointsForTopic(point),
        pointTimings: [0, 4, 8, 12, 16]
      });
      
      // Example slide
      sectionSlides.push({
        number: sections.length * 2 + i * 2 + 1,
        type: 'bullet',
        content: {
          title: `نقاط مهمة: ${point}`,
          bullets: [
            `تعريف ${point}`,
            `أهمية ${point}`,
            `كيفية تطبيق ${point}`,
            `مثال على ${point}`
          ]
        },
        duration: 15,
        isMathSlide: false,
        points: [`تعريف ${point}`, `أهمية ${point}`, `مثال`],
        pointTimings: [0, 5, 10]
      });
      
      sections.push({
        id: `concept-${i}`,
        type: hasMathInPoint ? 'math-concept' : 'concept',
        title: point,
        slides: sectionSlides,
        duration: 35,
        completed: false,
        hasProgressiveContent: true,
        objectives: [`فهم ${point}`, `تطبيق ${point}`],
        keywords: this.extractKeywords(point),
        anticipatedQuestions: [
          `ما معنى ${point}؟`,
          `كيف أطبق ${point}؟`,
          `أعطني مثال على ${point}`
        ],
        hasMathContent: hasMathInPoint
      });
    }
    
    // Summary section
    sections.push({
      id: 'summary',
      type: 'summary',
      title: 'ملخص الدرس',
      slides: [
        {
          number: sections.length * 2,
          type: 'bullet',
          content: {
            title: 'ما تعلمناه اليوم',
            bullets: keyPoints
          },
          duration: 15,
          isMathSlide: false,
          points: keyPoints,
          pointTimings: keyPoints.map((_: any, idx: number) => idx * 3)
        }
      ],
      duration: 15,
      completed: false,
      hasProgressiveContent: true,
      objectives: ['مراجعة النقاط الرئيسية'],
      keywords: ['ملخص', 'مراجعة'],
      anticipatedQuestions: ['ما هو الملخص؟'],
      hasMathContent: false
    });
    
    return sections;
  }
  
  /**
   * توليد نقاط للموضوع
   */
  private generatePointsForTopic(topic: string): string[] {
    return [
      `أولاً: مفهوم ${topic}`,
      `ثانياً: أهمية ${topic} في حياتنا`,
      `ثالثاً: كيفية استخدام ${topic}`,
      `رابعاً: أمثلة عملية على ${topic}`,
      `خامساً: تطبيقات ${topic}`
    ];
  }
  
  /**
   * استخراج الكلمات المفتاحية
   */
  private extractKeywords(text: string): string[] {
    return text.split(' ')
      .filter(word => word.length > 3)
      .slice(0, 5);
  }
  
  /**
   * الكشف عن المحتوى الرياضي
   */
  private detectMathContent(text: string): boolean {
    if (!text) return false;
    
    const mathIndicators = [
      'معادلة', 'حل', 'احسب', 'رقم', 'عدد', 'جمع', 'طرح', 'ضرب', 'قسمة',
      'مربع', 'جذر', 'أس', 'كسر', 'نسبة', 'متغير', 'دالة',
      '+', '-', '×', '÷', '=', 'x', 'y'
    ];
    
    const lowerText = text.toLowerCase();
    return mathIndicators.some(indicator => lowerText.includes(indicator));
  }
  
  /**
   * استخراج المعادلة الرياضية
   */
  private extractMathExpression(text: string): MathExpression | null {
    const equation = this.extractEquation(text);
    if (!equation) return null;
    
    return {
      id: 'extracted',
      latex: equation.replace(/س/g, 'x').replace(/ص/g, 'y'),
      type: 'equation',
      description: text
    };
  }
  
  /**
   * استخراج معادلة من النص
   */
  private extractEquation(text: string): string | null {
    const patterns = [
      /([a-z0-9\s\+\-\*\/\^\(\)]+)\s*=\s*([a-z0-9\s\+\-\*\/\^\(\)]+)/i,
      /([س-ي]\s*[\+\-\*\/]\s*\d+)\s*=\s*(\d+)/,
      /(\d+[a-z])\s*[\+\-]\s*(\d+)\s*=\s*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    
    return null;
  }
  
  /**
   * إنشاء معادلة افتراضية
   */
  private createDefaultExpression(title: string): MathExpression {
    return {
      id: 'default',
      latex: 'ax + b = c',
      type: 'equation',
      description: title,
      isInteractive: true,
      variables: [
        { name: 'a', value: 2, min: -10, max: 10, step: 1 },
        { name: 'b', value: 3, min: -10, max: 10, step: 1 },
        { name: 'c', value: 7, min: -10, max: 10, step: 1 }
      ]
    };
  }
  
  /**
   * تحميل الدرس مع المحتوى
   */
  public async loadLessonWithContent(lessonId: string): Promise<any> {
    return await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        unit: {
          include: {
            subject: true
          }
        }
      }
    });
  }
  
  /**
   * التحقق من درس الرياضيات
   */
  private checkIfMathLesson(lesson: any): boolean {
    const subjectName = lesson.unit.subject.name.toLowerCase();
    const subjectNameEn = (lesson.unit.subject.nameEn || '').toLowerCase();
    
    return subjectName.includes('رياضيات') || 
           subjectName.includes('رياضة') ||
           subjectNameEn.includes('math') ||
           subjectNameEn.includes('algebra') ||
           subjectNameEn.includes('geometry');
  }
  
  /**
   * الحصول على الثيم حسب الصف
   */
  private getThemeByGrade(grade: number): string {
    if (grade <= 6) return 'colorful';
    if (grade <= 9) return 'blue';
    return 'dark';
  }
  
  /**
   * توليد الشرائح الأولية
   */
  private async generateInitialSlides(flow: LessonFlow): Promise<void> {
    const slidesToGenerate = Math.min(5, flow.totalSlides);
    
    for (let i = 0; i < slidesToGenerate; i++) {
      const slide = this.getSlideByNumber(flow, i);
      if (!slide) continue;
      
      slide.html = await this.generateSlideHTML(flow, slide);
      
      if (flow.voiceEnabled) {
        slide.audioUrl = await this.generateSlideAudio(flow, slide);
      }
      
      // Cache them
      flow.slidesGenerated?.set(i, slide.html);
      if (slide.audioUrl) {
        flow.audioQueue?.push(slide.audioUrl);
      }
    }
    
    console.log(`📊 Pre-generated ${slidesToGenerate} slides`);
  }
  
  // ... باقي الـ methods من الملف الأصلي (يمكن الاحتفاظ بها كما هي)
  
  /**
   * إرسال رسالة ترحيب
   */
  private async sendLessonWelcome(flow: LessonFlow): Promise<void> {
    const context: PromptContext = {
      lessonTitle: flow.lessonTitle || '',
      subject: flow.subjectName || '',
      grade: flow.grade || 6,
      isMathLesson: flow.isMathLesson
    };
    
    const welcomePrompt = getLessonWelcomePrompt(context);
    
    try {
      const welcomeMessage = await openAIService.chat([
        { role: 'system', content: welcomePrompt }
      ], {
        temperature: 0.7,
        maxTokens: 200
      });
      
      websocketService.sendToUser(flow.userId, 'lesson_welcome', {
        lessonId: flow.lessonId,
        message: welcomeMessage,
        lessonTitle: flow.lessonTitle,
        mode: flow.mode,
        features: {
          voiceEnabled: flow.voiceEnabled,
          progressiveReveal: flow.progressiveReveal,
          mathInteractive: flow.mathInteractive
        }
      });
      
      flow.conversationState.messageHistory.push({
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Failed to generate welcome message:', error);
      
      const fallbackMessage = `مرحباً بك في درس "${flow.lessonTitle}"! 🌟
هيا نبدأ رحلة تعلم ممتعة معاً.

📚 المادة: ${flow.subjectName}
⏱️ المدة المتوقعة: ${flow.estimatedDuration} دقيقة
🎯 عدد الأقسام: ${flow.sections.length}

استعد للتعلم!`;
      
      websocketService.sendToUser(flow.userId, 'lesson_welcome', {
        lessonId: flow.lessonId,
        message: fallbackMessage,
        lessonTitle: flow.lessonTitle,
        mode: flow.mode
      });
    }
  }
  
  // ... باقي الـ methods كما هي في الملف الأصلي
  
  /**
   * إكمال الدرس
   */
  public async completeLessonFlow(flow: LessonFlow): Promise<void> {
    const context: PromptContext = {
      lessonTitle: flow.lessonTitle || '',
      subject: flow.subjectName || '',
      grade: flow.grade || 6,
      comprehensionLevel: flow.comprehensionLevel,
      isMathLesson: flow.isMathLesson
    };
    
    const completionPrompt = getLessonCompletionPrompt(context);
    
    try {
      const completionMessage = await openAIService.chat([
        { role: 'system', content: completionPrompt }
      ], {
        temperature: 0.7,
        maxTokens: 300
      });
      
      websocketService.sendToUser(flow.userId, 'lesson_completed', {
        lessonId: flow.lessonId,
        message: completionMessage,
        stats: {
          duration: flow.actualDuration,
          questionsAsked: flow.questionsAsked,
          engagementScore: flow.engagementScore,
          comprehensionLevel: flow.comprehensionLevel,
          slidesCompleted: flow.currentSlide + 1,
          totalSlides: flow.totalSlides,
          mathProblemsAttempted: flow.mathProblemsAttempted || 0,
          mathProblemsSolved: flow.mathProblemsSolved || 0
        }
      });
      
    } catch (error) {
      console.error('Failed to generate completion message:', error);
      
      websocketService.sendToUser(flow.userId, 'lesson_completed', {
        lessonId: flow.lessonId,
        message: `أحسنت! لقد أكملت درس "${flow.lessonTitle}" بنجاح! 🎉`,
        stats: {
          duration: flow.actualDuration,
          slidesCompleted: flow.currentSlide + 1,
          totalSlides: flow.totalSlides
        }
      });
    }
    
    // Mark all sections as completed
    flow.sections.forEach(s => s.completed = true);
    flow.actualDuration = Math.floor((Date.now() - flow.startTime.getTime()) / 1000);
    
    // Clear cache
    const flowKey = `${flow.userId}-${flow.lessonId}`;
    this.slideCache.forEach((_, key) => {
      if (key.startsWith(flow.lessonId)) {
        this.slideCache.delete(key);
      }
    });
    this.audioCache.forEach((_, key) => {
      if (key.includes(flow.lessonId)) {
        this.audioCache.delete(key);
      }
    });
    
    // Remove from active lessons
    this.activeLessons.delete(flowKey);
    
    // Emit completion event
    this.emit('lessonCompleted', {
      userId: flow.userId,
      lessonId: flow.lessonId,
      stats: {
        duration: flow.actualDuration,
        questionsAsked: flow.questionsAsked,
        engagementScore: flow.engagementScore,
        comprehensionLevel: flow.comprehensionLevel
      }
    });
  }
  
  // ... باقي الـ methods الضرورية من الملف الأصلي
  
  private buildPromptContext(flow: LessonFlow, userMessage?: string): PromptContext {
    const currentSection = flow.sections[flow.currentSection];
    const conversationHistory = flow.conversationState.messageHistory
      .slice(-5)
      .map(msg => `${msg.role === 'user' ? 'الطالب' : 'المساعد'}: ${msg.content}`);
    
    return {
      lessonTitle: flow.lessonTitle || '',
      subject: flow.subjectName || '',
      grade: flow.grade || 6,
      currentSection: currentSection.title,
      currentSlide: flow.currentSlide,
      comprehensionLevel: flow.comprehensionLevel,
      userMessage,
      conversationHistory,
      isMathLesson: flow.isMathLesson
    };
  }
  
  private async answerContextualQuestion(flow: LessonFlow, question: string): Promise<void> {
    const context = this.buildPromptContext(flow, question);
    const chatPrompt = getChatResponsePrompt(context);
    
    try {
      const answer = await openAIService.chat([
        { role: 'system', content: chatPrompt },
        { role: 'user', content: question }
      ], {
        temperature: 0.7,
        maxTokens: 300
      });
      
      websocketService.sendToUser(flow.userId, 'contextual_answer', {
        lessonId: flow.lessonId,
        question,
        answer,
        slideContext: flow.currentSlide,
        sectionContext: context.currentSection
      });
      
      flow.conversationState.messageHistory.push({
        role: 'assistant',
        content: answer,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Failed to generate contextual answer:', error);
      
      websocketService.sendToUser(flow.userId, 'contextual_answer', {
        lessonId: flow.lessonId,
        question,
        answer: 'دعني أوضح لك هذه النقطة بشكل آخر...'
      });
    }
  }
  
  public async executeAction(flow: LessonFlow, action: ActionTrigger): Promise<void> {
    console.log(`🎬 Executing action: ${action.action}`);
    
    const context = this.buildPromptContext(flow, action.trigger);
    
    switch (action.action) {
      case 'generate_slide':
        await this.generateSlideWithTemplate(flow, context, action.trigger);
        break;
        
      case 'show_example':
        await this.generateExampleWithTemplate(flow, context);
        break;
        
      case 'start_quiz':
        await this.generateQuizWithTemplate(flow, context);
        break;
        
      case 'explain_more':
        await this.generateExplanationWithTemplate(flow, context);
        break;
        
      case 'simplify':
        await this.generateSimplifiedWithTemplate(flow, context);
        break;
        
      default:
        console.log(`Action ${action.action} not implemented`);
    }
    
    websocketService.sendToUser(flow.userId, 'action_executed', {
      action: action.action,
      trigger: action.trigger,
      comprehensionLevel: flow.comprehensionLevel
    });
  }
  
  // Add stub implementations for template methods
  private async generateSlideWithTemplate(flow: LessonFlow, context: PromptContext, topic: string): Promise<void> {
    console.log(`Generating slide for topic: ${topic}`);
  }
  
  private async generateExampleWithTemplate(flow: LessonFlow, context: PromptContext): Promise<void> {
    console.log('Generating example slide');
  }
  
  private async generateQuizWithTemplate(flow: LessonFlow, context: PromptContext): Promise<void> {
    console.log('Generating quiz slide');
  }
  
  private async generateExplanationWithTemplate(flow: LessonFlow, context: PromptContext): Promise<void> {
    console.log('Generating explanation slide');
  }
  
  private async generateSimplifiedWithTemplate(flow: LessonFlow, context: PromptContext): Promise<void> {
    console.log('Generating simplified slide');
  }
  
  private async handleUserChoice(flow: LessonFlow, message: string): Promise<boolean> {
    return false;
  }
  
  private async handleInterruption(flow: LessonFlow, message: string): Promise<boolean> {
    return false;
  }
  
  private async analyzeMessageIntent(message: string, flow: LessonFlow): Promise<ActionTrigger | null> {
    return null;
  }
  
  private isQuestionAboutCurrentContent(message: string, flow: LessonFlow): boolean {
    const currentSection = flow.sections[flow.currentSection];
    const questionLower = message.toLowerCase();
    
    return currentSection.keywords.some(keyword => 
      questionLower.includes(keyword.toLowerCase())
    );
  }
  
  private splitContentToPoints(content: string): string[] {
    if (!content) return [];
    
    const sentences = content.split(/[.!؟]/g).filter(s => s.trim().length > 0);
    
    const points: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const point = sentences[i] + '.' + 
                   (sentences[i + 1] ? ' ' + sentences[i + 1] + '.' : '');
      points.push(point.trim());
    }
    
    return points.slice(0, 5);
  }
}

// Export singleton
export const lessonOrchestrator = new LessonOrchestratorService();