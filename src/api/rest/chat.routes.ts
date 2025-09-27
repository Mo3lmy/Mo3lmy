import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { chatService } from '../../services/ai/chat.service';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';

const router = Router();

// Validation schemas
const sendMessageSchema = z.object({
  message: z.string().min(1).max(1000),
  sessionId: z.string().optional(),
  lessonId: z.string().optional(),
  context: z.object({
    language: z.enum(['ar', 'en']).optional(),
  }).optional(),
});

const chatHistorySchema = z.object({
  lessonId: z.string().optional(),
  sessionId: z.string().optional(),
  limit: z.string().default('50').transform(Number).pipe(z.number().min(1).max(100)),
});

/**
 * @route   POST /api/v1/chat/message
 * @desc    Send message to AI assistant
 * @access  Private
 */
router.post(
  '/message',
  authenticate,
  validateBody(sendMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const response = await chatService.processMessage(
      req.body.message,
      req.body.context || {},
      req.user!.userId,
      req.body.sessionId
    );

    res.json(
      successResponse(response, 'Message processed successfully')
    );
  })
);

/**
 * @route   GET /api/v1/chat/history
 * @desc    Get chat history
 * @access  Private
 */
router.get(
  '/history',
  authenticate,
  validateQuery(chatHistorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId, sessionId, limit } = req.query as any;

    const history = await chatService.getChatHistory(
      req.user!.userId,
      lessonId,
      limit,
      sessionId
    );

    res.json(
      successResponse(history, 'Chat history retrieved')
    );
  })
);

/**
 * @route   GET /api/v1/chat/session/:sessionId/summary
 * @desc    Get conversation summary
 * @access  Private
 */
router.get(
  '/session/:sessionId/summary',
  authenticate,
  validateParams(z.object({ sessionId: z.string().min(1) })),
  asyncHandler(async (req: Request, res: Response) => {
    const summary = await chatService.getConversationSummary(
      req.params.sessionId
    );
    
    if (!summary) {
      res.status(404).json(
        errorResponse('SESSION_NOT_FOUND', 'Session not found')
      );
      return;
    }
    
    res.json(
      successResponse(summary, 'Summary retrieved')
    );
  })
);

/**
 * @route   POST /api/v1/chat/feedback
 * @desc    Submit feedback for a message
 * @access  Private
 */
router.post(
  '/feedback',
  authenticate,
  validateBody(z.object({
    messageId: z.string().min(1),
    rating: z.number().min(1).max(5),
    feedback: z.string().optional(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    // Store feedback (simplified for now)
    console.log('Feedback received:', req.body);
    
    res.json(
      successResponse(null, 'Feedback submitted')
    );
  })
);

/**
 * @route   GET /api/v1/chat/suggestions
 * @desc    Get chat suggestions based on context
 * @access  Private
 */
router.get(
  '/suggestions',
  authenticate,
  validateQuery(z.object({
    lessonId: z.string().optional(),
    slideIndex: z.string().optional().transform(Number),
    currentTopic: z.string().optional(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { lessonId, slideIndex, currentTopic } = req.query as any;

    const suggestions = await chatService.generateSmartSuggestions(
      req.user!.userId,
      lessonId,
      slideIndex,
      currentTopic
    );

    res.json(
      successResponse(suggestions, 'Smart suggestions retrieved')
    );
  })
);

export default router;