'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LivesDisplayProps {
  lives: number
  maxLives: number
}

export function LivesDisplay({ lives, maxLives }: LivesDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      {[...Array(maxLives)].map((_, index) => (
        <AnimatePresence key={index} mode="wait">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0, rotate: 360 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <Heart
              className={cn(
                'w-6 h-6 transition-all',
                index < lives
                  ? 'fill-danger text-danger drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                  : 'fill-gray-600 text-gray-600 opacity-30'
              )}
            />
          </motion.div>
        </AnimatePresence>
      ))}
    </div>
  )
}