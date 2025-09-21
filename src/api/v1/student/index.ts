import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware';
import { progressController } from './progress.controller';
import { z } from 'zod';

const router = Router();

// ============= PROGRESS ROUTES =============

/**
 * @route   GET /api/v1/student/progress
 * @desc    Get complete student progress
 * @access  Private
 */
router.get(
  '/progress',
  authenticate,
  progressController.getProgress
);

/**
 * @route   POST /api/v1/student/progress/update
 * @desc    Update progress with auto-save
 * @access  Private
 */
router.post(
  '/progress/update',
  authenticate,
  validateBody(z.object({
    lessonId: z.string().uuid(),
    action: z.enum([
      'lesson_started',
      'lesson_completed',
      'video_watched',
      'quiz_attempted',
      'quiz_passed',
      'exercise_completed',
      'note_added',
      'time_tracked'
    ]),
    data: z.any().optional(),
  })),
  progressController.updateProgress
);

/**
 * @route   GET /api/v1/student/progress/subject/:subjectId
 * @desc    Get progress for a specific subject
 * @access  Private
 */
router.get(
  '/progress/subject/:subjectId',
  authenticate,
  validateParams(z.object({
    subjectId: z.string().uuid(),
  })),
  progressController.getSubjectProgress
);

/**
 * @route   GET /api/v1/student/progress/statistics
 * @desc    Get learning statistics
 * @access  Private
 */
router.get(
  '/progress/statistics',
  authenticate,
  progressController.getStatistics
);

/**
 * @route   GET /api/v1/student/progress/achievements
 * @desc    Get user achievements
 * @access  Private
 */
router.get(
  '/progress/achievements',
  authenticate,
  progressController.getAchievements
);

/**
 * @route   GET /api/v1/student/progress/leaderboard
 * @desc    Get leaderboard
 * @access  Private
 */
router.get(
  '/progress/leaderboard',
  authenticate,
  validateQuery(z.object({
    period: z.enum(['daily', 'weekly', 'monthly', 'all_time']).default('weekly'),
    subjectId: z.string().uuid().optional(),
    grade: z.string().transform(Number).pipe(z.number().min(1).max(12)).optional(),
    limit: z.string().default('10').transform(Number).pipe(z.number().min(1).max(50)),
  })),
  progressController.getLeaderboard
);

/**
 * @route   GET /api/v1/student/progress/learning-path
 * @desc    Get personalized learning path
 * @access  Private
 */
router.get(
  '/progress/learning-path',
  authenticate,
  progressController.getLearningPath
);

// ============= GAMIFICATION ROUTES =============

/**
 * @route   GET /api/v1/student/gamification/stats
 * @desc    Get gamification stats
 * @access  Private
 */
router.get(
  '/gamification/stats',
  authenticate,
  progressController.getGamificationStats
);

/**
 * @route   GET /api/v1/student/gamification/challenges
 * @desc    Get daily challenges
 * @access  Private
 */
router.get(
  '/gamification/challenges',
  authenticate,
  progressController.getDailyChallenges
);

/**
 * @route   POST /api/v1/student/gamification/challenges/:challengeId/complete
 * @desc    Complete a challenge
 * @access  Private
 */
router.post(
  '/gamification/challenges/:challengeId/complete',
  authenticate,
  validateParams(z.object({
    challengeId: z.string().uuid(),
  })),
  progressController.completeChallenge
);

/**
 * @route   GET /api/v1/student/gamification/rewards
 * @desc    Get available rewards
 * @access  Private
 */
router.get(
  '/gamification/rewards',
  authenticate,
  progressController.getRewards
);

/**
 * @route   POST /api/v1/student/gamification/rewards/:rewardId/claim
 * @desc    Claim a reward
 * @access  Private
 */
router.post(
  '/gamification/rewards/:rewardId/claim',
  authenticate,
  validateParams(z.object({
    rewardId: z.string(),
  })),
  progressController.claimReward
);

export default router;