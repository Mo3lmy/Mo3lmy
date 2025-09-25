import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { contentService } from '../../core/content/content.service';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.middleware';
import { successResponse, errorResponse, paginate } from '../../utils/response.utils';
import { prisma } from '../../config/database.config';
import asyncHandler from 'express-async-handler';

const router = Router();

// Validation schemas - EDITED: Changed from uuid() to string().min(1)
const uuidSchema = z.object({
  id: z.string().min(1),  // ✅ تم التعديل: يقبل أي ID غير فارغ
});

const paginationSchema = z.object({
  page: z.string().default('1').transform(Number).pipe(z.number().min(1)),
  limit: z.string().default('10').transform(Number).pipe(z.number().min(1).max(100)),
});

/**
 * @route   GET /api/v1/content/subjects
 * @desc    Get all subjects by grade
 * @access  Public
 */
router.get(
  '/subjects',
  asyncHandler(async (req: Request, res: Response) => {
    // Parse grade directly
    const grade = parseInt(req.query.grade as string);
    
    if (isNaN(grade) || grade < 1 || grade > 12) {
      res.status(400).json(
        errorResponse('INVALID_GRADE', 'Grade must be between 1 and 12')
      );
    } else {
      const subjects = await contentService.getSubjectsByGrade(grade);
      res.json(
        successResponse(subjects, 'Subjects retrieved successfully')
      );
    }
  })
);

/**
 * @route   GET /api/v1/content/subjects/:id/units
 * @desc    Get units by subject
 * @access  Public
 */
router.get(
  '/subjects/:id/units',
  validateParams(uuidSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const units = await contentService.getUnitsBySubject(req.params.id);
    
    res.json(
      successResponse(units, 'Units retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/content/units/:id/lessons
 * @desc    Get lessons by unit
 * @access  Public
 */
router.get(
  '/units/:id/lessons',
  validateParams(uuidSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const lessons = await contentService.getLessonsByUnit(req.params.id);
    
    res.json(
      successResponse(lessons, 'Lessons retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/content/lessons/:id
 * @desc    Get lesson with content
 * @access  Public (with optional auth for progress tracking)
 */
router.get(
  '/lessons/:id',
  validateParams(uuidSchema),
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { lesson, content } = await contentService.getLessonWithContent(req.params.id);
    
    // Track progress if user is authenticated
    if (req.user) {
      await prisma.progress.upsert({
        where: {
          userId_lessonId: {
            userId: req.user.userId,
            lessonId: req.params.id,
          },
        },
        update: {
          lastAccessedAt: new Date(),
        },
        create: {
          userId: req.user.userId,
          lessonId: req.params.id,
          status: 'IN_PROGRESS',
        },
      });
    }
    
    res.json(
      successResponse(
        { lesson, content },
        'Lesson retrieved successfully'
      )
    );
  })
);

/**
 * @route   GET /api/v1/content/lessons/:id/questions
 * @desc    Get lesson questions
 * @access  Private
 */
router.get(
  '/lessons/:id/questions',
  validateParams(uuidSchema),
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const questions = await prisma.question.findMany({
      where: { lessonId: req.params.id },
      orderBy: { order: 'asc' },
    });
    
    res.json(
      successResponse(questions, 'Questions retrieved successfully')
    );
  })
);

/**
 * @route   POST /api/v1/content/subjects
 * @desc    Create new subject
 * @access  Admin only
 */
router.post(
  '/subjects',
  authenticate,
  authorize('ADMIN'),
  validateBody(z.object({
    name: z.string().min(2).max(100),
    nameEn: z.string().min(2).max(100),
    grade: z.number().min(1).max(12),
    description: z.string().optional(),
    icon: z.string().optional(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const subject = await contentService.createSubject(req.body);
    
    res.status(201).json(
      successResponse(subject, 'Subject created successfully')
    );
  })
);

/**
 * @route   POST /api/v1/content/units
 * @desc    Create new unit
 * @access  Admin/Teacher
 */
router.post(
  '/units',
  authenticate,
  authorize('ADMIN', 'TEACHER'),
  validateBody(z.object({
    subjectId: z.string().min(1),  // ✅ تم التعديل: بدلاً من uuid()
    title: z.string().min(3).max(200),
    titleEn: z.string().min(3).max(200),
    description: z.string().optional(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const unit = await contentService.createUnit(req.body);
    
    res.status(201).json(
      successResponse(unit, 'Unit created successfully')
    );
  })
);

/**
 * @route   POST /api/v1/content/lessons
 * @desc    Create new lesson
 * @access  Admin/Teacher
 */
router.post(
  '/lessons',
  authenticate,
  authorize('ADMIN', 'TEACHER'),
  validateBody(z.object({
    unitId: z.string().min(1),  // ✅ تم التعديل: بدلاً من uuid()
    title: z.string().min(3).max(200),
    titleEn: z.string().min(3).max(200),
    description: z.string().optional(),
    duration: z.number().min(5).max(180).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const lesson = await contentService.createLesson(req.body);
    
    res.status(201).json(
      successResponse(lesson, 'Lesson created successfully')
    );
  })
);

/**
 * @route   PUT /api/v1/content/lessons/:id/content
 * @desc    Update lesson content
 * @access  Admin/Teacher
 */
router.put(
  '/lessons/:id/content',
  authenticate,
  authorize('ADMIN', 'TEACHER'),
  validateParams(uuidSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const content = await contentService.upsertLessonContent(
      req.params.id,
      req.body
    );
    
    res.json(
      successResponse(content, 'Content updated successfully')
    );
  })
);

/**
 * @route   POST /api/v1/content/lessons/:id/publish
 * @desc    Publish lesson
 * @access  Admin/Teacher
 */
router.post(
  '/lessons/:id/publish',
  authenticate,
  authorize('ADMIN', 'TEACHER'),
  validateParams(uuidSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const lesson = await contentService.publishLesson(req.params.id);
    
    res.json(
      successResponse(lesson, 'Lesson published successfully')
    );
  })
);

/**
 * @route   GET /api/v1/content/search
 * @desc    Search lessons
 * @access  Public
 */
router.get(
  '/search',
  validateQuery(z.object({
    q: z.string().min(2),
    grade: z.string().transform(Number).pipe(z.number().min(1).max(12)).optional(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, grade } = req.query as any;
    const lessons = await contentService.searchLessons(q, grade);
    
    res.json(
      successResponse(lessons, 'Search completed successfully')
    );
  })
);

export default router;