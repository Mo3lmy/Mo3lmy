'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showPercentage?: boolean
  variant?: 'linear' | 'circular'
  size?: 'sm' | 'md' | 'lg'
  color?: string
  animated?: boolean
  milestones?: { value: number; label: string }[]
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = false,
  variant = 'linear',
  size = 'md',
  color = 'bg-gradient-primary',
  animated = true,
  milestones = []
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)

  if (variant === 'circular') {
    const sizes = {
      sm: { width: 60, height: 60, strokeWidth: 4 },
      md: { width: 100, height: 100, strokeWidth: 6 },
      lg: { width: 140, height: 140, strokeWidth: 8 }
    }

    const { width, height, strokeWidth } = sizes[size]
    const radius = (width - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius

    return (
      <div className={cn('relative inline-flex items-center justify-center', `w-${width} h-${height}`)}>
        <svg width={width} height={height} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-gray-200"
          />
          {/* Progress circle */}
          <motion.circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            stroke="url(#gradient)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - percentage / 100) }}
            transition={{ duration: animated ? 1 : 0, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showPercentage && (
            <span className={cn(
              'font-bold gradient-text',
              size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : 'text-2xl'
            )}>
              {Math.round(percentage)}%
            </span>
          )}
          {label && (
            <span className={cn(
              'text-gray-600 mt-1',
              size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
            )}>
              {label}
            </span>
          )}
        </div>
      </div>
    )
  }

  const heights = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  }

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showPercentage && <span className="text-sm font-medium gradient-text">{Math.round(percentage)}%</span>}
        </div>
      )}

      <div className="relative">
        <div className={cn(
          'w-full rounded-full bg-gray-200 overflow-hidden',
          heights[size]
        )}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: animated ? 1 : 0, ease: 'easeOut' }}
            className={cn('h-full rounded-full relative overflow-hidden', color)}
          >
            {animated && (
              <div className="absolute inset-0 bg-white/20 animate-shimmer" />
            )}
          </motion.div>
        </div>

        {/* Milestones */}
        {milestones.map((milestone) => {
          const position = (milestone.value / max) * 100
          return (
            <div
              key={milestone.value}
              className="absolute top-0 transform -translate-x-1/2"
              style={{ left: `${position}%` }}
            >
              <div className={cn(
                'w-0.5 bg-gray-400',
                heights[size]
              )} />
              <div className="absolute top-full mt-1 whitespace-nowrap text-xs text-gray-500">
                {milestone.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}