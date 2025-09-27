// frontend/hooks/useAudioSync.ts
// Hook for managing audio synchronization with slides

import { useState, useEffect, useRef, useCallback } from 'react'
import { Slide } from '@/services/slides.service'

interface AudioSyncState {
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  volume: number
  currentWord: { word: string; start: number; end: number } | null
  highlightedElement: string | null
}

interface UseAudioSyncOptions {
  autoPlay?: boolean
  defaultVolume?: number
  defaultRate?: number
  onSlideEnd?: () => void
  onWordHighlight?: (word: { word: string; start: number; end: number }) => void
}

export function useAudioSync(
  slides: Slide[],
  currentSlideIndex: number = 0,
  options: UseAudioSyncOptions = {}
) {
  const {
    autoPlay = false,
    defaultVolume = 0.8,
    defaultRate = 1.0,
    onSlideEnd,
    onWordHighlight
  } = options

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const [state, setState] = useState<AudioSyncState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: defaultRate,
    volume: defaultVolume,
    currentWord: null,
    highlightedElement: null
  })

  const currentSlide = slides[currentSlideIndex] || null

  // Create or update audio element
  useEffect(() => {
    if (!currentSlide?.audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      return
    }

    // Create new audio element
    const audio = new Audio(currentSlide.audioUrl)
    audio.volume = state.volume
    audio.playbackRate = state.playbackRate

    // Setup event listeners
    audio.addEventListener('loadedmetadata', () => {
      setState(prev => ({ ...prev, duration: audio.duration }))
    })

    audio.addEventListener('ended', () => {
      setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }))
      onSlideEnd?.()
    })

    audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e)
      setState(prev => ({ ...prev, isPlaying: false }))
    })

    audioRef.current = audio

    // Auto-play if enabled
    if (autoPlay) {
      audio.play().catch(console.error)
      setState(prev => ({ ...prev, isPlaying: true }))
    }

    // Cleanup
    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [currentSlide?.audioUrl])

  // Update audio properties
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.volume
      audioRef.current.playbackRate = state.playbackRate
    }
  }, [state.volume, state.playbackRate])

  // Time update loop for synchronization
  useEffect(() => {
    if (!state.isPlaying || !audioRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }

    const updateTime = () => {
      if (!audioRef.current) return

      const currentTime = audioRef.current.currentTime
      setState(prev => ({ ...prev, currentTime }))

      // Update word highlight
      if (currentSlide?.syncTimestamps?.words) {
        const currentWord = currentSlide.syncTimestamps.words.find(
          w => currentTime >= w.start && currentTime <= w.end
        )

        if (currentWord) {
          setState(prev => {
            if (prev.currentWord?.word !== currentWord.word) {
              onWordHighlight?.(currentWord)
              return { ...prev, currentWord }
            }
            return prev
          })
        } else {
          setState(prev => {
            if (prev.currentWord) {
              return { ...prev, currentWord: null }
            }
            return prev
          })
        }
      }

      // Update element highlight
      if (currentSlide?.syncTimestamps?.highlights) {
        const highlight = currentSlide.syncTimestamps.highlights.find(
          h => currentTime >= h.start && currentTime <= h.end
        )

        setState(prev => {
          const newHighlight = highlight?.elementId || null
          if (prev.highlightedElement !== newHighlight) {
            return { ...prev, highlightedElement: newHighlight }
          }
          return prev
        })
      }

      animationFrameRef.current = requestAnimationFrame(updateTime)
    }

    updateTime()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [state.isPlaying, currentSlide, onWordHighlight])

  // Control functions
  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => setState(prev => ({ ...prev, isPlaying: true })))
        .catch(console.error)
    }
  }, [])

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setState(prev => ({ ...prev, isPlaying: false }))
    }
  }, [])

  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause()
    } else {
      play()
    }
  }, [state.isPlaying, play, pause])

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, state.duration))
      setState(prev => ({ ...prev, currentTime: time }))
    }
  }, [state.duration])

  const skipForward = useCallback((seconds: number = 10) => {
    seek(state.currentTime + seconds)
  }, [state.currentTime, seek])

  const skipBackward = useCallback((seconds: number = 10) => {
    seek(state.currentTime - seconds)
  }, [state.currentTime, seek])

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    setState(prev => ({ ...prev, volume: clampedVolume }))
  }, [])

  const setPlaybackRate = useCallback((rate: number) => {
    const clampedRate = Math.max(0.25, Math.min(2, rate))
    setState(prev => ({ ...prev, playbackRate: clampedRate }))
  }, [])

  const restart = useCallback(() => {
    seek(0)
    play()
  }, [seek, play])

  return {
    // Audio element ref
    audioPlayer: audioRef.current,

    // State
    ...state,
    hasAudio: !!currentSlide?.audioUrl,
    syncData: currentSlide?.syncTimestamps || null,

    // Control functions
    play,
    pause,
    togglePlayPause,
    seek,
    skipForward,
    skipBackward,
    setVolume,
    setPlaybackRate,
    restart,

    // Computed values
    progress: state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0,
    formattedCurrentTime: formatTime(state.currentTime),
    formattedDuration: formatTime(state.duration)
  }
}

// Helper function to format time
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}