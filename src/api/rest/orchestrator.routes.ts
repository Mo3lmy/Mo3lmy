// الوظيفة: REST API endpoints للـ Orchestrator مع دعم كامل للتحكم

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import { lessonOrchestrator } from '../../services/orchestrator/lesson-orchestrator.service';
import { sessionService } from '../../services/websocket/session.service';
import { prisma } from '../../config/database.config';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';

const router = Router();

// ============= LESSON MANAGEMENT ENDPOINTS =============

/**
 * @route   POST /api/v1/orchestrator/lessons/:lessonId/start
 * @desc    Start a new orchestrated lesson session
 * @access  Private
 */
router.post(
  '/lessons/:lessonId/start',
  authenticate,
  validateParams(z.object({ 
    lessonId: z.string() 
  })),
  validateBody(z.object({
    mode: z.enum(['chat_only', 'slides_only', 'slides_with_voice', 'interactive']).optional(),
    startWithChat: z.boolean().optional(),
    preferences: z.object({
      autoAdvance: z.boolean().optional(),
      voiceEnabled: z.boolean().optional(),
      playbackSpeed: z.number().min(0.5).max(2).optional(),
      progressiveReveal: z.boolean().optional(),
      revealDelay: z.number().min(1).max(10).optional()
    }).optional()
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const { mode, startWithChat, preferences } = req.body;
    const userId = req.user!.userId;
    try {
      // Verify lesson exists
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          unit: {
            include: {
              subject: true
            }
          }
        }
      });
      if (!lesson) {
        res.status(404).json(
          errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
        );
        return;
      }
      // Get or create session
      const session = await sessionService.getOrCreateSession(
        userId,
        lessonId,
        'rest-api' // Use special identifier for REST API
      );
      // Start lesson flow
      const flow = await lessonOrchestrator.startLesson(
        userId,
        lessonId,
        session.id,
        {
          mode: mode || 'interactive',
          autoAdvance: preferences?.autoAdvance ?? true,
          voiceEnabled: preferences?.voiceEnabled ?? false,
          progressiveReveal: preferences?.progressiveReveal ?? true
        }
      );
      res.json(
        successResponse({
          flowId: flow.id,
          lessonId: flow.lessonId,
          sessionId: session.id,
          mode: flow.mode,
          totalSlides: flow.totalSlides,
          sections: flow.sections.map(s => ({
            id: s.id,
            type: s.type,
            title: s.title,
            slideCount: s.slides.length,
            duration: s.duration
          })),
          currentSection: flow.currentSection,
          currentSlide: flow.currentSlide,
          estimatedDuration: flow.estimatedDuration,
          isMathLesson: flow.isMathLesson,
          startWithChat,
          message: startWithChat ? 
            'الدرس بدأ بالمحادثة. استخدم endpoint /chat للتفاعل' :
            'الدرس بدأ. استخدم endpoints التنقل للتحكم'
        }, 'تم بدء الدرس بنجاح')
      );
    } catch (error: any) {
      res.status(500).json(
        errorResponse('START_FAILED', error.message || 'فشل بدء الدرس')
      );
    }
  })
);

/**
 * @route   GET /api/v1/orchestrator/lessons/:lessonId/flow
 * @desc    Get current lesson flow state
 * @access  Private
 */
router.get(
  '/lessons/:lessonId/flow',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const userId = req.user!.userId;
    
    try {
      // Get flow from orchestrator (need to expose this method)
      const flow = lessonOrchestrator.getFlow(userId, lessonId);
      
      if (!flow) {
        res.status(404).json(
          errorResponse('NO_ACTIVE_FLOW', 'لا يوجد درس نشط')
        );
        return;
      }
      
      res.json(
        successResponse({
          flowId: flow.id,
          lessonId: flow.lessonId,
          mode: flow.mode,
          isPaused: flow.isPaused,
          isPresenting: flow.isPresenting,
          currentSection: {
            index: flow.currentSection,
            ...flow.sections[flow.currentSection]
          },
          currentSlide: flow.currentSlide,
          totalSlides: flow.totalSlides,
          progressiveState: flow.progressiveState,
          conversationState: {
            isActive: flow.conversationState.isActive,
            currentContext: flow.conversationState.currentContext,
            messageCount: flow.conversationState.messageHistory.length
          },
          comprehensionLevel: flow.comprehensionLevel,
          engagementScore: flow.engagementScore,
          questionsAsked: flow.questionsAsked,
          timeElapsed: Math.floor((Date.now() - flow.startTime.getTime()) / 1000),
          settings: {
            autoAdvance: flow.autoAdvance,
            voiceEnabled: flow.voiceEnabled,
            playbackSpeed: flow.playbackSpeed,
            progressiveReveal: flow.progressiveReveal,
            revealDelay: flow.revealDelay
          }
        }, 'حالة الدرس')
      );
    } catch (error: any) {
      res.status(500).json(
        errorResponse('FLOW_ERROR', error.message || 'فشل جلب حالة الدرس')
      );
    }
  })
);

// ============= CONTROL ENDPOINTS =============

/**
 * @route   POST /api/v1/orchestrator/lessons/:lessonId/control
 * @desc    Control presentation (pause/resume/restart/speed)
 * @access  Private
 */
router.post(
  '/lessons/:lessonId/control',
  authenticate,
  validateBody(z.object({
    action: z.enum(['pause', 'resume', 'restart', 'skip_point', 'repeat_point']),
    speed: z.number().min(0.5).max(2).optional()
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const { action, speed } = req.body;
    const userId = req.user!.userId;
    
    try {
      const flow = lessonOrchestrator.getFlow(userId, lessonId);
      if (!flow) {
        res.status(404).json(
          errorResponse('NO_ACTIVE_FLOW', 'لا يوجد درس نشط')
        );
        return;
      }
      
      let result: any = {};
      
      switch (action) {
        case 'pause':
          await lessonOrchestrator.pausePresentation(flow);
          result = { isPaused: true, message: 'تم إيقاف العرض' };
          break;
          
        case 'resume':
          await lessonOrchestrator.resumePresentation(flow);
          result = { isPaused: false, message: 'تم استئناف العرض' };
          break;
          
        case 'restart':
          await lessonOrchestrator.presentSlideProgressive(flow, flow.currentSlide);
          result = { restarted: true, currentSlide: flow.currentSlide };
          break;
          
        case 'skip_point':
          // Skip to next progressive point
       const currentSectionSlides = flow.sections[flow.currentSection]?.slides;
      const currentSlidePoints = currentSectionSlides?.[0]?.points;
      if (currentSlidePoints && flow.progressiveState.currentPointIndex < currentSlidePoints.length - 1) {
        flow.progressiveState.currentPointIndex++;
        result = { skipped: true, newPointIndex: flow.progressiveState.currentPointIndex };
      }
      break;
          
        case 'repeat_point':
          // Repeat current point (implementation needed)
          result = { repeated: true, pointIndex: flow.progressiveState.currentPointIndex };
          break;
      }
      
      // Update speed if provided
      if (speed !== undefined) {
        flow.playbackSpeed = speed;
        flow.revealDelay = 3 / speed;
        result.speedUpdated = speed;
      }
      
      res.json(successResponse(result, 'تم التحكم بنجاح'));
      
    } catch (error: any) {
      res.status(500).json(
        errorResponse('CONTROL_FAILED', error.message || 'فشل التحكم')
      );
    }
  })
);

// ============= NAVIGATION ENDPOINTS =============

/**
 * @route   POST /api/v1/orchestrator/lessons/:lessonId/navigate
 * @desc    Navigate between slides
 * @access  Private
 */
router.post(
  '/lessons/:lessonId/navigate',
  authenticate,
  validateBody(z.object({
    direction: z.enum(['next', 'previous', 'first', 'last', 'goto']),
    target: z.number().optional()
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const { direction, target } = req.body;
    const userId = req.user!.userId;
    
    try {
      let slide = null;
      
      switch (direction) {
        case 'next':
          slide = await lessonOrchestrator.navigateNext(userId, lessonId);
          break;
          
        case 'previous':
          slide = await lessonOrchestrator.navigatePrevious(userId, lessonId);
          break;
          
        case 'first':
          slide = await lessonOrchestrator.jumpToSlide(userId, lessonId, 0);
          break;
          
        case 'last':
          const flow = lessonOrchestrator.getFlow(userId, lessonId);
          if (flow) {
            slide = await lessonOrchestrator.jumpToSlide(userId, lessonId, flow.totalSlides - 1);
          }
          break;
          
        case 'goto':
          if (target !== undefined) {
            slide = await lessonOrchestrator.jumpToSlide(userId, lessonId, target);
          }
          break;
      }
      
      if (!slide && direction === 'next') {
        res.json(
          successResponse({
            completed: true,
            message: 'انتهى الدرس!'
          }, 'الدرس مكتمل')
        );
        return;
      }
      
      if (slide) {
        res.json(
          successResponse({
            slideNumber: slide.number,
            type: slide.type,
            hasContent: !!slide.content,
            hasHtml: !!slide.html,
            duration: slide.duration,
            isMathSlide: slide.isMathSlide,
            hasProgressivePoints: !!slide.points,
            pointCount: slide.points?.length || 0
          }, 'تم الانتقال')
        );
      } else {
        res.status(400).json(
          errorResponse('NAVIGATION_FAILED', 'فشل الانتقال')
        );
      }
      
    } catch (error: any) {
      res.status(500).json(
        errorResponse('NAVIGATION_ERROR', error.message || 'خطأ في التنقل')
      );
    }
  })
);

// ============= CHAT ENDPOINTS =============

/**
 * @route   POST /api/v1/orchestrator/lessons/:lessonId/chat
 * @desc    Send chat message and process action
 * @access  Private
 */
router.post(
  '/lessons/:lessonId/chat',
  authenticate,
  validateBody(z.object({
    message: z.string().min(1).max(1000)
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const { message } = req.body;
    const userId = req.user!.userId;
    
    try {
      // Process message through orchestrator
      const action = await lessonOrchestrator.processUserMessage(
        userId,
        lessonId,
        message
      );
      
      let response: any = {
        messageReceived: true,
        message
      };
      
      if (action) {
        response.actionDetected = true;
        response.action = {
          type: action.action,
          trigger: action.trigger,
          confidence: action.confidence,
          mathRelated: action.mathRelated
        };
        
        if (action.confidence > 0.7) {
          response.actionExecuted = true;
          response.message = `تم تنفيذ الإجراء: ${action.action}`;
        } else {
          response.actionSuggested = true;
          response.message = 'هل تريد تنفيذ هذا الإجراء؟';
        }
      }
      
      // Note: The actual AI response would come through WebSocket
      response.note = 'الرد الكامل سيصل عبر WebSocket أو استخدم /chat-sync للرد المتزامن';
      
      res.json(successResponse(response, 'تمت معالجة الرسالة'));
      
    } catch (error: any) {
      res.status(500).json(
        errorResponse('CHAT_FAILED', error.message || 'فشل معالجة الرسالة')
      );
    }
  })
);

/**
 * @route   POST /api/v1/orchestrator/lessons/:lessonId/chat-sync
 * @desc    Send chat message and get synchronous response (slower)
 * @access  Private
 */
router.post(
  '/lessons/:lessonId/chat-sync',
  authenticate,
  validateBody(z.object({
    message: z.string().min(1).max(1000)
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const { message } = req.body;
    const userId = req.user!.userId;
    
    try {
      // Process message
      const action = await lessonOrchestrator.processUserMessage(
        userId,
        lessonId,
        message
      );
      
      // Get flow state for context
      const flow = lessonOrchestrator.getFlow(userId, lessonId);
      
      if (!flow) {
        res.status(404).json(
          errorResponse('NO_ACTIVE_FLOW', 'لا يوجد درس نشط')
        );
        return;
      }
      
      // Here you would integrate with AI service for response
      // For now, return a structured response
      const aiResponse = `سأساعدك في فهم ${flow.sections[flow.currentSection].title}. ${
        action ? `لاحظت أنك تريد ${action.action}.` : ''
      }`;
      
      res.json(
        successResponse({
          userMessage: message,
          aiResponse,
          action: action ? {
            type: action.action,
            confidence: action.confidence,
            executed: action.confidence > 0.7
          } : null,
          context: {
            currentSection: flow.sections[flow.currentSection].title,
            currentSlide: flow.currentSlide,
            comprehensionLevel: flow.comprehensionLevel
          }
        }, 'تم الرد')
      );
      
    } catch (error: any) {
      res.status(500).json(
        errorResponse('CHAT_SYNC_FAILED', error.message || 'فشل الرد')
      );
    }
  })
);

// ============= ACTION ENDPOINTS =============

/**
 * @route   POST /api/v1/orchestrator/lessons/:lessonId/action
 * @desc    Trigger specific action
 * @access  Private
 */
router.post(
  '/lessons/:lessonId/action',
  authenticate,
  validateBody(z.object({
    action: z.enum(['explain_more', 'show_example', 'start_quiz', 'simplify', 
                    'show_video', 'generate_slide', 'show_math', 'solve_equation']),
    context: z.string().optional(),
    confidence: z.number().min(0).max(1).optional()
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const { action, context, confidence } = req.body;
    const userId = req.user!.userId;
    
    try {
      // Create action trigger
      const actionTrigger = {
        trigger: context || `طلب ${action}`,
        action: action as any,
        confidence: confidence || 1.0,
        mathRelated: ['show_math', 'solve_equation'].includes(action)
      };
      
      // Execute action through orchestrator
      const result = await lessonOrchestrator.executeAction(
        lessonOrchestrator.getFlow(userId, lessonId)!,
        actionTrigger
      );
      
      res.json(
        successResponse({
          action,
          executed: true,
          context,
          message: `تم تنفيذ ${action} بنجاح`,
          note: 'تحقق من WebSocket للحصول على التحديثات'
        }, 'تم تنفيذ الإجراء')
      );
      
    } catch (error: any) {
      res.status(500).json(
        errorResponse('ACTION_FAILED', error.message || 'فشل تنفيذ الإجراء')
      );
    }
  })
);

// ============= STATISTICS ENDPOINTS =============

/**
 * @route   GET /api/v1/orchestrator/lessons/:lessonId/stats
 * @desc    Get lesson statistics
 * @access  Private
 */
router.get(
  '/lessons/:lessonId/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const userId = req.user!.userId;
    
    try {
      const flow = lessonOrchestrator.getFlow(userId, lessonId);
      
      if (!flow) {
        // Try to get from database
        const session = await sessionService.getSessionByUserAndLesson(userId, lessonId);
        
        if (!session) {
          res.status(404).json(
            errorResponse('NO_SESSION', 'لا توجد جلسة للدرس')
          );
          return;
        }
        
        res.json(
          successResponse({
            lessonId,
            sessionId: session.id,
            currentSlide: session.currentSlide,
            totalSlides: session.totalSlides,
            lastActivity: session.lastActivityAt,
            isActive: session.isActive,
            completed: !!session.completedAt
          }, 'إحصائيات الجلسة')
        );
        return;
      }
      
      // Calculate statistics from active flow
      const elapsedMinutes = Math.floor((Date.now() - flow.startTime.getTime()) / 60000);
      const progressPercentage = (flow.currentSlide / flow.totalSlides) * 100;
      const sectionsCompleted = flow.sections.filter(s => s.completed).length;
      
      res.json(
        successResponse({
          lessonId,
          flowId: flow.id,
          progress: {
            currentSlide: flow.currentSlide + 1,
            totalSlides: flow.totalSlides,
            percentage: Math.round(progressPercentage),
            currentSection: flow.sections[flow.currentSection].title,
            sectionsCompleted,
            totalSections: flow.sections.length
          },
          engagement: {
            comprehensionLevel: flow.comprehensionLevel,
            engagementScore: flow.engagementScore,
            questionsAsked: flow.questionsAsked,
            interruptionCount: flow.interruptionCount
          },
          time: {
            elapsedMinutes,
            estimatedRemaining: Math.max(0, flow.estimatedDuration - elapsedMinutes),
            startTime: flow.startTime,
            lastInteraction: flow.lastInteractionTime
          },
          mathStats: flow.isMathLesson ? {
            problemsAttempted: flow.mathProblemsAttempted || 0,
            problemsSolved: flow.mathProblemsSolved || 0
          } : null
        }, 'إحصائيات الدرس')
      );
      
    } catch (error: any) {
      res.status(500).json(
        errorResponse('STATS_ERROR', error.message || 'فشل جلب الإحصائيات')
      );
    }
  })
);

// ============= UTILITY ENDPOINTS =============

/**
 * @route   DELETE /api/v1/orchestrator/lessons/:lessonId/end
 * @desc    End lesson session
 * @access  Private
 */
router.delete(
  '/lessons/:lessonId/end',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const userId = req.user!.userId;
    
    try {
      const flow = lessonOrchestrator.getFlow(userId, lessonId);
      
      if (flow) {
        await lessonOrchestrator.completeLessonFlow(flow);
      }
      
      // End database session
      const session = await sessionService.getSessionByUserAndLesson(userId, lessonId);
      if (session) {
        await sessionService.endSession(session.id);
      }
      
      res.json(
        successResponse({
          lessonId,
          ended: true,
          message: 'تم إنهاء الدرس بنجاح'
        }, 'انتهى الدرس')
      );
      
    } catch (error: any) {
      res.status(500).json(
        errorResponse('END_FAILED', error.message || 'فشل إنهاء الدرس')
      );
    }
  })
);

/**
 * @route   GET /api/v1/orchestrator/status
 * @desc    Get orchestrator service status
 * @access  Private
 */
router.get(
  '/status',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    res.json(
      successResponse({
        service: 'orchestrator',
        status: 'active',
        version: '2.0',
        features: {
          smartFlow: true,
          progressiveReveal: true,
          conversationIntegration: true,
          mathSupport: true,
          actionDetection: true,
          restApiSupport: true
        },
        endpoints: {
          start: 'POST /lessons/:id/start',
          control: 'POST /lessons/:id/control',
          navigate: 'POST /lessons/:id/navigate',
          chat: 'POST /lessons/:id/chat',
          stats: 'GET /lessons/:id/stats',
          flow: 'GET /lessons/:id/flow',
          end: 'DELETE /lessons/:id/end'
        },
        note: 'للتجربة الكاملة، استخدم WebSocket. REST API يوفر تحكم أساسي.'
      }, 'Orchestrator Status')
    );
  })
);

export default router;