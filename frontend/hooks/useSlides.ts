// frontend/hooks/useSlides.ts
// Hook for managing slides state and operations

import { useState, useEffect, useCallback } from 'react'
import slidesService, { Slide } from '@/services/slides.service'

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

      const fetchedSlides = await slidesService.getLessonSlides(lessonId, theme)
      console.log('Fetched slides:', fetchedSlides)

      if (fetchedSlides.length === 0) {
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
        setSlides(fetchedSlides)

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
  }, [lessonId, theme, preloadNext])

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