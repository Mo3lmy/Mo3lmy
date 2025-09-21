import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { AppError, handleError } from './utils/errors';
import quizRoutes from './api/rest/quiz.routes';
// Import routes
import authRoutes from './api/rest/auth.routes';
import contentRoutes from './api/rest/content.routes';
import chatRoutes from './api/rest/chat.routes';
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
app.use('/api/v1/quiz', quizRoutes);
// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

app.use('/api/v1/chat', chatRoutes);
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
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/content', contentRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
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
      ...(config.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
});

export default app;