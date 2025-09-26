// src/types/quiz.types.ts

export interface QuizSession {
  id: string;
  userId: string;
  lessonId: string;
  questions: QuizQuestion[];
  answers: UserAnswer[];
  startedAt: Date;
  completedAt?: Date;
  timeLimit?: number; // in seconds
  score?: number;
  passed?: boolean;
  
  //  Enhanced session fields
  mode?: 'practice' | 'test' | 'challenge';
  lives?: number;
  streakCount?: number;
  bonusPoints?: number;
}

export interface QuizQuestion {
  id: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER' | 'PROBLEM' | 'ESSAY';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  explanation?: string;
  points: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  timeLimit?: number; // seconds per question
  hint?: string;
  
  //  Enhanced question fields
  tags?: string[];
  timeBonus?: number;
  learningObjective?: string;
  stepByStepSolution?: string[];
  requiresSteps?: boolean;
  order?: number;

  // Enhanced fields for PROBLEM type
  showCalculator?: boolean;
  allowPartialCredit?: boolean;
  formulaSheet?: string[];
}

export interface UserAnswer {
  questionId: string;
  answer: string | number | boolean;
  isCorrect?: boolean;
  timeSpent: number; // seconds
  attemptNumber: number;
  submittedAt: Date;
  
  //  Enhanced answer fields
  confidence?: number; // 0-100
  hintsUsed?: number;
}

export interface QuizResult {
  attemptId: string;
  userId: string;
  lessonId: string;
  score: number;
  totalScore: number;
  percentage: number;
  passed: boolean;
  timeSpent: number;
  correctAnswers: number;
  totalQuestions: number;
  questionResults: QuestionResult[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  
  //  Enhanced result fields
  achievements?: string[];
  nextSteps?: string[];
  insights?: string[];
  avgTimePerQuestion?: number;
  streakBonus?: number;
  performanceLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface QuestionResult {
  questionId: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  points: number;
  explanation?: string;
  timeSpent: number;
  
  //  Enhanced result fields
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  type?: 'MCQ' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER' | 'PROBLEM' | 'ESSAY';
  hintsUsed?: number;
  timeBonus?: number;
}

export interface QuizStatistics {
  totalAttempts: number;
  averageScore: number;
  passRate: number;
  averageTimeSpent: number;
  mostDifficultQuestions: string[];
  easiestQuestions: string[];
  commonMistakes: {
    questionId: string;
    errorRate: number;
    commonWrongAnswers: string[];
  }[];
  
  //  Enhanced statistics
  averageStreakLength?: number;
  bestStreak?: number;
  totalAchievements?: number;
  difficultyDistribution?: {
    easy: number;
    medium: number;
    hard: number;
  };
}

export interface LearningAnalytics {
  userId: string;
  subjectId?: string;
  strengths: {
    topic: string;
    score: number;
    confidence: number;
  }[];
  weaknesses: {
    topic: string;
    score: number;
    needsReview: boolean;
  }[];
  progress: {
    date: Date;
    score: number;
    lessonsCompleted: number;
  }[];
  recommendedLessons: string[];
  estimatedMasteryLevel: number; // 0-100
  
  //  Enhanced analytics
  learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  preferredDifficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  averageSessionTime?: number;
  totalPointsEarned?: number;
  currentLevel?: number;
  nextLevelPoints?: number;
}

//  interfaces for enhanced features
export interface QuizPerformance {
  userId: string;
  totalAttempts: number;
  correctAnswers: number;
  averageTime: number;
  streakCount: number;
  lastDifficulty: 'EASY' | 'MEDIUM' | 'HARD';
  level: 'beginner' | 'intermediate' | 'advanced';
}

export interface QuizGenerationOptions {
  lessonId: string;
  count: number;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  userId?: string;
  mixTypes?: boolean;
  adaptiveDifficulty?: boolean;
  includeHints?: boolean;
}

export interface AnswerSubmissionResult {
  isCorrect: boolean;
  explanation?: string;
  pointsEarned: number;
  streakBonus?: number;
  hint?: string;
  nextQuestion?: QuizQuestion;
  achievementUnlocked?: string;
}

export interface StudyPlan {
  userId: string;
  lessonId: string;
  days: number;
  dailyPlan: {
    day: number;
    topic: string;
    time: string;
    exercises: string[];
  }[];
  tips: string[];
  estimatedCompletion: Date;
}