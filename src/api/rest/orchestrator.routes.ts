// الوظيفة: REST API endpoints للـ Orchestrator

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import { lessonOrchestrator } from '../../services/orchestrator/lesson-orchestrator.service';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { validateBody, validateParams } from '../middleware/validation.middleware';

const router = Router();

/**
 * @route   GET /api/v1/orchestrator/lessons/:lessonId/flow
 * @desc    Get lesson flow structure
 * @access  Private
 */
router.get(
  '/lessons/:lessonId/flow',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const userId = req.user!.userId;
    
    try {
      // Check if flow exists
      const flowKey = `${userId}-${lessonId}`;
      // Note: This would need a method to get flow from orchestrator
      
      res.json(
        successResponse({
          lessonId,
          hasActiveFlow: false,
          message: 'Use WebSocket for real-time orchestration'
        }, 'Flow status retrieved')
      );
    } catch (error) {
      res.status(500).json(
        errorResponse('FLOW_ERROR', 'Failed to get flow')
      );
    }
  })
);

/**
 * @route   POST /api/v1/orchestrator/lessons/:lessonId/action
 * @desc    Trigger an action in the lesson flow
 * @access  Private
 */
router.post(
  '/lessons/:lessonId/action',
  authenticate,
  validateParams(z.object({ lessonId: z.string().uuid() })),
  validateBody(z.object({
    action: z.enum(['explain', 'example', 'quiz', 'simplify', 'video', 'generate_slide']),
    context: z.string().optional(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const { action, context } = req.body;
    const userId = req.user!.userId;
    
    try {
      const result = await lessonOrchestrator.processUserMessage(
        userId,
        lessonId,
        context || action
      );
      
      res.json(
        successResponse({
          action,
          result,
          message: 'Action processed. Check WebSocket for updates.'
        }, 'Action triggered')
      );
    } catch (error: any) {
      res.status(500).json(
        errorResponse('ACTION_FAILED', error.message || 'Action failed')
      );
    }
  })
);

/**
 * @route   GET /api/v1/orchestrator/lessons/:lessonId/sections
 * @desc    Get lesson sections structure
 * @access  Private
 */
router.get(
  '/lessons/:lessonId/sections',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    
    // This would normally get the sections from orchestrator
    // For now, return a message to use WebSocket
    
    res.json(
      successResponse({
        lessonId,
        message: 'Connect via WebSocket and call start_orchestrated_lesson for full sections'
      }, 'Use WebSocket for real-time sections')
    );
  })
);

/**
 * @route   POST /api/v1/orchestrator/lessons/:lessonId/navigate
 * @desc    Navigate in lesson (backup for WebSocket)
 * @access  Private
 */
router.post(
  '/lessons/:lessonId/navigate',
  authenticate,
  validateBody(z.object({
    direction: z.enum(['next', 'previous', 'goto']),
    target: z.union([z.number(), z.string()]).optional(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId } = req.params;
    const { direction, target } = req.body;
    const userId = req.user!.userId;
    
    res.json(
      successResponse({
        lessonId,
        direction,
        target,
        message: 'Use WebSocket for real-time navigation'
      }, 'Navigation command received')
    );
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
        features: [
          'Smart lesson flow',
          'Dynamic slide generation',
          'Action detection',
          'Context-aware responses',
          'Real-time adaptation'
        ],
        websocketRequired: true,
        message: 'Orchestrator is active. Connect via WebSocket for full functionality.'
      }, 'Orchestrator status')
    );
  })
);

export default router;