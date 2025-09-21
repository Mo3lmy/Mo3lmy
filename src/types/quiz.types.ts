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
}

export interface QuizQuestion {
  id: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  explanation?: string;
  points: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  timeLimit?: number; // seconds per question
  hint?: string;
}

export interface UserAnswer {
  questionId: string;
  answer: string | number | boolean;
  isCorrect?: boolean;
  timeSpent: number; // seconds
  attemptNumber: number;
  submittedAt: Date;
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
}