'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Play, Pause, SkipForward, SkipBack,
  Volume2, Settings, Mic, Edit3, HelpCircle, MessageCircle,
  Lightbulb, ChevronUp, X, Maximize2, Minimize2,
  PenTool, Eraser, Download, RefreshCw, Check, Presentation
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Whiteboard } from '@/components/classroom/Whiteboard'
import { AITeacher } from '@/components/classroom/AITeacher'
import { VoiceWaveform } from '@/components/classroom/VoiceWaveform'
import { AssistantPanel } from '@/components/classroom/AssistantPanel'
import { QuickActions } from '@/components/classroom/QuickActions'
import { SlideViewer } from '@/components/slides/SlideViewer'
import { useAuthStore } from '@/stores/authStore'
import { useStudentStore } from '@/stores/studentStore'
import socketService from '@/services/socket'
import apiService from '@/services/api'
import slidesService from '@/services/slides.service'

interface ClassroomState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isFullscreen: boolean
  showAssistant: boolean
  assistantMode: 'floating' | 'sidebar' | 'hidden'
  showWhiteboard: boolean
  currentTool: 'pen' | 'eraser' | null
  isSpeaking: boolean
  viewMode: 'slides' | 'video' | 'whiteboard'
}

export default function ClassroomPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { emotionalState, updateEmotionalEnergy } = useStudentStore()

  const [lesson, setLesson] = useState<{
    id?: string
    titleAr?: string
    subject?: { nameAr: string }
    gradeLevel?: string
    keyPoints?: string[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<ClassroomState>({
    isPlaying: false,
    currentTime: 0,
    duration: 600, // 10 minutes default
    volume: 80,
    isFullscreen: false,
    showAssistant: true, // Show by default
    assistantMode: 'sidebar', // Start as sidebar
    showWhiteboard: false,
    currentTool: null,
    isSpeaking: false,
    viewMode: 'slides' // Default to slides view
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const assistantPanelRef = useRef<HTMLDivElement>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [currentTopic, setCurrentTopic] = useState<string>('')

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadLesson()
  }, [isAuthenticated, params.lessonId])

  const loadLesson = async () => {
    try {
      setLoading(true)
      const response = await apiService.getLessonById(params.lessonId as string)
      if (response.success && response.data) {
        setLesson(response.data)
      }
    } catch (error) {
      console.error('Failed to load lesson:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePlay = () => {
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))
    if (videoRef.current) {
      if (state.isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setState(prev => ({ ...prev, isFullscreen: true }))
    } else {
      document.exitFullscreen()
      setState(prev => ({ ...prev, isFullscreen: false }))
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = (parseInt(e.target.value) / 100) * state.duration
    setState(prev => ({ ...prev, currentTime: newTime }))
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value)
    setState(prev => ({ ...prev, volume: newVolume }))
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100
    }
  }

  // Handle slide generation for hints
  const generateHintSlide = async () => {
    if (state.viewMode === 'slides' && lesson?.id) {
      try {
        const result = await slidesService.generateSingleSlide(
          lesson.id,
          {
            topic: 'تلميح للمساعدة',
            type: 'example'
          }
        )
        console.log('Hint slide generated:', result)
      } catch (error) {
        console.error('Error generating hint slide:', error)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="rounded-full h-12 w-12 border-b-2 border-primary-500"
        />
      </div>
    )
  }

  return (
    <div className={cn(
      'min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 transition-all duration-300',
      state.isFullscreen && 'p-0'
    )}>
      {/* Header */}
      <AnimatePresence>
        {!state.isFullscreen && (
          <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="glass-dark sticky top-0 z-40"
          >
            <div className="container mx-auto px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-white">
                      {lesson?.titleAr || 'جاري التحميل...'}
                    </h1>
                    <p className="text-sm text-gray-300">
                      {lesson?.subject?.nameAr} • {lesson?.gradeLevel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <Maximize2 className="w-5 h-5 text-white" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <Settings className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Main Learning Stage */}
      <div className="relative">
        <div className="container mx-auto px-6 py-8">
          <div className={cn(
            "grid gap-6 transition-all duration-300",
            state.assistantMode === 'sidebar' && state.showAssistant
              ? "lg:grid-cols-4" // 4 columns when sidebar is open
              : "lg:grid-cols-3"   // 3 columns when sidebar is closed
          )}>
            {/* Content Area */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "transition-all duration-300",
                state.assistantMode === 'sidebar' && state.showAssistant
                  ? "lg:col-span-2" // Take 2 columns when sidebar is open
                  : "lg:col-span-2"   // Take 2 columns when closed
              )}
            >
              <div className="glass-dark rounded-2xl overflow-hidden">
                {/* Main Content Area */}
                <div className="relative aspect-video bg-white/5">
                  {/* Slides View */}
                  {state.viewMode === 'slides' && (
                    <SlideViewer
                      lessonId={params.lessonId as string}
                      userProfile={{
                        grade: parseInt(lesson?.gradeLevel || '6'),
                        gender: user?.gender,
                        theme: slidesService.getUserTheme(
                          parseInt(lesson?.gradeLevel || '6'),
                          user?.gender
                        )
                      }}
                      onSlideChange={(index, topic) => {
                        setCurrentSlideIndex(index)
                        if (topic) setCurrentTopic(topic)
                      }}
                      onComplete={() => {
                        console.log('Lesson completed')
                        // Handle lesson completion
                        updateEmotionalEnergy(10) // Reward for completion
                      }}
                      onInteraction={(type, data) => {
                        console.log('Slide interaction:', type, data)
                        // Handle slide interactions
                        if (type === 'quiz-success') {
                          updateEmotionalEnergy(5) // Reward for correct answer
                        }
                        // Update topic if available in interaction data
                        if (data?.topic) {
                          setCurrentTopic(data.topic)
                        }
                      }}
                      className="w-full h-full"
                    />
                  )}

                  {/* Whiteboard Overlay */}
                  {state.showWhiteboard && (
                    <div className="absolute inset-0 z-10 pointer-events-auto">
                      <Whiteboard
                        ref={canvasRef}
                        tool={state.currentTool}
                        onClear={() => setState(prev => ({ ...prev, currentTool: null }))}
                      />
                    </div>
                  )}

                  {/* Video View (legacy) */}
                  {state.viewMode === 'video' && (
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-contain"
                      style={{ opacity: 0.9 }}
                    />
                  )}

                  {/* Drawing Tools */}
                  {state.showWhiteboard && (
                    <motion.div
                      initial={{ x: -100 }}
                      animate={{ x: 0 }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 glass-dark rounded-xl p-2 space-y-2 z-20"
                    >
                      <button
                        onClick={() => setState(prev => ({
                          ...prev,
                          currentTool: prev.currentTool === 'pen' ? null : 'pen'
                        }))}
                        className={cn(
                          'p-3 rounded-lg transition-all',
                          state.currentTool === 'pen'
                            ? 'bg-primary-500 text-white'
                            : 'hover:bg-white/10 text-gray-300'
                        )}
                      >
                        <PenTool className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setState(prev => ({
                          ...prev,
                          currentTool: prev.currentTool === 'eraser' ? null : 'eraser'
                        }))}
                        className={cn(
                          'p-3 rounded-lg transition-all',
                          state.currentTool === 'eraser'
                            ? 'bg-primary-500 text-white'
                            : 'hover:bg-white/10 text-gray-300'
                        )}
                      >
                        <Eraser className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          if (canvasRef.current) {
                            const ctx = canvasRef.current.getContext('2d')
                            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                          }
                        }}
                        className="p-3 rounded-lg hover:bg-white/10 text-gray-300"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </motion.div>
                  )}

                  {/* View Mode Toggle */}
                  <div className="absolute top-4 right-4 glass-dark rounded-lg p-1 flex gap-1 z-20">
                    <button
                      onClick={() => setState(prev => ({ ...prev, viewMode: 'slides' }))}
                      className={cn(
                        'px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2',
                        state.viewMode === 'slides'
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-300 hover:bg-white/10'
                      )}
                    >
                      <Presentation className="w-4 h-4" />
                      شرائح
                    </button>
                    <button
                      onClick={() => setState(prev => ({ ...prev, showWhiteboard: !prev.showWhiteboard }))}
                      className={cn(
                        'px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2',
                        state.showWhiteboard
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-300 hover:bg-white/10'
                      )}
                    >
                      <Edit3 className="w-4 h-4" />
                      سبورة
                    </button>
                  </div>
                </div>

                {/* Control Bar - Now managed by SlideViewer when in slides mode */}
                {state.viewMode !== 'slides' && (
                  <div className="p-4 border-t border-white/10">
                    <div className="flex items-center gap-4">
                      {/* Play Controls */}
                      <div className="flex items-center gap-2">
                        <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                          <SkipBack className="w-5 h-5 text-white" />
                        </button>
                        <button
                          onClick={togglePlay}
                          className="p-3 rounded-full bg-primary-500 hover:bg-primary-600 transition-colors"
                        >
                          {state.isPlaying ? (
                            <Pause className="w-6 h-6 text-white" />
                          ) : (
                            <Play className="w-6 h-6 text-white ml-0.5" />
                          )}
                        </button>
                        <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                          <SkipForward className="w-5 h-5 text-white" />
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="flex-1 flex items-center gap-3">
                        <span className="text-sm text-gray-300">
                          {formatTime(state.currentTime)}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={(state.currentTime / state.duration) * 100}
                          onChange={handleProgressChange}
                          className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none
                                   [&::-webkit-slider-thumb]:w-4
                                   [&::-webkit-slider-thumb]:h-4
                                   [&::-webkit-slider-thumb]:rounded-full
                                   [&::-webkit-slider-thumb]:bg-primary-500"
                        />
                        <span className="text-sm text-gray-300">
                          {formatTime(state.duration)}
                        </span>
                      </div>

                      {/* Volume Control */}
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-5 h-5 text-gray-300" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={state.volume}
                          onChange={handleVolumeChange}
                          className="w-24 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none
                                   [&::-webkit-slider-thumb]:w-3
                                   [&::-webkit-slider-thumb]:h-3
                                   [&::-webkit-slider-thumb]:rounded-full
                                   [&::-webkit-slider-thumb]:bg-white"
                        />
                      </div>

                      {/* Fullscreen */}
                      <button
                        onClick={toggleFullscreen}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        {state.isFullscreen ? (
                          <Minimize2 className="w-5 h-5 text-white" />
                        ) : (
                          <Maximize2 className="w-5 h-5 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <QuickActions
                onAsk={() => setState(prev => ({
                  ...prev,
                  showAssistant: true,
                  assistantMode: prev.assistantMode === 'hidden' ? 'floating' : prev.assistantMode
                }))}
                onNote={() => {}}
                onQuiz={() => router.push(`/quiz/${params.lessonId}`)}
                onHint={generateHintSlide}
              />

              {/* Chat Mode Toggle */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between glass-dark rounded-xl p-3 mt-4"
              >
                <span className="text-sm text-gray-300">مساعد الشات:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setState(prev => ({
                      ...prev,
                      assistantMode: 'sidebar',
                      showAssistant: true
                    }))}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs transition-all",
                      state.assistantMode === 'sidebar'
                        ? "bg-primary-500 text-white"
                        : "bg-white/10 text-gray-400 hover:bg-white/20"
                    )}
                  >
                    شريط جانبي
                  </button>
                  <button
                    onClick={() => setState(prev => ({
                      ...prev,
                      assistantMode: 'floating',
                      showAssistant: true
                    }))}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs transition-all",
                      state.assistantMode === 'floating'
                        ? "bg-primary-500 text-white"
                        : "bg-white/10 text-gray-400 hover:bg-white/20"
                    )}
                  >
                    عائم
                  </button>
                  <button
                    onClick={() => setState(prev => ({
                      ...prev,
                      assistantMode: 'hidden',
                      showAssistant: false
                    }))}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs transition-all",
                      state.assistantMode === 'hidden'
                        ? "bg-primary-500 text-white"
                        : "bg-white/10 text-gray-400 hover:bg-white/20"
                    )}
                  >
                    مخفي
                  </button>
                </div>
              </motion.div>
            </motion.div>

            {/* AI Teacher Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-dark rounded-2xl p-6"
            >
              <AITeacher
                isTeaching={state.isPlaying}
                currentLesson={lesson?.titleAr}
                emotionalState={emotionalState}
              />

              {/* Voice Waveform */}
              {state.isSpeaking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4"
                >
                  <VoiceWaveform isActive={state.isSpeaking} />
                </motion.div>
              )}

              {/* Lesson Info */}
              <div className="mt-6 space-y-4">
                <div className="glass rounded-xl p-4">
                  <h3 className="font-bold text-white mb-2">نقاط رئيسية</h3>
                  <ul className="space-y-2">
                    {lesson?.keyPoints?.map((point: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-300">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="glass rounded-xl p-4">
                  <h3 className="font-bold text-white mb-2">مستوى الطاقة</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${emotionalState.energy}%` }}
                        className={cn(
                          'h-full rounded-full',
                          emotionalState.energy > 60
                            ? 'bg-gradient-to-r from-success to-emerald-400'
                            : emotionalState.energy > 30
                            ? 'bg-gradient-to-r from-warning to-yellow-400'
                            : 'bg-gradient-to-r from-danger to-red-400'
                        )}
                      />
                    </div>
                    <span className="text-sm text-gray-300">{emotionalState.energy}%</span>
                  </div>
                </div>

                <div className="glass rounded-xl p-4">
                  <h3 className="font-bold text-white mb-2">الشريحة الحالية</h3>
                  <p className="text-sm text-gray-300">
                    شريحة {currentSlideIndex + 1}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Chat Sidebar - Only show when mode is sidebar */}
            {state.assistantMode === 'sidebar' && state.showAssistant && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: 0.1 }}
                className="glass-dark rounded-2xl overflow-hidden max-h-[80vh]"
              >
                <AssistantPanel
                  lessonId={params.lessonId as string}
                  lessonTitle={lesson?.titleAr}
                  subject={lesson?.subject?.nameAr}
                  grade={parseInt(lesson?.gradeLevel || '0')}
                  currentSlideIndex={currentSlideIndex}
                  currentTopic={currentTopic}
                  onClose={() => setState(prev => ({ ...prev, assistantMode: 'hidden', showAssistant: false }))}
                  onNewMessage={() => {
                    // Optional: Handle new message events
                    console.log('New message in sidebar chat');
                  }}
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Assistant Panel - Only show when mode is floating */}
      <AnimatePresence>
        {state.showAssistant && state.assistantMode === 'floating' && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setState(prev => ({ ...prev, showAssistant: false }))}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />

            {/* Panel */}
            <motion.div
              ref={assistantPanelRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 20 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh]"
            >
              <AssistantPanel
                lessonId={params.lessonId as string}
                lessonTitle={lesson?.titleAr}
                subject={lesson?.subject?.nameAr}
                grade={parseInt(lesson?.gradeLevel || '0')}
                currentSlideIndex={currentSlideIndex}
                currentTopic={currentTopic}
                onClose={() => setState(prev => ({ ...prev, showAssistant: false, assistantMode: 'hidden' }))}
                onNewMessage={() => {
                  console.log('New message in floating chat');
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Emotional State Indicator */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed top-20 right-4 glass-dark rounded-xl p-3 text-sm"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{emotionalState.current === 'happy' ? '😊' :
                                       emotionalState.current === 'neutral' ? '😐' :
                                       emotionalState.current === 'sad' ? '😔' :
                                       emotionalState.current === 'confused' ? '😕' : '😴'}</span>
          <span className="text-white font-medium capitalize">{emotionalState.current}</span>
        </div>
        <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-secondary-400 rounded-full transition-all duration-300"
            style={{ width: `${emotionalState.energy}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">Energy: {emotionalState.energy}%</p>
      </motion.div>
    </div>
  )
}