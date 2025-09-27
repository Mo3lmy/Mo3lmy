// frontend/components/ui/progress.tsx
import React from 'react';

interface ProgressProps {
  value: number;
  className?: string;
  indicatorClassName?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  className = '',
  indicatorClassName = ''
}) => {
  const percentage = Math.min(100, Math.max(0, value));

  return (
    <div
      className={`relative w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 ${className}`}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full transition-all duration-300 ease-in-out bg-blue-600 dark:bg-blue-500 ${indicatorClassName}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

export default Progress;