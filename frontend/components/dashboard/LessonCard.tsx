'use client'

import { motion } from 'framer-motion'
import { Clock, BookOpen, Trophy, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Lesson } from '@/types'
import { ProgressBar } from '@/components/ui/ProgressBar'
import Link from 'next/link'

interface LessonCardProps {
  lesson: Lesson
  index?: number
}

export function LessonCard({ lesson, index = 0 }: LessonCardProps) {
  const difficultyColors = {
    easy: 'from-green-400 to-emerald-500',
    medium: 'from-yellow-400 to-orange-500',
    hard: 'from-red-400 to-pink-500'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className="glass rounded-2xl overflow-hidden card-hover group"
    >
      {/* Header with gradient */}
      <div className={cn(
        'h-32 bg-gradient-to-br p-6 relative overflow-hidden',
        difficultyColors[lesson.difficulty]
      )}>
        {/* Subject icon/emoji */}
        <div className="absolute top-4 right-4 text-4xl">
          {lesson.unit.subject.icon || '📚'}
        </div>

        {/* Difficulty badge */}
        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-white text-xs font-semibold">
          {lesson.difficulty === 'easy' ? 'سهل' : lesson.difficulty === 'medium' ? 'متوسط' : 'صعب'}
        </div>

        {/* Decorative circles */}
        <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/10" />
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {lesson.titleAr || lesson.title}
        </h3>

        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {lesson.description}
        </p>

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{lesson.duration} دقيقة</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            <span>{lesson.unit.nameAr || lesson.unit.name}</span>
          </div>
        </div>

        {/* Progress bar */}
        {lesson.progress !== undefined && (
          <div className="mb-4">
            <ProgressBar
              value={lesson.progress}
              size="sm"
              showPercentage
              label="التقدم"
            />
          </div>
        )}

        {/* Action button */}
        <Link href={`/classroom/${lesson.id}`}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'w-full py-2 px-4 rounded-lg font-semibold transition-all',
              'flex items-center justify-center gap-2',
              lesson.isCompleted
                ? 'bg-success/10 text-success hover:bg-success/20'
                : 'bg-gradient-primary text-white hover:shadow-lg'
            )}
          >
            {lesson.isCompleted ? (
              <>
                <Trophy className="w-4 h-4" />
                مراجعة
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                {lesson.progress ? 'متابعة' : 'ابدأ الآن'}
              </>
            )}
          </motion.button>
        </Link>
      </div>
    </motion.div>
  )
}