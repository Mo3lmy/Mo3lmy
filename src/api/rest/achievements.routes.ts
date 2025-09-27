import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.config';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Get user achievements
router.get('/:userId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  // Authorization check - المستخدم يرى إنجازاته فقط أو المعلم/الأدمن/ولي الأمر
  const userRole = req.user!.role as string;
  if (req.user!.userId !== userId &&
      userRole !== 'TEACHER' &&
      userRole !== 'ADMIN' &&
      userRole !== 'PARENT') {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'غير مصرح لك بالوصول لهذه البيانات')
    );
    return;
  }
  const achievements = await prisma.userAchievement.findMany({
    where: { userId: req.params.userId },
    orderBy: { unlockedAt: 'desc' }
  });

  res.json(successResponse(achievements));
}));

// Unlock achievement
router.post('/:userId/unlock', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  // Authorization check - فقط النظام أو المعلم يمكنه منح الإنجازات
  if (req.user!.userId !== userId &&
      req.user!.role !== 'TEACHER' &&
      req.user!.role !== 'ADMIN') {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'غير مصرح لك بمنح الإنجازات')
    );
    return;
  }

  const { achievementId, title, description, points = 100, category = 'academic', icon = '🏆' } = req.body;

  // Check if already unlocked
  const existing = await prisma.userAchievement.findFirst({
    where: {
      userId,
      achievementId
    }
  });

  if (existing) {
    res.json(successResponse(existing, 'Achievement already unlocked'));
    return;
  }

  const achievement = await prisma.userAchievement.create({
    data: {
      userId,
      achievementId,
      points,
      title,
      description,
      icon: icon || '🏆',
      category: category || 'academic',
      rarity: 'common',
      progress: 100
    } as any
  });

  res.json(successResponse(achievement, 'Achievement unlocked!'));
}))

// Get progress
router.get('/:userId/progress', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  // Authorization check
  const userRole = req.user!.role as string;
  if (req.user!.userId !== userId &&
      userRole !== 'TEACHER' &&
      userRole !== 'ADMIN' &&
      userRole !== 'PARENT') {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'غير مصرح لك بالوصول لهذه البيانات')
    );
    return;
  }
  // Access StudentContext through the generated Prisma client
  const context = await (prisma as any).studentContext.findUnique({
    where: { userId }
  });

  const progress = {
    xp: context?.correctAnswers ? context.correctAnswers * 10 : 0,
    level: context?.currentLevel || 1,
    nextLevelXP: ((context?.currentLevel || 1) + 1) * 1000,
    percentage: ((context?.correctAnswers || 0) * 10) % 1000 / 10
  };

  res.json(successResponse(progress));
}));

// Get leaderboard - Public endpoint لعرض لوحة المتصدرين
router.get('/leaderboard/top', asyncHandler(async (_req: Request, res: Response) => {
  // Access StudentContext through the generated Prisma client
  const contexts = await (prisma as any).studentContext.findMany({
    orderBy: { correctAnswers: 'desc' },
    take: 10
  });

  // Get user details for each context
  const leaderboard = await Promise.all(
    contexts.map(async (context: any) => {
      const user = await prisma.user.findUnique({
        where: { id: context.userId },
        select: { firstName: true, lastName: true }
      });
      return {
        firstName: user?.firstName || 'Unknown',
        lastName: user?.lastName || 'User',
        correctAnswers: context.correctAnswers,
        level: context.currentLevel,
        xp: context.correctAnswers * 10
      };
    })
  );

  res.json(successResponse(leaderboard));
}));

export default router;