// 📍 المكان: src/services/websocket/websocket.service.ts
// النسخة النظيفة - بدون أي dependencies معطلة

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { config } from '../../config';
import { prisma } from '../../config/database.config';
import { sessionService, type ExtendedSession } from './session.service';
import type { LearningSession } from '@prisma/client';
import { EnhancedSlideGenerator } from '../../core/video/slide.generator';
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
    console.log('   📚 Simple lessons: ENABLED');
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    // Initialize slideGenerator
    slideGenerator.initialize().then(() => {
      console.log('✅ Slide generator ready');
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
          lessons: true
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
      
      // ============= SLIDE EVENTS =============
      
      socket.on('request_slide', async (data: any) => {
        try {
          if (!socket.data.authenticated) {
            socket.emit('slide_error', {
              message: 'يجب تسجيل الدخول أولاً',
              code: 'NOT_AUTHENTICATED'
            });
            return;
          }
          
          await slideGenerator.initialize();
          
          const slideContent = {
            id: `slide-${Date.now()}`,
            type: data.type || 'content',
            content: data.content || {
              title: data.title || 'شريحة تجريبية',
              text: data.text,
              bullets: data.bullets
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
          
          socket.emit('slide_ready', {
            success: true,
            html: slideHTML,
            slideNumber: data.slideNumber || 0,
            type: slideContent.type
          });
          
          console.log(`✅ Slide generated for ${socket.data.user.email}`);
          
        } catch (error: any) {
          console.error('❌ Slide error:', error);
          socket.emit('slide_error', {
            message: 'فشل توليد الشريحة',
            error: error.message
          });
        }
      });
      
      // ============= MATH EVENTS =============
      
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
            type: 'math'
          });
          
          console.log('✅ Math slide generated');
          
        } catch (error: any) {
          console.error('❌ Math slide error:', error);
          socket.emit('math_slide_error', {
            message: 'فشل توليد الشريحة الرياضية'
          });
        }
      });
      
      // ============= SIMPLE CHAT =============
      
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
          totalUsers: this.connectedUsers.size
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
}

// Export singleton
export const websocketService = new WebSocketService();