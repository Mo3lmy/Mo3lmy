// الوظيفة: ربط Orchestrator مع WebSocket events

import { Socket } from 'socket.io';
import { lessonOrchestrator } from '../orchestrator/lesson-orchestrator.service';
import { websocketService } from './websocket.service';
import { sessionService } from './session.service';
import { realtimeChatService } from './realtime-chat.service';

/**
 * إضافة Event Handlers للـ Orchestrator
 */
export function setupOrchestratorEvents(socket: Socket, user: any): void {
  
  // ============= LESSON FLOW EVENTS =============
  
  /**
   * بدء درس بنظام Orchestration الذكي
   */
  socket.on('start_orchestrated_lesson', async (data: {
    lessonId: string;
    preferences?: {
      autoAdvance?: boolean;
      voiceEnabled?: boolean;
      playbackSpeed?: number;
    };
  }) => {
    try {
      console.log(`🎯 Starting orchestrated lesson for ${user.email}`);
      
      // Get or create session
      const session = await sessionService.getOrCreateSession(
        user.id,
        data.lessonId,
        socket.id
      );
      
      // Start orchestration
      const flow = await lessonOrchestrator.startLesson(
        user.id,
        data.lessonId,
        session.id
      );
      
      // Apply preferences
      if (data.preferences) {
        Object.assign(flow, data.preferences);
      }
      
      // Send initial state
      socket.emit('lesson_flow_started', {
        lessonId: flow.lessonId,
        totalSlides: flow.totalSlides,
        sections: flow.sections.map(s => ({
          id: s.id,
          type: s.type,
          title: s.title,
          slideCount: s.slides.length,
          duration: s.duration,
          objectives: s.objectives
        })),
        currentSection: flow.sections[flow.currentSection],
        currentSlide: flow.currentSlide,
        estimatedDuration: flow.estimatedDuration,
        theme: flow.theme
      });
      
      // Send first slide
      const firstSlide = flow.sections[0].slides[0];
      if (firstSlide.html) {
        socket.emit('slide_ready', {
          slideNumber: 0,
          html: firstSlide.html,
          type: firstSlide.type,
          duration: firstSlide.duration,
          section: flow.sections[0].title
        });
      }
      
      console.log(`✅ Orchestrated lesson started: ${flow.totalSlides} slides`);
      
    } catch (error: any) {
      console.error('Failed to start orchestrated lesson:', error);
      socket.emit('error', {
        code: 'ORCHESTRATION_FAILED',
        message: 'فشل بدء الدرس التفاعلي'
      });
    }
  });
  
  /**
   * التنقل الذكي بين الشرائح
   */
  socket.on('navigate_smart', async (data: {
    lessonId: string;
    direction: 'next' | 'previous' | 'section' | 'slide';
    target?: number | string; // رقم الشريحة أو معرف القسم
  }) => {
    try {
      let slide = null;
      
      switch (data.direction) {
        case 'next':
          slide = await lessonOrchestrator.navigateNext(user.id, data.lessonId);
          break;
          
        case 'previous':
          // Implement previous navigation
          break;
          
        case 'section':
          // Jump to section
          break;
          
        case 'slide':
          // Jump to specific slide
          break;
      }
      
      if (slide && slide.html) {
        socket.emit('slide_ready', {
          slideNumber: slide.number,
          html: slide.html,
          type: slide.type,
          duration: slide.duration
        });
      } else if (!slide) {
        socket.emit('lesson_completed', {
          lessonId: data.lessonId
        });
      }
      
    } catch (error) {
      socket.emit('navigation_error', {
        message: 'فشل الانتقال'
      });
    }
  });
  
  /**
   * معالجة رسالة مع تحليل الإجراءات
   */
  socket.on('chat_with_action', async (data: {
    lessonId: string;
    message: string;
  }) => {
    try {
      console.log(`💬 Chat with action analysis: "${data.message}"`);
      
      // Process message and get action
      const action = await lessonOrchestrator.processUserMessage(
        user.id,
        data.lessonId,
        data.message
      );
      
      // Send chat response first
      await realtimeChatService.handleUserMessage(
        user.id,
        data.lessonId,
        data.message,
        socket.id
      );
      
      // Notify about action if detected
      if (action && action.confidence > 0.7) {
        socket.emit('action_detected', {
          action: action.action,
          trigger: action.trigger,
          confidence: action.confidence,
          executing: true
        });
        
        // Action will be executed by orchestrator
        console.log(`🎬 Action "${action.action}" executed with ${action.confidence} confidence`);
      }
      
    } catch (error: any) {
      console.error('Chat action processing failed:', error);
      socket.emit('chat_error', {
        message: 'فشل معالجة الرسالة'
      });
    }
  });
  
  /**
   * طلب إجراء مباشر
   */
  socket.on('request_action', async (data: {
    lessonId: string;
    action: 'explain' | 'example' | 'quiz' | 'simplify' | 'video';
    context?: string;
  }) => {
    try {
      console.log(`🎯 Direct action requested: ${data.action}`);
      
      // Create action trigger
      const actionTrigger = {
        trigger: data.context || `طلب ${data.action}`,
        action: (() => {
          switch (data.action) {
            case 'explain': return 'explain_more';
            case 'example': return 'show_example';
            case 'quiz': return 'start_quiz';
            case 'simplify': return 'simplify';
            case 'video': return 'show_video';
            default: return 'generate_slide';
          }
        })() as any,
        confidence: 1.0
      };
      
      // Process action
      const result = await lessonOrchestrator.processUserMessage(
        user.id,
        data.lessonId,
        actionTrigger.trigger
      );
      
      socket.emit('action_completed', {
        action: data.action,
        success: !!result
      });
      
    } catch (error) {
      socket.emit('action_error', {
        action: data.action,
        message: 'فشل تنفيذ الإجراء'
      });
    }
  });
  
  /**
   * تحديث مستوى الفهم
   */
  socket.on('update_comprehension', async (data: {
    lessonId: string;
    level: 'low' | 'medium' | 'high';
  }) => {
    // Update flow comprehension level
    // This affects content difficulty and pacing
    socket.emit('comprehension_updated', {
      level: data.level,
      message: `تم تعديل مستوى الشرح ليناسب ${
        data.level === 'low' ? 'المبتدئين' :
        data.level === 'medium' ? 'المستوى المتوسط' :
        'المستوى المتقدم'
      }`
    });
  });
  
  /**
   * تتبع تفاعل المستخدم
   */
  socket.on('track_interaction', async (data: {
    lessonId: string;
    slideNumber: number;
    interaction: {
      type: 'click' | 'hover' | 'focus' | 'quiz_answer';
      element?: string;
      value?: any;
      duration?: number;
    };
  }) => {
    // Track for analytics
    console.log(`📊 Interaction tracked: ${data.interaction.type} on slide ${data.slideNumber}`);
    
    // Could affect engagement score
  });
  
  /**
   * طلب معلومات عن التقدم
   */
  socket.on('get_lesson_progress', async (data: {
    lessonId: string;
  }) => {
    // Get current flow state
    socket.emit('lesson_progress', {
      lessonId: data.lessonId,
      currentSlide: 0, // From flow
      totalSlides: 0,  // From flow
      sectionsCompleted: 0,
      totalSections: 0,
      estimatedTimeRemaining: 0,
      questionsAsked: 0,
      engagementScore: 0
    });
  });
  
  /**
   * Control lesson flow
   */
  socket.on('control_flow', async (data: {
    lessonId: string;
    action: 'pause' | 'resume' | 'restart' | 'skip_section';
  }) => {
    console.log(`⏸️ Flow control: ${data.action}`);
    
    switch (data.action) {
      case 'pause':
        // Pause auto-advance
        break;
      case 'resume':
        // Resume auto-advance
        break;
      case 'restart':
        // Restart lesson
        break;
      case 'skip_section':
        // Skip to next section
        break;
    }
    
    socket.emit('flow_control_updated', {
      action: data.action,
      success: true
    });
  });
}

/**
 * Helper: Broadcast slide to all in lesson
 */
export function broadcastSlideToLesson(
  lessonId: string,
  slide: any,
  excludeUserId?: string
): void {
  websocketService.sendToLesson(lessonId, 'shared_slide_update', {
    slide,
    sharedBy: excludeUserId
  });
}

/**
 * Helper: Send section change notification
 */
export function notifySectionChange(
  userId: string,
  lessonId: string,
  section: any
): void {
  websocketService.sendToUser(userId, 'section_started', {
    lessonId,
    section: {
      id: section.id,
      title: section.title,
      type: section.type,
      objectives: section.objectives,
      estimatedDuration: section.duration
    }
  });
}