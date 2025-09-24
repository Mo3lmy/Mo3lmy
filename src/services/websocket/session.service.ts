// 📍 المكان: src/services/websocket/session.service.ts
// ✨ النسخة المُصلحة - تحل مشكلة Unique constraint

import { prisma } from '../../config/database.config';
import type { LearningSession } from '@prisma/client';

// ============= TYPES =============

// Extended session with relations
export interface ExtendedSession extends LearningSession {
  lesson?: {
    id: string;
    title: string;
    titleAr?: string | null;
    unit?: {
      title: string;
      subject?: {
        name: string;
        nameAr?: string | null;
      };
    };
  };
}

// Session data structure
interface SessionData {
  currentSlide: number;
  totalSlides: number;
  chatHistory: any[];
  slideHistory: number[];
  userPreferences: {
    playbackSpeed: number;
    autoPlay: boolean;
    fontSize: string;
  };
}

export class SessionService {
  
  /**
   * 🔧 إنشاء أو استرجاع جلسة تعلم - محلولة المشكلة
   */
  async getOrCreateSession(
    userId: string, 
    lessonId: string, 
    socketId?: string
  ): Promise<ExtendedSession> {
    try {
      // 🔍 البحث عن أي جلسة موجودة (نشطة أو غير نشطة)
      const existingSession = await prisma.learningSession.findFirst({
        where: {
          userId,
          lessonId
          // ❌ إزالة شرط isActive لنجد أي session موجودة
        }
      });
      
      if (existingSession) {
        // ✅ تحديث الجلسة الموجودة وتفعيلها
        const updated = await prisma.learningSession.update({
          where: { id: existingSession.id },
          data: {
            socketId: socketId || null,
            isActive: true,  // تفعيل الجلسة
            lastActivityAt: new Date(),
            // إعادة تعيين completedAt إذا كانت الجلسة منتهية
            completedAt: null
          }
        });
        
        console.log(`✅ Session reactivated: ${updated.id}`);
        return this.mapToExtendedSession(updated);
      }
      
      // 🆕 إنشاء جلسة جديدة فقط إذا لم توجد أي جلسة
      const newSession = await prisma.learningSession.create({
        data: {
          userId,
          lessonId,
          socketId: socketId || null,
          currentSlide: 0,
          totalSlides: 0,
          isActive: true,
          startedAt: new Date(),
          lastActivityAt: new Date(),
          chatHistory: JSON.stringify([]),
          slideHistory: JSON.stringify([0]),
          userPreferences: JSON.stringify({
            playbackSpeed: 1,
            autoPlay: true,
            fontSize: 'medium'
          })
        }
      });
      
      console.log(`✅ New session created: ${newSession.id}`);
      return this.mapToExtendedSession(newSession);
      
    } catch (error: any) {
      // 🔧 معالجة خطأ الـ unique constraint
      if (error.code === 'P2002') {
        console.log('⚠️ Unique constraint error - trying to recover...');
        
        // محاولة إيجاد الجلسة الموجودة وتحديثها
        const fallbackSession = await prisma.learningSession.findFirst({
          where: { userId, lessonId }
        });
        
        if (fallbackSession) {
          const updated = await prisma.learningSession.update({
            where: { id: fallbackSession.id },
            data: {
              socketId: socketId || null,
              isActive: true,
              lastActivityAt: new Date(),
              completedAt: null
            }
          });
          
          console.log(`✅ Session recovered after error: ${updated.id}`);
          return this.mapToExtendedSession(updated);
        }
      }
      
      console.error('❌ Session creation/update failed:', error);
      
      // Fallback: return minimal session object
      return {
        id: `temp-${Date.now()}`,
        userId,
        lessonId,
        socketId: socketId || null,
        currentSlide: 0,
        totalSlides: 0,
        isActive: true,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: null,
        chatHistory: '[]',
        slideHistory: '[0]',
        userPreferences: JSON.stringify({
          playbackSpeed: 1,
          autoPlay: true,
          fontSize: 'medium'
        })
      } as ExtendedSession;
    }
  }
  
  /**
   * 🔧 Helper function to map to ExtendedSession
   */
  private mapToExtendedSession(session: LearningSession): ExtendedSession {
    return {
      ...session,
      // Extended properties will be added when including relations
    } as ExtendedSession;
  }
  
  /**
   * Get session by user and lesson
   */
  async getSessionByUserAndLesson(
    userId: string, 
    lessonId: string
  ): Promise<LearningSession | null> {
    try {
      const session = await prisma.learningSession.findFirst({
        where: {
          userId,
          lessonId,
          isActive: true
        },
        orderBy: {
          lastActivityAt: 'desc'
        }
      });
      
      return session;
    } catch (error) {
      console.error('❌ Failed to get session:', error);
      return null;
    }
  }
  
  /**
   * تحديث موضع الشريحة
   */
  async updateSlidePosition(
    sessionId: string, 
    slideNumber: number, 
    totalSlides?: number
  ): Promise<LearningSession | null> {
    try {
      const session = await prisma.learningSession.findUnique({
        where: { id: sessionId }
      });
      
      if (!session) {
        console.warn(`⚠️ Session not found: ${sessionId}`);
        return null;
      }
      
      // Update slide history
      const history = JSON.parse(session.slideHistory || '[]');
      if (!history.includes(slideNumber)) {
        history.push(slideNumber);
      }
      
      const updated = await prisma.learningSession.update({
        where: { id: sessionId },
        data: {
          currentSlide: slideNumber,
          ...(totalSlides !== undefined && { totalSlides }),
          slideHistory: JSON.stringify(history),
          lastActivityAt: new Date()
        }
      });
      
      console.log(`📝 Slide position updated: session=${sessionId}, slide=${slideNumber}`);
      return updated;
      
    } catch (error) {
      console.error('❌ Failed to update slide position:', error);
      return null;
    }
  }
  
  /**
   * حفظ رسالة في المحادثة
   */
  async addChatMessage(
    sessionId: string, 
    message: any
  ): Promise<LearningSession | null> {
    try {
      const session = await prisma.learningSession.findUnique({
        where: { id: sessionId }
      });
      
      if (!session) {
        console.warn(`⚠️ Session not found: ${sessionId}`);
        return null;
      }
      
      const chatHistory = JSON.parse(session.chatHistory || '[]');
      chatHistory.push({
        ...message,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 100 messages
      if (chatHistory.length > 100) {
        chatHistory.splice(0, chatHistory.length - 100);
      }
      
      const updated = await prisma.learningSession.update({
        where: { id: sessionId },
        data: {
          chatHistory: JSON.stringify(chatHistory),
          lastActivityAt: new Date()
        }
      });
      
      return updated;
      
    } catch (error) {
      console.error('❌ Failed to add chat message:', error);
      return null;
    }
  }
  
  /**
   * إنهاء الجلسة
   */
  async endSession(sessionId: string): Promise<LearningSession | null> {
    try {
      const ended = await prisma.learningSession.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          completedAt: new Date(),
          socketId: null
        }
      });
      
      console.log(`📝 Session ended: ${sessionId}`);
      return ended;
      
    } catch (error) {
      console.error('❌ Failed to end session:', error);
      return null;
    }
  }
  
  /**
   * 🔧 تنظيف الجلسات القديمة - محسّن
   */
  async cleanupInactiveSessions(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Mark inactive sessions
      const result = await prisma.learningSession.updateMany({
        where: {
          isActive: true,
          lastActivityAt: {
            lt: oneHourAgo
          }
        },
        data: {
          isActive: false,
          completedAt: new Date()
        }
      });
      
      if (result.count > 0) {
        console.log(`🧹 Cleaned up ${result.count} inactive sessions`);
      }
      
      // 🆕 حذف الجلسات القديمة جداً (أكثر من 24 ساعة)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deleted = await prisma.learningSession.deleteMany({
        where: {
          isActive: false,
          completedAt: {
            lt: oneDayAgo
          }
        }
      });
      
      if (deleted.count > 0) {
        console.log(`🗑️ Deleted ${deleted.count} old sessions`);
      }
      
      return result.count + deleted.count;
      
    } catch (error) {
      console.error('❌ Failed to cleanup sessions:', error);
      return 0;
    }
  }
  
  /**
   * استرجاع آخر جلسة نشطة للمستخدم
   */
  async getLastActiveSession(userId: string): Promise<ExtendedSession | null> {
    try {
      const session = await prisma.learningSession.findFirst({
        where: {
          userId,
          isActive: true
        },
        orderBy: {
          lastActivityAt: 'desc'
        },
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              titleAr: true,
              unit: {
                select: {
                  title: true,
                  subject: {
                    select: {
                      name: true,
                      nameAr: true
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      if (!session) {
        return null;
      }
      
      // Return as ExtendedSession
      return {
        ...session,
        lesson: session.lesson ? {
          id: session.lesson.id,
          title: session.lesson.title,
          titleAr: session.lesson.titleAr,
          unit: session.lesson.unit ? {
            title: session.lesson.unit.title,
            subject: session.lesson.unit.subject ? {
              name: session.lesson.unit.subject.name,
              nameAr: session.lesson.unit.subject.nameAr
            } : undefined
          } : undefined
        } : undefined
      } as ExtendedSession;
      
    } catch (error) {
      console.error('❌ Failed to get last active session:', error);
      return null;
    }
  }
  
  /**
   * Get all active sessions for a user
   */
  async getUserActiveSessions(userId: string): Promise<LearningSession[]> {
    try {
      const sessions = await prisma.learningSession.findMany({
        where: {
          userId,
          isActive: true
        },
        orderBy: {
          lastActivityAt: 'desc'
        },
        take: 10
      });
      
      return sessions;
      
    } catch (error) {
      console.error('❌ Failed to get user sessions:', error);
      return [];
    }
  }
  
  /**
   * Update session preferences
   */
  async updatePreferences(
    sessionId: string,
    preferences: Partial<{
      playbackSpeed: number;
      autoPlay: boolean;
      fontSize: string;
    }>
  ): Promise<LearningSession | null> {
    try {
      const session = await prisma.learningSession.findUnique({
        where: { id: sessionId }
      });
      
      if (!session) {
        return null;
      }
      
      const currentPrefs = JSON.parse(session.userPreferences || '{}');
      const updatedPrefs = { ...currentPrefs, ...preferences };
      
      const updated = await prisma.learningSession.update({
        where: { id: sessionId },
        data: {
          userPreferences: JSON.stringify(updatedPrefs),
          lastActivityAt: new Date()
        }
      });
      
      return updated;
      
    } catch (error) {
      console.error('❌ Failed to update preferences:', error);
      return null;
    }
  }
  
  /**
   * Get session statistics
   */
  async getSessionStats(sessionId: string): Promise<any> {
    try {
      const session = await prisma.learningSession.findUnique({
        where: { id: sessionId }
      });
      
      if (!session) {
        return null;
      }
      
      const chatHistory = JSON.parse(session.chatHistory || '[]');
      const slideHistory = JSON.parse(session.slideHistory || '[]');
      const preferences = JSON.parse(session.userPreferences || '{}');
      
      const duration = session.completedAt
        ? session.completedAt.getTime() - session.startedAt.getTime()
        : Date.now() - session.startedAt.getTime();
      
      return {
        sessionId: session.id,
        userId: session.userId,
        lessonId: session.lessonId,
        duration: Math.floor(duration / 1000), // seconds
        slidesViewed: slideHistory.length,
        currentSlide: session.currentSlide,
        totalSlides: session.totalSlides,
        messagesCount: chatHistory.length,
        preferences,
        isActive: session.isActive,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt,
        completedAt: session.completedAt
      };
      
    } catch (error) {
      console.error('❌ Failed to get session stats:', error);
      return null;
    }
  }
  
  /**
   * Resume a session
   */
  async resumeSession(sessionId: string, socketId: string): Promise<LearningSession | null> {
    try {
      const session = await prisma.learningSession.update({
        where: { id: sessionId },
        data: {
          socketId,
          isActive: true,
          lastActivityAt: new Date(),
          completedAt: null
        }
      });
      
      console.log(`📝 Session resumed: ${sessionId}`);
      return session;
      
    } catch (error) {
      console.error('❌ Failed to resume session:', error);
      return null;
    }
  }
  
  /**
   * 🆕 Force clean duplicate sessions
   */
  async cleanDuplicateSessions(userId: string, lessonId: string): Promise<number> {
    try {
      // Get all sessions for this user/lesson
      const sessions = await prisma.learningSession.findMany({
        where: { userId, lessonId },
        orderBy: { lastActivityAt: 'desc' }
      });
      
      if (sessions.length <= 1) {
        return 0;
      }
      
      // Keep the most recent, delete the rest
      const toDelete = sessions.slice(1).map(s => s.id);
      
      const deleted = await prisma.learningSession.deleteMany({
        where: {
          id: { in: toDelete }
        }
      });
      
      console.log(`🧹 Cleaned ${deleted.count} duplicate sessions`);
      return deleted.count;
      
    } catch (error) {
      console.error('❌ Failed to clean duplicates:', error);
      return 0;
    }
  }
}

// Export singleton
export const sessionService = new SessionService();

// Also export Session type for compatibility
export type Session = LearningSession;