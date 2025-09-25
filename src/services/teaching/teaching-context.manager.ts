// src/services/teaching/teaching-context.manager.ts
// الوظيفة: إدارة السياق والذاكرة للشرح التعليمي

import { Redis } from 'ioredis';
import { config } from '../../config';

export interface TeachingMemory {
  lessonId: string;
  slideId: string;
  script: string;
  keyPoints: string[];
  examples?: string[];
  timestamp: number;
  studentLevel: 'primary' | 'prep' | 'secondary';
  interactionCount: number; // كم مرة الطالب تفاعل
}

export interface SessionContext {
  lessonId: string;
  currentSlideIndex: number;
  totalSlides: number;
  coveredTopics: string[];
  studentQuestions: string[];
  lastExplanation?: string;
  startTime: number;
}

/**
 * مدير السياق التعليمي - بسيط وفعال
 */
export class TeachingContextManager {
  private memory: Map<string, TeachingMemory>;
  private sessions: Map<string, SessionContext>;
  private redis?: Redis;
  
  constructor() {
    this.memory = new Map();
    this.sessions = new Map();
    
    // Optional Redis for persistence
    if (config.REDIS_URL && config.USE_CACHE) {
      this.redis = new Redis(config.REDIS_URL);
      console.log('✅ Teaching Context: Redis connected');
    } else {
      console.log('📝 Teaching Context: Using in-memory only');
    }
  }
  
  // ========== SESSION MANAGEMENT ==========
  
  /**
   * بداية جلسة تعليمية جديدة
   */
  startSession(
    userId: string, 
    lessonId: string, 
    totalSlides: number
  ): string {
    const sessionId = `${userId}:${lessonId}:${Date.now()}`;
    
    this.sessions.set(sessionId, {
      lessonId,
      currentSlideIndex: 0,
      totalSlides,
      coveredTopics: [],
      studentQuestions: [],
      startTime: Date.now()
    });
    
    console.log(`📚 Started teaching session: ${sessionId}`);
    return sessionId;
  }
  
  /**
   * تحديث السياق الحالي للجلسة
   */
  updateSession(sessionId: string, updates: Partial<SessionContext>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    this.sessions.set(sessionId, {
      ...session,
      ...updates
    });
  }
  
  /**
   * جيب سياق الجلسة
   */
  getSession(sessionId: string): SessionContext | null {
    return this.sessions.get(sessionId) || null;
  }
  
  // ========== MEMORY MANAGEMENT ==========
  
  /**
   * احفظ شرح الشريحة في الذاكرة
   */
  async saveExplanation(
    sessionId: string,
    slideId: string,
    explanation: {
      script: string;
      keyPoints: string[];
      examples?: string[];
      studentLevel: 'primary' | 'prep' | 'secondary';
    }
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const memoryKey = `${session.lessonId}:${slideId}`;
    
    // Save to memory
    const memory: TeachingMemory = {
      lessonId: session.lessonId,
      slideId,
      script: explanation.script,
      keyPoints: explanation.keyPoints,
      examples: explanation.examples,
      timestamp: Date.now(),
      studentLevel: explanation.studentLevel,
      interactionCount: 0
    };
    
    this.memory.set(memoryKey, memory);
    
    // Update session
    session.lastExplanation = explanation.script;
    if (explanation.keyPoints.length > 0) {
      session.coveredTopics.push(...explanation.keyPoints);
    }
    
    // Optional: Save to Redis for persistence
    if (this.redis) {
      await this.redis.setex(
        `teaching:${memoryKey}`,
        3600, // 1 hour cache
        JSON.stringify(memory)
      );
    }
  }
  
  /**
   * جيب آخر شرح للشريحة
   */
  async getLastExplanation(
    lessonId: string,
    slideId: string
  ): Promise<TeachingMemory | null> {
    const memoryKey = `${lessonId}:${slideId}`;
    
    // Check memory first
    if (this.memory.has(memoryKey)) {
      return this.memory.get(memoryKey)!;
    }
    
    // Check Redis if available
    if (this.redis) {
      const cached = await this.redis.get(`teaching:${memoryKey}`);
      if (cached) {
        const memory = JSON.parse(cached) as TeachingMemory;
        this.memory.set(memoryKey, memory); // Restore to memory
        return memory;
      }
    }
    
    return null;
  }
  
  /**
   * جيب السياق السابق (آخر 3 شرائح)
   */
  getPreviousContext(sessionId: string): TeachingMemory[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    
    const previousMemories: TeachingMemory[] = [];
    
    // Get last 3 slides from memory
    for (const [key, memory] of this.memory.entries()) {
      if (memory.lessonId === session.lessonId) {
        previousMemories.push(memory);
      }
    }
    
    // Sort by timestamp and take last 3
    return previousMemories
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);
  }
  
  // ========== INTERACTION TRACKING ==========
  
  /**
   * سجل تفاعل الطالب
   */
  recordInteraction(
    sessionId: string,
    slideId: string,
    interactionType: 'question' | 'example_request' | 'repeat' | 'practice'
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Track in session
    session.studentQuestions.push(`${slideId}:${interactionType}`);
    
    // Update memory interaction count
    const memoryKey = `${session.lessonId}:${slideId}`;
    const memory = this.memory.get(memoryKey);
    if (memory) {
      memory.interactionCount++;
      this.memory.set(memoryKey, memory);
    }
  }
  
  /**
   * هل الطالب محتاج مساعدة؟ (based on interactions)
   */
  needsHelp(sessionId: string, slideId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    const memoryKey = `${session.lessonId}:${slideId}`;
    const memory = this.memory.get(memoryKey);
    
    // If student interacted 3+ times with same slide
    return memory ? memory.interactionCount >= 3 : false;
  }
  
  // ========== CONTINUITY HELPERS ==========
  
  /**
   * بناء جملة ربط مع الشرح السابق
   */
  buildContinuityPhrase(sessionId: string): string {
    const previousContext = this.getPreviousContext(sessionId);
    
    if (previousContext.length === 0) {
      return '';
    }
    
    const lastContext = previousContext[0];
    const keyPoint = lastContext.keyPoints[0] || '';
    
    const phrases = [
      `زي ما شرحنا في الجزء اللي فات عن ${keyPoint}...`,
      `فاكر لما قولنا ${keyPoint}؟ دلوقتي هنكمل...`,
      `بناءً على اللي فهمناه عن ${keyPoint}...`,
      `احنا اتكلمنا عن ${keyPoint}، النهاردة هنشوف...`
    ];
    
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
  
  // ========== CLEANUP ==========
  
  /**
   * نظف الذاكرة القديمة
   */
  cleanupOldMemory(maxAgeMinutes: number = 60): number {
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000;
    let cleaned = 0;
    
    // Clean memory
    for (const [key, memory] of this.memory.entries()) {
      if (now - memory.timestamp > maxAge) {
        this.memory.delete(key);
        cleaned++;
      }
    }
    
    // Clean sessions
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.startTime > maxAge) {
        this.sessions.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} old memory entries`);
    }
    
    return cleaned;
  }
  
  /**
   * احصائيات الذاكرة
   */
  getStats(): {
    activeSessions: number;
    memoryEntries: number;
    totalInteractions: number;
  } {
    let totalInteractions = 0;
    
    for (const memory of this.memory.values()) {
      totalInteractions += memory.interactionCount;
    }
    
    return {
      activeSessions: this.sessions.size,
      memoryEntries: this.memory.size,
      totalInteractions
    };
  }
}

// Export singleton instance
export const teachingContext = new TeachingContextManager();