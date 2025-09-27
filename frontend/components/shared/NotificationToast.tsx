"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  AlertCircle,
  Info,
  Trophy,
  Heart,
  Sparkles,
  X
} from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'achievement' | 'motivation' | 'support';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationToastProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

export default function NotificationToast({
  notifications,
  onDismiss,
  position = 'top-right',
  className = ''
}: NotificationToastProps) {
  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'achievement':
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 'motivation':
        return <Heart className="h-5 w-5 text-pink-500" />;
      case 'support':
        return <Sparkles className="h-5 w-5 text-purple-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getBackgroundColor = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'bg-gradient-to-r from-green-50 to-green-100 border-green-200';
      case 'error':
        return 'bg-gradient-to-r from-red-50 to-red-100 border-red-200';
      case 'info':
        return 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200';
      case 'achievement':
        return 'bg-gradient-to-r from-yellow-50 to-amber-100 border-yellow-300';
      case 'motivation':
        return 'bg-gradient-to-r from-pink-50 to-pink-100 border-pink-200';
      case 'support':
        return 'bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200';
      default:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200';
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 right-4';
    }
  };

  const getAnimationVariants = () => {
    const isTop = position.includes('top');
    const isRight = position.includes('right');

    return {
      initial: {
        opacity: 0,
        y: isTop ? -20 : 20,
        x: isRight ? 20 : -20,
        scale: 0.9
      },
      animate: {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1
      },
      exit: {
        opacity: 0,
        x: isRight ? 100 : -100,
        transition: { duration: 0.2 }
      }
    };
  };

  const variants = getAnimationVariants();

  return (
    <div className={`fixed ${getPositionClasses()} z-50 ${className}`}>
      <AnimatePresence mode="sync">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
            icon={getIcon(notification.type)}
            bgColor={getBackgroundColor(notification.type)}
            variants={variants}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  icon: React.ReactNode;
  bgColor: string;
  variants: {
    initial: { opacity: number; y: number; x: number; scale: number };
    animate: { opacity: number; y: number; x: number; scale: number };
    exit: { opacity: number; x: number; transition: { duration: number } };
  };
}

function NotificationItem({
  notification,
  onDismiss,
  icon,
  bgColor,
  variants
}: NotificationItemProps) {
  useEffect(() => {
    if (notification.duration) {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);

  return (
    <motion.div
      layout
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
      className={`
        mb-3 p-4 rounded-lg border shadow-lg
        min-w-[300px] max-w-[400px]
        ${bgColor}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          {notification.type === 'achievement' ? (
            <motion.div
              animate={{
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 0.5,
                repeat: 2
              }}
            >
              {icon}
            </motion.div>
          ) : (
            icon
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 text-sm">
            {notification.title}
          </h4>
          <p className="text-gray-600 text-sm mt-1">
            {notification.message}
          </p>

          {/* Action Button */}
          {notification.action && (
            <button
              onClick={() => {
                notification.action?.onClick();
                onDismiss(notification.id);
              }}
              className="mt-2 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              {notification.action.label} ←
            </button>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => onDismiss(notification.id)}
          className="flex-shrink-0 p-1 hover:bg-white/50 rounded transition-colors"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Progress Bar for Auto-dismiss */}
      {notification.duration && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-lg overflow-hidden"
        >
          <motion.div
            className="h-full bg-black/20"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: notification.duration / 1000, ease: 'linear' }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

// Hook for managing notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration || 5000 // Default 5 seconds
    };

    setNotifications((prev) => [...prev, newNotification]);
    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  // Convenience methods for different types
  const success = (title: string, message: string, duration?: number) => {
    return addNotification({ type: 'success', title, message, duration });
  };

  const error = (title: string, message: string, duration?: number) => {
    return addNotification({ type: 'error', title, message, duration });
  };

  const info = (title: string, message: string, duration?: number) => {
    return addNotification({ type: 'info', title, message, duration });
  };

  const achievement = (title: string, message: string, duration?: number) => {
    return addNotification({ type: 'achievement', title, message, duration: duration || 7000 });
  };

  const motivation = (title: string, message: string, duration?: number) => {
    return addNotification({ type: 'motivation', title, message, duration });
  };

  const support = (title: string, message: string, duration?: number) => {
    return addNotification({ type: 'support', title, message, duration });
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    info,
    achievement,
    motivation,
    support
  };
}