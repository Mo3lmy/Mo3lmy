'use client'

import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnswerCard3DProps {
  option: string
  index: number
  isSelected: boolean
  isCorrect: boolean
  isWrong: boolean
  isDisabled: boolean
  onClick: () => void
  label: string
}

export function AnswerCard3D({
  option,
  index,
  isSelected,
  isCorrect,
  isWrong,
  isDisabled,
  onClick,
  label
}: AnswerCard3DProps) {
  return (
    <motion.div
      initial={{ opacity: 0, rotateY: -180, scale: 0.8 }}
      animate={{ opacity: 1, rotateY: 0, scale: 1 }}
      transition={{
        delay: index * 0.1,
        type: 'spring',
        stiffness: 100
      }}
      whileHover={!isDisabled ? { scale: 1.05, rotateY: 5 } : {}}
      whileTap={!isDisabled ? { scale: 0.95 } : {}}
      className="relative preserve-3d"
      style={{ perspective: 1000 }}
    >
      <button
        onClick={onClick}
        disabled={isDisabled}
        className={cn(
          'relative w-full p-6 rounded-2xl transition-all duration-300 transform-gpu',
          'border-2 backdrop-blur-sm',
          isDisabled && 'cursor-not-allowed',
          !isSelected && !isCorrect && !isWrong && [
            'glass hover:bg-white/10',
            'border-white/20 hover:border-primary-400/50'
          ],
          isSelected && !isCorrect && !isWrong && [
            'bg-primary-500/20 border-primary-400',
            'shadow-lg shadow-primary-500/25'
          ],
          isCorrect && [
            'bg-success/20 border-success',
            'shadow-lg shadow-success/25 animate-bounce-in'
          ],
          isWrong && [
            'bg-danger/20 border-danger',
            'shadow-lg shadow-danger/25 animate-shake'
          ]
        )}
        style={{
          transformStyle: 'preserve-3d',
          transform: isSelected ? 'translateZ(20px)' : 'translateZ(0)'
        }}
      >
        {/* 3D Shadow Effect */}
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500/20 to-secondary-500/20"
          style={{
            transform: 'translateZ(-10px)',
            filter: 'blur(10px)',
            opacity: isSelected ? 0.5 : 0
          }}
        />

        {/* Label Badge */}
        <div
          className={cn(
            'absolute -top-3 -left-3 w-10 h-10 rounded-full flex items-center justify-center',
            'text-white font-bold text-lg border-2',
            'transform rotate-12 transition-all duration-300',
            isCorrect && 'bg-success border-success animate-flip-3d',
            isWrong && 'bg-danger border-danger',
            !isCorrect && !isWrong && 'bg-gradient-to-br from-primary-400 to-secondary-400 border-white/20'
          )}
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateZ(12deg) ${isSelected ? 'scale(1.2)' : 'scale(1)'}`
          }}
        >
          {label}
        </div>

        {/* Answer Content */}
        <div className="relative z-10">
          <p className={cn(
            'text-xl font-bold transition-colors',
            isCorrect && 'text-success',
            isWrong && 'text-danger',
            !isCorrect && !isWrong && 'text-white'
          )}>
            {option}
          </p>

          {/* Visual Representation (if it's a fraction) */}
          {option.includes('/') && (
            <div className="mt-3 flex justify-center">
              <div className="flex gap-1">
                {/* Create visual blocks for fraction */}
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-8 h-8 rounded border-2',
                      i < parseInt(option.split('/')[0])
                        ? 'bg-primary-400/50 border-primary-400'
                        : 'bg-white/10 border-white/20'
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Result Icon */}
        {(isCorrect || isWrong) && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="absolute top-2 right-2"
          >
            {isCorrect ? (
              <Check className="w-6 h-6 text-success" />
            ) : (
              <X className="w-6 h-6 text-danger" />
            )}
          </motion.div>
        )}

        {/* Glow Effect */}
        {isSelected && !isCorrect && !isWrong && (
          <motion.div
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: [1, 1.05, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity
            }}
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(79, 70, 229, 0.3), transparent)',
              filter: 'blur(20px)'
            }}
          />
        )}
      </button>
    </motion.div>
  )
}