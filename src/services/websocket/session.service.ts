import { prisma } from '../../config/database.config';
import type { LearningSession } from '@prisma/client';

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
   * إنشاء أو استرجاع جلسة تعلم
   */
  async getOrCreateSession(
    userId: string, 
    lessonId: string, 
    socketId?: string
  ): Promise<LearningSession> {
    // ابحث عن جلسة نشطة موجودة
    const existingSession = await prisma.learningSession.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId
        }
      }
    });
    
    if (existingSession && existingSession.isActive) {
      // حدّث الـ socketId والوقت
      return await prisma.learningSession.update({
        where: { id: existingSession.id },
        data: {
          socketId,
          lastActivityAt: new Date()
        }
      });
    }
    
    // أنشئ جلسة جديدة
    return await prisma.learningSession.create({
      data: {
        userId,
        lessonId,
        socketId,
        currentSlide: 0,
        totalSlides: 0,
        chatHistory: '[]',
        slideHistory: '[0]',
        userPreferences: JSON.stringify({
          playbackSpeed: 1,
          autoPlay: true,
          fontSize: 'medium'
        })
      }
    });
  }
  
  /**
   * Get session by user and lesson (NEW METHOD)
   */
  async getSessionByUserAndLesson(
    userId: string, 
    lessonId: string
  ): Promise<LearningSession | null> {
    return await prisma.learningSession.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId
        }
      }
    });
  }
  
  /**
   * تحديث موضع الشريحة
   */
  async updateSlidePosition(
    sessionId: string, 
    slideNumber: number, 
    totalSlides?: number
  ): Promise<LearningSession | null> {
    const session = await prisma.learningSession.findUnique({
      where: { id: sessionId }
    });
    
    if (!session) return null;
    
    // أضف للـ history
    const history = JSON.parse(session.slideHistory || '[]');
    if (!history.includes(slideNumber)) {
      history.push(slideNumber);
    }
    
    return await prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        currentSlide: slideNumber,
        ...(totalSlides && { totalSlides }),
        slideHistory: JSON.stringify(history),
        lastActivityAt: new Date()
      }
    });
  }
  
  /**
   * حفظ رسالة في المحادثة
   */
  async addChatMessage(
    sessionId: string, 
    message: any
  ): Promise<LearningSession | null> {
    const session = await prisma.learningSession.findUnique({
      where: { id: sessionId }
    });
    
    if (!session) return null;
    
    const chatHistory = JSON.parse(session.chatHistory || '[]');
    chatHistory.push({
      ...message,
      timestamp: new Date().toISOString()
    });
    
    // احتفظ بآخر 100 رسالة فقط
    if (chatHistory.length > 100) {
      chatHistory.splice(0, chatHistory.length - 100);
    }
    
    return await prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        chatHistory: JSON.stringify(chatHistory),
        lastActivityAt: new Date()
      }
    });
  }
  
  /**
   * إنهاء الجلسة
   */
  async endSession(sessionId: string): Promise<LearningSession> {
    return await prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        completedAt: new Date()
      }
    });
  }
  
  /**
   * تنظيف الجلسات القديمة
   */
  async cleanupInactiveSessions(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const result = await prisma.learningSession.updateMany({
      where: {
        isActive: true,
        lastActivityAt: {
          lt: oneHourAgo
        }
      },
      data: {
        isActive: false
      }
    });
    
    return result.count;
  }
  
  /**
   * استرجاع آخر جلسة نشطة للمستخدم
   */
  async getLastActiveSession(userId: string) {
    return await prisma.learningSession.findFirst({
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
            unit: {
              select: {
                title: true,
                subject: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });
  }
}

// Export singleton
export const sessionService = new SessionService();