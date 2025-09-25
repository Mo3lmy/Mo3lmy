import axios, { AxiosInstance, AxiosError } from 'axios'
import { AuthResponse, User } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

class ApiService {
  private api: AxiosInstance
  private token: string | null = null

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token')
    }

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.logout()
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
        }
        return Promise.reject(error.response?.data || error.message)
      }
    )
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token)
    }
  }

  logout() {
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
    }
  }

  // Auth endpoints
  async register(data: {
    email: string
    password: string
    firstName: string
    lastName: string
    grade?: number
  }): Promise<AuthResponse> {
    const response = await this.api.post('/api/v1/auth/register', data)
    if (response.data.success && response.data.data?.token) {
      this.setToken(response.data.data.token)
      return response.data
    }
    throw new Error(response.data.message || 'Registration failed')
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.api.post('/api/v1/auth/login', { email, password })
    if (response.data.success && response.data.data?.token) {
      this.setToken(response.data.data.token)
      return response.data
    }
    throw new Error(response.data.message || 'Login failed')
  }

  async getMe(): Promise<User> {
    const response = await this.api.get('/api/v1/auth/me')
    return response.data
  }

  async verifyToken(): Promise<boolean> {
    try {
      const response = await this.api.post('/api/v1/auth/verify')
      return response.data.success || false
    } catch {
      return false
    }
  }

  // Lessons endpoints
  async getLessons() {
    const response = await this.api.get('/api/v1/lessons')
    return response.data
  }

  async getLesson(id: string) {
    return await this.api.get(`/api/v1/lessons/${id}`)
  }

  async getLessonById(id: string) {
    const response = await this.api.get(`/api/v1/lessons/${id}`)
    return response.data
  }

  async getLessonSlides(id: string, options?: { theme?: string; generateVoice?: boolean; generateTeaching?: boolean }) {
    const params = new URLSearchParams()
    if (options?.theme) params.append('theme', options.theme)
    if (options?.generateVoice) params.append('generateVoice', 'true')
    if (options?.generateTeaching) params.append('generateTeaching', 'true')

    return await this.api.get(`/api/v1/lessons/${id}/slides?${params}`)
  }

  async generateTeachingScript(lessonId: string, slideContent: any, options?: any) {
    return await this.api.post(`/api/v1/lessons/${lessonId}/teaching/script`, {
      slideContent,
      generateVoice: true,
      options
    })
  }

  async handleStudentInteraction(lessonId: string, type: string, currentSlide?: any, context?: any) {
    return await this.api.post(`/api/v1/lessons/${lessonId}/teaching/interaction`, {
      type,
      currentSlide,
      context
    })
  }

  // Quiz endpoints
  async startQuiz(lessonId: string, questionCount?: number) {
    return await this.api.post('/api/v1/quiz/start', { lessonId, questionCount })
  }

  async submitAnswer(attemptId: string, questionId: string, answer: string, timeSpent: number) {
    return await this.api.post('/api/v1/quiz/answer', {
      attemptId,
      questionId,
      answer,
      timeSpent
    })
  }

  async completeQuiz(attemptId: string) {
    return await this.api.post(`/api/v1/quiz/complete/${attemptId}`)
  }

  async getQuizHistory() {
    return await this.api.get('/api/v1/quiz/history')
  }

  async getQuizStatistics(lessonId: string) {
    return await this.api.get(`/api/v1/quiz/statistics/${lessonId}`)
  }

  async generateQuiz(lessonId: string, count?: number, difficulty?: string) {
    return await this.api.post('/api/v1/quiz/generate', { lessonId, count, difficulty })
  }

  // RAG endpoints
  async askQuestion(question: string, lessonId?: string) {
    return await this.api.post('/api/rag/answer', { question, lessonId })
  }

  async generateQuizQuestions(lessonId: string, count: number) {
    return await this.api.post('/api/rag/quiz-questions', { lessonId, count })
  }

  async explainConcept(concept: string, lessonId?: string) {
    return await this.api.post('/api/rag/explain-concept', { concept, lessonId })
  }

  async explainWrongAnswer(question: string, wrongAnswer: string, userId: string) {
    return await this.api.post('/api/rag/wrong-answer', { question, wrongAnswer, userId })
  }

  // Teaching endpoints
  async generateSmartLesson(lessonId: string, options?: any) {
    return await this.api.post(`/api/v1/lessons/${lessonId}/teaching/smart-lesson`, options)
  }

  async getSmartLessonStatus(lessonId: string) {
    return await this.api.get(`/api/v1/lessons/${lessonId}/teaching/status`)
  }

  // Student context endpoints - Mock for now since backend doesn't have these yet
  async getStudentContext(userId: string) {
    // Mock response for now
    return {
      success: true,
      data: {
        xp: 150,
        level: 2,
        streak: 3,
        rank: 15,
        totalStudyTime: 240,
        lessonsCompleted: 5,
        quizzesPassed: 3,
        perfectScores: 1
      }
    }
  }

  async updateStudentContext(userId: string, data: any) {
    // Mock response
    return { success: true, data }
  }

  async getEmotionalState(userId: string) {
    // Mock response
    return {
      success: true,
      data: {
        mood: 'happy',
        energy: 7,
        focus: 8,
        timestamp: new Date().toISOString()
      }
    }
  }

  async updateEmotionalState(userId: string, state: any) {
    // Mock response
    return { success: true, data: state }
  }

  async getLearningPatterns(userId: string) {
    // Mock response
    return { success: true, data: [] }
  }

  async getRecommendations(userId: string) {
    // Mock response
    return { success: true, data: [] }
  }

  // Achievements endpoints - Mock for now
  async getAchievements(userId: string) {
    // Mock response
    return {
      success: true,
      data: []
    }
  }

  async unlockAchievement(userId: string, achievementId: string) {
    return await this.api.post(`/api/v1/achievements/${userId}/unlock`, { achievementId })
  }

  async getAchievementProgress(userId: string) {
    return await this.api.get(`/api/v1/achievements/${userId}/progress`)
  }

  async getLeaderboard() {
    return await this.api.get('/api/v1/achievements/leaderboard')
  }

  // Parent reports endpoints
  async getLatestParentReport(userId: string) {
    return await this.api.get(`/api/v1/parent-reports/${userId}/latest`)
  }

  async getParentReportHistory(userId: string) {
    return await this.api.get(`/api/v1/parent-reports/${userId}/history`)
  }

  async generateParentReport(userId: string) {
    return await this.api.post(`/api/v1/parent-reports/${userId}/generate`)
  }

  async sendParentReportEmail(userId: string, email: string) {
    return await this.api.post(`/api/v1/parent-reports/${userId}/send-email`, { email })
  }

  // Chat endpoints
  async sendChatMessage(message: string, sessionId?: string) {
    return await this.api.post('/api/v1/chat/message', { message, sessionId })
  }

  async getChatHistory(sessionId?: string) {
    return await this.api.get('/api/v1/chat/history', { params: { sessionId } })
  }

  async getChatSuggestions(context?: string) {
    return await this.api.get('/api/v1/chat/suggestions', { params: { context } })
  }
}

export const apiService = new ApiService()
export default apiService