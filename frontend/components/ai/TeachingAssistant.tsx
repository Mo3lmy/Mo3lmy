"use client";

import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  RefreshCw,
  Loader2,
  BookOpen,
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import InteractionButtons from './InteractionButtons';
import VoicePlayer from './VoicePlayer';
import { useTeachingAssistant, InteractionType } from '@/hooks/useTeachingAssistant';
import Card from '../ui/Card';

interface TeachingAssistantProps {
  lessonId: string;
  slideContent?: Record<string, unknown>;
  className?: string;
}

export default function TeachingAssistant({
  lessonId,
  slideContent,
  className = ''
}: TeachingAssistantProps) {
  const {
    isLoading,
    error,
    currentScript,
    isPlaying,
    generateScript,
    handleInteraction,
    playVoice,
    stopVoice
  } = useTeachingAssistant(lessonId);

  const [isExpanded, setIsExpanded] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [typewriterIndex, setTypewriterIndex] = useState(0);

  // Typewriter effect for the teaching script
  useEffect(() => {
    if (currentScript?.script && typewriterIndex < currentScript.script.length) {
      const timer = setTimeout(() => {
        setCurrentText(currentScript.script.slice(0, typewriterIndex + 1));
        setTypewriterIndex(typewriterIndex + 1);
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [currentScript, typewriterIndex]);

  // Reset typewriter when new script arrives
  useEffect(() => {
    if (currentScript?.script) {
      setCurrentText('');
      setTypewriterIndex(0);
    }
  }, [currentScript]);

  // Auto-generate script when slide changes
  useEffect(() => {
    if (slideContent && !isLoading) {
      generateScript(slideContent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideContent]);

  const handleInteractionClick = async (type: InteractionType) => {
    const response = await handleInteraction(type, { currentSlide: slideContent });
    if (response) {
      // Handle the interaction response
      console.log('Interaction response:', response);
    }
  };

  return (
    <Card className={`relative ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Brain className="h-8 w-8 text-primary-500" />
            {isLoading && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
              >
                <RefreshCw className="h-8 w-8 text-primary-300" />
              </motion.div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">المعلم الذكي</h3>
            <p className="text-xs text-gray-500">
              {isLoading ? 'يفكر...' : isPlaying ? 'يتحدث...' : 'مستعد للمساعدة'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <MessageCircle className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Script Display */}
        <div className="min-h-[120px] max-h-[200px] overflow-y-auto">
          {error ? (
            <div className="text-red-500 text-sm p-3 bg-red-50 rounded-lg">
              {error}
            </div>
          ) : currentText ? (
            <div className="text-gray-700 leading-relaxed">
              {currentText}
              {typewriterIndex < (currentScript?.script?.length || 0) && (
                <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse ml-1" />
              )}
            </div>
          ) : (
            <div className="text-gray-400 italic">
              اضغط على أحد الأزرار للبدء في التفاعل...
            </div>
          )}
        </div>

        {/* Key Points */}
        {currentScript?.keyPoints && currentScript.keyPoints.length > 0 && (
          <div className="bg-primary-50 p-3 rounded-lg">
            <h4 className="font-medium text-primary-700 text-sm mb-2">
              <BookOpen className="inline-block h-4 w-4 ml-1" />
              النقاط الرئيسية
            </h4>
            <ul className="space-y-1">
              {currentScript.keyPoints.map((point, index) => (
                <li key={index} className="text-sm text-primary-600 flex items-start">
                  <span className="text-primary-400 ml-2">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Voice Player */}
        {currentScript?.audioUrl && (
          <VoicePlayer
            audioUrl={currentScript.audioUrl}
            isPlaying={isPlaying}
            onPlay={playVoice}
            onPause={stopVoice}
          />
        )}

        {/* Interaction Buttons */}
        <InteractionButtons
          onInteraction={handleInteractionClick}
          isLoading={isLoading}
        />

        {/* Examples Section */}
        {currentScript?.examples && currentScript.examples.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 p-3 rounded-lg"
          >
            <h4 className="font-medium text-blue-700 text-sm mb-2">أمثلة:</h4>
            <ul className="space-y-1">
              {currentScript.examples.map((example, index) => (
                <li key={index} className="text-sm text-blue-600">
                  {example}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Problem Section */}
        {currentScript?.problem && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-purple-50 p-3 rounded-lg"
          >
            <h4 className="font-medium text-purple-700 text-sm mb-2">تمرين:</h4>
            <p className="text-sm text-purple-600 mb-2">
              {currentScript.problem.question}
            </p>
            {currentScript.problem.hints && (
              <div className="mt-2 pt-2 border-t border-purple-200">
                <p className="text-xs text-purple-500 font-medium mb-1">تلميحات:</p>
                <ul className="space-y-0.5">
                  {currentScript.problem.hints.map((hint, index) => (
                    <li key={index} className="text-xs text-purple-500">
                      • {hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {/* Next Suggestions */}
        {currentScript?.nextSuggestions && currentScript.nextSuggestions.length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">اقتراحات التالي:</p>
            <div className="flex flex-wrap gap-2">
              {currentScript.nextSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleInteractionClick(suggestion as InteractionType)}
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg"
          >
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-primary-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600">جاري التفكير...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}