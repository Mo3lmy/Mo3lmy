'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Clock, Heart, Zap, Award, Volume2,
  CheckCircle, XCircle, Lightbulb, SkipForward,
  Target, Trophy, TrendingUp, Calculator
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnswerCard3D } from '@/components/quiz/AnswerCard3D'
import { QuizTimer } from '@/components/quiz/QuizTimer'
import { LivesDisplay } from '@/components/quiz/LivesDisplay'
import { QuizProgress } from '@/components/quiz/QuizProgress'
import { ConfettiEffect } from '@/components/effects/ConfettiEffect'
import { useAuthStore } from '@/stores/authStore'
import { useStudentStore } from '@/stores/studentStore'
import apiService from '@/services/api'
import socketService from '@/services/socket'

interface Question {
  id: string
  type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'matching'
  question: string
  questionAr: string
  options: string[]
  correctAnswer: string
  explanation: string
  explanationAr: string
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
  visual?: string // For visual representation
}

interface QuizState {
  questions: Question[]
  currentQuestionIndex: number
  score: number
  lives: number
  streak: number
  timeSpent: number
  isAnswering: boolean
  showExplanation: boolean
  selectedAnswer: string | null
  isCorrect: boolean | null
  attemptId: string | null
}

const INITIAL_LIVES = 3
const HINT_PENALTY = 5
const SKIP_PENALTY = 10

export default function QuizPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { updateXP, updateStreak, emotionalState } = useStudentStore()

  const [loading, setLoading] = useState(true)
  const [quizState, setQuizState] = useState<QuizState>({
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    lives: INITIAL_LIVES,
    streak: 0,
    timeSpent: 0,
    isAnswering: false,
    showExplanation: false,
    selectedAnswer: null,
    isCorrect: null,
    attemptId: null
  })

  const [showConfetti, setShowConfetti] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    startQuiz()
  }, [isAuthenticated, params.lessonId])

  const startQuiz = async () => {
    try {
      setLoading(true)
      const response = await apiService.startQuiz(params.lessonId as string, 10)
      if (response.data.success) {
        setQuizState(prev => ({
          ...prev,
          questions: response.data.data.questions,
          attemptId: response.data.data.attemptId
        }))
      }
    } catch (error) {
      console.error('Failed to start quiz:', error)
      // Generate mock questions for demo
      generateMockQuestions()
    } finally {
      setLoading(false)
    }
  }

  const generateMockQuestions = () => {
    const mockQuestions: Question[] = [
      {
        id: '1',
        type: 'multiple_choice',
        question: 'What is 3/4 + 1/4?',
        questionAr: 'ما هو ناتج: ٣/٤ + ١/٤ = ؟',
        options: ['1', '4/8', '2/4', '3/8'],
        correctAnswer: '1',
        explanation: 'When adding fractions with the same denominator, add the numerators and keep the denominator the same.',
        explanationAr: 'عند جمع كسور لها نفس المقام، نجمع البسط ونحتفظ بالمقام كما هو',
        difficulty: 'easy',
        points: 10,
        visual: '▢▢▢■ + ▢▢▢■ = ▢▢▢▢'
      },
      {
        id: '2',
        type: 'multiple_choice',
        question: 'Which fraction is greater: 2/3 or 3/4?',
        questionAr: 'أي كسر أكبر: ٢/٣ أم ٣/٤؟',
        options: ['2/3', '3/4', 'They are equal', 'Cannot determine'],
        correctAnswer: '3/4',
        explanation: '3/4 = 0.75 while 2/3 = 0.667, so 3/4 is greater',
        explanationAr: '٣/٤ = ٠.٧٥ بينما ٢/٣ = ٠.٦٦٧، لذا ٣/٤ أكبر',
        difficulty: 'medium',
        points: 15,
        visual: '▢▢■ vs ▢▢▢■'
      },
      {
        id: '3',
        type: 'true_false',
        question: '1/2 is the same as 2/4',
        questionAr: '١/٢ يساوي ٢/٤',
        options: ['صح', 'خطأ'],
        correctAnswer: 'صح',
        explanation: 'Both fractions represent the same value when simplified',
        explanationAr: 'كلا الكسرين يمثلان نفس القيمة عند التبسيط',
        difficulty: 'easy',
        points: 10,
        visual: '▢■ = ▢▢■■'
      }
    ]
    setQuizState(prev => ({
      ...prev,
      questions: mockQuestions
    }))
  }

  const handleAnswer = async (answer: string) => {
    if (quizState.isAnswering) return

    setQuizState(prev => ({ ...prev, isAnswering: true, selectedAnswer: answer }))

    const currentQuestion = quizState.questions[quizState.currentQuestionIndex]
    const isCorrect = answer === currentQuestion.correctAnswer

    // Play sound effect
    if (audioRef.current) {
      audioRef.current.src = isCorrect ? '/sounds/success.mp3' : '/sounds/wrong.mp3'
      audioRef.current.play().catch(() => {})
    }

    // Update state
    setQuizState(prev => ({
      ...prev,
      isCorrect,
      score: isCorrect ? prev.score + currentQuestion.points : prev.score,
      streak: isCorrect ? prev.streak + 1 : 0,
      lives: !isCorrect ? Math.max(0, prev.lives - 1) : prev.lives,
      showExplanation: true
    }))

    // Show confetti for correct answer
    if (isCorrect) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)

      // Update XP
      updateXP(currentQuestion.points)
    }

    // Send answer to backend
    if (quizState.attemptId) {
      try {
        await apiService.submitAnswer(
          quizState.attemptId,
          currentQuestion.id,
          answer,
          quizState.timeSpent
        )
      } catch (error) {
        console.error('Failed to submit answer:', error)
      }
    }

    // Check if quiz is over
    if (quizState.lives === 1 && !isCorrect) {
      setTimeout(() => endQuiz(), 2000)
    } else {
      setTimeout(() => nextQuestion(), 3000)
    }
  }

  const nextQuestion = () => {
    if (quizState.currentQuestionIndex < quizState.questions.length - 1) {
      setQuizState(prev => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
        isAnswering: false,
        showExplanation: false,
        selectedAnswer: null,
        isCorrect: null
      }))
      setHintUsed(false)
    } else {
      endQuiz()
    }
  }

  const skipQuestion = () => {
    setQuizState(prev => ({
      ...prev,
      score: Math.max(0, prev.score - SKIP_PENALTY),
      streak: 0
    }))
    nextQuestion()
  }

  const useHint = () => {
    if (hintUsed || quizState.isAnswering) return

    setHintUsed(true)
    setQuizState(prev => ({
      ...prev,
      score: Math.max(0, prev.score - HINT_PENALTY)
    }))

    // Show hint (highlight wrong answers)
    const currentQuestion = quizState.questions[quizState.currentQuestionIndex]
    const wrongAnswers = currentQuestion.options.filter(
      opt => opt !== currentQuestion.correctAnswer
    )
    // Visual indication would be handled in AnswerCard3D component
  }

  const endQuiz = async () => {
    // Submit quiz completion
    if (quizState.attemptId) {
      try {
        await apiService.completeQuiz(quizState.attemptId)
      } catch (error) {
        console.error('Failed to complete quiz:', error)
      }
    }

    // Navigate to results page
    router.push(`/quiz/results?score=${quizState.score}&total=${quizState.questions.length * 10}`)
  }

  const handleTimeUpdate = (time: number) => {
    setQuizState(prev => ({ ...prev, timeSpent: time }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 to-secondary-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="rounded-full h-12 w-12 border-b-2 border-primary-400"
        />
      </div>
    )
  }

  const currentQuestion = quizState.questions[quizState.currentQuestionIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-purple-900 to-secondary-900 overflow-hidden">
      {/* Ambient particles background */}
      <div className="fixed inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/10 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Infinity,
              repeatType: 'reverse'
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 glass-dark">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Back button */}
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            {/* Quiz Progress */}
            <div className="flex-1 mx-6">
              <QuizProgress
                current={quizState.currentQuestionIndex + 1}
                total={quizState.questions.length}
                score={quizState.score}
                streak={quizState.streak}
              />
            </div>

            {/* Timer & Lives */}
            <div className="flex items-center gap-4">
              <QuizTimer onTimeUpdate={handleTimeUpdate} />
              <LivesDisplay lives={quizState.lives} maxLives={INITIAL_LIVES} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Quiz Area */}
      {currentQuestion && (
        <div className="container mx-auto px-6 py-8">
          {/* Question Display */}
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto mb-8"
          >
            {/* Category & Difficulty */}
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-full glass text-xs text-white font-medium">
                الكسور
              </span>
              <div className="flex items-center gap-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-2 h-2 rounded-full',
                      i < (currentQuestion.difficulty === 'easy' ? 1 :
                           currentQuestion.difficulty === 'medium' ? 2 : 3)
                        ? 'bg-primary-400'
                        : 'bg-white/20'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Question Card */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="glass-dark rounded-3xl p-8 text-center"
            >
              <h2 className="text-3xl font-bold text-white mb-6">
                {currentQuestion.questionAr}
              </h2>

              {/* Visual Representation */}
              {currentQuestion.visual && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl font-mono text-primary-300 mb-6"
                >
                  {currentQuestion.visual}
                </motion.div>
              )}

              {/* Points Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/20 text-warning">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">{currentQuestion.points} نقطة</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Answer Options */}
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 gap-4">
              {currentQuestion.options.map((option, index) => (
                <AnswerCard3D
                  key={index}
                  option={option}
                  index={index}
                  isSelected={quizState.selectedAnswer === option}
                  isCorrect={quizState.showExplanation && option === currentQuestion.correctAnswer}
                  isWrong={quizState.showExplanation && option === quizState.selectedAnswer && quizState.selectedAnswer !== currentQuestion.correctAnswer}
                  isDisabled={quizState.isAnswering}
                  onClick={() => handleAnswer(option)}
                  label={String.fromCharCode(65 + index)} // A, B, C, D
                />
              ))}
            </div>
          </div>

          {/* Helper Tools */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="max-w-4xl mx-auto mt-6 flex justify-center gap-4"
          >
            <button
              onClick={useHint}
              disabled={hintUsed || quizState.isAnswering}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl transition-all',
                hintUsed || quizState.isAnswering
                  ? 'glass opacity-50 cursor-not-allowed text-gray-400'
                  : 'glass hover:bg-white/10 text-white'
              )}
            >
              <Lightbulb className="w-5 h-5" />
              <span>تلميح</span>
              {!hintUsed && <span className="text-xs text-gray-400">-{HINT_PENALTY}pts</span>}
            </button>

            <button
              onClick={skipQuestion}
              disabled={quizState.isAnswering}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl transition-all',
                quizState.isAnswering
                  ? 'glass opacity-50 cursor-not-allowed text-gray-400'
                  : 'glass hover:bg-white/10 text-white'
              )}
            >
              <SkipForward className="w-5 h-5" />
              <span>تخطي</span>
              <span className="text-xs text-gray-400">-{SKIP_PENALTY}pts</span>
            </button>

            <button className="flex items-center gap-2 px-4 py-2 rounded-xl glass hover:bg-white/10 text-white">
              <Calculator className="w-5 h-5" />
              <span>آلة حاسبة</span>
            </button>
          </motion.div>

          {/* Feedback Area */}
          <AnimatePresence>
            {quizState.showExplanation && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto mt-8"
              >
                <div
                  className={cn(
                    'glass-dark rounded-2xl p-6 border',
                    quizState.isCorrect
                      ? 'border-success/30 bg-success/10'
                      : 'border-danger/30 bg-danger/10'
                  )}
                >
                  <div className="flex items-start gap-4">
                    {quizState.isCorrect ? (
                      <CheckCircle className="w-8 h-8 text-success flex-shrink-0" />
                    ) : (
                      <XCircle className="w-8 h-8 text-danger flex-shrink-0" />
                    )}

                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">
                        {quizState.isCorrect ? 'إجابة صحيحة! 🎉' : 'إجابة خاطئة'}
                      </h3>
                      <p className="text-gray-300 mb-3">{currentQuestion.explanationAr}</p>

                      {quizState.isCorrect && quizState.streak >= 3 && (
                        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-warning/20 inline-flex">
                          <Trophy className="w-5 h-5 text-warning" />
                          <span className="text-warning font-medium">
                            سلسلة من {quizState.streak} إجابات صحيحة!
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Audio for sound effects */}
      <audio ref={audioRef} />

      {/* Confetti Effect */}
      <AnimatePresence>
        {showConfetti && <ConfettiEffect />}
      </AnimatePresence>
    </div>
  )
}