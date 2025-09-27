// frontend/components/slides/SlideGenerationProgress.tsx
// Progress tracking UI component for slide generation

import React from 'react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';

interface SlideGenerationProgressProps {
  progress: number;
  totalSlides: number;
  currentSlide: number;
  status: 'processing' | 'completed' | 'failed';
  message?: string;
  onCancel?: () => void;
}

const SlideGenerationProgress: React.FC<SlideGenerationProgressProps> = ({
  progress,
  totalSlides,
  currentSlide,
  status,
  message,
  onCancel
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-8 h-8 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="w-8 h-8 text-green-500" />;
      case 'failed':
        return <XCircle className="w-8 h-8 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusMessage = () => {
    if (message) return message;

    switch (status) {
      case 'processing':
        return `جاري معالجة الشريحة ${currentSlide} من ${totalSlides}...`;
      case 'completed':
        return 'اكتملت معالجة جميع الشرائح بنجاح!';
      case 'failed':
        return 'فشل توليد الشرائح. الرجاء المحاولة مرة أخرى.';
      default:
        return 'جاري التحضير...';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-center mb-6">
          {getStatusIcon()}
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-center mb-2 text-gray-800 dark:text-white">
          توليد الشرائح التعليمية
        </h3>

        {/* Message */}
        <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
          {getStatusMessage()}
        </p>

        {/* Progress Bar */}
        {status === 'processing' && (
          <div className="space-y-4 mb-6">
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-sm text-gray-500">
              <span>{Math.round(progress)}%</span>
              <span>{currentSlide} / {totalSlides} شريحة</span>
            </div>
          </div>
        )}

        {/* Features being generated */}
        {status === 'processing' && (
          <div className="mb-6 space-y-2">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                توليد المحتوى التعليمي المخصص
              </span>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                إنشاء الشرح الصوتي التفاعلي
              </span>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                تصميم العناصر المرئية الجذابة
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center space-x-4 space-x-reverse">
          {status === 'processing' && onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              إلغاء
            </button>
          )}

          {status === 'completed' && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              عرض الشرائح
            </motion.button>
          )}

          {status === 'failed' && (
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              إغلاق
            </button>
          )}
        </div>

        {/* Estimated time */}
        {status === 'processing' && progress > 0 && (
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
            الوقت المتبقي المقدر: {Math.ceil((totalSlides - currentSlide) * 15)} ثانية
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default SlideGenerationProgress;