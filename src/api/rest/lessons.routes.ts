// 📍 المكان: src/api/rest/lessons.routes.ts
// الوظيفة: API endpoints للدروس

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.config';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';





const router = Router();



// Endpoint خاص للتطوير فقط - بدون authentication
if (process.env.NODE_ENV === 'development') {
  router.get('/test', async (req, res) => {
    try {
      const lessons = await prisma.lesson.findMany({
        include: {
          unit: {
            include: {
              subject: true
            }
          }
        },
        take: 20
      });
      
      res.json({
        success: true,
        data: lessons
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch lessons'
      });
    }
  });
}

/**
 * @route   GET /api/v1/lessons
 * @desc    Get all lessons or filtered lessons
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { subjectId, unitId, grade } = req.query;
    
    // Build where clause
    const where: any = {};
    
    if (unitId) {
      where.unitId = unitId;
    }
    
    if (subjectId || grade) {
      where.unit = {};
      if (subjectId) {
        where.unit.subjectId = subjectId;
      }
      if (grade) {
        where.unit.subject = { grade: parseInt(grade as string) };
      }
    }
    
    // Fetch lessons
    const lessons = await prisma.lesson.findMany({
      where,
      include: {
        unit: {
          include: {
            subject: true
          }
        }
      },
      orderBy: {
        order: 'asc'
      }
    });
    
    res.json(
      successResponse(lessons, 'Lessons retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/:id
 * @desc    Get single lesson by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        unit: {
          include: {
            subject: true
          }
        },
        video: true
      }
    });
    
    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }
    
    res.json(
      successResponse(lesson, 'Lesson retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/:id/content
 * @desc    Get lesson content
 * @access  Private
 */
router.get(
  '/:id/content',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // Get lesson with content
    const lesson = await prisma.lesson.findUnique({
      where: { id }
    });
    
    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }
    
    // Get related content if exists
    const content = await prisma.content.findFirst({
      where: { lessonId: id }
    });
    
    // Parse JSON fields
    const keyPoints = JSON.parse(lesson.keyPoints || '[]');
    
    // Build content response
    const lessonContent = {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      summary: lesson.summary,
      keyPoints,
      fullText: content?.fullText || '',
      examples: content ? JSON.parse(content.examples || '[]') : [],
      exercises: content ? JSON.parse(content.exercises || '[]') : [],
      estimatedMinutes: lesson.estimatedMinutes || 30
    };
    
    res.json(
      successResponse(lessonContent, 'Lesson content retrieved')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/subject/:subjectId
 * @desc    Get lessons by subject
 * @access  Private
 */
router.get(
  '/subject/:subjectId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { subjectId } = req.params;
    
    const lessons = await prisma.lesson.findMany({
      where: {
        unit: {
          subjectId
        }
      },
      include: {
        unit: true
      },
      orderBy: [
        { unit: { order: 'asc' } },
        { order: 'asc' }
      ]
    });
    
    res.json(
      successResponse(lessons, 'Subject lessons retrieved')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/unit/:unitId
 * @desc    Get lessons by unit
 * @access  Private
 */
router.get(
  '/unit/:unitId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { unitId } = req.params;
    
    const lessons = await prisma.lesson.findMany({
      where: { unitId },
      orderBy: { order: 'asc' }
    });
    
    res.json(
      successResponse(lessons, 'Unit lessons retrieved')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/:id/start
 * @desc    Start a lesson (track progress)
 * @access  Private
 */
router.post(
  '/:id/start',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id }
    });
    
    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }
    
    // Create or update progress
    const progress = await prisma.progress.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId: id
        }
      },
      update: {
        lastAccessedAt: new Date()
      },
      create: {
        userId,
        lessonId: id,
        quizCompleted: false,
        completionRate: 0,
        timeSpent: 0
      }
    });
    
    res.json(
      successResponse(progress, 'Lesson started successfully')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/:id/complete
 * @desc    Mark lesson as complete
 * @access  Private
 */
router.post(
  '/:id/complete',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { timeSpent } = req.body;
    
    const progress = await prisma.progress.update({
      where: {
        userId_lessonId: {
          userId,
          lessonId: id
        }
      },
      data: {
        quizCompleted: true,
        completionRate: 100,
        completedAt: new Date(),
        timeSpent: timeSpent || 0,
        lastAccessedAt: new Date()
      }
    });
    
    res.json(
      successResponse(progress, 'Lesson completed successfully')
    );
  })
);

export default router;