// frontend/services/slides.service.ts
// Service for managing slides and communication with backend

import apiService from './api'

export interface SlideContent {
  type: 'title' | 'content' | 'bullet' | 'image' | 'equation' | 'quiz' | 'summary' | 'interactive' | 'video' | 'code' | 'tips' | 'story' | 'example'
  title?: string
  subtitle?: string
  content?: string
  bullets?: string[]
  imageUrl?: string
  equation?: string
  quiz?: {
    question: string
    options: string[]
    correctIndex?: number
    explanation?: string
    hints?: string[]
  }
  interactive?: {
    type: 'drag-drop' | 'fill-blank' | 'match' | 'draw'
    data: any
  }
  video?: {
    url: string
    poster?: string
    autoplay?: boolean
  }
  code?: {
    language: string
    code: string
    runnable?: boolean
  }
  metadata?: {
    duration?: number
    animations?: string[]
    theme?: string
    emotionalTone?: 'encouraging' | 'challenging' | 'fun' | 'serious'
    adaptiveDifficulty?: boolean
    voiceScript?: string
    teachingNotes?: string
  }
  syncTimestamps?: {
    start: number
    end: number
    words?: Array<{
      word: string
      start: number
      end: number
    }>
    highlights?: Array<{
      elementId: string
      start: number
      end: number
    }>
  }
  personalization?: {
    ageGroup: 'primary' | 'preparatory' | 'secondary'
    gender: 'male' | 'female' | 'neutral'
    learningStyle?: 'visual' | 'auditory' | 'kinesthetic'
    difficultyLevel?: 'easy' | 'medium' | 'hard'
  }
}

export interface Slide {
  id: string
  lessonId?: string
  html: string
  content: SlideContent
  theme: string
  order: number
  audioUrl?: string
  duration?: number
  script?: string
  syncTimestamps?: SlideContent['syncTimestamps']
}

export interface GenerateSingleSlideParams {
  topic: string
  context?: any
  type?: 'explanation' | 'example' | 'quiz'
}

interface SlideGenerationJob {
  jobId: string
  lessonId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  totalSlides: number
  message?: string
}

class SlidesService {
  private baseUrl = '/api/v1/lessons'

  /**
   * Get all slides for a lesson (with queue support)
   */
  async getLessonSlides(lessonId: string, theme?: string): Promise<Slide[] | SlideGenerationJob> {
    try {
      const params = new URLSearchParams()
      if (theme) params.append('theme', theme)
      params.append('generateVoice', 'true')
      params.append('generateTeaching', 'true')

      const queryString = params.toString()

      // لا ترسل sessionId في headers
      const response = await apiService.get(
        `${this.baseUrl}/${lessonId}/slides${queryString ? '?' + queryString : ''}`
      )

      if (response.success && response.data) {
        // Check if response is a job (async generation)
        if (response.data.jobId) {
          return response.data as SlideGenerationJob
        }

        // Transform backend slides to frontend format
        const slides = response.data.slides || []
        return slides.map((slide: any, index: number) => ({
          id: `slide-${lessonId}-${index}`,
          lessonId: lessonId,
          order: slide.number - 1, // Convert 1-based to 0-based index
          html: slide.html || '',
          content: {
            type: slide.type || 'content',
            title: slide.title,
            subtitle: slide.subtitle,
            content: slide.content,
            bullets: slide.bullets,
            imageUrl: slide.imageUrl,
            equation: slide.equation,
            quiz: slide.quiz,
            interactive: slide.interactive,
            video: slide.video,
            code: slide.code
          },
          theme: theme || 'default',
          audioUrl: slide.audioUrl,
          duration: slide.duration || 10,
          script: slide.teachingScript?.script,
          syncTimestamps: slide.syncTimestamps
        }))
      }
      return []
    } catch (error) {
      console.error('Error fetching slides:', error)
      return []
    }
  }

  /**
   * Generate a single slide dynamically
   */
  async generateSingleSlide(
    lessonId: string,
    params: GenerateSingleSlideParams
  ): Promise<{
    slide: Slide
    audioUrl?: string
    script?: string
    syncTimestamps?: any
  }> {
    try {
      const response = await apiService.post(
        `${this.baseUrl}/${lessonId}/slides/generate-single`,
        params
      )

      if (response.success && response.data) {
        return {
          slide: response.data.slide,
          audioUrl: response.data.audioUrl,
          script: response.data.script,
          syncTimestamps: response.data.syncTimestamps
        }
      }

      throw new Error('Failed to generate slide')
    } catch (error) {
      console.error('Error generating slide:', error)
      throw error
    }
  }

  /**
   * Get teaching script for a slide
   */
  async getTeachingScript(lessonId: string, slideId: string): Promise<{
    script: string
    duration: number
    audioUrl?: string
  }> {
    try {
      const response = await apiService.post(
        `${this.baseUrl}/${lessonId}/teaching/script`,
        { slideId }
      )

      if (response.success && response.data) {
        return response.data
      }

      throw new Error('Failed to get teaching script')
    } catch (error) {
      console.error('Error getting teaching script:', error)
      throw error
    }
  }

  /**
   * Track slide view
   */
  async trackSlideView(lessonId: string, slideId: string, duration: number): Promise<void> {
    try {
      await apiService.post(
        `${this.baseUrl}/${lessonId}/slides/${slideId}/track`,
        { duration, completed: duration > 5 }
      )
    } catch (error) {
      console.error('Error tracking slide view:', error)
    }
  }

  /**
   * Submit quiz answer for a slide
   */
  async submitQuizAnswer(
    lessonId: string,
    slideId: string,
    answer: number
  ): Promise<{
    correct: boolean
    explanation?: string
    points?: number
  }> {
    try {
      const response = await apiService.post(
        `${this.baseUrl}/${lessonId}/slides/${slideId}/answer`,
        { answer }
      )

      if (response.success && response.data) {
        return response.data
      }

      throw new Error('Failed to submit answer')
    } catch (error) {
      console.error('Error submitting answer:', error)
      throw error
    }
  }

  /**
   * Get user's theme based on their profile
   */
  getUserTheme(grade: number, gender?: string): string {
    const ageGroup = grade <= 6 ? 'primary' :
                     grade <= 9 ? 'preparatory' :
                     'secondary'

    const userGender = gender || 'male'
    return `${ageGroup}-${userGender}`
  }

  /**
   * Parse slide HTML for rendering
   */
  parseSlideHTML(html: string): {
    content: string
    styles: string
    scripts?: string
  } {
    // Extract inline styles if needed
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi)
    const styles = styleMatch ? styleMatch.join('') : ''

    // Extract scripts if any
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi)
    const scripts = scriptMatch ? scriptMatch.join('') : ''

    // Remove style and script tags from content
    let content = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')

    return { content, styles, scripts }
  }

  /**
   * Check slide generation job status
   */
  async checkJobStatus(lessonId: string, jobId: string): Promise<{
    status: string
    progress?: number
    slides?: Slide[]
    error?: string
  }> {
    try {
      const response = await apiService.get(
        `/api/v1/lessons/slides/job/${jobId}`
      )

      if (response.success && response.data) {
        if (response.data.status === 'completed' && response.data.slides) {
          const slides = response.data.slides.map((slide: any, index: number) => {
            // تحديد نوع الشريحة بذكاء
            let slideType = slide.type || 'content';
            if (slide.number === 1 && slide.title && !slide.content) {
              slideType = 'title';
            } else if (slide.bullets && slide.bullets.length > 0) {
              slideType = 'bullet';
            }

            return {
              id: `slide-${lessonId}-${index}`,
              lessonId,
              order: index,
              html: slide.html || '',
              content: {
                type: slideType,
                title: slide.title,
                subtitle: slide.subtitle,
                content: slide.content,  // النص المباشر
                bullets: slide.bullets,
                imageUrl: slide.imageUrl,
                equation: slide.equation,
                quiz: slide.quiz
              },
              theme: 'default',
              audioUrl: slide.audioUrl || '',
              duration: slide.duration || 10,
              script: slide.script || slide.teachingScript?.script || ''
            }
          });

          return { status: 'completed', slides };
        }

        return response.data;
      }

      throw new Error('Failed to check job status');
    } catch (error) {
      console.error('Error checking job status:', error);
      return { status: 'processing', progress: 0 };
    }
  }

  /**
   * Cancel slide generation job
   */
  async cancelJob(lessonId: string, jobId: string): Promise<boolean> {
    try {
      const response = await apiService.post(
        `${this.baseUrl}/${lessonId}/slides/cancel/${jobId}`,
        {}
      )

      return response.success
    } catch (error: any) {
      // If job is already completed or not found, that's okay
      if (error.message?.includes('not found') || error.message?.includes('already completed')) {
        console.log(`Job ${jobId} already completed or not found (this is normal)`)
        return true // Consider it successful since job is done
      }

      console.error('Error cancelling job:', error.message)
      return false
    }
  }

  /**
   * Preload slides for better performance
   */
  async preloadSlides(lessonId: string, slideIds: string[]): Promise<void> {
    try {
      const promises = slideIds.map(id =>
        this.getTeachingScript(lessonId, id).catch(() => null)
      )
      await Promise.all(promises)
    } catch (error) {
      console.error('Error preloading slides:', error)
    }
  }
}

export default new SlidesService()