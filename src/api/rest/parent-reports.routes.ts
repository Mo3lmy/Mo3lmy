import { Router } from 'express';
import { prisma } from '../../config/database.config';
import { successResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';

const router = Router();

// Get latest report
router.get('/:userId/latest', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  const context = await (prisma as any).studentContext.findUnique({
    where: { userId }
  });

  const recentQuizzes = await prisma.quizAttempt.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  const report = {
    studentName: user?.firstName,
    date: new Date(),
    performance: {
      averageScore: context?.averageScore || 0,
      totalSessions: context?.totalSessions || 0,
      totalLearningTime: context?.totalLearningTime || 0,
      streakCount: context?.streakCount || 0
    },
    emotionalState: {
      currentMood: context?.currentMood || 'neutral',
      averageConfidence: context?.averageConfidence || 70,
      averageEngagement: context?.averageEngagement || 80
    },
    recentQuizzes: recentQuizzes.map(q => ({
      date: q.createdAt,
      score: q.score,
      totalQuestions: q.totalQuestions
    })),
    recommendations: [
      'ممارسة المزيد من التمارين',
      'مراجعة الدروس السابقة',
      'أخذ فترات راحة منتظمة'
    ]
  };

  res.json(successResponse(report));
}));

// Get report history
router.get('/:userId/history', asyncHandler(async (_req, res) => {
  // For now, return empty array
  res.json(successResponse([]));
}));

// Generate new report
router.post('/:userId/generate', asyncHandler(async (req, res) => {
  // Update last report date
  await (prisma as any).studentContext.update({
    where: { userId: req.params.userId },
    data: { lastParentReport: new Date() }
  });

  res.json(successResponse({ message: 'Report generation started' }));
}));

// Send report via email
router.post('/:userId/send-email', asyncHandler(async (req, res) => {
  const { email } = req.body;

  // In production, implement email sending
  res.json(successResponse({
    message: `Report would be sent to ${email}`
  }));
}));

export default router;