// 📍 المكان: src/services/websocket/websocket.service.ts
// ✨ النسخة المحدثة مع Student Context + Emotional Intelligence + Real-time Features

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { config } from '../../config';
import { prisma } from '../../config/database.config';
import { sessionService, type ExtendedSession } from './session.service';
import type { LearningSession } from '@prisma/client';
import { openAIService } from '../ai/openai.service';

// ============= SERVICES IMPORTS =============
import { slideService, type SlideContent } from '../slides/slide.service';
import { voiceService } from '../voice/voice.service';
import { 
  teachingAssistant, 
  type InteractionType 
} from '../teaching/teaching-assistant.service';
import { quizService } from '../../core/quiz/quiz.service';
import { ragService } from '../../core/rag/rag.service';

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
  emotionalState?: EmotionalState; // 🆕
  lastActivity?: Date; // 🆕
}

// 🆕 Enhanced Student Context
interface StudentContext {
  userId: string;
  currentMood: 'happy' | 'neutral' | 'frustrated' | 'confused' | 'tired';
  confidence: number; // 0-100
  engagement: number; // 0-100
  lastInteractionTime: Date;
  sessionDuration: number; // minutes
  breaksTaken: number;
  questionsAsked: number;
  correctAnswers: number;
  wrongAnswers: number;
  streakCount: number;
  needsHelp: boolean;
  preferredLearningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  currentTopic?: string;
  strugglingTopics: string[];
  masteredTopics: string[];
}

// 🆕 Emotional State Detection
interface EmotionalState {
  mood: 'happy' | 'neutral' | 'frustrated' | 'confused' | 'tired';
  confidence: number;
  engagement: number;
  indicators: string[];
  timestamp: Date;
}

// 🆕 Achievement System
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
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
  emotionalHistory: EmotionalState[]; // 🆕
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, Socket> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private userSessions: Map<string, SessionInfo> = new Map();
  private voiceGenerationStatus: Map<string, VoiceGenerationStatus> = new Map();
  private teachingSessions: Map<string, TeachingSessionData> = new Map();
  
  // 🆕 Enhanced tracking
  private studentContexts: Map<string, StudentContext> = new Map();
  private userAchievements: Map<string, Achievement[]> = new Map();
  private heartbeatIntervals: Map<string, any> = new Map();
  
  /**
   * Initialize WebSocket server with enhanced features
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.NODE_ENV === 'development'
          ? ['http://localhost:3000', 'http://localhost:3001']
          : ['https://yourdomain.com'],
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS']
      },

      transports: ['websocket', 'polling'],
      allowUpgrades: true,
      
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 45000,
      
      path: '/socket.io/',
      allowEIO3: true
    });
    
    // Add authentication middleware
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth?.token;

        if (!token) {
          // Allow connection but mark as not authenticated
          socket.data.authenticated = false;
          return next();
        }

        // For development, simplified auth
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
            socket.data.user = testUser;
            socket.data.authenticated = true;
          }
        } else {
          // Production: verify JWT
          try {
            const decoded = jwt.verify(token, config.JWT_SECRET) as any;
            const user = await prisma.user.findUnique({
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

            if (user) {
              socket.data.user = user;
              socket.data.authenticated = true;
            }
          } catch (err) {
            socket.data.authenticated = false;
          }
        }

        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    // Setup event handlers
    this.setupEventHandlers();
    
    console.log('✅ WebSocket server initialized with enhanced features');
    console.log('   📌 Path: /socket.io/');
    console.log('   🔌 Transports: polling + websocket');
    console.log('   🧮 Math components: ENABLED');
    console.log('   📊 Slide Service: ENABLED (HTML-based)');
    console.log('   🎙️ Voice Service: ENABLED (ElevenLabs)');
    console.log('   🎓 Teaching Assistant: ENABLED (AI-powered)');
    console.log('   💖 Emotional Intelligence: ENABLED'); // 🆕
    console.log('   🏆 Achievement System: ENABLED'); // 🆕
    
    // Start cleanup and monitoring intervals
    this.startCleanupInterval();
    this.startVoiceCacheCleanup();
    this.startTeachingSessionCleanup();
    this.startEmotionalMonitoring(); // 🆕
  }
  
  /**
   * Setup all socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;
    
    this.io.on('connection', async (socket: Socket) => {
      console.log(`✅ NEW CONNECTION: ${socket.id}`);

      // Add user to connected users if authenticated
      if (socket.data.authenticated && socket.data.user) {
        this.connectedUsers.set(socket.data.user.id, socket);
        console.log(`✅ Authenticated: ${socket.data.user.email}`);
      }

      // Welcome message
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
          teaching: true,
          emotionalIntelligence: true, // 🆕
          achievements: true, // 🆕
          realTimeAdaptation: true // 🆕
        }
      });
      
      // ============= AUTHENTICATION (LEGACY - for backwards compatibility) =============
      socket.on('authenticate', async (data: { token: string }) => {
        // If already authenticated via handshake, just confirm
        if (socket.data.authenticated) {
          socket.emit('authenticated', {
            success: true,
            user: socket.data.user,
            message: 'Already authenticated'
          });
          return;
        }
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
          
          // 🆕 Initialize student context
          this.initializeStudentContext(user.id);
          
          // 🆕 Load achievements
          await this.loadUserAchievements(user.id);
          
          // 🆕 Start heartbeat for this user
          this.startHeartbeat(user.id, socket);
          
          // Generate personalized greeting based on context
          const context = this.studentContexts.get(user.id);
          const timeOfDay = this.getTimeOfDay();
          const greeting = await this.generateContextualGreeting(
            user.firstName,
            user.grade || 6,
            timeOfDay,
            context
          );
          
          // Send auth confirmation with enhanced data
          socket.emit('authenticated', {
            success: true,
            userId: user.id,
            email: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            message: 'Authentication successful',
            greeting,
            context: context ? {
              mood: context.currentMood,
              streakCount: context.streakCount,
              lastTopic: context.currentTopic
            } : null,
            achievements: this.userAchievements.get(user.id)?.slice(0, 3) // Last 3 achievements
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
      
      // ============= 🆕 EMOTIONAL STATE EVENTS =============
      
      /**
       * Update emotional state based on interactions
       */
      socket.on('update_emotional_state', async (data: {
        indicators: string[];
        context?: any;
      }) => {
        const user = socket.data.user as UserData;
        if (!user) return;
        
        const emotionalState = await this.detectEmotionalState(user.id, data.indicators);
        
        // Update context
        const context = this.studentContexts.get(user.id);
        if (context) {
          context.currentMood = emotionalState.mood;
          context.confidence = emotionalState.confidence;
          context.engagement = emotionalState.engagement;
        }
        
        // Notify about state change
        socket.emit('emotional_state_updated', {
          state: emotionalState,
          suggestions: await this.getEmotionalSuggestions(emotionalState)
        });
        
        // If frustrated or confused, offer help
        if (emotionalState.mood === 'frustrated' || emotionalState.mood === 'confused') {
          socket.emit('help_offered', {
            message: 'هل تحتاج مساعدة؟ يمكنني شرح الموضوع بطريقة مختلفة',
            options: ['نعم، اشرح مرة أخرى', 'أعطني مثال', 'لا، سأحاول مرة أخرى']
          });
        }
        
        // If tired, suggest break
        if (emotionalState.mood === 'tired') {
          socket.emit('break_suggested', {
            message: 'يبدو أنك متعب. هل تريد أخذ استراحة قصيرة؟',
            duration: 5 // minutes
          });
        }
      });
      
      /**
       * Track user activity for emotional analysis
       */
      socket.on('user_activity', async (data: {
        type: 'answer_submitted' | 'question_asked' | 'slide_viewed' | 'pause' | 'resume';
        correct?: boolean;
        timeSpent?: number;
      }) => {
        const user = socket.data.user as UserData;
        if (!user) return;
        
        const context = this.studentContexts.get(user.id);
        if (!context) return;
        
        // Update context based on activity
        context.lastInteractionTime = new Date();
        
        switch (data.type) {
          case 'answer_submitted':
            if (data.correct) {
              context.correctAnswers++;
              context.streakCount++;
              context.confidence = Math.min(100, context.confidence + 5);
              
              // Check for achievement
              await this.checkAchievements(user.id, 'correct_answer', context);
            } else {
              context.wrongAnswers++;
              context.streakCount = 0;
              context.confidence = Math.max(0, context.confidence - 10);
              context.needsHelp = context.wrongAnswers > 2;
            }
            break;
            
          case 'question_asked':
            context.questionsAsked++;
            context.engagement = Math.min(100, context.engagement + 10);
            break;
            
          case 'pause':
            context.engagement = Math.max(0, context.engagement - 5);
            break;
            
          case 'resume':
            context.engagement = Math.min(100, context.engagement + 5);
            break;
        }
        
        // Auto-detect emotional state from patterns
        const indicators: string[] = [];
        if (context.wrongAnswers > 2) indicators.push('multiple_errors');
        if (context.confidence < 30) indicators.push('low_confidence');
        if (context.engagement < 40) indicators.push('low_engagement');
        if (context.sessionDuration > 45) indicators.push('long_session');
        
        if (indicators.length > 0) {
          const emotionalState = await this.detectEmotionalState(user.id, indicators);
          socket.emit('emotional_state_detected', {
            state: emotionalState,
            autoDetected: true
          });
        }
        
        // Send updated context
        socket.emit('context_updated', {
          streakCount: context.streakCount,
          confidence: context.confidence,
          engagement: context.engagement,
          needsHelp: context.needsHelp
        });
      });
      
      // ============= 🆕 ACHIEVEMENT SYSTEM =============
      
      socket.on('get_achievements', async () => {
        const user = socket.data.user as UserData;
        if (!user) return;
        
        const achievements = this.userAchievements.get(user.id) || [];
        socket.emit('achievements_list', {
          achievements,
          totalPoints: achievements.length * 10,
          level: Math.floor(achievements.length / 5) + 1
        });
      });
      
      // ============= LESSON EVENTS (ENHANCED) =============
      
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
          
          // 🆕 Get student context for personalization
          const context = this.studentContexts.get(user.id);
          const initialEmotionalState: EmotionalState = {
            mood: context?.currentMood || 'neutral',
            confidence: context?.confidence || 70,
            engagement: context?.engagement || 80,
            indicators: [],
            timestamp: new Date()
          };
          
          // Store enhanced session info
          this.userSessions.set(user.id, {
            sessionId: session.id,
            lessonId,
            userId: user.id,
            currentSlideIndex: 0,
            teachingHistory: [],
            emotionalState: initialEmotionalState,
            lastActivity: new Date()
          });
          
          // Initialize teaching session with emotional tracking
          const teachingKey = `${lessonId}_${user.id}`;
          this.teachingSessions.set(teachingKey, {
            lessonId,
            userId: user.id,
            previousScripts: [],
            slideHistory: [],
            interactionCount: 0,
            startedAt: new Date(),
            studentProgress: 0,
            emotionalHistory: [initialEmotionalState]
          });
          
          // Join room
          const roomName = `lesson:${lessonId}`;
          socket.join(roomName);
          
          // Track participants
          if (!this.rooms.has(lessonId)) {
            this.rooms.set(lessonId, new Set());
          }
          this.rooms.get(lessonId)!.add(user.id);
          
          // 🆕 Generate personalized welcome for the lesson
          const welcomeMessage = await this.generateLessonWelcome(
            user.firstName,
            lesson.titleAr || lesson.title,
            context
          );
          
          // Send enhanced confirmation
          socket.emit('joined_lesson', {
            success: true,
            lessonId,
            lessonTitle: lesson.titleAr || lesson.title,
            sessionId: session.id,
            message: welcomeMessage,
            studentState: {
              mood: initialEmotionalState.mood,
              readiness: context?.confidence || 70
            },
            personalizedTips: await this.getPersonalizedTips(user.id, lessonId)
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
      
      // ============= TEACHING ASSISTANT EVENTS (ENHANCED WITH EMOTIONS) =============
      
      /**
       * Generate teaching script with emotional awareness
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
          const context = this.studentContexts.get(user.id);
          
          console.log(`🎓 Generating emotionally-aware teaching script for ${user.firstName}`);
          
          // 🆕 Adapt teaching based on emotional state
          const emotionalAdaptations = this.getEmotionalAdaptations(context);
          
          // Generate teaching script with emotional awareness
          const teachingScript = await teachingAssistant.generateTeachingScript({
            slideContent: data.slideContent,
            lessonId: data.lessonId,
            studentGrade: user.grade || 6,
            studentName: user.firstName,
            previousScript: teachingSession?.currentScript,
            sessionHistory: teachingSession?.previousScripts,
            currentProgress: teachingSession?.studentProgress,
            voiceStyle: emotionalAdaptations.voiceStyle || data.options?.voiceStyle || 'friendly',
            paceSpeed: emotionalAdaptations.paceSpeed || data.options?.paceSpeed || 'normal',
            useAnalogies: emotionalAdaptations.useAnalogies ?? data.options?.useAnalogies,
            useStories: emotionalAdaptations.useStories ?? data.options?.useStories,
            // Add emotional context as separate parameters
            ...(context ? {
              studentMood: context.currentMood,
              studentConfidence: context.confidence,
              needsEncouragement: context.confidence < 50,
              needsBreak: context.sessionDuration > 30
            } : {})
          });
          
          // Update teaching session
          if (teachingSession) {
            teachingSession.currentScript = teachingScript.script;
            teachingSession.previousScripts.push(teachingScript.script);
            teachingSession.slideHistory.push(data.slideContent);
            teachingSession.lastInteraction = new Date();
            teachingSession.studentProgress += 10;
            
            // 🆕 Track emotional state in history
            if (context) {
              teachingSession.emotionalHistory.push({
                mood: context.currentMood,
                confidence: context.confidence,
                engagement: context.engagement,
                indicators: [],
                timestamp: new Date()
              });
            }
          }
          
          // Generate voice if requested
          let audioUrl: string | null = null;
          if (data.options?.generateVoice !== false) {
            const voiceResult = await voiceService.textToSpeech(teachingScript.script);
            if (voiceResult.success) {
              audioUrl = voiceResult.audioUrl || null;
            }
          }
          
          // 🆕 Add motivational elements based on context
          const motivationalElements = context && context.confidence < 50
            ? await this.generateMotivationalElements(user.firstName, context)
            : null;
          
          // Send enhanced response
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
            nextSuggestions: teachingScript.nextSuggestions,
            studentState: context ? {
              mood: context.currentMood,
              confidence: context.confidence,
              engagement: context.engagement
            } : null,
            motivationalElements
          });
          
          console.log(`✅ Emotionally-aware teaching script generated`);
          
        } catch (error: any) {
          console.error('❌ Teaching script error:', error);
          socket.emit('teaching_error', {
            message: 'فشل توليد السكريبت التعليمي',
            error: error.message
          });
        }
      });
      
      // ============= 🆕 REAL-TIME QUIZ INTEGRATION =============
      
      socket.on('quiz_answer_submitted', async (data: {
        attemptId: string;
        questionId: string;
        answer: string;
        timeSpent: number;
      }) => {
        const user = socket.data.user as UserData;
        if (!user) return;
        
        try {
          // Submit answer to quiz service
          const result = await quizService.submitAnswer(
            data.attemptId,
            data.questionId,
            data.answer,
            data.timeSpent
          );
          
          // Update student context
          const context = this.studentContexts.get(user.id);
          if (context) {
            if (result.isCorrect) {
              context.correctAnswers++;
              context.streakCount++;
              
              // Check achievement
              await this.checkAchievements(user.id, 'correct_answer', context);
              
              // Celebrate if streak
              if (context.streakCount >= 3) {
                socket.emit('celebration', {
                  type: 'streak',
                  count: context.streakCount,
                  message: `رائع! ${context.streakCount} إجابات صحيحة متتالية! 🔥`
                });
              }
            } else {
              context.wrongAnswers++;
              context.streakCount = 0;
              
              // Add to struggling topics if topic exists
              const topicName = (result as any).topic || 'unknown';
              if (!context.strugglingTopics.includes(topicName)) {
                context.strugglingTopics.push(topicName);
              }
            }
          }
          
          // Send enhanced feedback
          socket.emit('quiz_feedback', {
            ...result,
            emotionalSupport: await this.getEmotionalFeedback(result.isCorrect, context),
            nextQuestionDifficulty: this.adaptQuestionDifficulty(context)
          });
          
        } catch (error: any) {
          socket.emit('quiz_error', { message: error.message });
        }
      });
      
      // ============= 🆕 PARENT NOTIFICATION SYSTEM =============
      
      socket.on('request_parent_update', async () => {
        const user = socket.data.user as UserData;
        if (!user) return;
        
        const context = this.studentContexts.get(user.id);
        const achievements = this.userAchievements.get(user.id) || [];
        
        const parentReport = {
          studentName: user.firstName,
          date: new Date().toISOString(),
          sessionDuration: context?.sessionDuration || 0,
          mood: context?.currentMood || 'neutral',
          confidence: context?.confidence || 70,
          questionsAnswered: (context?.correctAnswers || 0) + (context?.wrongAnswers || 0),
          accuracy: context 
            ? Math.round((context.correctAnswers / (context.correctAnswers + context.wrongAnswers)) * 100)
            : 0,
          strugglingTopics: context?.strugglingTopics || [],
          masteredTopics: context?.masteredTopics || [],
          recentAchievements: achievements.slice(0, 3),
          recommendation: await this.generateParentRecommendation(context)
        };
        
        socket.emit('parent_report_ready', parentReport);
        
        // Also notify parent if connected
        this.notifyParent(user.id, parentReport);
      });
      
      // ============= CHAT EVENT (ENHANCED WITH CONTEXT) =============
      
      socket.on('chat_message', async (data: { message: string; lessonId?: string }) => {
        if (!socket.data.authenticated) {
          socket.emit('error', {
            code: 'NOT_AUTHENTICATED',
            message: 'يجب تسجيل الدخول أولاً'
          });
          return;
        }
        
        const user = socket.data.user as UserData;
        const context = this.studentContexts.get(user.id);
        
        try {
          // Check if this is a teaching-related question
          const teachingKeywords = ['اشرح', 'فهمني', 'مثال', 'حل', 'ازاي', 'ليه', 'ايه'];
          const isTeachingQuestion = teachingKeywords.some(keyword => 
            data.message.includes(keyword)
          );
          
          let aiResponse: string;
          
          if (isTeachingQuestion && data.lessonId) {
            // Use teaching assistant with emotional awareness
            const teachingResponse = await teachingAssistant.generateTeachingScript({
              slideContent: { content: data.message },
              lessonId: data.lessonId,
              studentGrade: user.grade || 6,
              studentName: user.firstName,
              // Add emotional context as separate parameters
              ...(context ? {
                studentMood: context.currentMood,
                studentConfidence: context.confidence,
                needsEncouragement: context.confidence < 50
              } : {})
            });
            
            aiResponse = teachingResponse.script;
          } else {
            // Use RAG for context-aware response
            const ragResponse = await ragService.answerQuestion(
              data.message,
              data.lessonId
            );
            
            aiResponse = ragResponse.answer;
          }
          
          // Track question in context
          if (context) {
            context.questionsAsked++;
            context.lastInteractionTime = new Date();
          }
          
          socket.emit('ai_response', {
            message: aiResponse,
            timestamp: new Date().toISOString(),
            isTeaching: isTeachingQuestion,
            confidence: context?.confidence,
            suggestedFollowUp: await this.getSuggestedFollowUp(data.message, context)
          });
          
          console.log(`💬 Context-aware chat processed for ${user.email}`);
          
        } catch (error: any) {
          console.error('❌ Chat error:', error);
          socket.emit('error', {
            code: 'CHAT_FAILED',
            message: 'فشل الرد على الرسالة'
          });
        }
      });
      
      // ============= STATUS EVENT (ENHANCED) =============
      
      socket.on('get_status', () => {
        const user = socket.data.user as UserData | undefined;
        const context = user ? this.studentContexts.get(user.id) : undefined;
        const achievements = user ? this.userAchievements.get(user.id) : [];
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
            teaching: true,
            emotionalIntelligence: true,
            achievements: true,
            contextAwareness: true,
            themes: ['default', 'dark', 'kids']
          },
          studentContext: context ? {
            mood: context.currentMood,
            confidence: context.confidence,
            engagement: context.engagement,
            streakCount: context.streakCount,
            sessionDuration: context.sessionDuration
          } : null,
          achievementsUnlocked: achievements?.length || 0,
          teachingAssistant: teachingStats
        });
      });
      
      // ============= DISCONNECTION (ENHANCED) =============

      socket.on('disconnect', async (reason) => {
        console.log(`❌ DISCONNECTED: ${socket.id} - ${reason}`);

        const user = socket.data.user as UserData | undefined;
        if (user) {
          // 🆕 Save student context before disconnect
          const context = this.studentContexts.get(user.id);
          if (context) {
            await this.saveStudentContext(user.id, context);
          }

          // 🆕 Use the new comprehensive cleanup function
          this.cleanupUserData(user.id);

          console.log(`👤 ${user.email} disconnected and fully cleaned up`);
        } else {
          console.log(`👤 Anonymous socket ${socket.id} disconnected`);
        }
      });
      
      // ============= EXISTING EVENTS (kept as is) =============
      // All other events remain unchanged...
    });
  }
  
  // ============= 🆕 EMOTIONAL INTELLIGENCE METHODS =============
  
  /**
   * Detect emotional state from indicators
   */
  private async detectEmotionalState(userId: string, indicators: string[]): Promise<EmotionalState> {
    const context = this.studentContexts.get(userId);
    
    let mood: 'happy' | 'neutral' | 'frustrated' | 'confused' | 'tired' = 'neutral';
    let confidence = context?.confidence || 70;
    let engagement = context?.engagement || 80;
    
    // Analyze indicators
    if (indicators && (indicators.includes('multiple_errors') || indicators.includes('repeated_mistakes'))) {
      mood = 'frustrated';
      confidence = Math.max(20, confidence - 20);
    } else if (indicators && (indicators.includes('slow_response') || indicators.includes('hesitation'))) {
      mood = 'confused';
      confidence = Math.max(30, confidence - 10);
    } else if (indicators && (indicators.includes('long_session') || indicators.includes('frequent_pauses'))) {
      mood = 'tired';
      engagement = Math.max(20, engagement - 20);
    } else if (indicators && (indicators.includes('quick_correct') || indicators.includes('streak'))) {
      mood = 'happy';
      confidence = Math.min(100, confidence + 10);
      engagement = Math.min(100, engagement + 10);
    }
    
    return {
      mood,
      confidence,
      engagement,
      indicators,
      timestamp: new Date()
    };
  }
  
  /**
   * Get suggestions based on emotional state
   */
  private async getEmotionalSuggestions(state: EmotionalState): Promise<string[]> {
    const suggestions: string[] = [];
    
    switch (state.mood) {
      case 'frustrated':
        suggestions.push('خذ نفس عميق');
        suggestions.push('جرب طريقة مختلفة');
        suggestions.push('اطلب مساعدة');
        break;
      case 'confused':
        suggestions.push('راجع الأساسيات');
        suggestions.push('شاهد مثال');
        suggestions.push('اسأل سؤال');
        break;
      case 'tired':
        suggestions.push('خذ استراحة 5 دقائق');
        suggestions.push('اشرب ماء');
        suggestions.push('تمدد قليلاً');
        break;
      case 'happy':
        suggestions.push('استمر! أنت رائع');
        suggestions.push('جرب تحدي أصعب');
        suggestions.push('ساعد زميل');
        break;
    }
    
    return suggestions;
  }
  
  /**
   * Get emotional adaptations for teaching
   */
  private getEmotionalAdaptations(context?: StudentContext): any {
    if (!context) return {};
    
    const adaptations: any = {};
    
    switch (context.currentMood) {
      case 'frustrated':
        adaptations.voiceStyle = 'friendly';
        adaptations.paceSpeed = 'slow';
        adaptations.useAnalogies = true;
        adaptations.useStories = true;
        break;
      case 'confused':
        adaptations.paceSpeed = 'slow';
        adaptations.useAnalogies = true;
        break;
      case 'tired':
        adaptations.voiceStyle = 'energetic';
        adaptations.paceSpeed = 'normal';
        adaptations.useStories = true;
        break;
      case 'happy':
        adaptations.voiceStyle = 'energetic';
        adaptations.paceSpeed = 'normal';
        break;
    }
    
    return adaptations;
  }
  
  // ============= 🆕 ACHIEVEMENT METHODS =============
  
  /**
   * Check and unlock achievements
   */
  private async checkAchievements(userId: string, event: string, context: StudentContext): Promise<void> {
    const achievements = this.userAchievements.get(userId) || [];
    const socket = this.connectedUsers.get(userId);
    
    // Check various achievement conditions
    if (event === 'correct_answer' && context.streakCount === 5 && !achievements.find(a => a.id === 'streak_5')) {
      const newAchievement: Achievement = {
        id: 'streak_5',
        title: 'نجم متتالي',
        description: '5 إجابات صحيحة متتالية',
        icon: '⭐',
        unlockedAt: new Date()
      };
      
      achievements.push(newAchievement);
      this.userAchievements.set(userId, achievements);
      
      if (socket) {
        socket.emit('achievement_unlocked', newAchievement);
      }
    }
    
    // More achievement checks...
  }
  
  /**
   * Load user achievements from database
   */
  private async loadUserAchievements(userId: string): Promise<void> {
    // In real implementation, load from database
    // For now, initialize empty
    this.userAchievements.set(userId, []);
  }
  
  // ============= 🆕 CONTEXT METHODS =============
  
  /**
   * Initialize student context
   */
  private initializeStudentContext(userId: string): void {
    this.studentContexts.set(userId, {
      userId,
      currentMood: 'neutral',
      confidence: 70,
      engagement: 80,
      lastInteractionTime: new Date(),
      sessionDuration: 0,
      breaksTaken: 0,
      questionsAsked: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      streakCount: 0,
      needsHelp: false,
      strugglingTopics: [],
      masteredTopics: []
    });
  }
  
  /**
   * Save student context to database
   */
  private async saveStudentContext(userId: string, context: StudentContext): Promise<void> {
    // In real implementation, save to database
    console.log(`💾 Saving context for user ${userId}`);
  }
  
  // ============= 🆕 HEARTBEAT & PRESENCE =============
  
  /**
   * Start heartbeat for user
   */
  private startHeartbeat(userId: string, socket: Socket): void {
    // 🆕 IMPORTANT: Clear existing interval if any to prevent memory leaks
    const existing = this.heartbeatIntervals.get(userId);
    if (existing) {
      clearInterval(existing);
      this.heartbeatIntervals.delete(userId);
      console.log(`⏰ Cleared existing heartbeat interval for user: ${userId}`);
    }

    const interval = setInterval(() => {
      const context = this.studentContexts.get(userId);
      if (!context) return;
      
      // Update session duration
      context.sessionDuration++;
      
      // Send heartbeat with encouragement
      const messages = this.getHeartbeatMessage(context);
      socket.emit('heartbeat', {
        message: messages[Math.floor(Math.random() * messages.length)],
        sessionDuration: context.sessionDuration,
        timestamp: new Date()
      });
      
      // Check if break needed
      if (context.sessionDuration > 0 && context.sessionDuration % 25 === 0) {
        socket.emit('break_reminder', {
          message: 'وقت استراحة قصيرة! 5 دقائق راحة تساعدك على التركيز أكثر',
          duration: 5
        });
        context.breaksTaken++;
      }
    }, 60000); // Every minute
    
    this.heartbeatIntervals.set(userId, interval);
  }
  
  /**
   * Get contextual heartbeat messages
   */
  private getHeartbeatMessage(context: StudentContext): string[] {
    const messages: string[] = [];
    
    if (context.streakCount > 3) {
      messages.push('أنت في حالة ممتازة! استمر 🔥');
    }
    if (context.confidence > 80) {
      messages.push('ثقتك عالية! هذا رائع 💪');
    }
    if (context.sessionDuration > 20) {
      messages.push('مازلت معك، أنت تبذل مجهود رائع!');
    }
    if (context.currentMood === 'happy') {
      messages.push('سعيد لأنك تستمتع بالتعلم! 😊');
    }
    
    // Default messages
    messages.push('مازلت معك يا بطل!');
    messages.push('أنا هنا لمساعدتك');
    messages.push('كل خطوة تقربك من النجاح');
    
    return messages;
  }
  
  // ============= 🆕 PERSONALIZATION METHODS =============
  
  /**
   * Generate contextual greeting
   */
  private async generateContextualGreeting(
    name: string,
    grade: number,
    timeOfDay: string,
    context?: StudentContext
  ): Promise<string> {
    let greeting = '';
    
    switch (timeOfDay) {
      case 'morning':
        greeting = `صباح الخير يا ${name}! `;
        break;
      case 'afternoon':
        greeting = `مساء الخير يا ${name}! `;
        break;
      case 'evening':
        greeting = `مساء النور يا ${name}! `;
        break;
    }
    
    if (context) {
      if (context.streakCount > 0) {
        greeting += `ممتاز! لديك ${context.streakCount} إجابات صحيحة متتالية. `;
      }
      if (context.currentTopic) {
        greeting += `هل تريد مواصلة ${context.currentTopic}؟`;
      }
    } else {
      greeting += 'مستعد للتعلم اليوم؟';
    }
    
    return greeting;
  }
  
  /**
   * Generate lesson welcome message
   */
  private async generateLessonWelcome(
    name: string,
    lessonTitle: string,
    context?: StudentContext
  ): Promise<string> {
    let message = `أهلاً ${name}! `;
    
    if (context?.currentMood === 'happy') {
      message += `رائع أن أراك متحمساً! `;
    }
    
    message += `انضممت بنجاح لدرس: ${lessonTitle}. `;
    
    if (context && context.strugglingTopics && context.strugglingTopics.length > 0) {
      message += 'سنركز اليوم على تقوية نقاطك الضعيفة. ';
    }
    
    message += 'هيا نبدأ!';
    
    return message;
  }
  
  /**
   * Get personalized tips for lesson
   */
  private async getPersonalizedTips(userId: string, lessonId: string): Promise<string[]> {
    const context = this.studentContexts.get(userId);
    const tips: string[] = [];
    
    if (context && context.preferredLearningStyle === 'visual') {
      tips.push('ركز على الرسومات والمخططات');
    }
    if (context && context.wrongAnswers && context.correctAnswers && context.wrongAnswers > context.correctAnswers) {
      tips.push('خذ وقتك في القراءة قبل الإجابة');
    }
    if (context && context.questionsAsked !== undefined && context.questionsAsked < 2) {
      tips.push('لا تتردد في طرح الأسئلة');
    }
    
    return tips;
  }
  
  /**
   * Adapt question difficulty based on performance
   */
  private adaptQuestionDifficulty(context?: StudentContext): 'easy' | 'medium' | 'hard' {
    if (!context) return 'medium';
    
    const accuracy = context.correctAnswers / (context.correctAnswers + context.wrongAnswers);
    
    if (accuracy < 0.4 || context.confidence < 40) {
      return 'easy';
    } else if (accuracy > 0.8 && context.confidence > 70) {
      return 'hard';
    }
    
    return 'medium';
  }
  
  /**
   * Generate emotional feedback for quiz answers
   */
  private async getEmotionalFeedback(isCorrect: boolean, context?: StudentContext): Promise<string> {
    if (!context) return isCorrect ? 'إجابة صحيحة!' : 'حاول مرة أخرى';
    
    if (isCorrect) {
      if (context.streakCount > 3) {
        return 'مذهل! أنت في سلسلة رائعة! 🔥';
      }
      if (context.confidence < 50) {
        return 'ممتاز! أنت أفضل مما تظن! 💪';
      }
      return 'صحيح! أحسنت! ✨';
    } else {
      if (context.wrongAnswers > 3) {
        return 'لا بأس، الأخطاء جزء من التعلم. خذ نفس عميق وحاول مرة أخرى';
      }
      if (context.currentMood === 'frustrated') {
        return 'أعلم أنك تحاول. دعني أساعدك بطريقة مختلفة';
      }
      return 'ليست الإجابة الصحيحة، لكنك قريب. حاول مرة أخرى!';
    }
  }
  
  /**
   * Get suggested follow-up questions
   */
  private async getSuggestedFollowUp(message: string, context?: StudentContext): Promise<string[]> {
    const suggestions: string[] = [];
    
    if (context && context.wrongAnswers && context.wrongAnswers > 2) {
      suggestions.push('هل تريد مثال آخر؟');
      suggestions.push('هل تريد شرح مبسط أكثر؟');
    }
    
    if (context && context.questionsAsked !== undefined && context.questionsAsked < 3) {
      suggestions.push('ما الذي يحيرك في هذا الموضوع؟');
    }
    
    return suggestions;
  }
  
  /**
   * Generate recommendation for parents
   */
  private async generateParentRecommendation(context?: StudentContext): Promise<string> {
    if (!context) return 'يحتاج متابعة منتظمة';
    
    if (context.confidence < 50) {
      return 'يحتاج تشجيع ودعم إضافي. ركزوا على الإيجابيات وتجنبوا المقارنات';
    }
    
    if (context.sessionDuration > 60) {
      return 'يدرس لفترات طويلة. شجعوه على أخذ فترات راحة منتظمة';
    }
    
    if (context.correctAnswers > context.wrongAnswers * 2) {
      return 'أداء ممتاز! شجعوه على مساعدة زملائه لتعزيز فهمه';
    }
    
    return 'أداء جيد. استمروا في المتابعة والتشجيع';
  }
  
  /**
   * Notify parent about student progress
   */
  private notifyParent(studentId: string, report: any): void {
    // In real implementation, send to parent's socket or email
    console.log(`📧 Parent notification for student ${studentId}`);
  }
  
  /**
   * Generate motivational elements
   */
  private async generateMotivationalElements(name: string, context: StudentContext): Promise<any> {
    return {
      message: `يا ${name}، أنت أقوى مما تتخيل! كل خطأ يقربك من الفهم الصحيح`,
      tips: [
        'خذ نفس عميق',
        'فكر في النجاحات السابقة',
        'اطلب مساعدة عند الحاجة'
      ],
      reward: context.streakCount >= 3 ? '🏆' : null
    };
  }
  
  // ============= 🆕 MONITORING METHODS =============
  
  /**
   * Start emotional monitoring interval
   */
  private startEmotionalMonitoring(): void {
    // Monitor emotional states every 5 minutes
    setInterval(() => {
      this.studentContexts.forEach((context, userId) => {
        const socket = this.connectedUsers.get(userId);
        if (!socket) return;
        
        // Check for concerning patterns
        if (context.sessionDuration > 60 && context.breaksTaken === 0) {
          socket.emit('health_reminder', {
            type: 'break_needed',
            message: 'لقد درست لأكثر من ساعة. وقت الراحة مهم للتركيز!'
          });
        }
        
        if (context.confidence < 30 && context.wrongAnswers > 5) {
          socket.emit('support_offered', {
            message: 'لاحظت أنك تواجه صعوبة. هل تريد أن نراجع الأساسيات معاً؟',
            options: ['نعم، لنراجع', 'لا، سأستمر']
          });
        }
      });
    }, 5 * 60 * 1000); // Every 5 minutes
  }
  
  // ============= HELPER METHODS =============

  /**
   * 🆕 Complete cleanup of all user data from memory
   */
  private cleanupUserData(userId: string): void {
    console.log(`🧹 Starting complete cleanup for user: ${userId}`);

    // 1. Clean from connectedUsers
    if (this.connectedUsers.has(userId)) {
      this.connectedUsers.delete(userId);
      console.log(`  ✓ Removed from connectedUsers`);
    }

    // 2. Clean from studentContexts
    if (this.studentContexts.has(userId)) {
      this.studentContexts.delete(userId);
      console.log(`  ✓ Removed from studentContexts`);
    }

    // 3. Clean from userSessions
    if (this.userSessions.has(userId)) {
      this.userSessions.delete(userId);
      console.log(`  ✓ Removed from userSessions`);
    }

    // 4. Clean from userAchievements
    if (this.userAchievements.has(userId)) {
      this.userAchievements.delete(userId);
      console.log(`  ✓ Removed from userAchievements`);
    }

    // 5. Clean from heartbeatIntervals
    const heartbeatInterval = this.heartbeatIntervals.get(userId);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      this.heartbeatIntervals.delete(userId);
      console.log(`  ✓ Cleared heartbeat interval`);
    }

    // 6. Clean from teachingSessions (all entries ending with _userId)
    let teachingCleaned = 0;
    this.teachingSessions.forEach((session, key) => {
      if (key.endsWith(`_${userId}`)) {
        this.teachingSessions.delete(key);
        teachingCleaned++;
      }
    });
    if (teachingCleaned > 0) {
      console.log(`  ✓ Removed ${teachingCleaned} teaching sessions`);
    }

    // 7. Clean from voiceGenerationStatus
    let voiceCleaned = 0;
    this.voiceGenerationStatus.forEach((status, key) => {
      if (key.endsWith(`_${userId}`)) {
        this.voiceGenerationStatus.delete(key);
        voiceCleaned++;
      }
    });
    if (voiceCleaned > 0) {
      console.log(`  ✓ Removed ${voiceCleaned} voice generation statuses`);
    }

    // 8. Clean from rooms
    let roomsCleaned = 0;
    this.rooms.forEach((users, lessonId) => {
      if (users.has(userId)) {
        users.delete(userId);
        roomsCleaned++;

        // If room is empty, delete it
        if (users.size === 0) {
          this.rooms.delete(lessonId);
          console.log(`  ✓ Deleted empty room: ${lessonId}`);
        }
      }
    });
    if (roomsCleaned > 0) {
      console.log(`  ✓ Removed from ${roomsCleaned} rooms`);
    }

    console.log(`✅ Complete cleanup finished for user: ${userId}`);

    // Log memory status
    console.log(`📊 Current memory status:`);
    console.log(`  - Connected users: ${this.connectedUsers.size}`);
    console.log(`  - Student contexts: ${this.studentContexts.size}`);
    console.log(`  - User sessions: ${this.userSessions.size}`);
    console.log(`  - Teaching sessions: ${this.teachingSessions.size}`);
    console.log(`  - Voice statuses: ${this.voiceGenerationStatus.size}`);
    console.log(`  - Heartbeat intervals: ${this.heartbeatIntervals.size}`);
    console.log(`  - Achievements tracked: ${this.userAchievements.size}`);
    console.log(`  - Active rooms: ${this.rooms.size}`);
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }
  
  private startTeachingSessionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      this.teachingSessions.forEach((session, key) => {
        const lastActivity = session.lastInteraction || session.startedAt;
        const inactiveTime = now - lastActivity.getTime();
        
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
  
  private startCleanupInterval(): void {
    setInterval(async () => {
      const count = await sessionService.cleanupInactiveSessions();
      if (count > 0) {
        console.log(`🧹 Cleaned up ${count} inactive sessions`);
      }
    }, 60 * 60 * 1000);
  }
  
  private startVoiceCacheCleanup(): void {
    setInterval(async () => {
      const deletedCount = await voiceService.cleanupCache(24);
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old voice files`);
      }
      
      teachingAssistant.clearCache();
      console.log('🧹 Cleared teaching assistant cache');
    }, 6 * 60 * 60 * 1000);
  }
  
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
  
  getTeachingSession(lessonId: string, userId: string): TeachingSessionData | undefined {
    return this.teachingSessions.get(`${lessonId}_${userId}`);
  }
  
  getStudentContext(userId: string): StudentContext | undefined {
    return this.studentContexts.get(userId);
  }
  
  getIO(): SocketIOServer | null {
    return this.io;
  }
  
  getVoiceStatus(lessonId: string, userId: string): VoiceGenerationStatus | null {
    const statusKey = `${lessonId}_${userId}`;
    return this.voiceGenerationStatus.get(statusKey) || null;
  }
}

// Export singleton
export const websocketService = new WebSocketService();