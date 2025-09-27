export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'STUDENT' | 'TEACHER' | 'PARENT' | 'ADMIN'
  grade?: number
  gender?: 'male' | 'female'
  avatar?: string
  createdAt: string
  updatedAt: string
}

export interface AuthResponse {
  success: boolean
  data?: {
    token: string
    user: User
  }
  token?: string
  user?: User
  message?: string
}

export interface EmotionalState {
  mood: 'happy' | 'neutral' | 'sad' | 'confused' | 'tired'
  energy: number // 1-10
  focus: number // 1-10
  timestamp: string
}

export interface Lesson {
  id: string
  title: string
  titleAr: string
  description: string
  duration: number
  difficulty: 'easy' | 'medium' | 'hard'
  keyPoints: string[]
  unit: {
    id: string
    name: string
    nameAr: string
    subject: {
      id: string
      name: string
      nameAr: string
      color: string
      icon: string
    }
  }
  progress?: number
  isCompleted?: boolean
  lastAccessedAt?: string
}

export interface Achievement {
  id: string
  name: string
  nameAr: string
  description: string
  descriptionAr: string
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
  points: number
  unlockedAt?: string
  progress?: number
  maxProgress?: number
}

export interface StudentStats {
  xp: number
  level: number
  streak: number
  rank: number
  totalStudyTime: number
  lessonsCompleted: number
  quizzesPassed: number
  perfectScores: number
  achievements: Achievement[]
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer?: string
  explanation?: string
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
}

export interface QuizAttempt {
  id: string
  lessonId: string
  userId: string
  questions: QuizQuestion[]
  score: number
  totalQuestions: number
  completedAt?: string
  timeSpent: number
  streak: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: {
    emotion?: EmotionalState
    lessonContext?: string
  }
}

export interface TeachingScript {
  script: string
  duration: number
  keyPoints: string[]
  examples?: string[]
  problem?: {
    question: string
    solution: string
    hints: string[]
  }
  visualCues?: string[]
  interactionPoints?: string[]
  emotionalTone: 'encouraging' | 'neutral' | 'energetic' | 'calm'
  nextSuggestions: string[]
  audioUrl?: string
}

export interface ProgressData {
  overall: number
  subjects: {
    id: string
    name: string
    progress: number
    lastActivity: string
  }[]
  weeklyActivity: {
    day: string
    hours: number
    lessonsCompleted: number
  }[]
  strengths: string[]
  weaknesses: string[]
  emotionalJourney: {
    date: string
    mood: EmotionalState['mood']
    productivity: number
  }[]
}

export interface ParentReport {
  studentId: string
  studentName: string
  period: 'weekly' | 'monthly'
  attendance: number
  averageScore: number
  lessonsCompleted: number
  studyHours: number
  emotionalStates: EmotionalState[]
  recommendations: string[]
  strengths: string[]
  areasOfImprovement: string[]
  generatedAt: string
}