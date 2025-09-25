import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { EmotionalState } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'

class SocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private listeners: Map<string, Set<Function>> = new Map()

  connect(token?: string) {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io(WS_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      auth: token ? { token } : undefined,
    })

    this.setupEventHandlers()
    return this.socket
  }

  private setupEventHandlers() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.emit('connection_established')
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      this.emit('connection_lost', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      this.reconnectAttempts++

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit('max_reconnect_attempts')
      }
    })

    // Core events
    this.socket.on('emotional_state_detected', (data) => {
      this.emit('emotional_state_detected', data)
    })

    this.socket.on('achievement_unlocked', (data) => {
      this.emit('achievement_unlocked', data)
    })

    this.socket.on('celebration', (data) => {
      this.emit('celebration', data)
    })

    this.socket.on('break_suggested', (data) => {
      this.emit('break_suggested', data)
    })

    this.socket.on('quiz_answer_submitted', (data) => {
      this.emit('quiz_answer_submitted', data)
    })

    this.socket.on('teaching_script_ready', (data) => {
      this.emit('teaching_script_ready', data)
    })

    this.socket.on('student_progress_update', (data) => {
      this.emit('student_progress_update', data)
    })

    this.socket.on('chat_message', (data) => {
      this.emit('chat_message', data)
    })

    this.socket.on('typing_indicator', (data) => {
      this.emit('typing_indicator', data)
    })

    this.socket.on('heartbeat', () => {
      this.socket?.emit('heartbeat_ack')
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  // Emit events
  authenticate(token: string) {
    this.socket?.emit('authenticate', { token })
  }

  joinLesson(lessonId: string) {
    this.socket?.emit('join_lesson', { lessonId })
  }

  leaveLesson(lessonId: string) {
    this.socket?.emit('leave_lesson', { lessonId })
  }

  updateEmotionalState(state: EmotionalState) {
    this.socket?.emit('update_emotional_state', state)
  }

  sendChatMessage(message: string, lessonId?: string) {
    this.socket?.emit('chat_message', { message, lessonId })
  }

  sendTypingIndicator(isTyping: boolean, lessonId?: string) {
    this.socket?.emit('typing_indicator', { isTyping, lessonId })
  }

  requestTeachingScript(lessonId: string, slideContent: any, options?: any) {
    this.socket?.emit('generate_teaching_script', {
      lessonId,
      slideContent,
      options
    })
  }

  submitQuizAnswer(attemptId: string, questionId: string, answer: string) {
    this.socket?.emit('quiz_answer_submit', {
      attemptId,
      questionId,
      answer
    })
  }

  requestAchievements(userId: string) {
    this.socket?.emit('get_achievements', { userId })
  }

  reportUserActivity(activity: any) {
    this.socket?.emit('user_activity', activity)
  }

  requestParentUpdate(userId: string) {
    this.socket?.emit('request_parent_update', { userId })
  }

  // Event listener management
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(callback)

    // Also add to socket if connected
    this.socket?.on(event, callback as any)
  }

  off(event: string, callback?: Function) {
    if (callback) {
      this.listeners.get(event)?.delete(callback)
      this.socket?.off(event, callback as any)
    } else {
      this.listeners.delete(event)
      this.socket?.off(event)
    }
  }

  private emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(callback => {
      callback(...args)
    })
  }

  // Status methods
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (!this.socket) return 'disconnected'
    if (this.socket.connected) return 'connected'
    return 'connecting'
  }
}

export const socketService = new SocketService()
export default socketService