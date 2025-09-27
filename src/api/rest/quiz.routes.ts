import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { quizService } from '../../core/quiz/quiz.service';
import { progressService } from '../../core/progress/progress.service';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';
import { prisma } from '../../config/database.config';

const router = Router();

// Validation schemas - FIXED: Removed UUID validation
const startQuizSchema = z.object({
  lessonId: z.string().min(1),  // ✅ تم التعديل
  questionCount: z.number().min(1).max(20).optional(),
});

const submitAnswerSchema = z.object({
  attemptId: z.string().min(1),   // ✅ تم التعديل
  questionId: z.string().min(1),  // ✅ تم التعديل
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
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  validateParams(z.object({ attemptId: z.string().min(1) })),  // ✅ تم التعديل
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
    lessonId: z.string().optional(),  // ✅ تم التعديل - أزلت .uuid()
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  validateParams(z.object({ lessonId: z.string().min(1) })),  // ✅ تم التعديل
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
    lessonId: z.string().min(1),  // ✅ تم التعديل
    count: z.number().min(1).max(20).default(5),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

/**
 * @route   GET /api/v1/quiz/lessons/:lessonId/exercises
 * @desc    Get exercises from enriched content
 * @access  Private
 * 🆕 NEW ENDPOINT
 */
router.get(
  '/lessons/:lessonId/exercises',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.params;
    const { difficulty, count = '10' } = req.query as { difficulty?: string; count?: string };

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No exercises found for this lesson')
      );
      return;
    }

    // Parse and return exercises
    let exercises: any[] = [];

    // Check enrichedContent first
    if (lesson.content.enrichedContent) {
      try {
        const enriched = typeof lesson.content.enrichedContent === 'string'
          ? JSON.parse(lesson.content.enrichedContent)
          : lesson.content.enrichedContent;
        exercises = enriched.exercises || [];
      } catch (e) {
        console.error('Error parsing enrichedContent:', e);
      }
    }

    // Fallback to exercises field
    if (exercises.length === 0 && lesson.content.exercises) {
      try {
        const parsedExercises = typeof lesson.content.exercises === 'string'
          ? JSON.parse(lesson.content.exercises)
          : lesson.content.exercises;
        if (Array.isArray(parsedExercises)) {
          exercises = parsedExercises;
        }
      } catch (e) {
        console.error('Error parsing exercises:', e);
      }
    }

    // Filter by difficulty if specified
    if (difficulty && exercises.length > 0) {
      exercises = exercises.filter(ex =>
        !ex.difficulty || ex.difficulty.toLowerCase() === difficulty.toLowerCase()
      );
    }

    // Limit results
    const limit = parseInt(count, 10);
    exercises = exercises.slice(0, limit);

    res.json(
      successResponse({
        exercises,
        total: exercises.length,
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title,
        hasMore: exercises.length === limit,
        enrichmentLevel: lesson.content.enrichmentLevel || 0
      }, 'Exercises retrieved successfully')
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
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
    subjectId: z.string().optional(),  // ✅ تم التعديل - أزلت .uuid()
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log('[ANALYTICS] Request received');
    const { subjectId } = req.query as any;
    console.log('[ANALYTICS] Parameters:', { userId: req.user!.userId, subjectId });

    const analytics = await progressService.getLearningAnalytics(
      req.user!.userId,
      subjectId
    );
    console.log('[ANALYTICS] Success');

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
    subjectId: z.string().optional(),  // ✅ تم التعديل - أزلت .uuid()
    grade: z.string().transform(Number).optional(),
    limit: z.string().default('10').transform(Number).pipe(z.number()),
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log('[LEADERBOARD] Request received');
    const { subjectId, grade, limit } = req.query as any;
    console.log('[LEADERBOARD] Parameters:', { subjectId, grade: grade, gradeType: typeof grade, limit, limitType: typeof limit });

    const leaderboard = await progressService.getLeaderboard(
      subjectId,
      grade ? Number(grade) : undefined,
      Number(limit) || 10
    );
    console.log('[LEADERBOARD] Success');

    res.json(
      successResponse(leaderboard, 'Leaderboard retrieved')
    );
  })
);

export default router;