// 📍 المكان: src/services/websocket/websocket.service.ts
// النسخة المحدثة الكاملة مع Orchestrator + SessionService + SlideGenerator + RealtimeChat

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { prisma } from '../../config/database.config';
import { sessionService } from './session.service';
import { EnhancedSlideGenerator } from '../../core/video/slide.generator';
import { realtimeChatService } from './realtime-chat.service';
import { setupOrchestratorEvents } from './orchestrator-events';
import { lessonOrchestrator } from '../orchestrator/lesson-orchestrator.service';
import { openAIService } from '../ai/openai.service';

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
  private userSessions: Map<string, SessionInfo> = new Map(); // تتبع الجلسات النشطة
  
  /**
   * Initialize WebSocket server with proper configuration
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: function(origin, callback) {
          // السماح لكل Origins في development
          if (config.NODE_ENV === 'development') {
            callback(null, true);
          } else {
            // في production، حدد domains معينة
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
      
      // مهم جداً: استخدم polling أولاً
      transports: ['polling', 'websocket'],
      
      // السماح بالـ upgrade
      allowUpgrades: true,
      
      // Connection settings محدثة
      pingTimeout: 120000, // 2 minutes
      pingInterval: 25000,
      connectTimeout: 45000,
      
      // Path
      path: '/socket.io/',
      
      // Allow EIO3 clients
      allowEIO3: true
    });
    
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }
        
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
        
        if (!user) {
          return next(new Error('User not found'));
        }
        
        socket.data.user = user;
        next();
        
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
    
    // Setup event handlers
    this.setupEventHandlers();
    
    console.log('✅ WebSocket server ready');
    console.log('   Transports: polling + websocket');
    console.log('   Path: /socket.io/');
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    // Initialize slideGenerator
    slideGenerator.initialize().then(() => {
      console.log('✅ Slide generator initialized');
    });
  }
  
  /**
   * Setup all socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;
    
    this.io.on('connection', async (socket: Socket) => {
      const user = socket.data.user as UserData;
      
      console.log(`\n✅ NEW CONNECTION`);
      console.log(`   👤 User: ${user.firstName} ${user.lastName}`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🔌 Socket ID: ${socket.id}`);
      console.log(`   👥 Total connected: ${this.connectedUsers.size + 1}`);
      
      // Store socket reference
      this.connectedUsers.set(user.id, socket);
      
      // Check for last active session
      const lastSession = await sessionService.getLastActiveSession(user.id);
      
      // Send welcome message with session info if exists
      socket.emit('welcome', {
        message: `أهلاً وسهلاً ${user.firstName}! 👋`,
        userId: user.id,
        socketId: socket.id,
        serverTime: new Date().toISOString(),
        lastSession: lastSession ? {
          lessonId: lastSession.lessonId,
          lessonTitle: lastSession.lesson.title,
          currentSlide: lastSession.currentSlide,
          lastActivity: lastSession.lastActivityAt
        } : null
      });
      
      // Notify others about new user
      socket.broadcast.emit('user_connected', {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        totalUsers: this.connectedUsers.size
      });
      
      // ============= ORCHESTRATOR EVENTS (NEW) =============
      
      // Setup orchestrator event handlers
      setupOrchestratorEvents(socket, user);
      
      // Additional orchestrator-specific events
      socket.on('get_lesson_structure', async (lessonId: string) => {
        try {
          // Fetch the lesson with all its fields
          const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId }
          });
          
          if (!lesson) {
            socket.emit('error', {
              code: 'LESSON_NOT_FOUND',
              message: 'الدرس غير موجود'
            });
            return;
          }
          
          // Fetch related unit and subject
          const unit = await prisma.unit.findUnique({
            where: { id: lesson.unitId },
            include: {
              subject: true
            }
          });
          
          if (!unit) {
            socket.emit('error', {
              code: 'UNIT_NOT_FOUND',
              message: 'الوحدة غير موجودة'
            });
            return;
          }
          
          // Parse content - use only fields that exist in the model
          const keyPoints = JSON.parse(lesson.keyPoints || '[]');
          
          // Note: The Lesson model doesn't have a 'content' field
          // Examples and objectives might be stored in description or summary
          let examples = [];
          let objectives = [];
          
          // Try to extract from description or summary if they contain JSON
          if (lesson.description) {
            try {
              const descData = typeof lesson.description === 'string' && 
                              lesson.description.startsWith('{') ? 
                              JSON.parse(lesson.description) : {};
              examples = descData.examples || [];
              objectives = descData.objectives || [];
            } catch (e) {
              // description is not JSON, it's plain text
            }
          }
          
          // If not found in description, try summary
          if (examples.length === 0 && lesson.summary) {
            try {
              const summaryData = typeof lesson.summary === 'string' && 
                                 lesson.summary.startsWith('{') ? 
                                 JSON.parse(lesson.summary) : {};
              examples = summaryData.examples || examples;
              objectives = summaryData.objectives || objectives;
            } catch (e) {
              // summary is not JSON, it's plain text
            }
          }
          
          // If still not found, extract from keyPoints
          if (objectives.length === 0 && keyPoints.length > 0) {
            // Use first few keyPoints as objectives
            objectives = keyPoints.slice(0, 3);
          }
          
          socket.emit('lesson_structure', {
            lessonId,
            title: lesson.title,
            subject: unit.subject.name,
            unit: unit.title,
            grade: unit.subject.grade,
            structure: {
              keyPoints: keyPoints.length,
              examples: examples.length,
              objectives: objectives.length,
              hasVideo: false, // Since videoUrl doesn't exist in the model
              estimatedDuration: Math.ceil((keyPoints.length * 5) + (examples.length * 3) + 10)
            },
            metadata: {
              createdAt: lesson.createdAt,
              updatedAt: lesson.updatedAt
            }
          });
          
        } catch (error) {
          socket.emit('error', {
            code: 'STRUCTURE_ERROR',
            message: 'فشل جلب هيكل الدرس'
          });
        }
      });
      
      socket.on('generate_smart_slide', async (data: {
        lessonId: string;
        prompt: string;
        type?: string;
      }) => {
        try {
          console.log(`🎨 Smart slide generation requested: "${data.prompt}"`);
          
          // Use AI to understand the request
          let slideContent: any = {
            title: 'شريحة مخصصة',
            text: data.prompt
          };
          
          if (process.env.OPENAI_API_KEY) {
            const aiPrompt = `
قم بإنشاء محتوى شريحة تعليمية بناء على الطلب التالي:
"${data.prompt}"

أرجع النتيجة بصيغة JSON:
{
  "type": "content|bullet|quiz",
  "title": "عنوان الشريحة",
  "content": "المحتوى" أو ["نقطة 1", "نقطة 2"] للـ bullets
}`;

            try {
              const response = await openAIService.chat([
                { role: 'user', content: aiPrompt }
              ], {
                temperature: 0.7,
                maxTokens: 300
              });
              
              const parsed = JSON.parse(response);
              slideContent = parsed.content;
            } catch (aiError) {
              console.error('AI slide generation failed:', aiError);
            }
          }
          
          // Generate HTML
          await slideGenerator.initialize();
          const slideHTML = slideGenerator.generateRealtimeSlideHTML(
            {
              id: `smart-slide-${Date.now()}`,
              type: data.type as any || 'content',
              content: slideContent,
              duration: 15,
              transitions: { in: 'fade', out: 'fade' }
            },
            'colorful'
          );
          
          socket.emit('smart_slide_ready', {
            html: slideHTML,
            content: slideContent,
            prompt: data.prompt
          });
          
        } catch (error) {
          socket.emit('slide_generation_error', {
            message: 'فشل توليد الشريحة الذكية'
          });
        }
      });
      
      socket.on('get_flow_state', async (lessonId: string) => {
        // Get current orchestrator flow state
        const flowKey = `${user.id}-${lessonId}`;
        // This would need to be exposed from orchestrator
        
        socket.emit('flow_state', {
          lessonId,
          hasActiveFlow: false, // Check if exists
          currentSection: null,
          currentSlide: null
        });
      });
      
      // ============= LESSON EVENTS =============
      
      socket.on('join_lesson', async (lessonId: string) => {
        try {
          console.log(`📚 ${user.email} joining lesson: ${lessonId}`);
          
          // Verify lesson exists
          const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            select: { 
              id: true, 
              title: true,
              unit: {
                select: {
                  title: true,
                  subject: {
                    select: { name: true }
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
          
          // Create or restore session
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
          
          console.log(`📝 Session ${session.isActive ? 'restored' : 'created'}: ${session.id}`);
          
          // Leave other lesson rooms
          const rooms = Array.from(socket.rooms);
          rooms.forEach(room => {
            if (room.startsWith('lesson:') && room !== socket.id) {
              socket.leave(room);
            }
          });
          
          // Join new lesson room
          const roomName = `lesson:${lessonId}`;
          socket.join(roomName);
          
          // Track room membership
          if (!this.rooms.has(lessonId)) {
            this.rooms.set(lessonId, new Set());
          }
          this.rooms.get(lessonId)!.add(user.id);
          
          // Get participants
          const participants = Array.from(this.rooms.get(lessonId)!);
          
          // Send success response with session data
          socket.emit('joined_lesson', {
            lessonId,
            lessonTitle: lesson.title,
            unitTitle: lesson.unit.title,
            subjectName: lesson.unit.subject.name,
            participants: participants.length,
            participantIds: participants,
            session: {
              id: session.id,
              currentSlide: session.currentSlide,
              totalSlides: session.totalSlides,
              chatHistory: JSON.parse(session.chatHistory || '[]'),
              slideHistory: JSON.parse(session.slideHistory || '[]'),
              isResumed: session.lastActivityAt > new Date(Date.now() - 60 * 60 * 1000)
            }
          });
          
          // Notify others in room
          socket.to(roomName).emit('user_joined_lesson', {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            participants: participants.length
          });
          
          console.log(`   ✅ Joined successfully. Room size: ${participants.length}`);
          
        } catch (error: any) {
          console.error('Error joining lesson:', error);
          socket.emit('error', { 
            code: 'JOIN_FAILED',
            message: 'فشل الانضمام للدرس' 
          });
        }
      });
      
      socket.on('leave_lesson', async (lessonId: string) => {
        const roomName = `lesson:${lessonId}`;
        socket.leave(roomName);
        
        // End session if exists
        const sessionInfo = this.userSessions.get(user.id);
        if (sessionInfo && sessionInfo.lessonId === lessonId) {
          await sessionService.endSession(sessionInfo.sessionId);
          this.userSessions.delete(user.id);
          console.log(`📝 Session ended: ${sessionInfo.sessionId}`);
        }
        
        // Update tracking
        if (this.rooms.has(lessonId)) {
          this.rooms.get(lessonId)!.delete(user.id);
          
          const remaining = this.rooms.get(lessonId)!.size;
          
          // Notify others
          socket.to(roomName).emit('user_left_lesson', {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            participants: remaining
          });
          
          // Clean up empty rooms
          if (remaining === 0) {
            this.rooms.delete(lessonId);
          }
          
          console.log(`📤 ${user.email} left lesson: ${lessonId}`);
        }
        
        socket.emit('left_lesson', { lessonId });
      });
      
      // ============= SLIDE EVENTS =============
      
      socket.on('request_slide', async (data: {
        lessonId?: string;
        slideNumber: number;
        type: 'title' | 'content' | 'bullet' | 'quiz' | 'summary' | 'image';
        content: any;
        theme?: string;
      }) => {
        try {
          console.log(`🖼️ Generating slide ${data.slideNumber} for ${user.email}`);
          
          // Generate HTML
          await slideGenerator.initialize();
          const slideHTML = slideGenerator.generateRealtimeSlideHTML(
            {
              id: `slide-${data.slideNumber}`,
              type: data.type,
              content: data.content,
              duration: 10,
              transitions: { in: 'fade', out: 'fade' }
            },
            (data.theme as any) || 'default'
          );
          
          // Send back to user
          socket.emit('slide_ready', {
            slideNumber: data.slideNumber,
            html: slideHTML,
            type: data.type,
            timestamp: new Date().toISOString()
          });
          
          // Update session if lesson exists
          if (data.lessonId) {
            const sessionInfo = this.userSessions.get(user.id);
            if (sessionInfo && sessionInfo.lessonId === data.lessonId) {
              await sessionService.updateSlidePosition(
                sessionInfo.sessionId, 
                data.slideNumber
              );
              
              // Notify others in lesson room (optional)
              const roomName = `lesson:${data.lessonId}`;
              socket.to(roomName).emit('user_slide_generated', {
                userId: user.id,
                userName: `${user.firstName} ${user.lastName}`,
                slideNumber: data.slideNumber,
                slideType: data.type
              });
            }
          }
          
          console.log(`   ✅ Slide generated and sent`);
          
        } catch (error: any) {
          console.error('Error generating slide:', error);
          socket.emit('slide_error', {
            message: 'فشل توليد الشريحة',
            error: error.message
          });
        }
      });
      
      socket.on('navigate_slide', async (data: {
        direction: 'next' | 'previous' | 'goto';
        slideNumber?: number;
      }) => {
        const sessionInfo = this.userSessions.get(user.id);
        if (!sessionInfo) {
          socket.emit('error', { 
            code: 'NO_SESSION',
            message: 'لا توجد جلسة نشطة' 
          });
          return;
        }
        
        // Get current session
        const session = await sessionService.getSessionByUserAndLesson(
          user.id,
          sessionInfo.lessonId
        );
        
        if (!session) return;
        
        let newSlideNumber = session.currentSlide;
        
        switch (data.direction) {
          case 'next':
            newSlideNumber = Math.min(session.currentSlide + 1, session.totalSlides - 1);
            break;
          case 'previous':
            newSlideNumber = Math.max(session.currentSlide - 1, 0);
            break;
          case 'goto':
            if (data.slideNumber !== undefined) {
              newSlideNumber = Math.max(0, Math.min(data.slideNumber, session.totalSlides - 1));
            }
            break;
        }
        
        // Update position
        const updated = await sessionService.updateSlidePosition(
          sessionInfo.sessionId,
          newSlideNumber
        );
        
        if (updated) {
          socket.emit('navigation_complete', {
            currentSlide: newSlideNumber,
            totalSlides: session.totalSlides
          });
        }
      });
      
      // ============= SESSION EVENTS =============
      
      socket.on('update_slide', async (data: { slideNumber: number; totalSlides?: number }) => {
        const sessionInfo = this.userSessions.get(user.id);
        if (!sessionInfo) {
          socket.emit('error', { 
            code: 'NO_SESSION',
            message: 'لا توجد جلسة نشطة' 
          });
          return;
        }
        
        // Update slide position
        const updated = await sessionService.updateSlidePosition(
          sessionInfo.sessionId,
          data.slideNumber,
          data.totalSlides
        );
        
        if (updated) {
          socket.emit('slide_updated', {
            currentSlide: updated.currentSlide,
            totalSlides: updated.totalSlides
          });
          
          // Notify others in room (optional)
          const roomName = `lesson:${sessionInfo.lessonId}`;
          socket.to(roomName).emit('user_slide_change', {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            slideNumber: data.slideNumber
          });
        }
      });
      
      socket.on('save_preferences', async (preferences: any) => {
        const sessionInfo = this.userSessions.get(user.id);
        if (!sessionInfo) return;
        
        await prisma.learningSession.update({
          where: { id: sessionInfo.sessionId },
          data: {
            userPreferences: JSON.stringify(preferences),
            lastActivityAt: new Date()
          }
        });
        
        socket.emit('preferences_saved', preferences);
      });
      
      // ============= CHAT EVENTS =============
      
      socket.on('send_message', async (data: { lessonId?: string; message: string }) => {
        const { lessonId, message } = data;
        
        const messageData = {
          id: Date.now().toString(),
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          message,
          timestamp: new Date().toISOString()
        };
        
        // Save to session if exists
        const sessionInfo = this.userSessions.get(user.id);
        if (sessionInfo && sessionInfo.lessonId === lessonId) {
          await sessionService.addChatMessage(sessionInfo.sessionId, messageData);
        }
        
        if (lessonId) {
          // Send to lesson room
          this.io!.to(`lesson:${lessonId}`).emit('new_message', messageData);
        } else {
          // Broadcast to all
          this.io!.emit('new_message', messageData);
        }
        
        console.log(`💬 Message from ${user.email}: ${message.substring(0, 50)}...`);
      });
      
      // ============= AI CHAT EVENTS =============
      
      socket.on('chat_message', async (data: {
        lessonId: string;
        message: string;
        streamMode?: boolean;
      }) => {
        const { lessonId, message, streamMode } = data;
        
        console.log(`🤖 AI Chat request from ${user.email}: "${message.substring(0, 50)}..."`);
        
        // Check if message might trigger an action (integration with orchestrator)
        if (!streamMode) {
          const action = await lessonOrchestrator.processUserMessage(
            user.id,
            lessonId,
            message
          );
          
          if (action && action.confidence > 0.7) {
            // Notify user about action
            socket.emit('action_triggered', {
              action: action.action,
              trigger: action.trigger,
              fromChat: true
            });
          }
        }
        
        if (streamMode) {
          // Streaming mode للرسائل الطويلة
          await realtimeChatService.streamResponse(
            user.id,
            lessonId,
            message
          );
        } else {
          // Normal mode
          await realtimeChatService.handleUserMessage(
            user.id,
            lessonId,
            message,
            socket.id
          );
        }
      });
      
      socket.on('get_chat_history', async (lessonId: string) => {
        try {
          const history = await prisma.chatMessage.findMany({
            where: {
              userId: user.id,
              lessonId
            },
            orderBy: {
              createdAt: 'asc'
            },
            take: 50
          });
          
          socket.emit('chat_history', {
            lessonId,
            messages: history.map(msg => ({
              userMessage: msg.userMessage,
              aiResponse: msg.aiResponse,
              timestamp: msg.createdAt,
              rating: msg.rating
            }))
          });
          
          console.log(`📜 Sent ${history.length} chat messages to ${user.email}`);
          
        } catch (error) {
          socket.emit('error', {
            code: 'HISTORY_ERROR',
            message: 'فشل جلب المحادثات'
          });
        }
      });
      
      socket.on('rate_message', async (data: {
        messageId: string;
        rating: number;
        feedback?: string;
      }) => {
        try {
          await prisma.chatMessage.update({
            where: { id: data.messageId },
            data: {
              rating: data.rating,
              feedback: data.feedback
            }
          });
          
          socket.emit('rating_saved', {
            messageId: data.messageId,
            rating: data.rating
          });
          
          console.log(`⭐ Message rated ${data.rating}/5 by ${user.email}`);
          
        } catch (error) {
          console.error('Error saving rating:', error);
        }
      });
      
      socket.on('clear_chat', async (lessonId: string) => {
        try {
          const result = await prisma.chatMessage.deleteMany({
            where: {
              userId: user.id,
              lessonId
            }
          });
          
          socket.emit('chat_cleared', { 
            lessonId,
            deletedCount: result.count
          });
          
          console.log(`🗑️ Cleared ${result.count} messages for ${user.email}`);
          
        } catch (error) {
          socket.emit('error', {
            code: 'CLEAR_ERROR',
            message: 'فشل مسح المحادثات'
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
        const sessionInfo = this.userSessions.get(user.id);
        socket.emit('status', {
          connected: true,
          userId: user.id,
          socketId: socket.id,
          rooms: Array.from(socket.rooms),
          totalUsers: this.connectedUsers.size,
          hasActiveSession: !!sessionInfo,
          sessionInfo: sessionInfo || null
        });
      });
      
      // ============= DISCONNECTION =============
      
      socket.on('disconnect', async (reason) => {
        console.log(`\n❌ DISCONNECTION`);
        console.log(`   👤 User: ${user.email}`);
        console.log(`   📊 Reason: ${reason}`);
        console.log(`   👥 Remaining users: ${this.connectedUsers.size - 1}`);
        
        // Don't end session on disconnect - allow resume
        const sessionInfo = this.userSessions.get(user.id);
        if (sessionInfo) {
          // Just update last activity
          await prisma.learningSession.update({
            where: { id: sessionInfo.sessionId },
            data: { 
              lastActivityAt: new Date(),
              socketId: null // Clear socket ID
            }
          });
          console.log(`📝 Session preserved for resume: ${sessionInfo.sessionId}`);
        }
        
        // Remove from connected users
        this.connectedUsers.delete(user.id);
        this.userSessions.delete(user.id);
        
        // Remove from all rooms
        this.rooms.forEach((users, lessonId) => {
          if (users.has(user.id)) {
            users.delete(user.id);
            
            // Notify others in room
            this.io!.to(`lesson:${lessonId}`).emit('user_left_lesson', {
              userId: user.id,
              userName: `${user.firstName} ${user.lastName}`,
              participants: users.size
            });
            
            // Clean up empty rooms
            if (users.size === 0) {
              this.rooms.delete(lessonId);
            }
          }
        });
        
        // Notify all users
        socket.broadcast.emit('user_disconnected', {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          totalUsers: this.connectedUsers.size
        });
      });
      
      // Error handler
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${user.email}:`, error);
      });
    });
  }
  
  /**
   * Start cleanup interval for inactive sessions
   */
  private startCleanupInterval(): void {
    // Clean up inactive sessions every hour
    setInterval(async () => {
      const count = await sessionService.cleanupInactiveSessions();
      if (count > 0) {
        console.log(`🧹 Cleaned up ${count} inactive sessions`);
      }
    }, 60 * 60 * 1000); // Every hour
    
    // Update activity for active sessions every 5 minutes
    setInterval(async () => {
      for (const [userId, sessionInfo] of this.userSessions) {
        await prisma.learningSession.update({
          where: { id: sessionInfo.sessionId },
          data: { lastActivityAt: new Date() }
        });
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }
  
  // ============= PUBLIC METHODS =============
  
  /**
   * Send message to specific user
   */
  sendToUser(userId: string, event: string, data: any): boolean {
    const socket = this.connectedUsers.get(userId);
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }
  
  /**
   * Send message to all users in a lesson
   */
  sendToLesson(lessonId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`lesson:${lessonId}`).emit(event, data);
    }
  }
  
  /**
   * Broadcast to all connected users
   */
  broadcast(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }
  
  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }
  
  /**
   * Get lesson participants
   */
  getLessonParticipants(lessonId: string): string[] {
    return Array.from(this.rooms.get(lessonId) || []);
  }
  
  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
  
  /**
   * Get user's active session
   */
  getUserSession(userId: string): SessionInfo | undefined {
    return this.userSessions.get(userId);
  }
  
  /**
   * Get IO instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
  
  /**
   * Send orchestrated content to user (NEW)
   */
  sendOrchestratedContent(
    userId: string,
    eventName: string,
    data: any
  ): boolean {
    return this.sendToUser(userId, eventName, data);
  }
  
  /**
   * Broadcast orchestrator updates to lesson (NEW)
   */
  broadcastOrchestratorUpdate(
    lessonId: string,
    update: any
  ): void {
    this.sendToLesson(lessonId, 'orchestrator_update', update);
  }
  
  /**
   * Get active flow for user (NEW)
   */
  async getActiveFlow(userId: string, lessonId: string): Promise<any> {
    // This would interact with orchestrator to get flow state
    return null;
  }
  
  /**
   * Send action result to user (NEW)
   */
  sendActionResult(
    userId: string,
    action: string,
    result: any
  ): void {
    this.sendToUser(userId, 'action_result', {
      action,
      result,
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton
export const websocketService = new WebSocketService();