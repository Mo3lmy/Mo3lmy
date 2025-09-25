'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Send, MessageCircle, BookOpen, FileText, HelpCircle,
  ChevronUp, Sparkles, Mic, Paperclip, Image as ImageIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
}

interface AssistantPanelProps {
  lessonId: string
  onClose: () => void
}

export function AssistantPanel({ lessonId, onClose }: AssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'qa' | 'notes' | 'resources'>('chat')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: 'مرحباً! كيف يمكنني مساعدتك في هذا الدرس؟',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'دعني أساعدك في فهم هذا المفهوم بشكل أفضل. هل يمكنك توضيح ما الجزء الذي تجد صعوبة فيه؟',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiMessage])
      setIsTyping(false)
    }, 1500)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
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
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ChevronUp className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-bold text-white">المساعد الذكي</h2>
            <Sparkles className="w-4 h-4 text-primary-400" />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
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
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl p-3',
                        message.type === 'ai'
                          ? 'glass rounded-tl-none'
                          : 'bg-primary-500/20 border border-primary-500/30 rounded-tr-none'
                      )}
                    >
                      <p className="text-sm text-white leading-relaxed">
                        {message.content}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {message.timestamp.toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
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
                              className="w-2 h-2 rounded-full bg-gray-400"
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-white/10 p-4">
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

                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className={cn(
                      'p-2 rounded-lg transition-all',
                      inputValue.trim()
                        ? 'bg-primary-500 hover:bg-primary-600 text-white'
                        : 'bg-white/5 text-gray-500 cursor-not-allowed'
                    )}
                  >
                    <Send className="w-5 h-5" />
                  </button>
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