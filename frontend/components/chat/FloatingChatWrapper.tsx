'use client'

import { useAuthStore } from '@/stores/authStore'
import { FloatingChat } from './FloatingChat'

export function FloatingChatWrapper() {
  const { isAuthenticated } = useAuthStore()

  // Only show floating chat for authenticated users
  if (!isAuthenticated) {
    return null
  }

  return <FloatingChat />
}