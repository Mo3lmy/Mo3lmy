'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const subjects = [
  { id: '1', name: 'الرياضيات', nameEn: 'Mathematics', icon: '🔢', color: 'from-blue-400 to-blue-600', progress: 75 },
  { id: '2', name: 'العلوم', nameEn: 'Science', icon: '🔬', color: 'from-green-400 to-green-600', progress: 60 },
  { id: '3', name: 'اللغة العربية', nameEn: 'Arabic', icon: '📝', color: 'from-purple-400 to-purple-600', progress: 85 },
  { id: '4', name: 'اللغة الإنجليزية', nameEn: 'English', icon: '🌐', color: 'from-orange-400 to-orange-600', progress: 70 },
  { id: '5', name: 'التاريخ', nameEn: 'History', icon: '📚', color: 'from-yellow-400 to-yellow-600', progress: 55 },
  { id: '6', name: 'الجغرافيا', nameEn: 'Geography', icon: '🗺️', color: 'from-teal-400 to-teal-600', progress: 65 },
]

export function SubjectCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % subjects.length)
  }

  const prev = () => {
    setCurrentIndex((prev) => (prev - 1 + subjects.length) % subjects.length)
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">المواد الدراسية</h2>
        <div className="flex gap-2">
          <button
            onClick={prev}
            className="p-2 rounded-lg glass hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="p-2 rounded-lg glass hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative h-48 perspective-1000">
        <AnimatePresence>
          {subjects.map((subject, index) => {
            const offset = index - currentIndex
            const isActive = offset === 0
            const isVisible = Math.abs(offset) <= 1

            if (!isVisible) return null

            return (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, x: offset * 100, rotateY: offset * 30 }}
                animate={{
                  opacity: isActive ? 1 : 0.5,
                  x: offset * 250,
                  z: isActive ? 50 : 0,
                  rotateY: offset * 30,
                  scale: isActive ? 1 : 0.85
                }}
                exit={{ opacity: 0, x: -offset * 100 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute inset-0 w-64 h-48 mx-auto"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div
                  className={cn(
                    'w-full h-full rounded-2xl p-6 cursor-pointer',
                    'flex flex-col items-center justify-center',
                    'shadow-xl transition-all duration-300',
                    isActive ? 'z-10' : 'z-0'
                  )}
                  onClick={() => setCurrentIndex(index)}
                >
                  {/* Background gradient */}
                  <div className={cn(
                    'absolute inset-0 rounded-2xl opacity-90',
                    `bg-gradient-to-br ${subject.color}`
                  )} />

                  {/* Content */}
                  <div className="relative z-10 text-white text-center">
                    <div className="text-5xl mb-3">{subject.icon}</div>
                    <h3 className="text-xl font-bold mb-1">{subject.name}</h3>
                    <p className="text-sm opacity-80 mb-4">{subject.nameEn}</p>

                    {/* Progress bar */}
                    <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${subject.progress}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="h-full bg-white rounded-full"
                      />
                    </div>
                    <p className="text-xs mt-2 font-semibold">{subject.progress}% مكتمل</p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center gap-2 mt-8">
        {subjects.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              currentIndex === index
                ? 'w-8 bg-gradient-primary'
                : 'bg-gray-300 hover:bg-gray-400'
            )}
          />
        ))}
      </div>
    </div>
  )
}