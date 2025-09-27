"use client";

import React from 'react';
import {
  HelpCircle,
  Lightbulb,
  BookOpen,
  PenTool,
  RotateCcw,
  PlayCircle,
  StopCircle,
  FileQuestion,
  FileText,
  Heart,
  Zap,
  Layers
} from 'lucide-react';
import { InteractionType } from '@/hooks/useTeachingAssistant';

interface InteractionButtonsProps {
  onInteraction: (type: InteractionType) => void;
  isLoading?: boolean;
}

interface ButtonConfig {
  type: InteractionType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

export default function InteractionButtons({
  onInteraction,
  isLoading = false
}: InteractionButtonsProps) {
  const buttonGroups: {
    title: string;
    buttons: ButtonConfig[];
  }[] = [
    {
      title: 'الشرح والتوضيح',
      buttons: [
        {
          type: 'explain',
          label: 'اشرح',
          icon: <HelpCircle className="h-4 w-4" />,
          color: 'bg-blue-500 hover:bg-blue-600',
          description: 'شرح المفهوم بطريقة بسيطة'
        },
        {
          type: 'more_detail',
          label: 'تفاصيل أكثر',
          icon: <Layers className="h-4 w-4" />,
          color: 'bg-indigo-500 hover:bg-indigo-600',
          description: 'المزيد من التفاصيل والمعلومات'
        },
        {
          type: 'simplify',
          label: 'بسّط',
          icon: <Zap className="h-4 w-4" />,
          color: 'bg-yellow-500 hover:bg-yellow-600',
          description: 'تبسيط الشرح'
        }
      ]
    },
    {
      title: 'الأمثلة والتطبيق',
      buttons: [
        {
          type: 'example',
          label: 'مثال',
          icon: <Lightbulb className="h-4 w-4" />,
          color: 'bg-green-500 hover:bg-green-600',
          description: 'عرض مثال توضيحي'
        },
        {
          type: 'problem',
          label: 'تمرين',
          icon: <PenTool className="h-4 w-4" />,
          color: 'bg-purple-500 hover:bg-purple-600',
          description: 'حل تمرين تطبيقي'
        },
        {
          type: 'application',
          label: 'تطبيق عملي',
          icon: <BookOpen className="h-4 w-4" />,
          color: 'bg-orange-500 hover:bg-orange-600',
          description: 'مثال من الحياة'
        }
      ]
    },
    {
      title: 'التحكم والمراجعة',
      buttons: [
        {
          type: 'repeat',
          label: 'كرر',
          icon: <RotateCcw className="h-4 w-4" />,
          color: 'bg-gray-500 hover:bg-gray-600',
          description: 'إعادة الشرح'
        },
        {
          type: 'continue',
          label: 'تابع',
          icon: <PlayCircle className="h-4 w-4" />,
          color: 'bg-teal-500 hover:bg-teal-600',
          description: 'المتابعة للخطوة التالية'
        },
        {
          type: 'stop',
          label: 'توقف',
          icon: <StopCircle className="h-4 w-4" />,
          color: 'bg-red-500 hover:bg-red-600',
          description: 'إيقاف الشرح'
        }
      ]
    },
    {
      title: 'التقييم والتحفيز',
      buttons: [
        {
          type: 'quiz',
          label: 'اختبار سريع',
          icon: <FileQuestion className="h-4 w-4" />,
          color: 'bg-pink-500 hover:bg-pink-600',
          description: 'اختبار فهمك'
        },
        {
          type: 'summary',
          label: 'ملخص',
          icon: <FileText className="h-4 w-4" />,
          color: 'bg-cyan-500 hover:bg-cyan-600',
          description: 'ملخص النقاط المهمة'
        },
        {
          type: 'motivate',
          label: 'حفزني',
          icon: <Heart className="h-4 w-4" />,
          color: 'bg-rose-500 hover:bg-rose-600',
          description: 'كلمات تحفيزية'
        }
      ]
    }
  ];

  return (
    <div className="space-y-4">
      {buttonGroups.map((group, groupIndex) => (
        <div key={groupIndex}>
          <h4 className="text-xs font-medium text-gray-500 mb-2">{group.title}</h4>
          <div className="grid grid-cols-3 gap-2">
            {group.buttons.map((button) => (
              <button
                key={button.type}
                onClick={() => onInteraction(button.type)}
                disabled={isLoading}
                title={button.description}
                className={`
                  relative group flex items-center justify-center gap-1.5 px-3 py-2
                  text-white text-sm font-medium rounded-lg
                  transition-all duration-200 transform active:scale-95
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${button.color}
                `}
              >
                {button.icon}
                <span>{button.label}</span>

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                              opacity-0 group-hover:opacity-100 pointer-events-none
                              transition-opacity duration-200 z-10">
                  <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap">
                    {button.description}
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2
                                w-0 h-0 border-l-4 border-l-transparent
                                border-r-4 border-r-transparent
                                border-t-4 border-t-gray-900" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}