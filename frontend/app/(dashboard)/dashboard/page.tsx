'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  BookOpen, Trophy, Target, Flame, Clock, Brain,
  Sparkles, TrendingUp, Award, Battery, LogOut, Bell,
  Calendar, ChevronRight
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useStudentStore } from '@/stores/studentStore'
import { EmotionalStateSelector } from '@/components/emotional/EmotionalStateSelector'
import { AchievementBadge } from '@/components/gamification/AchievementBadge'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { LessonCard } from '@/components/dashboard/LessonCard'
import { SubjectCarousel } from '@/components/dashboard/SubjectCarousel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Leaderboard } from '@/components/gamification/Leaderboard'
import { cn, getTimeOfDay, getGreeting } from '@/lib/utils'
import socketService from '@/services/socket'
import apiService from '@/services/api'
import { Lesson, Achievement } from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { stats, emotionalState, isConnected, setConnectionStatus, loadStudentData } = useStudentStore()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [recentAchievements, setRecentAchievements] = useState<Achievement[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    // Initialize WebSocket connection
    const authStorage = localStorage.getItem('auth-storage')
    let token = null
    if (authStorage) {
      try {
        const authData = JSON.parse(authStorage)
        token = authData.state?.token
      } catch (e) {
        console.error('Failed to parse auth storage:', e)
      }
    }

    if (token && !socketService.isConnected()) {
      // Connect with token in auth
      socketService.connect(token)

      // Set up WebSocket event listeners
      socketService.on('connect', () => {
        setConnectionStatus(true)
        console.log('WebSocket connected')
      })

      socketService.on('disconnect', () => {
        setConnectionStatus(false)
        console.log('WebSocket disconnected')
      })

      socketService.on('welcome', (data: any) => {
        console.log('WebSocket welcome:', data)
      })

      socketService.on('authenticated', (data: any) => {
        console.log('WebSocket authenticated:', data)
      })

      socketService.on('auth_error', (data: any) => {
        console.error('WebSocket auth error:', data)
      })

      socketService.on('achievement_unlocked', (data: Achievement) => {
        setRecentAchievements(prev => [...prev, data])
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setRecentAchievements(prev => prev.filter(a => a.id !== data.id))
        }, 5000)
      })

      socketService.on('emotional_state_detected', (data: any) => {
        console.log('Emotional state detected:', data)
      })
    }

    // Load student data and lessons only once
    if (!dataLoaded) {
      loadData()
      setDataLoaded(true)
    }

    return () => {
      socketService.off('connect')
      socketService.off('disconnect')
      socketService.off('welcome')
      socketService.off('authenticated')
      socketService.off('auth_error')
      socketService.off('achievement_unlocked')
      socketService.off('emotional_state_detected')
    }
  }, [isAuthenticated, router, setConnectionStatus, dataLoaded])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load data in parallel
      const promises = []

      // Load student data
      if (user?.id) {
        promises.push(loadStudentData(user.id))
      }

      // Load lessons
      promises.push(
        apiService.getLessons()
          .then(response => {
            console.log('Lessons response:', response)
            if (Array.isArray(response)) {
              setLessons(response)
            } else if (response?.data?.lessons) {
              setLessons(response.data.lessons)
            } else if (response?.data && Array.isArray(response.data)) {
              setLessons(response.data)
            } else if (response?.lessons) {
              setLessons(response.lessons)
            }
          })
          .catch(err => console.error('Failed to load lessons:', err))
      )

      await Promise.all(promises)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const timeOfDay = getTimeOfDay()
  const greeting = getGreeting()
  const backgroundGradients = {
    morning: 'from-yellow-50 via-orange-50 to-primary-50',
    afternoon: 'from-blue-50 via-cyan-50 to-primary-50',
    evening: 'from-purple-50 via-pink-50 to-primary-50',
    night: 'from-indigo-50 via-blue-50 to-primary-50'
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="rounded-full h-12 w-12 border-b-2 border-primary-500"
        />
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen transition-colors duration-1000', `bg-gradient-to-br ${backgroundGradients[timeOfDay]}`)}>
      {/* Header Navigation */}
      <nav className="glass sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-2"
              >
                <Brain className="w-8 h-8 text-primary-500" />
                <span className="text-xl font-bold gradient-text">Smart Education</span>
              </motion.div>

              {/* Connection status */}
              <div className={cn(
                'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium',
                isConnected ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
              )}>
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-success animate-pulse' : 'bg-danger'
                )} />
                {isConnected ? 'متصل' : 'غير متصل'}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <EmotionalStateSelector />

              <button className="p-2 rounded-lg glass hover:bg-white/20 transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full" />
              </button>

              <button
                onClick={logout}
                className="p-2 rounded-lg glass hover:bg-danger/20 transition-colors text-danger"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">
            {greeting}، {user.firstName} 👋
          </h1>
          <p className="text-gray-600">
            {timeOfDay === 'morning' && 'يوم جديد مليء بالفرص للتعلم والنمو'}
            {timeOfDay === 'afternoon' && 'استمر في التقدم، أنت تبلي بلاءً حسناً'}
            {timeOfDay === 'evening' && 'وقت رائع لمراجعة ما تعلمته اليوم'}
            {timeOfDay === 'night' && 'لا تنس أن تأخذ قسطاً من الراحة'}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatsCard
            icon={Trophy}
            label="نقاط الخبرة"
            value={stats.xp}
            trend={{ value: 12, isPositive: true }}
            color="from-yellow-400 to-orange-500"
            index={0}
          />
          <StatsCard
            icon={Flame}
            label="أيام متتالية"
            value={stats.streak}
            color="from-red-400 to-pink-500"
            index={1}
          />
          <StatsCard
            icon={BookOpen}
            label="دروس مكتملة"
            value={stats.lessonsCompleted}
            trend={{ value: 8, isPositive: true }}
            color="from-blue-400 to-cyan-500"
            index={2}
          />
          <StatsCard
            icon={Target}
            label="المستوى"
            value={stats.level}
            color="from-purple-400 to-indigo-500"
            index={3}
          />
        </div>

        {/* Level Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6 mb-8"
        >
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold">تقدم المستوى</h2>
              <p className="text-sm text-gray-600">المستوى {stats.level} - {stats.xp} نقطة خبرة</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">المستوى التالي</p>
              <p className="font-bold gradient-text">{(stats.level + 1) * 1000} XP</p>
            </div>
          </div>
          <ProgressBar
            value={stats.xp % 1000}
            max={1000}
            showPercentage
            animated
            milestones={[
              { value: 250, label: '250' },
              { value: 500, label: '500' },
              { value: 750, label: '750' }
            ]}
          />
        </motion.div>

        {/* Recent Achievements */}
        {recentAchievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            className="fixed bottom-4 right-4 z-50 space-y-2"
          >
            {recentAchievements.map((achievement) => (
              <motion.div
                key={achievement.id}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                className="glass rounded-2xl p-4 flex items-center gap-4"
              >
                <AchievementBadge achievement={achievement} size="sm" isNew />
                <div>
                  <p className="font-bold">{achievement.nameAr}</p>
                  <p className="text-sm text-gray-600">{achievement.descriptionAr}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Subject Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          <SubjectCarousel />
        </motion.div>

        {/* Continue Learning Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">متابعة التعلم</h2>
            <button className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium">
              عرض الكل
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {lessons.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lessons.slice(0, 6).map((lesson, index) => (
                <LessonCard key={lesson.id} lesson={lesson} index={index} />
              ))}
            </div>
          ) : (
            <div className="glass rounded-2xl p-12 text-center">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">لا توجد دروس متاحة حالياً</p>
            </div>
          )}
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Daily Challenge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="glass rounded-2xl p-6 bg-gradient-to-r from-primary-500/10 to-secondary-500/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-6 h-6 text-primary-500" />
                  <h3 className="text-xl font-bold">التحدي اليومي</h3>
                </div>
                <p className="text-gray-600">أكمل 3 دروس اليوم واحصل على 100 نقطة إضافية!</p>
                <div className="mt-4">
                  <ProgressBar value={1} max={3} label="1 من 3 دروس" size="sm" />
                </div>
              </div>
              <div className="text-center">
                <Clock className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">باقي 18:34:22</p>
              </div>
            </div>
          </motion.div>

          {/* Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
          >
            <Leaderboard timeframe="weekly" />
          </motion.div>
        </div>
      </div>
    </div>
  )
}