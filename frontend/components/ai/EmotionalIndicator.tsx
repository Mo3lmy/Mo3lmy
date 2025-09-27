"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smile,
  Meh,
  Frown,
  AlertCircle,
  Moon,
  TrendingUp,
  TrendingDown,
  Zap
} from 'lucide-react';
import { EmotionalState } from '@/hooks/useEmotionalIntelligence';

interface EmotionalIndicatorProps {
  mood: EmotionalState;
  confidence: number;
  engagement: number;
  onMoodClick?: () => void;
  className?: string;
}

export default function EmotionalIndicator({
  mood,
  confidence,
  engagement,
  onMoodClick,
  className = ''
}: EmotionalIndicatorProps) {
  const getMoodIcon = () => {
    switch (mood) {
      case 'happy':
        return <Smile className="h-6 w-6 text-green-500" />;
      case 'neutral':
        return <Meh className="h-6 w-6 text-yellow-500" />;
      case 'frustrated':
        return <Frown className="h-6 w-6 text-red-500" />;
      case 'confused':
        return <AlertCircle className="h-6 w-6 text-orange-500" />;
      case 'tired':
        return <Moon className="h-6 w-6 text-blue-500" />;
      default:
        return <Meh className="h-6 w-6 text-gray-500" />;
    }
  };

  const getMoodLabel = () => {
    switch (mood) {
      case 'happy': return 'سعيد';
      case 'neutral': return 'عادي';
      case 'frustrated': return 'محبط';
      case 'confused': return 'محتار';
      case 'tired': return 'متعب';
      default: return '';
    }
  };

  const getMoodColor = () => {
    switch (mood) {
      case 'happy': return 'from-green-400 to-green-600';
      case 'neutral': return 'from-yellow-400 to-yellow-600';
      case 'frustrated': return 'from-red-400 to-red-600';
      case 'confused': return 'from-orange-400 to-orange-600';
      case 'tired': return 'from-blue-400 to-blue-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getProgressColor = (value: number) => {
    if (value >= 70) return 'bg-green-500';
    if (value >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${className}`}>
      {/* Mood Display */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onMoodClick}
          className="flex items-center gap-2 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors"
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`p-2 rounded-full bg-gradient-to-br ${getMoodColor()}`}
          >
            {getMoodIcon()}
          </motion.div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{getMoodLabel()}</p>
            <p className="text-xs text-gray-500">كيف تشعر؟</p>
          </div>
        </button>

        {/* Quick Mood Selector */}
        <div className="flex gap-1">
          {(['happy', 'neutral', 'frustrated', 'confused', 'tired'] as EmotionalState[]).map((moodOption) => (
            <button
              key={moodOption}
              onClick={() => onMoodClick && onMoodClick()}
              className={`p-1.5 rounded-md transition-all ${
                mood === moodOption
                  ? 'bg-primary-100 scale-110'
                  : 'hover:bg-gray-100'
              }`}
            >
              {moodOption === 'happy' && '😊'}
              {moodOption === 'neutral' && '😐'}
              {moodOption === 'frustrated' && '😤'}
              {moodOption === 'confused' && '😕'}
              {moodOption === 'tired' && '😴'}
            </button>
          ))}
        </div>
      </div>

      {/* Confidence & Engagement Bars */}
      <div className="space-y-3">
        {/* Confidence */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">مستوى الثقة</span>
            <div className="flex items-center gap-1">
              {confidence > 70 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : confidence < 40 ? (
                <TrendingDown className="h-3 w-3 text-red-500" />
              ) : null}
              <span className="text-xs text-gray-500">{confidence}%</span>
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${getProgressColor(confidence)}`}
              initial={{ width: 0 }}
              animate={{ width: `${confidence}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Engagement */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">مستوى المشاركة</span>
            <div className="flex items-center gap-1">
              {engagement > 70 && (
                <Zap className="h-3 w-3 text-yellow-500" />
              )}
              <span className="text-xs text-gray-500">{engagement}%</span>
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${getProgressColor(engagement)}`}
              initial={{ width: 0 }}
              animate={{ width: `${engagement}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Visual Feedback Animation */}
      <AnimatePresence>
        {mood === 'happy' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 p-2 bg-green-50 rounded-lg"
          >
            <p className="text-xs text-green-700 text-center">
              أداء رائع! استمر 🌟
            </p>
          </motion.div>
        )}

        {mood === 'frustrated' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 p-2 bg-red-50 rounded-lg"
          >
            <p className="text-xs text-red-700 text-center">
              لا تقلق، خذ وقتك 💪
            </p>
          </motion.div>
        )}

        {mood === 'tired' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 p-2 bg-blue-50 rounded-lg"
          >
            <p className="text-xs text-blue-700 text-center">
              ربما تحتاج لاستراحة؟ ☕
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}