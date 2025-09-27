// frontend/components/slides/SlideViewer.tsx
// Main slide viewer component

'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlides } from '@/hooks/useSlides'
import { useAudioSync } from '@/hooks/useAudioSync'
import { SlideRenderer } from './SlideRenderer'
import { SlideControls } from './SlideControls'
import { SlideThumbnails } from './SlideThumbnails'
import { AudioController } from './AudioController'
import { SlideErrorBoundary } from './SlideErrorBoundary'
import { SlideLoadingSkeleton } from './SlideLoadingSkeleton'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SlideViewerProps {
  lessonId: string
  userProfile: {
    grade: number
    gender?: string
    theme?: string
  }
  onSlideChange?: (slideIndex: number) => void
  onComplete?: () => void
  onInteraction?: (type: string, data: any) => void
  className?: string
}

export const SlideViewer: React.FC<SlideViewerProps> = ({
  lessonId,
  userProfile,
  onSlideChange,
  onComplete,
  onInteraction,
  className
}) => {
  const [showThumbnails, setShowThumbnails] = useState(false)
  const [viewStartTime, setViewStartTime] = useState(Date.now())

  const {
    slides,
    currentSlide,
    currentSlideIndex,
    totalSlides,
    loading,
    error,
    theme,
    goToSlide,
    nextSlide,
    previousSlide,
    hasNext,
    hasPrevious,
    progress,
    submitAnswer
  } = useSlides(lessonId, userProfile)

  const {
    isPlaying,
    currentTime,
    duration,
    currentWord,
    highlightedElement,
    togglePlayPause,
    seek,
    setVolume,
    setPlaybackRate,
    progress: audioProgress
  } = useAudioSync(slides, currentSlideIndex, {
    autoPlay: false,
    onSlideEnd: () => {
      if (hasNext) {
        nextSlide()
      } else {
        onComplete?.()
      }
    },
    onWordHighlight: (word) => {
      // Can be used for additional effects
      console.log('Highlighting word:', word)
    }
  })

  // Track slide changes
  useEffect(() => {
    onSlideChange?.(currentSlideIndex)
    setViewStartTime(Date.now())
  }, [currentSlideIndex, onSlideChange])

  // Handle slide interactions
  const handleSlideInteraction = (type: string, data: any) => {
    console.log('Slide interaction:', type, data)
    onInteraction?.(type, data)

    // Handle quiz answers
    if (type === 'quiz-answer' && currentSlide?.content.type === 'quiz') {
      submitAnswer(data.answer)
        .then((result) => {
          if (result.correct) {
            // Play success sound/animation
            onInteraction?.('quiz-success', result)
          } else {
            onInteraction?.('quiz-incorrect', result)
          }
        })
        .catch(console.error)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          if (hasNext) nextSlide()
          break
        case 'ArrowLeft':
          if (hasPrevious) previousSlide()
          break
        case ' ':
          e.preventDefault()
          togglePlayPause()
          break
        case 'f':
          if (e.ctrlKey) {
            e.preventDefault()
            document.documentElement.requestFullscreen()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasNext, hasPrevious, nextSlide, previousSlide, togglePlayPause])

  if (loading) {
    return <SlideLoadingSkeleton theme={theme} className="h-full" />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
        >
          إعادة المحاولة
        </button>
      </div>
    )
  }

  if (!currentSlide) {
    console.log('No current slide found. Slides:', slides, 'Index:', currentSlideIndex)
    return <div className="flex items-center justify-center h-full">لا توجد شرائح</div>
  }

  console.log('Rendering slide:', currentSlide)

  return (
    <div className={cn('slide-viewer flex flex-col h-full', className)}>
      {/* Progress bar */}
      <div className="h-1 bg-gray-200 relative">
        <motion.div
          className="absolute top-0 left-0 h-full bg-primary"
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', damping: 20 }}
        />
      </div>

      {/* Main slide area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlideIndex}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            <SlideErrorBoundary
              fallbackMessage="حدث خطأ في عرض هذه الشريحة"
              onError={(error, errorInfo) => {
                console.error('Slide rendering error:', error, errorInfo)
              }}
            >
              <SlideRenderer
                slide={currentSlide}
                theme={theme}
                currentWord={currentWord}
                highlightedElement={highlightedElement}
                onInteraction={handleSlideInteraction}
                className="w-full h-full"
              />
            </SlideErrorBoundary>
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        <div className="absolute inset-y-0 left-4 flex items-center">
          <button
            onClick={previousSlide}
            disabled={!hasPrevious}
            className={cn(
              'p-2 rounded-full bg-white shadow-lg transition-all',
              hasPrevious
                ? 'hover:bg-gray-100 hover:scale-110'
                : 'opacity-50 cursor-not-allowed'
            )}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="absolute inset-y-0 right-4 flex items-center">
          <button
            onClick={nextSlide}
            disabled={!hasNext}
            className={cn(
              'p-2 rounded-full bg-white shadow-lg transition-all',
              hasNext
                ? 'hover:bg-gray-100 hover:scale-110'
                : 'opacity-50 cursor-not-allowed'
            )}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Slide number indicator */}
        <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          {currentSlideIndex + 1} / {totalSlides}
        </div>
      </div>

      {/* Audio controller */}
      {currentSlide?.audioUrl && (
        <AudioController
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={togglePlayPause}
          onSeek={seek}
          onVolumeChange={setVolume}
          onSpeedChange={setPlaybackRate}
          className="border-t"
        />
      )}

      {/* Controls bar */}
      <SlideControls
        isPlaying={isPlaying}
        onPlayPause={togglePlayPause}
        currentSlide={currentSlideIndex}
        totalSlides={totalSlides}
        onSeek={goToSlide}
        onToggleThumbnails={() => setShowThumbnails(!showThumbnails)}
        showThumbnails={showThumbnails}
        className="border-t"
      />

      {/* Thumbnails drawer */}
      <AnimatePresence>
        {showThumbnails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 120, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t overflow-hidden"
          >
            <SlideThumbnails
              slides={slides}
              currentIndex={currentSlideIndex}
              onSelect={goToSlide}
              className="h-full"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}