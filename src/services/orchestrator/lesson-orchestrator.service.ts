// 📍 المكان: src/services/orchestrator/lesson-orchestrator.service.ts
// الوظيفة: تنسيق كل الخدمات وإدارة تدفق الدرس بذكاء مع دعم المكونات الرياضية والعرض التدريجي

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
  id: string; // معرف فريد للـ flow
  lessonId: string;
  userId: string;
  sessionId: string;
  
  // Content Structure
  sections: LessonSection[];
  currentSection: number;
  currentSlide: number;
  totalSlides: number;
  
  // Progressive Display State (جديد)
  progressiveState: ProgressiveRevealState;
  
  // Conversation State (جديد)
  conversationState: ConversationState;
  
  // Presentation Mode (محسّن)
  mode: 'chat_only' | 'slides_only' | 'slides_with_voice' | 'interactive';
  isPaused: boolean;
  isPresenting: boolean;
  
  // Timing
  estimatedDuration: number; // minutes
  actualDuration: number; // seconds
  startTime: Date;
  lastInteractionTime: Date;
  
  // User State
  comprehensionLevel: 'low' | 'medium' | 'high';
  engagementScore: number; // 0-100
  questionsAsked: number;
  interruptionCount: number; // عدد المقاطعات
  
  // Settings
  autoAdvance: boolean;
  voiceEnabled: boolean;
  playbackSpeed: number;
  theme: string;
  progressiveReveal: boolean; // تفعيل العرض التدريجي
  revealDelay: number; // التأخير بين النقاط (ثانية)
  
  // Math Settings
  isMathLesson?: boolean;
  mathInteractive?: boolean;
  mathProblemsAttempted?: number;
  mathProblemsSolved?: number;
}

export interface LessonSection {
  id: string;
  type: 'intro' | 'concept' | 'example' | 'practice' | 'quiz' | 'summary' | 'math-concept' | 'math-practice';
  title: string;
  slides: GeneratedSlide[];
  duration: number; // seconds
  completed: boolean;
  
  // Progressive Content (جديد)
  hasProgressiveContent: boolean;
  progressivePoints?: Array<{
    content: string;
    revealAt: number; // seconds from slide start
    audioSegment?: string;
    animation?: string;
  }>;
  
  // Learning objectives for this section
  objectives: string[];
  
  // Keywords to track
  keywords: string[];
  
  // Questions that might arise
  anticipatedQuestions: string[];
  
  // Math content
  mathExpressions?: MathExpression[];
  hasMathContent?: boolean;
}

export interface GeneratedSlide {
  number: number;
  type: string;
  content: any;
  html?: string;
  audioUrl?: string;
  audioSegments?: string[]; // صوت لكل نقطة
  duration: number;
  userSpentTime?: number;
  interactions?: SlideInteraction[];
  
  // Progressive Display Properties (جديد)
  points?: string[];
  pointTimings?: number[];
  currentRevealedPoint?: number;
  fullyRevealed?: boolean;
  
  // Math properties
  isMathSlide?: boolean;
  mathExpressions?: MathExpression[];
}

export interface SlideInteraction {
  type: 'click' | 'question' | 'replay' | 'skip' | 'pause' | 'resume' | 'math-variable-change' | 'equation-solve';
  timestamp: Date;
  data?: any;
}

export interface ActionTrigger {
  trigger: string; // الكلمة المفتاحية
  action: 'generate_slide' | 'show_example' | 'start_quiz' | 'explain_more' | 'simplify' | 'show_video' | 'show_math' | 'solve_equation';
  confidence: number;
  mathRelated?: boolean;
}

// ============= MAIN SERVICE (Enhanced) =============

export class LessonOrchestratorService extends EventEmitter {
  private activeLessons: Map<string, LessonFlow> = new Map();
  private revealTimers: Map<string, NodeJS.Timeout[]> = new Map();
  
  constructor() {
    super();
    this.setupEventHandlers();
  }
  
  /**
   * إعداد معالجات الأحداث الداخلية
   */
  private setupEventHandlers(): void {
    this.on('slideChanged', (data) => {
      console.log(`📍 Slide changed: ${data.slideNumber}`);
    });
    
    this.on('pointRevealed', (data) => {
      console.log(`✨ Point revealed: ${data.pointIndex} on slide ${data.slideNumber}`);
    });
  }
  
  /**
   * بدء درس جديد مع دعم المحادثة والعرض التدريجي
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
    }
  ): Promise<LessonFlow> {
    console.log('🎯 Starting Enhanced Lesson Orchestration');
    
    // Check for existing flow
    const flowKey = `${userId}-${lessonId}`;
    if (this.activeLessons.has(flowKey)) {
      console.log('📚 Resuming existing lesson flow');
      const existingFlow = this.activeLessons.get(flowKey)!;
      
      // Update options if provided
      if (options) {
        Object.assign(existingFlow, options);
      }
      
      return existingFlow;
    }
    
    // Load lesson content
    const lesson = await this.loadLessonWithContent(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }
    
    // Check if it's a math lesson
    const isMathLesson = this.checkIfMathLesson(lesson);
    
    // Create lesson structure with progressive content
    const sections = await this.createLessonSectionsWithProgressive(lesson, isMathLesson);
    
    // Calculate total slides
    const totalSlides = sections.reduce((sum, section) => 
      sum + section.slides.length, 0
    );
    
    // Create flow with enhanced properties
    const flow: LessonFlow = {
      id: `flow-${Date.now()}`,
      lessonId,
      userId,
      sessionId,
      sections,
      currentSection: 0,
      currentSlide: 0,
      totalSlides,
      
      // Progressive State
      progressiveState: {
        isRevealing: false,
        currentPointIndex: 0,
        pointsRevealed: [],
        revealTimers: [],
        lastRevealTime: new Date()
      },
      
      // Conversation State
      conversationState: {
        isActive: true,
        currentContext: lesson.title,
        waitingForUserChoice: false,
        messageHistory: []
      },
      
      // Presentation Mode
      mode: options?.mode || 'interactive',
      isPaused: false,
      isPresenting: false,
      
      // Timing
      estimatedDuration: Math.ceil(totalSlides * 0.5),
      actualDuration: 0,
      startTime: new Date(),
      lastInteractionTime: new Date(),
      
      // User State
      comprehensionLevel: 'medium',
      engagementScore: 100,
      questionsAsked: 0,
      interruptionCount: 0,
      
      // Settings
      autoAdvance: options?.autoAdvance ?? true,
      voiceEnabled: options?.voiceEnabled ?? true,
      playbackSpeed: 1,
      theme: this.getThemeByGrade(lesson.unit.subject.grade),
      progressiveReveal: options?.progressiveReveal ?? true,
      revealDelay: 3, // 3 seconds between points
      
      // Math properties
      isMathLesson,
      mathInteractive: isMathLesson,
      mathProblemsAttempted: 0,
      mathProblemsSolved: 0
    };
    
    // Store flow
    this.activeLessons.set(flowKey, flow);
    
    // Generate first slides
    await this.generateInitialSlides(flow);
    
    // Emit flow started event
    this.emit('flowStarted', {
      userId,
      lessonId,
      flowId: flow.id,
      mode: flow.mode
    });
    
    console.log(`✅ Enhanced lesson flow created: ${totalSlides} slides in ${sections.length} sections`);
    
    return flow;
  }
  
  /**
   * معالجة رسالة من المستخدم مع دعم المحادثة المتكاملة
   */
  /**
 * معالجة رسالة من المستخدم مع دعم المحادثة المتكاملة
 */
async processUserMessage(
  userId: string,
  lessonId: string,
  message: string
): Promise<ActionTrigger | null> {  // غيّر من boolean إلى ActionTrigger | null
  const flow = this.getFlow(userId, lessonId);
  if (!flow) return null;  // غيّر من false إلى null
  
  // Update conversation state
  flow.conversationState.lastUserMessage = message;
  flow.conversationState.messageHistory.push({
    role: 'user',
    content: message,
    timestamp: new Date()
  });
  flow.questionsAsked++;
  flow.lastInteractionTime = new Date();
  
  // Check if waiting for user choice
  if (flow.conversationState.waitingForUserChoice) {
    const handled = await this.handleUserChoice(flow, message);
    return handled ? { trigger: message, action: 'generate_slide', confidence: 0.8 } : null;
  }
  
  // Check if it's an interruption during presentation
  if (flow.isPresenting && !flow.isPaused) {
    const handled = await this.handleInterruption(flow, message);
    return handled ? { trigger: message, action: 'explain_more', confidence: 0.8 } : null;
  }
  
  // Analyze intent and determine action
  const action = await this.analyzeMessageIntent(message, flow);
  
  // Execute action if high confidence
  if (action && action.confidence > 0.7) {
    await this.executeAction(flow, action);
    return action;  // أرجع action بدلاً من true
  }
  
  // If no specific action, check if it's a question about current content
  if (this.isQuestionAboutCurrentContent(message, flow)) {
    await this.answerContextualQuestion(flow, message);
    return { trigger: message, action: 'explain_more', confidence: 0.6 };
  }
  
  return null;  // غيّر من false إلى null
}
  
  /**
   * معالجة اختيار المستخدم (للأوضاع المختلفة)
   */
  private async handleUserChoice(flow: LessonFlow, message: string): Promise<boolean> {
    const lowerMessage = message.toLowerCase();
    
    // Check for mode selection
    if (flow.conversationState.choiceOptions) {
      for (const option of flow.conversationState.choiceOptions) {
        if (lowerMessage.includes(option.id) || lowerMessage.includes(option.label.toLowerCase())) {
          // Update mode
          if (option.id.includes('chat')) flow.mode = 'chat_only';
          else if (option.id.includes('voice')) flow.mode = 'slides_with_voice';
          else if (option.id.includes('slides')) flow.mode = 'slides_only';
          else flow.mode = 'interactive';
          
          flow.conversationState.waitingForUserChoice = false;
          flow.conversationState.choiceOptions = undefined;
          
          // Start presentation based on chosen mode
          await this.startPresentation(flow);
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * معالجة المقاطعات أثناء العرض
   */
  private async handleInterruption(flow: LessonFlow, message: string): Promise<boolean> {
    flow.interruptionCount++;
    
    // Pause presentation
    await this.pausePresentation(flow);
    
    // Check if question is related to current content
    const isRelated = await this.checkQuestionRelevance(message, flow);
    
    if (isRelated) {
      // Answer and offer to continue
      await this.answerAndContinue(flow, message);
    } else {
      // Defer question or switch context
      await this.handleOffTopicQuestion(flow, message);
    }
    
    return true;
  }
  
  /**
   * بدء العرض التدريجي
   */
  async startPresentation(flow: LessonFlow): Promise<void> {
    flow.isPresenting = true;
    flow.isPaused = false;
    
    // Start from current slide
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
    
    // Send slide header first
    websocketService.sendToUser(flow.userId, 'slide_started', {
      lessonId: flow.lessonId,
      slideNumber,
      title: slide.content.title,
      totalPoints: slide.points?.length || 1,
      mode: flow.mode
    });
    
    // If progressive reveal is enabled and slide has points
    if (flow.progressiveReveal && slide.points && slide.points.length > 0) {
      await this.revealPointsSequentially(flow, slide);
    } else {
      // Reveal all at once
      await this.revealSlideCompletely(flow, slide);
    }
  }
  
  /**
   * كشف النقاط بالتتابع
   */
  private async revealPointsSequentially(flow: LessonFlow, slide: GeneratedSlide): Promise<void> {
    const points = slide.points || [];
    const timers: NodeJS.Timeout[] = [];
    
    for (let i = 0; i < points.length; i++) {
      // Check if presentation is paused
      if (flow.isPaused) {
        break;
      }
      
      const timer = setTimeout(async () => {
        if (!flow.isPaused && flow.isPresenting) {
          // Reveal point
          flow.progressiveState.currentPointIndex = i;
          flow.progressiveState.pointsRevealed.push(i);
          
          // Send point reveal event
          websocketService.sendToUser(flow.userId, 'reveal_point', {
            lessonId: flow.lessonId,
            slideNumber: flow.currentSlide,
            pointIndex: i,
            content: points[i],
            animation: 'fadeIn',
            duration: 500
          });
          
          // Play audio for this point if available
          if (flow.voiceEnabled && slide.audioSegments && slide.audioSegments[i]) {
            await this.playAudioSegment(flow, slide.audioSegments[i]);
          }
          
          // Emit event
          this.emit('pointRevealed', {
            slideNumber: flow.currentSlide,
            pointIndex: i,
            totalPoints: points.length
          });
          
          // If last point and auto-advance is enabled
          if (i === points.length - 1 && flow.autoAdvance) {
            setTimeout(() => {
              if (!flow.isPaused && flow.currentSlide < flow.totalSlides - 1) {
                this.navigateNext(flow.userId, flow.lessonId);
              }
            }, 5000); // Wait 5 seconds after last point
          }
        }
      }, i * flow.revealDelay * 1000);
      
      timers.push(timer);
    }
    
    // Store timers for cleanup
    this.revealTimers.set(flow.id, timers);
  }
  
  /**
   * كشف الشريحة بالكامل
   */
  private async revealSlideCompletely(flow: LessonFlow, slide: GeneratedSlide): Promise<void> {
    websocketService.sendToUser(flow.userId, 'slide_ready', {
      lessonId: flow.lessonId,
      slideNumber: flow.currentSlide,
      html: slide.html,
      content: slide.content,
      fullyRevealed: true
    });
    
    slide.fullyRevealed = true;
    
    // Play full audio if available
    if (flow.voiceEnabled && slide.audioUrl) {
      await this.playAudio(flow, slide.audioUrl);
    }
    
    // Auto-advance if enabled
    if (flow.autoAdvance && flow.currentSlide < flow.totalSlides - 1) {
      setTimeout(() => {
        if (!flow.isPaused) {
          this.navigateNext(flow.userId, flow.lessonId);
        }
      }, slide.duration * 1000);
    }
  }
  
  /**
   * إيقاف العرض مؤقتاً
   */
  async pausePresentation(flow: LessonFlow): Promise<void> {
    flow.isPaused = true;
    flow.progressiveState.isRevealing = false;
    
    // Clear reveal timers
    this.clearRevealTimers(flow.id);
    
    // Notify user
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
  async resumePresentation(flow: LessonFlow): Promise<void> {
    flow.isPaused = false;
    
    // Resume from current point
    const slide = this.getSlideByNumber(flow, flow.currentSlide);
    if (slide && slide.points && flow.progressiveState.currentPointIndex < slide.points.length - 1) {
      // Continue revealing remaining points
      const remainingPoints = slide.points.slice(flow.progressiveState.currentPointIndex + 1);
      const timers: NodeJS.Timeout[] = [];
      
      remainingPoints.forEach((point, index) => {
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
        }, index * flow.revealDelay * 1000);
        
        timers.push(timer);
      });
      
      this.revealTimers.set(flow.id, timers);
    }
    
    // Notify user
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
   * الانتقال للشريحة التالية مع دعم العرض التدريجي
   */
  async navigateNext(userId: string, lessonId: string): Promise<GeneratedSlide | null> {
    const flow = this.getFlow(userId, lessonId);
    if (!flow) return null;
    
    // Clear any active reveal timers
    this.clearRevealTimers(flow.id);
    
    // Check if we can advance
    if (flow.currentSlide >= flow.totalSlides - 1) {
      await this.completeLessonFlow(flow);
      return null;
    }
    
    // Update position
    flow.currentSlide++;
    
    // Check if moving to new section
    const currentSectionSlides = flow.sections[flow.currentSection].slides.length;
    const sectionStartSlide = this.getSectionStartSlide(flow, flow.currentSection);
    
    if (flow.currentSlide >= sectionStartSlide + currentSectionSlides) {
      flow.currentSection++;
      
      // Notify about section change
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
    
    // Generate HTML if not exists
    if (!slide.html) {
      if (slide.isMathSlide) {
        slide.html = await this.generateMathSlideHTML(slide, flow);
      } else {
        slide.html = await this.generateSlideHTML(flow, slide);
      }
    }
    
    // Start progressive presentation if enabled
    if (flow.progressiveReveal && flow.isPresenting) {
      await this.presentSlideProgressive(flow, flow.currentSlide);
    } else {
      await this.revealSlideCompletely(flow, slide);
    }
    
    // Pre-generate next slides
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
   * الانتقال للشريحة السابقة
   */
  async navigatePrevious(userId: string, lessonId: string): Promise<GeneratedSlide | null> {
    const flow = this.getFlow(userId, lessonId);
    if (!flow) return null;
    
    // Clear any active reveal timers
    this.clearRevealTimers(flow.id);
    
    // Check if we can go back
    if (flow.currentSlide <= 0) {
      return null;
    }
    
    // Update position
    flow.currentSlide--;
    
    // Check if moving to previous section
    if (flow.currentSlide < this.getSectionStartSlide(flow, flow.currentSection)) {
      flow.currentSection--;
      
      // Notify about section change
      websocketService.sendToUser(userId, 'section_changed', {
        section: flow.sections[flow.currentSection].title,
        type: flow.sections[flow.currentSection].type
      });
    }
    
    // Get slide
    const slide = this.getSlideByNumber(flow, flow.currentSlide);
    if (!slide) return null;
    
    // Reset slide reveal state
    slide.currentRevealedPoint = 0;
    slide.fullyRevealed = false;
    
    // Show slide (fully revealed when going back)
    await this.revealSlideCompletely(flow, slide);
    
    return slide;
  }
  
  /**
   * القفز لشريحة محددة
   */
  async jumpToSlide(userId: string, lessonId: string, slideNumber: number): Promise<GeneratedSlide | null> {
    const flow = this.getFlow(userId, lessonId);
    if (!flow || slideNumber < 0 || slideNumber >= flow.totalSlides) return null;
    
    // Clear any active reveal timers
    this.clearRevealTimers(flow.id);
    
    flow.currentSlide = slideNumber;
    
    // Find section for this slide
    let slideCount = 0;
    for (let i = 0; i < flow.sections.length; i++) {
      const sectionSlides = flow.sections[i].slides.length;
      if (slideNumber < slideCount + sectionSlides) {
        flow.currentSection = i;
        break;
      }
      slideCount += sectionSlides;
    }
    
    // Get and show slide
    const slide = this.getSlideByNumber(flow, slideNumber);
    if (slide) {
      await this.revealSlideCompletely(flow, slide);
    }
    
    return slide;
  }
  
  /**
   * تحقق من صلة السؤال بالمحتوى الحالي
   */
  private async checkQuestionRelevance(question: string, flow: LessonFlow): Promise<boolean> {
    const currentSection = flow.sections[flow.currentSection];
    const currentSlide = this.getSlideByNumber(flow, flow.currentSlide);
    
    if (!currentSlide) return false;
    
    // Check keywords
    const questionLower = question.toLowerCase();
    for (const keyword of currentSection.keywords) {
      if (questionLower.includes(keyword.toLowerCase())) {
        return true;
      }
    }
    
    // Check anticipated questions
    for (const anticipated of currentSection.anticipatedQuestions) {
      if (this.similarQuestions(question, anticipated)) {
        return true;
      }
    }
    
    // Use AI if available
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `
هل السؤال التالي متعلق بالمحتوى الحالي؟
السؤال: "${question}"
المحتوى: ${currentSlide.content.title} - ${currentSection.title}
الرد (نعم/لا):`;
        
        const response = await openAIService.chat([
          { role: 'user', content: prompt }
        ], {
          temperature: 0.3,
          maxTokens: 10
        });
        
        return response.toLowerCase().includes('نعم');
      } catch (error) {
        console.error('Relevance check failed:', error);
      }
    }
    
    return false;
  }
  
  /**
   * الإجابة على سؤال سياقي
   */
  private async answerContextualQuestion(flow: LessonFlow, question: string): Promise<void> {
    const currentSection = flow.sections[flow.currentSection];
    const currentSlide = this.getSlideByNumber(flow, flow.currentSlide);
    
    let answer = 'دعني أوضح لك...';
    
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `
أجب على السؤال التالي في سياق الدرس الحالي:
السؤال: "${question}"
السياق: درس عن ${currentSection.title}
المحتوى الحالي: ${currentSlide?.content.title}
الإجابة (فقرة واحدة):`;
        
        answer = await openAIService.chat([
          { role: 'user', content: prompt }
        ], {
          temperature: 0.7,
          maxTokens: 200
        });
      } catch (error) {
        console.error('Failed to generate answer:', error);
      }
    }
    
    // Send answer
    websocketService.sendToUser(flow.userId, 'contextual_answer', {
      lessonId: flow.lessonId,
      question,
      answer,
      slideContext: flow.currentSlide,
      sectionContext: currentSection.title
    });
    
    // Update conversation state
    flow.conversationState.messageHistory.push({
      role: 'assistant',
      content: answer,
      timestamp: new Date()
    });
  }
  
  /**
   * الإجابة والاستمرار
   */
  private async answerAndContinue(flow: LessonFlow, question: string): Promise<void> {
    await this.answerContextualQuestion(flow, question);
    
    // Ask if user wants to continue
    websocketService.sendToUser(flow.userId, 'continue_prompt', {
      lessonId: flow.lessonId,
      message: 'هل تريد أن نكمل الشرح؟',
      options: [
        { id: 'continue', label: 'كمل', icon: 'play' },
        { id: 'stay', label: 'ابقى هنا', icon: 'pause' }
      ]
    });
    
    flow.conversationState.waitingForUserChoice = true;
    flow.conversationState.choiceOptions = [
      { id: 'continue', label: 'كمل' },
      { id: 'stay', label: 'ابقى هنا' }
    ];
  }
  
  /**
   * معالجة سؤال خارج الموضوع
   */
  private async handleOffTopicQuestion(flow: LessonFlow, question: string): Promise<void> {
    websocketService.sendToUser(flow.userId, 'off_topic_question', {
      lessonId: flow.lessonId,
      message: 'سؤال ممتاز! لكنه عن موضوع آخر. هل تريد:',
      options: [
        { id: 'answer_now', label: 'أجب الآن', icon: 'message' },
        { id: 'answer_later', label: 'اسأل لاحقاً', icon: 'clock' },
        { id: 'continue', label: 'كمل الشرح', icon: 'play' }
      ]
    });
    
    flow.conversationState.waitingForUserChoice = true;
  }
  
  /**
   * إنشاء أقسام الدرس مع دعم العرض التدريجي
   */
  private async createLessonSectionsWithProgressive(lesson: any, isMathLesson: boolean): Promise<LessonSection[]> {
    const sections: LessonSection[] = [];
    const keyPoints = JSON.parse(lesson.keyPoints || '[]');
    const mainContent = JSON.parse(lesson.content || '{}');
    
    // 1. Introduction Section with progressive reveal
    sections.push({
      id: 'intro',
      type: 'intro',
      title: 'مقدمة الدرس',
      slides: [
        {
          number: 1,
          type: 'title',
          content: {
            title: lesson.title,
            subtitle: lesson.unit.title
          },
          duration: 5,
          isMathSlide: false,
          points: [
            `مرحباً! سنتعلم اليوم عن ${lesson.title}`,
            `هذا الدرس جزء من ${lesson.unit.title}`,
            `هيا نبدأ رحلة التعلم!`
          ],
          pointTimings: [0, 2, 4]
        },
        {
          number: 2,
          type: 'bullet',
          content: {
            title: 'ماذا سنتعلم اليوم؟',
            bullets: JSON.parse(lesson.objectives || '[]')
          },
          duration: 10,
          isMathSlide: false,
          points: JSON.parse(lesson.objectives || '[]'),
          pointTimings: [0, 3, 6, 9]
        }
      ],
      duration: 15,
      completed: false,
      hasProgressiveContent: true,
      progressivePoints: [
        { content: 'مرحباً بك', revealAt: 0 },
        { content: 'سنبدأ الآن', revealAt: 3 }
      ],
      objectives: ['فهم موضوع الدرس', 'معرفة الأهداف'],
      keywords: ['مقدمة', 'أهداف'],
      anticipatedQuestions: ['ما هو موضوع الدرس؟', 'ماذا سنتعلم؟'],
      hasMathContent: false
    });
    
    // 2. Main Content Sections with progressive points
    for (let i = 0; i < keyPoints.length; i++) {
      const point = keyPoints[i];
      const sectionSlides: GeneratedSlide[] = [];
      const hasMathInPoint = isMathLesson && this.detectMathContent(point);
      
      // Split content into progressive points
      const contentText = this.extractContentForPoint(mainContent, point);
      const contentPoints = this.splitContentToPoints(contentText);
      
      // Concept slide with progressive reveal
      sectionSlides.push({
        number: sections.length * 3 + 1,
        type: hasMathInPoint ? 'math-content' : 'content',
        content: {
          title: point,
          text: contentText,
          mathExpression: hasMathInPoint ? this.extractMathExpression(point) : undefined
        },
        duration: 20,
        isMathSlide: hasMathInPoint,
        mathExpressions: hasMathInPoint ? [this.extractMathExpression(point)!] : [],
        points: contentPoints,
        pointTimings: contentPoints.map((_, idx) => idx * 3)
      });
      
      // Bullet points slide with progressive reveal
      const bulletPoints = this.generateBulletPoints(mainContent, point);
      sectionSlides.push({
        number: sections.length * 3 + 2,
        type: 'bullet',
        content: {
          title: `نقاط مهمة: ${point}`,
          bullets: bulletPoints
        },
        duration: 10,
        isMathSlide: false,
        points: bulletPoints,
        pointTimings: bulletPoints.map((_, idx) => idx * 2)
      });
      
      sections.push({
        id: `concept-${i}`,
        type: hasMathInPoint ? 'math-concept' : 'concept',
        title: point,
        slides: sectionSlides,
        duration: 30,
        completed: false,
        hasProgressiveContent: true,
        progressivePoints: contentPoints.map((content, idx) => ({
          content,
          revealAt: idx * 3,
          animation: 'fadeIn'
        })),
        objectives: [`فهم ${point}`, `تطبيق ${point}`],
        keywords: this.extractKeywords(point),
        anticipatedQuestions: [
          `ما معنى ${point}؟`,
          `كيف أطبق ${point}؟`,
          `أعطني مثال على ${point}`,
          ...(hasMathInPoint ? [`احسب ${point}`, `حل معادلة ${point}`] : [])
        ],
        hasMathContent: hasMathInPoint
      });
    }
    
    // Add remaining sections (examples, practice, summary)...
    // (نفس الكود الأصلي مع إضافة progressive properties)
    
    return sections;
  }
  
  /**
   * تقسيم المحتوى إلى نقاط للعرض التدريجي
   */
  private splitContentToPoints(content: string): string[] {
    if (!content) return [];
    
    // Split by sentences
    const sentences = content.split(/[.!؟]/g).filter(s => s.trim().length > 0);
    
    // Group sentences into logical points (2-3 sentences per point)
    const points: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const point = sentences[i] + '.' + 
                   (sentences[i + 1] ? ' ' + sentences[i + 1] + '.' : '');
      points.push(point.trim());
    }
    
    // Maximum 5 points per slide
    return points.slice(0, 5);
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
   * تشغيل صوت كامل
   */
  private async playAudio(flow: LessonFlow, audioUrl: string): Promise<void> {
    websocketService.sendToUser(flow.userId, 'play_audio', {
      lessonId: flow.lessonId,
      audioUrl,
      playbackSpeed: flow.playbackSpeed,
      fullAudio: true
    });
  }
  
  /**
   * مسح مؤقتات الكشف التدريجي
   */
  private clearRevealTimers(flowId: string): void {
    const timers = this.revealTimers.get(flowId);
    if (timers) {
      timers.forEach(timer => clearTimeout(timer));
      this.revealTimers.delete(flowId);
    }
  }
  
  /**
   * التحقق من تشابه الأسئلة
   */
  private similarQuestions(q1: string, q2: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[؟?.,!]/g, '').trim();
    const n1 = normalize(q1);
    const n2 = normalize(q2);
    
    // Simple similarity check
    return n1.includes(n2) || n2.includes(n1) || 
           this.calculateSimilarity(n1, n2) > 0.7;
  }
  
  /**
   * حساب التشابه بين نصين
   */
  private calculateSimilarity(s1: string, s2: string): number {
    const words1 = s1.split(' ');
    const words2 = s2.split(' ');
    const common = words1.filter(w => words2.includes(w));
    return common.length / Math.max(words1.length, words2.length);
  }
  
  /**
   * التحقق إذا كان السؤال عن المحتوى الحالي
   */
  private isQuestionAboutCurrentContent(question: string, flow: LessonFlow): boolean {
    const currentSection = flow.sections[flow.currentSection];
    const questionLower = question.toLowerCase();
    
    // Check section keywords
    return currentSection.keywords.some(keyword => 
      questionLower.includes(keyword.toLowerCase())
    );
  }
  
  // ============= KEEP ALL ORIGINAL HELPER METHODS =============
  // (احتفظ بكل الـ methods الأصلية كما هي)
  
  public getFlow(userId: string, lessonId: string): LessonFlow | undefined {
    return this.activeLessons.get(`${userId}-${lessonId}`);
  }
  
  private async loadLessonWithContent(lessonId: string): Promise<any> {
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
  
  private checkIfMathLesson(lesson: any): boolean {
    const subjectName = lesson.unit.subject.name.toLowerCase();
    const subjectNameEn = (lesson.unit.subject.nameEn || '').toLowerCase();
    
    return subjectName.includes('رياضيات') || 
           subjectName.includes('رياضة') ||
           subjectNameEn.includes('math') ||
           subjectNameEn.includes('algebra') ||
           subjectNameEn.includes('geometry');
  }
  
  // ... (باقي الـ helper methods كما هي في الملف الأصلي)
  
  private detectMathContent(text: string): boolean {
    if (!text) return false;
    
    const mathIndicators = [
      'معادلة', 'حل', 'احسب', 'رقم', 'عدد', 'جمع', 'طرح', 'ضرب', 'قسمة',
      'مربع', 'جذر', 'أس', 'كسر', 'نسبة', 'متغير', 'دالة', 'رسم بياني',
      'equation', 'solve', 'calculate', 'number', 'add', 'subtract',
      'multiply', 'divide', 'square', 'root', 'power', 'fraction',
      'ratio', 'variable', 'function', 'graph',
      '+', '-', '×', '÷', '=', 'x', 'y', '^', '²', '³'
    ];
    
    const lowerText = text.toLowerCase();
    return mathIndicators.some(indicator => lowerText.includes(indicator));
  }
  
  // ... (كل الـ methods الأصلية الأخرى)
  
  private async generateInitialSlides(flow: LessonFlow): Promise<void> {
    const slidesToGenerate = Math.min(5, flow.totalSlides);
    
    for (let i = 0; i < slidesToGenerate; i++) {
      const slide = this.getSlideByNumber(flow, i);
      if (!slide) continue;
      
      if (slide.isMathSlide) {
        slide.html = await this.generateMathSlideHTML(slide, flow);
      } else {
        slide.html = await this.generateSlideHTML(flow, slide);
      }
    }
  }
  
  // ... (باقي implementation كما هو)
  
  private async analyzeMessageIntent(
    message: string,
    flow: LessonFlow
  ): Promise<ActionTrigger | null> {
    const lowerMessage = message.toLowerCase();
    
    // Math-specific patterns (أولوية عالية)
    if (flow.isMathLesson) {
      const mathPatterns: Array<{pattern: RegExp | string[], action: ActionTrigger['action']}> = [
        {
          pattern: ['احسب', 'حل المعادلة', 'حل المسألة', 'solve', 'calculate'],
          action: 'solve_equation'
        },
        {
          pattern: ['معادلة', 'equation', 'دالة', 'function', 'رسم بياني', 'graph'],
          action: 'show_math'
        },
        {
          pattern: ['خطوات الحل', 'كيف أحل', 'طريقة الحل', 'steps'],
          action: 'show_math'
        }
      ];
      
      for (const { pattern, action } of mathPatterns) {
        const matches = Array.isArray(pattern)
          ? pattern.some(p => lowerMessage.includes(p))
          : pattern.test(lowerMessage);
          
        if (matches) {
          return {
            trigger: message,
            action,
            confidence: 0.9,
            mathRelated: true
          };
        }
      }
    }
    
    // General patterns
    const patterns: Array<{pattern: RegExp | string[], action: ActionTrigger['action']}> = [
      {
        pattern: ['اشرح', 'وضح', 'فسر', 'ما معنى', 'لم أفهم'],
        action: 'explain_more'
      },
      {
        pattern: ['مثال', 'مثل', 'أمثلة', 'تطبيق'],
        action: 'show_example'
      },
      {
        pattern: ['اختبر', 'تمرين', 'سؤال', 'quiz'],
        action: 'start_quiz'
      },
      {
        pattern: ['بسط', 'سهل', 'ابسط', 'صعب'],
        action: 'simplify'
      },
      {
        pattern: ['فيديو', 'شاهد', 'عرض'],
        action: 'show_video'
      },
      {
        pattern: ['شريحة', 'اعرض', 'ارسم', 'وضح بالرسم'],
        action: 'generate_slide'
      }
    ];
    
    for (const { pattern, action } of patterns) {
      const matches = Array.isArray(pattern)
        ? pattern.some(p => lowerMessage.includes(p))
        : pattern.test(lowerMessage);
        
      if (matches) {
        return {
          trigger: message,
          action,
          confidence: 0.85,
          mathRelated: false
        };
      }
    }
    
    return null;
  }
  
  // ... (كل باقي الـ methods كما هي)
  
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
  
  public getSectionStartSlide(flow: LessonFlow, sectionIndex: number): number {
    let count = 0;
    for (let i = 0; i < sectionIndex; i++) {
      count += flow.sections[i].slides.length;
    }
    return count;
  }
  
  private getThemeByGrade(grade: number): string {
    if (grade <= 6) return 'colorful';
    if (grade <= 9) return 'blue';
    return 'dark';
  }
  
  // ... (كل الـ methods الأصلية المتبقية)
  
  private async executeAction(flow: LessonFlow, action: ActionTrigger): Promise<void> {
    console.log(`🎬 Executing action: ${action.action}${action.mathRelated ? ' (Math)' : ''}`);
    
    switch (action.action) {
      case 'generate_slide':
        await this.generateExplanationSlide(flow, action.trigger);
        break;
        
      case 'show_example':
        if (flow.isMathLesson) {
          await this.generateMathExampleSlide(flow);
        } else {
          await this.generateExampleSlide(flow);
        }
        break;
        
      case 'start_quiz':
        if (flow.isMathLesson) {
          await this.generateMathQuizSlide(flow);
        } else {
          await this.generateQuizSlide(flow);
        }
        break;
        
      case 'explain_more':
        await this.generateDetailedExplanation(flow);
        break;
        
      case 'simplify':
        await this.generateSimplifiedSlide(flow);
        break;
        
      case 'show_video':
        await this.suggestVideo(flow);
        break;
        
      case 'show_math':
        await this.generateInteractiveMathSlide(flow, action.trigger);
        break;
        
      case 'solve_equation':
        await this.generateSolutionSlide(flow, action.trigger);
        break;
    }
    
    websocketService.sendToUser(flow.userId, 'action_executed', {
      action: action.action,
      trigger: action.trigger,
      mathRelated: action.mathRelated
    });
  }
  
  // ... (كل الـ math methods والـ helper methods المتبقية كما هي)
  
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
        
      case 'math-interactive':
        const quadratic = latexRenderer.getCommonExpressions().quadratic;
        quadratic.variables = content.variables || quadratic.variables;
        
        return await mathSlideGenerator.generateMathSlide({
          title: content.title,
          mathExpressions: [quadratic],
          interactive: true,
          showSteps: true
        });
        
      default:
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
  }
  
  // ... (باقي الكود كما هو)
  
  private extractContentForPoint(content: any, point: string): string {
    if (typeof content === 'string') return content.substring(0, 200);
    if (content[point]) return content[point];
    return `شرح مفصل عن ${point}`;
  }
  
  private generateBulletPoints(content: any, point: string): string[] {
    return [
      `التعريف: ${point}`,
      `الأهمية: لماذا ندرس ${point}`,
      `التطبيق: كيف نستخدم ${point}`,
      `ملاحظة: نقطة مهمة عن ${point}`
    ];
  }
  
  private extractKeywords(text: string): string[] {
    return text.split(' ')
      .filter(word => word.length > 3)
      .slice(0, 5);
  }
  
  // ... (كل الـ methods المتبقية كما هي)
  
  private async completeLessonFlow(flow: LessonFlow): Promise<void> {
    flow.sections.forEach(s => s.completed = true);
    flow.actualDuration = Math.floor((Date.now() - flow.startTime.getTime()) / 1000);
    
    websocketService.sendToUser(flow.userId, 'lesson_completed', {
      lessonId: flow.lessonId,
      duration: flow.actualDuration,
      questionsAsked: flow.questionsAsked,
      engagementScore: flow.engagementScore,
      comprehensionLevel: flow.comprehensionLevel,
      isMathLesson: flow.isMathLesson,
      mathProblemsAttempted: flow.mathProblemsAttempted || 0,
      mathProblemsSolved: flow.mathProblemsSolved || 0
    });
    
    this.emit('lessonCompleted', {
      userId: flow.userId,
      lessonId: flow.lessonId,
      stats: {
        duration: flow.actualDuration,
        questionsAsked: flow.questionsAsked,
        engagementScore: flow.engagementScore
      }
    });
    
    this.activeLessons.delete(`${flow.userId}-${flow.lessonId}`);
  }
  
  // ... (باقي الـ methods)
  
  private async generateSlideHTML(flow: LessonFlow, slide: GeneratedSlide): Promise<string> {
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
  
  private async preGenerateUpcomingSlides(flow: LessonFlow, count: number): Promise<void> {
    setTimeout(async () => {
      for (let i = 1; i <= count; i++) {
        const slideNum = flow.currentSlide + i;
        if (slideNum >= flow.totalSlides) break;
        
        const slide = this.getSlideByNumber(flow, slideNum);
        if (slide && !slide.html) {
          if (slide.isMathSlide) {
            slide.html = await this.generateMathSlideHTML(slide, flow);
          } else {
            slide.html = await this.generateSlideHTML(flow, slide);
          }
        }
      }
    }, 100);
  }
  
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
  
  // ... (كل الـ methods الأصلية المتبقية)
  
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
  
  private extractEquation(text: string): string | null {
    const patterns = [
      /([a-z0-9\s\+\-\*\/\^\(\)]+)\s*=\s*([a-z0-9\s\+\-\*\/\^\(\)]+)/i,
      /([س-ي]\s*[\+\-\*\/]\s*\d+)\s*=\s*(\d+)/,
      /(\d+[a-z])\s*[\+\-]\s*(\d+)\s*=\s*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return null;
  }
  
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
  
  // ... (كل الـ methods المتبقية)
  
  private insertSlideAfterCurrent(flow: LessonFlow, newSlide: GeneratedSlide): void {
    const currentSection = flow.sections[flow.currentSection];
    const insertIndex = flow.currentSlide - this.getSectionStartSlide(flow, flow.currentSection) + 1;
    
    currentSection.slides.splice(insertIndex, 0, newSlide);
    flow.totalSlides++;
    
    this.renumberSlides(flow);
  }
  
  private renumberSlides(flow: LessonFlow): void {
    let number = 0;
    for (const section of flow.sections) {
      for (const slide of section.slides) {
        slide.number = number++;
      }
    }
  }
  
  // ... (كل الـ methods الأصلية المتبقية كما هي في الملف الأصلي)
  
  private getGradeFromFlow(flow: LessonFlow): number {
    return 6;
  }
  
  private async generateDetailedExplanation(flow: LessonFlow): Promise<void> {
    await this.generateExplanationSlide(flow, flow.sections[flow.currentSection].title);
  }
  
  private async generateSimplifiedSlide(flow: LessonFlow): Promise<void> {
    const current = this.getSlideByNumber(flow, flow.currentSlide);
    if (!current) return;
    
    const simplified: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'content',
      content: {
        title: 'شرح مبسط',
        text: `نسخة مبسطة من: ${current.content.title || 'المحتوى'}`
      },
      duration: 15,
      isMathSlide: false
    };
    
    simplified.html = await this.generateSlideHTML(flow, simplified);
    this.insertSlideAfterCurrent(flow, simplified);
    
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: simplified,
      reason: 'simplification_requested'
    });
  }
  
  private async suggestVideo(flow: LessonFlow): Promise<void> {
    websocketService.sendToUser(flow.userId, 'video_suggestion', {
      url: 'https://youtube.com/example',
      title: `فيديو عن ${flow.sections[flow.currentSection].title}`,
      duration: '5:30'
    });
  }
  
  // ... (باقي الـ methods كما هي)
  
  private async generateExplanationSlide(flow: LessonFlow, topic: string): Promise<void> {
    const currentSection = flow.sections[flow.currentSection];
    
    let content = `شرح تفصيلي عن: ${topic}`;
    
    if (process.env.OPENAI_API_KEY) {
      const prompt = `
اشرح للطالب في الصف ${this.getGradeFromFlow(flow)} الموضوع التالي:
"${topic}"

في سياق درس: ${currentSection.title}

الشرح (فقرة واحدة واضحة):`;
      
      try {
        content = await openAIService.chat([
          { role: 'user', content: prompt }
        ], {
          temperature: 0.7,
          maxTokens: 200
        });
      } catch (error) {
        console.error('Failed to generate explanation:', error);
      }
    }
    
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'content',
      content: {
        title: `شرح إضافي: ${topic}`,
        text: content
      },
      duration: 20,
      isMathSlide: false,
      points: this.splitContentToPoints(content),
      pointTimings: [0, 3, 6, 9, 12]
    };
    
    newSlide.html = slideGenerator.generateRealtimeSlideHTML(
      {
        id: `slide-${newSlide.number}`,
        type: 'content',
        content: newSlide.content,
        duration: newSlide.duration,
        transitions: { in: 'fade', out: 'fade' }
      },
      flow.theme as any
    );
    
    this.insertSlideAfterCurrent(flow, newSlide);
    
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: newSlide,
      reason: 'explanation_requested'
    });
  }
  
  // ... (كل الـ methods المتبقية كما هي)
  
  private async generateExampleSlide(flow: LessonFlow): Promise<void> {
    const currentSection = flow.sections[flow.currentSection];
    const topic = currentSection.title;
    
    let example = {
      title: `مثال على ${topic}`,
      content: 'مثال توضيحي...'
    };
    
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `
أعط مثال واضح ومناسب للصف ${this.getGradeFromFlow(flow)} على:
"${topic}"

المثال (مع الشرح):`;
        
        const response = await openAIService.chat([
          { role: 'user', content: prompt }
        ], {
          temperature: 0.7,
          maxTokens: 150
        });
        
        example.content = response;
      } catch (error) {
        console.error('Failed to generate example:', error);
      }
    }
    
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'content',
      content: {
        title: example.title,
        text: example.content
      },
      duration: 15,
      isMathSlide: false,
      points: this.splitContentToPoints(example.content)
    };
    
    newSlide.html = slideGenerator.generateRealtimeSlideHTML(
      {
        id: `slide-${newSlide.number}`,
        type: 'content',
        content: newSlide.content,
        duration: newSlide.duration,
        transitions: { in: 'slide', out: 'slide' }
      },
      'colorful'
    );
    
    this.insertSlideAfterCurrent(flow, newSlide);
    
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: newSlide,
      reason: 'example_requested'
    });
  }
  
  // ... (كل الـ methods الأصلية المتبقية)
  
  private async generateQuizSlide(flow: LessonFlow): Promise<void> {
    const currentSection = flow.sections[flow.currentSection];
    
    const quiz = {
      question: `اختبر فهمك: ${currentSection.title}`,
      options: [
        'الإجابة الأولى',
        'الإجابة الثانية',
        'الإجابة الثالثة',
        'الإجابة الرابعة'
      ],
      correctIndex: Math.floor(Math.random() * 4)
    };
    
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `
اكتب سؤال اختيار من متعدد للصف ${this.getGradeFromFlow(flow)} عن:
"${currentSection.title}"

بصيغة JSON:
{
  "question": "السؤال",
  "options": ["خيار1", "خيار2", "خيار3", "خيار4"],
  "correctIndex": رقم_الإجابة_الصحيحة
}`;
        
        const response = await openAIService.chat([
          { role: 'system', content: 'You are a JSON generator. Always respond with valid JSON only, no text outside the JSON structure.' },
          { role: 'user', content: prompt }
        ], {
          temperature: 0.5,
          maxTokens: 200
        });
        
        const cleanedResponse = response
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        
        let jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          Object.assign(quiz, parsed);
        }
      } catch (error) {
        console.error('Failed to generate quiz:', error);
      }
    }
    
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'quiz',
      content: { quiz },
      duration: 30,
      isMathSlide: false
    };
    
    newSlide.html = slideGenerator.generateRealtimeSlideHTML(
      {
        id: `slide-${newSlide.number}`,
        type: 'quiz',
        content: newSlide.content,
        duration: newSlide.duration,
        transitions: { in: 'zoom', out: 'zoom' }
      },
      'blue'
    );
    
    this.insertSlideAfterCurrent(flow, newSlide);
    
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: newSlide,
      reason: 'quiz_requested'
    });
  }
  
  // ... (كل الـ math-specific methods كما هي)
  
  private async generateInteractiveMathSlide(flow: LessonFlow, topic: string): Promise<void> {
    console.log(`🧮 Generating interactive math slide for: ${topic}`);
    
    let mathExpression: MathExpression;
    
    if (topic.includes('تربيعية') || topic.includes('quadratic')) {
      mathExpression = latexRenderer.getCommonExpressions().quadratic;
    } else if (topic.includes('فيثاغورس') || topic.includes('pythagorean')) {
      mathExpression = latexRenderer.getCommonExpressions().pythagorean;
    } else if (topic.includes('كسر') || topic.includes('fraction')) {
      mathExpression = latexRenderer.getCommonExpressions().fraction;
    } else {
      mathExpression = {
        id: 'custom',
        latex: 'f(x) = mx + b',
        type: 'equation',
        description: topic,
        isInteractive: true,
        variables: [
          { name: 'm', value: 2, min: -10, max: 10, step: 1 },
          { name: 'b', value: 3, min: -10, max: 10, step: 1 }
        ]
      };
    }
    
    const html = await mathSlideGenerator.generateMathSlide({
      title: `معادلة تفاعلية: ${topic}`,
      mathExpressions: [mathExpression],
      text: `استخدم الأشرطة المتحركة لتغيير قيم المتغيرات ولاحظ التأثير على المعادلة`,
      interactive: true,
      showSteps: true
    });
    
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'math-interactive',
      content: {
        title: `معادلة تفاعلية`,
        expression: mathExpression
      },
      duration: 30,
      html,
      isMathSlide: true,
      mathExpressions: [mathExpression]
    };
    
    this.insertSlideAfterCurrent(flow, newSlide);
    if (flow.mathProblemsAttempted !== undefined) flow.mathProblemsAttempted++;
    
    websocketService.sendToUser(flow.userId, 'math_slide_generated', {
      slide: newSlide,
      reason: 'interactive_math_requested'
    });
  }
  
  // ... (كل الـ methods المتبقية)
  
  private async generateSolutionSlide(flow: LessonFlow, equation: string): Promise<void> {
    console.log(`🔢 Generating solution slide for: ${equation}`);
    
    const extractedEquation = this.extractEquation(equation) || 'x + 5 = 10';
    const steps = await this.generateSolutionSteps(extractedEquation);
    
    const mathExpression: MathExpression = {
      id: 'solution',
      latex: extractedEquation,
      type: 'equation',
      description: 'حل المعادلة خطوة بخطوة',
      steps: steps
    };
    
    const html = await mathSlideGenerator.generateMathProblemSlide({
      title: 'حل المعادلة',
      question: equation,
      equation: extractedEquation,
      solution: steps[steps.length - 1]?.latex || 'x = ?',
      steps: steps
    });
    
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'math-solution',
      content: {
        title: 'حل المعادلة',
        equation: extractedEquation,
        steps: steps
      },
      duration: 40,
      html,
      isMathSlide: true,
      mathExpressions: [mathExpression]
    };
    
    this.insertSlideAfterCurrent(flow, newSlide);
    if (flow.mathProblemsSolved !== undefined) flow.mathProblemsSolved++;
    
    websocketService.sendToUser(flow.userId, 'solution_slide_generated', {
      slide: newSlide,
      reason: 'solution_requested'
    });
  }
  
  // ... (كل الـ methods المتبقية)
  
  private async generateSolutionSteps(equation: string): Promise<any[]> {
    const steps = [
      {
        stepNumber: 1,
        latex: equation,
        explanation: 'المعادلة الأصلية',
        highlight: []
      },
      {
        stepNumber: 2,
        latex: equation.replace('=', '\\Rightarrow'),
        explanation: 'نبدأ بتبسيط المعادلة',
        highlight: []
      },
      {
        stepNumber: 3,
        latex: 'x = ?',
        explanation: 'الحل النهائي',
        highlight: ['x']
      }
    ];
    
    return steps;
  }
  
  // ... (كل الـ math helper methods المتبقية)
  
  private async generateMathExampleSlide(flow: LessonFlow): Promise<void> {
    const currentSection = flow.sections[flow.currentSection];
    
    const example = {
      title: `مثال رياضي: ${currentSection.title}`,
      question: 'إذا كانت س + 3 = 10، فما قيمة س؟',
      solution: 'س = 7',
      equation: 'x + 3 = 10'
    };
    
    const html = await mathSlideGenerator.generateMathProblemSlide(example);
    
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'math-example',
      content: example,
      duration: 25,
      html,
      isMathSlide: true
    };
    
    this.insertSlideAfterCurrent(flow, newSlide);
    
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: newSlide,
      reason: 'math_example_requested'
    });
  }
  
  private async generateMathQuizSlide(flow: LessonFlow): Promise<void> {
    const currentSection = flow.sections[flow.currentSection];
    
    const quiz = {
      title: 'اختبار سريع',
      problem: 'حل المعادلة: 2x - 4 = 10',
      options: ['x = 7', 'x = 3', 'x = 5', 'x = 14'],
      correctIndex: 0,
      solution: 'x = 7',
      explanation: 'نضيف 4 للطرفين: 2x = 14، ثم نقسم على 2: x = 7'
    };
    
    const html = await mathSlideGenerator.generateMathProblemSlide({
      title: quiz.title,
      question: quiz.problem,
      solution: quiz.solution,
      hints: ['أضف 4 للطرفين أولاً', 'ثم اقسم على 2']
    });
    
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'math-quiz',
      content: { quiz },
      duration: 35,
      html,
      isMathSlide: true
    };
    
    this.insertSlideAfterCurrent(flow, newSlide);
    if (flow.mathProblemsAttempted !== undefined) flow.mathProblemsAttempted++;
    
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: newSlide,
      reason: 'math_quiz_requested'
    });
  }
}

// Export singleton
export const lessonOrchestrator = new LessonOrchestratorService();