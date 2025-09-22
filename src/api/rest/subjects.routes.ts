// 📍 المكان: src/api/rest/subjects.routes.ts
// الوظيفة: API endpoints للمواد الدراسية

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.config';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';

const router = Router();

/**
 * @route   GET /api/v1/subjects
 * @desc    Get all subjects or filtered by grade
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { grade } = req.query;
    const where = grade ? { grade: parseInt(grade as string) } : {};
    
    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { order: 'asc' }
    });
    
    res.json(
      successResponse(subjects, 'Subjects retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/subjects/:id
 * @desc    Get single subject by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        units: {
          orderBy: { order: 'asc' }
        }
      }
    });
    
    if (!subject) {
      res.status(404).json(
        errorResponse('SUBJECT_NOT_FOUND', 'المادة غير موجودة')
      );
      return;
    }
    
    res.json(
      successResponse(subject, 'Subject retrieved successfully')
    );
  })
);

export default router;