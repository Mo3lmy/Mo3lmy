"use client";

import React, { useEffect } from "react";
import { cn } from "@/utils/cn";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnOverlayClick?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  closeOnOverlayClick = true,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div
        className={cn(
          "relative bg-white rounded-xl shadow-xl animate-bounce-in w-full mx-4",
          sizes[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={onClose}
            className="absolute left-4 top-4 p-1 rounded-lg hover:bg-gray-100 transition-colors z-10"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        )}
        <div className={cn("p-5", !title && "pt-12")}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;