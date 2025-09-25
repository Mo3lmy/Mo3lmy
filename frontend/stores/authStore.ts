import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User, AuthResponse } from '@/types'
import apiService from '@/services/api'
import socketService from '@/services/socket'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  setUser: (user: User) => void
  setToken: (token: string) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await apiService.login(email, password)
          console.log('Login response:', response)

          if (response.success && response.data) {
            const { user, token } = response.data
            console.log('Setting auth state:', { user, token })
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false
            })

            // Connect WebSocket with token
            socketService.connect(token)
            socketService.authenticate(token)
          } else {
            throw new Error(response.message || 'Login failed')
          }
        } catch (error: any) {
          console.error('Login error:', error)
          const errorMessage = error.error?.message || error.message || 'Login failed'
          set({
            error: errorMessage,
            isLoading: false,
            isAuthenticated: false
          })
          throw new Error(errorMessage)
        }
      },

      register: async (data: any) => {
        set({ isLoading: true, error: null })
        try {
          const response = await apiService.register(data)

          if (response.success && response.data) {
            const { user, token } = response.data
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false
            })

            // Connect WebSocket with token
            socketService.connect(token)
            socketService.authenticate(token)
          } else {
            throw new Error(response.message || 'Registration failed')
          }
        } catch (error: any) {
          const errorMessage = error.error?.message || error.message || 'Registration failed'
          set({
            error: errorMessage,
            isLoading: false,
            isAuthenticated: false
          })
          throw new Error(errorMessage)
        }
      },

      logout: () => {
        apiService.logout()
        socketService.disconnect()
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null
        })
      },

      checkAuth: async () => {
        const token = get().token
        if (!token) {
          set({ isAuthenticated: false })
          return
        }

        set({ isLoading: true })
        try {
          const isValid = await apiService.verifyToken()
          if (isValid) {
            const user = await apiService.getMe()
            set({
              user: user,
              isAuthenticated: true,
              isLoading: false
            })

            // Reconnect WebSocket
            socketService.connect(token)
            socketService.authenticate(token)
          } else {
            get().logout()
          }
        } catch {
          get().logout()
        }
      },

      setUser: (user: User) => set({ user }),
      setToken: (token: string) => {
        apiService.setToken(token)
        set({ token })
      },
      clearError: () => set({ error: null })
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)