import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { quizService } from '../../core/quiz/quiz.service';
import { progressService } from '../../core/progress/progress.service';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';

const router = Router();

// Validation schemas
const startQuizSchema = z.object({
  lessonId: z.string().uuid(),
  questionCount: z.number().min(1).max(20).optional(),
});

const submitAnswerSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  answer: z.string(),
  timeSpent: z.number().min(0),
});

/**
 * @route   POST /api/v1/quiz/start
 * @desc    Start a new quiz attempt
 * @access  Private
 */
router.post(
  '/start',
  authenticate,
  validateBody(startQuizSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId, questionCount } = req.body;
    
    const session = await quizService.startQuizAttempt(
      req.user!.userId,
      lessonId,
      questionCount
    );
    
    res.json(
      successResponse(session, 'Quiz started successfully')
    );
  })
);

/**
 * @route   POST /api/v1/quiz/answer
 * @desc    Submit answer for a question
 * @access  Private
 */
router.post(
  '/answer',
  authenticate,
  validateBody(submitAnswerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { attemptId, questionId, answer, timeSpent } = req.body;
    
    const isCorrect = await quizService.submitAnswer(
      attemptId,
      questionId,
      answer,
      timeSpent
    );
    
    res.json(
      successResponse(
        { isCorrect },
        isCorrect ? 'Correct answer!' : 'Incorrect answer'
      )
    );
  })
);

/**
 * @route   POST /api/v1/quiz/complete/:attemptId
 * @desc    Complete quiz and get results
 * @access  Private
 */
router.post(
  '/complete/:attemptId',
  authenticate,
  validateParams(z.object({ attemptId: z.string().uuid() })),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await quizService.completeQuiz(req.params.attemptId);
    
    res.json(
      successResponse(result, 'Quiz completed successfully')
    );
  })
);

/**
 * @route   GET /api/v1/quiz/history
 * @desc    Get user's quiz history
 * @access  Private
 */
router.get(
  '/history',
  authenticate,
  validateQuery(z.object({
    lessonId: z.string().uuid().optional(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.query as any;
    
    const history = await quizService.getUserQuizHistory(
      req.user!.userId,
      lessonId
    );
    
    res.json(
      successResponse(history, 'Quiz history retrieved')
    );
  })
);

/**
 * @route   GET /api/v1/quiz/statistics/:lessonId
 * @desc    Get quiz statistics for a lesson
 * @access  Private
 */
router.get(
  '/statistics/:lessonId',
  authenticate,
  validateParams(z.object({ lessonId: z.string().uuid() })),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await quizService.getQuizStatistics(req.params.lessonId);
    
    res.json(
      successResponse(stats, 'Statistics retrieved')
    );
  })
);

/**
 * @route   POST /api/v1/quiz/generate
 * @desc    Generate quiz questions for a lesson
 * @access  Private (Teacher/Admin)
 */
router.post(
  '/generate',
  authenticate,
  validateBody(z.object({
    lessonId: z.string().uuid(),
    count: z.number().min(1).max(20).default(5),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId, count, difficulty } = req.body;
    
    const questions = await quizService.generateQuizQuestions(
      lessonId,
      count,
      difficulty
    );
    
    res.json(
      successResponse(questions, 'Questions generated successfully')
    );
  })
);

// Progress endpoints

/**
 * @route   GET /api/v1/quiz/progress
 * @desc    Get user's overall progress
 * @access  Private
 */
router.get(
  '/progress',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const progress = await progressService.getUserProgress(req.user!.userId);
    
    res.json(
      successResponse(progress, 'Progress retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/quiz/analytics
 * @desc    Get learning analytics
 * @access  Private
 */
router.get(
  '/analytics',
  authenticate,
  validateQuery(z.object({
    subjectId: z.string().uuid().optional(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { subjectId } = req.query as any;
    
    const analytics = await progressService.getLearningAnalytics(
      req.user!.userId,
      subjectId
    );
    
    res.json(
      successResponse(analytics, 'Analytics retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/quiz/leaderboard
 * @desc    Get leaderboard
 * @access  Private
 */
router.get(
  '/leaderboard',
  authenticate,
  validateQuery(z.object({
    subjectId: z.string().uuid().optional(),
    grade: z.string().transform(Number).optional(),
    limit: z.string().default('10').transform(Number).pipe(z.number()),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { subjectId, grade, limit } = req.query as any;
    
    const leaderboard = await progressService.getLeaderboard(
      subjectId,
      grade,
      limit
    );
    
    res.json(
      successResponse(leaderboard, 'Leaderboard retrieved')
    );
  })
);

export default router;