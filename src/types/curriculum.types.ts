// Curriculum Types for RAG System
export interface CurriculumSearchQuery {
  query: string;
  subjectId?: string;
  unitId?: string;
  lessonId?: string;
  grade?: number;
  limit?: number;
  includeExamples?: boolean;
  includeFormulas?: boolean;
}

export interface CurriculumSearchResult {
  id: string;
  type: 'lesson' | 'concept' | 'example' | 'formula';
  title: string;
  content: string;
  relevanceScore: number;
  metadata: {
    lessonId?: string;
    lessonTitle?: string;
    unitTitle?: string;
    subjectName?: string;
    grade?: number;
    difficulty?: string;
    tags?: string[];
  };
  highlights?: string[];
}

export interface ConceptExplanation {
  conceptId: string;
  conceptName: string;
  simpleExplanation: string;
  detailedExplanation: string;
  examples: ConceptExample[];
  relatedConcepts: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  gradeLevel: number;
}

export interface ConceptExample {
  id: string;
  title: string;
  description: string;
  solution?: string;
  visualAid?: string;
  category: 'real_life' | 'mathematical' | 'scientific' | 'practical';
}

export interface FormulaExplanation {
  id: string;
  formula: string;
  variables: {
    symbol: string;
    meaning: string;
    unit?: string;
  }[];
  usage: string;
  examples: {
    input: Record<string, number>;
    output: number;
    explanation: string;
  }[];
}

export interface CurriculumInsight {
  lessonId: string;
  insights: {
    mainTopics: string[];
    keySkills: string[];
    prerequisites: string[];
    learningObjectives: string[];
    commonMisconceptions: string[];
    studyTips: string[];
  };
  estimatedStudyTime: number; // in minutes
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

export interface AdaptiveContent {
  userId: string;
  lessonId: string;
  personalizedContent: {
    summary: string;
    focusAreas: string[];
    skipTopics: string[];
    additionalExercises: string[];
    recommendedPace: 'slow' | 'normal' | 'fast';
  };
  basedOn: {
    previousPerformance: number;
    learningStyle?: string;
    weakAreas: string[];
    strongAreas: string[];
  };
}

export interface CurriculumRAGResponse {
  query: string;
  answer: string;
  confidence: number;
  sources: CurriculumSearchResult[];
  suggestions?: string[];
  relatedQuestions?: string[];
  visualAids?: {
    type: 'image' | 'diagram' | 'chart';
    url: string;
    caption: string;
  }[];
}