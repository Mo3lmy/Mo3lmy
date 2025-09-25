import { create } from 'zustand'
import { EmotionalState, StudentStats, Achievement, Lesson } from '@/types'
import apiService from '@/services/api'
import socketService from '@/services/socket'

interface StudentState {
  // State
  emotionalState: EmotionalState & { current: string }
  stats: StudentStats
  currentLesson: Lesson | null
  achievements: Achievement[]
  recentAchievements: Achievement[]
  isConnected: boolean

  // Actions
  updateEmotionalState: (state: Partial<EmotionalState & { current: string }>) => void
  updateEmotionalEnergy: (energy: number) => void
  updateXP: (xp: number) => void
  updateStreak: (streak: number) => void
  setStats: (stats: StudentStats) => void
  setCurrentLesson: (lesson: Lesson | null) => void
  addAchievement: (achievement: Achievement) => void
  setAchievements: (achievements: Achievement[]) => void
  setConnectionStatus: (status: boolean) => void
  loadStudentData: (userId: string) => Promise<void>
  joinLesson: (lessonId: string) => void
  leaveLesson: () => void
}

export const useStudentStore = create<StudentState>((set, get) => ({
  // Initial state
  emotionalState: {
    mood: 'neutral',
    current: 'neutral',
    energy: 70,
    focus: 7,
    timestamp: new Date().toISOString()
  },
  stats: {
    xp: 0,
    level: 1,
    streak: 0,
    rank: 0,
    totalStudyTime: 0,
    lessonsCompleted: 0,
    quizzesPassed: 0,
    perfectScores: 0,
    achievements: []
  },
  currentLesson: null,
  achievements: [],
  recentAchievements: [],
  isConnected: false,

  // Actions
  updateEmotionalState: (state) => {
    set(prev => ({
      emotionalState: { ...prev.emotionalState, ...state }
    }))
    // Send to WebSocket
    const updatedState = { ...get().emotionalState, ...state }
    socketService.updateEmotionalState(updatedState)
  },

  updateEmotionalEnergy: (energy) => {
    set(prev => ({
      emotionalState: { ...prev.emotionalState, energy }
    }))
  },

  updateXP: (xp) => {
    set(prev => ({
      stats: { ...prev.stats, xp: prev.stats.xp + xp }
    }))
  },

  updateStreak: (streak) => {
    set(prev => ({
      stats: { ...prev.stats, streak }
    }))
  },

  setStats: (stats) => set({ stats }),

  setCurrentLesson: (lesson) => {
    const previousLesson = get().currentLesson

    // Leave previous lesson if exists
    if (previousLesson && previousLesson.id !== lesson?.id) {
      socketService.leaveLesson(previousLesson.id)
    }

    // Join new lesson
    if (lesson) {
      socketService.joinLesson(lesson.id)
    }

    set({ currentLesson: lesson })
  },

  addAchievement: (achievement) => {
    const achievements = [...get().achievements, achievement]
    const recentAchievements = [...get().recentAchievements, achievement].slice(-5)
    set({ achievements, recentAchievements })

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      set(state => ({
        recentAchievements: state.recentAchievements.filter(a => a.id !== achievement.id)
      }))
    }, 5000)
  },

  setAchievements: (achievements) => set({ achievements }),

  setConnectionStatus: (status) => set({ isConnected: status }),

  loadStudentData: async (userId) => {
    try {
      // Load all data in parallel to avoid timeouts
      const [achievementsResponse, emotionalResponse, contextResponse] = await Promise.all([
        apiService.getAchievements(userId).catch(() => ({ success: false, data: [] })),
        apiService.getEmotionalState(userId).catch(() => ({
          success: false,
          data: { mood: 'neutral' as const, energy: 7, focus: 7, timestamp: new Date().toISOString() }
        })),
        apiService.getStudentContext(userId).catch(() => ({
          success: false,
          data: {
            xp: 0,
            level: 1,
            streak: 0,
            rank: 0,
            totalStudyTime: 0,
            lessonsCompleted: 0,
            quizzesPassed: 0,
            perfectScores: 0
          }
        }))
      ])

      if (achievementsResponse.success) {
        set({ achievements: achievementsResponse.data || [] })
      }

      if (emotionalResponse.success && emotionalResponse.data) {
        set({ emotionalState: {
          ...emotionalResponse.data,
          current: emotionalResponse.data.mood
        } })
      }

      if (contextResponse.success && contextResponse.data) {
        const stats: StudentStats = {
          xp: contextResponse.data.xp || 0,
          level: contextResponse.data.level || 1,
          streak: contextResponse.data.streak || 0,
          rank: contextResponse.data.rank || 0,
          totalStudyTime: contextResponse.data.totalStudyTime || 0,
          lessonsCompleted: contextResponse.data.lessonsCompleted || 0,
          quizzesPassed: contextResponse.data.quizzesPassed || 0,
          perfectScores: contextResponse.data.perfectScores || 0,
          achievements: get().achievements
        }
        set({ stats })
      }
    } catch (error) {
      console.error('Failed to load student data:', error)
    }
  },

  joinLesson: (lessonId) => {
    socketService.joinLesson(lessonId)
  },

  leaveLesson: () => {
    const currentLesson = get().currentLesson
    if (currentLesson) {
      socketService.leaveLesson(currentLesson.id)
      set({ currentLesson: null })
    }
  }
}))