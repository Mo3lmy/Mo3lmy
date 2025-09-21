import { Request, Response } from 'express';
import { z } from 'zod';
import { quizService } from '../../../core/quiz/quiz.service';
import { curriculumRAGService } from '../../../core/rag/curriculum-rag.service';
import { successResponse, errorResponse } from '../../../utils/response.utils';
import asyncHandler from 'express-async-handler';

// Validation schemas
const generateQuizSchema = z.object({
  lessonId: z.string().uuid(),
  count: z.number().min(1).max(20).default(5),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  type: z.enum(['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'MIXED']).optional(),
});

const generateAdaptiveQuizSchema = z.object({
  lessonId: z.string().uuid(),
  count: z.number().min(1).max(20).default(5),
});

const regenerateQuestionSchema = z.object({
  questionId: z.string().uuid(),
  reason: z.string().optional(),
});

export class GenerateController {
  
  /**
   * @route   POST /api/v1/quiz/generate
   * @desc    Generate quiz questions for a lesson
   * @access  Private (Teacher/Admin)
   */
  generateQuiz = asyncHandler(async (req: Request, res: Response) => {
    // Validate input
    const validated = generateQuizSchema.parse(req.body);
    
    // Check authorization
    if (!['TEACHER', 'ADMIN'].includes(req.user?.role || '')) {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'Insufficient permissions')
      );
      return;
    }
    
    // Generate questions
    const questions = await quizService.generateQuizQuestions(
      validated.lessonId,
      validated.count,
      validated.difficulty
    );
    
    res.json(
      successResponse(
        {
          lessonId: validated.lessonId,
          questions,
          count: questions.length,
        },
        'Quiz questions generated successfully'
      )
    );
  });
  
  /**
   * @route   POST /api/v1/quiz/generate/adaptive
   * @desc    Generate adaptive quiz based on student performance
   * @access  Private
   */
  generateAdaptiveQuiz = asyncHandler(async (req: Request, res: Response) => {
    // Validate input
    const validated = generateAdaptiveQuizSchema.parse(req.body);
    
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    // Get adaptive content first
    const adaptiveContent = await curriculumRAGService.generateAdaptiveContent(
      req.user.userId,
      validated.lessonId
    );
    
    // Generate questions based on weak areas
    let difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM';
    
    if (adaptiveContent.personalizedContent.recommendedPace === 'slow') {
      difficulty = 'EASY';
    } else if (adaptiveContent.personalizedContent.recommendedPace === 'fast') {
      difficulty = 'HARD';
    }
    
    const questions = await quizService.generateQuizQuestions(
      validated.lessonId,
      validated.count,
      difficulty
    );
    
    res.json(
      successResponse(
        {
          lessonId: validated.lessonId,
          questions,
          adaptiveInfo: {
            difficulty,
            focusAreas: adaptiveContent.personalizedContent.focusAreas,
            recommendedPace: adaptiveContent.personalizedContent.recommendedPace,
          }
        },
        'Adaptive quiz generated successfully'
      )
    );
  });
  
  /**
   * @route   POST /api/v1/quiz/regenerate
   * @desc    Regenerate a specific question
   * @access  Private (Teacher/Admin)
   */
  regenerateQuestion = asyncHandler(async (req: Request, res: Response) => {
    // Validate input
    const validated = regenerateQuestionSchema.parse(req.body);
    
    // Check authorization
    if (!['TEACHER', 'ADMIN'].includes(req.user?.role || '')) {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'Insufficient permissions')
      );
      return;
    }
    
    // Get current question
    const currentQuestion = await prisma.question.findUnique({
      where: { id: validated.questionId },
      include: { lesson: true }
    });
    
    if (!currentQuestion) {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Question not found')
      );
      return;
    }
    
    // Generate new question
    const newQuestions = await quizService.generateQuizQuestions(
      currentQuestion.lessonId,
      1,
      currentQuestion.difficulty
    );
    
    if (newQuestions.length === 0) {
      res.status(500).json(
        errorResponse('GENERATION_FAILED', 'Could not generate new question')
      );
      return;
    }
    
    // Update the question
    const updatedQuestion = await prisma.question.update({
      where: { id: validated.questionId },
      data: {
        question: newQuestions[0].question,
        options: newQuestions[0].options ? JSON.stringify(newQuestions[0].options) : null,
        correctAnswer: newQuestions[0].correctAnswer,
        explanation: newQuestions[0].explanation,
      }
    });
    
    res.json(
      successResponse(updatedQuestion, 'Question regenerated successfully')
    );
  });
  
  /**
   * @route   GET /api/v1/quiz/templates
   * @desc    Get quiz templates
   * @access  Private (Teacher/Admin)
   */
  getQuizTemplates = asyncHandler(async (req: Request, res: Response) => {
    // Check authorization
    if (!['TEACHER', 'ADMIN'].includes(req.user?.role || '')) {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'Insufficient permissions')
      );
      return;
    }
    
    // Mock templates
    const templates = [
      {
        id: 'quick_assessment',
        name: 'تقييم سريع',
        description: '5 أسئلة متنوعة',
        config: {
          count: 5,
          types: ['MCQ', 'TRUE_FALSE'],
          timeLimit: 10,
        }
      },
      {
        id: 'comprehensive_test',
        name: 'اختبار شامل',
        description: '15 سؤال من جميع الأنواع',
        config: {
          count: 15,
          types: ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'],
          timeLimit: 30,
        }
      },
      {
        id: 'practice_quiz',
        name: 'اختبار تدريبي',
        description: '10 أسئلة مع شروحات',
        config: {
          count: 10,
          types: ['MCQ'],
          includeExplanations: true,
          allowRetries: true,
        }
      },
    ];
    
    res.json(
      successResponse(templates, 'Templates retrieved successfully')
    );
  });
}

// Export controller instance
export const generateController = new GenerateController();

// Import prisma for the controller
import { prisma } from '../../../config/database.config';