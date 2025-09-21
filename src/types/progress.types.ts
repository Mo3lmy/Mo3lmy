// Student Progress Tracking Types
export interface StudentProgress {
  userId: string;
  overallProgress: OverallProgress;
  subjectProgress: SubjectProgress[];
  learningPath: LearningPath;
  achievements: Achievement[];
  statistics: LearningStatistics;
}

export interface OverallProgress {
  totalLessonsCompleted: number;
  totalLessonsAvailable: number;
  completionPercentage: number;
  totalStudyTime: number; // in minutes
  currentStreak: number; // days
  longestStreak: number; // days
  lastActivityDate: Date;
  averageScore: number;
  level: number;
  experiencePoints: number;
  nextLevelXP: number;
}

export interface SubjectProgress {
  subjectId: string;
  subjectName: string;
  grade: number;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  units: UnitProgress[];
  averageScore: number;
  strongTopics: string[];
  weakTopics: string[];
  lastAccessed: Date;
  totalTimeSpent: number; // in minutes
  mastery: MasteryLevel;
}

export interface UnitProgress {
  unitId: string;
  unitTitle: string;
  lessons: LessonProgress[];
  completionPercentage: number;
  averageScore: number;
  status: ProgressStatus;
}

export interface LessonProgress {
  lessonId: string;
  lessonTitle: string;
  status: ProgressStatus;
  completionPercentage: number;
  lastAccessedAt: Date;
  timeSpent: number; // in minutes
  quizScores: QuizScore[];
  videoWatched: boolean;
  noteTaken: boolean;
  exercisesCompleted: number;
  totalExercises: number;
}

export interface QuizScore {
  attemptId: string;
  score: number;
  totalScore: number;
  percentage: number;
  attemptDate: Date;
  timeSpent: number; // in seconds
  passed: boolean;
}

export interface LearningPath {
  currentLesson: {
    lessonId: string;
    lessonTitle: string;
    progress: number;
  };
  nextRecommended: RecommendedLesson[];
  reviewNeeded: ReviewItem[];
  milestones: Milestone[];
}

export interface RecommendedLesson {
  lessonId: string;
  lessonTitle: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: number; // in minutes
  prerequisites: string[];
  skillsToGain: string[];
}

export interface ReviewItem {
  lessonId: string;
  lessonTitle: string;
  lastReviewed: Date;
  retentionScore: number;
  suggestedReviewDate: Date;
  weakConcepts: string[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  unlockedAt?: Date;
  progress?: {
    current: number;
    target: number;
    percentage: number;
  };
  rewards?: {
    xp?: number;
    coins?: number;
    badge?: string;
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface LearningStatistics {
  totalStudyTime: number; // in minutes
  averageSessionTime: number; // in minutes
  studyFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  bestSubject: {
    name: string;
    score: number;
  };
  improvementRate: number; // percentage
  quizAccuracy: number; // percentage
  topSkills: string[];
  learningVelocity: number; // lessons per week
  consistencyScore: number; // 0-100
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  requirements: {
    lessonsToComplete?: string[];
    minScore?: number;
    totalStudyTime?: number;
  };
  reward?: {
    xp: number;
    coins: number;
    badge?: string;
    certificate?: string;
  };
}

export interface Leaderboard {
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
  entries: LeaderboardEntry[];
  userRank?: number;
  totalParticipants: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatar?: string;
  score: number;
  level: number;
  achievementCount: number;
  change: number; // position change from previous period
}

// Enums
export type ProgressStatus = 
  | 'NOT_STARTED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'REVIEWED';

export type MasteryLevel = 
  | 'BEGINNER' 
  | 'INTERMEDIATE' 
  | 'ADVANCED' 
  | 'EXPERT';

export type AchievementCategory = 
  | 'ACADEMIC' 
  | 'CONSISTENCY' 
  | 'SPEED' 
  | 'PERFECTION' 
  | 'SOCIAL' 
  | 'SPECIAL';

// Progress Update Types
export interface ProgressUpdate {
  userId: string;
  lessonId: string;
  action: ProgressAction;
  data: any;
}

export type ProgressAction = 
  | 'lesson_started'
  | 'lesson_completed'
  | 'video_watched'
  | 'quiz_attempted'
  | 'quiz_passed'
  | 'exercise_completed'
  | 'note_added'
  | 'time_tracked';