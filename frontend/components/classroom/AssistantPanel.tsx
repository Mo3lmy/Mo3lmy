'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Send, MessageCircle, BookOpen, FileText, HelpCircle,
  ChevronUp, Sparkles, Mic, Paperclip, Image as ImageIcon,
  Trash2, Download, ZoomIn, ZoomOut, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import apiService from '@/services/api'
import socketService from '@/services/socket'

interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
}

interface AssistantPanelProps {
  lessonId?: string
  onClose: () => void
  lessonTitle?: string
  subject?: string
  grade?: number
  currentSlideIndex?: number
  currentTopic?: string
  onNewMessage?: () => void
}

export function AssistantPanel({ lessonId, onClose, lessonTitle, subject, grade, currentSlideIndex, currentTopic, onNewMessage }: AssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'qa' | 'notes' | 'resources'>('chat')
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: lessonId && lessonTitle
        ? `مرحباً! أنا هنا لمساعدتك في درس "${lessonTitle}" من مادة ${subject || 'الرياضيات'}. كيف يمكنني مساعدتك؟`
        : 'مرحباً! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟ يمكنني المساعدة في الدروس، الواجبات، أو أي استفسارات تعليمية.',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [suggestions, setSuggestions] = useState([
    'اشرح لي الدرس',
    'أعطني مثال',
    'اختبرني',
    'ما هي النقاط المهمة؟'
  ])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Update suggestions when slide context changes
  useEffect(() => {
    if (lessonId && (currentSlideIndex !== undefined || currentTopic)) {
      loadSmartSuggestions()
    }
  }, [lessonId, currentSlideIndex, currentTopic])

  const loadSmartSuggestions = async () => {
    try {
      setLoadingSuggestions(true)
      const params = new URLSearchParams()
      if (lessonId) params.append('lessonId', lessonId)
      if (currentSlideIndex !== undefined) params.append('slideIndex', currentSlideIndex.toString())
      if (currentTopic) params.append('currentTopic', currentTopic)

      const response = await apiService.getChatSuggestions(params.toString())
      if (response?.data && Array.isArray(response.data)) {
        setSuggestions(response.data)
      }
    } catch (error) {
      console.error('Failed to load smart suggestions:', error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  useEffect(() => {
    // Connect to WebSocket
    const token = localStorage.getItem('auth-token') ||
                 JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token

    if (token) {
      socketService.connect(token)

      // Join lesson room
      if (lessonId) {
        socketService.joinLesson(lessonId)
      }

      // Listen for AI responses
      socketService.on('ai_response', (data: any) => {
        setIsTyping(false)
        const aiMessage: Message = {
          id: Date.now().toString(),
          type: 'ai',
          content: data.message,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage])
        onNewMessage?.()
      })

      // Listen for typing indicator
      socketService.on('typing_indicator', (data: any) => {
        setIsTyping(data.isTyping)
      })
    }

    return () => {
      if (lessonId) {
        socketService.leaveLesson(lessonId)
      }
      socketService.off('ai_response')
      socketService.off('typing_indicator')
    }
  }, [lessonId])

  const handleSend = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    // جرب WebSocket أولاً
    if (socketService.isConnected()) {
      socketService.sendChatMessage(inputValue, lessonId || undefined)
      // الرد سيأتي من خلال event listener في useEffect
    } else {
      // Fallback to HTTP
      try {
        const context = lessonId ? {
          lessonId,
          lessonTitle,
          subject,
          grade,
          language: 'ar'
        } : {
          language: 'ar',
          type: 'general'
        }

        const response = await apiService.sendChatMessage(
          inputValue,
          sessionId,
          context
        )

        // تعامل مع الرد
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: response?.data?.response || response?.data?.message || 'عذراً، حدث خطأ',
          timestamp: new Date()
        }

        setMessages(prev => [...prev, aiMessage])
        setIsTyping(false)
        onNewMessage?.()
      } catch (error) {
        console.error('Chat error:', error)
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: 'عذراً، حدث خطأ في الإرسال. حاول مرة أخرى.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        setIsTyping(false)
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Clear chat function
  const clearChat = () => {
    setMessages([{
      id: '1',
      type: 'ai',
      content: lessonId && lessonTitle
        ? `مرحباً! أنا هنا لمساعدتك في درس "${lessonTitle}" من مادة ${subject || 'الرياضيات'}. كيف يمكنني مساعدتك؟`
        : 'مرحباً! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟ يمكنني المساعدة في الدروس، الواجبات، أو أي استفسارات تعليمية.',
      timestamp: new Date()
    }])
  }

  // Export chat as text
  const exportChat = () => {
    const chatText = messages.map(msg =>
      `[${msg.timestamp.toLocaleTimeString('ar-SA')}] ${msg.type === 'ai' ? 'المساعد' : 'أنت'}: ${msg.content}`
    ).join('\n\n')

    const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat_${new Date().toISOString()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Get font size class
  const getFontSizeClass = () => {
    switch(fontSize) {
      case 'small': return 'text-xs'
      case 'large': return 'text-base'
      default: return 'text-sm'
    }
  }

  const tabs = [
    { id: 'chat', label: 'محادثة', icon: MessageCircle },
    { id: 'qa', label: 'أسئلة وأجوبة', icon: HelpCircle },
    { id: 'notes', label: 'ملاحظات', icon: FileText },
    { id: 'resources', label: 'مصادر', icon: BookOpen }
  ]

  return (
    <div className="glass-dark rounded-t-3xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="p-2 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500"
            >
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h2 className="text-lg font-bold text-white">المساعد الذكي</h2>
              {lessonTitle && (
                <p className="text-xs text-gray-400">{lessonTitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Font Size Controls */}
            <button
              onClick={() => setFontSize('small')}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                fontSize === 'small' ? 'bg-white/20' : 'hover:bg-white/10'
              )}
              title="خط صغير"
            >
              <ZoomOut className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={() => setFontSize('large')}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                fontSize === 'large' ? 'bg-white/20' : 'hover:bg-white/10'
              )}
              title="خط كبير"
            >
              <ZoomIn className="w-4 h-4 text-gray-400" />
            </button>

            {/* Clear Chat */}
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="مسح المحادثة"
            >
              <Trash2 className="w-4 h-4 text-gray-400" />
            </button>

            {/* Export Chat */}
            <button
              onClick={exportChat}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="تصدير المحادثة"
            >
              <Download className="w-4 h-4 text-gray-400" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-all hover:rotate-90"
              title="إغلاق"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'chat' | 'qa' | 'notes' | 'resources')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                activeTab === tab.id
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'hover:bg-white/10 text-gray-400'
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'flex gap-3',
                      message.type === 'user' ? 'flex-row-reverse' : ''
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                        message.type === 'ai'
                          ? 'bg-gradient-to-br from-primary-400 to-secondary-500'
                          : 'bg-gradient-to-br from-success to-emerald-500'
                      )}
                    >
                      {message.type === 'ai' ? (
                        <Sparkles className="w-4 h-4 text-white" />
                      ) : (
                        <span className="text-xs text-white font-bold">أنت</span>
                      )}
                    </div>

                    {/* Message bubble */}
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      className={cn(
                        'max-w-[70%] rounded-2xl p-3 shadow-lg',
                        message.type === 'ai'
                          ? 'glass rounded-tl-none backdrop-blur-md'
                          : 'bg-primary-500/20 border border-primary-500/30 rounded-tr-none backdrop-blur-sm'
                      )}
                    >
                      <p className={cn(
                        "text-white leading-relaxed whitespace-pre-wrap",
                        getFontSizeClass()
                      )}>
                        {message.content}
                      </p>
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        {message.timestamp.toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {message.type === 'user' && (
                          <Check className="w-3 h-3 text-primary-400" />
                        )}
                      </p>
                    </motion.div>
                  </motion.div>
                ))}

                {/* Typing indicator */}
                <AnimatePresence>
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="glass rounded-2xl rounded-tl-none p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[...Array(3)].map((_, i) => (
                              <motion.div
                                key={i}
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{
                                  duration: 1,
                                  repeat: Infinity,
                                  delay: i * 0.2
                                }}
                                className="w-2 h-2 rounded-full bg-primary-400"
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-300">المساعد يكتب...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-white/10 p-4">
                {/* Smart Suggestions */}
                <div className="mb-3">
                  {/* Context info */}
                  {(currentSlideIndex !== undefined || currentTopic) && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                      {currentSlideIndex !== undefined && (
                        <span>شريحة {currentSlideIndex + 1}</span>
                      )}
                      {currentTopic && (
                        <span className="bg-primary-500/20 px-2 py-1 rounded-full">
                          {currentTopic}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Suggestions */}
                  <div className="flex flex-wrap gap-2">
                    {loadingSuggestions ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <div className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                        جاري تحديث الاقتراحات...
                      </div>
                    ) : (
                      suggestions.map((suggestion, index) => (
                        <motion.button
                          key={`${suggestion}-${index}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          onClick={() => {
                            setInputValue(suggestion)
                            inputRef.current?.focus()
                          }}
                          className="px-3 py-1.5 text-sm bg-primary-500/20 hover:bg-primary-500/30
                                   text-primary-300 border border-primary-500/30 rounded-full
                                   transition-all hover:scale-105"
                        >
                          {suggestion}
                        </motion.button>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <Paperclip className="w-5 h-5 text-gray-400" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  </button>

                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="اكتب سؤالك هنا..."
                      className="w-full px-4 py-2 pr-12 bg-white/10 border border-white/20 rounded-xl
                               text-white placeholder-gray-400 resize-none focus:outline-none
                               focus:border-primary-500/50 transition-colors"
                      rows={1}
                      style={{ minHeight: '40px', maxHeight: '120px' }}
                    />

                    <button className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10 transition-colors">
                      <Mic className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isTyping}
                    className={cn(
                      'p-2 rounded-lg transition-all shadow-lg',
                      inputValue.trim() && !isTyping
                        ? 'bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white'
                        : 'bg-white/5 text-gray-500 cursor-not-allowed'
                    )}
                  >
                    <Send className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'qa' && (
            <motion.div
              key="qa"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <div className="space-y-4">
                {[
                  'ما هو الفرق بين البسط والمقام؟',
                  'كيف أحول الكسر العادي إلى كسر عشري؟',
                  'متى نستخدم الضرب التبادلي؟'
                ].map((question, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass rounded-xl p-4 cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-primary-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-white font-medium mb-2">{question}</p>
                        <p className="text-sm text-gray-400 line-clamp-2">
                          اضغط لرؤية الإجابة الكاملة مع أمثلة توضيحية...
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'notes' && (
            <motion.div
              key="notes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <div className="glass rounded-xl p-4 min-h-[200px]">
                <textarea
                  placeholder="اكتب ملاحظاتك هنا..."
                  className="w-full h-full bg-transparent text-white placeholder-gray-400
                           resize-none focus:outline-none"
                  rows={10}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'resources' && (
            <motion.div
              key="resources"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <div className="space-y-3">
                {[
                  { title: 'ورقة عمل الكسور', type: 'PDF', size: '2.4 MB' },
                  { title: 'فيديو شرح إضافي', type: 'Video', size: '15 MB' },
                  { title: 'تمارين تفاعلية', type: 'Interactive', size: 'Online' }
                ].map((resource, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass rounded-xl p-3 flex items-center justify-between
                             hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-primary-400" />
                      <div>
                        <p className="text-white text-sm font-medium">{resource.title}</p>
                        <p className="text-xs text-gray-400">
                          {resource.type} • {resource.size}
                        </p>
                      </div>
                    </div>
                    <ChevronUp className="w-4 h-4 text-gray-400 -rotate-90" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}