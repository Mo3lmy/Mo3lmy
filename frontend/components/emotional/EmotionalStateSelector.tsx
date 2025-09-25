'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Smile, Meh, Frown, HelpCircle, BatteryLow } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStudentStore } from '@/stores/studentStore'
import { EmotionalState } from '@/types'

const emotions = [
  { mood: 'happy' as const, icon: Smile, label: 'سعيد', color: 'bg-emotional-happy', gradient: 'from-yellow-400 to-orange-400' },
  { mood: 'neutral' as const, icon: Meh, label: 'عادي', color: 'bg-emotional-neutral', gradient: 'from-gray-400 to-gray-500' },
  { mood: 'sad' as const, icon: Frown, label: 'حزين', color: 'bg-emotional-sad', gradient: 'from-blue-400 to-blue-600' },
  { mood: 'confused' as const, icon: HelpCircle, label: 'مرتبك', color: 'bg-emotional-confused', gradient: 'from-orange-400 to-red-400' },
  { mood: 'tired' as const, icon: BatteryLow, label: 'متعب', color: 'bg-emotional-tired', gradient: 'from-purple-400 to-purple-600' },
]

export function EmotionalStateSelector() {
  const { emotionalState, updateEmotionalState } = useStudentStore()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedMood, setSelectedMood] = useState(emotionalState.mood)

  const currentEmotion = emotions.find(e => e.mood === selectedMood) || emotions[0]

  const handleMoodSelect = (mood: EmotionalState['mood']) => {
    setSelectedMood(mood)
    updateEmotionalState({
      mood,
      energy: mood === 'happy' ? 8 : mood === 'tired' ? 3 : 5,
      focus: mood === 'confused' ? 3 : mood === 'happy' ? 8 : 5,
      timestamp: new Date().toISOString()
    })
    setTimeout(() => setIsOpen(false), 500)
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl',
          'glass border border-white/20',
          'transition-all duration-300'
        )}
      >
        <motion.div
          key={currentEmotion.mood}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            'bg-gradient-to-br',
            currentEmotion.gradient
          )}
        >
          <currentEmotion.icon className="w-6 h-6 text-white" />
        </motion.div>
        <div className="text-right">
          <p className="text-xs text-gray-500">كيف تشعر؟</p>
          <p className="font-semibold">{currentEmotion.label}</p>
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className="absolute top-full mt-2 right-0 z-50 p-2 rounded-2xl glass-dark shadow-xl"
            >
              <div className="grid grid-cols-5 gap-2">
                {emotions.map((emotion, index) => (
                  <motion.button
                    key={emotion.mood}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleMoodSelect(emotion.mood)}
                    className={cn(
                      'relative w-16 h-16 rounded-xl',
                      'flex flex-col items-center justify-center gap-1',
                      'transition-all duration-300',
                      selectedMood === emotion.mood
                        ? 'ring-2 ring-white shadow-lg transform scale-105'
                        : 'hover:shadow-md'
                    )}
                  >
                    <motion.div
                      className={cn(
                        'absolute inset-0 rounded-xl bg-gradient-to-br',
                        emotion.gradient,
                        'opacity-90'
                      )}
                      animate={selectedMood === emotion.mood ? {
                        scale: [1, 1.05, 1],
                      } : {}}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatType: 'reverse'
                      }}
                    />
                    <emotion.icon className="w-8 h-8 text-white relative z-10" />
                    <span className="text-xs text-white font-medium relative z-10">
                      {emotion.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}