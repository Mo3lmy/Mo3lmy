"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = "info",
  duration = 3000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const types = {
    success: {
      bg: "bg-success-50",
      border: "border-success-200",
      text: "text-success-800",
      icon: <CheckCircle className="h-5 w-5 text-success-500" />,
    },
    error: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-800",
      icon: <AlertCircle className="h-5 w-5 text-red-500" />,
    },
    warning: {
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      text: "text-yellow-800",
      icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-800",
      icon: <Info className="h-5 w-5 text-blue-500" />,
    },
  };

  const currentType = types[type];

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-50 min-w-[300px] max-w-md rounded-lg border p-4 shadow-lg transition-all duration-300",
        currentType.bg,
        currentType.border,
        isVisible ? "animate-slide-in-left opacity-100" : "animate-slide-out-left opacity-0"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">{currentType.icon}</div>
        <div className={cn("flex-1 text-sm", currentType.text)}>
          {message}
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="flex-shrink-0 rounded hover:bg-white/50 p-1 transition-colors"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
};

export interface ToastState {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const showToast = (message: string, type: ToastType = "info", duration?: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return { toasts, showToast, removeToast };
};

export const ToastContainer: React.FC<{ toasts: ToastState[]; removeToast: (id: string) => void }> = ({
  toasts,
  removeToast,
}) => {
  return (
    <>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ bottom: `${(index + 1) * 80}px` }}
          className="fixed left-4 z-50"
        >
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </>
  );
};

export default Toast;