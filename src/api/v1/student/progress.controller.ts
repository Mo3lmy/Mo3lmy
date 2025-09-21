import { Request, Response } from 'express';
import { z } from 'zod';
import { studentProgressService } from '../../../core/progress/student-progress.service';
import { gamificationService } from '../../../core/gamification/gamification.service';
import { successResponse, errorResponse } from '../../../utils/response.utils';
import asyncHandler from 'express-async-handler';

// Validation schemas
const updateProgressSchema = z.object({
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
});

const getLeaderboardSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'all_time']).default('weekly'),
  subjectId: z.string().uuid().optional(),
  grade: z.number().min(1).max(12).optional(),
  limit: z.number().min(1).max(50).default(10),
});

export class ProgressController {
  
  /**
   * @route   GET /api/v1/student/progress
   * @desc    Get complete student progress
   * @access  Private
   */
  getProgress = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    // Get complete progress
    const progress = await studentProgressService.getStudentProgress(req.user.userId);
    
    res.json(
      successResponse(progress, 'Progress retrieved successfully')
    );
  });
  
  /**
   * @route   POST /api/v1/student/progress/update
   * @desc    Update progress with auto-save
   * @access  Private
   */
  updateProgress = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    // Validate input
    const validated = updateProgressSchema.parse(req.body);
    
    // Update progress
    await studentProgressService.updateProgress({
      userId: req.user.userId,
      ...validated,
      data: validated.data || {}
    });
    
    // Award points for certain actions
    if (['lesson_completed', 'quiz_passed'].includes(validated.action)) {
      await gamificationService.earnPoints({
        userId: req.user.userId,
        action: validated.action as any,
        metadata: { lessonId: validated.lessonId },
      });
    }
    
    res.json(
      successResponse(null, 'Progress updated successfully')
    );
  });
  
  /**
   * @route   GET /api/v1/student/progress/subject/:subjectId
   * @desc    Get progress for a specific subject
   * @access  Private
   */
  getSubjectProgress = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    const { subjectId } = req.params;
    
    // Get complete progress
    const fullProgress = await studentProgressService.getStudentProgress(req.user.userId);
    
    // Filter for specific subject
    const subjectProgress = fullProgress.subjectProgress.find(
      sp => sp.subjectId === subjectId
    );
    
    if (!subjectProgress) {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Subject progress not found')
      );
      return;
    }
    
    res.json(
      successResponse(subjectProgress, 'Subject progress retrieved')
    );
  });
  
  /**
   * @route   GET /api/v1/student/progress/statistics
   * @desc    Get learning statistics
   * @access  Private
   */
  getStatistics = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    // Get complete progress
    const progress = await studentProgressService.getStudentProgress(req.user.userId);
    
    res.json(
      successResponse(progress.statistics, 'Statistics retrieved successfully')
    );
  });
  
  /**
   * @route   GET /api/v1/student/progress/achievements
   * @desc    Get user achievements
   * @access  Private
   */
  getAchievements = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    // Get complete progress
    const progress = await studentProgressService.getStudentProgress(req.user.userId);
    
    res.json(
      successResponse(
        {
          achievements: progress.achievements,
          unlocked: progress.achievements.filter(a => a.unlockedAt).length,
          total: progress.achievements.length,
        },
        'Achievements retrieved successfully'
      )
    );
  });
  
  /**
   * @route   GET /api/v1/student/progress/leaderboard
   * @desc    Get leaderboard
   * @access  Private
   */
  getLeaderboard = asyncHandler(async (req: Request, res: Response) => {
    // Validate query params
    const validated = getLeaderboardSchema.parse(req.query);
    
    // Get leaderboard
    const leaderboard = await studentProgressService.getLeaderboard(
      validated.period,
      validated.subjectId,
      validated.grade,
      validated.limit
    );
    
    res.json(
      successResponse(leaderboard, 'Leaderboard retrieved successfully')
    );
  });
  
  /**
   * @route   GET /api/v1/student/progress/learning-path
   * @desc    Get personalized learning path
   * @access  Private
   */
  getLearningPath = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    // Get complete progress
    const progress = await studentProgressService.getStudentProgress(req.user.userId);
    
    res.json(
      successResponse(progress.learningPath, 'Learning path retrieved')
    );
  });
  
  /**
   * @route   GET /api/v1/student/gamification/stats
   * @desc    Get gamification stats
   * @access  Private
   */
  getGamificationStats = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    // Get gamification stats
    const stats = await gamificationService.getUserStats(req.user.userId);
    
    res.json(
      successResponse(stats, 'Gamification stats retrieved')
    );
  });
  
  /**
   * @route   GET /api/v1/student/gamification/challenges
   * @desc    Get daily challenges
   * @access  Private
   */
  getDailyChallenges = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    // Get challenges
    const challenges = await gamificationService.getDailyChallenges(req.user.userId);
    
    res.json(
      successResponse(challenges, 'Challenges retrieved successfully')
    );
  });
  
  /**
   * @route   POST /api/v1/student/gamification/challenges/:challengeId/complete
   * @desc    Complete a challenge
   * @access  Private
   */
  completeChallenge = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    const { challengeId } = req.params;
    
    // Complete challenge
    const reward = await gamificationService.completeChallenge(
      req.user.userId,
      challengeId
    );
    
    res.json(
      successResponse(reward, 'Challenge completed successfully')
    );
  });
  
  /**
   * @route   GET /api/v1/student/gamification/rewards
   * @desc    Get available rewards
   * @access  Private
   */
  getRewards = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    // Get rewards
    const rewards = await gamificationService.getAvailableRewards(req.user.userId);
    
    res.json(
      successResponse(rewards, 'Rewards retrieved successfully')
    );
  });
  
  /**
   * @route   POST /api/v1/student/gamification/rewards/:rewardId/claim
   * @desc    Claim a reward
   * @access  Private
   */
  claimReward = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    const { rewardId } = req.params;
    
    // Claim reward
    const reward = await gamificationService.claimReward({
      userId: req.user.userId,
      rewardId,
    });
    
    res.json(
      successResponse(reward, 'Reward claimed successfully')
    );
  });
}

// Export controller instance
export const progressController = new ProgressController();