import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.config';
import { AppError } from '../../utils/errors';

// Type assertion for Prisma client with all models
const db = prisma as any;

const router = Router();

// Temporary auth middleware - replace with actual auth middleware
const authMiddleware = (req: Request, res: Response, next: any) => {
  // TODO: Implement actual auth logic
  next();
};

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get student context
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    let context = await db.studentContext.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            grade: true
          }
        }
      }
    });

    // Create default context if doesn't exist
    if (!context) {
      context = await db.studentContext.create({
        data: {
          userId,
          learningStyle: 'visual',
          preferredDifficulty: 'medium',
          currentLevel: 1,
          totalSessions: 0,
          totalLearningTime: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          averageScore: 0,
          streakCount: 0,
          longestStreak: 0,
          currentMood: 'neutral',
          averageConfidence: 70,
          averageEngagement: 80,
          questionsAsked: 0,
          hintsRequested: 0,
          breaksRequested: 0,
          sessionsCompleted: 0,
          parentNotified: false,
          parentReportFrequency: 'weekly'
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              grade: true
            }
          }
        }
      });
    }

    // Calculate additional metrics
    const totalQuizzes = await db.quizAttempt.count({
      where: { userId }
    });

    const completedLessons = await db.progress.count({
      where: {
        userId,
        completedAt: { not: null }
      }
    });

    const achievements = await db.userAchievement.count({
      where: { userId }
    });

    const response = {
      ...context,
      stats: {
        totalQuizzes,
        completedLessons,
        achievements,
        xp: context.currentLevel * 100 + (context.correctAnswers * 10),
        rank: await calculateRank(userId)
      }
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error getting student context:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get student context'
      }
    });
  }
});

// Update student context
router.put('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    const context = await db.studentContext.update({
      where: { userId },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: context
    });
  } catch (error) {
    console.error('Error updating student context:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update student context'
      }
    });
  }
});

// Get emotional state history
router.get('/:userId/emotional-state', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    const states = await db.emotionalState.findMany({
      where: { userId },
      orderBy: { detectedAt: 'desc' },
      take: Number(limit)
    });

    // Get current context mood
    const context = await db.studentContext.findUnique({
      where: { userId },
      select: {
        currentMood: true,
        averageConfidence: true,
        averageEngagement: true,
        lastMoodUpdate: true
      }
    });

    res.json({
      success: true,
      data: {
        current: {
          mood: context?.currentMood || 'neutral',
          confidence: context?.averageConfidence || 70,
          engagement: context?.averageEngagement || 80,
          lastUpdate: context?.lastMoodUpdate
        },
        history: states
      }
    });
  } catch (error) {
    console.error('Error getting emotional state:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get emotional state'
      }
    });
  }
});

// Update emotional state
router.post('/:userId/emotional-state', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { mood, confidence, engagement, stress, indicators, triggers, lessonId } = req.body;

    // Create new emotional state record
    const state = await db.emotionalState.create({
      data: {
        userId,
        lessonId,
        mood,
        confidence,
        engagement,
        stress: stress || 0,
        indicators: indicators ? JSON.stringify(indicators) : null,
        triggers: triggers ? JSON.stringify(triggers) : null
      }
    });

    // Update student context with latest mood
    await db.studentContext.update({
      where: { userId },
      data: {
        currentMood: mood,
        lastMoodUpdate: new Date(),
        // Update running averages
        averageConfidence: await calculateAverage(userId, 'confidence'),
        averageEngagement: await calculateAverage(userId, 'engagement')
      }
    });

    // Generate system response based on emotional state
    const response = await generateEmotionalResponse(mood, confidence, engagement);

    res.json({
      success: true,
      data: {
        state,
        response
      }
    });
  } catch (error) {
    console.error('Error updating emotional state:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update emotional state'
      }
    });
  }
});

// Get learning patterns
router.get('/:userId/learning-patterns', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get quiz performance patterns
    const quizPatterns = await db.quizAttempt.findMany({
      where: { userId },
      select: {
        lessonId: true,
        score: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Get progress patterns
    const progressPatterns = await db.progress.findMany({
      where: { userId },
      select: {
        lessonId: true,
        completionRate: true,
        timeSpent: true,
        completedAt: true,
        lastAccessedAt: true
      }
    });

    // Get session patterns
    const sessions = await db.learningSession.findMany({
      where: { userId },
      select: {
        lessonId: true,
        interactionCount: true,
        questionsAsked: true,
        hintsRequested: true,
        breaksTaken: true,
        startedAt: true,
        completedAt: true
      },
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    // Analyze patterns
    const analysis = analyzePatterns(quizPatterns, progressPatterns, sessions);

    res.json({
      success: true,
      data: {
        patterns: analysis,
        rawData: {
          quizzes: quizPatterns,
          progress: progressPatterns,
          sessions
        }
      }
    });
  } catch (error) {
    console.error('Error getting learning patterns:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get learning patterns'
      }
    });
  }
});

// Get personalized recommendations
router.get('/:userId/recommendations', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get student context
    const context = await db.studentContext.findUnique({
      where: { userId }
    });

    if (!context) {
      throw new AppError('Student context not found', 404);
    }

    // Get struggling topics
    const strugglingTopics = context.strugglingTopics ?
      JSON.parse(context.strugglingTopics) : [];

    // Get next lessons recommendations
    const nextLessons = await db.lesson.findMany({
      where: {
        difficulty: context.preferredDifficulty
      },
      take: 5
    });

    // Get practice recommendations based on weak areas
    const practiceRecommendations = await generatePracticeRecommendations(
      userId,
      strugglingTopics
    );

    res.json({
      success: true,
      data: {
        nextLessons,
        practiceAreas: practiceRecommendations,
        tips: generateLearningTips(context),
        estimatedTime: calculateEstimatedTime(nextLessons)
      }
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get recommendations'
      }
    });
  }
});

// Helper functions
async function calculateRank(userId: string): Promise<number> {
  // Simple ranking based on XP
  const users = await db.studentContext.findMany({
    select: {
      userId: true,
      currentLevel: true,
      correctAnswers: true
    },
    orderBy: [
      { currentLevel: 'desc' },
      { correctAnswers: 'desc' }
    ]
  });

  const index = users.findIndex((u: any) => u.userId === userId);
  return index + 1;
}

async function calculateAverage(userId: string, field: 'confidence' | 'engagement'): Promise<number> {
  const states = await db.emotionalState.findMany({
    where: { userId },
    select: { [field]: true },
    orderBy: { detectedAt: 'desc' },
    take: 10
  });

  if (states.length === 0) return field === 'confidence' ? 70 : 80;

  const sum = states.reduce((acc: number, state: any) => acc + state[field], 0);
  return Math.round(sum / states.length);
}

async function generateEmotionalResponse(mood: string, confidence: number, engagement: number) {
  const responses: Record<string, any> = {
    happy: {
      message: "رائع! يبدو أنك في مزاج جيد للتعلم",
      suggestions: ["استمر في العمل الجيد", "جرب تحديًا جديدًا"],
      action: "continue"
    },
    confused: {
      message: "لا تقلق، دعني أساعدك في فهم هذا بشكل أفضل",
      suggestions: ["اطلب شرحًا إضافيًا", "جرب مثالًا أبسط"],
      action: "simplify"
    },
    frustrated: {
      message: "أعلم أن هذا صعب، دعنا نأخذ خطوة للخلف",
      suggestions: ["خذ استراحة قصيرة", "جرب طريقة مختلفة"],
      action: "break_suggested"
    },
    bored: {
      message: "هل نحتاج إلى تحدٍ أكبر؟",
      suggestions: ["جرب مستوى أصعب", "انتقل إلى موضوع جديد"],
      action: "increase_difficulty"
    },
    neutral: {
      message: "دعنا نجعل التعلم أكثر متعة!",
      suggestions: ["ابدأ بنشاط تفاعلي", "اختر موضوعًا مثيرًا"],
      action: "engage"
    }
  };

  return responses[mood] || responses.neutral;
}

function analyzePatterns(quizzes: any[], progress: any[], sessions: any[]) {
  return {
    strongSubjects: [],
    weakSubjects: [],
    bestTimeToLearn: "afternoon",
    averageSessionLength: 30,
    learningStyle: "visual",
    focusTrend: "improving"
  };
}

async function getRelevantSubjects(userId: string): Promise<string[]> {
  const progress = await db.progress.findMany({
    where: { userId },
    select: { lessonId: true }
  });

  return progress.map((p: any) => p.lessonId).filter(Boolean);
}

async function generatePracticeRecommendations(userId: string, strugglingTopics: string[]) {
  return strugglingTopics.map(topic => ({
    topic,
    exercises: 5,
    estimatedTime: 15,
    difficulty: 'easy'
  }));
}

function generateLearningTips(context: any) {
  const tips = [];

  if (context.averageConfidence < 50) {
    tips.push("ابدأ بالمفاهيم الأساسية واعمل على بناء ثقتك");
  }

  if (context.streakCount > 5) {
    tips.push("أحسنت! حافظ على استمراريتك");
  }

  if (context.breaksRequested > 3) {
    tips.push("خذ فترات راحة منتظمة للحفاظ على التركيز");
  }

  return tips;
}

function calculateEstimatedTime(lessons: any[]): number {
  return lessons.reduce((total, lesson) => total + (lesson.estimatedDuration || 30), 0);
}

export default router;