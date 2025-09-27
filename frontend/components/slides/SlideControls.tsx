// frontend/components/slides/SlideControls.tsx
// Slide navigation and control buttons

'use client'

import React from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Grid,
  Maximize2,
  Volume2,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SlideControlsProps {
  isPlaying: boolean
  onPlayPause: () => void
  currentSlide: number
  totalSlides: number
  onSeek: (slideIndex: number) => void
  onToggleThumbnails: () => void
  showThumbnails: boolean
  className?: string
}

export const SlideControls: React.FC<SlideControlsProps> = ({
  isPlaying,
  onPlayPause,
  currentSlide,
  totalSlides,
  onSeek,
  onToggleThumbnails,
  showThumbnails,
  className
}) => {
  const handlePrevious = () => {
    if (currentSlide > 0) {
      onSeek(currentSlide - 1)
    }
  }

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      onSeek(currentSlide + 1)
    }
  }

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  return (
    <div className={cn('slide-controls flex items-center justify-between p-3 bg-gray-50', className)}>
      {/* Left controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPlayPause}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={handlePrevious}
          disabled={currentSlide === 0}
          className={cn(
            'p-2 rounded-lg transition-colors',
            currentSlide === 0
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-gray-200'
          )}
          title="الشريحة السابقة"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={handleNext}
          disabled={currentSlide === totalSlides - 1}
          className={cn(
            'p-2 rounded-lg transition-colors',
            currentSlide === totalSlides - 1
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-gray-200'
          )}
          title="الشريحة التالية"
        >
          <SkipForward className="w-5 h-5" />
        </button>

        {/* Slide selector */}
        <div className="flex items-center gap-2 mx-4">
          <span className="text-sm text-gray-600">الشريحة</span>
          <select
            value={currentSlide}
            onChange={(e) => onSeek(parseInt(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {Array.from({ length: totalSlides }).map((_, index) => (
              <option key={index} value={index}>
                {index + 1}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-600">من {totalSlides}</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleThumbnails}
          className={cn(
            'p-2 rounded-lg transition-colors',
            showThumbnails ? 'bg-primary text-white' : 'hover:bg-gray-200'
          )}
          title="عرض المصغرات"
        >
          <Grid className="w-5 h-5" />
        </button>

        <button
          onClick={handleFullscreen}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          title="ملء الشاشة"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}