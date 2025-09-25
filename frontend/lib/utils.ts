import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d)
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours()
  if (hour < 6) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  if (hour < 22) return 'evening'
  return 'night'
}

export function getGreeting(): string {
  const time = getTimeOfDay()
  switch (time) {
    case 'morning':
      return 'صباح الخير'
    case 'afternoon':
      return 'مساء الخير'
    case 'evening':
      return 'مساء الخير'
    case 'night':
      return 'مساء الخير'
  }
}

export function generateGradient(seed: string): string {
  const colors = [
    'from-purple-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-emerald-500',
    'from-orange-500 to-red-500',
    'from-indigo-500 to-purple-500'
  ]
  const index = seed.charCodeAt(0) % colors.length
  return colors[index]
}