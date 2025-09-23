// 📍 المكان: src/services/websocket/websocket.service.ts
// النسخة المحدثة الكاملة مع دعم المكونات الرياضية التفاعلية + تحميل الدروس ديناميكياً

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

// ============= NEW MATH IMPORTS =============
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
    
    // Authentication middleware - مُحدث للتطوير
    this.io.use(async (socket, next) => {
  try {
    // 🔴 للاختبار والتطوير فقط
    if (config.NODE_ENV === 'development') {
      socket.data.user = {
        id: 'dev-user-123',
        email: 'dev@test.com',
        firstName: 'Dev',
        lastName: 'User',
        role: 'STUDENT',
        grade: 9
      };
      return next();
    }
    
    // الكود الأصلي للإنتاج
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
        userGrade: user.grade,  // NEW: إرسال الصف للفلترة
        features: {
          math: true,
          interactive: true,
          voice: false,
          dynamicLessons: true  // NEW: إعلام بدعم الدروس الديناميكية
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
          
          // Check if it's a math lesson
          const isMathLesson = unit.subject.name.includes('رياضيات') || 
                               unit.subject.name.toLowerCase().includes('math');
          
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
            isMathLesson,  // NEW: indicate if it's a math lesson
            structure: {
              keyPoints: keyPoints.length,
              examples: examples.length,
              objectives: objectives.length,
              hasVideo: false, // Since videoUrl doesn't exist in the model
              hasInteractiveComponents: isMathLesson,  // NEW
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
      
      // ============= DYNAMIC LESSONS LOADING (NEW) =============
      
      /**
       * إرسال قائمة الدروس المتاحة
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
          const where: any = {
            isPublished: true
          };
          
          // Filter by grade if specified or use user's grade
          const targetGrade = options?.grade || user.grade;
          if (targetGrade) {
            where.unit = {
              subject: {
                grade: targetGrade
              }
            };
          }
          
          // Filter by subject if specified
          if (options?.subjectId) {
            where.unit = {
              ...where.unit,
              subjectId: options.subjectId
            };
          }
          
          // Search in title if specified
          if (options?.search) {
            where.OR = [
              { title: { contains: options.search } },
              { titleAr: { contains: options.search } },
              { description: { contains: options.search } }
            ];
          }
          
          // Fetch lessons with pagination
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
          
          // Format lessons for client
          const formattedLessons = lessons.map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            titleAr: lesson.titleAr,
            description: lesson.description,
            difficulty: lesson.difficulty,
            estimatedMinutes: lesson.estimatedMinutes,
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
            grade: targetGrade,
            filters: {
              grade: targetGrade,
              subjectId: options?.subjectId,
              search: options?.search
            }
          });
          
          console.log(`   ✅ Sent ${formattedLessons.length} lessons to ${user.email}`);
          
        } catch (error) {
          console.error('Error fetching lessons:', error);
          socket.emit('available_lessons', {
            lessons: [],
            total: 0,
            error: 'فشل تحميل الدروس'
          });
        }
      });
      
      /**
       * إرسال قائمة المواد المتاحة
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
       * البحث في الدروس
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
          
          console.log(`   🔍 Search results: ${lessons.length} lessons for "${query}"`);
          
        } catch (error) {
          console.error('Search error:', error);
          socket.emit('search_results', {
            lessons: [],
            query,
            error: 'فشل البحث'
          });
        }
      });
      
      // ============= MATH-SPECIFIC EVENTS (NEW) =============
      
      /**
       * طلب شريحة رياضية تفاعلية
       */
      socket.on('request_math_slide', async (data: {
        lessonId?: string;
        slideNumber: number;
        mathContent: {
          title?: string;
          subtitle?: string;
          expressions?: MathExpression[];
          layout?: 'single' | 'grid' | 'vertical';
          interactive?: boolean;
          showSteps?: boolean;
        };
        theme?: string;
      }) => {
        try {
          console.log(`🧮 Math slide requested by ${user.email}`);
          
          // Generate math slide HTML
          const slideHTML = await mathSlideGenerator.generateMathSlide(
            {
              title: data.mathContent.title,
              subtitle: data.mathContent.subtitle,
              mathExpressions: data.mathContent.expressions || [],
              showSteps: data.mathContent.showSteps,
              interactive: data.mathContent.interactive,
              mathLayout: data.mathContent.layout
            },
            (data.theme as any) || 'default',
            {
              enableInteractivity: data.mathContent.interactive !== false,
              showSolveButton: true,
              autoPlaySteps: false
            }
          );
          
          // Send back to user
          socket.emit('math_slide_ready', {
            slideNumber: data.slideNumber,
            html: slideHTML,
            type: 'math',
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
              
              // Notify others in lesson room
              const roomName = `lesson:${data.lessonId}`;
              socket.to(roomName).emit('user_generated_math_slide', {
                userId: user.id,
                userName: `${user.firstName} ${user.lastName}`,
                slideNumber: data.slideNumber
              });
            }
          }
          
          console.log(`   ✅ Math slide generated successfully`);
          
        } catch (error: any) {
          console.error('Error generating math slide:', error);
          socket.emit('math_slide_error', {
            message: 'فشل توليد الشريحة الرياضية',
            error: error.message
          });
        }
      });
      
      /**
       * طلب شريحة مسألة رياضية
       */
      socket.on('request_math_problem_slide', async (data: {
        lessonId?: string;
        slideNumber: number;
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
          
          // Generate problem slide
          const slideHTML = await mathSlideGenerator.generateMathProblemSlide(
            data.problem,
            (data.theme as any) || 'default'
          );
          
          socket.emit('math_problem_slide_ready', {
            slideNumber: data.slideNumber,
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
       * طلب مقارنة معادلات
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
          
          // Generate comparison slide
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
       * تحديث متغير في معادلة تفاعلية
       */
      socket.on('update_equation_variable', async (data: {
        lessonId?: string;
        equationId: string;
        variable: string;
        value: number;
      }) => {
        console.log(`🔧 Variable update: ${data.variable} = ${data.value}`);
        
        // Broadcast to others in the lesson
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
       * حل معادلة
       */
      socket.on('solve_equation', async (data: {
        lessonId?: string;
        equation: string;
        variables?: Record<string, number>;
      }) => {
        try {
          console.log(`🧮 Solving equation: ${data.equation}`);
          
          // Here we could integrate with a math solver library
          // For now, we'll use AI to solve
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
       * طلب معادلات جاهزة من المكتبة
       */
      socket.on('get_common_equations', async (data: {
        subject?: 'algebra' | 'geometry' | 'trigonometry' | 'calculus';
        grade?: number;
      }) => {
        console.log(`📚 Common equations requested for ${data.subject || 'all'}`);
        
        // Get common expressions from the library
        const commonExpressions = latexRenderer.getCommonExpressions();
        
        // Filter by subject if specified
        let filtered = Object.entries(commonExpressions);
        if (data.subject) {
          // Filter logic based on subject
          // This is simplified - in production, you'd have better categorization
        }
        
        socket.emit('common_equations', {
          equations: Object.fromEntries(filtered),
          count: filtered.length,
          subject: data.subject
        });
      });
      
      socket.on('generate_smart_slide', async (data: {
        lessonId: string;
        prompt: string;
        type?: string;
      }) => {
        try {
          console.log(`🎨 Smart slide generation requested: "${data.prompt}"`);
          
          // Check if it's a math-related request
          const isMathRequest = data.prompt.includes('معادلة') || 
                               data.prompt.includes('رياضي') ||
                               data.prompt.includes('حل') ||
                               data.prompt.includes('equation') ||
                               data.prompt.includes('solve');
          
          if (isMathRequest) {
            // Generate a math slide
            const mathExpression: MathExpression = {
              id: 'generated',
              latex: 'x^2 + 2x + 1 = 0',  // Default, will be replaced by AI
              description: data.prompt,
              type: 'equation',
              isInteractive: true
            };
            
            // Use AI to generate appropriate equation
            if (process.env.OPENAI_API_KEY) {
              const aiPrompt = `
قم بإنشاء معادلة رياضية بناء على الطلب التالي:
"${data.prompt}"

أرجع المعادلة بصيغة LaTeX فقط.`;
              
              try {
                const response = await openAIService.chat([
                  { role: 'user', content: aiPrompt }
                ], {
                  temperature: 0.5,
                  maxTokens: 100
                });
                
                mathExpression.latex = response.trim();
              } catch (aiError) {
                console.error('AI equation generation failed:', aiError);
              }
            }
            
            // Generate math slide
            const slideHTML = await mathSlideGenerator.generateMathSlide(
              {
                title: 'معادلة مولدة بالذكاء الاصطناعي',
                mathExpressions: [mathExpression],
                interactive: true,
                showSteps: true
              },
              'default'
            );
            
            socket.emit('smart_slide_ready', {
              html: slideHTML,
              content: { type: 'math', expression: mathExpression },
              prompt: data.prompt,
              isMathSlide: true
            });
            
          } else {
            // Use original logic for non-math slides
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
              prompt: data.prompt,
              isMathSlide: false
            });
          }
          
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
          
          // Get participants
          const participants = Array.from(this.rooms.get(lessonId)!);
          
          // Send success response with session data
          socket.emit('joined_lesson', {
            lessonId,
            lessonTitle: lesson.title,
            unitTitle: lesson.unit.title,
            subjectName: lesson.unit.subject.name,
            isMathLesson,  // NEW: indicate if it's a math lesson
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
        
        // Check if it's a math-related question
        const isMathQuestion = message.includes('معادلة') || 
                              message.includes('احسب') ||
                              message.includes('حل') ||
                              message.includes('رياضي');
        
        if (isMathQuestion) {
          // Generate a math slide as response
          console.log('   🧮 Math question detected, generating interactive response');
          
          // Use AI to understand and solve
          if (process.env.OPENAI_API_KEY) {
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
              
              // Send AI response
              socket.emit('ai_response', {
                lessonId,
                message: response,
                isMathResponse: true,
                timestamp: new Date().toISOString()
              });
              
              // Also offer to generate an interactive slide
              socket.emit('math_slide_offer', {
                message: 'هل تريد شريحة تفاعلية لهذه المعادلة؟',
                lessonId
              });
              
            } catch (error) {
              console.error('Math AI response failed:', error);
            }
          }
        } else {
          // Normal chat flow
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
          sessionInfo: sessionInfo || null,
          features: {
            math: true,
            interactive: true,
            voice: false,
            dynamicLessons: true  // NEW
          }
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