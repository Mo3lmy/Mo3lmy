import axios from "axios";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
} from "@/types/auth";

// Create axios instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: any) => {
    // Log للـ development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data
      });
    }

    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/auth/login";
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/auth/login", data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await api.post<RegisterResponse>("/auth/register", data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    // Clear local storage
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getMe: async (): Promise<User> => {
    const response = await api.get<{ data: User }>("/auth/me");
    return response.data.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.put<{ data: User }>("/auth/profile", data);
    return response.data.data;
  },
};

// Lesson API calls
export const lessonAPI = {
  getAllLessons: async (): Promise<any> => {
    const response = await api.get<{ data: any }>("/lessons");
    return response.data.data;
  },

  getLesson: async (id: string): Promise<any> => {
    const response = await api.get<{ data: any }>(`/lessons/${id}`);
    return response.data.data;
  },

  getLessonSlides: async (id: string): Promise<any> => {
    const response = await api.get<{ data: any }>(`/lessons/${id}/slides`);
    return response.data.data;
  },

  startLesson: async (id: string): Promise<any> => {
    const response = await api.post<{ data: any }>(`/lessons/${id}/start`);
    return response.data.data;
  },

  completeLesson: async (id: string): Promise<any> => {
    const response = await api.post<{ data: any }>(`/lessons/${id}/complete`);
    return response.data.data;
  },
};

// Quiz API calls
export const quizAPI = {
  getQuiz: async (lessonId: string): Promise<any> => {
    const response = await api.get<{ data: any }>(`/quiz/lesson/${lessonId}`);
    return response.data.data;
  },

  submitAnswer: async (data: {
    lessonId: string;
    questionId: string;
    answer: string;
  }): Promise<any> => {
    const response = await api.post<{ data: any }>("/quiz/submit", data);
    return response.data.data;
  },

  getResults: async (attemptId: string): Promise<any> => {
    const response = await api.get<{ data: any }>(`/quiz/results/${attemptId}`);
    return response.data.data;
  },
};

// Chat API calls
export const chatAPI = {
  sendMessage: async (lessonId: string, message: string): Promise<any> => {
    const response = await api.post<{ data: any }>(`/chat/${lessonId}`, { message });
    return response.data.data;
  },

  getChatHistory: async (lessonId: string): Promise<any> => {
    const response = await api.get<{ data: any }>(`/chat/${lessonId}/history`);
    return response.data.data;
  },
};

// Achievement API calls
export const achievementAPI = {
  getAchievements: async (): Promise<any> => {
    const response = await api.get<{ data: any }>("/achievements");
    return response.data.data;
  },

  claimReward: async (achievementId: string): Promise<any> => {
    const response = await api.post<{ data: any }>(`/achievements/${achievementId}/claim`);
    return response.data.data;
  },
};

// Teaching API calls
export const teachingAPI = {
  generateScript: async (lessonId: string, slideContent: any, options?: any) => {
    const response = await api.post(`/lessons/${lessonId}/teaching/script`, {
      slideContent,
      generateVoice: true,
      options
    });
    return response.data;
  },

  handleInteraction: async (lessonId: string, type: string, context?: any) => {
    const response = await api.post(`/lessons/${lessonId}/teaching/interaction`, {
      type,
      slideContent: context?.currentSlide,
      context
    });
    return response.data;
  },

  generateSmartLesson: async (lessonId: string) => {
    const response = await api.post(`/lessons/${lessonId}/teaching/generate-smart`);
    return response.data;
  },

  getStatus: async (lessonId: string) => {
    const response = await api.get(`/lessons/${lessonId}/teaching/status`);
    return response.data;
  }
};

export default api;