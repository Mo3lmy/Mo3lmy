'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  icon: LucideIcon
  label: string
  value: number | string
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: string
  index?: number
}

export function StatsCard({ icon: Icon, label, value, trend, color = 'from-primary-400 to-primary-600', index = 0 }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      className="glass rounded-2xl p-6 relative overflow-hidden card-hover"
    >
      {/* Background decoration */}
      <div className={cn(
        'absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-10',
        `bg-gradient-to-br ${color}`
      )} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            `bg-gradient-to-br ${color}`
          )}>
            <Icon className="w-6 h-6 text-white" />
          </div>

          {trend && (
            <div className={cn(
              'px-2 py-1 rounded-lg text-xs font-semibold',
              trend.isPositive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.2 }}
        >
          <p className="text-3xl font-bold gradient-text mb-1">
            {typeof value === 'number' ? value.toLocaleString('ar-SA') : value}
          </p>
          <p className="text-sm text-gray-600">{label}</p>
        </motion.div>
      </div>
    </motion.div>
  )
}