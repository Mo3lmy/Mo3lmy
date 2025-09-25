'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy, Medal, Award, Crown, TrendingUp, TrendingDown,
  Users, Star, Flame, Target, ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeaderboardEntry {
  id: string
  rank: number
  previousRank: number
  name: string
  avatar?: string
  xp: number
  level: number
  streak: number
  achievements: number
  isCurrentUser?: boolean
  isFriend?: boolean
}

interface LeaderboardProps {
  timeframe?: 'daily' | 'weekly' | 'monthly' | 'all-time'
  showPromotion?: boolean
}

export function Leaderboard({ timeframe = 'weekly', showPromotion = true }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe)

  useEffect(() => {
    // Mock data - replace with actual API call
    const mockEntries: LeaderboardEntry[] = [
      {
        id: '1',
        rank: 1,
        previousRank: 2,
        name: 'سارة أحمد',
        xp: 2450,
        level: 12,
        streak: 15,
        achievements: 24,
        isFriend: true
      },
      {
        id: '2',
        rank: 2,
        previousRank: 1,
        name: 'محمد علي',
        xp: 2380,
        level: 11,
        streak: 12,
        achievements: 22
      },
      {
        id: '3',
        rank: 3,
        previousRank: 5,
        name: 'فاطمة حسن',
        xp: 2210,
        level: 11,
        streak: 8,
        achievements: 20,
        isFriend: true
      },
      {
        id: '42',
        rank: 42,
        previousRank: 47,
        name: 'أنت',
        xp: 1235,
        level: 7,
        streak: 3,
        achievements: 12,
        isCurrentUser: true
      }
    ]

    setTimeout(() => {
      setEntries(mockEntries)
      setLoading(false)
    }, 1000)
  }, [selectedTimeframe])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" />
      case 3:
        return <Medal className="w-6 h-6 text-orange-400" />
      default:
        return <span className="text-xl font-bold text-gray-400">#{rank}</span>
    }
  }

  const getRankChange = (current: number, previous: number) => {
    const change = previous - current
    if (change > 0) {
      return (
        <div className="flex items-center gap-1 text-success">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-medium">+{change}</span>
        </div>
      )
    } else if (change < 0) {
      return (
        <div className="flex items-center gap-1 text-danger">
          <TrendingDown className="w-4 h-4" />
          <span className="text-xs font-medium">{change}</span>
        </div>
      )
    }
    return null
  }

  const timeframes = [
    { value: 'daily', label: 'اليوم', icon: Target },
    { value: 'weekly', label: 'الأسبوع', icon: Star },
    { value: 'monthly', label: 'الشهر', icon: Trophy },
    { value: 'all-time', label: 'الكل', icon: Crown }
  ]

  return (
    <div className="glass-dark rounded-3xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-400" />
          <h2 className="text-2xl font-bold text-white">لوحة الصدارة</h2>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setSelectedTimeframe(tf.value as 'daily' | 'weekly' | 'monthly' | 'all-time')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl transition-all',
                selectedTimeframe === tf.value
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'glass hover:bg-white/10 text-gray-400'
              )}
            >
              <tf.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tf.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Promotion/Relegation Zones */}
      {showPromotion && (
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-gray-400">منطقة الترقية</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span className="text-gray-400">منطقة آمنة</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-danger" />
            <span className="text-gray-400">منطقة الخطر</span>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      <div className="space-y-3">
        <AnimatePresence>
          {loading ? (
            // Loading skeleton
            [...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-xl p-4 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/10" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-24 bg-white/10 rounded" />
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'relative glass rounded-xl p-4 transition-all',
                  entry.isCurrentUser && 'border-2 border-primary-500/50 bg-primary-500/10',
                  entry.isFriend && !entry.isCurrentUser && 'border border-blue-500/30',
                  entry.rank <= 3 && 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10'
                )}
              >
                {/* Promotion/Relegation Indicator */}
                {showPromotion && (
                  <div
                    className={cn(
                      'absolute left-0 top-0 bottom-0 w-1 rounded-l-xl',
                      entry.rank <= 3 && 'bg-success',
                      entry.rank > 3 && entry.rank <= 30 && 'bg-warning',
                      entry.rank > 30 && 'bg-danger'
                    )}
                  />
                )}

                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="w-12 flex justify-center">
                    {getRankIcon(entry.rank)}
                  </div>

                  {/* Avatar */}
                  <div className="relative">
                    <div className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center text-white font-bold',
                      `bg-gradient-to-br from-primary-400 to-secondary-500`
                    )}>
                      {entry.name[0]}
                    </div>
                    {entry.isFriend && (
                      <Users className="absolute -bottom-1 -right-1 w-4 h-4 text-blue-400" />
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white">
                        {entry.name}
                        {entry.isCurrentUser && <span className="text-primary-300"> (أنت)</span>}
                      </p>
                      <span className="px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300 text-xs">
                        مستوى {entry.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-400">{entry.xp} XP</span>
                      {entry.streak > 0 && (
                        <div className="flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-400" />
                          <span className="text-xs text-orange-400">{entry.streak}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Award className="w-3 h-3 text-yellow-400" />
                        <span className="text-xs text-yellow-400">{entry.achievements}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rank Change */}
                  <div className="text-center">
                    {getRankChange(entry.rank, entry.previousRank)}
                  </div>
                </div>

                {/* XP Progress Bar */}
                <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(entry.xp / 3000) * 100}%` }}
                    transition={{ delay: index * 0.1 + 0.3, type: 'spring' }}
                    className="h-full bg-gradient-to-r from-primary-400 to-secondary-400"
                  />
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* View More Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full mt-6 p-3 glass rounded-xl hover:bg-white/10 transition-colors
                 flex items-center justify-center gap-2 text-gray-300"
      >
        <span>عرض المزيد</span>
        <ChevronUp className="w-4 h-4 rotate-180" />
      </motion.button>

      {/* Current User Position (if not in top) */}
      {entries.find(e => e.isCurrentUser) && entries.find(e => e.isCurrentUser)!.rank > 10 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-center text-sm text-gray-400 mb-2">موقعك الحالي</p>
          {entries
            .filter(e => e.isCurrentUser)
            .map(entry => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-4 border-2 border-primary-500/50 bg-primary-500/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-primary-300">#{entry.rank}</span>
                    <div>
                      <p className="font-bold text-white">{entry.name}</p>
                      <p className="text-sm text-gray-400">{entry.xp} XP • مستوى {entry.level}</p>
                    </div>
                  </div>
                  {getRankChange(entry.rank, entry.previousRank)}
                </div>
              </motion.div>
            ))}
        </div>
      )}
    </div>
  )
}