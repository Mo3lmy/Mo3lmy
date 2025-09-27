// frontend/hooks/useSlides.ts
// Hook for managing slides state and operations

import { useState, useEffect, useCallback, useRef } from 'react'
import slidesService, { Slide } from '@/services/slides.service'
import { useWebSocket } from '@/hooks/useWebSocket'

interface UseSlidesOptions {
  autoLoad?: boolean
  preloadNext?: number
}

interface UserProfile {
  grade: number
  gender?: string
  theme?: string
}

export function useSlides(
  lessonId: string,
  userProfile: UserProfile,
  options: UseSlidesOptions = {}
) {
  const { autoLoad = true, preloadNext = 2 } = options

  const [slides, setSlides] = useState<Slide[]>([])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [generationProgress, setGenerationProgress] = useState(0)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { socket, connected } = useWebSocket()

  // Determine user theme
  const theme = userProfile.theme || slidesService.getUserTheme(
    userProfile.grade,
    userProfile.gender
  )

  // Load slides from backend
  const loadSlides = useCallback(async () => {
    if (!lessonId) return

    try {
      setLoading(true)
      setError(null)

      const result = await slidesService.getLessonSlides(lessonId, theme)
      console.log('Slides request result:', result)

      // Check if result is a job (async generation)
      if ('jobId' in result) {
        console.log('🚀 Slide generation job started:', result.jobId)
        setJobId(result.jobId)
        setGenerationProgress(0)

        // Start polling for job status or listen to WebSocket
        if (socket && connected) {
          // Use WebSocket for real-time updates
          setupWebSocketListeners(result.jobId)
        } else {
          // Fallback to polling
          startPollingJobStatus(result.jobId)
        }
        return
      }

      // Direct slides result
      const fetchedSlides = result as Slide[]

      // تحقق من وجود الشرائح
      if (fetchedSlides.length === 0) {
        console.warn('No slides received from backend')

        // Create a default welcome slide if no slides exist
        const defaultSlide: Slide = {
          id: 'default-1',
          lessonId,
          order: 0,
          content: {
            type: 'title',
            title: 'مرحباً في الدرس',
            subtitle: 'جاري تحضير المحتوى...'
          },
          theme: theme,
          html: '<div class="text-center p-8"><h1>مرحباً في الدرس</h1><p>جاري تحضير المحتوى...</p></div>',
          duration: 5
        }
        setSlides([defaultSlide])

        // Try to generate a real slide in the background
        try {
          const generatedSlide = await slidesService.generateSingleSlide(lessonId, {
            topic: 'مقدمة الدرس',
            type: 'explanation'
          })
          if (generatedSlide && generatedSlide.slide) {
            setSlides([generatedSlide.slide])
          }
        } catch (genError) {
          console.warn('Could not generate slide:', genError)
        }
      } else {
        // تحقق من وجود audioUrl لكل شريحة
        const slidesWithAudio = fetchedSlides.map((slide, index) => {
          if (!slide.audioUrl) {
            console.warn(`Slide ${slide.id || index} has no audio`)
          }
          console.log(`Slide ${index}:`, {
            hasContent: !!slide.content,
            hasBullets: !!(slide.content?.bullets),
            hasAudio: !!slide.audioUrl,
            contentType: slide.content?.type
          })
          return slide
        })

        setSlides(slidesWithAudio)

        // Preload next slides
        if (preloadNext > 0 && fetchedSlides.length > 1) {
          const slideIdsToPreload = fetchedSlides
            .slice(1, preloadNext + 1)
            .map(s => s.id)
          slidesService.preloadSlides(lessonId, slideIdsToPreload)
        }
      }
    } catch (err) {
      console.error('Error loading slides:', err)
      setError('فشل تحميل الشرائح')
    } finally {
      setLoading(false)
    }
  }, [lessonId, theme, preloadNext, socket, connected])

  // Setup WebSocket listeners for slide generation
  const setupWebSocketListeners = useCallback((jobId: string) => {
    if (!socket) return

    // Progress updates
    socket.on('slide_generation_progress', (data: any) => {
      if (data.jobId === jobId) {
        console.log('📊 Generation progress:', data.progress)
        setGenerationProgress(data.progress?.progress || 0)

        // Add completed slides progressively
        if (data.progress?.processedSlides) {
          const processedSlides = data.progress.processedSlides.map((slide: any, index: number) => ({
            id: `slide-${lessonId}-${index}`,
            lessonId,
            order: index,
            html: slide.html || '',
            content: { type: 'content', title: `شريحة ${index + 1}` },
            theme,
            audioUrl: slide.audioUrl,
            duration: slide.duration || 10,
            script: slide.script
          }))
          setSlides(processedSlides)
        }
      }
    })

    // Generation complete
    socket.on('slide_generation_complete', (data: any) => {
      if (data.jobId === jobId) {
        console.log('✅ Generation complete!')
        setGenerationProgress(100)
        setLoading(false)
        setJobId(null)

        // Fetch final slides
        checkJobStatus(jobId)
      }
    })

    // Generation error
    socket.on('slide_generation_error', (data: any) => {
      if (data.jobId === jobId) {
        console.error('❌ Generation error:', data.error)
        setError(data.error || 'فشل توليد الشرائح')
        setLoading(false)
        setJobId(null)
      }
    })

    return () => {
      socket.off('slide_generation_progress')
      socket.off('slide_generation_complete')
      socket.off('slide_generation_error')
    }
  }, [socket, lessonId, theme])

  // Poll job status (fallback when WebSocket not available)
  const startPollingJobStatus = useCallback((jobId: string) => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
    }

    checkIntervalRef.current = setInterval(async () => {
      await checkJobStatus(jobId)
    }, 2000) // Check every 2 seconds
  }, [lessonId])

  // Check job status
  const checkJobStatus = useCallback(async (jobId: string) => {
    try {
      const status = await slidesService.checkJobStatus(lessonId, jobId)

      if (status.status === 'completed' && status.slides) {
        console.log('✅ Slides loaded from job:', status.slides.length)
        setSlides(status.slides)
        setGenerationProgress(100)
        setLoading(false)
        setJobId(null)

        // Stop polling
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current)
          checkIntervalRef.current = null
        }

        // Preload next slides
        if (preloadNext > 0 && status.slides.length > 1) {
          const slideIdsToPreload = status.slides
            .slice(1, preloadNext + 1)
            .map(s => s.id)
          slidesService.preloadSlides(lessonId, slideIdsToPreload)
        }
      } else if (status.status === 'failed') {
        setError('فشل توليد الشرائح')
        setLoading(false)
        setJobId(null)

        // Stop polling
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current)
          checkIntervalRef.current = null
        }
      } else if (status.progress) {
        setGenerationProgress(status.progress)
      }
    } catch (error) {
      console.error('Error checking job status:', error)
    }
  }, [lessonId, preloadNext])

  // Generate a new slide dynamically
  const generateSlide = useCallback(async (
    topic: string,
    context?: any,
    type?: 'explanation' | 'example' | 'quiz'
  ) => {
    try {
      const result = await slidesService.generateSingleSlide(lessonId, {
        topic,
        context,
        type
      })

      // Add the new slide to the list
      setSlides(prev => [...prev, result.slide])

      return result
    } catch (err) {
      console.error('Error generating slide:', err)
      throw err
    }
  }, [lessonId])

  // Navigation functions
  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      const previousIndex = currentSlideIndex
      setCurrentSlideIndex(index)

      // Track view of previous slide
      if (previousIndex !== index && slides[previousIndex]) {
        const viewDuration = Date.now() / 1000 // Simple duration tracking
        slidesService.trackSlideView(lessonId, slides[previousIndex].id, viewDuration)
      }

      // Preload upcoming slides
      if (preloadNext > 0) {
        const slideIdsToPreload = slides
          .slice(index + 1, index + preloadNext + 1)
          .map(s => s.id)
        if (slideIdsToPreload.length > 0) {
          slidesService.preloadSlides(lessonId, slideIdsToPreload)
        }
      }
    }
  }, [currentSlideIndex, slides, lessonId, preloadNext])

  const nextSlide = useCallback(() => {
    goToSlide(currentSlideIndex + 1)
  }, [currentSlideIndex, goToSlide])

  const previousSlide = useCallback(() => {
    goToSlide(currentSlideIndex - 1)
  }, [currentSlideIndex, goToSlide])

  // Submit quiz answer
  const submitAnswer = useCallback(async (answer: number) => {
    const currentSlide = slides[currentSlideIndex]
    if (!currentSlide || currentSlide.content.type !== 'quiz') {
      throw new Error('Current slide is not a quiz')
    }

    try {
      const result = await slidesService.submitQuizAnswer(
        lessonId,
        currentSlide.id,
        answer
      )

      // Update slide with result
      setSlides(prev => prev.map((slide, index) => {
        if (index === currentSlideIndex && slide.content.quiz) {
          return {
            ...slide,
            content: {
              ...slide.content,
              quiz: {
                ...slide.content.quiz,
                correctIndex: result.correct ? answer : slide.content.quiz.correctIndex,
                explanation: result.explanation || slide.content.quiz.explanation
              }
            }
          }
        }
        return slide
      }))

      return result
    } catch (err) {
      console.error('Error submitting answer:', err)
      throw err
    }
  }, [currentSlideIndex, slides, lessonId])

  // Auto-load slides on mount
  useEffect(() => {
    if (autoLoad) {
      loadSlides()
    }
  }, [autoLoad, loadSlides])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear polling interval
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }

      // Cancel job if still running
      if (jobId) {
        slidesService.cancelJob(lessonId, jobId)
      }
    }
  }, [jobId, lessonId])

  // Track view when unmounting
  useEffect(() => {
    return () => {
      if (slides[currentSlideIndex]) {
        const viewDuration = Date.now() / 1000
        slidesService.trackSlideView(lessonId, slides[currentSlideIndex].id, viewDuration)
      }
    }
  }, [])

  return {
    // State
    slides,
    currentSlide: slides[currentSlideIndex] || null,
    currentSlideIndex,
    totalSlides: slides.length,
    loading,
    error,
    theme,
    jobId,
    generationProgress,

    // Actions
    loadSlides,
    generateSlide,
    goToSlide,
    nextSlide,
    previousSlide,
    submitAnswer,

    // Computed
    hasNext: currentSlideIndex < slides.length - 1,
    hasPrevious: currentSlideIndex > 0,
    progress: slides.length > 0 ? ((currentSlideIndex + 1) / slides.length) * 100 : 0
  }
}