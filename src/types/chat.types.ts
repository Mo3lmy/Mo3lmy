export interface ChatSession {
  id: string;
  userId: string;
  lessonId?: string;
  startedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  context: ChatContext;
}

export interface ChatContext {
  lessonTitle?: string;
  subjectName?: string;
  grade?: number;
  recentTopics: string[];
  userLevel: 'beginner' | 'intermediate' | 'advanced';
  language: 'ar' | 'en';
  previousQuestions: string[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: ChatMessageMetadata;
}

export interface ChatMessageMetadata {
  intent?: 'question' | 'explanation' | 'example' | 'help' | 'greeting' | 'other';
  confidence?: number;
  sources?: string[];
  relatedLessons?: string[];
  suggestedActions?: SuggestedAction[];
  emotions?: 'confused' | 'frustrated' | 'happy' | 'neutral';
}

export interface SuggestedAction {
  type: 'watch_video' | 'take_quiz' | 'read_lesson' | 'ask_teacher' | 'practice';
  label: string;
  lessonId?: string;
  description?: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  lessonId?: string;
  context?: Partial<ChatContext>;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  metadata: ChatMessageMetadata;
  followUp?: string[];
}

export interface ChatAnalytics {
  totalSessions: number;
  totalMessages: number;
  averageMessagesPerSession: number;
  commonQuestions: {
    question: string;
    count: number;
    category: string;
  }[];
  userSatisfaction: number;
  responseTime: number;
  topTopics: string[];
}

export interface ConversationSummary {
  sessionId: string;
  userId: string;
  date: Date;
  duration: number;
  messageCount: number;
  topics: string[];
  questionsAsked: string[];
  questionsAnswered: number;
  conceptsExplained: string[];
  userSentiment: 'positive' | 'neutral' | 'negative';
  keyInsights: string[];
}