// frontend/components/slides/MathInteractive.tsx
// Interactive math component for solving equations step-by-step

'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Lightbulb, RefreshCw, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MathInteractiveProps {
  equation: string
  answer: number
  steps?: string[]
  hints?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
  onComplete?: (data: { correct: boolean; attempts: number; time: number }) => void
  className?: string
}

export const MathInteractive: React.FC<MathInteractiveProps> = ({
  equation,
  answer,
  steps = [],
  hints = [],
  difficulty = 'medium',
  onComplete,
  className
}) => {
  const [userAnswer, setUserAnswer] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showSteps, setShowSteps] = useState(false)
  const [startTime] = useState(Date.now())
  const [showCalculator, setShowCalculator] = useState(false)

  // Check if answer is correct
  const checkAnswer = () => {
    const userValue = parseFloat(userAnswer)
    if (isNaN(userValue)) {
      setIsCorrect(false)
      setAttempts(attempts + 1)
      return
    }

    const correct = Math.abs(userValue - answer) < 0.001
    setIsCorrect(correct)
    setAttempts(attempts + 1)

    if (correct) {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000)
      onComplete?.({
        correct: true,
        attempts: attempts + 1,
        time: timeTaken
      })
    }
  }

  // Handle keyboard submission
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userAnswer && isCorrect === null) {
      checkAnswer()
    }
  }

  // Simple calculator
  const Calculator = () => (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="absolute left-0 top-full mt-2 bg-white rounded-lg shadow-xl p-4 z-10"
    >
      <div className="grid grid-cols-4 gap-2">
        {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'].map((btn) => (
          <button
            key={btn}
            onClick={() => {
              if (btn === '=') {
                try {
                  setUserAnswer(eval(userAnswer).toString())
                } catch {
                  // Invalid expression
                }
              } else {
                setUserAnswer(userAnswer + btn)
              }
            }}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded text-lg font-semibold"
          >
            {btn}
          </button>
        ))}
        <button
          onClick={() => setUserAnswer('')}
          className="col-span-4 p-2 bg-red-100 hover:bg-red-200 rounded text-red-600"
        >
          مسح
        </button>
      </div>
    </motion.div>
  )

  // Get feedback message
  const getFeedbackMessage = () => {
    if (isCorrect === true) {
      const messages = [
        'ممتاز! إجابة صحيحة',
        'رائع! أحسنت',
        'صحيح تماماً!',
        'عمل رائع!'
      ]
      return messages[Math.floor(Math.random() * messages.length)]
    } else if (isCorrect === false) {
      if (attempts >= 3) {
        return `حاول مرة أخرى. الإجابة الصحيحة هي ${answer}`
      }
      return 'غير صحيح، حاول مرة أخرى'
    }
    return null
  }

  // Render step-by-step solution
  const renderSteps = () => {
    if (steps.length === 0) return null

    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="mt-4 p-4 bg-blue-50 rounded-lg"
      >
        <h4 className="font-bold text-blue-800 mb-2">خطوات الحل:</h4>
        <div className="space-y-2">
          {steps.slice(0, currentStep + 1).map((step, index) => (
            <motion.div
              key={index}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start"
            >
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs ml-2">
                {index + 1}
              </span>
              <span className="text-gray-700">{step}</span>
            </motion.div>
          ))}
        </div>
        {currentStep < steps.length - 1 && (
          <button
            onClick={() => setCurrentStep(currentStep + 1)}
            className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            الخطوة التالية ←
          </button>
        )}
      </motion.div>
    )
  }

  // Render hints
  const renderHint = () => {
    if (hints.length === 0 || !showHint) return null

    const hintIndex = Math.min(attempts, hints.length - 1)
    return (
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
      >
        <div className="flex items-center text-yellow-800">
          <Lightbulb className="w-5 h-5 ml-2" />
          <span className="text-sm">{hints[hintIndex]}</span>
        </div>
      </motion.div>
    )
  }

  return (
    <div className={cn('math-interactive p-6 bg-white rounded-lg shadow-lg', className)}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">حل المعادلة</h3>
        <div className="flex items-center justify-between">
          <div className="text-3xl font-mono bg-gray-100 px-4 py-2 rounded">
            {equation}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2 py-1 rounded text-sm',
              difficulty === 'easy' ? 'bg-green-100 text-green-700' :
              difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            )}>
              {difficulty === 'easy' ? 'سهل' :
               difficulty === 'medium' ? 'متوسط' : 'صعب'}
            </span>
            {attempts > 0 && (
              <span className="text-sm text-gray-500">
                المحاولات: {attempts}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">إجابتك:</label>
        <div className="flex gap-2 relative">
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isCorrect === true}
            placeholder="أدخل الإجابة هنا"
            className={cn(
              'flex-1 px-4 py-2 border-2 rounded-lg text-lg font-mono transition-colors',
              isCorrect === true ? 'bg-green-50 border-green-500' :
              isCorrect === false ? 'bg-red-50 border-red-500' :
              'border-gray-300 focus:border-blue-500'
            )}
          />

          {/* Action buttons */}
          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title="آلة حاسبة"
          >
            <Calculator className="w-5 h-5" />
          </button>

          {isCorrect === null && (
            <button
              onClick={checkAnswer}
              disabled={!userAnswer}
              className={cn(
                'px-6 py-2 rounded-lg font-bold transition-all',
                userAnswer
                  ? 'bg-primary text-white hover:bg-primary-dark'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              تحقق
            </button>
          )}

          {isCorrect !== null && (
            <button
              onClick={() => {
                setUserAnswer('')
                setIsCorrect(null)
                setCurrentStep(0)
                setShowHint(false)
                setShowSteps(false)
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}

          {/* Calculator dropdown */}
          <AnimatePresence>
            {showCalculator && <Calculator />}
          </AnimatePresence>
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence mode="wait">
        {isCorrect !== null && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={cn(
              'p-4 rounded-lg flex items-center justify-between mb-4',
              isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            )}
          >
            <div className="flex items-center">
              {isCorrect ? (
                <Check className="w-6 h-6 ml-2" />
              ) : (
                <X className="w-6 h-6 ml-2" />
              )}
              <span className="font-medium">{getFeedbackMessage()}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hints */}
      {!isCorrect && attempts > 0 && hints.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowHint(!showHint)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
          >
            <Lightbulb className="w-4 h-4 ml-1" />
            {showHint ? 'إخفاء التلميح' : 'عرض تلميح'}
          </button>
          {renderHint()}
        </div>
      )}

      {/* Step-by-step solution */}
      {steps.length > 0 && (
        <div>
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2"
          >
            {showSteps ? 'إخفاء خطوات الحل' : 'عرض خطوات الحل'}
          </button>
          <AnimatePresence>
            {showSteps && renderSteps()}
          </AnimatePresence>
        </div>
      )}

      {/* Progress indicator for hard problems */}
      {difficulty === 'hard' && attempts > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>التقدم</span>
            <span>{Math.min((attempts / 5) * 100, 100).toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((attempts / 5) * 100, 100)}%` }}
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
            />
          </div>
        </div>
      )}
    </div>
  )
}