'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Trophy, Star, Target, TrendingUp, Award, Share2,
  RefreshCw, Home, ChevronRight, Zap, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfettiEffect } from '@/components/effects/ConfettiEffect'
import { useAuthStore } from '@/stores/authStore'
import { useStudentStore } from '@/stores/studentStore'

export default function QuizResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const { stats, updateXP } = useStudentStore()

  const score = parseInt(searchParams.get('score') || '0')
  const total = parseInt(searchParams.get('total') || '100')
  const percentage = Math.round((score / total) * 100)

  const [showConfetti, setShowConfetti] = useState(false)
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    // Animate score counting
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setAnimatedScore(prev => {
          if (prev < score) {
            return Math.min(prev + Math.ceil(score / 30), score)
          }
          clearInterval(interval)
          return prev
        })
      }, 50)
    }, 500)

    // Show confetti for good scores
    if (percentage >= 70) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 5000)
    }

    return () => clearTimeout(timer)
  }, [score, percentage])

  const getGrade = () => {
    if (percentage >= 95) return { grade: 'A+', color: 'text-yellow-400', message: 'أداء استثنائي! 🌟' }
    if (percentage >= 90) return { grade: 'A', color: 'text-yellow-400', message: 'ممتاز جداً!' }
    if (percentage >= 85) return { grade: 'B+', color: 'text-success', message: 'أداء رائع!' }
    if (percentage >= 80) return { grade: 'B', color: 'text-success', message: 'عمل جيد!' }
    if (percentage >= 75) return { grade: 'C+', color: 'text-blue-400', message: 'أداء جيد' }
    if (percentage >= 70) return { grade: 'C', color: 'text-blue-400', message: 'مقبول' }
    if (percentage >= 60) return { grade: 'D', color: 'text-warning', message: 'يحتاج تحسين' }
    return { grade: 'F', color: 'text-danger', message: 'حاول مرة أخرى' }
  }

  const gradeInfo = getGrade()

  const achievements = [
    { icon: Target, label: 'الدقة', value: `${percentage}%` },
    { icon: Zap, label: 'النقاط', value: animatedScore },
    { icon: Clock, label: 'الوقت', value: '5:23' },
    { icon: Star, label: 'التقييم', value: gradeInfo.grade }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-purple-900 to-secondary-900 flex items-center justify-center p-6">
      {/* Results Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 100 }}
        className="w-full max-w-2xl"
      >
        <div className="glass-dark rounded-3xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              className="inline-block mb-4"
            >
              <Trophy className="w-20 h-20 text-yellow-400" />
            </motion.div>

            <h1 className="text-4xl font-bold text-white mb-2">نتائج الاختبار</h1>
            <p className="text-gray-400">لقد أكملت الاختبار بنجاح!</p>
          </div>

          {/* Score Display */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mb-8"
          >
            <div className="relative inline-block">
              {/* Score Circle */}
              <svg className="w-48 h-48 transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="80"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="12"
                  fill="none"
                />
                <motion.circle
                  cx="96"
                  cy="96"
                  r="80"
                  stroke="url(#scoreGradient)"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: '0 502' }}
                  animate={{ strokeDasharray: `${(percentage / 100) * 502} 502` }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                />
                <defs>
                  <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Score Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8, type: 'spring' }}
                >
                  <span className={cn('text-6xl font-bold', gradeInfo.color)}>
                    {gradeInfo.grade}
                  </span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="text-gray-400 text-sm"
                >
                  {animatedScore} / {total}
                </motion.div>
              </div>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="text-xl text-white mt-4"
            >
              {gradeInfo.message}
            </motion.p>
          </motion.div>

          {/* Achievement Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {achievements.map((achievement, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 + index * 0.1 }}
                className="glass rounded-xl p-4 text-center"
              >
                <achievement.icon className="w-6 h-6 text-primary-400 mx-auto mb-2" />
                <p className="text-xs text-gray-400 mb-1">{achievement.label}</p>
                <p className="text-lg font-bold text-white">{achievement.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Unlocked Achievements */}
          {percentage >= 80 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              className="glass rounded-xl p-4 mb-6 border border-yellow-500/30"
            >
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-yellow-400" />
                <div className="flex-1">
                  <p className="text-yellow-400 font-bold">🏆 إنجاز جديد!</p>
                  <p className="text-sm text-gray-300">عبقري الرياضيات - احصل على 80% أو أكثر</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* XP Earned */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2 }}
            className="glass rounded-xl p-4 mb-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-primary-400" />
                <span className="text-white">نقاط الخبرة المكتسبة</span>
              </div>
              <span className="text-2xl font-bold text-primary-300">+{animatedScore} XP</span>
            </div>
            <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '60%' }}
                transition={{ delay: 2.5, duration: 1 }}
                className="h-full bg-gradient-to-r from-primary-400 to-secondary-400"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {1000 - (stats.xp % 1000)} XP للمستوى التالي
            </p>
          </motion.div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 2.4 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/dashboard')}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 glass rounded-xl
                       hover:bg-white/10 transition-colors text-white"
            >
              <Home className="w-5 h-5" />
              <span>الصفحة الرئيسية</span>
            </motion.button>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3
                       bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl
                       text-white font-medium hover:shadow-lg transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              <span>إعادة المحاولة</span>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 2.6 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 glass rounded-xl
                       hover:bg-white/10 transition-colors text-white"
            >
              <span>الدرس التالي</span>
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Share Button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.8 }}
            className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3
                     glass rounded-xl hover:bg-white/10 transition-colors text-gray-400"
          >
            <Share2 className="w-5 h-5" />
            <span>مشاركة النتيجة</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Confetti Effect */}
      {showConfetti && <ConfettiEffect />}
    </div>
  )
}