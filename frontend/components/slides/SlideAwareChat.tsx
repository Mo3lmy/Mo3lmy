// frontend/components/slides/SlideAwareChat.tsx
// Chat component that is aware of current slide context

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  MessageCircle,
  X,
  Sparkles,
  HelpCircle,
  Lightbulb,
  BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Slide } from '@/services/slides.service'

interface SlideAwareChatProps {
  currentSlide: Slide | null
  currentSlideIndex: number
  lessonId: string
  lessonTitle?: string
  onGenerateSlide?: (topic: string, context: any) => void
  className?: string
}

interface Message {
  id: string
  text: string
  sender: 'user' | 'assistant'
  timestamp: Date
  slideContext?: {
    slideIndex: number
    slideTitle?: string
  }
  suggestions?: string[]
}

export const SlideAwareChat: React.FC<SlideAwareChatProps> = ({
  currentSlide,
  currentSlideIndex,
  lessonId,
  lessonTitle,
  onGenerateSlide,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Get context-aware suggestions
  const getContextSuggestions = (): string[] => {
    if (!currentSlide) return ['ما هذا الدرس؟', 'أعطني مثالاً']

    const suggestions = []

    switch (currentSlide.content.type) {
      case 'quiz':
        suggestions.push('ساعدني في الإجابة', 'اشرح السؤال')
        break
      case 'equation':
        suggestions.push('كيف أحل هذه المعادلة؟', 'أعطني خطوات الحل')
        break
      case 'bullet':
        suggestions.push('اشرح النقطة الأولى', 'أعطني مثالاً')
        break
      default:
        suggestions.push('اشرح أكثر', 'أعطني مثالاً', 'لماذا هذا مهم؟')
    }

    if (onGenerateSlide) {
      suggestions.push('أنشئ شريحة تفاعلية')
    }

    return suggestions
  }

  // Send message
  const sendMessage = async (text: string) => {
    if (!text.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
      slideContext: currentSlide ? {
        slideIndex: currentSlideIndex,
        slideTitle: currentSlide.content.title
      } : undefined
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsTyping(true)

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: generateContextualResponse(text, currentSlide),
        sender: 'assistant',
        timestamp: new Date(),
        suggestions: Math.random() > 0.5 ? getContextSuggestions() : undefined
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsTyping(false)
    }, 1000 + Math.random() * 1000)
  }

  // Generate contextual response (placeholder - replace with AI)
  const generateContextualResponse = (question: string, slide: Slide | null): string => {
    if (!slide) {
      return 'مرحباً! أنا هنا لمساعدتك في فهم الدرس. كيف يمكنني مساعدتك؟'
    }

    // Context-aware responses based on slide type
    if (question.includes('مثال') || question.includes('example')) {
      if (slide.content.type === 'equation') {
        return 'مثال: إذا كان x + 3 = 7، فإن x = 7 - 3 = 4. جرب حل معادلة مشابهة!'
      }
      return `مثال على ${slide.content.title || 'هذا الموضوع'}: تخيل أن لديك 5 تفاحات وأعطيت 2 لصديقك...`
    }

    if (question.includes('شرح') || question.includes('explain')) {
      return `${slide.content.title} هو مفهوم مهم في ${lessonTitle}. دعني أوضح لك بطريقة بسيطة...`
    }

    if (question.includes('شريحة') && onGenerateSlide) {
      onGenerateSlide(slide.content.title || 'موضوع جديد', {
        slideType: slide.content.type,
        content: slide.content
      })
      return 'سأقوم بإنشاء شريحة تفاعلية جديدة لك...'
    }

    return 'هذا سؤال رائع! دعني أساعدك في فهم هذا الموضوع بشكل أفضل...'
  }

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion)
  }

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 left-6 p-4 bg-primary text-white rounded-full shadow-lg hover:shadow-xl transition-all z-40',
          'hover:scale-110',
          isOpen && 'hidden',
          className
        )}
      >
        <MessageCircle className="w-6 h-6" />
        {currentSlide && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary to-primary-dark text-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold">مساعد الدرس الذكي</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slide context indicator */}
            {currentSlide && (
              <div className="px-4 py-2 bg-blue-50 border-b">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <BookOpen className="w-4 h-4" />
                  <span>الشريحة الحالية: {currentSlide.content.title || `شريحة ${currentSlideIndex + 1}`}</span>
                </div>
              </div>
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">
                    مرحباً! أنا هنا لمساعدتك في فهم الدرس
                  </p>
                  <div className="mt-4 space-y-2">
                    {getContextSuggestions().slice(0, 2).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="block w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.sender === 'user' ? 'justify-start' : 'justify-end'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2',
                      message.sender === 'user'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-primary text-white'
                    )}
                  >
                    {message.slideContext && (
                      <div className="text-xs opacity-70 mb-1">
                        📍 {message.slideContext.slideTitle}
                      </div>
                    )}
                    <p className="text-sm">{message.text}</p>
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Suggestions after assistant message */}
              {messages.length > 0 &&
                messages[messages.length - 1].sender === 'assistant' &&
                messages[messages.length - 1].suggestions && (
                  <div className="flex flex-wrap gap-2">
                    {messages[messages.length - 1].suggestions!.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full text-sm transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

              {isTyping && (
                <div className="flex justify-end">
                  <div className="bg-gray-100 rounded-2xl px-4 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick actions */}
            <div className="p-2 border-t flex gap-2">
              <button
                onClick={() => sendMessage('أحتاج مساعدة')}
                className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm flex items-center justify-center gap-1 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                مساعدة
              </button>
              <button
                onClick={() => sendMessage('أعطني تلميحاً')}
                className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm flex items-center justify-center gap-1 transition-colors"
              >
                <Lightbulb className="w-4 h-4" />
                تلميح
              </button>
              {onGenerateSlide && (
                <button
                  onClick={() => sendMessage('أنشئ شريحة تفاعلية')}
                  className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm flex items-center justify-center gap-1 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  شريحة جديدة
                </button>
              )}
            </div>

            {/* Input area */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage(inputText)}
                  placeholder="اكتب سؤالك هنا..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-primary"
                  disabled={isTyping}
                />
                <button
                  onClick={() => sendMessage(inputText)}
                  disabled={!inputText.trim() || isTyping}
                  className={cn(
                    'p-2 rounded-full transition-all',
                    inputText.trim() && !isTyping
                      ? 'bg-primary text-white hover:bg-primary-dark'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}