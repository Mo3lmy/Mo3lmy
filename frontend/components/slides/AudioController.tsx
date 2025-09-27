// frontend/components/slides/AudioController.tsx
// Audio playback controls with visualization

'use client'

import React, { useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AudioControllerProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlayPause: () => void
  onSeek: (time: number) => void
  onVolumeChange: (volume: number) => void
  onSpeedChange: (speed: number) => void
  className?: string
}

export const AudioController: React.FC<AudioControllerProps> = ({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onSpeedChange,
  className
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null)
  const [showVolumeSlider, setShowVolumeSlider] = React.useState(false)
  const [volume, setVolume] = React.useState(0.8)
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1.0)

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current && duration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const clickedTime = (x / rect.width) * duration
      onSeek(clickedTime)
    }
  }

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    onVolumeChange(newVolume)
  }

  // Handle speed change
  const handleSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed)
    onSpeedChange(newSpeed)
  }

  // Skip forward/backward
  const skip = (seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
    onSeek(newTime)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={cn('audio-controller bg-white px-4 py-3', className)}>
      <div className="flex items-center gap-4">
        {/* Play/Pause button */}
        <button
          onClick={onPlayPause}
          className="p-2 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>

        {/* Skip backward */}
        <button
          onClick={() => skip(-10)}
          className="p-1 rounded hover:bg-gray-100"
          title="رجوع 10 ثواني"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-xs">10</span>
        </button>

        {/* Time display */}
        <div className="text-sm text-gray-600 min-w-[100px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Progress bar */}
        <div
          ref={progressBarRef}
          className="flex-1 h-2 bg-gray-200 rounded-full cursor-pointer relative group"
          onClick={handleProgressClick}
        >
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 8px)` }}
          />
        </div>

        {/* Skip forward */}
        <button
          onClick={() => skip(10)}
          className="p-1 rounded hover:bg-gray-100"
          title="تقديم 10 ثواني"
        >
          <RotateCcw className="w-4 h-4 scale-x-[-1]" />
          <span className="text-xs">10</span>
        </button>

        {/* Speed control */}
        <div className="relative">
          <select
            value={playbackSpeed}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>

        {/* Volume control */}
        <div className="relative">
          <button
            onClick={() => setShowVolumeSlider(!showVolumeSlider)}
            className="p-1 rounded hover:bg-gray-100"
          >
            {volume === 0 ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>

          {/* Volume slider */}
          {showVolumeSlider && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-white rounded-lg shadow-lg">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="h-24 writing-mode-vertical"
                style={{ writingMode: 'vertical-lr' }}
              />
              <div className="text-xs text-center mt-1">
                {Math.round(volume * 100)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Waveform visualization (placeholder) */}
      <div className="mt-2 h-8 bg-gray-50 rounded flex items-center justify-center">
        <div className="flex items-end gap-1 h-full py-1">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-1 bg-gray-300 transition-all',
                i < (progress / 100) * 50 ? 'bg-primary' : ''
              )}
              style={{
                height: `${20 + Math.random() * 60}%`,
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}