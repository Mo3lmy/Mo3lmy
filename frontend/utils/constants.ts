// Application constants
export const APP_NAME = "منصة التعليم الذكية";
export const APP_DESCRIPTION = "منصة تعليمية ذكية مدعومة بالذكاء الاصطناعي";

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    LOGOUT: "/auth/logout",
    ME: "/auth/me",
    PROFILE: "/auth/profile",
  },
  LESSONS: {
    ALL: "/lessons",
    BY_ID: (id: string) => `/lessons/${id}`,
    SLIDES: (id: string) => `/lessons/${id}/slides`,
    START: (id: string) => `/lessons/${id}/start`,
    COMPLETE: (id: string) => `/lessons/${id}/complete`,
  },
  QUIZ: {
    BY_LESSON: (lessonId: string) => `/quiz/lesson/${lessonId}`,
    SUBMIT: "/quiz/submit",
    RESULTS: (attemptId: string) => `/quiz/results/${attemptId}`,
  },
  CHAT: {
    SEND: (lessonId: string) => `/chat/${lessonId}`,
    HISTORY: (lessonId: string) => `/chat/${lessonId}/history`,
  },
  ACHIEVEMENTS: {
    ALL: "/achievements",
    CLAIM: (id: string) => `/achievements/${id}/claim`,
  },
};

// User roles
export const USER_ROLES = {
  STUDENT: "STUDENT",
  TEACHER: "TEACHER",
  ADMIN: "ADMIN",
} as const;

// Difficulty levels
export const DIFFICULTY_LEVELS = {
  EASY: "EASY",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
} as const;

// Grade levels
export const GRADE_LEVELS = Array.from({ length: 12 }, (_, i) => i + 1);

// Local storage keys
export const STORAGE_KEYS = {
  TOKEN: "token",
  USER: "user",
  THEME: "theme",
  LANGUAGE: "language",
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

// Toast durations
export const TOAST_DURATION = {
  SHORT: 2000,
  MEDIUM: 3000,
  LONG: 5000,
} as const;

// Animation durations
export const ANIMATION_DURATION = {
  FAST: 200,
  NORMAL: 300,
  SLOW: 500,
} as const;