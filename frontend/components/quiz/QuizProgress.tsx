'use client'

import { motion } from 'framer-motion'
import { Trophy, Flame, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuizProgressProps {
  current: number
  total: number
  score: number
  streak: number
}

export function QuizProgress({ current, total, score, streak }: QuizProgressProps) {
  const progress = (current / total) * 100

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          {/* Question Counter */}
          <div className="text-white">
            <span className="text-2xl font-bold">{current}</span>
            <span className="text-sm text-gray-400"> / {total}</span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-primary-500/20">
            <Trophy className="w-4 h-4 text-primary-300" />
            <span className="text-primary-300 font-bold">{score}</span>
          </div>

          {/* Streak */}
          {streak > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-500/20"
            >
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-orange-400 font-bold">{streak}</span>
            </motion.div>
          )}
        </div>

        {/* Accuracy */}
        {current > 1 && (
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">
              {Math.round((score / ((current - 1) * 15)) * 100)}% دقة
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 100 }}
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary-400 to-secondary-400"
        />

        {/* Milestone Markers */}
        {[25, 50, 75].map((milestone) => (
          <div
            key={milestone}
            className="absolute top-1/2 -translate-y-1/2 w-px h-full bg-white/30"
            style={{ left: `${milestone}%` }}
          />
        ))}

        {/* Glow Effect */}
        <motion.div
          animate={{
            x: ['-100%', '200%']
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3
          }}
          className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          style={{ filter: 'blur(4px)' }}
        />
      </div>
    </div>
  )
}