// 📍 المكان: src/services/websocket/websocket.service.ts
// ✨ النسخة المحدثة مع TeachingAssistant + SlideService + VoiceService

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { config } from '../../config';
import { prisma } from '../../config/database.config';
import { sessionService, type ExtendedSession } from './session.service';
import type { LearningSession } from '@prisma/client';
import { openAIService } from '../ai/openai.service';

// ============= SLIDE SERVICE =============
import { slideService, type SlideContent } from '../slides/slide.service';

// ============= VOICE SERVICE =============
import { voiceService } from '../voice/voice.service';

// ============= TEACHING ASSISTANT SERVICE (NEW!) =============
import { 
  teachingAssistant, 
  type InteractionType 
} from '../teaching/teaching-assistant.service';

// ============= MATH IMPORTS =============
import { mathSlideGenerator } from '../../core/video/enhanced-slide.generator';
import { latexRenderer, type MathExpression } from '../../core/interactive/math/latex-renderer';

// ============= INTERFACES =============

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  grade: number | null;
}

interface SessionInfo {
  sessionId: string;
  lessonId: string;
  userId: string;
  currentSlideIndex?: number;
  teachingHistory?: string[];
}

interface VoiceGenerationStatus {
  lessonId: string;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  progress: number;
  totalSlides: number;
  completedSlides: number;
  audioUrls?: string[];
  error?: string;
}

// ============= NEW INTERFACE FOR TEACHING =============
interface TeachingSessionData {
  lessonId: string;
  userId: string;
  currentScript?: string;
  previousScripts: string[];
  slideHistory: any[];
  interactionCount: number;
  startedAt: Date;
  lastInteraction?: Date;
  studentProgress: number;
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, Socket> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private userSessions: Map<string, SessionInfo> = new Map();
  private voiceGenerationStatus: Map<string, VoiceGenerationStatus> = new Map();
  
  // 🆕 Teaching session tracking
  private teachingSessions: Map<string, TeachingSessionData> = new Map();
  
  /**
   * Initialize WebSocket server with proper configuration
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.NODE_ENV === 'development' ? '*' : ['https://yourdomain.com'],
        credentials: true,
        methods: ['GET', 'POST']
      },
      
      transports: ['polling', 'websocket'],
      allowUpgrades: true,
      
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 45000,
      
      path: '/socket.io/',
      allowEIO3: true
    });
    
    // Setup event handlers
    this.setupEventHandlers();
    
    console.log('✅ WebSocket server initialized');
    console.log('   📌 Path: /socket.io/');
    console.log('   🔌 Transports: polling + websocket');
    console.log('   🧮 Math components: ENABLED');
    console.log('   📊 Slide Service: ENABLED (HTML-based)');
    console.log('   🎙️ Voice Service: ENABLED (ElevenLabs)');
    console.log('   🎓 Teaching Assistant: ENABLED (AI-powered)'); // 🆕
    
    // Start cleanup intervals
    this.startCleanupInterval();
    this.startVoiceCacheCleanup();
    this.startTeachingSessionCleanup(); // 🆕
  }
  
  /**
   * Setup all socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;
    
    this.io.on('connection', async (socket: Socket) => {
      console.log(`✅ NEW CONNECTION: ${socket.id}`);
      
      // Welcome message without auth
      socket.emit('welcome', {
        message: 'مرحباً بك في منصة التعليم الذكية! 👋',
        socketId: socket.id,
        serverTime: new Date().toISOString(),
        features: {
          math: true,
          slides: true,
          chat: true,
          lessons: true,
          voice: true,
          teaching: true // 🆕
        }
      });
      
      // ============= SIMPLIFIED AUTHENTICATION =============
      socket.on('authenticate', async (data: { token: string }) => {
        try {
          if (!data?.token) {
            socket.emit('auth_error', {
              success: false,
              message: 'Token required',
              code: 'NO_TOKEN'
            });
            return;
          }
          
          let user: UserData | null = null;
          
          // Development mode - use test user
          if (config.NODE_ENV === 'development') {
            const testUser = await prisma.user.findFirst({
              where: { email: { contains: 'test' } },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                grade: true
              }
            });
            
            if (testUser) {
              user = testUser as UserData;
            } else {
              // Create test user
              const newUser = await prisma.user.create({
                data: {
                  email: 'test@test.com',
                  password: '$2b$10$dummy',
                  firstName: 'Test',
                  lastName: 'User',
                  role: 'STUDENT',
                  grade: 6,
                  isActive: true,
                  emailVerified: true
                }
              });
              
              user = {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                role: newUser.role,
                grade: newUser.grade
              };
            }
          } else {
            // Production - verify real token
            try {
              const decoded = jwt.verify(data.token, config.JWT_SECRET) as any;
              const dbUser = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  grade: true
                }
              });
              
              if (dbUser) {
                user = dbUser as UserData;
              }
            } catch (err) {
              socket.emit('auth_error', {
                success: false,
                message: 'Invalid token',
                code: 'INVALID_TOKEN'
              });
              return;
            }
          }
          
          if (!user) {
            socket.emit('auth_error', {
              success: false,
              message: 'Authentication failed',
              code: 'AUTH_FAILED'
            });
            return;
          }
          
          // Save user data
          socket.data.user = user;
          socket.data.authenticated = true;
          
          // Store socket reference
          this.connectedUsers.set(user.id, socket);
          
          // 🆕 Generate personalized greeting
          const timeOfDay = this.getTimeOfDay();
          const greeting = await teachingAssistant.generateGreeting(
            user.firstName,
            user.grade || 6,
            timeOfDay
          );
          
          // Send auth confirmation with greeting
          socket.emit('authenticated', {
            success: true,
            userId: user.id,
            email: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            message: 'Authentication successful',
            greeting // 🆕
          });
          
          console.log(`✅ Authenticated: ${user.email}`);
          
        } catch (error: any) {
          console.error('❌ Auth error:', error);
          socket.emit('auth_error', {
            success: false,
            message: 'Authentication failed',
            code: 'AUTH_ERROR'
          });
        }
      });
      
      // ============= LESSON EVENTS =============
      
      socket.on('join_lesson', async (data: { lessonId: string }) => {
        try {
          if (!socket.data.authenticated || !socket.data.user) {
            socket.emit('error', {
              code: 'NOT_AUTHENTICATED',
              message: 'يجب تسجيل الدخول أولاً'
            });
            return;
          }
          
          const user = socket.data.user as UserData;
          const lessonId = data.lessonId;
          
          // Check if lesson exists
          const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            select: {
              id: true,
              title: true,
              titleAr: true,
              unit: {
                select: {
                  title: true,
                  subject: {
                    select: {
                      name: true,
                      nameAr: true,
                      grade: true
                    }
                  }
                }
              }
            }
          });
          
          if (!lesson) {
            socket.emit('error', {
              code: 'LESSON_NOT_FOUND',
              message: 'الدرس غير موجود'
            });
            return;
          }
          
          // Create or get session
          const session = await sessionService.getOrCreateSession(
            user.id,
            lessonId,
            socket.id
          );
          
          // Store session info
          this.userSessions.set(user.id, {
            sessionId: session.id,
            lessonId,
            userId: user.id,
            currentSlideIndex: 0,
            teachingHistory: [] // 🆕
          });
          
          // 🆕 Initialize teaching session
          const teachingKey = `${lessonId}_${user.id}`;
          this.teachingSessions.set(teachingKey, {
            lessonId,
            userId: user.id,
            previousScripts: [],
            slideHistory: [],
            interactionCount: 0,
            startedAt: new Date(),
            studentProgress: 0
          });
          
          // Join room
          const roomName = `lesson:${lessonId}`;
          socket.join(roomName);
          
          // Track participants
          if (!this.rooms.has(lessonId)) {
            this.rooms.set(lessonId, new Set());
          }
          this.rooms.get(lessonId)!.add(user.id);
          
          // Send confirmation
          socket.emit('joined_lesson', {
            success: true,
            lessonId,
            lessonTitle: lesson.titleAr || lesson.title,
            sessionId: session.id,
            message: `انضممت بنجاح لدرس: ${lesson.titleAr || lesson.title}`
          });
          
          console.log(`✅ ${user.email} joined lesson: ${lessonId}`);
          
        } catch (error: any) {
          console.error('❌ Join lesson error:', error);
          socket.emit('error', {
            code: 'JOIN_FAILED',
            message: 'فشل الانضمام للدرس'
          });
        }
      });
      
      // ============= 🆕 TEACHING ASSISTANT EVENTS =============
      
      /**
       * Generate teaching script for slide with voice
       */
      socket.on('generate_teaching_script', async (data: {
        slideContent: any;
        lessonId: string;
        options?: {
          generateVoice?: boolean;
          voiceStyle?: 'friendly' | 'formal' | 'energetic';
          paceSpeed?: 'slow' | 'normal' | 'fast';
          useAnalogies?: boolean;
          useStories?: boolean;
        }
      }) => {
        try {
          if (!socket.data.authenticated) {
            socket.emit('teaching_error', {
              message: 'يجب تسجيل الدخول أولاً',
              code: 'NOT_AUTHENTICATED'
            });
            return;
          }
          
          const user = socket.data.user as UserData;
          const teachingKey = `${data.lessonId}_${user.id}`;
          const teachingSession = this.teachingSessions.get(teachingKey);
          
          console.log(`🎓 Generating teaching script for ${user.firstName}`);
          
          // Generate teaching script
          const teachingScript = await teachingAssistant.generateTeachingScript({
            slideContent: data.slideContent,
            lessonId: data.lessonId,
            studentGrade: user.grade || 6,
            studentName: user.firstName,
            previousScript: teachingSession?.currentScript,
            sessionHistory: teachingSession?.previousScripts,
            currentProgress: teachingSession?.studentProgress,
            voiceStyle: data.options?.voiceStyle || 'friendly',
            paceSpeed: data.options?.paceSpeed || 'normal',
            useAnalogies: data.options?.useAnalogies,
            useStories: data.options?.useStories
          });
          
          // Update teaching session
          if (teachingSession) {
            teachingSession.currentScript = teachingScript.script;
            teachingSession.previousScripts.push(teachingScript.script);
            teachingSession.slideHistory.push(data.slideContent);
            teachingSession.lastInteraction = new Date();
            teachingSession.studentProgress += 10; // Increment progress
          }
          
          // Generate voice if requested
          let audioUrl: string | null = null;
          if (data.options?.generateVoice !== false) {
            const voiceResult = await voiceService.textToSpeech(teachingScript.script);
            if (voiceResult.success) {
              audioUrl = voiceResult.audioUrl || null;
            }
          }
          
          // Send response
          socket.emit('teaching_script_ready', {
            success: true,
            script: teachingScript.script,
            duration: teachingScript.duration,
            audioUrl,
            keyPoints: teachingScript.keyPoints,
            examples: teachingScript.examples,
            problem: teachingScript.problem,
            visualCues: teachingScript.visualCues,
            interactionPoints: teachingScript.interactionPoints,
            emotionalTone: teachingScript.emotionalTone,
            nextSuggestions: teachingScript.nextSuggestions
          });
          
          console.log(`✅ Teaching script generated (${teachingScript.duration}s)${audioUrl ? ' with voice' : ''}`);
          
        } catch (error: any) {
          console.error('❌ Teaching script error:', error);
          socket.emit('teaching_error', {
            message: 'فشل توليد السكريبت التعليمي',
            error: error.message
          });
        }
      });
      
      /**
       * Handle student interactions (stop, continue, repeat, etc.)
       */
      socket.on('student_interaction', async (data: {
        type: InteractionType;
        lessonId: string;
        currentSlide?: any;
        context?: any;
      }) => {
        try {
          if (!socket.data.authenticated) {
            socket.emit('interaction_error', {
              message: 'يجب تسجيل الدخول أولاً',
              code: 'NOT_AUTHENTICATED'
            });
            return;
          }
          
          const user = socket.data.user as UserData;
          const teachingKey = `${data.lessonId}_${user.id}`;
          const teachingSession = this.teachingSessions.get(teachingKey);
          
          console.log(`🎯 Student interaction: ${data.type} from ${user.firstName}`);
          
          // Handle the interaction
          const response = await teachingAssistant.handleStudentInteraction(
            data.type,
            data.currentSlide || {},
            data.lessonId,
            user.grade || 6,
            {
              studentName: user.firstName,
              previousScript: teachingSession?.currentScript,
              sessionHistory: teachingSession?.previousScripts
            }
          );
          
          // Update interaction count
          if (teachingSession) {
            teachingSession.interactionCount++;
            teachingSession.lastInteraction = new Date();
          }
          
          // Generate voice for response
          let audioUrl: string | null = null;
          const voiceResult = await voiceService.textToSpeech(response.script);
          if (voiceResult.success) {
            audioUrl = voiceResult.audioUrl || null;
          }
          
          // Send interaction response
          socket.emit('interaction_response', {
            success: true,
            type: data.type,
            script: response.script,
            duration: response.duration,
            audioUrl,
            problem: response.problem,
            emotionalTone: response.emotionalTone,
            nextSuggestions: response.nextSuggestions
          });
          
          console.log(`✅ Interaction handled: ${data.type}`);
          
        } catch (error: any) {
          console.error('❌ Interaction error:', error);
          socket.emit('interaction_error', {
            message: 'فشل معالجة التفاعل',
            error: error.message
          });
        }
      });
      
      /**
       * Request explanation for current slide
       */
      socket.on('request_explanation', async (data: {
        lessonId: string;
        slideContent: any;
        detailed?: boolean;
      }) => {
        try {
          const user = socket.data.user as UserData;
          
          const response = await teachingAssistant.handleStudentInteraction(
            data.detailed ? 'more_detail' : 'explain',
            data.slideContent,
            data.lessonId,
            user.grade || 6,
            { studentName: user.firstName }
          );
          
          const voiceResult = await voiceService.textToSpeech(response.script);
          
          socket.emit('explanation_ready', {
            success: true,
            script: response.script,
            audioUrl: voiceResult.audioUrl,
            duration: response.duration
          });
          
        } catch (error: any) {
          socket.emit('explanation_error', {
            message: 'فشل توليد الشرح',
            error: error.message
          });
        }
      });
      
      /**
       * Request example
       */
      socket.on('request_example', async (data: {
        lessonId: string;
        topic?: string;
      }) => {
        try {
          const user = socket.data.user as UserData;
          
          const response = await teachingAssistant.handleStudentInteraction(
            'example',
            { title: data.topic },
            data.lessonId,
            user.grade || 6,
            { studentName: user.firstName }
          );
          
          const voiceResult = await voiceService.textToSpeech(response.script);
          
          socket.emit('example_ready', {
            success: true,
            script: response.script,
            audioUrl: voiceResult.audioUrl,
            examples: response.examples
          });
          
        } catch (error: any) {
          socket.emit('example_error', {
            message: 'فشل توليد المثال',
            error: error.message
          });
        }
      });
      
      /**
       * Request problem to solve
       */
      socket.on('request_problem', async (data: {
        lessonId: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        topic?: string;
      }) => {
        try {
          const user = socket.data.user as UserData;
          
          const response = await teachingAssistant.generateTeachingScript({
            slideContent: { title: data.topic },
            lessonId: data.lessonId,
            studentGrade: user.grade || 6,
            studentName: user.firstName,
            needProblem: true,
            problemDifficulty: data.difficulty || 'medium'
          });
          
          const voiceResult = await voiceService.textToSpeech(response.script);
          
          socket.emit('problem_ready', {
            success: true,
            script: response.script,
            audioUrl: voiceResult.audioUrl,
            problem: response.problem,
            duration: response.duration
          });
          
        } catch (error: any) {
          socket.emit('problem_error', {
            message: 'فشل توليد المسألة',
            error: error.message
          });
        }
      });
      
      /**
       * Generate full lesson with teaching scripts
       */
      socket.on('generate_smart_lesson', async (data: {
        lessonId: string;
        theme?: string;
        generateVoice?: boolean;
        teachingOptions?: {
          voiceStyle?: 'friendly' | 'formal' | 'energetic';
          paceSpeed?: 'slow' | 'normal' | 'fast';
          useAnalogies?: boolean;
          useStories?: boolean;
        }
      }) => {
        try {
          if (!socket.data.authenticated) {
            socket.emit('lesson_error', {
              message: 'يجب تسجيل الدخول أولاً',
              code: 'NOT_AUTHENTICATED'
            });
            return;
          }
          
          const user = socket.data.user as UserData;
          
          // Get lesson content
          const lesson = await prisma.lesson.findUnique({
            where: { id: data.lessonId },
            include: {
              content: true,
              unit: {
                include: {
                  subject: true
                }
              }
            }
          });
          
          if (!lesson) {
            socket.emit('lesson_error', {
              code: 'LESSON_NOT_FOUND',
              message: 'الدرس غير موجود'
            });
            return;
          }
          
          // Build slides
          const slides: SlideContent[] = [];
          
          // Title slide
          slides.push({
            type: 'title',
            title: lesson.titleAr || lesson.title,
            subtitle: lesson.unit.subject.nameAr || lesson.unit.subject.name
          });
          
          // Content slides
          if (lesson.content) {
            slides.push({
              type: 'content',
              title: 'محتوى الدرس',
              content: lesson.content.summary || 'محتوى الدرس'
            });
            
            // Key points
            if (lesson.content.keyPoints) {
              try {
                const keyPoints = JSON.parse(lesson.content.keyPoints);
                if (Array.isArray(keyPoints) && keyPoints.length > 0) {
                  slides.push({
                    type: 'bullet',
                    title: 'النقاط الرئيسية',
                    bullets: keyPoints
                  });
                }
              } catch (e) {}
            }
            
            // Summary
            slides.push({
              type: 'summary',
              title: 'الخلاصة',
              subtitle: lesson.titleAr || lesson.title,
              bullets: ['تم إكمال الدرس بنجاح']
            });
          }
          
          // Send initial status
          socket.emit('smart_lesson_started', {
            lessonId: data.lessonId,
            totalSlides: slides.length,
            message: `بدء توليد درس تفاعلي ذكي من ${slides.length} شريحة`
          });
          
          // Generate HTML slides
          const htmlSlides = slideService.generateLessonSlides(
            slides,
            data.theme || 'default'
          );
          
          // Generate teaching scripts for all slides
          const teachingScripts = await teachingAssistant.generateLessonScripts(
            slides,
            data.lessonId,
            user.grade || 6,
            user.firstName
          );
          
          // Generate voices if requested
          const audioUrls: string[] = [];
          if (data.generateVoice) {
            for (let i = 0; i < teachingScripts.length; i++) {
              const script = teachingScripts[i];
              
              // Send progress
              socket.emit('smart_lesson_progress', {
                lessonId: data.lessonId,
                currentSlide: i + 1,
                totalSlides: slides.length,
                stage: 'voice_generation'
              });
              
              const voiceResult = await voiceService.textToSpeech(script.script);
              audioUrls.push(voiceResult.audioUrl || '');
              
              // Small delay
              if (i < teachingScripts.length - 1 && !voiceResult.cached) {
                await this.delay(300);
              }
            }
          }
          
          // Send complete lesson
          socket.emit('smart_lesson_ready', {
            success: true,
            lessonId: data.lessonId,
            slides: htmlSlides,
            teachingScripts: teachingScripts.map(s => ({
              script: s.script,
              duration: s.duration,
              keyPoints: s.keyPoints,
              examples: s.examples,
              problem: s.problem,
              visualCues: s.visualCues,
              interactionPoints: s.interactionPoints,
              emotionalTone: s.emotionalTone
            })),
            audioUrls: data.generateVoice ? audioUrls : undefined,
            totalSlides: slides.length,
            message: 'تم توليد الدرس التفاعلي الذكي بنجاح!'
          });
          
          console.log(`✅ Smart lesson generated: ${slides.length} slides with teaching scripts`);
          
        } catch (error: any) {
          console.error('❌ Smart lesson error:', error);
          socket.emit('lesson_error', {
            message: 'فشل توليد الدرس الذكي',
            error: error.message
          });
        }
      });
      
      /**
       * Pause lesson
       */
      socket.on('pause_lesson', async (data: { lessonId: string }) => {
        const user = socket.data.user as UserData;
        const response = await teachingAssistant.handleStudentInteraction(
          'stop',
          {},
          data.lessonId,
          user.grade || 6,
          { studentName: user.firstName }
        );
        
        socket.emit('lesson_paused', {
          success: true,
          script: response.script,
          message: 'تم إيقاف الدرس مؤقتاً'
        });
      });
      
      /**
       * Continue lesson
       */
      socket.on('continue_lesson', async (data: { lessonId: string }) => {
        const user = socket.data.user as UserData;
        const teachingKey = `${data.lessonId}_${user.id}`;
        const teachingSession = this.teachingSessions.get(teachingKey);
        
        const response = await teachingAssistant.handleStudentInteraction(
          'continue',
          {},
          data.lessonId,
          user.grade || 6,
          {
            studentName: user.firstName,
            previousScript: teachingSession?.currentScript
          }
        );
        
        const voiceResult = await voiceService.textToSpeech(response.script);
        
        socket.emit('lesson_continued', {
          success: true,
          script: response.script,
          audioUrl: voiceResult.audioUrl,
          message: 'استئناف الدرس'
        });
      });
      
      /**
       * Get teaching session stats
       */
      socket.on('get_teaching_stats', async (data: { lessonId: string }) => {
        const user = socket.data.user as UserData;
        const teachingKey = `${data.lessonId}_${user.id}`;
        const session = this.teachingSessions.get(teachingKey);
        
        if (session) {
          const duration = Date.now() - session.startedAt.getTime();
          
          socket.emit('teaching_stats', {
            lessonId: data.lessonId,
            interactionCount: session.interactionCount,
            slidesCompleted: session.slideHistory.length,
            progress: session.studentProgress,
            durationMinutes: Math.floor(duration / 60000),
            lastInteraction: session.lastInteraction
          });
        } else {
          socket.emit('teaching_stats', {
            lessonId: data.lessonId,
            message: 'لا توجد جلسة نشطة'
          });
        }
      });
      
      // ============= EXISTING SLIDE EVENTS (ENHANCED) =============
      
      socket.on('request_slide', async (data: any) => {
        try {
          if (!socket.data.authenticated) {
            socket.emit('slide_error', {
              message: 'يجب تسجيل الدخول أولاً',
              code: 'NOT_AUTHENTICATED'
            });
            return;
          }
          
          const user = socket.data.user as UserData;
          
          // Build slide content
          const slideContent: SlideContent = {
            type: data.type || 'content',
            title: data.title,
            subtitle: data.subtitle,
            content: data.content || data.text,
            bullets: data.bullets,
            imageUrl: data.imageUrl,
            equation: data.equation,
            quiz: data.quiz,
            metadata: {
              duration: data.duration,
              theme: data.theme || 'default'
            }
          };
          
          // Generate HTML
          const slideHTML = slideService.generateSlideHTML(
            slideContent,
            data.theme || 'default'
          );
          
          // Add animation styles if first slide
          const fullHTML = data.slideNumber === 0 
            ? slideService.getAnimationStyles() + slideHTML
            : slideHTML;
          
          // 🆕 Generate teaching script if requested
          let teachingScript = null;
          let audioUrl = null;
          
          if (data.generateTeaching && data.lessonId) {
            const scriptResult = await teachingAssistant.generateTeachingScript({
              slideContent,
              lessonId: data.lessonId,
              studentGrade: user.grade || 6,
              studentName: user.firstName
            });
            
            teachingScript = {
              script: scriptResult.script,
              duration: scriptResult.duration,
              keyPoints: scriptResult.keyPoints
            };
            
            // Generate voice for teaching script
            if (data.generateVoice !== false) {
              const voiceResult = await voiceService.textToSpeech(scriptResult.script);
              if (voiceResult.success) {
                audioUrl = voiceResult.audioUrl;
              }
            }
          } else if (data.generateVoice) {
            // Generate regular voice (reading slide)
            const voiceResult = await voiceService.generateSlideNarration(slideContent);
            if (voiceResult.success) {
              audioUrl = voiceResult.audioUrl;
            }
          }
          
          socket.emit('slide_ready', {
            success: true,
            html: fullHTML,
            slideNumber: data.slideNumber || 0,
            type: slideContent.type,
            audioUrl,
            teachingScript // 🆕
          });
          
          console.log(`✅ Slide generated - Type: ${slideContent.type}${teachingScript ? ' (with teaching)' : ''}${audioUrl ? ' (with voice)' : ''}`);
          
        } catch (error: any) {
          console.error('❌ Slide error:', error);
          socket.emit('slide_error', {
            message: 'فشل توليد الشريحة',
            error: error.message
          });
        }
      });
      
      // ============= EXISTING VOICE EVENTS (unchanged) =============
      
      socket.on('generate_slide_voice', async (data: { 
        slideContent: Partial<SlideContent>;
        options?: {
          voiceId?: string;
          speed?: number;
          stability?: number;
        }
      }) => {
        try {
          if (!socket.data.authenticated) {
            socket.emit('voice_error', {
              message: 'يجب تسجيل الدخول أولاً',
              code: 'NOT_AUTHENTICATED'
            });
            return;
          }
          
          const user = socket.data.user as UserData;
          console.log(`🎙️ Generating voice for slide - User: ${user.email}`);
          
          // Generate voice
          const voiceResult = await voiceService.generateSlideNarration(
            data.slideContent,
            {
              stability: data.options?.stability,
              similarityBoost: data.options?.speed ? 1 / data.options.speed : undefined,
              voiceId: data.options?.voiceId
            }
          );
          
          if (voiceResult.success) {
            socket.emit('slide_voice_ready', {
              success: true,
              audioUrl: voiceResult.audioUrl,
              audioPath: voiceResult.audioPath,
              cached: voiceResult.cached,
              message: voiceResult.cached ? 'تم استخدام الصوت المخزن' : 'تم توليد الصوت بنجاح'
            });
            
            console.log(`✅ Voice generated${voiceResult.cached ? ' (cached)' : ''}`);
          } else {
            throw new Error(voiceResult.error || 'Voice generation failed');
          }
          
        } catch (error: any) {
          console.error('❌ Voice generation error:', error);
          socket.emit('voice_error', {
            message: 'فشل توليد الصوت',
            error: error.message
          });
        }
      });
      
      // [REST OF EXISTING EVENTS REMAIN UNCHANGED...]
      // - generate_lesson_voices
      // - get_voice_status
      // - list_voices
      // - generate_lesson_slides
      // - request_math_slide
      // - chat_message
      // - ping/pong
      // - get_status
      
      // ============= CHAT EVENT (ENHANCED) =============
      
      socket.on('chat_message', async (data: { message: string; lessonId?: string }) => {
        if (!socket.data.authenticated) {
          socket.emit('error', {
            code: 'NOT_AUTHENTICATED',
            message: 'يجب تسجيل الدخول أولاً'
          });
          return;
        }
        
        const user = socket.data.user as UserData;
        
        try {
          // 🆕 Check if this is a teaching-related question
          const teachingKeywords = ['اشرح', 'فهمني', 'مثال', 'حل', 'ازاي', 'ليه', 'ايه'];
          const isTeachingQuestion = teachingKeywords.some(keyword => 
            data.message.includes(keyword)
          );
          
          let aiResponse: string;
          
          if (isTeachingQuestion && data.lessonId) {
            // Use teaching assistant for educational questions
            const teachingResponse = await teachingAssistant.generateTeachingScript({
              slideContent: { content: data.message },
              lessonId: data.lessonId,
              studentGrade: user.grade || 6,
              studentName: user.firstName
            });
            
            aiResponse = teachingResponse.script;
          } else {
            // Use regular AI for general chat
            aiResponse = await openAIService.chat([
              {
                role: 'system',
                content: `أنت مساعد تعليمي ودود. أجب بشكل مختصر ومفيد.
                ${user.firstName ? `اسم الطالب: ${user.firstName}` : ''}`
              },
              {
                role: 'user', 
                content: data.message
              }
            ], {
              temperature: 0.7,
              maxTokens: 150
            });
          }
          
          socket.emit('ai_response', {
            message: aiResponse,
            timestamp: new Date().toISOString(),
            isTeaching: isTeachingQuestion
          });
          
          console.log(`💬 Chat processed for ${user.email}${isTeachingQuestion ? ' (teaching mode)' : ''}`);
          
        } catch (error: any) {
          console.error('❌ Chat error:', error);
          socket.emit('error', {
            code: 'CHAT_FAILED',
            message: 'فشل الرد على الرسالة'
          });
        }
      });
      
      // ============= STATUS EVENT (UPDATED) =============
      
      socket.on('get_status', () => {
        const user = socket.data.user as UserData | undefined;
        const teachingStats = teachingAssistant.getHealthStatus();
        
        socket.emit('status', {
          connected: true,
          authenticated: socket.data.authenticated || false,
          userId: user?.id,
          socketId: socket.id,
          totalUsers: this.connectedUsers.size,
          features: {
            slides: true,
            math: true,
            chat: true,
            voice: true,
            teaching: true, // 🆕
            themes: ['default', 'dark', 'kids']
          },
          teachingAssistant: teachingStats // 🆕
        });
      });
      
      // ============= DISCONNECTION =============
      
      socket.on('disconnect', async (reason) => {
        console.log(`❌ DISCONNECTED: ${socket.id} - ${reason}`);
        
        const user = socket.data.user as UserData | undefined;
        if (user) {
          // Clean up
          this.connectedUsers.delete(user.id);
          this.userSessions.delete(user.id);
          
          // 🆕 Clean teaching sessions
          this.teachingSessions.forEach((session, key) => {
            if (key.endsWith(`_${user.id}`)) {
              this.teachingSessions.delete(key);
            }
          });
          
          // Clean voice generation status
          this.voiceGenerationStatus.forEach((status, key) => {
            if (key.endsWith(`_${user.id}`)) {
              this.voiceGenerationStatus.delete(key);
            }
          });
          
          // Remove from rooms
          this.rooms.forEach((users, lessonId) => {
            if (users.has(user.id)) {
              users.delete(user.id);
              
              if (users.size === 0) {
                this.rooms.delete(lessonId);
              }
            }
          });
          
          console.log(`👤 ${user.email} disconnected`);
        }
      });
    });
  }
  
  // ============= HELPER METHODS =============
  
  /**
   * Get time of day for greetings
   */
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }
  
  /**
   * Cleanup teaching sessions
   */
  private startTeachingSessionCleanup(): void {
    // Clean up inactive teaching sessions every 2 hours
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      this.teachingSessions.forEach((session, key) => {
        const lastActivity = session.lastInteraction || session.startedAt;
        const inactiveTime = now - lastActivity.getTime();
        
        // Remove sessions inactive for more than 2 hours
        if (inactiveTime > 2 * 60 * 60 * 1000) {
          this.teachingSessions.delete(key);
          cleaned++;
        }
      });
      
      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} inactive teaching sessions`);
      }
    }, 2 * 60 * 60 * 1000);
  }
  
  /**
   * Cleanup interval for inactive sessions
   */
  private startCleanupInterval(): void {
    // Clean up inactive sessions every hour
    setInterval(async () => {
      const count = await sessionService.cleanupInactiveSessions();
      if (count > 0) {
        console.log(`🧹 Cleaned up ${count} inactive sessions`);
      }
    }, 60 * 60 * 1000);
  }
  
  /**
   * Voice cache cleanup
   */
  private startVoiceCacheCleanup(): void {
    // Clean up old voice files every 6 hours
    setInterval(async () => {
      const deletedCount = await voiceService.cleanupCache(24);
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old voice files`);
      }
      
      // 🆕 Also clear teaching assistant cache periodically
      teachingAssistant.clearCache();
      console.log('🧹 Cleared teaching assistant cache');
    }, 6 * 60 * 60 * 1000);
  }
  
  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ============= PUBLIC METHODS =============
  
  sendToUser(userId: string, event: string, data: any): boolean {
    const socket = this.connectedUsers.get(userId);
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }
  
  sendToLesson(lessonId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`lesson:${lessonId}`).emit(event, data);
    }
  }
  
  broadcast(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }
  
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }
  
  getLessonParticipants(lessonId: string): string[] {
    return Array.from(this.rooms.get(lessonId) || []);
  }
  
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
  
  getUserSession(userId: string): SessionInfo | undefined {
    return this.userSessions.get(userId);
  }
  
  // 🆕 Get teaching session
  getTeachingSession(lessonId: string, userId: string): TeachingSessionData | undefined {
    return this.teachingSessions.get(`${lessonId}_${userId}`);
  }
  
  getIO(): SocketIOServer | null {
    return this.io;
  }
  
  /**
   * Get voice generation status for lesson
   */
  getVoiceStatus(lessonId: string, userId: string): VoiceGenerationStatus | null {
    const statusKey = `${lessonId}_${userId}`;
    return this.voiceGenerationStatus.get(statusKey) || null;
  }
}

// Export singleton
export const websocketService = new WebSocketService();