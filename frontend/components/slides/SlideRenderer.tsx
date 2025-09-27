// frontend/components/slides/SlideRenderer.tsx
// Renders slides based on their type

'use client'

import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Slide } from '@/services/slides.service'
import { MathInteractive } from './MathInteractive'

interface SlideRendererProps {
  slide: Slide
  theme: string
  currentWord?: { word: string; start: number; end: number } | null
  highlightedElement?: string | null
  onInteraction?: (type: string, data: any) => void
  className?: string
}

// Empty Slide component for fallback
const EmptySlide: React.FC<{ message: string }> = ({ message }) => (
  <div className="h-full flex items-center justify-center bg-gray-50">
    <div className="text-center p-8">
      <div className="text-6xl mb-4">📝</div>
      <p className="text-xl text-gray-600">{message}</p>
    </div>
  </div>
)

export const SlideRenderer: React.FC<SlideRendererProps> = ({
  slide,
  theme,
  currentWord,
  highlightedElement,
  onInteraction,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Check if slide and content exist
  if (!slide || !slide.content) {
    return <EmptySlide message="لا توجد بيانات للعرض" />
  }

  // Render slide based on type
  const renderSlideContent = () => {
    const { content } = slide

    switch (content.type) {
      case 'title':
        return (
          <TitleSlide
            title={content.title}
            subtitle={content.subtitle}
            theme={theme}
          />
        )

      case 'content':
        return (
          <ContentSlide
            title={content.title}
            content={content.content}
            theme={theme}
            currentWord={currentWord}
          />
        )

      case 'bullet':
        return (
          <BulletSlide
            title={content.title}
            bullets={content.bullets || []}
            theme={theme}
          />
        )

      case 'quiz':
        return (
          <QuizSlide
            quiz={content.quiz}
            theme={theme}
            onAnswer={(answer) => onInteraction?.('quiz-answer', { answer })}
          />
        )

      case 'equation':
        return (
          <EquationSlide
            title={content.title}
            equation={content.equation}
            theme={theme}
          />
        )

      case 'interactive':
        return (
          <InteractiveSlide
            interactive={content.interactive}
            theme={theme}
            onInteraction={onInteraction}
          />
        )

      case 'image':
        return (
          <ImageSlide
            title={content.title}
            imageUrl={content.imageUrl}
            theme={theme}
          />
        )

      case 'video':
        return (
          <VideoSlide
            video={content.video}
            theme={theme}
          />
        )

      case 'code':
        return (
          <CodeSlide
            code={content.code}
            theme={theme}
          />
        )

      case 'summary':
        return (
          <SummarySlide
            title={content.title}
            content={content.content}
            bullets={content.bullets}
            theme={theme}
          />
        )

      default:
        // Render raw HTML for backward compatibility
        return <HTMLSlide html={slide.html} theme={theme} />
    }
  }

  // Apply highlight effects
  useEffect(() => {
    if (highlightedElement && containerRef.current) {
      const element = containerRef.current.querySelector(`[data-element-id="${highlightedElement}"]`)
      if (element) {
        element.classList.add('highlighted')
        return () => element.classList.remove('highlighted')
      }
    }
  }, [highlightedElement])

  return (
    <div
      ref={containerRef}
      className={cn(
        'slide-renderer w-full h-full overflow-auto',
        `theme-${theme}`,
        className
      )}
    >
      {renderSlideContent()}
    </div>
  )
}

// Individual slide type components

const TitleSlide: React.FC<{ title?: string; subtitle?: string; theme: string }> = ({
  title,
  subtitle,
  theme
}) => (
  <motion.div
    initial={{ scale: 0.9, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    className="h-full flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-primary to-primary-dark text-white"
  >
    {title && (
      <h1 className="text-6xl font-bold mb-4 animate-fade-in">{title}</h1>
    )}
    {subtitle && (
      <h2 className="text-2xl opacity-90 animate-slide-up">{subtitle}</h2>
    )}
  </motion.div>
)

const ContentSlide: React.FC<{
  title?: string
  content?: string
  theme: string
  currentWord?: { word: string; start: number; end: number } | null
}> = ({ title, content, theme, currentWord }) => (
  <div className="h-full p-8 bg-white">
    {title && (
      <h2 className="text-4xl font-bold mb-6 text-primary border-b-4 border-primary pb-2">
        {title}
      </h2>
    )}
    {content && (
      <div className="text-xl leading-relaxed text-gray-800">
        {currentWord ? highlightText(content, currentWord.word) : content}
      </div>
    )}
  </div>
)

const BulletSlide: React.FC<{
  title?: string
  bullets: string[]
  theme: string
}> = ({ title, bullets, theme }) => (
  <div className="h-full p-8 bg-white">
    {title && (
      <h2 className="text-4xl font-bold mb-6 text-primary border-b-4 border-primary pb-2">
        {title}
      </h2>
    )}
    <ul className="space-y-4">
      {bullets.map((bullet, index) => (
        <motion.li
          key={index}
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: index * 0.1 }}
          className="flex items-start text-lg"
        >
          <span className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center mt-1 ml-3">
            {index + 1}
          </span>
          <span>{bullet}</span>
        </motion.li>
      ))}
    </ul>
  </div>
)

const QuizSlide: React.FC<{
  quiz?: any
  theme: string
  onAnswer: (answer: number) => void
}> = ({ quiz, theme, onAnswer }) => {
  const [selected, setSelected] = React.useState<number | null>(null)
  const [submitted, setSubmitted] = React.useState(false)

  if (!quiz) return null

  const handleSubmit = () => {
    if (selected !== null) {
      setSubmitted(true)
      onAnswer(selected)
    }
  }

  return (
    <div className="h-full p-8 bg-white">
      <h2 className="text-3xl font-bold mb-6 text-primary">{quiz.question}</h2>
      <div className="space-y-3">
        {quiz.options?.map((option: string, index: number) => (
          <button
            key={index}
            onClick={() => !submitted && setSelected(index)}
            disabled={submitted}
            className={cn(
              'w-full p-4 text-right rounded-lg border-2 transition-all',
              selected === index
                ? submitted
                  ? quiz.correctIndex === index
                    ? 'bg-green-100 border-green-500'
                    : 'bg-red-100 border-red-500'
                  : 'bg-blue-50 border-blue-500'
                : 'bg-gray-50 border-gray-300 hover:bg-gray-100',
              submitted && 'cursor-not-allowed'
            )}
          >
            <span className="inline-block ml-3 font-bold">{String.fromCharCode(65 + index)}.</span>
            {option}
            {submitted && quiz.correctIndex === index && (
              <span className="mr-2 text-green-600">✓</span>
            )}
          </button>
        ))}
      </div>
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={selected === null}
          className={cn(
            'mt-6 px-6 py-3 rounded-lg font-bold transition-all',
            selected !== null
              ? 'bg-primary text-white hover:bg-primary-dark'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          )}
        >
          تأكيد الإجابة
        </button>
      )}
      {submitted && quiz.explanation && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-blue-800">{quiz.explanation}</p>
        </div>
      )}
    </div>
  )
}

const EquationSlide: React.FC<{
  title?: string
  equation?: string
  theme: string
}> = ({ title, equation, theme }) => (
  <div className="h-full p-8 bg-white flex flex-col items-center justify-center">
    {title && (
      <h2 className="text-3xl font-bold mb-8 text-primary">{title}</h2>
    )}
    {equation && (
      <div className="text-4xl font-mono bg-gray-100 p-8 rounded-lg">
        {equation}
      </div>
    )}
  </div>
)

const ImageSlide: React.FC<{
  title?: string
  imageUrl?: string
  theme: string
}> = ({ title, imageUrl, theme }) => (
  <div className="h-full p-8 bg-white">
    {title && (
      <h2 className="text-3xl font-bold mb-6 text-primary">{title}</h2>
    )}
    {imageUrl && (
      <div className="flex items-center justify-center h-full">
        <img src={imageUrl} alt={title || 'Slide image'} className="max-w-full max-h-full object-contain" />
      </div>
    )}
  </div>
)

const VideoSlide: React.FC<{
  video?: any
  theme: string
}> = ({ video, theme }) => {
  if (!video) return null

  return (
    <div className="h-full flex items-center justify-center bg-black">
      <video
        src={video.url}
        poster={video.poster}
        controls
        autoPlay={video.autoplay}
        className="max-w-full max-h-full"
      />
    </div>
  )
}

const CodeSlide: React.FC<{
  code?: any
  theme: string
}> = ({ code, theme }) => {
  if (!code) return null

  return (
    <div className="h-full p-8 bg-gray-900 text-white">
      <pre className="overflow-auto">
        <code className={`language-${code.language}`}>
          {code.code}
        </code>
      </pre>
    </div>
  )
}

const SummarySlide: React.FC<{
  title?: string
  content?: string
  bullets?: string[]
  theme: string
}> = ({ title, content, bullets, theme }) => (
  <div className="h-full p-8 bg-gradient-to-br from-gray-50 to-gray-100">
    {title && (
      <h2 className="text-4xl font-bold mb-6 text-primary text-center">
        {title}
      </h2>
    )}
    {content && (
      <p className="text-xl text-center mb-6 text-gray-700">{content}</p>
    )}
    {bullets && bullets.length > 0 && (
      <div className="max-w-2xl mx-auto">
        <ul className="space-y-3">
          {bullets.map((bullet, index) => (
            <li key={index} className="flex items-center text-lg">
              <span className="text-primary ml-3">✓</span>
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
)

const InteractiveSlide: React.FC<{
  interactive?: any
  theme: string
  onInteraction?: (type: string, data: any) => void
}> = ({ interactive, theme, onInteraction }) => {
  if (!interactive) return null

  // Render based on interactive type
  switch (interactive.type) {
    case 'math-equation':
      return (
        <div className="h-full p-8 flex items-center justify-center">
          <MathInteractive
            equation={interactive.data.equation || 'x + 5 = 10'}
            answer={interactive.data.answer || 5}
            steps={interactive.data.steps}
            hints={interactive.data.hints}
            difficulty={interactive.data.difficulty}
            onComplete={(data) => onInteraction?.('math-complete', data)}
          />
        </div>
      )
    case 'drag-drop':
      return <div className="h-full p-8">Drag and Drop Interactive</div>
    case 'fill-blank':
      return <div className="h-full p-8">Fill in the Blank Interactive</div>
    case 'match':
      return <div className="h-full p-8">Match Interactive</div>
    case 'draw':
      return <div className="h-full p-8">Drawing Interactive</div>
    default:
      return <div className="h-full p-8">Interactive Content</div>
  }
}

const HTMLSlide: React.FC<{ html: string; theme: string }> = ({ html, theme }) => (
  <div
    className="h-full"
    dangerouslySetInnerHTML={{ __html: html }}
  />
)

// Helper function to highlight current word
function highlightText(text: string, word: string): React.ReactNode {
  if (!word) return text

  const parts = text.split(new RegExp(`(${word})`, 'gi'))
  return parts.map((part, index) =>
    part.toLowerCase() === word.toLowerCase() ? (
      <mark key={index} className="bg-yellow-300 px-1 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  )
}