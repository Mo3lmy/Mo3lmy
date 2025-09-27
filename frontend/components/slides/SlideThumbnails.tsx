// frontend/components/slides/SlideThumbnails.tsx
// Thumbnail view for slide navigation

'use client'

import React, { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Slide } from '@/services/slides.service'

interface SlideThumbnailsProps {
  slides: Slide[]
  currentIndex: number
  onSelect: (index: number) => void
  className?: string
}

export const SlideThumbnails: React.FC<SlideThumbnailsProps> = ({
  slides,
  currentIndex,
  onSelect,
  className
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Scroll to current thumbnail when it changes
  useEffect(() => {
    const currentThumbnail = thumbnailRefs.current[currentIndex]
    const container = scrollContainerRef.current

    if (currentThumbnail && container) {
      const thumbnailLeft = currentThumbnail.offsetLeft
      const thumbnailWidth = currentThumbnail.offsetWidth
      const containerWidth = container.offsetWidth
      const containerScrollLeft = container.scrollLeft

      // Check if thumbnail is out of view
      if (
        thumbnailLeft < containerScrollLeft ||
        thumbnailLeft + thumbnailWidth > containerScrollLeft + containerWidth
      ) {
        // Scroll to center the thumbnail
        container.scrollTo({
          left: thumbnailLeft - containerWidth / 2 + thumbnailWidth / 2,
          behavior: 'smooth'
        })
      }
    }
  }, [currentIndex])

  // Get thumbnail content based on slide type
  const getThumbnailContent = (slide: Slide) => {
    const { content } = slide

    switch (content.type) {
      case 'title':
        return (
          <div className="text-center p-2">
            <div className="text-xs font-bold truncate">{content.title || 'عنوان'}</div>
            {content.subtitle && (
              <div className="text-xs opacity-70 truncate">{content.subtitle}</div>
            )}
          </div>
        )

      case 'content':
        return (
          <div className="p-2">
            <div className="text-xs font-bold truncate mb-1">{content.title || 'محتوى'}</div>
            <div className="text-xs opacity-70 line-clamp-2">
              {content.content?.substring(0, 50)}...
            </div>
          </div>
        )

      case 'bullet':
        return (
          <div className="p-2">
            <div className="text-xs font-bold truncate mb-1">{content.title || 'نقاط'}</div>
            <div className="text-xs space-y-1">
              {content.bullets?.slice(0, 2).map((bullet, i) => (
                <div key={i} className="truncate opacity-70">• {bullet}</div>
              ))}
            </div>
          </div>
        )

      case 'quiz':
        return (
          <div className="p-2 text-center">
            <div className="text-xs font-bold">اختبار</div>
            <div className="text-xs opacity-70 truncate mt-1">
              {content.quiz?.question || 'سؤال'}
            </div>
          </div>
        )

      case 'image':
        return (
          <div className="p-2 text-center">
            <div className="text-xs font-bold">صورة</div>
            <div className="text-xs opacity-70">{content.title || 'عرض صورة'}</div>
          </div>
        )

      case 'equation':
        return (
          <div className="p-2 text-center">
            <div className="text-xs font-bold">معادلة</div>
            <div className="text-xs font-mono opacity-70 truncate">
              {content.equation || 'معادلة رياضية'}
            </div>
          </div>
        )

      case 'video':
        return (
          <div className="p-2 text-center">
            <div className="text-xs font-bold">فيديو</div>
            <div className="text-xs opacity-70">محتوى مرئي</div>
          </div>
        )

      case 'code':
        return (
          <div className="p-2 text-center">
            <div className="text-xs font-bold">كود</div>
            <div className="text-xs opacity-70">{content.code?.language || 'برمجة'}</div>
          </div>
        )

      case 'summary':
        return (
          <div className="p-2 text-center">
            <div className="text-xs font-bold">ملخص</div>
            <div className="text-xs opacity-70">{content.title || 'نهاية الدرس'}</div>
          </div>
        )

      case 'interactive':
        return (
          <div className="p-2 text-center">
            <div className="text-xs font-bold">تفاعلي</div>
            <div className="text-xs opacity-70">
              {content.interactive?.type || 'نشاط'}
            </div>
          </div>
        )

      default:
        return (
          <div className="p-2 text-center">
            <div className="text-xs">شريحة {slide.order || ''}</div>
          </div>
        )
    }
  }

  // Get theme-based background color for thumbnail
  const getThumbnailBg = (slide: Slide) => {
    const theme = slide.theme || 'default'

    if (theme.includes('primary')) {
      return 'bg-gradient-to-br from-blue-100 to-green-100'
    } else if (theme.includes('preparatory')) {
      return 'bg-gradient-to-br from-blue-50 to-purple-50'
    } else if (theme.includes('secondary')) {
      return 'bg-gradient-to-br from-gray-100 to-gray-200'
    }

    return 'bg-gradient-to-br from-gray-50 to-gray-100'
  }

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        'slide-thumbnails flex gap-3 p-3 overflow-x-auto',
        className
      )}
    >
      {slides.map((slide, index) => (
        <motion.button
          key={index}
          ref={el => {thumbnailRefs.current[index] = el}}
          onClick={() => onSelect(index)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden transition-all relative',
            getThumbnailBg(slide),
            currentIndex === index
              ? 'ring-2 ring-primary ring-offset-2 shadow-lg'
              : 'shadow-sm hover:shadow-md'
          )}
        >
          {/* Slide number badge */}
          <div className={cn(
            'absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
            currentIndex === index
              ? 'bg-primary text-white'
              : 'bg-gray-600 text-white'
          )}>
            {index + 1}
          </div>

          {/* Thumbnail content */}
          <div className="w-full h-full flex items-center justify-center">
            {getThumbnailContent(slide)}
          </div>

          {/* Audio indicator */}
          {slide.audioUrl && (
            <div className="absolute bottom-1 right-1">
              <div className="w-4 h-4 bg-primary/80 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">🔊</span>
              </div>
            </div>
          )}

          {/* Interactive indicator */}
          {slide.content.type === 'interactive' && (
            <div className="absolute top-1 right-1">
              <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✏️</span>
              </div>
            </div>
          )}

          {/* Quiz indicator */}
          {slide.content.type === 'quiz' && (
            <div className="absolute top-1 right-1">
              <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">?</span>
              </div>
            </div>
          )}
        </motion.button>
      ))}
    </div>
  )
}