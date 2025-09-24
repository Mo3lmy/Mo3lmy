// 📍 المكان: src/services/websocket/websocket.service.ts
// النسخة المُصلحة بالكامل - تحل جميع مشاكل المصادقة والاتصال

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { prisma } from '../../config/database.config';
import { sessionService, type ExtendedSession } from './session.service';
import type { LearningSession } from '@prisma/client';
import { EnhancedSlideGenerator } from '../../core/video/slide.generator';
import { realtimeChatService } from './realtime-chat.service';
import { setupOrchestratorEvents } from './orchestrator-events';
import { lessonOrchestrator } from '../orchestrator/lesson-orchestrator.service';
import { openAIService } from '../ai/openai.service';

// ============= MATH IMPORTS =============
import { mathSlideGenerator } from '../../core/video/enhanced-slide.generator';
import { latexRenderer, type MathExpression } from '../../core/interactive/math/latex-renderer';

// Initialize slideGenerator
const slideGenerator = new EnhancedSlideGenerator();

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

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, Socket> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private userSessions: Map<string, SessionInfo> = new Map();
  
  /**
   * Initialize WebSocket server with proper configuration
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: function(origin, callback) {
          // في التطوير، اسمح بكل الأصول
          if (config.NODE_ENV === 'development') {
            callback(null, true);
          } else {
            const allowedOrigins = ['https://yourdomain.com'];
            if (!origin || allowedOrigins.indexOf(origin) !== -1) {
              callback(null, true);
            } else {
              callback(new Error('Not allowed by CORS'));
            }
          }
        },
        credentials: true,
        methods: ['GET', 'POST']
      },
      
      // دعم polling و websocket معاً
      transports: ['polling', 'websocket'],
      allowUpgrades: true,
      
      // Connection settings محسنة
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
    console.log('   📚 Dynamic lessons: ENABLED');
    console.log('   🔐 Authentication: Event-based');
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    // Initialize slideGenerator
    slideGenerator.initialize().then(() => {
      console.log('✅ Slide generator initialized');
    }).catch(err => {
      console.error('⚠️ Slide generator initialization failed:', err);
    });
  }
  
  /**
   * Setup all socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;
    
    this.io.on('connection', async (socket: Socket) => {
      console.log(`\n✅ NEW CONNECTION`);
      console.log(`   🔌 Socket ID: ${socket.id}`);
      console.log(`   📅 Time: ${new Date().toISOString()}`);
      console.log(`   👥 Total sockets: ${this.io?.sockets.sockets.size || 0}`);
      
      // إرسال رسالة ترحيب فورية بدون مصادقة
      socket.emit('welcome', {
        message: 'مرحباً بك في منصة التعليم الذكية! 👋',
        socketId: socket.id,
        serverTime: new Date().toISOString(),
        requiresAuth: true,
        features: {
          math: true,
          interactive: true,
          voice: false,
          dynamicLessons: true
        }
      });
      
      // ============= AUTHENTICATION EVENT HANDLER =============
      socket.on('authenticate', async (data: { token: string }) => {
        try {
          console.log(`🔐 Authentication attempt for socket: ${socket.id}`);
          
          // التحقق من وجود التوكن
          if (!data || !data.token) {
            console.log('   ❌ No token provided');
            socket.emit('auth_error', {
              success: false,
              message: 'Token is required',
              code: 'NO_TOKEN'
            });
            return;
          }
          
          console.log(`   🔑 Token received: ${data.token.substring(0, 20)}...`);
          
          let user: UserData | null = null;
          
          // في وضع التطوير - استخدم مستخدم تجريبي
          if (config.NODE_ENV === 'development') {
            console.log('   📝 Development mode - using test user');
            
            const testUser = await prisma.user.findFirst({
              where: {
                OR: [
                  { email: 'dev@test.com' },
                  { email: 'student@test.com' },
                  { email: 'test@test.com' }
                ]
              },
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
              console.log(`   ✅ Test user found: ${user.email}`);
            } else {
              // إنشاء مستخدم تجريبي
              console.log('   ⚠️ Creating test user...');
              const newUser = await prisma.user.create({
                data: {
                  email: 'dev@test.com',
                  password: '$2b$10$dummy', // dummy hash
                  firstName: 'Dev',
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
              console.log(`   ✅ Test user created: ${user.email}`);
            }
          } else {
            // Production mode - verify real token
            try {
              const decoded = jwt.verify(data.token, config.JWT_SECRET) as any;
              console.log(`   🔓 Token decoded: userId=${decoded.userId}`);
              
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
                console.log(`   ✅ User found: ${user.email}`);
              } else {
                throw new Error('User not found in database');
              }
            } catch (err: any) {
              console.error('   ❌ Token verification failed:', err.message);
              socket.emit('auth_error', {
                success: false,
                message: 'Invalid token',
                code: 'INVALID_TOKEN',
                error: err.message
              });
              return;
            }
          }
          
          if (!user) {
            console.log('   ❌ Authentication failed - no user');
            socket.emit('auth_error', {
              success: false,
              message: 'Authentication failed',
              code: 'AUTH_FAILED'
            });
            return;
          }
          
          // حفظ بيانات المستخدم في Socket
          socket.data.user = user;
          socket.data.authenticated = true;
          socket.data.authenticatedAt = new Date();
          
          // تخزين Socket reference
          this.connectedUsers.set(user.id, socket);
          
          // إرسال تأكيد المصادقة - مهم جداً
          socket.emit('authenticated', {
            success: true,
            userId: user.id,
            email: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            message: 'Authentication successful',
            timestamp: new Date().toISOString()
          });
          
          console.log(`   ✅ Authentication successful for ${user.email}`);
          console.log(`   👥 Total authenticated users: ${this.connectedUsers.size}`);
          
          // التحقق من آخر جلسة نشطة
          const lastSession = await sessionService.getLastActiveSession(user.id);
          if (lastSession) {
            console.log(`   📝 Found last session: ${lastSession.id}`);
            socket.emit('session_available', {
              sessionId: lastSession.id,
              lessonId: lastSession.lessonId,
              currentSlide: lastSession.currentSlide,
              lastActivity: lastSession.lastActivityAt,
              lessonTitle: lastSession.lesson?.title || 'Unknown'
            });
          }
          
        } catch (error: any) {
          console.error('❌ Authentication error:', error);
          socket.emit('auth_error', {
            success: false,
            message: error.message || 'Authentication failed',
            code: 'AUTH_ERROR'
          });
        }
      });
      
      // ============= LESSON EVENTS =============
      
      socket.on('join_lesson', async (data: { lessonId: string }) => {
        try {
          // التحقق من المصادقة أولاً
          if (!socket.data.authenticated || !socket.data.user) {
            console.log('❌ Join lesson attempt without authentication');
            socket.emit('error', {
              code: 'NOT_AUTHENTICATED',
              message: 'يجب تسجيل الدخول أولاً'
            });
            return;
          }
          
          const user = socket.data.user as UserData;
          const lessonId = data.lessonId;
          
          console.log(`📚 ${user.email} joining lesson: ${lessonId}`);
          
          // التحقق من وجود الدرس
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
            console.log(`   ❌ Lesson not found: ${lessonId}`);
            socket.emit('error', {
              code: 'LESSON_NOT_FOUND',
              message: 'الدرس غير موجود',
              lessonId
            });
            return;
          }
          
          console.log(`   ✅ Lesson found: ${lesson.titleAr || lesson.title}`);
          
          // إنشاء أو استعادة الجلسة
          const session = await sessionService.getOrCreateSession(
            user.id,
            lessonId,
            socket.id
          );
          
          // تخزين معلومات الجلسة
          this.userSessions.set(user.id, {
            sessionId: session.id,
            lessonId,
            userId: user.id
          });
          
          console.log(`   📝 Session ${session.id} ${session.isActive ? 'restored' : 'created'}`);
          
          // الانضمام لغرفة الدرس
          const roomName = `lesson:${lessonId}`;
          socket.join(roomName);
          
          // تتبع المشاركين
          if (!this.rooms.has(lessonId)) {
            this.rooms.set(lessonId, new Set());
          }
          this.rooms.get(lessonId)!.add(user.id);
          
          const participants = Array.from(this.rooms.get(lessonId)!);
          
          // إرسال تأكيد الانضمام
          socket.emit('joined_lesson', {
            success: true,
            lessonId,
            lessonTitle: lesson.titleAr || lesson.title,
            sessionId: session.id,
            unitTitle: lesson.unit.title,
            subjectName: lesson.unit.subject.nameAr || lesson.unit.subject.name,
            grade: lesson.unit.subject.grade,
            participants: participants.length,
            session: {
              id: session.id,
              currentSlide: session.currentSlide,
              totalSlides: session.totalSlides,
              isResumed: session.lastActivityAt > new Date(Date.now() - 60 * 60 * 1000)
            },
            message: `انضممت بنجاح لدرس: ${lesson.titleAr || lesson.title}`
          });
          
          // إشعار الآخرين
          socket.to(roomName).emit('user_joined_lesson', {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            participants: participants.length
          });
          
          console.log(`   ✅ Joined successfully. Room has ${participants.length} participants`);
          
        } catch (error: any) {
          console.error('❌ Join lesson error:', error);
          socket.emit('error', {
            code: 'JOIN_FAILED',
            message: 'فشل الانضمام للدرس',
            error: error.message
          });
        }
      });
      
      // ============= SLIDE EVENTS =============
      
      socket.on('request_slide', async (data: any) => {
        try {
          // التحقق من المصادقة
          if (!socket.data.authenticated) {
            socket.emit('slide_error', {
              message: 'يجب تسجيل الدخول أولاً',
              code: 'NOT_AUTHENTICATED'
            });
            return;
          }
          
          const user = socket.data.user as UserData;
          console.log(`🖼️ Slide request from ${user.email}`);
          
          // التحقق من وجود جلسة نشطة (اختياري)
          const sessionInfo = this.userSessions.get(user.id);
          
          // توليد الشريحة
          await slideGenerator.initialize();
          
          // تحديد نوع المحتوى
          const slideContent = {
            id: `slide-${Date.now()}`,
            type: data.type || 'content',
            content: data.content || {
              title: data.title || 'شريحة تجريبية',
              subtitle: data.subtitle,
              text: data.text,
              points: data.points
            },
            duration: 10,
            transitions: { 
              in: 'fade' as 'fade', 
              out: 'fade' as 'fade'
            }
          };
          
          const slideHTML = slideGenerator.generateRealtimeSlideHTML(
            slideContent,
            data.theme || 'default'
          );
          
          // إرسال الشريحة
          socket.emit('slide_ready', {
            success: true,
            html: slideHTML,
            slideNumber: data.slideNumber || 0,
            type: slideContent.type,
            timestamp: new Date().toISOString(),
            message: 'تم توليد الشريحة بنجاح'
          });
          
          console.log(`   ✅ Slide generated and sent`);
          
          // تحديث الجلسة إذا كانت موجودة
          if (sessionInfo && data.slideNumber !== undefined) {
            await sessionService.updateSlidePosition(
              sessionInfo.sessionId,
              data.slideNumber,
              100 // افتراض 100 شريحة كحد أقصى
            );
          }
          
        } catch (error: any) {
          console.error('❌ Slide generation error:', error);
          socket.emit('slide_error', {
            message: 'فشل توليد الشريحة',
            error: error.message,
            code: 'GENERATION_FAILED'
          });
        }
      });
      
      // ============= MATH EVENTS =============
      
      socket.on('request_math_slide', async (data: any = {}) => {
        try {
          if (!socket.data.authenticated) {
            socket.emit('math_slide_error', {
              message: 'يجب تسجيل الدخول أولاً',
              code: 'NOT_AUTHENTICATED'
            });
            return;
          }
          
          const user = socket.data.user as UserData;
          console.log(`🧮 Math slide request from ${user.email}`);
          
          // Default math content
          const mathContent = data.mathContent || data.content || {
            title: 'معادلة رياضية تفاعلية',
            expressions: [latexRenderer.getCommonExpressions().quadratic]
          };
          
          // توليد شريحة رياضية
          const slideHTML = await mathSlideGenerator.generateMathSlide(
            {
              title: mathContent.title,
              mathExpressions: mathContent.expressions,
              interactive: true,
              showSteps: true
            },
            data.theme || 'default'
          );
          
          socket.emit('math_slide_ready', {
            success: true,
            html: slideHTML,
            type: 'math',
            timestamp: new Date().toISOString()
          });
          
          console.log('   ✅ Math slide generated');
          
        } catch (error: any) {
          console.error('❌ Math slide error:', error);
          socket.emit('math_slide_error', {
            message: 'فشل توليد الشريحة الرياضية',
            error: error.message
          });
        }
      });
      
      // ============= CHAT EVENTS =============
      
      socket.on('chat_message', async (data: { lessonId: string; message: string }) => {
        if (!socket.data.authenticated) {
          socket.emit('error', {
            code: 'NOT_AUTHENTICATED',
            message: 'يجب تسجيل الدخول أولاً'
          });
          return;
        }
        
        const user = socket.data.user as UserData;
        
        // Process chat message
        await realtimeChatService.handleUserMessage(
          user.id,
          data.lessonId,
          data.message,
          socket.id
        );
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
        const sessionInfo = user ? this.userSessions.get(user.id) : undefined;
        
        socket.emit('status', {
          connected: true,
          authenticated: socket.data.authenticated || false,
          userId: user?.id,
          socketId: socket.id,
          rooms: Array.from(socket.rooms),
          totalUsers: this.connectedUsers.size,
          hasActiveSession: !!sessionInfo,
          sessionInfo: sessionInfo || null,
          features: {
            math: true,
            interactive: true,
            voice: false,
            dynamicLessons: true
          }
        });
      });
      
      // ============= DYNAMIC LESSONS =============
      
      socket.on('get_available_lessons', async (options?: any) => {
        if (!socket.data.authenticated) {
          socket.emit('available_lessons', {
            lessons: [],
            error: 'يجب تسجيل الدخول أولاً'
          });
          return;
        }
        
        try {
          const lessons = await prisma.lesson.findMany({
            where: { isPublished: true },
            select: {
              id: true,
              title: true,
              titleAr: true,
              description: true,
              difficulty: true,
              estimatedMinutes: true,
              unit: {
                select: {
                  title: true,
                  subject: {
                    select: {
                      name: true,
                      nameAr: true,
                      grade: true,
                      icon: true
                    }
                  }
                }
              }
            },
            take: options?.limit || 50,
            orderBy: { createdAt: 'desc' }
          });
          
          socket.emit('available_lessons', {
            lessons: lessons.map(lesson => ({
              id: lesson.id,
              title: lesson.titleAr || lesson.title,
              description: lesson.description,
              subject: lesson.unit.subject.nameAr || lesson.unit.subject.name,
              grade: lesson.unit.subject.grade,
              difficulty: lesson.difficulty,
              estimatedMinutes: lesson.estimatedMinutes || 30
            })),
            total: lessons.length
          });
          
        } catch (error) {
          console.error('Error fetching lessons:', error);
          socket.emit('available_lessons', {
            lessons: [],
            error: 'فشل جلب الدروس'
          });
        }
      });
      
      // ============= ORCHESTRATOR EVENTS =============
      
      // Setup orchestrator events only after authentication
      socket.on('setup_orchestrator', () => {
        if (socket.data.authenticated && socket.data.user) {
          setupOrchestratorEvents(socket, socket.data.user as UserData);
          socket.emit('orchestrator_ready', { message: 'Orchestrator events configured' });
        } else {
          socket.emit('error', { code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
        }
      });
      
      // ============= DISCONNECTION =============
      
      socket.on('disconnect', async (reason) => {
        console.log(`\n❌ DISCONNECTION`);
        console.log(`   🔌 Socket ID: ${socket.id}`);
        console.log(`   📊 Reason: ${reason}`);
        
        const user = socket.data.user as UserData | undefined;
        if (user) {
          console.log(`   👤 User: ${user.email}`);
          
          // حفظ الجلسة للاستئناف لاحقاً
          const sessionInfo = this.userSessions.get(user.id);
          if (sessionInfo) {
            await prisma.learningSession.update({
              where: { id: sessionInfo.sessionId },
              data: {
                lastActivityAt: new Date(),
                socketId: null
              }
            }).catch(() => {});
            
            console.log(`   📝 Session preserved: ${sessionInfo.sessionId}`);
          }
          
          // تنظيف
          this.connectedUsers.delete(user.id);
          this.userSessions.delete(user.id);
          
          // إزالة من الغرف
          this.rooms.forEach((users, lessonId) => {
            if (users.has(user.id)) {
              users.delete(user.id);
              
              this.io?.to(`lesson:${lessonId}`).emit('user_left_lesson', {
                userId: user.id,
                userName: `${user.firstName} ${user.lastName}`,
                participants: users.size
              });
              
              if (users.size === 0) {
                this.rooms.delete(lessonId);
              }
            }
          });
          
          // إشعار الآخرين
          socket.broadcast.emit('user_disconnected', {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            totalUsers: this.connectedUsers.size
          });
        }
        
        console.log(`   👥 Remaining users: ${this.connectedUsers.size}`);
      });
      
      socket.on('error', (error) => {
        console.error(`❌ Socket error:`, error);
      });
    });
  }
  
  /**
   * Cleanup interval for inactive sessions
   */
  private startCleanupInterval(): void {
    // تنظيف الجلسات غير النشطة كل ساعة
    setInterval(async () => {
      const count = await sessionService.cleanupInactiveSessions();
      if (count > 0) {
        console.log(`🧹 Cleaned up ${count} inactive sessions`);
      }
    }, 60 * 60 * 1000); // كل ساعة
    
    // تحديث آخر نشاط للجلسات النشطة كل 5 دقائق
    setInterval(async () => {
      for (const [userId, sessionInfo] of this.userSessions) {
        await prisma.learningSession.update({
          where: { id: sessionInfo.sessionId },
          data: { lastActivityAt: new Date() }
        }).catch(() => {});
      }
    }, 5 * 60 * 1000); // كل 5 دقائق
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
  
  sendOrchestratedContent(userId: string, eventName: string, data: any): boolean {
    return this.sendToUser(userId, eventName, data);
  }
  
  broadcastOrchestratorUpdate(lessonId: string, update: any): void {
    this.sendToLesson(lessonId, 'orchestrator_update', update);
  }
  
  async getActiveFlow(userId: string, lessonId: string): Promise<any> {
    // Implementation for getting active flow
    return null;
  }
  
  sendActionResult(userId: string, action: string, result: any): void {
    this.sendToUser(userId, 'action_result', {
      action,
      result,
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton
export const websocketService = new WebSocketService();