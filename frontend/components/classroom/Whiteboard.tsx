'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface WhiteboardProps {
  tool: 'pen' | 'eraser' | null
  onClear: () => void
  className?: string
}

export const Whiteboard = forwardRef<HTMLCanvasElement, WhiteboardProps>(
  ({ tool, onClear, className }, ref) => {
    const [isDrawing, setIsDrawing] = useState(false)
    const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 })
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const contextRef = useRef<CanvasRenderingContext2D | null>(null)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = canvas.offsetWidth * 2
      canvas.height = canvas.offsetHeight * 2
      canvas.style.width = `${canvas.offsetWidth}px`
      canvas.style.height = `${canvas.offsetHeight}px`

      const context = canvas.getContext('2d')
      if (!context) return

      context.scale(2, 2)
      context.lineCap = 'round'
      context.lineJoin = 'round'
      contextRef.current = context

      // Set ref for parent component
      if (ref && typeof ref !== 'function') {
        ref.current = canvas
      }
    }, [ref])

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!tool || !contextRef.current) return

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setIsDrawing(true)
      setLastPosition({ x, y })

      contextRef.current.beginPath()
      contextRef.current.moveTo(x, y)

      if (tool === 'pen') {
        contextRef.current.globalCompositeOperation = 'source-over'
        contextRef.current.strokeStyle = '#4F46E5'
        contextRef.current.lineWidth = 2
      } else if (tool === 'eraser') {
        contextRef.current.globalCompositeOperation = 'destination-out'
        contextRef.current.lineWidth = 20
      }
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !tool || !contextRef.current) return

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      contextRef.current.lineTo(x, y)
      contextRef.current.stroke()
      contextRef.current.beginPath()
      contextRef.current.moveTo(x, y)

      setLastPosition({ x, y })
    }

    const stopDrawing = () => {
      if (!contextRef.current) return
      contextRef.current.closePath()
      setIsDrawing(false)
    }

    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!tool || !contextRef.current) return
      e.preventDefault()

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const touch = e.touches[0]
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top

      setIsDrawing(true)
      setLastPosition({ x, y })

      contextRef.current.beginPath()
      contextRef.current.moveTo(x, y)

      if (tool === 'pen') {
        contextRef.current.globalCompositeOperation = 'source-over'
        contextRef.current.strokeStyle = '#4F46E5'
        contextRef.current.lineWidth = 2
      } else if (tool === 'eraser') {
        contextRef.current.globalCompositeOperation = 'destination-out'
        contextRef.current.lineWidth = 20
      }
    }

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !tool || !contextRef.current) return
      e.preventDefault()

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const touch = e.touches[0]
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top

      contextRef.current.lineTo(x, y)
      contextRef.current.stroke()
      contextRef.current.beginPath()
      contextRef.current.moveTo(x, y)

      setLastPosition({ x, y })
    }

    const handleTouchEnd = () => {
      if (!contextRef.current) return
      contextRef.current.closePath()
      setIsDrawing(false)
    }

    return (
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${
            tool ? 'cursor-crosshair' : 'pointer-events-none'
          } ${className}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Drawing indicator */}
        {isDrawing && tool && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute pointer-events-none"
            style={{
              left: lastPosition.x - 10,
              top: lastPosition.y - 10,
              width: 20,
              height: 20,
            }}
          >
            <div
              className={`w-full h-full rounded-full ${
                tool === 'pen'
                  ? 'bg-primary-500/30 border-2 border-primary-500'
                  : 'bg-white/30 border-2 border-white border-dashed'
              }`}
            />
          </motion.div>
        )}

        {/* Math equations overlay (example) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="text-4xl font-bold text-white/20"
          >
            3/4 + 1/4 = ?
          </motion.div>
        </div>
      </div>
    )
  }
)

Whiteboard.displayName = 'Whiteboard'