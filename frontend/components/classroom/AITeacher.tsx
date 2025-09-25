'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Volume2, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AITeacherProps {
  isTeaching: boolean
  currentLesson?: string
  emotionalState?: {
    current: string
    energy: number
  }
}

export function AITeacher({ isTeaching, currentLesson, emotionalState }: AITeacherProps) {
  const [currentMessage, setCurrentMessage] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)

  const messages = {
    happy: [
      'رائع! أراك متحمساً للتعلم اليوم 🌟',
      'طاقتك الإيجابية تساعدك على الفهم بشكل أسرع!',
      'استمر بهذا الحماس، أنت تتقدم بشكل ممتاز!'
    ],
    neutral: [
      'دعنا نبدأ الدرس بخطوات بسيطة',
      'خذ وقتك في الفهم، أنا هنا لمساعدتك',
      'التعلم رحلة، ولكل رحلة وقتها'
    ],
    sad: [
      'لا بأس، سنأخذ الأمور ببطء اليوم',
      'كل يوم هو فرصة جديدة للتعلم والنمو',
      'أنا هنا لدعمك، لنجعل التعلم أسهل'
    ],
    confused: [
      'دعني أشرح لك بطريقة مختلفة',
      'لا تقلق، سنفهم هذا معاً خطوة بخطوة',
      'الأسئلة علامة على التفكير العميق، اسأل ما تشاء'
    ],
    tired: [
      'يبدو أنك بحاجة لاستراحة قصيرة',
      'لنأخذ الأمور بهدوء اليوم',
      'الراحة جزء مهم من التعلم الفعال'
    ]
  }

  useEffect(() => {
    if (!emotionalState) return

    const relevantMessages = messages[emotionalState.current as keyof typeof messages] || messages.neutral
    const randomMessage = relevantMessages[Math.floor(Math.random() * relevantMessages.length)]

    setIsAnimating(true)
    let index = 0
    const timer = setInterval(() => {
      if (index <= randomMessage.length) {
        setCurrentMessage(randomMessage.slice(0, index))
        index++
      } else {
        clearInterval(timer)
        setIsAnimating(false)
      }
    }, 50)

    return () => clearInterval(timer)
  }, [emotionalState?.current])

  return (
    <div className="relative">
      {/* AI Avatar */}
      <div className="flex justify-center mb-4">
        <motion.div
          animate={{
            scale: isTeaching ? [1, 1.05, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: isTeaching ? Infinity : 0,
            ease: 'easeInOut'
          }}
          className="relative"
        >
          {/* Avatar Container */}
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 p-1">
            <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center relative overflow-hidden">
              {/* Face */}
              <svg viewBox="0 0 100 100" className="w-24 h-24">
                {/* Head */}
                <circle cx="50" cy="50" r="35" fill="url(#avatarGradient)" />

                {/* Eyes */}
                <motion.g>
                  <motion.ellipse
                    cx="35"
                    cy="45"
                    rx="4"
                    ry="6"
                    fill="#1a1a2e"
                    animate={{
                      scaleY: isTeaching ? [1, 0.3, 1] : 1
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      repeatDelay: 2
                    }}
                  />
                  <motion.ellipse
                    cx="65"
                    cy="45"
                    rx="4"
                    ry="6"
                    fill="#1a1a2e"
                    animate={{
                      scaleY: isTeaching ? [1, 0.3, 1] : 1
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      repeatDelay: 2
                    }}
                  />
                </motion.g>

                {/* Mouth */}
                <motion.path
                  d="M 35 60 Q 50 70 65 60"
                  fill="none"
                  stroke="#1a1a2e"
                  strokeWidth="2"
                  strokeLinecap="round"
                  animate={{
                    d: isTeaching
                      ? [
                          'M 35 60 Q 50 70 65 60',
                          'M 35 60 Q 50 65 65 60',
                          'M 35 60 Q 50 70 65 60'
                        ]
                      : 'M 35 60 Q 50 65 65 60'
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: isTeaching ? Infinity : 0,
                    repeatDelay: 0.5
                  }}
                />

                {/* Gradient Definition */}
                <defs>
                  <linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Animated particles */}
              <AnimatePresence>
                {isTeaching && (
                  <>
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-primary-400 rounded-full"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{
                          opacity: [0, 1, 0],
                          scale: [0, 1, 0],
                          x: [0, (i - 1) * 30],
                          y: [0, -20 - i * 10, -40]
                        }}
                        transition={{
                          duration: 2,
                          delay: i * 0.3,
                          repeat: Infinity,
                          repeatDelay: 1
                        }}
                      />
                    ))}
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Status Indicator */}
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={cn(
              'absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-gray-900',
              isTeaching ? 'bg-success' : 'bg-gray-500'
            )}
          />
        </motion.div>
      </div>

      {/* Teacher Name */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-400" />
          الأستاذ الذكي
          <Sparkles className="w-4 h-4 text-primary-400" />
        </h3>
        <p className="text-sm text-gray-400">مساعدك الشخصي في التعلم</p>
      </div>

      {/* Speech Bubble */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-4 relative"
      >
        {/* Bubble tail */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 glass rotate-45" />

        {/* Message */}
        <div className="relative z-10">
          <p className="text-white text-sm leading-relaxed min-h-[3rem] flex items-center">
            {currentMessage}
            {isAnimating && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="ml-1"
              >
                |
              </motion.span>
            )}
          </p>
        </div>

        {/* Voice indicator */}
        <AnimatePresence>
          {isTeaching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-2 right-2"
            >
              <Volume2 className="w-4 h-4 text-primary-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Emotional Response */}
      {emotionalState && emotionalState.energy < 50 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 glass rounded-xl p-3 border border-warning/30"
        >
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-warning" />
            <p className="text-xs text-gray-300">
              أرى أن طاقتك منخفضة، هل تحتاج لاستراحة؟
            </p>
          </div>
        </motion.div>
      )}

      {/* Current Lesson Badge */}
      {currentLesson && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex items-center justify-center"
        >
          <span className="px-3 py-1 rounded-full bg-primary-500/20 text-primary-300 text-xs font-medium">
            يشرح الآن: {currentLesson}
          </span>
        </motion.div>
      )}
    </div>
  )
}