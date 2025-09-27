import { z } from 'zod';
import { prisma } from '../../config/database.config';
import { NotFoundError } from '../../utils/errors';
import type {
  StudentProgress,
  OverallProgress,
  SubjectProgress,
  LessonProgress,
  LearningPath,
  Achievement,
  LearningStatistics,
  ProgressUpdate,
  ProgressStatus,
  Leaderboard,
  LeaderboardEntry,
  Milestone
} from '../../types/progress.types';

// Validation schemas
const progressUpdateSchema = z.object({
  userId: z.string().min(1), // Accept any non-empty string
  lessonId: z.string().min(1), // Accept any non-empty string
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
  data: z.any(),
});

export class StudentProgressService {
  
  /**
   * Get complete student progress
   */
  async getStudentProgress(userId: string): Promise<StudentProgress> {
    console.log(`📊 Getting progress for user ${userId}`);
    
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });
    
    if (!user) {
      throw new NotFoundError('User');
    }
    
    // Get all progress data in parallel
    const [
      overallProgress,
      subjectProgress,
      learningPath,
      achievements,
      statistics
    ] = await Promise.all([
      this.calculateOverallProgress(userId),
      this.getSubjectProgress(userId),
      this.generateLearningPath(userId),
      this.getUserAchievements(userId),
      this.calculateLearningStatistics(userId)
    ]);
    
    return {
      userId,
      overallProgress,
      subjectProgress,
      learningPath,
      achievements,
      statistics,
    };
  }
  
  /**
   * Update progress with auto-save
   */
  async updateProgress(update: z.infer<typeof progressUpdateSchema>): Promise<void> {
    console.log(`📝 Updating progress: ${update.action}`);
    
    // Validate input
    const validated = progressUpdateSchema.parse(update);
    
    // Get or create progress record
    const progress = await prisma.progress.upsert({
      where: {
        userId_lessonId: {
          userId: validated.userId,
          lessonId: validated.lessonId,
        }
      },
      update: {
        lastAccessedAt: new Date(),
        ...this.getProgressUpdateData(validated.action, validated.data),
      },
      create: {
        userId: validated.userId,
        lessonId: validated.lessonId,
        status: 'IN_PROGRESS',
        lastAccessedAt: new Date(),
      }
    });
    
    // Handle specific actions
    await this.handleProgressAction(validated);
    
    // Check for achievements
    await this.checkAndUnlockAchievements(validated.userId);
    
    // Update user stats
    await this.updateUserStats(validated.userId);
  }
  
  /**
   * Calculate overall progress
   */
  private async calculateOverallProgress(userId: string): Promise<OverallProgress> {
    // Get all user progress
    const progress = await prisma.progress.findMany({
      where: { userId },
      include: { lesson: true }
    });
    
    // Get total lessons available for user's grade
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });
    
    const totalLessons = await prisma.lesson.count({
      where: {
        unit: {
          subject: {
            grade: user?.grade || 6
          }
        }
      }
    });
    
    // Calculate completed lessons
    const completedLessons = progress.filter(p => p.status === 'COMPLETED').length;
    
    // Calculate total study time
    const totalStudyTime = progress.reduce((sum, p) => sum + p.timeSpent, 0);
    
    // Get streak data
    const { currentStreak, longestStreak } = await this.calculateStreaks(userId);
    
    // Get last activity
    const lastActivity = progress.sort((a, b) => 
      b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime()
    )[0];
    
    // Calculate average score from quizzes
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: { userId, completedAt: { not: null } }
    });
    
    const avgScore = quizAttempts.length > 0
      ? quizAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / quizAttempts.length
      : 0;
    
    // Get level and XP
    const profile = user?.profile || { level: 1, points: 0 };
    const nextLevelXP = this.calculateXPForLevel(profile.level + 1);
    
    return {
      totalLessonsCompleted: completedLessons,
      totalLessonsAvailable: totalLessons,
      completionPercentage: Math.round((completedLessons / totalLessons) * 100),
      totalStudyTime,
      currentStreak,
      longestStreak,
      lastActivityDate: lastActivity?.lastAccessedAt || new Date(),
      averageScore: Math.round(avgScore),
      level: profile.level || 1,
      experiencePoints: profile.points || 0,
      nextLevelXP,
    };
  }
  
  /**
   * Get subject-wise progress
   */
  private async getSubjectProgress(userId: string): Promise<SubjectProgress[]> {
    // Get user's grade
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    // Get all subjects for user's grade
    const subjects = await prisma.subject.findMany({
      where: { grade: user?.grade || 6 },
      include: {
        units: {
          include: {
            lessons: {
              include: {
                progress: {
                  where: { userId }
                }
              }
            }
          }
        }
      }
    });
    
    const subjectProgressList: SubjectProgress[] = [];
    
    for (const subject of subjects) {
      // Calculate subject statistics
      let totalLessons = 0;
      let completedLessons = 0;
      let totalTimeSpent = 0;
      let totalScore = 0;
      let scoreCount = 0;
      const unitProgressList = [];
      
      for (const unit of subject.units) {
        let unitCompleted = 0;
        let unitTotal = unit.lessons.length;
        let unitScore = 0;
        let unitScoreCount = 0;
        const lessonProgressList = [];
        
        for (const lesson of unit.lessons) {
          totalLessons++;
          const progress = lesson.progress[0];
          
          if (progress) {
            totalTimeSpent += progress.timeSpent;
            
            if (progress.status === 'COMPLETED') {
              completedLessons++;
              unitCompleted++;
            }
            
            // Get quiz scores for this lesson
            const quizScores = await prisma.quizAttempt.findMany({
              where: {
                userId,
                lessonId: lesson.id,
                completedAt: { not: null }
              }
            });
            
            const lessonProgress: LessonProgress = {
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              status: progress.status,
              completionPercentage: progress.completionRate || 0,
              lastAccessedAt: progress.lastAccessedAt,
              timeSpent: progress.timeSpent,
              quizScores: quizScores.map(q => ({
                attemptId: q.id,
                score: q.score || 0,
                totalScore: q.totalQuestions * 10, // Assuming 10 points per question
                percentage: ((q.score || 0) / (q.totalQuestions * 10)) * 100,
                attemptDate: q.createdAt,
                timeSpent: q.timeSpent || 0,
                passed: ((q.score || 0) / (q.totalQuestions * 10)) >= 0.6
              })),
              videoWatched: false, // Would check video progress
              noteTaken: false, // Would check notes
              exercisesCompleted: 0,
              totalExercises: 0,
            };
            
            lessonProgressList.push(lessonProgress);
            
            if (quizScores.length > 0) {
              const avgLessonScore = quizScores.reduce((sum, q) => sum + (q.score || 0), 0) / quizScores.length;
              unitScore += avgLessonScore;
              unitScoreCount++;
              totalScore += avgLessonScore;
              scoreCount++;
            }
          }
        }
        
        unitProgressList.push({
          unitId: unit.id,
          unitTitle: unit.title,
          lessons: lessonProgressList,
          completionPercentage: Math.round((unitCompleted / unitTotal) * 100),
          averageScore: unitScoreCount > 0 ? Math.round(unitScore / unitScoreCount) : 0,
          status: (unitCompleted === unitTotal ? 'COMPLETED' : 
                  unitCompleted > 0 ? 'IN_PROGRESS' : 'NOT_STARTED') as ProgressStatus
        });
      }
      
      // Analyze strong and weak topics
      const { strongTopics, weakTopics } = await this.analyzeTopics(userId, subject.id);
      
      subjectProgressList.push({
        subjectId: subject.id,
        subjectName: subject.name,
        grade: subject.grade,
        progress: {
          completed: completedLessons,
          total: totalLessons,
          percentage: Math.round((completedLessons / totalLessons) * 100)
        },
        units: unitProgressList,
        averageScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
        strongTopics,
        weakTopics,
        lastAccessed: new Date(), // Would get from most recent progress
        totalTimeSpent,
        mastery: this.calculateMasteryLevel(
          (completedLessons / totalLessons) * 100,
          scoreCount > 0 ? totalScore / scoreCount : 0
        )
      });
    }
    
    return subjectProgressList;
  }
  
  /**
   * Generate personalized learning path
   */
  private async generateLearningPath(userId: string): Promise<LearningPath> {
    // Get current progress
    const currentProgress = await prisma.progress.findFirst({
      where: {
        userId,
        status: 'IN_PROGRESS'
      },
      orderBy: { lastAccessedAt: 'desc' },
      include: {
        lesson: {
          include: {
            unit: {
              include: { subject: true }
            }
          }
        }
      }
    });
    
    // Get next recommended lessons
    const nextRecommended = await this.getRecommendedLessons(userId);
    
    // Get lessons that need review
    const reviewNeeded = await this.getLessonsForReview(userId);
    
    // Get milestones
    const milestones = await this.getUserMilestones(userId);
    
    return {
      currentLesson: currentProgress ? {
        lessonId: currentProgress.lessonId,
        lessonTitle: currentProgress.lesson.title,
        progress: currentProgress.completionRate || 0,
      } : {
        lessonId: '',
        lessonTitle: 'لا يوجد درس حالي',
        progress: 0
      },
      nextRecommended,
      reviewNeeded,
      milestones,
    };
  }
  
  /**
   * Get user achievements
   */
  private async getUserAchievements(userId: string): Promise<Achievement[]> {
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId }
    });
    
    // Define all possible achievements
    const allAchievements = await this.getAllAchievements();
    
    return allAchievements.map(achievement => {
      const userAch = userAchievements.find(ua => ua.achievementId === achievement.id);
      
      return {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category as any,
        unlockedAt: userAch?.unlockedAt,
        progress: userAch ? undefined : achievement.progress,
        rewards: achievement.rewards,
        rarity: achievement.rarity as any,
      };
    });
  }
  
  /**
   * Calculate learning statistics
   */
  private async calculateLearningStatistics(userId: string): Promise<LearningStatistics> {
    const progress = await prisma.progress.findMany({
      where: { userId }
    });
    
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: { userId }
    });
    
    // Calculate total study time
    const totalStudyTime = progress.reduce((sum, p) => sum + p.timeSpent, 0);
    
    // Calculate average session time
    const avgSessionTime = progress.length > 0 
      ? Math.round(totalStudyTime / progress.length)
      : 0;
    
    // Calculate study frequency
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const dailyProgress = progress.filter(p => p.lastAccessedAt > dayAgo).length;
    const weeklyProgress = progress.filter(p => p.lastAccessedAt > weekAgo).length;
    const monthlyProgress = progress.filter(p => p.lastAccessedAt > monthAgo).length;
    
    // Find best subject
    const subjectScores = new Map<string, { total: number; count: number }>();
    
    for (const attempt of quizAttempts) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: attempt.lessonId },
        include: {
          unit: {
            include: { subject: true }
          }
        }
      });
      
      if (lesson) {
        const subjectName = lesson.unit.subject.name;
        const current = subjectScores.get(subjectName) || { total: 0, count: 0 };
        current.total += attempt.score || 0;
        current.count++;
        subjectScores.set(subjectName, current);
      }
    }
    
    let bestSubject = { name: 'لم يتم التحديد', score: 0 };
    subjectScores.forEach((data, name) => {
      const avg = data.total / data.count;
      if (avg > bestSubject.score) {
        bestSubject = { name, score: Math.round(avg) };
      }
    });
    
    // Calculate improvement rate
    const recentAttempts = quizAttempts.slice(-10);
    const olderAttempts = quizAttempts.slice(-20, -10);
    
    const recentAvg = recentAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / 
                     (recentAttempts.length || 1);
    const olderAvg = olderAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / 
                    (olderAttempts.length || 1);
    
    const improvementRate = olderAvg > 0 
      ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
      : 0;
    
    // Calculate quiz accuracy
    const correctAnswers = await prisma.quizAttemptAnswer.count({
      where: {
        attempt: { userId },
        isCorrect: true
      }
    });
    
    const totalAnswers = await prisma.quizAttemptAnswer.count({
      where: {
        attempt: { userId }
      }
    });
    
    const quizAccuracy = totalAnswers > 0 
      ? Math.round((correctAnswers / totalAnswers) * 100)
      : 0;
    
    // Get top skills (from completed lessons)
    const completedLessons = await prisma.progress.findMany({
      where: {
        userId,
        status: 'COMPLETED'
      },
      include: {
        lesson: {
          include: { concepts: true }
        }
      },
      take: 10
    });
    
    const topSkills = completedLessons
      .flatMap(p => p.lesson.concepts.map(c => c.name))
      .slice(0, 5);
    
    // Calculate learning velocity
    const completedThisWeek = progress.filter(p => 
      p.status === 'COMPLETED' && p.completedAt && p.completedAt > weekAgo
    ).length;
    
    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(progress);
    
    return {
      totalStudyTime,
      averageSessionTime: avgSessionTime,
      studyFrequency: {
        daily: dailyProgress,
        weekly: weeklyProgress,
        monthly: monthlyProgress,
      },
      bestSubject,
      improvementRate,
      quizAccuracy,
      topSkills,
      learningVelocity: completedThisWeek,
      consistencyScore,
    };
  }
  
  /**
   * Get leaderboard
   */
  async getLeaderboard(
    period: 'daily' | 'weekly' | 'monthly' | 'all_time',
    subjectId?: string,
    grade?: number,
    limit: number = 10
  ): Promise<Leaderboard> {
    console.log(`🏆 Getting ${period} leaderboard`);
    
    // Calculate date range
    const now = new Date();
    let startDate: Date | undefined;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    // Build query filters
    const where: any = {};
    if (grade) where.grade = grade;
    
    // Get all users with their scores
    const users = await prisma.user.findMany({
      where,
      include: {
        profile: true,
        achievements: true,
      }
    });
    
    const entries: LeaderboardEntry[] = [];
    
    for (const user of users) {
      // Calculate score for period
      let score = 0;
      
      if (startDate) {
        // Get points earned in period
        const progressInPeriod = await prisma.progress.findMany({
          where: {
            userId: user.id,
            updatedAt: { gte: startDate }
          }
        });
        
        score = progressInPeriod.length * 10; // 10 points per lesson progress
        
        // Add quiz scores
        const quizzes = await prisma.quizAttempt.findMany({
          where: {
            userId: user.id,
            createdAt: { gte: startDate }
          }
        });
        
        score += quizzes.reduce((sum, q) => sum + (q.score || 0), 0);
      } else {
        // All time score
        score = user.profile?.points || 0;
      }
      
      entries.push({
        rank: 0, // Will be set after sorting
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        avatar: user.profile?.avatar || undefined,
        score,
        level: user.profile?.level || 1,
        achievementCount: user.achievements.length,
        change: 0, // Would calculate from previous period
      });
    }
    
    // Sort by score and assign ranks
    entries.sort((a, b) => b.score - a.score);
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });
    
    // Get user's rank if needed
    const userRank = entries.findIndex(e => e.userId === users[0]?.id) + 1;
    
    return {
      period,
      entries: entries.slice(0, limit),
      userRank: userRank || undefined,
      totalParticipants: entries.length,
    };
  }
  
  // Helper methods
  
  private getProgressUpdateData(action: string, data: any): any {
    const updates: any = {};
    
    switch (action) {
      case 'lesson_started':
        updates.status = 'IN_PROGRESS';
        break;
      case 'lesson_completed':
        updates.status = 'COMPLETED';
        updates.completionRate = 100;
        updates.completedAt = new Date();
        break;
      case 'video_watched':
        updates.videoWatched = true;
        break;
      case 'time_tracked':
        updates.timeSpent = data.timeSpent || 0;
        break;
    }
    
    return updates;
  }
  
  private async handleProgressAction(update: any): Promise<void> {
    // Handle specific actions that need additional processing
    
    if (update.action === 'quiz_passed') {
      // Award points
      await this.awardPoints(update.userId, 50);
    }
    
    if (update.action === 'lesson_completed') {
      // Award points for completion
      await this.awardPoints(update.userId, 100);
      
      // Update streak
      await this.updateStreak(update.userId);
    }
  }
  
  private async checkAndUnlockAchievements(userId: string): Promise<void> {
    // Check various achievement conditions
    
    // Check lesson count achievements
    const completedCount = await prisma.progress.count({
      where: {
        userId,
        status: 'COMPLETED'
      }
    });
    
    if (completedCount === 1) {
      await this.unlockAchievement(userId, 'first_lesson');
    }
    if (completedCount === 10) {
      await this.unlockAchievement(userId, 'ten_lessons');
    }
    if (completedCount === 50) {
      await this.unlockAchievement(userId, 'fifty_lessons');
    }
    
    // Check streak achievements
    const profile = await prisma.profile.findUnique({
      where: { userId }
    });
    
    if (profile?.streak === 7) {
      await this.unlockAchievement(userId, 'week_streak');
    }
    if (profile?.streak === 30) {
      await this.unlockAchievement(userId, 'month_streak');
    }
  }
  
  private async updateUserStats(userId: string): Promise<void> {
    // Update level based on XP
    const profile = await prisma.profile.findUnique({
      where: { userId }
    });
    
    if (profile) {
      const newLevel = this.calculateLevel(profile.points);
      if (newLevel > profile.level) {
        await prisma.profile.update({
          where: { userId },
          data: { level: newLevel }
        });
      }
    }
  }
  
  private async calculateStreaks(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
  }> {
    const profile = await prisma.profile.findUnique({
      where: { userId }
    });
    
    return {
      currentStreak: profile?.streak || 0,
      longestStreak: profile?.streak || 0, // Would track separately
    };
  }
  
  private calculateXPForLevel(level: number): number {
    // XP required for each level (exponential growth)
    return level * level * 100;
  }
  
  private calculateLevel(xp: number): number {
    // Calculate level from XP
    return Math.floor(Math.sqrt(xp / 100));
  }
  
  private calculateMasteryLevel(
    completionPercentage: number,
    averageScore: number
  ): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' {
    const combined = (completionPercentage + averageScore) / 2;
    
    if (combined >= 90) return 'EXPERT';
    if (combined >= 70) return 'ADVANCED';
    if (combined >= 40) return 'INTERMEDIATE';
    return 'BEGINNER';
  }
  
  private async analyzeTopics(userId: string, subjectId: string): Promise<{
    strongTopics: string[];
    weakTopics: string[];
  }> {
    // Analyze quiz performance by topic
    const quizResults = await prisma.quizAttemptAnswer.findMany({
      where: {
        attempt: {
          userId,
          lessonId: {
            in: await prisma.lesson.findMany({
              where: { unit: { subjectId } },
              select: { id: true }
            }).then(lessons => lessons.map(l => l.id))
          }
        }
      },
      include: {
        question: true
      }
    });
    
    // Group by concept and calculate accuracy
    const conceptAccuracy = new Map<string, { correct: number; total: number }>();
    
    quizResults.forEach(result => {
      // Get concept from question (mock for now)
      const conceptName = `مفهوم ${result.questionId}`;
      const current = conceptAccuracy.get(conceptName) || { correct: 0, total: 0 };
      current.total++;
      if (result.isCorrect) current.correct++;
      conceptAccuracy.set(conceptName, current);
    });
    
    const strongTopics: string[] = [];
    const weakTopics: string[] = [];
    
    conceptAccuracy.forEach((data, concept) => {
      const accuracy = data.correct / data.total;
      if (accuracy >= 0.8) strongTopics.push(concept);
      if (accuracy < 0.5) weakTopics.push(concept);
    });
    
    return { strongTopics: strongTopics.slice(0, 3), weakTopics: weakTopics.slice(0, 3) };
  }
  
  private async getRecommendedLessons(userId: string): Promise<any[]> {
    // Get next lessons in sequence
    const lastCompleted = await prisma.progress.findFirst({
      where: {
        userId,
        status: 'COMPLETED'
      },
      orderBy: { completedAt: 'desc' },
      include: {
        lesson: {
          include: {
            unit: true
          }
        }
      }
    });
    
    if (!lastCompleted) {
      // Recommend first lessons
      const firstLessons = await prisma.lesson.findMany({
        where: { order: 1 },
        take: 3
      });
      
      return firstLessons.map(lesson => ({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        reason: 'درس أساسي للبدء',
        priority: 'high',
        estimatedTime: lesson.duration || 30,
        prerequisites: [],
        skillsToGain: [],
      }));
    }
    
    // Get next lesson in unit
    const nextLessons = await prisma.lesson.findMany({
      where: {
        unitId: lastCompleted.lesson.unitId,
        order: { gt: lastCompleted.lesson.order }
      },
      orderBy: { order: 'asc' },
      take: 3
    });
    
    return nextLessons.map(lesson => ({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      reason: 'الدرس التالي في الوحدة',
      priority: 'high',
      estimatedTime: lesson.duration || 30,
      prerequisites: [lastCompleted.lesson.title],
      skillsToGain: [],
    }));
  }
  
  private async getLessonsForReview(userId: string): Promise<any[]> {
    // Get lessons that were completed but with low scores
    const weakLessons = await prisma.progress.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        completedAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // More than a week ago
        }
      },
      include: {
        lesson: true
      },
      orderBy: { completedAt: 'asc' },
      take: 3
    });
    
    return weakLessons.map(progress => ({
      lessonId: progress.lessonId,
      lessonTitle: progress.lesson.title,
      lastReviewed: progress.completedAt || progress.lastAccessedAt,
      retentionScore: 70, // Would calculate based on quiz scores
      suggestedReviewDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      weakConcepts: [],
    }));
  }
  
  private async getUserMilestones(userId: string): Promise<Milestone[]> {
    // Define milestones
    const milestones: Milestone[] = [
      {
        id: 'complete_unit',
        title: 'أكمل وحدة كاملة',
        description: 'أكمل جميع دروس وحدة واحدة',
        targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'in_progress',
        requirements: {
          lessonsToComplete: [], // Would get from current unit
          minScore: 70,
        },
        reward: {
          xp: 500,
          coins: 100,
          badge: 'unit_master',
        }
      },
      {
        id: 'perfect_week',
        title: 'أسبوع مثالي',
        description: 'ادرس كل يوم لمدة أسبوع',
        targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        requirements: {
          totalStudyTime: 420, // 60 minutes * 7 days
        },
        reward: {
          xp: 300,
          coins: 50,
          badge: 'consistency_king',
        }
      }
    ];
    
    return milestones;
  }
  
  private async getAllAchievements(): Promise<any[]> {
    // Define all achievements
    return [
      {
        id: 'first_lesson',
        name: 'البداية الموفقة',
        description: 'أكمل درسك الأول',
        icon: '🎯',
        category: 'ACADEMIC',
        rewards: { xp: 50, coins: 10 },
        rarity: 'common',
        progress: { current: 0, target: 1, percentage: 0 }
      },
      {
        id: 'ten_lessons',
        name: 'متعلم نشط',
        description: 'أكمل 10 دروس',
        icon: '📚',
        category: 'ACADEMIC',
        rewards: { xp: 200, coins: 50 },
        rarity: 'rare',
        progress: { current: 0, target: 10, percentage: 0 }
      },
      {
        id: 'week_streak',
        name: 'أسبوع من الالتزام',
        description: 'ادرس لمدة 7 أيام متتالية',
        icon: '🔥',
        category: 'CONSISTENCY',
        rewards: { xp: 300, coins: 75, badge: 'streak_warrior' },
        rarity: 'epic',
        progress: { current: 0, target: 7, percentage: 0 }
      },
    ];
  }
  
  private async awardPoints(userId: string, points: number): Promise<void> {
    await prisma.profile.update({
      where: { userId },
      data: {
        points: { increment: points }
      }
    });
  }
  
  private async updateStreak(userId: string): Promise<void> {
    const profile = await prisma.profile.findUnique({
      where: { userId }
    });
    
    if (profile) {
      const lastActive = profile.lastActive;
      const now = new Date();
      
      // Check if it's a new day
      if (!lastActive || 
          lastActive.toDateString() !== now.toDateString()) {
        
        // Check if streak continues or resets
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const continuesStreak = lastActive && 
          lastActive.toDateString() === yesterday.toDateString();
        
        await prisma.profile.update({
          where: { userId },
          data: {
            streak: continuesStreak ? { increment: 1 } : 1,
            lastActive: now
          }
        });
      }
    }
  }
  
  private async unlockAchievement(userId: string, achievementId: string): Promise<void> {
    // Check if already unlocked
    const existing = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId
        }
      }
    });
    
    if (!existing) {
      // Get achievement details if table exists
      let achievement: any = null;
      try {
        achievement = await (prisma as any).achievement?.findUnique({
          where: { id: achievementId }
        });
      } catch (e) {
        // Achievement table might not exist
        console.warn('Achievement table not found:', e);
      }

      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId,
          points: achievement?.points || 100,
          title: achievement?.nameAr || achievement?.name || 'إنجاز جديد',
          description: achievement?.descriptionAr || achievement?.description || 'لقد حققت إنجازًا رائعًا!',
          icon: achievement?.icon,
          category: achievement?.category,
          rarity: achievement?.rarity || 'common',
          unlockedAt: new Date()
        }
      });
    }
  }
  
  private calculateConsistencyScore(progress: any[]): number {
    if (progress.length === 0) return 0;
    
    // Sort by date
    const sorted = progress.sort((a, b) => 
      a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime()
    );
    
    // Calculate gaps between sessions
    let totalGapDays = 0;
    let gapCount = 0;
    
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].lastAccessedAt.getTime() - sorted[i-1].lastAccessedAt.getTime();
      const gapDays = gap / (24 * 60 * 60 * 1000);
      
      if (gapDays < 30) { // Ignore very large gaps
        totalGapDays += gapDays;
        gapCount++;
      }
    }
    
    if (gapCount === 0) return 100;
    
    const avgGapDays = totalGapDays / gapCount;
    
    // Score based on average gap (1 day = 100, 7 days = 50, 14+ days = 0)
    if (avgGapDays <= 1) return 100;
    if (avgGapDays <= 3) return 80;
    if (avgGapDays <= 7) return 50;
    if (avgGapDays <= 14) return 20;
    return 0;
  }
}

// Export singleton instance
export const studentProgressService = new StudentProgressService();