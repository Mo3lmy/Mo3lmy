'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Minus, Maximize2, Volume2, VolumeX } from 'lucide-react'
import { AssistantPanel } from '@/components/classroom/AssistantPanel'
import { cn } from '@/lib/utils'

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [hasNotification, setHasNotification] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load saved state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('floatingChatState')
    if (savedState) {
      const { isOpen: savedOpen, soundEnabled: savedSound } = JSON.parse(savedState)
      setIsOpen(savedOpen)
      setSoundEnabled(savedSound ?? true)
    }
  }, [])

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('floatingChatState', JSON.stringify({ isOpen, soundEnabled }))
  }, [isOpen, soundEnabled])

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        // Don't close if clicking on the floating button itself
        const button = document.getElementById('floating-chat-button')
        if (button && button.contains(event.target as Node)) return

        setIsOpen(false)
      }
    }

    if (isOpen && !isMinimized) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, isMinimized])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Play notification sound
  const playNotificationSound = () => {
    if (soundEnabled && !isOpen) {
      // Create audio element if not exists
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBRuBzvLZijYGHmm98OScTgwOUqzn4a1aGAY7k9ryzHkpBSuDz/LVgjQHHGq+8FilORMLVK3m5KNRDwhao+fyvmgjBRyBzvDYhzYGHGu+8OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHmm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTg0OUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOU6zl5KNRFApGn+DyvmwhBRuBzvLZijYGHGm98OScTgwOUqzl5KNRFApGn+Dz')
      }
      audioRef.current.play().catch(() => {})
    }
  }

  // Handle new message notification
  const handleNewMessage = () => {
    if (!isOpen) {
      setHasNotification(true)
      setUnreadCount(prev => prev + 1)
      playNotificationSound()
    }
  }

  // Clear notification when opening
  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setHasNotification(false)
      setUnreadCount(0)
      setIsMinimized(false)
    }
  }

  return (
    <>
      {/* Floating Button */}
      <motion.button
        id="floating-chat-button"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleToggle}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "w-14 h-14 rounded-full",
          "bg-gradient-to-br from-primary-500 to-secondary-500",
          "hover:from-primary-600 hover:to-secondary-600",
          "shadow-lg hover:shadow-xl",
          "flex items-center justify-center",
          "transition-all duration-300",
          "group"
        )}
        aria-label="فتح المساعد الذكي"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-6 h-6 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageCircle className="w-6 h-6 text-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification Badge with Count */}
        <AnimatePresence>
          {unreadCount > 0 && !isOpen && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Hover Tooltip */}
        <motion.span
          initial={{ opacity: 0, x: 10 }}
          whileHover={{ opacity: 1, x: 0 }}
          className="absolute right-full mr-3 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap pointer-events-none"
        >
          المساعد الذكي
        </motion.span>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* Chat Panel Container */}
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className={cn(
                "fixed z-50",
                "bottom-24 right-6",
                "w-[90vw] sm:w-[400px]",
                "h-[70vh] sm:h-[600px]",
                "max-h-[600px]",
                "bg-gray-900/95 backdrop-blur-xl",
                "rounded-2xl",
                "shadow-2xl",
                "border border-white/10",
                "overflow-hidden",
                "flex flex-col"
              )}
            >
              {/* Custom Header */}
              <div className="p-4 border-b border-white/10 bg-gradient-to-r from-primary-500/10 to-secondary-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium text-white">المساعد متصل</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Sound Toggle */}
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                      title={soundEnabled ? 'كتم الصوت' : 'تفعيل الصوت'}
                    >
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-gray-400" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-gray-400" />
                      )}
                    </button>

                    {/* Minimize Button */}
                    <button
                      onClick={() => setIsMinimized(!isMinimized)}
                      className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                      title={isMinimized ? 'تكبير' : 'تصغير'}
                    >
                      {isMinimized ? (
                        <Maximize2 className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Minus className="w-4 h-4 text-gray-400" />
                      )}
                    </button>

                    {/* Close Button */}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                      title="إغلاق"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Assistant Panel */}
              <AnimatePresence>
                {!isMinimized && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex-1 overflow-hidden"
                  >
                    <AssistantPanel
                      lessonId=""
                      lessonTitle="محادثة عامة"
                      subject="مساعد ذكي"
                      grade={0}
                      onClose={() => setIsOpen(false)}
                      onNewMessage={handleNewMessage}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Pulse Animation for Attention */}
      {!isOpen && (
        <motion.div
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full pointer-events-none z-40"
          animate={{
            boxShadow: [
              "0 0 0 0 rgba(var(--primary-500), 0.4)",
              "0 0 0 20px rgba(var(--primary-500), 0)",
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
          }}
        />
      )}
    </>
  )
}