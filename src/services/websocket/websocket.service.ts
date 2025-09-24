// 📍 المكان: src/services/websocket/websocket.service.ts
// النسخة النظيفة مع SlideService + VoiceService

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

// ============= VOICE SERVICE (NEW) =============
import { voiceService } from '../voice/voice.service';

// ============= MATH IMPORTS =============
import { mathSlideGenerator } from '../../core/video/enhanced-slide.generator';
import { latexRenderer, type MathExpression } from '../../core/interactive/math/latex-renderer';

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
}

// Store voice generation status
interface VoiceGenerationStatus {
  lessonId: string;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  progress: number;
  totalSlides: number;
  completedSlides: number;
  audioUrls?: string[];
  error?: string;
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, Socket> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private userSessions: Map<string, SessionInfo> = new Map();
  private voiceGenerationStatus: Map<string, VoiceGenerationStatus> = new Map();
  
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
    
    // Start cleanup intervals
    this.startCleanupInterval();
    this.startVoiceCacheCleanup();
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
          voice: true // Added voice feature
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
          
          // Send auth confirmation
          socket.emit('authenticated', {
            success: true,
            userId: user.id,
            email: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            message: 'Authentication successful'
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
            userId: user.id
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
      
      // ============= SLIDE EVENTS WITH VOICE SUPPORT =============
      
      socket.on('request_slide', async (data: any) => {
        try {
          if (!socket.data.authenticated) {
            socket.emit('slide_error', {
              message: 'يجب تسجيل الدخول أولاً',
              code: 'NOT_AUTHENTICATED'
            });
            return;
          }
          
          // Build slide content from request data
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
          
          // Generate HTML using the new SlideService
          const slideHTML = slideService.generateSlideHTML(
            slideContent,
            data.theme || 'default'
          );
          
          // Add animation styles if this is the first slide
          const fullHTML = data.slideNumber === 0 
            ? slideService.getAnimationStyles() + slideHTML
            : slideHTML;
          
          // Generate voice if requested
          let audioUrl = null;
          if (data.generateVoice) {
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
            audioUrl // Include audio URL if generated
          });
          
          console.log(`✅ Slide generated for ${socket.data.user.email} - Type: ${slideContent.type}${audioUrl ? ' (with voice)' : ''}`);
          
        } catch (error: any) {
          console.error('❌ Slide error:', error);
          socket.emit('slide_error', {
            message: 'فشل توليد الشريحة',
            error: error.message
          });
        }
      });
      
      // ============= NEW VOICE EVENTS =============
      
      // Generate voice for a single slide
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
      
      // Generate voice for all lesson slides
      socket.on('generate_lesson_voices', async (data: { 
        lessonId: string;
        options?: {
          voiceId?: string;
          speed?: number;
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
          const lessonId = data.lessonId;
          
          // Get lesson with content
          const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
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
            socket.emit('voice_error', {
              message: 'الدرس غير موجود',
              code: 'LESSON_NOT_FOUND'
            });
            return;
          }
          
          // Initialize status
          const statusKey = `${lessonId}_${user.id}`;
          this.voiceGenerationStatus.set(statusKey, {
            lessonId,
            status: 'generating',
            progress: 0,
            totalSlides: 0,
            completedSlides: 0
          });
          
          // Build slides array
          const slides: any[] = [];
          
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
              } catch (e) {
                // Skip if not valid JSON
              }
            }
          }
          
          // Update total slides count
          const status = this.voiceGenerationStatus.get(statusKey)!;
          status.totalSlides = slides.length;
          
          // Send initial status
          socket.emit('voice_generation_started', {
            lessonId,
            totalSlides: slides.length,
            message: `بدء توليد الصوت لـ ${slides.length} شريحة`
          });
          
          // Generate voices
          const audioUrls: string[] = [];
          
          for (let i = 0; i < slides.length; i++) {
            const slide = slides[i];
            
            // Update progress
            status.progress = Math.round((i / slides.length) * 100);
            status.completedSlides = i;
            
            // Send progress update
            socket.emit('voice_generation_progress', {
              lessonId,
              slideNumber: i + 1,
              totalSlides: slides.length,
              progress: status.progress,
              message: `توليد الصوت للشريحة ${i + 1} من ${slides.length}`
            });
            
            // Generate voice
            const voiceResult = await voiceService.generateSlideNarration(
              slide,
              {
                voiceId: data.options?.voiceId,
                similarityBoost: data.options?.speed ? 1 / data.options.speed : undefined
              }
            );
            
            if (voiceResult.success && voiceResult.audioUrl) {
              audioUrls.push(voiceResult.audioUrl);
            } else {
              audioUrls.push(''); // Empty for failed slides
            }
            
            // Small delay between generations
            if (i < slides.length - 1 && !voiceResult.cached) {
              await this.delay(500);
            }
          }
          
          // Update final status
          status.status = 'completed';
          status.progress = 100;
          status.completedSlides = slides.length;
          status.audioUrls = audioUrls;
          
          // Send completion
          socket.emit('lesson_voices_ready', {
            success: true,
            lessonId,
            audioUrls,
            totalSlides: slides.length,
            message: 'تم توليد جميع الأصوات بنجاح'
          });
          
          console.log(`✅ Generated ${audioUrls.filter(url => url).length} voices for lesson ${lessonId}`);
          
        } catch (error: any) {
          console.error('❌ Lesson voices error:', error);
          
          // Update status
          const statusKey = `${data.lessonId}_${socket.data.user.id}`;
          const status = this.voiceGenerationStatus.get(statusKey);
          if (status) {
            status.status = 'failed';
            status.error = error.message;
          }
          
          socket.emit('voice_error', {
            message: 'فشل توليد أصوات الدرس',
            error: error.message
          });
        }
      });
      
      // Get voice generation status
      socket.on('get_voice_status', async (data: { lessonId: string }) => {
        if (!socket.data.authenticated) {
          socket.emit('voice_error', {
            message: 'يجب تسجيل الدخول أولاً',
            code: 'NOT_AUTHENTICATED'
          });
          return;
        }
        
        const user = socket.data.user as UserData;
        const statusKey = `${data.lessonId}_${user.id}`;
        const status = this.voiceGenerationStatus.get(statusKey);
        
        socket.emit('voice_status', {
          lessonId: data.lessonId,
          status: status || {
            lessonId: data.lessonId,
            status: 'idle',
            progress: 0,
            totalSlides: 0,
            completedSlides: 0
          }
        });
      });
      
      // List available voices
      socket.on('list_voices', async () => {
        try {
          const voices = await voiceService.listAvailableVoices();
          
          socket.emit('voices_list', {
  success: true,
  voices,
  defaultVoiceId: process.env.ELEVENLABS_VOICE_ID,  
  message: `تم العثور على ${voices.length} صوت متاح`
});
          
        } catch (error: any) {
          socket.emit('voice_error', {
            message: 'فشل جلب قائمة الأصوات',
            error: error.message
          });
        }
      });
      
      // ============= EXISTING EVENTS (unchanged) =============
      
      // Generate full lesson slides (with voice option)
      socket.on('generate_lesson_slides', async (data: { 
        lessonId: string; 
        theme?: string;
        generateVoice?: boolean;
      }) => {
        try {
          if (!socket.data.authenticated) {
            socket.emit('error', {
              code: 'NOT_AUTHENTICATED',
              message: 'يجب تسجيل الدخول أولاً'
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
            socket.emit('error', {
              code: 'LESSON_NOT_FOUND',
              message: 'الدرس غير موجود'
            });
            return;
          }
          
          // Create slides based on lesson content
          const slides: SlideContent[] = [];
          
          // Title slide
          slides.push({
            type: 'title',
            title: lesson.titleAr || lesson.title,
            subtitle: lesson.unit.subject.nameAr || lesson.unit.subject.name
          });
          
          // Content slides
          if (lesson.content) {
            // Main content slide
            slides.push({
              type: 'content',
              title: 'محتوى الدرس',
              content: lesson.content.fullText?.substring(0, 500) || lesson.content.summary || 'محتوى الدرس'
            });
            
            // Key points as bullet slide
            if (lesson.content.keyPoints) {
              let keyPointsArray: string[] = [];
              try {
                keyPointsArray = JSON.parse(lesson.content.keyPoints);
              } catch (e) {
                keyPointsArray = [lesson.content.keyPoints];
              }
              
              if (keyPointsArray.length > 0) {
                slides.push({
                  type: 'bullet',
                  title: 'النقاط الرئيسية',
                  bullets: keyPointsArray
                });
              }
            }
            
            // Summary slide
            let summaryBullets: string[] = ['تم إكمال الدرس بنجاح'];
            if (lesson.content.keyPoints) {
              try {
                const keyPointsArray = JSON.parse(lesson.content.keyPoints);
                if (Array.isArray(keyPointsArray)) {
                  summaryBullets = keyPointsArray.slice(0, 5);
                }
              } catch (e) {
                // Keep default summary bullets
              }
            }
            
            slides.push({
              type: 'summary',
              title: 'الخلاصة',
              subtitle: lesson.titleAr || lesson.title,
              bullets: summaryBullets
            });
          }
          
          // Generate HTML for all slides
          const htmlSlides = slideService.generateLessonSlides(
            slides, 
            data.theme || 'default'
          );
          
          // Add animation styles to first slide
          if (htmlSlides.length > 0) {
            htmlSlides[0] = slideService.getAnimationStyles() + htmlSlides[0];
          }
          
          // Generate voices if requested
          let audioUrls: string[] = [];
          if (data.generateVoice) {
            const voiceResults = await voiceService.generateLessonNarration(slides);
            audioUrls = voiceResults.map(r => r.audioUrl || '');
          }
          
          socket.emit('lesson_slides_ready', {
            success: true,
            lessonId: data.lessonId,
            totalSlides: htmlSlides.length,
            slides: htmlSlides,
            audioUrls: data.generateVoice ? audioUrls : undefined,
            message: `تم توليد ${htmlSlides.length} شريحة للدرس${data.generateVoice ? ' مع الصوت' : ''}`
          });
          
          console.log(`✅ Generated ${htmlSlides.length} slides for lesson ${data.lessonId}${data.generateVoice ? ' with voice' : ''}`);
          
        } catch (error: any) {
          console.error('❌ Lesson slides error:', error);
          socket.emit('error', {
            code: 'SLIDES_GENERATION_FAILED',
            message: 'فشل توليد شرائح الدرس'
          });
        }
      });
      
      // Math slide event (unchanged)
      socket.on('request_math_slide', async (data: any = {}) => {
        try {
          if (!socket.data.authenticated) {
            socket.emit('math_slide_error', {
              message: 'يجب تسجيل الدخول أولاً'
            });
            return;
          }
          
          const mathContent = data.content || {
            title: 'معادلة رياضية',
            expressions: ['x^2 + 2x + 1 = 0']
          };
          
          // First try using the new SlideService for math
          const slideContent: SlideContent = {
            type: 'equation',
            title: mathContent.title,
            equation: mathContent.expressions[0],
            content: data.description
          };
          
          const slideHTML = slideService.generateSlideHTML(
            slideContent,
            data.theme || 'default'
          );
          
          socket.emit('math_slide_ready', {
            success: true,
            html: slideHTML,
            type: 'math'
          });
          
          console.log('✅ Math slide generated using SlideService');
          
        } catch (error: any) {
          console.error('❌ Math slide error:', error);
          socket.emit('math_slide_error', {
            message: 'فشل توليد الشريحة الرياضية'
          });
        }
      });
      
      // Simple chat (unchanged)
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
          // Simple AI response
          const aiResponse = await openAIService.chat([
            {
              role: 'system',
              content: 'أنت مساعد تعليمي ودود. أجب بشكل مختصر ومفيد.'
            },
            {
              role: 'user', 
              content: data.message
            }
          ], {
            temperature: 0.7,
            maxTokens: 150
          });
                    
          socket.emit('ai_response', {
            message: aiResponse,
            timestamp: new Date().toISOString()
          });
          
          console.log(`💬 Chat processed for ${user.email}`);
          
        } catch (error: any) {
          console.error('❌ Chat error:', error);
          socket.emit('error', {
            code: 'CHAT_FAILED',
            message: 'فشل الرد على الرسالة'
          });
        }
      });
      
      // ============= UTILITY EVENTS =============
      
      socket.on('ping', () => {
        socket.emit('pong', {
          timestamp: Date.now(),
          serverTime: new Date().toISOString()
        });
      });
      
      socket.on('get_status', () => {
        const user = socket.data.user as UserData | undefined;
        
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
            themes: ['default', 'dark', 'kids']
          }
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
  
  getIO(): SocketIOServer | null {
    return this.io;
  }
  
  /**
   * Generate slide for a specific lesson part
   */
  async generateSlideForLesson(
    lessonId: string, 
    slideType: SlideContent['type'],
    content: Partial<SlideContent>,
    theme: string = 'default'
  ): Promise<string> {
    const slideContent: SlideContent = {
      type: slideType,
      ...content
    };
    
    return slideService.generateSlideHTML(slideContent, theme);
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