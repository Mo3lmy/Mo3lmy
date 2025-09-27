import { z } from 'zod';
import { prisma } from '../../config/database.config';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { studentProgressService } from '../progress/student-progress.service';

// Types
interface PointsTransaction {
  userId: string;
  points: number;
  reason: string;
  type: 'earned' | 'spent' | 'bonus';
  metadata?: any;
}

interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  requirements: ChallengeRequirement[];
  rewards: ChallengeReward;
  expiresAt: Date;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface ChallengeRequirement {
  type: 'complete_lessons' | 'quiz_score' | 'study_time' | 'streak';
  target: number;
  current?: number;
}

interface ChallengeReward {
  points: number;
  coins?: number;
  badge?: string;
  multiplier?: number;
}

interface UserStats {
  totalPoints: number;
  currentCoins: number;
  level: number;
  nextLevelProgress: number;
  rank: number;
  badges: Badge[];
  streakDays: number;
  multiplier: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: Date;
}

interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: 'avatar' | 'theme' | 'powerup' | 'certificate';
  available: boolean;
}

// Validation schemas
const earnPointsSchema = z.object({
  userId: z.string().min(1), // Accept any non-empty string
  action: z.enum([
    'lesson_completed',
    'quiz_perfect',
    'quiz_passed',
    'daily_login',
    'streak_bonus',
    'achievement_unlocked',
    'challenge_completed',
    'helper_bonus'
  ]),
  metadata: z.any().optional(),
});

const claimRewardSchema = z.object({
  userId: z.string().min(1), // Accept any non-empty string
  rewardId: z.string(),
});

export class GamificationService {
  
  private readonly POINT_VALUES = {
    lesson_completed: 100,
    quiz_perfect: 200,
    quiz_passed: 50,
    daily_login: 20,
    streak_bonus: 30,
    achievement_unlocked: 150,
    challenge_completed: 250,
    helper_bonus: 50,
  };
  
  private readonly LEVEL_THRESHOLDS = [
    0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, // Levels 1-10
    5500, 6600, 7800, 9100, 10500, // Levels 11-15
    12000, 13600, 15300, 17100, 19000, // Levels 16-20
  ];
  
  /**
   * Earn points for an action
   */
  async earnPoints(data: z.infer<typeof earnPointsSchema>): Promise<PointsTransaction> {
    console.log(`🎯 Earning points for ${data.action}`);
    
    // Validate input
    const validated = earnPointsSchema.parse(data);
    
    // Calculate base points
    let points = this.POINT_VALUES[validated.action];
    
    // Apply multipliers
    const multiplier = await this.getCurrentMultiplier(validated.userId);
    points = Math.round(points * multiplier);
    
    // Apply streak bonus
    if (validated.action === 'lesson_completed') {
      const streakBonus = await this.calculateStreakBonus(validated.userId);
      points += streakBonus;
    }
    
    // Record transaction
    await this.recordPointsTransaction({
      userId: validated.userId,
      points,
      reason: validated.action,
      type: 'earned',
      metadata: validated.metadata,
    });
    
    // Update user profile
    await prisma.profile.update({
      where: { userId: validated.userId },
      data: {
        points: { increment: points },
      }
    });
    
    // Check for level up
    await this.checkLevelUp(validated.userId);
    
    // Check for new badges
    await this.checkBadges(validated.userId);
    
    return {
      userId: validated.userId,
      points,
      reason: validated.action,
      type: 'earned',
      metadata: validated.metadata,
    };
  }
  
  /**
   * Get user gamification stats
   */
  async getUserStats(userId: string): Promise<UserStats> {
    console.log(`📊 Getting gamification stats for user ${userId}`);
    
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    
    if (!profile) {
      throw new NotFoundError('User profile');
    }
    
    // Get badges
    const badges = await this.getUserBadges(userId);
    
    // Get rank
    const rank = await this.getUserRank(userId);
    
    // Calculate level progress
    const currentLevelThreshold = this.LEVEL_THRESHOLDS[profile.level - 1] || 0;
    const nextLevelThreshold = this.LEVEL_THRESHOLDS[profile.level] || 999999;
    const progressPoints = profile.points - currentLevelThreshold;
    const requiredPoints = nextLevelThreshold - currentLevelThreshold;
    const nextLevelProgress = Math.round((progressPoints / requiredPoints) * 100);
    
    // Get current multiplier
    const multiplier = await this.getCurrentMultiplier(userId);
    
    return {
      totalPoints: profile.points,
      currentCoins: profile.coins,
      level: profile.level,
      nextLevelProgress,
      rank,
      badges,
      streakDays: profile.streak,
      multiplier,
    };
  }
  
  /**
   * Get daily challenges
   */
  async getDailyChallenges(userId: string): Promise<DailyChallenge[]> {
    console.log(`🎮 Getting daily challenges for user ${userId}`);
    
    // Check if challenges exist for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let challenges = await prisma.dailyChallenge.findMany({
      where: {
        userId,
        date: { gte: today },
      }
    });
    
    // Generate new challenges if needed
    if (challenges.length === 0) {
      challenges = await this.generateDailyChallenges(userId);
    }
    
    // Format challenges with progress
    const formattedChallenges: DailyChallenge[] = [];
    
    for (const challenge of challenges) {
      const challengeId = challenge.challengeId;
      // Get challenge details (mock for now)
      const challengeData = {
        title: 'التحدي اليومي',
        description: 'أكمل المهام المطلوبة',
        difficulty: 'medium' as const,
        requirements: [{ type: 'complete_lessons' as const, target: 2 }],
        rewards: { points: 150, coins: 20 }
      };
      
      const progress = await this.getChallengeProgress(userId, challengeData);
      
      formattedChallenges.push({
        id: challenge.id,
        title: challengeData.title,
        description: challengeData.description,
        requirements: progress,
        rewards: challengeData.rewards,
        expiresAt: new Date(challenge.date.getTime() + 24 * 60 * 60 * 1000),
        difficulty: challengeData.difficulty,
      });
    }
    
    return formattedChallenges;
  }
  
  /**
   * Complete a challenge
   */
  async completeChallenge(userId: string, challengeId: string): Promise<ChallengeReward> {
    console.log(`✅ Completing challenge ${challengeId}`);
    
    const challenge = await prisma.dailyChallenge.findUnique({
      where: { id: challengeId },
    });
    
    if (!challenge || challenge.userId !== userId) {
      throw new NotFoundError('Challenge');
    }
    
    if (challenge.completed) {
      throw new ValidationError('Challenge already completed');
    }
    
    const challengeData = {
      rewards: {
        points: 250,
        coins: 50
      }
    };
    
    // Award rewards
    await this.earnPoints({
      userId,
      action: 'challenge_completed',
      metadata: { challengeId },
    });
    
    if (challengeData.rewards.coins) {
      await prisma.profile.update({
        where: { userId },
        data: {
          coins: { increment: challengeData.rewards.coins },
        }
      });
    }
    
    // Mark as completed
    await prisma.dailyChallenge.update({
      where: { id: challengeId },
      data: {
        completed: true,
      }
    });
    
    return challengeData.rewards;
  }
  
  /**
   * Get available rewards
   */
  async getAvailableRewards(userId: string): Promise<Reward[]> {
    console.log(`🎁 Getting available rewards`);
    
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    
    if (!profile) {
      throw new NotFoundError('User profile');
    }
    
    // Get all rewards
    const allRewards = await this.getAllRewards();
    
    // Get claimed rewards
    const claimed = await prisma.claimedReward.findMany({
      where: { userId },
    });
    
    const claimedIds = new Set(claimed.map(c => c.rewardType));
    
    // Mark availability based on coins
    return allRewards.map(reward => ({
      ...reward,
      available: profile.coins >= reward.cost && !claimedIds.has(reward.id),
    }));
  }
  
  /**
   * Claim a reward
   */
  async claimReward(data: z.infer<typeof claimRewardSchema>): Promise<Reward> {
    console.log(`🏆 Claiming reward ${data.rewardId}`);
    
    // Validate input
    const validated = claimRewardSchema.parse(data);
    
    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { userId: validated.userId },
    });
    
    if (!profile) {
      throw new NotFoundError('User profile');
    }
    
    // Get reward
    const rewards = await this.getAllRewards();
    const reward = rewards.find(r => r.id === validated.rewardId);
    
    if (!reward) {
      throw new NotFoundError('Reward');
    }
    
    // Check if already claimed
    const existing = await prisma.claimedReward.findFirst({
      where: {
        userId: validated.userId,
        rewardType: validated.rewardId,
      }
    });
    
    if (existing) {
      throw new ValidationError('Reward already claimed');
    }
    
    // Check coins
    if (profile.coins < reward.cost) {
      throw new ValidationError('Insufficient coins');
    }
    
    // Deduct coins and claim reward
    await prisma.$transaction([
      prisma.profile.update({
        where: { userId: validated.userId },
        data: {
          coins: { decrement: reward.cost },
        }
      }),
      prisma.claimedReward.create({
        data: {
          userId: validated.userId,
          rewardType: validated.rewardId,
          points: reward.cost, // Add points field
          claimedAt: new Date(),
        }
      })
    ]);
    
    return reward;
  }
  
  /**
   * Get leaderboard
   */
  async getLeaderboard(
    type: 'points' | 'streak' | 'level',
    period: 'daily' | 'weekly' | 'monthly' | 'all_time',
    limit: number = 10
  ): Promise<any[]> {
    console.log(`🏅 Getting ${type} leaderboard for ${period}`);
    
    // Use progress service for main leaderboard
    if (type === 'points') {
      return (await studentProgressService.getLeaderboard(period, undefined, undefined, limit)).entries;
    }
    
    // Get streak leaderboard
    if (type === 'streak') {
      const profiles = await prisma.profile.findMany({
        orderBy: { streak: 'desc' },
        take: limit,
        include: { user: true },
      });
      
      return profiles.map((profile, index) => ({
        rank: index + 1,
        userId: profile.userId,
        userName: `${profile.user.firstName} ${profile.user.lastName}`,
        streak: profile.streak,
        avatar: profile.avatar,
      }));
    }
    
    // Get level leaderboard
    if (type === 'level') {
      const profiles = await prisma.profile.findMany({
        orderBy: [
          { level: 'desc' },
          { points: 'desc' },
        ],
        take: limit,
        include: { user: true },
      });
      
      return profiles.map((profile, index) => ({
        rank: index + 1,
        userId: profile.userId,
        userName: `${profile.user.firstName} ${profile.user.lastName}`,
        level: profile.level,
        points: profile.points,
        avatar: profile.avatar,
      }));
    }
    
    return [];
  }
  
  // Helper methods
  
  private async recordPointsTransaction(transaction: PointsTransaction): Promise<void> {
    // Would store in a transactions table
    console.log('Recording points transaction:', transaction);
  }
  
  private async getCurrentMultiplier(userId: string): Promise<number> {
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    
    if (!profile) return 1;
    
    let multiplier = 1;
    
    // Streak multiplier
    if (profile.streak >= 7) multiplier += 0.1;
    if (profile.streak >= 14) multiplier += 0.1;
    if (profile.streak >= 30) multiplier += 0.2;
    
    // Weekend bonus
    const day = new Date().getDay();
    if (day === 0 || day === 6) multiplier += 0.2;
    
    return multiplier;
  }
  
  private async calculateStreakBonus(userId: string): Promise<number> {
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    
    if (!profile) return 0;
    
    // 10 points per streak day, max 300
    return Math.min(profile.streak * 10, 300);
  }
  
  private async checkLevelUp(userId: string): Promise<void> {
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    
    if (!profile) return;
    
    // Find new level
    let newLevel = 1;
    for (let i = 0; i < this.LEVEL_THRESHOLDS.length; i++) {
      if (profile.points >= this.LEVEL_THRESHOLDS[i]) {
        newLevel = i + 1;
      } else {
        break;
      }
    }
    
    // Update if leveled up
    if (newLevel > profile.level) {
      await prisma.profile.update({
        where: { userId },
        data: {
          level: newLevel,
          coins: { increment: 100 * (newLevel - profile.level) }, // 100 coins per level
        }
      });
      
      // Unlock level badge
      await this.unlockBadge(userId, `level_${newLevel}`);
    }
  }
  
  private async checkBadges(userId: string): Promise<void> {
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    
    if (!profile) return;
    
    // Check point milestones
    if (profile.points >= 1000) await this.unlockBadge(userId, 'thousand_points');
    if (profile.points >= 5000) await this.unlockBadge(userId, 'five_thousand_points');
    if (profile.points >= 10000) await this.unlockBadge(userId, 'ten_thousand_points');
    
    // Check streak milestones
    if (profile.streak >= 7) await this.unlockBadge(userId, 'week_streak');
    if (profile.streak >= 30) await this.unlockBadge(userId, 'month_streak');
    if (profile.streak >= 100) await this.unlockBadge(userId, 'hundred_day_streak');
  }
  
  private async unlockBadge(userId: string, badgeId: string): Promise<void> {
    // Check if already unlocked
    const existing = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId: badgeId,
        }
      }
    });
    
    if (!existing) {
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId: badgeId,
          points: 100, // Default points for badges
          title: 'إنجاز جديد',
          description: 'لقد حصلت على إنجاز جديد!',
          unlockedAt: new Date(),
        }
      });
    }
  }
  
  private async getUserBadges(userId: string): Promise<Badge[]> {
    const achievements = await prisma.userAchievement.findMany({
      where: { userId },
    });
    
    // Mock badge details since achievement relation is not available
    return achievements.map(a => ({
      id: a.achievementId,
      name: 'إنجاز',
      description: 'وصف الإنجاز',
      icon: '🏆',
      rarity: 'common' as const,
      unlockedAt: a.unlockedAt,
    }));
  }
  
  private async getUserRank(userId: string): Promise<number> {
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    
    if (!profile) return 0;
    
    const higherRanked = await prisma.profile.count({
      where: {
        points: { gt: profile.points },
      }
    });
    
    return higherRanked + 1;
  }
  
  private async generateDailyChallenges(userId: string): Promise<any[]> {
    const challenges = [];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    // Easy challenge
    challenges.push({
      userId,
      challengeId: 'easy_daily',
      date: new Date(),
      completed: false,
      progress: 0,
    });
    
    // Medium challenge
    challenges.push({
      userId,
      challengeId: 'medium_daily',
      date: new Date(),
      completed: false,
      progress: 0,
    });
    
    // Hard challenge
    challenges.push({
      userId,
      challengeId: 'hard_daily',
      date: new Date(),
      completed: false,
      progress: 0,
    });
    
    // Save to database
    const created = await prisma.dailyChallenge.createMany({
      data: challenges,
    });
    
    return await prisma.dailyChallenge.findMany({
      where: {
        userId,
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }
    });
  }
  
  private async getChallengeProgress(
    userId: string,
    challengeData: any
  ): Promise<ChallengeRequirement[]> {
    const requirements = [...challengeData.requirements];
    
    for (const req of requirements) {
      switch (req.type) {
        case 'complete_lessons':
          const todayProgress = await prisma.progress.count({
            where: {
              userId,
              status: 'COMPLETED',
              completedAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              }
            }
          });
          req.current = todayProgress;
          break;
          
        case 'quiz_score':
          const todayQuizzes = await prisma.quizAttempt.findMany({
            where: {
              userId,
              createdAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              }
            }
          });
          
          const bestScore = todayQuizzes.reduce((max, q) => {
            const percentage = (q.score || 0) / (q.totalQuestions * 10) * 100;
            return Math.max(max, percentage);
          }, 0);
          
          req.current = Math.round(bestScore);
          break;
          
        case 'study_time':
          const todayTime = await prisma.progress.aggregate({
            where: {
              userId,
              updatedAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              }
            },
            _sum: {
              timeSpent: true,
            }
          });
          
          req.current = todayTime._sum.timeSpent || 0;
          break;
          
        case 'streak':
          const profile = await prisma.profile.findUnique({
            where: { userId },
          });
          req.current = profile?.streak || 0;
          break;
      }
    }
    
    return requirements;
  }
  
  private async getAllRewards(): Promise<Reward[]> {
    // Define all available rewards
    return [
      {
        id: 'avatar_ninja',
        name: 'صورة النينجا',
        description: 'صورة رمزية مميزة للنينجا',
        cost: 100,
        type: 'avatar',
        available: true,
      },
      {
        id: 'avatar_wizard',
        name: 'صورة الساحر',
        description: 'صورة رمزية للساحر الحكيم',
        cost: 150,
        type: 'avatar',
        available: true,
      },
      {
        id: 'theme_dark',
        name: 'الوضع الداكن',
        description: 'مظهر داكن أنيق للتطبيق',
        cost: 200,
        type: 'theme',
        available: true,
      },
      {
        id: 'theme_ocean',
        name: 'مظهر المحيط',
        description: 'مظهر بألوان المحيط الهادئة',
        cost: 250,
        type: 'theme',
        available: true,
      },
      {
        id: 'powerup_hint',
        name: 'قوة التلميح',
        description: 'احصل على تلميحات إضافية في الاختبارات',
        cost: 300,
        type: 'powerup',
        available: true,
      },
      {
        id: 'powerup_time',
        name: 'قوة الوقت',
        description: 'وقت إضافي في الاختبارات المحددة بوقت',
        cost: 350,
        type: 'powerup',
        available: true,
      },
      {
        id: 'certificate_bronze',
        name: 'شهادة برونزية',
        description: 'شهادة إنجاز برونزية',
        cost: 500,
        type: 'certificate',
        available: true,
      },
      {
        id: 'certificate_silver',
        name: 'شهادة فضية',
        description: 'شهادة إنجاز فضية',
        cost: 1000,
        type: 'certificate',
        available: true,
      },
      {
        id: 'certificate_gold',
        name: 'شهادة ذهبية',
        description: 'شهادة إنجاز ذهبية',
        cost: 2000,
        type: 'certificate',
        available: true,
      },
    ];
  }
}

// Export singleton instance
export const gamificationService = new GamificationService();