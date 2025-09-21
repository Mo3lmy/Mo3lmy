import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validateBody, validateParams } from '../../middleware/validation.middleware';
import { generateController } from './generate.controller';
import { z } from 'zod';

const router = Router();

// ============= GENERATION ROUTES =============

/**
 * @route   POST /api/v1/quiz/generate
 * @desc    Generate quiz questions for a lesson
 * @access  Private (Teacher/Admin)
 */
router.post(
  '/generate',
  authenticate,
  authorize('TEACHER', 'ADMIN'),
  validateBody(z.object({
    lessonId: z.string().uuid(),
    count: z.number().min(1).max(20).default(5),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
    type: z.enum(['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'MIXED']).optional(),
  })),
  generateController.generateQuiz
);

/**
 * @route   POST /api/v1/quiz/generate/adaptive
 * @desc    Generate adaptive quiz based on student performance
 * @access  Private
 */
router.post(
  '/generate/adaptive',
  authenticate,
  validateBody(z.object({
    lessonId: z.string().uuid(),
    count: z.number().min(1).max(20).default(5),
  })),
  generateController.generateAdaptiveQuiz
);

/**
 * @route   POST /api/v1/quiz/regenerate
 * @desc    Regenerate a specific question
 * @access  Private (Teacher/Admin)
 */
router.post(
  '/regenerate',
  authenticate,
  authorize('TEACHER', 'ADMIN'),
  validateBody(z.object({
    questionId: z.string().uuid(),
    reason: z.string().optional(),
  })),
  generateController.regenerateQuestion
);

/**
 * @route   GET /api/v1/quiz/templates
 * @desc    Get quiz templates
 * @access  Private (Teacher/Admin)
 */
router.get(
  '/templates',
  authenticate,
  authorize('TEACHER', 'ADMIN'),
  generateController.getQuizTemplates
);

// Re-export existing quiz routes from the main quiz routes file
// These routes were already defined in src/api/rest/quiz.routes.ts
// We'll import and mount them here

import quizMainRoutes from '../../rest/quiz.routes';

// Mount the existing quiz routes
router.use('/', quizMainRoutes);

export default router;