import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { AppError, handleError } from './utils/errors';

// Import existing routes
import authRoutes from './api/rest/auth.routes';
import contentRoutes from './api/rest/content.routes';
import chatRoutes from './api/rest/chat.routes';
import quizRoutes from './api/rest/quiz.routes';

// Import new v1 routes
import curriculumRoutesV1 from './api/v1/curriculum';
import quizRoutesV1 from './api/v1/quiz';
import studentRoutesV1 from './api/v1/student';

// Create Express app
const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : '*',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

// Aggressive rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts',
});

app.use('/api/', limiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: '1.0.0',
  });
});

// API Status endpoint
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'operational',
    services: {
      database: 'connected',
      cache: 'connected',
      ai: 'ready',
      rag: 'ready',
    },
    timestamp: new Date().toISOString(),
  });
});

// ============= API ROUTES =============

// Existing REST routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/quiz', quizRoutes);

// New RAG and Progress routes
app.use('/api/v1/curriculum', curriculumRoutesV1);
app.use('/api/v1/quiz', quizRoutesV1); // This extends the existing quiz routes
app.use('/api/v1/student', studentRoutesV1);

// API Documentation endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'Smart Education Platform API',
    version: '1.0.0',
    endpoints: {
      auth: {
        base: '/api/v1/auth',
        routes: [
          'POST /register',
          'POST /login',
          'GET /me',
          'POST /change-password',
          'POST /verify',
        ]
      },
      content: {
        base: '/api/v1/content',
        routes: [
          'GET /subjects',
          'GET /subjects/:id/units',
          'GET /units/:id/lessons',
          'GET /lessons/:id',
          'GET /lessons/:id/questions',
          'GET /search',
        ]
      },
      curriculum: {
        base: '/api/v1/curriculum',
        routes: [
          'POST /search',
          'POST /ask',
          'GET /suggest',
          'GET /trending',
          'POST /explain/concept',
          'POST /explain/formula',
          'POST /insights',
          'POST /adaptive',
          'GET /simplify/:text',
        ]
      },
      quiz: {
        base: '/api/v1/quiz',
        routes: [
          'POST /start',
          'POST /answer',
          'POST /complete/:attemptId',
          'GET /history',
          'GET /statistics/:lessonId',
          'POST /generate',
          'POST /generate/adaptive',
          'POST /regenerate',
          'GET /templates',
        ]
      },
      student: {
        base: '/api/v1/student',
        routes: [
          'GET /progress',
          'POST /progress/update',
          'GET /progress/subject/:subjectId',
          'GET /progress/statistics',
          'GET /progress/achievements',
          'GET /progress/leaderboard',
          'GET /progress/learning-path',
          'GET /gamification/stats',
          'GET /gamification/challenges',
          'POST /gamification/challenges/:challengeId/complete',
          'GET /gamification/rewards',
          'POST /gamification/rewards/:rewardId/claim',
        ]
      },
      chat: {
        base: '/api/v1/chat',
        routes: [
          'POST /message',
          'GET /history',
          'GET /session/:sessionId/summary',
          'POST /feedback',
          'GET /suggestions',
        ]
      }
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
      availableEndpoints: '/api',
    },
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((error: Error | AppError, req: Request, res: Response, next: NextFunction) => {
  const { statusCode, message, isOperational } = handleError(error);
  
  // Log error
  if (!isOperational) {
    console.error('ERROR:', error);
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
    },
    timestamp: new Date().toISOString(),
  });
});

export default app;