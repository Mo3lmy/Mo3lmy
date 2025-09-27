import { useState, useCallback, useEffect } from 'react';
import api from '@/services/api';

export type EmotionalState = 'happy' | 'neutral' | 'frustrated' | 'confused' | 'tired';
export type ConfidenceLevel = number; // 0-100
export type EngagementLevel = number; // 0-100

interface EmotionalIndicator {
  type: 'click' | 'time' | 'error' | 'success' | 'idle' | 'fast_interaction';
  value: any;
  timestamp: number;
}

interface EmotionalData {
  mood: EmotionalState;
  confidence: ConfidenceLevel;
  engagement: EngagementLevel;
  lastUpdate: Date;
  sessionDuration: number;
  errorCount: number;
  successCount: number;
  needsBreak: boolean;
  needsSupport: boolean;
}

interface SupportSuggestion {
  type: 'break' | 'help' | 'motivation' | 'simplification';
  message: string;
  action?: () => void;
}

export function useEmotionalIntelligence(userId: string) {
  const [emotionalData, setEmotionalData] = useState<EmotionalData>({
    mood: 'neutral',
    confidence: 70,
    engagement: 70,
    lastUpdate: new Date(),
    sessionDuration: 0,
    errorCount: 0,
    successCount: 0,
    needsBreak: false,
    needsSupport: false
  });

  const [suggestions, setSuggestions] = useState<SupportSuggestion[]>([]);
  const [isTracking, setIsTracking] = useState(true);
  const [sessionStartTime] = useState(Date.now());
  const [recentIndicators, setRecentIndicators] = useState<EmotionalIndicator[]>([]);

  // Track session duration
  useEffect(() => {
    const interval = setInterval(() => {
      const duration = Math.floor((Date.now() - sessionStartTime) / 1000 / 60); // minutes

      setEmotionalData(prev => ({
        ...prev,
        sessionDuration: duration,
        needsBreak: duration > 0 && duration % 30 === 0 // Suggest break every 30 minutes
      }));

      // Check if needs break
      if (duration > 0 && duration % 30 === 0) {
        setSuggestions(prev => [
          ...prev.filter(s => s.type !== 'break'),
          {
            type: 'break',
            message: 'حان وقت استراحة قصيرة! خذ 5 دقائق للراحة والعودة بنشاط أكثر.'
          }
        ]);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Track emotional indicators
  const trackIndicator = useCallback((indicator: EmotionalIndicator) => {
    if (!isTracking) return;

    setRecentIndicators(prev => {
      const newIndicators = [...prev, indicator].slice(-20); // Keep last 20 indicators
      return newIndicators;
    });

    // Analyze patterns
    analyzeEmotionalPattern(indicator);
  }, [isTracking]);

  // Analyze emotional patterns
  const analyzeEmotionalPattern = useCallback((indicator: EmotionalIndicator) => {
    setEmotionalData(prev => {
      let newData = { ...prev };
      let newSuggestions: SupportSuggestion[] = [];

      // Update based on indicator type
      switch (indicator.type) {
        case 'error':
          newData.errorCount++;
          newData.confidence = Math.max(0, prev.confidence - 5);

          if (newData.errorCount >= 3) {
            newData.mood = 'frustrated';
            newData.needsSupport = true;
            newSuggestions.push({
              type: 'help',
              message: 'يبدو أنك تواجه صعوبة. هل تريد شرحاً أبسط أو مثالاً توضيحياً؟'
            });
          }
          break;

        case 'success':
          newData.successCount++;
          newData.confidence = Math.min(100, prev.confidence + 3);
          newData.engagement = Math.min(100, prev.engagement + 2);

          if (newData.successCount >= 5 && newData.mood !== 'happy') {
            newData.mood = 'happy';
            newSuggestions.push({
              type: 'motivation',
              message: 'أحسنت! أداؤك رائع، استمر على هذا المستوى!'
            });
          }
          break;

        case 'idle':
          newData.engagement = Math.max(0, prev.engagement - 10);

          if (newData.engagement < 30) {
            newData.mood = 'tired';
            newSuggestions.push({
              type: 'break',
              message: 'هل تشعر بالتعب؟ يمكنك أخذ استراحة قصيرة.'
            });
          }
          break;

        case 'fast_interaction':
          newData.engagement = Math.min(100, prev.engagement + 5);
          if (newData.mood === 'tired') {
            newData.mood = 'neutral';
          }
          break;

        case 'time':
          // Long time on same content might indicate confusion
          if (indicator.value > 300) { // More than 5 minutes
            newData.mood = 'confused';
            newData.needsSupport = true;
            newSuggestions.push({
              type: 'simplification',
              message: 'هل المحتوى صعب؟ يمكنني تبسيطه لك.'
            });
          }
          break;
      }

      // Update suggestions
      if (newSuggestions.length > 0) {
        setSuggestions(prev => [...prev, ...newSuggestions].slice(-3)); // Keep last 3 suggestions
      }

      newData.lastUpdate = new Date();
      return newData;
    });
  }, []);

  // Track activity (user action)
  const trackActivity = useCallback((action: string, success: boolean = true) => {
    trackIndicator({
      type: success ? 'success' : 'error',
      value: action,
      timestamp: Date.now()
    });
  }, [trackIndicator]);

  // Update emotional state manually
  const updateEmotionalState = useCallback(async (state: Partial<EmotionalData>) => {
    setEmotionalData(prev => ({
      ...prev,
      ...state,
      lastUpdate: new Date()
    }));

    // Send to backend
    try {
      await api.post(`/student-context/${userId}/emotional-state`, {
        mood: state.mood || emotionalData.mood,
        confidence: state.confidence || emotionalData.confidence,
        engagement: state.engagement || emotionalData.engagement,
        indicators: recentIndicators
      });
    } catch (error) {
      console.error('Failed to update emotional state:', error);
    }
  }, [userId, emotionalData, recentIndicators]);

  // Get current emotional state
  const getCurrentState = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: any }>(`/student-context/${userId}/emotional-state`);

      if (response.data?.success) {
        const data = response.data.data;
        setEmotionalData(prev => ({
          ...prev,
          mood: data.mood || prev.mood,
          confidence: data.confidence || prev.confidence,
          engagement: data.engagement || prev.engagement
        }));
      }
    } catch (error) {
      console.error('Failed to get emotional state:', error);
    }
  }, [userId]);

  // Get suggestions based on current state
  const getSuggestions = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: any[] }>(`/student-context/${userId}/recommendations`);

      if (response.data?.success) {
        const recommendations = response.data.data;
        const newSuggestions: SupportSuggestion[] = recommendations.map((rec: any) => ({
          type: rec.type || 'help',
          message: rec.message
        }));
        setSuggestions(newSuggestions);
      }
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    }
  }, [userId]);

  // Report user activity
  const reportActivity = useCallback(async (action: string, metadata?: any) => {
    trackIndicator({
      type: 'click',
      value: { action, metadata },
      timestamp: Date.now()
    });

    // Send activity to backend for analysis
    try {
      await api.post(`/student-context/${userId}/activity`, {
        action,
        metadata,
        emotionalState: emotionalData.mood,
        confidence: emotionalData.confidence,
        engagement: emotionalData.engagement,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to report activity:', error);
    }
  }, [userId, emotionalData, trackIndicator]);

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  // Toggle tracking
  const toggleTracking = useCallback(() => {
    setIsTracking(prev => !prev);
  }, []);

  // Get mood emoji
  const getMoodEmoji = useCallback(() => {
    switch (emotionalData.mood) {
      case 'happy': return '😊';
      case 'neutral': return '😐';
      case 'frustrated': return '😤';
      case 'confused': return '😕';
      case 'tired': return '😴';
      default: return '😐';
    }
  }, [emotionalData.mood]);

  return {
    // State
    emotionalData,
    suggestions,
    isTracking,

    // Actions
    trackIndicator,
    trackActivity,
    updateEmotionalState,
    getCurrentState,
    getSuggestions,
    reportActivity,
    clearSuggestions,
    toggleTracking,

    // Helpers
    getMoodEmoji
  };
}