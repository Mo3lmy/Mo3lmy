"use client";

import React from "react";
import { cn } from "@/utils/cn";

interface LoadingProps {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "white" | "gray";
  fullScreen?: boolean;
  text?: string;
}

const Loading: React.FC<LoadingProps> = ({
  size = "md",
  color = "primary",
  fullScreen = false,
  text,
}) => {
  const sizes = {
    sm: "h-6 w-6",
    md: "h-10 w-10",
    lg: "h-16 w-16",
  };

  const colors = {
    primary: "text-primary-500",
    white: "text-white",
    gray: "text-gray-500",
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center">
      <div className={cn("animate-spin", sizes[size])}>
        <svg
          className={cn("w-full h-full", colors[color])}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      {text && (
        <p className={cn("mt-3 text-sm font-medium", colors[color])}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default Loading;