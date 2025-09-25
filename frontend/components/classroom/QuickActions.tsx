'use client'

import { motion } from 'framer-motion'
import { Mic, Edit3, HelpCircle, Lightbulb } from 'lucide-react'

interface QuickActionsProps {
  onAsk: () => void
  onNote: () => void
  onQuiz: () => void
  onHint: () => void
}

export function QuickActions({ onAsk, onNote, onQuiz, onHint }: QuickActionsProps) {
  const actions = [
    {
      icon: Mic,
      label: 'اسأل',
      color: 'from-purple-500 to-pink-500',
      onClick: onAsk
    },
    {
      icon: Edit3,
      label: 'ملاحظة',
      color: 'from-blue-500 to-cyan-500',
      onClick: onNote
    },
    {
      icon: HelpCircle,
      label: 'اختبار',
      color: 'from-green-500 to-emerald-500',
      onClick: onQuiz
    },
    {
      icon: Lightbulb,
      label: 'تلميح',
      color: 'from-yellow-500 to-orange-500',
      onClick: onHint
    }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mt-4 flex justify-center gap-4"
    >
      {actions.map((action, index) => (
        <motion.button
          key={index}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5 + index * 0.1, type: 'spring', stiffness: 200 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={action.onClick}
          className="group relative"
        >
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${action.color}
                      flex items-center justify-center shadow-lg
                      group-hover:shadow-xl transition-all duration-300`}
          >
            <action.icon className="w-6 h-6 text-white" />
          </div>

          {/* Tooltip */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            whileHover={{ opacity: 1, y: 0 }}
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 pointer-events-none"
          >
            <span className="text-xs text-white bg-gray-800 px-2 py-1 rounded-lg whitespace-nowrap">
              {action.label}
            </span>
          </motion.div>

          {/* Pulse effect */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3
            }}
            className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${action.color} opacity-0`}
          />
        </motion.button>
      ))}
    </motion.div>
  )
}