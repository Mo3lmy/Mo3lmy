import axios from 'axios'
import { AuthResponse, User } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'


class ApiService {
  private api: any
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
      try {
        const authStorage = localStorage.getItem('auth-storage')
        if (authStorage) {
          const authData = JSON.parse(authStorage)
          this.token = authData.state?.token || null
        }
      } catch (error) {
        console.warn('Failed to load token from localStorage:', error)
        this.token = null
      }
    }

    // Request interceptor
    this.api.interceptors.request.use(
      (config: any) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`
        }
        return config
      },
      (error: any) => Promise.reject(this.formatError(error))
    )

    // Response interceptor
    this.api.interceptors.response.use(
      (response: any) => {
        console.log('API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data
        });
        return this.handleResponse(response)
      },
      (error: any) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.logout()
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
        }
        return Promise.reject(this.formatError(error))
      }
    )
  }

  private handleResponse(response: any) {
    // Normalize response format
    if (response.data && typeof response.data === 'object') {
      // If response has both success and data fields, return as is
      if ('success' in response.data && 'data' in response.data) {
        return response.data
      }
      // If response has data directly, wrap it
      if (!('success' in response.data)) {
        return {
          success: true,
          data: response.data
        }
      }
    }
    return response.data
  }

  private formatError(error: any): Error {
    let message = 'An unexpected error occurred'

    if (error.response?.data) {
      const data = error.response.data
      // Check for error field with message
      if (data.error?.message) {
        message = data.error.message
      }
      // Check for direct message field
      else if (data.message) {
        message = data.message
      }
    } else if (error.message) {
      message = error.message
    }

    // Network errors
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        message = 'Request timeout - please try again'
      } else if (error.message === 'Network Error') {
        message = 'Cannot connect to server - please check your connection'
      }
    }

    const formattedError = new Error(message)
    ;(formattedError as any).statusCode = error.response?.status
    ;(formattedError as any).code = error.response?.data?.error?.code || error.code

    return formattedError
  }

  setToken(token: string) {
    this.token = token
    // Note: Token is primarily managed by the authStore via zustand persist
    // This method is called when login/register is successful
  }

  logout() {
    this.token = null
    // Note: localStorage cleanup is primarily handled by authStore
  }

  // HTTP methods helpers
  async get(url: string, config?: any) {
    return this.api.get(url, config)
  }

  async post(url: string, data?: any, config?: any) {
    return this.api.post(url, data, config)
  }

  async put(url: string, data?: any, config?: any) {
    return this.api.put(url, data, config)
  }

  async delete(url: string, config?: any) {
    return this.api.delete(url, config)
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
    // Response is already unwrapped by interceptor
    if (response.success && response.data?.token) {
      this.setToken(response.data.token)
      return response
    }
    throw new Error(response.message || 'Registration failed')
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.api.post('/api/v1/auth/login', { email, password })
    // Response is already unwrapped by interceptor
    if (response.success && response.data?.token) {
      this.setToken(response.data.token)
      return response
    }
    throw new Error(response.message || 'Login failed')
  }

  async getMe(): Promise<User> {
    const response = await this.api.get('/api/v1/auth/me')
    // Response is already unwrapped, extract user from data field
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.message || 'Failed to get user')
  }

  async verifyToken(): Promise<boolean> {
    try {
      if (!this.token) return false
      const response = await this.api.post('/api/v1/auth/verify', { token: this.token })
      return response.success || false
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

  // Student context endpoints
  async getStudentContext(userId: string) {
    const response = await this.api.get(`/api/v1/student-context/${userId}`)
    return response
  }

  async updateStudentContext(userId: string, data: any) {
    const response = await this.api.put(`/api/v1/student-context/${userId}`, data)
    return response
  }

  async getEmotionalState(userId: string) {
    const response = await this.api.get(`/api/v1/student-context/${userId}/emotional-state`)
    return response
  }

  async updateEmotionalState(userId: string, state: any) {
    const response = await this.api.post(`/api/v1/student-context/${userId}/emotional-state`, state)
    return response
  }

  async getLearningPatterns(userId: string) {
    const response = await this.api.get(`/api/v1/student-context/${userId}/learning-patterns`)
    return response
  }

  async getRecommendations(userId: string) {
    const response = await this.api.get(`/api/v1/student-context/${userId}/recommendations`)
    return response
  }

  // Achievements endpoints
  async getAchievements(userId: string) {
    const response = await this.api.get(`/api/v1/achievements/${userId}`)
    return response
  }

  async unlockAchievement(userId: string, achievementId: string) {
    return await this.api.post(`/api/v1/achievements/${userId}/unlock`, { achievementId })
  }

  async getAchievementProgress(userId: string) {
    return await this.api.get(`/api/v1/achievements/${userId}/progress`)
  }

  async getLeaderboard() {
    return await this.api.get('/api/v1/achievements/leaderboard/top')
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
  async sendChatMessage(message: string, sessionId?: string, context?: any) {
    return await this.api.post('/api/v1/chat/message', { message, sessionId, context })
  }

  async getChatHistory(sessionId?: string) {
    return await this.api.get('/api/v1/chat/history', { params: { sessionId } })
  }

  async getChatSuggestions(params?: string) {
    const url = params ? `/api/v1/chat/suggestions?${params}` : '/api/v1/chat/suggestions'
    return await this.api.get(url)
  }
}

export const apiService = new ApiService()
export default apiService