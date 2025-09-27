import { useState, useCallback, useEffect } from 'react';
import api from '@/services/api';

export type LearningStyle = 'visual' | 'auditory' | 'kinesthetic' | 'reading';

interface StudentProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  grade: number;

  // Learning preferences
  learningStyle: LearningStyle;
  preferredPace: 'slow' | 'normal' | 'fast';
  preferredDifficulty: 'easy' | 'medium' | 'hard';

  // Performance metrics
  overallProgress: number;
  averageScore: number;
  completedLessons: number;
  totalLessons: number;
  streak: number;
  points: number;
  level: number;

  // Strengths and weaknesses
  strengths: string[];
  weaknesses: string[];
  interests: string[];

  // Recent activity
  lastActive: Date;
  totalStudyTime: number; // in minutes
  weeklyGoal: number; // in minutes
  weeklyProgress: number; // in minutes

  // Achievements
  achievements: Achievement[];
  badges: Badge[];
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: Date;
  points: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  level: 'bronze' | 'silver' | 'gold';
  progress: number;
  target: number;
}

interface ProgressData {
  subject: string;
  progress: number;
  lastActivity: Date;
  score: number;
}

export function useStudentProfile(userId: string) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch student profile
  const fetchProfile = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<{ success: boolean; data: any; message?: string }>(`/student-context/${userId}`);

      if (response.data?.success) {
        const data = response.data.data;

        // Transform API response to StudentProfile
        const profile: StudentProfile = {
          id: data.id,
          userId: data.userId,
          firstName: data.firstName || 'الطالب',
          lastName: data.lastName || '',
          grade: data.grade || 6,

          learningStyle: data.learningStyle || 'visual',
          preferredPace: data.preferredPace || 'normal',
          preferredDifficulty: data.preferredDifficulty || 'medium',

          overallProgress: data.overallProgress || 0,
          averageScore: data.averageScore || 0,
          completedLessons: data.completedLessons || 0,
          totalLessons: data.totalLessons || 20,
          streak: data.streak || 0,
          points: data.points || 0,
          level: data.level || 1,

          strengths: data.strengths || [],
          weaknesses: data.weaknesses || [],
          interests: data.interests || [],

          lastActive: new Date(data.lastActive || Date.now()),
          totalStudyTime: data.totalStudyTime || 0,
          weeklyGoal: data.weeklyGoal || 300, // 5 hours
          weeklyProgress: data.weeklyProgress || 0,

          achievements: data.achievements || [],
          badges: data.badges || []
        };

        setProfile(profile);
      } else {
        throw new Error(response.data?.message || 'Failed to fetch profile');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch student profile';
      setError(errorMessage);
      console.error('Profile fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Fetch progress data
  const fetchProgressData = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await api.get<{ success: boolean; data: ProgressData[] }>(`/student-context/${userId}/progress`);

      if (response.data?.success) {
        setProgressData(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch progress data:', err);
    }
  }, [userId]);

  // Update learning style
  const updateLearningStyle = useCallback(async (style: LearningStyle) => {
    if (!userId) return;

    try {
      const response = await api.put<{ success: boolean; data: any }>(`/student-context/${userId}`, {
        learningStyle: style
      });

      if (response.data?.success) {
        setProfile(prev => prev ? { ...prev, learningStyle: style } : null);
      }
    } catch (err) {
      console.error('Failed to update learning style:', err);
    }
  }, [userId]);

  // Update preferences
  const updatePreferences = useCallback(async (preferences: {
    pace?: 'slow' | 'normal' | 'fast';
    difficulty?: 'easy' | 'medium' | 'hard';
  }) => {
    if (!userId) return;

    try {
      const response = await api.put<{ success: boolean; data: any }>(`/student-context/${userId}`, {
        preferredPace: preferences.pace,
        preferredDifficulty: preferences.difficulty
      });

      if (response.data?.success) {
        setProfile(prev => prev ? {
          ...prev,
          preferredPace: preferences.pace || prev.preferredPace,
          preferredDifficulty: preferences.difficulty || prev.preferredDifficulty
        } : null);
      }
    } catch (err) {
      console.error('Failed to update preferences:', err);
    }
  }, [userId]);

  // Update interests
  const updateInterests = useCallback(async (interests: string[]) => {
    if (!userId) return;

    try {
      const response = await api.put<{ success: boolean; data: any }>(`/student-context/${userId}`, {
        interests
      });

      if (response.data?.success) {
        setProfile(prev => prev ? { ...prev, interests } : null);
      }
    } catch (err) {
      console.error('Failed to update interests:', err);
    }
  }, [userId]);

  // Track lesson completion
  const trackLessonCompletion = useCallback(async (lessonId: string, score: number) => {
    if (!userId) return;

    try {
      await api.post(`/student-context/${userId}/activity`, {
        action: 'lesson_completed',
        metadata: {
          lessonId,
          score
        }
      });

      // Update local state
      setProfile(prev => prev ? {
        ...prev,
        completedLessons: prev.completedLessons + 1,
        points: prev.points + Math.floor(score * 10),
        averageScore: ((prev.averageScore * prev.completedLessons) + score) / (prev.completedLessons + 1)
      } : null);
    } catch (err) {
      console.error('Failed to track lesson completion:', err);
    }
  }, [userId]);

  // Get learning recommendations
  const getRecommendations = useCallback(async () => {
    if (!userId) return null;

    try {
      const response = await api.get<{ success: boolean; data: any }>(`/student-context/${userId}/recommendations`);

      if (response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (err) {
      console.error('Failed to get recommendations:', err);
      return null;
    }
  }, [userId]);

  // Calculate level from points
  const calculateLevel = useCallback((points: number) => {
    return Math.floor(points / 1000) + 1;
  }, []);

  // Get level progress (0-100)
  const getLevelProgress = useCallback(() => {
    if (!profile) return 0;
    return (profile.points % 1000) / 10;
  }, [profile]);

  // Get next level points
  const getNextLevelPoints = useCallback(() => {
    if (!profile) return 1000;
    return (profile.level * 1000);
  }, [profile]);

  // Check if student is on streak
  const isOnStreak = useCallback(() => {
    if (!profile) return false;
    const lastActiveDate = new Date(profile.lastActive);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastActiveDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1;
  }, [profile]);

  // Get weekly progress percentage
  const getWeeklyProgressPercentage = useCallback(() => {
    if (!profile) return 0;
    return Math.min(100, (profile.weeklyProgress / profile.weeklyGoal) * 100);
  }, [profile]);

  // Initial fetch
  useEffect(() => {
    fetchProfile();
    fetchProgressData();
  }, [fetchProfile, fetchProgressData]);

  // Refresh profile
  const refresh = useCallback(() => {
    fetchProfile();
    fetchProgressData();
  }, [fetchProfile, fetchProgressData]);

  return {
    // State
    profile,
    progressData,
    isLoading,
    error,

    // Actions
    updateLearningStyle,
    updatePreferences,
    updateInterests,
    trackLessonCompletion,
    getRecommendations,
    refresh,

    // Computed values
    calculateLevel,
    getLevelProgress,
    getNextLevelPoints,
    isOnStreak,
    getWeeklyProgressPercentage
  };
}