'use client'

import { motion } from 'framer-motion'
import { Trophy, Star, Zap, Target, Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Achievement } from '@/types'

const rarityConfig = {
  common: {
    color: 'from-gray-400 to-gray-600',
    glow: 'shadow-gray-400/50',
    stars: 1,
    icon: Target,
  },
  rare: {
    color: 'from-blue-400 to-blue-600',
    glow: 'shadow-blue-400/50',
    stars: 2,
    icon: Award,
  },
  epic: {
    color: 'from-purple-400 to-purple-600',
    glow: 'shadow-purple-400/50',
    stars: 3,
    icon: Trophy,
  },
  legendary: {
    color: 'from-yellow-400 to-orange-500',
    glow: 'shadow-yellow-400/50',
    stars: 4,
    icon: Star,
  },
  mythic: {
    color: 'from-pink-400 to-red-500',
    glow: 'shadow-pink-400/50',
    stars: 5,
    icon: Zap,
  },
}

interface AchievementBadgeProps {
  achievement: Achievement
  isNew?: boolean
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export function AchievementBadge({ achievement, isNew = false, size = 'md', onClick }: AchievementBadgeProps) {
  const config = rarityConfig[achievement.rarity]
  const Icon = config.icon

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  }

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }

  return (
    <motion.div
      initial={isNew ? { scale: 0, rotate: -180 } : { scale: 1 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        duration: 0.6,
      }}
      whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'relative cursor-pointer',
        sizeClasses[size]
      )}
    >
      {/* Background glow */}
      {isNew && (
        <motion.div
          className={cn(
            'absolute inset-0 rounded-full blur-xl',
            `bg-gradient-to-br ${config.color}`,
            'opacity-60'
          )}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.6, 0.8, 0.6],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
      )}

      {/* Badge container */}
      <motion.div
        className={cn(
          'relative w-full h-full rounded-full',
          'flex items-center justify-center',
          `bg-gradient-to-br ${config.color}`,
          `shadow-lg ${config.glow}`,
          achievement.unlockedAt ? '' : 'grayscale opacity-50'
        )}
        animate={isNew ? {
          rotate: 360,
        } : {}}
        transition={{
          duration: 1,
          ease: 'easeInOut',
        }}
      >
        {/* Inner circle */}
        <div className="absolute inset-2 rounded-full bg-white/20 backdrop-blur" />

        {/* Icon */}
        <Icon className={cn(
          iconSizes[size],
          'text-white relative z-10',
          isNew && 'animate-pulse'
        )} />

        {/* Progress ring if not unlocked */}
        {!achievement.unlockedAt && achievement.progress !== undefined && (
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="2"
              fill="none"
            />
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              stroke="rgba(255, 255, 255, 0.8)"
              strokeWidth="2"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 45} ${2 * Math.PI * 45}`}
              strokeDashoffset={2 * Math.PI * 45 * (1 - (achievement.progress || 0) / (achievement.maxProgress || 100))}
              className="transition-all duration-500"
            />
          </svg>
        )}

        {/* Stars */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {Array.from({ length: config.stars }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
            >
              <Star className={cn(
                'w-3 h-3',
                achievement.unlockedAt ? 'text-yellow-300 fill-yellow-300' : 'text-gray-400 fill-gray-400'
              )} />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* New badge indicator */}
      {isNew && (
        <motion.div
          className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
          }}
        >
          جديد!
        </motion.div>
      )}
    </motion.div>
  )
}