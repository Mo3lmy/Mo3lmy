// 📍 المكان: src/app.ts
// ✨ النسخة المحدثة مع Student Context & Emotional Intelligence

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { AppError, handleError } from './utils/errors';
import { websocketService } from './services/websocket/websocket.service';
import { openAIService } from './services/ai/openai.service';
import { teachingAssistant } from './services/teaching/teaching-assistant.service';

// ============= IMPORT ALL ROUTES =============
import authRoutes from './api/rest/auth.routes';
import lessonsRoutes from './api/rest/lessons.routes';
import subjectsRoutes from './api/rest/subjects.routes';
import contentRoutes from './api/rest/content.routes';
import chatRoutes from './api/rest/chat.routes';
import quizRoutes from './api/rest/quiz.routes';

// 🆕 NEW ROUTES
import testRoutes from './api/test-routes';
import studentContextRoutes from './api/rest/student-context.routes';
import achievementsRoutes from './api/rest/achievements.routes';
import parentReportsRoutes from './api/rest/parent-reports.routes';
import educationalContentRoutes from './api/rest/educational-content.routes';

// Create Express app
const app: Application = express();

// ============= TRUST PROXY (for production) =============
if (config.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ============= SECURITY MIDDLEWARE =============
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // Allowed origins for development and production
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];

    // In production, add your production domains
    if (config.NODE_ENV === 'production') {
      allowedOrigins.push('https://yourdomain.com');
    }

    // Check if origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // In development, allow all origins
    if (config.NODE_ENV === 'development') {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============= RATE LIMITING (Enhanced) =============
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Stricter for auth
  message: 'Too many authentication attempts',
  skipSuccessfulRequests: true,
});

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 AI requests per minute
  message: 'Too many AI requests. Please wait a moment.',
});

app.use('/api/', limiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/ai/', aiLimiter);
app.use('/api/rag/', aiLimiter);

// ============= BODY PARSING =============
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ============= STATIC FILES =============
app.use(express.static(path.join(__dirname, '../public')));

// Voice audio files directory
const voiceCacheDir = path.join(process.cwd(), 'temp', 'voice-cache');
if (!fs.existsSync(voiceCacheDir)) {
  fs.mkdirSync(voiceCacheDir, { recursive: true });
  console.log('📁 Created voice cache directory');
}

app.use('/audio', express.static(voiceCacheDir, {
  setHeaders: (res) => {
    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });
  }
}));

// ============= LOGGING (Enhanced) =============
if (config.NODE_ENV === 'development') {
  // Colored logging in development
  app.use(morgan('dev'));
} else {
  // Create logs directory
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Log to file in production
  const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
  );
  
  app.use(morgan('combined', { stream: accessLogStream }));
}

// ============= 🆕 STUDENT TRACKING MIDDLEWARE =============
app.use((req: Request, res: Response, next: NextFunction) => {
  // Track API usage per user if authenticated
  if (req.headers.authorization) {
    // In production, decode JWT and track user activity
    req.headers['x-request-time'] = Date.now().toString();
  }
  next();
});

// ============= HEALTH CHECK (Enhanced) =============
app.get('/health', async (req: Request, res: Response) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: '4.0.0', // Updated version
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    services: {
      database: 'connected',
      websocket: {
        status: 'active',
        connectedUsers: websocketService.getConnectedUsersCount()
      },
      ai: {
        status: openAIService.isReady() ? 'ready' : 'not configured',
        stats: openAIService.getUsageStats().requestCount
      },
      teaching: {
        status: 'ready',
        health: teachingAssistant.getHealthStatus()
      },
      voiceService: config.ELEVENLABS_API_KEY ? 'ready' : 'not configured',
      emotionalIntelligence: 'enabled',
      achievements: 'enabled',
      parentReports: 'enabled'
    },
    features: {
      studentContext: true,
      emotionalIntelligence: true,
      adaptiveLearning: true,
      realTimeMonitoring: true,
      achievementSystem: true,
      parentCommunication: true
    }
  };
  
  res.json(healthData);
});

// ============= API STATUS =============
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'operational',
    services: {
      database: 'connected',
      websocket: 'active',
      ai: openAIService.isReady() ? 'ready' : 'not configured',
      slideService: 'ready',
      voiceService: config.ELEVENLABS_API_KEY ? 'ready' : 'not configured',
      ragSystem: 'ready',
      quizService: 'ready',
      emotionalIntelligence: 'ready'
    },
    timestamp: new Date().toISOString(),
  });
});

// ============= TEST PAGES =============
app.get('/test-websocket', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/test-pages/websocket-test.html'));
});

app.get('/test', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/test-pages/test-index.html'));
});

app.get('/test-system', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../test-system.html'));
});

app.get('/test-math.html', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/test-math.html'));
});

// ============= API ROUTES =============

// Core routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/lessons', lessonsRoutes);
app.use('/api/v1/subjects', subjectsRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/quiz', quizRoutes);

// 🆕 Enhanced routes
app.use('/api/v1/student-context', studentContextRoutes);
app.use('/api/v1/achievements', achievementsRoutes);
app.use('/api/v1/parent-reports', parentReportsRoutes);
app.use('/api/v1/educational', educationalContentRoutes);

// Test routes
app.use('/api', testRoutes);

// ============= API DOCUMENTATION (Enhanced) =============
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'Smart Education Platform API - Enhanced Edition',
    version: '4.0.0',
    features: [
      '🧠 Emotional Intelligence',
      '🎯 Adaptive Learning',
      '🏆 Achievement System',
      '👨‍👩‍👧 Parent Communication',
      '📊 Real-time Analytics'
    ],
    endpoints: {
      auth: {
        base: '/api/v1/auth',
        routes: [
          'POST /register',
          'POST /login',
          'GET /me',
          'POST /change-password',
          'POST /verify'
        ]
      },
      lessons: {
        base: '/api/v1/lessons',
        routes: [
          'GET /',
          'GET /:id',
          'GET /:id/content',
          'GET /:id/slides',
          'POST /:id/slides/:slideNumber/voice',
          'POST /:id/voice/generate-all',
          'GET /:id/voice/status'
        ]
      },
      studentContext: {
        base: '/api/v1/student-context',
        routes: [
          'GET /:userId',
          'PUT /:userId',
          'GET /:userId/emotional-state',
          'POST /:userId/emotional-state',
          'GET /:userId/learning-patterns',
          'GET /:userId/recommendations'
        ]
      },
      achievements: {
        base: '/api/v1/achievements',
        routes: [
          'GET /:userId',
          'POST /:userId/unlock',
          'GET /:userId/progress',
          'GET /leaderboard'
        ]
      },
      parentReports: {
        base: '/api/v1/parent-reports',
        routes: [
          'GET /:userId/latest',
          'GET /:userId/history',
          'POST /:userId/generate',
          'POST /:userId/send-email'
        ]
      },
      websocket: {
        base: 'ws://localhost:3000',
        events: {
          core: [
            'authenticate',
            'join_lesson',
            'chat_message'
          ],
          teaching: [
            'generate_teaching_script',
            'student_interaction',
            'request_explanation'
          ],
          emotional: [
            'update_emotional_state',
            'user_activity',
            'get_achievements'
          ],
          realtime: [
            'quiz_answer_submitted',
            'request_parent_update'
          ]
        }
      }
    },
    testPages: [
      '/test',
      '/test-websocket',
      '/test-system',
      '/test-math.html'
    ],
    documentation: 'https://your-docs-url.com',
    support: 'support@smart-education.com'
  });
});

// ============= 🆕 MONITORING ENDPOINT =============
app.get('/api/monitoring/stats', async (req: Request, res: Response) => {
  const stats = {
    timestamp: new Date().toISOString(),
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    },
    websocket: {
      connected: websocketService.getConnectedUsersCount(),
      // Add more WebSocket stats if available
    },
    ai: openAIService.getUsageStats(),
    teaching: teachingAssistant.getHealthStatus()
  };
  
  res.json(stats);
});

// ============= ERROR HANDLING (Enhanced) =============

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
      suggestion: 'Check /api for available endpoints'
    }
  });
});

// Global Error Handler
app.use((error: Error | AppError, req: Request, res: Response, next: NextFunction) => {
  // Log error details
  console.error(`[${new Date().toISOString()}] Error:`, {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: config.NODE_ENV === 'development' ? error.stack : undefined
  });
  
  const { statusCode, message, isOperational } = handleError(error);
  
  // If not operational, this is a programming error
  if (!isOperational) {
    console.error('💥 CRITICAL ERROR:', error);
    
    // In production, you might want to:
    // 1. Send alert to monitoring service
    // 2. Restart the process gracefully
  }
  
  // Track error metrics
  if (req.headers['x-request-time']) {
    const duration = Date.now() - parseInt(req.headers['x-request-time'] as string);
    console.log(`Request failed after ${duration}ms`);
  }
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: error instanceof AppError ? error.constructor.name : 'INTERNAL_ERROR',
      message,
      ...(config.NODE_ENV === 'development' && { 
        stack: error.stack,
        details: error
      }),
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  });
});

// ============= GRACEFUL SHUTDOWN PREPARATION =============
app.get('/api/prepare-shutdown', (req: Request, res: Response) => {
  // This endpoint can be used by load balancers to prepare for shutdown
  console.log('⚠️ Preparing for shutdown...');
  res.json({
    message: 'Server preparing for shutdown',
    connectedUsers: websocketService.getConnectedUsersCount()
  });
});

export default app;