// frontend/components/slides/SlideLoadingSkeleton.tsx
// Loading skeleton component for slides

'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SlideLoadingSkeletonProps {
  className?: string
  theme?: string
}

export const SlideLoadingSkeleton: React.FC<SlideLoadingSkeletonProps> = ({
  className,
  theme
}) => {
  const shimmerClass = 'relative overflow-hidden bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-size-200 animate-shimmer'

  return (
    <div className={cn('slide-loading-skeleton h-full', className)}>
      {/* Progress bar skeleton */}
      <div className="h-1 bg-gray-200" />

      {/* Main slide area skeleton */}
      <div className="flex-1 flex flex-col p-8">
        {/* Title skeleton */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={cn('h-12 w-3/4 mb-6 rounded-lg', shimmerClass)}
        />

        {/* Content skeleton lines */}
        <div className="space-y-4">
          {[0.2, 0.3, 0.4, 0.5].map((delay, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay }}
              className={cn(
                'h-6 rounded-lg',
                shimmerClass,
                index === 1 ? 'w-full' : index === 2 ? 'w-5/6' : 'w-4/5'
              )}
            />
          ))}
        </div>

        {/* Interactive element skeleton */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-auto pt-8"
        >
          <div className={cn('h-12 w-32 rounded-lg mx-auto', shimmerClass)} />
        </motion.div>
      </div>

      {/* Controls skeleton */}
      <div className="h-16 border-t border-gray-200 flex items-center justify-between px-6">
        <div className="flex gap-2">
          <div className={cn('h-10 w-10 rounded-full', shimmerClass)} />
          <div className={cn('h-10 w-10 rounded-full', shimmerClass)} />
        </div>

        <div className={cn('h-2 w-48 rounded-full', shimmerClass)} />

        <div className="flex gap-2">
          <div className={cn('h-10 w-10 rounded-full', shimmerClass)} />
        </div>
      </div>

      {/* Thumbnails skeleton */}
      <div className="h-24 border-t border-gray-200 flex items-center gap-3 px-3 overflow-hidden">
        {[0, 1, 2, 3, 4].map((index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 + index * 0.1 }}
            className={cn('flex-shrink-0 w-32 h-20 rounded-lg', shimmerClass)}
          />
        ))}
      </div>
    </div>
  )
}

// Individual component loading skeletons
export const TitleSlideLoading: React.FC = () => (
  <div className="h-full flex flex-col items-center justify-center p-8">
    <div className={cn('h-16 w-3/4 mb-4 rounded-lg',
      'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-size-200 animate-shimmer'
    )} />
    <div className={cn('h-8 w-1/2 rounded-lg',
      'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-size-200 animate-shimmer'
    )} />
  </div>
)

export const ContentSlideLoading: React.FC = () => (
  <div className="h-full p-8">
    <div className={cn('h-12 w-2/3 mb-6 rounded-lg',
      'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-size-200 animate-shimmer'
    )} />
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className={cn('h-6 rounded-lg',
            'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-size-200 animate-shimmer',
            i === 2 ? 'w-full' : i === 3 ? 'w-5/6' : 'w-4/5'
          )}
        />
      ))}
    </div>
  </div>
)

export const QuizSlideLoading: React.FC = () => (
  <div className="h-full p-8">
    <div className={cn('h-10 w-3/4 mb-6 rounded-lg',
      'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-size-200 animate-shimmer'
    )} />
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className={cn('h-14 w-full rounded-lg',
            'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-size-200 animate-shimmer'
          )}
        />
      ))}
    </div>
    <div className={cn('h-12 w-32 mt-6 rounded-lg',
      'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-size-200 animate-shimmer'
    )} />
  </div>
)