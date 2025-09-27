"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface LiveIndicatorProps {
  isConnected: boolean;
  reconnectAttempt?: number;
  className?: string;
  showLabel?: boolean;
}

export default function LiveIndicator({
  isConnected,
  reconnectAttempt = 0,
  className = '',
  showLabel = true
}: LiveIndicatorProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      title={isConnected ? 'متصل' : reconnectAttempt > 0 ? 'إعادة الاتصال...' : 'غير متصل'}
    >
      {/* Connection Dot */}
      <div className="relative">
        <motion.div
          animate={{
            scale: isConnected ? [1, 1.2, 1] : 1,
            opacity: isConnected ? [0.5, 1, 0.5] : 1
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`
            w-2 h-2 rounded-full
            ${isConnected
              ? 'bg-green-500'
              : reconnectAttempt > 0
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }
          `}
        />

        {/* Pulse Effect for Connected State */}
        {isConnected && (
          <motion.div
            animate={{
              scale: [1, 1.5, 2],
              opacity: [0.5, 0.3, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut"
            }}
            className="absolute inset-0 w-2 h-2 rounded-full bg-green-500"
          />
        )}
      </div>

      {/* Icon and Label */}
      {showLabel && (
        <>
          {isConnected ? (
            <Wifi className="h-3 w-3 text-green-600" />
          ) : reconnectAttempt > 0 ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw className="h-3 w-3 text-yellow-600" />
            </motion.div>
          ) : (
            <WifiOff className="h-3 w-3 text-red-600" />
          )}

          <span className={`
            text-xs font-medium
            ${isConnected
              ? 'text-green-600'
              : reconnectAttempt > 0
                ? 'text-yellow-600'
                : 'text-red-600'
            }
          `}>
            {isConnected
              ? 'مباشر'
              : reconnectAttempt > 0
                ? `إعادة محاولة ${reconnectAttempt}...`
                : 'غير متصل'
            }
          </span>
        </>
      )}
    </div>
  );
}