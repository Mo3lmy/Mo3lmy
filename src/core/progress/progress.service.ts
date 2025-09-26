// cspell:disable
import { prisma } from '../../config/database.config';
import type { Progress, User, Lesson, Subject } from '@prisma/client';
import type { LearningAnalytics } from '../../types/quiz.types';

export class ProgressTrackingService {
  
  /**
   * Get user's overall progress
   */
  async getUserProgress(userId: string): Promise<{
    overall: {
      lessonsStarted: number;
      lessonsCompleted: number;
      completionRate: number;
      totalTimeSpent: number;
      currentStreak: number;
      longestStreak: number;
    };
    bySubject: Array<{
      subject: Subject;
      progress: number;
      lessonsCompleted: number;
      totalLessons: number;
    }>;
    recentActivity: Progress[];
  }> {
    // Get all user progress
    const progress = await prisma.progress.findMany({
      where: { userId },
      include: {
        lesson: {
          include: {
            unit: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
    });
    
    // Calculate overall stats
    const lessonsStarted = progress.length;
    const lessonsCompleted = progress.filter(p => p.status === 'COMPLETED').length;
    const completionRate = lessonsStarted > 0 
      ? (lessonsCompleted / lessonsStarted) * 100 
      : 0;
    const totalTimeSpent = progress.reduce((sum, p) => sum + p.timeSpent, 0);
    
    // Calculate streaks
    const { currentStreak, longestStreak } = await this.calculateStreaks(userId);
    
    // Group by subject
    const subjectMap = new Map<string, {
      subject: Subject;
      completed: number;
      total: number;
      totalProgress: number;
    }>();
    
    for (const p of progress) {
      const subjectId = p.lesson.unit.subject.id;
      const existing = subjectMap.get(subjectId) || {
        subject: p.lesson.unit.subject,
        completed: 0,
        total: 0,
        totalProgress: 0,
      };
      
      existing.total++;
      existing.totalProgress += p.completionRate;
      if (p.status === 'COMPLETED') {
        existing.completed++;
      }
      
      subjectMap.set(subjectId, existing);
    }
    
    // Get total lessons per subject for accurate progress
    const bySubject = await Promise.all(
      Array.from(subjectMap.values()).map(async (item) => {
        const totalLessons = await prisma.lesson.count({
          where: {
            unit: {
              subjectId: item.subject.id,
            },
            isPublished: true,
          },
        });
        
        return {
          subject: item.subject,
          progress: item.total > 0 
            ? Math.round(item.totalProgress / item.total)
            : 0,
          lessonsCompleted: item.completed,
          totalLessons,
        };
      })
    );
    
    // Get recent activity
    const recentActivity = progress
      .sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime())
      .slice(0, 5);
    
    return {
      overall: {
        lessonsStarted,
        lessonsCompleted,
        completionRate: Math.round(completionRate),
        totalTimeSpent,
        currentStreak,
        longestStreak,
      },
      bySubject,
      recentActivity,
    };
  }
  
  /**
   * Calculate learning streaks
   */
  private async calculateStreaks(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
  }> {
    // Get all progress sorted by date
    const progress = await prisma.progress.findMany({
      where: { userId },
      orderBy: { lastAccessedAt: 'desc' },
    });
    
    if (progress.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }
    
    // Calculate streaks based on consecutive days
    const dates = progress.map(p => 
      new Date(p.lastAccessedAt).toDateString()
    );
    const uniqueDates = [...new Set(dates)].sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;
    
    // Check if today or yesterday is in the list for current streak
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
      currentStreak = 1;
      
      for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = new Date(uniqueDates[i - 1]);
        const currDate = new Date(uniqueDates[i]);
        const diffDays = Math.floor(
          (prevDate.getTime() - currDate.getTime()) / 86400000
        );
        
        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
    
    // Calculate longest streak
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const diffDays = Math.floor(
        (prevDate.getTime() - currDate.getTime()) / 86400000
      );
      
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    
    longestStreak = Math.max(longestStreak, tempStreak, currentStreak);
    
    return { currentStreak, longestStreak };
  }
  
  /**
   * Get lesson progress
   */
  async getLessonProgress(
    userId: string,
    lessonId: string
  ): Promise<Progress | null> {
    return await prisma.progress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      include: {
        lesson: true,
      },
    });
  }
  
  /**
   * Update lesson progress
   */
  async updateLessonProgress(
    userId: string,
    lessonId: string,
    data: {
      videoWatched?: boolean;
      quizCompleted?: boolean;
      completionRate?: number;
      timeSpent?: number;
    }
  ): Promise<Progress> {
    const existing = await this.getLessonProgress(userId, lessonId);
    
    if (existing) {
      // Update existing progress
      return await prisma.progress.update({
        where: {
          userId_lessonId: {
            userId,
            lessonId,
          },
        },
        data: {
          ...data,
          timeSpent: existing.timeSpent + (data.timeSpent || 0),
          lastAccessedAt: new Date(),
          status: data.completionRate === 100 ? 'COMPLETED' : 'IN_PROGRESS',
          completedAt: data.completionRate === 100 ? new Date() : undefined,
        },
      });
    } else {
      // Create new progress
      return await prisma.progress.create({
        data: {
          userId,
          lessonId,
          ...data,
          timeSpent: data.timeSpent || 0,
          status: data.completionRate === 100 ? 'COMPLETED' : 'IN_PROGRESS',
          completedAt: data.completionRate === 100 ? new Date() : undefined,
        },
      });
    }
  }
  
  /**
   * Get learning analytics
   */
  async getLearningAnalytics(
    userId: string,
    subjectId?: string
  ): Promise<LearningAnalytics> {
    // If subjectId is provided, get lesson IDs first
    let lessonIds: string[] | undefined;

    if (subjectId) {
      const lessons = await prisma.lesson.findMany({
        where: {
          unit: { subjectId }
        },
        select: { id: true }
      });
      lessonIds = lessons.map(l => l.id);
    }

    // Get all quiz attempts
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        userId,
        ...(lessonIds && { lessonId: { in: lessonIds } })
      },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    // Get lesson details separately
    const lessonsMap = new Map<string, any>();
    for (const attempt of attempts) {
      if (!lessonsMap.has(attempt.lessonId)) {
        const lesson = await prisma.lesson.findUnique({
          where: { id: attempt.lessonId },
          include: {
            unit: {
              include: {
                subject: true,
              },
            },
          },
        });
        if (lesson) {
          lessonsMap.set(attempt.lessonId, lesson);
        }
      }
    }
    
    // Analyze strengths and weaknesses
    const topicPerformance = new Map<string, {
      correct: number;
      total: number;
      attempts: number;
    }>();
    
    attempts.forEach(attempt => {
      const lesson = lessonsMap.get(attempt.lessonId);
      if (!lesson) return;
      
      const topic = lesson.title;
      const perf = topicPerformance.get(topic) || {
        correct: 0,
        total: 0,
        attempts: 0,
      };
      
      perf.correct += attempt.correctAnswers;
      perf.total += attempt.totalQuestions;
      perf.attempts++;
      
      topicPerformance.set(topic, perf);
    });
    
    // Convert to strengths and weaknesses
    const topics = Array.from(topicPerformance.entries()).map(([topic, perf]) => ({
      topic,
      score: (perf.correct / perf.total) * 100,
      confidence: Math.min(perf.attempts * 20, 100),
    }));
    
    const strengths = topics
      .filter(t => t.score >= 70)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(t => ({
        topic: t.topic,
        score: Math.round(t.score),
        confidence: t.confidence,
      }));
    
    const weaknesses = topics
      .filter(t => t.score < 70)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map(t => ({
        topic: t.topic,
        score: Math.round(t.score),
        needsReview: t.score < 50,
      }));
    
    // Progress over time
    const progressData = attempts
      .slice(0, 30)
      .reverse()
      .map(a => ({
        date: a.createdAt,
        score: a.score || 0,
        lessonsCompleted: 1,
      }));
    
    // Recommended lessons
    const recommendedLessons = weaknesses
      .filter(w => w.needsReview)
      .map(w => w.topic)
      .slice(0, 3);
    
    // Calculate mastery level
    const overallScore = topics.reduce((sum, t) => sum + t.score, 0) / (topics.length || 1);
    const estimatedMasteryLevel = Math.round(Math.min(overallScore, 100));
    
    return {
      userId,
      subjectId,
      strengths,
      weaknesses,
      progress: progressData,
      recommendedLessons,
      estimatedMasteryLevel,
    };
  }
  
  /**
   * Get leaderboard
   */
  async getLeaderboard(
    subjectId?: string,
    grade?: number,
    limit: number = 10
  ): Promise<Array<{
    rank: number;
    user: Partial<User>;
    score: number;
    lessonsCompleted: number;
    badges: string[];
  }>> {
    // If subjectId is provided, get user IDs who have progress in this subject
    let userIds: string[] | undefined;

    if (subjectId) {
      // Use a workaround for distinct since Prisma may have issues with it
      const progress = await prisma.progress.findMany({
        where: {
          lesson: {
            unit: { subjectId }
          }
        },
        select: { userId: true }
      });
      // Manually get unique user IDs
      userIds = [...new Set(progress.map(p => p.userId))];
    }

    // Get users with their progress
    const users = await prisma.user.findMany({
      where: {
        ...(userIds && { id: { in: userIds } }),
        ...(grade && { grade })
      },
      include: {
        progress: {
          where: {
            status: 'COMPLETED'
          }
        },
        quizAttempts: {
          where: {
            completedAt: {
              not: null
            }
          },
          select: {
            score: true
          }
        }
      },
      take: limit * 2 // Get more users to account for filtering
    });
    
    // Calculate scores
    const userScores = users.map(user => {
      const lessonsCompleted = user.progress.length;
      const avgQuizScore = user.quizAttempts.length > 0
        ? user.quizAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / user.quizAttempts.length
        : 0;
      
      // Combined score: 50% completion + 50% quiz performance
      const score = (lessonsCompleted * 10) + (avgQuizScore * 5);
      
      // Badges based on achievements
      const badges: string[] = [];
      if (lessonsCompleted >= 10) badges.push('🏆 محترف');
      if (lessonsCompleted >= 5) badges.push('⭐ متقدم');
      if (avgQuizScore >= 90) badges.push('🎯 دقيق');
      if (user.quizAttempts.length >= 20) badges.push('💪 مثابر');
      
      return {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        score: Math.round(score),
        lessonsCompleted,
        badges,
      };
    });
    
    // Sort and rank
    userScores.sort((a, b) => b.score - a.score);
    
    return userScores.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      ...item,
    }));
  }
  
  /**
   * Award achievement badges
   */
  async checkAndAwardBadges(userId: string): Promise<string[]> {
    const newBadges: string[] = [];
    
    const progress = await this.getUserProgress(userId);
    
    // Check for various achievements
    if (progress.overall.lessonsCompleted >= 1 && !await this.hasBadge(userId, 'first_lesson')) {
      newBadges.push('🎓 البداية الموفقة');
      await this.awardBadge(userId, 'first_lesson');
    }
    
    if (progress.overall.lessonsCompleted >= 10 && !await this.hasBadge(userId, 'ten_lessons')) {
      newBadges.push('🌟 عشرة دروس');
      await this.awardBadge(userId, 'ten_lessons');
    }
    
    if (progress.overall.currentStreak >= 7 && !await this.hasBadge(userId, 'week_streak')) {
      newBadges.push('🔥 أسبوع متواصل');
      await this.awardBadge(userId, 'week_streak');
    }
    
    if (progress.overall.completionRate >= 80 && !await this.hasBadge(userId, 'high_completion')) {
      newBadges.push('💯 إنجاز عالي');
      await this.awardBadge(userId, 'high_completion');
    }
    
    return newBadges;
  }
  
  private async hasBadge(userId: string, badge: string): Promise<boolean> {
    // This would check a badges table
    // For now, return false
    return false;
  }
  
  private async awardBadge(userId: string, badge: string): Promise<void> {
    // This would save to a badges table
    console.log(`🏅 Awarding badge ${badge} to user ${userId}`);
  }
}

// Export singleton instance
export const progressService = new ProgressTrackingService();