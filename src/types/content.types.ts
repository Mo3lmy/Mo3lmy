export interface LessonContent {
  fullText: string;
  summary: string;
  keyPoints: string[];
  examples: Example[];
  exercises: Exercise[];
}

export interface Example {
  id: string;
  title: string;
  description: string;
  code?: string;
  image?: string;
}

export interface Exercise {
  id: string;
  question: string;
  hint?: string;
  solution: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

export interface VideoScript {
  title: string;
  duration: number; // seconds
  sections: VideoSection[];
}

export interface VideoSection {
  id: string;
  type: 'intro' | 'content' | 'example' | 'summary';
  narration: string;
  visualElements: VisualElement[];
  duration: number;
}

export interface VisualElement {
  type: 'text' | 'image' | 'animation' | 'equation';
  content: string;
  style?: Record<string, any>;
  timing: {
    start: number;
    end: number;
  };
}