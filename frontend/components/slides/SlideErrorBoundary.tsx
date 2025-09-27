// frontend/components/slides/SlideErrorBoundary.tsx
// Error boundary component for handling slide rendering errors

'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { motion } from 'framer-motion'

interface SlideErrorBoundaryProps {
  children: ReactNode
  fallbackMessage?: string
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface SlideErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

// Fallback component when error occurs
const FallbackSlide: React.FC<{
  error?: Error | null
  resetError?: () => void
  message?: string
}> = ({ error, resetError, message }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-8"
  >
    <div className="text-center max-w-md">
      {/* Error Icon */}
      <div className="text-6xl mb-4">⚠️</div>

      {/* Error Title */}
      <h2 className="text-2xl font-bold text-red-600 mb-3">
        {message || 'حدث خطأ في عرض الشريحة'}
      </h2>

      {/* Error Details (in development) */}
      {process.env.NODE_ENV === 'development' && error && (
        <div className="bg-white p-4 rounded-lg text-right mb-4 border border-red-200">
          <p className="text-sm text-gray-600 mb-2">
            <strong>الخطأ:</strong> {error.message}
          </p>
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">
              تفاصيل تقنية
            </summary>
            <pre className="mt-2 overflow-auto text-left bg-gray-50 p-2 rounded">
              {error.stack}
            </pre>
          </details>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        {resetError && (
          <button
            onClick={resetError}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            حاول مرة أخرى
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          إعادة تحميل الصفحة
        </button>
      </div>

      {/* Help Text */}
      <p className="text-sm text-gray-500 mt-4">
        إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني
      </p>
    </div>
  </motion.div>
)

export class SlideErrorBoundary extends Component<
  SlideErrorBoundaryProps,
  SlideErrorBoundaryState
> {
  constructor(props: SlideErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): SlideErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('SlideErrorBoundary caught an error:', error, errorInfo)
    }

    // Update state with error info
    this.setState({
      errorInfo
    })

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error reporting service (e.g., Sentry)
      console.error('Slide rendering error:', {
        error: error.toString(),
        componentStack: errorInfo.componentStack
      })
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <FallbackSlide
          error={this.state.error}
          resetError={this.resetError}
          message={this.props.fallbackMessage}
        />
      )
    }

    return this.props.children
  }
}

// Hook for using error boundary in functional components
export const useSlideErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const captureError = React.useCallback((error: Error) => {
    setError(error)
    if (process.env.NODE_ENV === 'development') {
      console.error('Slide error captured:', error)
    }
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return {
    error,
    resetError,
    captureError
  }
}