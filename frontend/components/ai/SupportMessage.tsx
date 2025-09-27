"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  Coffee,
  Heart,
  Zap,
  X,
  ChevronRight
} from 'lucide-react';

interface SupportMessageProps {
  suggestions: {
    type: 'break' | 'help' | 'motivation' | 'simplification';
    message: string;
    action?: () => void;
  }[];
  onDismiss: (index: number) => void;
  onAction?: (index: number) => void;
  className?: string;
}

export default function SupportMessage({
  suggestions,
  onDismiss,
  onAction,
  className = ''
}: SupportMessageProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'break':
        return <Coffee className="h-5 w-5" />;
      case 'help':
        return <HelpCircle className="h-5 w-5" />;
      case 'motivation':
        return <Heart className="h-5 w-5" />;
      case 'simplification':
        return <Zap className="h-5 w-5" />;
      default:
        return <HelpCircle className="h-5 w-5" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'break':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'help':
        return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'motivation':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'simplification':
        return 'bg-orange-50 border-orange-200 text-orange-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'break':
        return 'خذ استراحة';
      case 'help':
        return 'احصل على مساعدة';
      case 'motivation':
        return 'شكراً';
      case 'simplification':
        return 'بسّط المحتوى';
      default:
        return 'موافق';
    }
  };

  if (suggestions.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <AnimatePresence>
        {suggestions.map((suggestion, index) => (
          <motion.div
            key={`${suggestion.type}-${index}`}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.3 }}
            className={`
              relative rounded-lg border p-3
              ${getColor(suggestion.type)}
            `}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(suggestion.type)}
              </div>

              {/* Message */}
              <div className="flex-1">
                <p className="text-sm leading-relaxed">
                  {suggestion.message}
                </p>

                {/* Action Button */}
                {(suggestion.action || onAction) && (
                  <button
                    onClick={() => {
                      if (suggestion.action) {
                        suggestion.action();
                      } else if (onAction) {
                        onAction(index);
                      }
                    }}
                    className="
                      mt-2 inline-flex items-center gap-1 px-3 py-1
                      bg-white/80 hover:bg-white rounded-md
                      text-xs font-medium transition-colors
                    "
                  >
                    {getActionLabel(suggestion.type)}
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Dismiss Button */}
              <button
                onClick={() => onDismiss(index)}
                className="
                  flex-shrink-0 p-1 hover:bg-white/50 rounded
                  transition-colors
                "
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}