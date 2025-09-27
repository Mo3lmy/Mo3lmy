"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coffee,
  X,
  Activity,
  Eye,
  Droplets,
  Wind
} from 'lucide-react';

interface BreakReminderProps {
  sessionDuration: number; // in minutes
  onBreakStart?: () => void;
  onBreakEnd?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function BreakReminder({
  sessionDuration,
  onBreakStart,
  onBreakEnd,
  onDismiss,
  className = ''
}: BreakReminderProps) {
  const [showReminder, setShowReminder] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(300); // 5 minutes in seconds

  // Check if it's time for a break (every 30 minutes)
  useEffect(() => {
    if (sessionDuration > 0 && sessionDuration % 30 === 0 && !isOnBreak) {
      setShowReminder(true);
    }
  }, [sessionDuration, isOnBreak]);

  // Break countdown timer
  useEffect(() => {
    if (isOnBreak && breakTimeLeft > 0) {
      const timer = setTimeout(() => {
        setBreakTimeLeft(prev => prev - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (isOnBreak && breakTimeLeft === 0) {
      handleBreakEnd();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnBreak, breakTimeLeft]);

  const handleBreakStart = () => {
    setIsOnBreak(true);
    setShowReminder(false);
    setBreakTimeLeft(300); // Reset to 5 minutes
    onBreakStart?.();
  };

  const handleBreakEnd = () => {
    setIsOnBreak(false);
    onBreakEnd?.();
  };

  const handleDismiss = () => {
    setShowReminder(false);
    onDismiss?.();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const breakActivities = [
    { icon: <Eye className="h-4 w-4" />, label: 'أغمض عينيك', description: 'أرح عينيك لدقيقة' },
    { icon: <Droplets className="h-4 w-4" />, label: 'اشرب ماء', description: 'حافظ على الترطيب' },
    { icon: <Activity className="h-4 w-4" />, label: 'تمدد', description: 'حرك جسمك قليلاً' },
    { icon: <Wind className="h-4 w-4" />, label: 'تنفس عميق', description: 'خذ 5 أنفاس عميقة' }
  ];

  return (
    <>
      {/* Break Reminder Modal */}
      <AnimatePresence>
        {showReminder && !isOnBreak && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`
              fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              bg-white rounded-xl shadow-2xl p-6 z-50
              max-w-md w-full mx-4
              ${className}
            `}
          >
            <div className="text-center">
              <motion.div
                animate={{
                  rotate: [0, -10, 10, -10, 0],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  repeatDelay: 2
                }}
                className="inline-block mb-4"
              >
                <Coffee className="h-16 w-16 text-primary-500" />
              </motion.div>

              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                حان وقت الاستراحة!
              </h3>

              <p className="text-gray-600 mb-6">
                لقد كنت تدرس لمدة {sessionDuration} دقيقة.
                <br />
                خذ استراحة قصيرة لتجديد طاقتك وتحسين تركيزك.
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleBreakStart}
                  className="px-6 py-3 bg-primary-500 hover:bg-primary-600
                           text-white font-medium rounded-lg transition-colors"
                >
                  ابدأ الاستراحة (5 دقائق)
                </button>

                <button
                  onClick={handleDismiss}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300
                           text-gray-700 font-medium rounded-lg transition-colors"
                >
                  ليس الآن
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Break Timer */}
      <AnimatePresence>
        {isOnBreak && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-40"
          >
            <div className="flex items-center gap-3 mb-3">
              <Coffee className="h-5 w-5 text-primary-500" />
              <div>
                <p className="font-medium text-gray-900">في استراحة</p>
                <p className="text-2xl font-bold text-primary-600">
                  {formatTime(breakTimeLeft)}
                </p>
              </div>
              <button
                onClick={handleBreakEnd}
                className="ml-auto p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Break Activities */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium">أنشطة مقترحة:</p>
              <div className="grid grid-cols-2 gap-2">
                {breakActivities.map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-md"
                  >
                    <div className="text-primary-500">{activity.icon}</div>
                    <div>
                      <p className="text-xs font-medium text-gray-700">
                        {activity.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-600"
                initial={{ width: '100%' }}
                animate={{ width: `${(breakTimeLeft / 300) * 100}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay when on break */}
      <AnimatePresence>
        {isOnBreak && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
            onClick={handleBreakEnd}
          />
        )}
      </AnimatePresence>
    </>
  );
}