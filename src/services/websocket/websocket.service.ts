// 📍 المكان: src/services/websocket/websocket.service.ts
// النسخة المحدثة الكاملة مع إصلاح جميع المشاكل

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
      
      transports: ['polling', 'websocket'],
      allowUpgrades: true,
      
      // Connection settings
      pingTimeout: 120000,
      pingInterval: 25000,
      connectTimeout: 45000,
      
      path: '/socket.io/',
      allowEIO3: true
    });
    
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        // Development mode - use test user
        if (config.NODE_ENV === 'development') {
          const realUser = await prisma.user.findFirst({
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
          
          if (realUser) {
            console.log(`✅ Using real user from DB: ${realUser.email} (ID: ${realUser.id})`);
            socket.data.user = realUser;
            return next();
          } else {
            // Create test user if not exists
            console.log('⚠️ No test users found, creating dev@test.com...');
            
            const newUser = await prisma.user.create({
              data: {
                email: 'dev@test.com',
                password: '$2b$10$dummy',
                firstName: 'Dev',
                lastName: 'User',
                role: 'STUDENT',
                grade: 6,
                isActive: true,
                emailVerified: true
              }
            });
            
            console.log(`✅ Created new user: ${newUser.email} (ID: ${newUser.id})`);
            socket.data.user = {
              id: newUser.id,
              email: newUser.email,
              firstName: newUser.firstName,
              lastName: newUser.lastName,
              role: newUser.role,
              grade: newUser.grade
            };
            return next();
          }
        }
        
        // Production authentication
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
        console.error('Authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
    
    // Setup event handlers
    this.setupEventHandlers();
    
    console.log('✅ WebSocket server ready');
    console.log('   Transports: polling + websocket');
    console.log('   Path: /socket.io/');
    console.log('   🧮 Math components: ENABLED');
    console.log('   📚 Dynamic lessons: ENABLED');
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    // Initialize slideGenerator
    slideGenerator.initialize().then(() => {
      console.log('✅ Slide generator initialized');
      console.log('✅ Math slide generator ready');
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
        userGrade: user.grade,
        features: {
          math: true,
          interactive: true,
          voice: false,
          dynamicLessons: true
        },
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
      
      // ============= ORCHESTRATOR EVENTS =============
      
      // Setup orchestrator event handlers
      setupOrchestratorEvents(socket, user);
      
      // Additional orchestrator-specific events
      socket.on('get_lesson_structure', async (lessonId: string) => {
        try {
          // Verify lesson exists first
          const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
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
          
          // Check if it's a math lesson
          const isMathLesson = lesson.unit.subject.name.includes('رياضيات') || 
                               lesson.unit.subject.name.toLowerCase().includes('math');
          
          // Parse content safely
          const keyPoints = lesson.keyPoints ? JSON.parse(lesson.keyPoints) : [];
          
          // Extract objectives and examples from summary or description if available
          let objectives: string[] = [];
          let examples: string[] = [];
          
          if (lesson.summary) {
            try {
              const summaryData = typeof lesson.summary === 'string' && 
                                 lesson.summary.startsWith('{') ? 
                                 JSON.parse(lesson.summary) : {};
              objectives = summaryData.objectives || objectives;
              examples = summaryData.examples || examples;
            } catch (e) {
              // Not JSON, use as is
            }
          }
          
          // Use keyPoints as objectives if none found
          if (objectives.length === 0 && keyPoints.length > 0) {
            objectives = keyPoints.slice(0, 3);
          }
          
          socket.emit('lesson_structure', {
            lessonId,
            title: lesson.title,
            subject: lesson.unit.subject.name,
            unit: lesson.unit.title,
            grade: lesson.unit.subject.grade,
            isMathLesson,
            structure: {
              keyPoints: keyPoints.length,
              examples: examples.length,
              objectives: objectives.length,
              hasVideo: false,
              hasInteractiveComponents: isMathLesson,
              estimatedDuration: lesson.estimatedMinutes || 30
            },
            metadata: {
              createdAt: lesson.createdAt,
              updatedAt: lesson.updatedAt
            }
          });
          
        } catch (error) {
          console.error('Error getting lesson structure:', error);
          socket.emit('error', {
            code: 'STRUCTURE_ERROR',
            message: 'فشل جلب هيكل الدرس'
          });
        }
      });
      
      // ============= DYNAMIC LESSONS LOADING =============
      
      /**
       * Get available lessons with proper filtering
       */
      socket.on('get_available_lessons', async (options?: {
        grade?: number;
        subjectId?: string;
        search?: string;
        limit?: number;
      }) => {
        try {
          console.log(`📚 Fetching available lessons for ${user.email}`);
          
          // Build query filters
          const where: any = {};
          
          // Always show published lessons only
          where.isPublished = true;
          
          // Filter by subject if specified
          if (options?.subjectId) {
            where.unit = {
              subjectId: options.subjectId
            };
          }
          
          // Filter by grade if specified
          if (options?.grade) {
            where.unit = {
              ...where.unit,
              subject: {
                grade: options.grade
              }
            };
          }
          
          // Search filter
          if (options?.search) {
            where.OR = [
              { title: { contains: options.search } },
              { titleAr: { contains: options.search } },
              { description: { contains: options.search } }
            ];
          }
          
          console.log('   Query filters:', JSON.stringify(where, null, 2));
          
          // Fetch lessons
          const lessons = await prisma.lesson.findMany({
            where,
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
            orderBy: [
              { unit: { subject: { grade: 'asc' } } },
              { unit: { order: 'asc' } },
              { order: 'asc' }
            ]
          });
          
          console.log(`   📊 Found ${lessons.length} lessons`);
          
          // Format lessons for client
          const formattedLessons = lessons.map(lesson => ({
            id: lesson.id,
            title: lesson.titleAr || lesson.title,
            titleEn: lesson.title,
            description: lesson.description,
            difficulty: lesson.difficulty,
            estimatedMinutes: lesson.estimatedMinutes || 30,
            subject: lesson.unit.subject.nameAr || lesson.unit.subject.name,
            subjectIcon: lesson.unit.subject.icon,
            unit: lesson.unit.title,
            grade: lesson.unit.subject.grade,
            isMath: lesson.unit.subject.name.includes('رياضيات') || 
                   lesson.unit.subject.name.toLowerCase().includes('math')
          }));
          
          socket.emit('available_lessons', {
            lessons: formattedLessons,
            total: formattedLessons.length,
            grade: options?.grade || 'all',
            filters: {
              grade: options?.grade,
              subjectId: options?.subjectId,
              search: options?.search
            },
            message: formattedLessons.length === 0 ? 
              'لا توجد دروس متاحة حالياً' :
              `تم تحميل ${formattedLessons.length} درس`
          });
          
          console.log(`   ✅ Sent ${formattedLessons.length} lessons`);
          
        } catch (error) {
          console.error('❌ Error fetching lessons:', error);
          socket.emit('available_lessons', {
            lessons: [],
            total: 0,
            error: 'فشل تحميل الدروس'
          });
        }
      });
      
      /**
       * Get available subjects
       */
      socket.on('get_available_subjects', async (grade?: number) => {
        try {
          const targetGrade = grade || user.grade || 6;
          
          const subjects = await prisma.subject.findMany({
            where: {
              grade: targetGrade,
              isActive: true
            },
            select: {
              id: true,
              name: true,
              nameAr: true,
              icon: true,
              description: true,
              _count: {
                select: { units: true }
              }
            },
            orderBy: { order: 'asc' }
          });
          
          socket.emit('available_subjects', {
            subjects: subjects.map(s => ({
              id: s.id,
              name: s.nameAr || s.name,
              nameEn: s.name,
              icon: s.icon,
              description: s.description,
              unitsCount: s._count.units
            })),
            grade: targetGrade
          });
          
          console.log(`   ✅ Sent ${subjects.length} subjects for grade ${targetGrade}`);
          
        } catch (error) {
          console.error('Error fetching subjects:', error);
          socket.emit('available_subjects', {
            subjects: [],
            error: 'فشل تحميل المواد'
          });
        }
      });
      
      /**
       * Search lessons
       */
      socket.on('search_lessons', async (query: string) => {
        try {
          if (!query || query.length < 2) {
            socket.emit('search_results', {
              lessons: [],
              query
            });
            return;
          }
          
          const lessons = await prisma.lesson.findMany({
            where: {
              isPublished: true,
              OR: [
                { title: { contains: query } },
                { titleAr: { contains: query } },
                { description: { contains: query } },
                { summary: { contains: query } }
              ]
            },
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
                      grade: true 
                    }
                  }
                }
              }
            },
            take: 20
          });
          
          socket.emit('search_results', {
            lessons: lessons.map(l => ({
              id: l.id,
              title: l.titleAr || l.title,
              subject: l.unit.subject.name,
              unit: l.unit.title,
              grade: l.unit.subject.grade
            })),
            query,
            count: lessons.length
          });
          
          console.log(`   🔍 Found ${lessons.length} lessons for "${query}"`);
          
        } catch (error) {
          console.error('Search error:', error);
          socket.emit('search_results', {
            lessons: [],
            query,
            error: 'فشل البحث'
          });
        }
      });
      
      // ============= MATH-SPECIFIC EVENTS (FIXED) =============
      
      /**
       * Request math slide - WITH PROPER VALIDATION
       */
      socket.on('request_math_slide', async (data?: {
        lessonId?: string;
        slideNumber?: number;
        type?: string;
        mathContent?: {
          title?: string;
          subtitle?: string;
          expressions?: MathExpression[];
          layout?: 'single' | 'grid' | 'vertical';
          interactive?: boolean;
          showSteps?: boolean;
        };
        content?: any; // Legacy support
        theme?: string;
      }) => {
        try {
          console.log(`🧮 Math slide requested by ${user.email}`);
          
          // ✅ VALIDATION - Check if data exists
          if (!data) {
            data = { type: 'interactive' };
          }
          
          // ✅ Ensure we have content
          const content = data.mathContent || data.content || {};
          const title = content.title || 'معادلة رياضية تفاعلية';
          const subtitle = content.subtitle;
          
          // ✅ Default expressions if none provided
          let expressions = content.expressions || [];
          if (expressions.length === 0) {
            // Use default quadratic expression
            expressions = [latexRenderer.getCommonExpressions().quadratic];
          }
          
          // ✅ Determine slide type
          const slideType = data.type || 'interactive';
          
          // Generate appropriate slide based on type
          let slideHTML = '';
          
          if (slideType === 'interactive' || slideType === 'equation') {
            // Interactive math slide
            slideHTML = await mathSlideGenerator.generateMathSlide(
              {
                title,
                subtitle,
                mathExpressions: expressions,
                showSteps: content.showSteps !== false,
                interactive: content.interactive !== false,
                mathLayout: content.layout || 'single'
              },
              (data.theme as any) || 'default',
              {
                enableInteractivity: true,
                showSolveButton: true,
                autoPlaySteps: false
              }
            );
          } else if (slideType === 'problem') {
            // Math problem slide
            slideHTML = await mathSlideGenerator.generateMathProblemSlide(
              {
                title,
                question: content.problem || 'حل المعادلة التالية',
                equation: content.equation,
                hints: content.hints || ['فكر في القانون العام'],
                solution: content.solution
              },
              (data.theme as any) || 'default'
            );
          } else if (slideType === 'comparison') {
            // Comparison slide
            const equations = content.equations || [
              {
                title: 'معادلة خطية',
                latex: '2x + 3 = 7',
                description: 'معادلة من الدرجة الأولى',
                color: '#667eea'
              },
              {
                title: 'معادلة تربيعية',
                latex: 'x^2 - 4x + 3 = 0',
                description: 'معادلة من الدرجة الثانية',
                color: '#48bb78'
              }
            ];
            slideHTML = await mathSlideGenerator.generateComparisonSlide(
              equations,
              (data.theme as any) || 'default'
            );
          } else {
            // Default interactive slide
            slideHTML = await mathSlideGenerator.generateMathSlide(
              {
                title,
                mathExpressions: [latexRenderer.getCommonExpressions().quadratic],
                interactive: true,
                showSteps: true
              },
              'default'
            );
          }
          
          // Send response
          socket.emit('math_slide_ready', {
            slideNumber: data.slideNumber || 0,
            html: slideHTML,
            type: slideType,
            lessonId: data.lessonId,
            timestamp: new Date().toISOString()
          });
          
          // Update session if lesson exists
          if (data.lessonId) {
            const sessionInfo = this.userSessions.get(user.id);
            if (sessionInfo && sessionInfo.lessonId === data.lessonId && data.slideNumber !== undefined) {
              await sessionService.updateSlidePosition(
                sessionInfo.sessionId, 
                data.slideNumber
              );
              
              // Notify others in lesson room
              const roomName = `lesson:${data.lessonId}`;
              socket.to(roomName).emit('user_generated_math_slide', {
                userId: user.id,
                userName: `${user.firstName} ${user.lastName}`,
                slideNumber: data.slideNumber
              });
            }
          }
          
          console.log(`   ✅ Math slide generated successfully (${slideType})`);
          
        } catch (error: any) {
          console.error('Error generating math slide:', error);
          socket.emit('math_slide_error', {
            message: 'فشل توليد الشريحة الرياضية',
            error: error.message
          });
        }
      });
      
      /**
       * Request math problem slide
       */
      socket.on('request_math_problem_slide', async (data: {
        lessonId?: string;
        slideNumber?: number;
        problem: {
          title: string;
          question: string;
          equation?: string;
          hints?: string[];
          solution?: string;
          steps?: any[];
        };
        theme?: string;
      }) => {
        try {
          console.log(`📝 Math problem slide requested: "${data.problem.title}"`);
          
          const slideHTML = await mathSlideGenerator.generateMathProblemSlide(
            data.problem,
            (data.theme as any) || 'default'
          );
          
          socket.emit('math_problem_slide_ready', {
            slideNumber: data.slideNumber || 0,
            html: slideHTML,
            problemTitle: data.problem.title,
            timestamp: new Date().toISOString()
          });
          
          console.log(`   ✅ Problem slide generated`);
          
        } catch (error: any) {
          console.error('Error generating problem slide:', error);
          socket.emit('math_slide_error', {
            message: 'فشل توليد شريحة المسألة',
            error: error.message
          });
        }
      });
      
      /**
       * Request equation comparison
       */
      socket.on('request_equation_comparison', async (data: {
        lessonId?: string;
        equations: Array<{
          title: string;
          latex: string;
          description: string;
          color?: string;
        }>;
        theme?: string;
      }) => {
        try {
          console.log(`📊 Equation comparison requested`);
          
          const slideHTML = await mathSlideGenerator.generateComparisonSlide(
            data.equations,
            (data.theme as any) || 'default'
          );
          
          socket.emit('comparison_slide_ready', {
            html: slideHTML,
            equationCount: data.equations.length,
            timestamp: new Date().toISOString()
          });
          
          console.log(`   ✅ Comparison slide generated with ${data.equations.length} equations`);
          
        } catch (error: any) {
          console.error('Error generating comparison slide:', error);
          socket.emit('math_slide_error', {
            message: 'فشل توليد شريحة المقارنة',
            error: error.message
          });
        }
      });
      
      /**
       * Update equation variable
       */
      socket.on('update_equation_variable', async (data: {
        lessonId?: string;
        equationId: string;
        variable: string;
        value: number;
      }) => {
        console.log(`🔧 Variable update: ${data.variable} = ${data.value}`);
        
        if (data.lessonId) {
          const roomName = `lesson:${data.lessonId}`;
          socket.to(roomName).emit('variable_updated', {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            equationId: data.equationId,
            variable: data.variable,
            value: data.value
          });
        }
        
        socket.emit('variable_update_confirmed', data);
      });
      
      /**
       * Solve equation
       */
      socket.on('solve_equation', async (data: {
        lessonId?: string;
        equation: string;
        variables?: Record<string, number>;
      }) => {
        try {
          console.log(`🧮 Solving equation: ${data.equation}`);
          
          // Use AI to solve if available
          if (process.env.OPENAI_API_KEY) {
            const prompt = `
حل المعادلة التالية خطوة بخطوة:
${data.equation}

${data.variables ? `مع القيم: ${JSON.stringify(data.variables)}` : ''}

أرجع الحل بصيغة JSON:
{
  "steps": [
    {"stepNumber": 1, "latex": "...", "explanation": "..."},
    {"stepNumber": 2, "latex": "...", "explanation": "..."}
  ],
  "solution": "الحل النهائي",
  "result": "القيمة أو القيم"
}`;
            
            const response = await openAIService.chat([
              { role: 'user', content: prompt }
            ], {
              temperature: 0.3,
              maxTokens: 500
            });
            
            try {
              const solution = JSON.parse(response);
              socket.emit('equation_solved', {
                equation: data.equation,
                solution,
                timestamp: new Date().toISOString()
              });
            } catch {
              socket.emit('equation_solved', {
                equation: data.equation,
                solution: { steps: [], solution: response, result: null },
                timestamp: new Date().toISOString()
              });
            }
          } else {
            // Fallback solution
            socket.emit('equation_solved', {
              equation: data.equation,
              solution: {
                steps: [
                  { stepNumber: 1, latex: data.equation, explanation: 'المعادلة الأصلية' }
                ],
                solution: 'يتطلب حل هذه المعادلة استخدام الذكاء الاصطناعي',
                result: null
              },
              timestamp: new Date().toISOString()
            });
          }
          
        } catch (error: any) {
          console.error('Error solving equation:', error);
          socket.emit('solve_error', {
            message: 'فشل حل المعادلة',
            error: error.message
          });
        }
      });
      
      /**
       * Get common equations
       */
      socket.on('get_common_equations', async (data?: {
        subject?: 'algebra' | 'geometry' | 'trigonometry' | 'calculus';
        grade?: number;
      }) => {
        console.log(`📚 Common equations requested for ${data?.subject || 'all'}`);
        
        const commonExpressions = latexRenderer.getCommonExpressions();
        
        socket.emit('common_equations', {
          equations: commonExpressions,
          count: Object.keys(commonExpressions).length,
          subject: data?.subject
        });
      });
      
      // ============= LESSON EVENTS =============
      
      socket.on('join_lesson', async (lessonId: string) => {
        try {
          console.log(`📚 ${user.email} joining lesson: ${lessonId}`);
          
          // ✅ Verify lesson exists FIRST
          const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            select: { 
              id: true, 
              title: true,
              unit: {
                select: {
                  title: true,
                  subject: {
                    select: { 
                      name: true,
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
              message: `الدرس غير موجود: ${lessonId}`,
              lessonId
            });
            return;
          }
          
          console.log(`   ✅ Lesson found: ${lesson.title}`);
          
          // Check if it's a math lesson
          const isMathLesson = lesson.unit.subject.name.includes('رياضيات') || 
                               lesson.unit.subject.name.toLowerCase().includes('math');
          
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
          
          const participants = Array.from(this.rooms.get(lessonId)!);
          
          // Send success response
          socket.emit('joined_lesson', {
            lessonId,
            lessonTitle: lesson.title,
            unitTitle: lesson.unit.title,
            subjectName: lesson.unit.subject.name,
            grade: lesson.unit.subject.grade,
            isMathLesson,
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
          
          // Notify others
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
            message: 'فشل الانضمام للدرس',
            error: error.message
          });
        }
      });
      
      socket.on('leave_lesson', async (lessonId: string) => {
        const roomName = `lesson:${lessonId}`;
        socket.leave(roomName);
        
        const sessionInfo = this.userSessions.get(user.id);
        if (sessionInfo && sessionInfo.lessonId === lessonId) {
          await sessionService.endSession(sessionInfo.sessionId);
          this.userSessions.delete(user.id);
          console.log(`📝 Session ended: ${sessionInfo.sessionId}`);
        }
        
        if (this.rooms.has(lessonId)) {
          this.rooms.get(lessonId)!.delete(user.id);
          
          const remaining = this.rooms.get(lessonId)!.size;
          
          socket.to(roomName).emit('user_left_lesson', {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            participants: remaining
          });
          
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
          
          socket.emit('slide_ready', {
            slideNumber: data.slideNumber,
            html: slideHTML,
            type: data.type,
            timestamp: new Date().toISOString()
          });
          
          if (data.lessonId) {
            const sessionInfo = this.userSessions.get(user.id);
            if (sessionInfo && sessionInfo.lessonId === data.lessonId) {
              await sessionService.updateSlidePosition(
                sessionInfo.sessionId, 
                data.slideNumber
              );
              
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
      
      // ============= CHAT EVENTS =============
      
      socket.on('chat_message', async (data: {
        lessonId: string;
        message: string;
        streamMode?: boolean;
      }) => {
        const { lessonId, message, streamMode } = data;
        
        console.log(`🤖 AI Chat request from ${user.email}: "${message.substring(0, 50)}..."`);
        
        // ✅ Verify lesson exists first
        const lesson = await prisma.lesson.findUnique({
          where: { id: lessonId },
          select: { id: true }
        });
        
        if (!lesson) {
          socket.emit('error', {
            code: 'LESSON_NOT_FOUND',
            message: 'الدرس غير موجود'
          });
          return;
        }
        
        const isMathQuestion = message.includes('معادلة') || 
                              message.includes('احسب') ||
                              message.includes('حل') ||
                              message.includes('رياضي');
        
        if (isMathQuestion && process.env.OPENAI_API_KEY) {
          console.log('   🧮 Math question detected');
          
          const aiPrompt = `
أجب على السؤال الرياضي التالي:
"${message}"

قدم الإجابة بشكل واضح مع الخطوات إذا لزم الأمر.
إذا كان السؤال يتضمن معادلة، اكتبها بصيغة LaTeX.`;
          
          try {
            const response = await openAIService.chat([
              { role: 'user', content: aiPrompt }
            ], {
              temperature: 0.3,
              maxTokens: 500
            });
            
            socket.emit('ai_response', {
              lessonId,
              message: response,
              isMathResponse: true,
              timestamp: new Date().toISOString()
            });
            
            socket.emit('math_slide_offer', {
              message: 'هل تريد شريحة تفاعلية لهذه المعادلة؟',
              lessonId
            });
            
          } catch (error) {
            console.error('Math AI response failed:', error);
          }
        } else {
          // Normal chat flow
          if (!streamMode) {
            const action = await lessonOrchestrator.processUserMessage(
              user.id,
              lessonId,
              message
            );
            
            if (action && action.confidence > 0.7) {
              socket.emit('action_triggered', {
                action: action.action,
                trigger: action.trigger,
                fromChat: true
              });
            }
          }
          
          if (streamMode) {
            await realtimeChatService.streamResponse(
              user.id,
              lessonId,
              message
            );
          } else {
            await realtimeChatService.handleUserMessage(
              user.id,
              lessonId,
              message,
              socket.id
            );
          }
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
          sessionInfo: sessionInfo || null,
          features: {
            math: true,
            interactive: true,
            voice: false,
            dynamicLessons: true
          }
        });
      });
      
      // ============= DISCONNECTION =============
      
      socket.on('disconnect', async (reason) => {
        console.log(`\n❌ DISCONNECTION`);
        console.log(`   👤 User: ${user.email}`);
        console.log(`   📊 Reason: ${reason}`);
        console.log(`   👥 Remaining users: ${this.connectedUsers.size - 1}`);
        
        const sessionInfo = this.userSessions.get(user.id);
        if (sessionInfo) {
          await prisma.learningSession.update({
            where: { id: sessionInfo.sessionId },
            data: { 
              lastActivityAt: new Date(),
              socketId: null
            }
          });
          console.log(`📝 Session preserved for resume: ${sessionInfo.sessionId}`);
        }
        
        this.connectedUsers.delete(user.id);
        this.userSessions.delete(user.id);
        
        this.rooms.forEach((users, lessonId) => {
          if (users.has(user.id)) {
            users.delete(user.id);
            
            this.io!.to(`lesson:${lessonId}`).emit('user_left_lesson', {
              userId: user.id,
              userName: `${user.firstName} ${user.lastName}`,
              participants: users.size
            });
            
            if (users.size === 0) {
              this.rooms.delete(lessonId);
            }
          }
        });
        
        socket.broadcast.emit('user_disconnected', {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          totalUsers: this.connectedUsers.size
        });
      });
      
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${user.email}:`, error);
      });
    });
  }
  
  /**
   * Start cleanup interval for inactive sessions
   */
  private startCleanupInterval(): void {
    setInterval(async () => {
      const count = await sessionService.cleanupInactiveSessions();
      if (count > 0) {
        console.log(`🧹 Cleaned up ${count} inactive sessions`);
      }
    }, 60 * 60 * 1000);
    
    setInterval(async () => {
      for (const [userId, sessionInfo] of this.userSessions) {
        await prisma.learningSession.update({
          where: { id: sessionInfo.sessionId },
          data: { lastActivityAt: new Date() }
        }).catch(() => {});
      }
    }, 5 * 60 * 1000);
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
  
  sendOrchestratedContent(
    userId: string,
    eventName: string,
    data: any
  ): boolean {
    return this.sendToUser(userId, eventName, data);
  }
  
  broadcastOrchestratorUpdate(
    lessonId: string,
    update: any
  ): void {
    this.sendToLesson(lessonId, 'orchestrator_update', update);
  }
  
  async getActiveFlow(userId: string, lessonId: string): Promise<any> {
    return null;
  }
  
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