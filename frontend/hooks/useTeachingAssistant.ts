import { useState, useCallback } from 'react';
import api from '@/services/api';

// Types for Teaching Assistant
export type InteractionType =
  | 'explain'
  | 'more_detail'
  | 'example'
  | 'problem'
  | 'repeat'
  | 'continue'
  | 'stop'
  | 'quiz'
  | 'summary'
  | 'motivate'
  | 'simplify'
  | 'application';

interface TeachingScript {
  script: string;
  duration: number;
  keyPoints?: string[];
  examples?: string[];
  problem?: {
    question: string;
    solution: string;
    hints?: string[];
  };
  visualCues?: string[];
  interactionPoints?: string[];
  emotionalTone?: string;
  nextSuggestions?: string[];
  audioUrl?: string;
}

interface SlideContent {
  type?: string;
  title?: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  quiz?: any;
  metadata?: any;
}

interface TeachingOptions {
  voiceStyle?: 'friendly' | 'formal' | 'energetic';
  paceSpeed?: 'slow' | 'normal' | 'fast';
  useAnalogies?: boolean;
  useStories?: boolean;
  needMoreDetail?: boolean;
  needExample?: boolean;
  needProblem?: boolean;
  problemDifficulty?: 'easy' | 'medium' | 'hard';
}

interface InteractionResponse {
  message: string;
  type: string;
  suggestions?: string[];
  example?: string;
  problem?: {
    question: string;
    solution: string;
    hints?: string[];
  };
  visualization?: string;
  additionalContent?: string;
}

export function useTeachingAssistant(lessonId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentScript, setCurrentScript] = useState<TeachingScript | null>(null);
  const [interactionHistory, setInteractionHistory] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // Generate teaching script for slide content
  const generateScript = useCallback(async (
    slideContent: SlideContent,
    options?: TeachingOptions
  ): Promise<TeachingScript | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: TeachingScript; message?: string }>(
        `/lessons/${lessonId}/teaching/script`,
        {
          slideContent,
          generateVoice: true,
          options
        }
      );

      if (response.data?.success) {
        const script = response.data.data;
        setCurrentScript(script);

        // Add to interaction history
        if (script.script) {
          setInteractionHistory(prev => [...prev, script.script]);
        }

        return script;
      } else {
        throw new Error(response.data?.message || 'Failed to generate script');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate teaching script';
      setError(errorMessage);
      console.error('Teaching script generation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [lessonId]);

  // Handle student interaction
  const handleInteraction = useCallback(async (
    type: InteractionType,
    context?: {
      currentSlide?: SlideContent;
      previousScript?: string;
    }
  ): Promise<InteractionResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: InteractionResponse; message?: string }>(
        `/lessons/${lessonId}/teaching/interaction`,
        {
          type,
          currentSlide: context?.currentSlide,
          context: {
            previousScript: context?.previousScript || currentScript?.script,
            sessionHistory: interactionHistory.slice(-5) // Last 5 interactions
          }
        }
      );

      if (response.data?.success) {
        const interaction = response.data.data;

        // Add to interaction history
        if (interaction.message) {
          setInteractionHistory(prev => [...prev, interaction.message]);
        }

        return interaction;
      } else {
        throw new Error(response.data?.message || 'Failed to process interaction');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process interaction';
      setError(errorMessage);
      console.error('Interaction error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, currentScript, interactionHistory]);

  // Play voice narration
  const playVoice = useCallback(async (audioUrl?: string) => {
    if (!audioUrl && !currentScript?.audioUrl) {
      setError('No audio available');
      return;
    }

    const url = audioUrl || currentScript?.audioUrl;
    if (!url) return;

    setIsPlaying(true);

    try {
      const audio = new Audio(url);

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setError('Failed to play audio');
        setIsPlaying(false);
      });

      await audio.play();
    } catch (err) {
      console.error('Voice playback error:', err);
      setError('Failed to play voice');
      setIsPlaying(false);
    }
  }, [currentScript]);

  // Stop voice narration
  const stopVoice = useCallback(() => {
    // In a real implementation, we'd keep track of the audio element
    // For now, we just update the state
    setIsPlaying(false);
  }, []);

  // Generate problem based on current content
  const generateProblem = useCallback(async (
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: any; message?: string }>(
        `/lessons/${lessonId}/teaching/problem`,
        {
          difficulty,
          currentSlide: currentScript
        }
      );

      if (response.data?.success) {
        return response.data.data;
      } else {
        throw new Error(response.data?.message || 'Failed to generate problem');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate problem';
      setError(errorMessage);
      console.error('Problem generation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, currentScript]);

  // Clear interaction history
  const clearHistory = useCallback(() => {
    setInteractionHistory([]);
    setCurrentScript(null);
    setError(null);
  }, []);

  // Get teaching statistics
  const getStats = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: any }>(`/lessons/${lessonId}/teaching/stats`);

      if (response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (err) {
      console.error('Failed to get teaching stats:', err);
      return null;
    }
  }, [lessonId]);

  return {
    // State
    isLoading,
    error,
    currentScript,
    interactionHistory,
    isPlaying,

    // Actions
    generateScript,
    handleInteraction,
    playVoice,
    stopVoice,
    generateProblem,
    clearHistory,
    getStats
  };
}