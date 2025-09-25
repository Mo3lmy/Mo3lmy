'use client'

import { motion } from 'framer-motion'

interface VoiceWaveformProps {
  isActive: boolean
  className?: string
}

export function VoiceWaveform({ isActive, className }: VoiceWaveformProps) {
  const bars = 20
  const barVariants = {
    active: {
      height: [10, 40, 10],
      transition: {
        duration: 1,
        repeat: Infinity,
        repeatType: 'reverse' as const,
        ease: 'easeInOut'
      }
    },
    inactive: {
      height: 10,
      transition: {
        duration: 0.3
      }
    }
  }

  return (
    <div className={`flex items-center justify-center gap-1 p-4 ${className}`}>
      {[...Array(bars)].map((_, i) => (
        <motion.div
          key={i}
          variants={barVariants}
          animate={isActive ? 'active' : 'inactive'}
          transition={{ delay: i * 0.05 }}
          className="w-1 bg-gradient-to-t from-primary-400 to-secondary-400 rounded-full"
          style={{
            originY: 0.5,
          }}
        />
      ))}
    </div>
  )
}