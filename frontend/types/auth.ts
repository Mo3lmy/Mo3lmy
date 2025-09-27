export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "STUDENT" | "PARENT" | "TEACHER" | "ADMIN";
  phone?: string;
  grade?: number;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  profile?: {
    avatar?: string;
    bio?: string;
    phoneNumber?: string;
    points: number;
    level: number;
    coins: number;
    streak: number;
  };
  studentProfile?: StudentProfile;
  parentProfile?: ParentProfile;
}

export interface StudentProfile {
  id: string;
  userId: string;
  birthDate: Date;
  educationLevel: "PRIMARY" | "MIDDLE" | "HIGH";
  grade: number;
  school: string;
  governorate: string;
  educationDistrict: string;
  parentId?: string;
}

export interface ParentProfile {
  id: string;
  userId: string;
  occupation?: string;
  children?: User[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
  };
  message?: string;
  error?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  accountType: "STUDENT" | "PARENT";

  // Student specific fields
  birthDate?: Date;
  educationLevel?: "PRIMARY" | "MIDDLE" | "HIGH";
  grade?: number;
  school?: string;
  governorate?: string;
  educationDistrict?: string;
  parentEmail?: string;

  // Parent specific fields
  occupation?: string;
}

export interface RegisterFormData {
  // Basic info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;

  // Account type
  accountType: "STUDENT" | "PARENT";

  // Student fields
  birthDate?: Date;
  educationLevel?: "PRIMARY" | "MIDDLE" | "HIGH";
  grade?: number;
  school?: string;
  governorate?: string;
  educationDistrict?: string;
  parentEmail?: string;

  // Parent fields
  occupation?: string;
}

export interface RegisterResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
  };
  message?: string;
  error?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}