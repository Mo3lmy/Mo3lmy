import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware';
import { searchController } from './search.controller';
import { explainController } from './explain.controller';
import { z } from 'zod';

const router = Router();

// ============= SEARCH ROUTES =============

/**
 * @route   POST /api/v1/curriculum/search
 * @desc    Search curriculum with RAG
 * @access  Private
 */
router.post(
  '/search',
  authenticate,
  validateBody(z.object({
    query: z.string().min(2).max(500),
    subjectId: z.string().uuid().optional(),
    unitId: z.string().uuid().optional(),
    lessonId: z.string().uuid().optional(),
    grade: z.number().min(1).max(12).optional(),
    limit: z.number().min(1).max(20).default(5),
    includeExamples: z.boolean().default(false),
    includeFormulas: z.boolean().default(false),
  })),
  searchController.search
);

/**
 * @route   POST /api/v1/curriculum/ask
 * @desc    Ask a question about the curriculum
 * @access  Private
 */
router.post(
  '/ask',
  authenticate,
  validateBody(z.object({
    question: z.string().min(5).max(1000),
    lessonId: z.string().uuid().optional(),
    includeVisuals: z.boolean().default(false),
  })),
  searchController.askQuestion
);

/**
 * @route   GET /api/v1/curriculum/suggest
 * @desc    Get search suggestions
 * @access  Private
 */
router.get(
  '/suggest',
  authenticate,
  validateQuery(z.object({
    q: z.string().min(1).max(100),
  })),
  searchController.getSuggestions
);

/**
 * @route   GET /api/v1/curriculum/trending
 * @desc    Get trending search topics
 * @access  Private
 */
router.get(
  '/trending',
  authenticate,
  searchController.getTrendingTopics
);

// ============= EXPLAIN ROUTES =============

/**
 * @route   POST /api/v1/curriculum/explain/concept
 * @desc    Explain a concept in simple terms
 * @access  Private
 */
router.post(
  '/explain/concept',
  authenticate,
  validateBody(z.object({
    conceptId: z.string().uuid(),
    gradeLevel: z.number().min(1).max(12).optional(),
  })),
  explainController.explainConcept
);

/**
 * @route   POST /api/v1/curriculum/explain/formula
 * @desc    Explain a formula with examples
 * @access  Private
 */
router.post(
  '/explain/formula',
  authenticate,
  validateBody(z.object({
    formulaId: z.string().uuid(),
  })),
  explainController.explainFormula
);

/**
 * @route   POST /api/v1/curriculum/insights
 * @desc    Get insights about a lesson
 * @access  Private
 */
router.post(
  '/insights',
  authenticate,
  validateBody(z.object({
    lessonId: z.string().uuid(),
  })),
  explainController.getLessonInsights
);

/**
 * @route   POST /api/v1/curriculum/adaptive
 * @desc    Generate adaptive content based on student performance
 * @access  Private
 */
router.post(
  '/adaptive',
  authenticate,
  validateBody(z.object({
    lessonId: z.string().uuid(),
  })),
  explainController.generateAdaptiveContent
);

/**
 * @route   GET /api/v1/curriculum/simplify/:text
 * @desc    Simplify text for easier understanding
 * @access  Private
 */
router.get(
  '/simplify/:text',
  authenticate,
  validateParams(z.object({
    text: z.string().min(10).max(1000),
  })),
  validateQuery(z.object({
    grade: z.string().transform(Number).pipe(z.number().min(1).max(12)).optional(),
  })),
  explainController.simplifyText
);

export default router;