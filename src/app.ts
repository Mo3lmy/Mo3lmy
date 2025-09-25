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

// ============= IMPORT ALL ROUTES =============
import authRoutes from './api/rest/auth.routes';
import lessonsRoutes from './api/rest/lessons.routes';
import subjectsRoutes from './api/rest/subjects.routes';
import contentRoutes from './api/rest/content.routes';
import chatRoutes from './api/rest/chat.routes';
import quizRoutes from './api/rest/quiz.routes';

// Create Express app
const app: Application = express();

// ============= SECURITY MIDDLEWARE =============
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: config.NODE_ENV === 'production' ? ['https://yourdomain.com'] : '*',
  credentials: true,
}));

// ============= RATE LIMITING =============
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many authentication attempts',
  skipSuccessfulRequests: true,
});

app.use('/api/', limiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// ============= BODY PARSING =============
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ============= STATIC FILES =============
app.use(express.static(path.join(__dirname, '../public')));

// Voice audio files
const voiceCacheDir = path.join(process.cwd(), 'temp', 'voice-cache');
if (!fs.existsSync(voiceCacheDir)) {
  fs.mkdirSync(voiceCacheDir, { recursive: true });
  console.log('📁 Created voice cache directory');
}

app.use('/audio', express.static(voiceCacheDir, {
  setHeaders: (res) => {
    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=3600'
    });
  }
}));

// ============= LOGGING =============
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============= HEALTH CHECK =============
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: '3.1.0',
    services: {
      websocket: {
        connected: websocketService.getConnectedUsersCount(),
        status: 'active'
      },
      database: 'connected',
      ai: 'ready',
      slideService: 'ready',
      voiceService: config.ELEVENLABS_API_KEY ? 'ready' : 'not configured',
      mathComponents: 'ready'
    }
  });
});

// ============= API STATUS =============
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'operational',
    services: {
      database: 'connected',
      websocket: 'active',
      slideService: 'ready',
      voiceService: config.ELEVENLABS_API_KEY ? 'ready' : 'not configured'
    },
    timestamp: new Date().toISOString(),
  });
});

// ============= TEST PAGES (Now serving files!) =============
app.get('/test-websocket', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/test-pages/websocket-test.html'));
});

app.get('/test', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/test-pages/test-index.html'));
});

app.get('/test-math.html', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/test-math.html'));
});

// ============= API ROUTES =============
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/lessons', lessonsRoutes);
app.use('/api/v1/subjects', subjectsRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/quiz', quizRoutes);


// ============= TEST ROUTES ============= 
// أضف هذه الأسطر الثلاثة
import testRoutes from './api/test-routes';
app.use('/api', testRoutes);


// ============= API DOCUMENTATION =============
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'Smart Education Platform API',
    version: '3.1.0',
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
      websocket: {
        base: 'ws://localhost:3000',
        events: [
          'request_slide',
          'generate_slide_voice',
          'generate_lesson_voices'
        ]
      }
    },
    testPages: ['/test', '/test-websocket', '/test-math.html'],
    audioEndpoint: '/audio/:filename'
  });
});

// ============= ERROR HANDLING =============
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`
    }
  });
});

app.use((error: Error | AppError, req: Request, res: Response, next: NextFunction) => {
  const { statusCode, message, isOperational } = handleError(error);
  
  if (!isOperational) {
    console.error('ERROR:', error);
  }
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: error instanceof AppError ? error.constructor.name : 'INTERNAL_ERROR',
      message,
      ...(config.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
});

export default app;