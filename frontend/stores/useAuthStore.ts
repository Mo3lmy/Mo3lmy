import { create } from "zustand";
import { authAPI } from "@/services/api";
import type {
  User,
  LoginRequest,
  RegisterRequest,
  AuthState,
} from "@/types/auth";

interface AuthStore extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  checkAuth: () => Promise<void>;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (data: LoginRequest) => {
    set({ isLoading: true });
    try {
      const response = await authAPI.login(data);
      if (response.success && response.data) {
        const { user, token } = response.data;

        // Save to localStorage
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));

        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        throw new Error(response.message || "Login failed");
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data: RegisterRequest) => {
    set({ isLoading: true });
    try {
      const response = await authAPI.register(data);
      if (response.success && response.data) {
        const { user, token } = response.data;

        // Save to localStorage
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));

        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        throw new Error(response.message || "Registration failed");
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    // Clear localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Clear state
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Call logout API (optional)
    authAPI.logout();
  },

  updateUser: (user: User) => {
    localStorage.setItem("user", JSON.stringify(user));
    set({ user });
  },

  checkAuth: async () => {
    set({ isLoading: true });

    // Check localStorage first
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (!token || !userStr) {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return;
    }

    try {
      const user = JSON.parse(userStr);
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });

      // Optionally verify with backend
      const freshUser = await authAPI.getMe();
      if (freshUser) {
        localStorage.setItem("user", JSON.stringify(freshUser));
        set({ user: freshUser });
      }
    } catch (error) {
      // Invalid token or user data
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));

export default useAuthStore;