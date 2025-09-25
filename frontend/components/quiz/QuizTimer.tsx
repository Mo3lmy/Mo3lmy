'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuizTimerProps {
  onTimeUpdate?: (time: number) => void
  maxTime?: number // in seconds
}

export function QuizTimer({ onTimeUpdate, maxTime = 600 }: QuizTimerProps) {
  const [time, setTime] = useState(0)
  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(prev => {
        const newTime = prev + 1
        onTimeUpdate?.(newTime)

        // Pulse when reaching certain milestones
        if (maxTime && newTime >= maxTime * 0.8) {
          setIsPulsing(true)
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [onTimeUpdate, maxTime])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const progress = maxTime ? (time / maxTime) * 100 : 0

  return (
    <motion.div
      animate={isPulsing ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 1, repeat: isPulsing ? Infinity : 0 }}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl glass',
        isPulsing && 'border border-warning/50'
      )}
    >
      <Clock className={cn(
        'w-5 h-5',
        isPulsing ? 'text-warning' : 'text-white'
      )} />
      <span className={cn(
        'font-mono text-lg font-bold',
        isPulsing ? 'text-warning' : 'text-white'
      )}>
        {formatTime(time)}
      </span>

      {maxTime && (
        <div className="w-16 h-2 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className={cn(
              'h-full rounded-full transition-colors',
              progress < 50 && 'bg-success',
              progress >= 50 && progress < 80 && 'bg-warning',
              progress >= 80 && 'bg-danger'
            )}
          />
        </div>
      )}
    </motion.div>
  )
}