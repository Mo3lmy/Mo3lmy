import { Request, Response } from 'express';
import { z } from 'zod';
import { curriculumRAGService } from '../../../core/rag/curriculum-rag.service';
import { successResponse, errorResponse } from '../../../utils/response.utils';
import asyncHandler from 'express-async-handler';

// Extend Request type to include user with grade
interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: 'STUDENT' | 'TEACHER' | 'ADMIN';
    grade?: number;
  };
}

// Validation schemas
const explainConceptSchema = z.object({
  conceptId: z.string().uuid(),
  gradeLevel: z.number().min(1).max(12).optional(),
});

const explainFormulaSchema = z.object({
  formulaId: z.string().uuid(),
});

const getLessonInsightsSchema = z.object({
  lessonId: z.string().uuid(),
});

const generateAdaptiveContentSchema = z.object({
  lessonId: z.string().uuid(),
});

export class ExplainController {
  
  /**
   * @route   POST /api/v1/curriculum/explain/concept
   * @desc    Explain a concept in simple terms
   * @access  Private
   */
  explainConcept = asyncHandler(async (req: AuthRequest, res: Response) => {
    // Validate input
    const validated = explainConceptSchema.parse(req.body);
    
    // Get user's grade if not provided
    const gradeLevel = validated.gradeLevel || req.user?.grade || 6;
    
    // Get concept explanation
    const explanation = await curriculumRAGService.explainConcept(
      validated.conceptId,
      gradeLevel
    );
    
    res.json(
      successResponse(explanation, 'Concept explained successfully')
    );
  });
  
  /**
   * @route   POST /api/v1/curriculum/explain/formula
   * @desc    Explain a formula with examples
   * @access  Private
   */
  explainFormula = asyncHandler(async (req: AuthRequest, res: Response) => {
    // Validate input
    const validated = explainFormulaSchema.parse(req.body);
    
    // Get formula explanation
    const explanation = await curriculumRAGService.explainFormula(
      validated.formulaId
    );
    
    res.json(
      successResponse(explanation, 'Formula explained successfully')
    );
  });
  
  /**
   * @route   POST /api/v1/curriculum/insights
   * @desc    Get insights about a lesson
   * @access  Private
   */
  getLessonInsights = asyncHandler(async (req: AuthRequest, res: Response) => {
    // Validate input
    const validated = getLessonInsightsSchema.parse(req.body);
    
    // Get lesson insights
    const insights = await curriculumRAGService.getLessonInsights(
      validated.lessonId
    );
    
    res.json(
      successResponse(insights, 'Lesson insights generated')
    );
  });
  
  /**
   * @route   POST /api/v1/curriculum/adaptive
   * @desc    Generate adaptive content based on student performance
   * @access  Private
   */
  generateAdaptiveContent = asyncHandler(async (req: AuthRequest, res: Response) => {
    // Validate input
    const validated = generateAdaptiveContentSchema.parse(req.body);
    
    if (!req.user?.userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }
    
    // Generate adaptive content
    const content = await curriculumRAGService.generateAdaptiveContent(
      req.user.userId,
      validated.lessonId
    );
    
    res.json(
      successResponse(content, 'Adaptive content generated successfully')
    );
  });
  
  /**
   * @route   GET /api/v1/curriculum/simplify/:text
   * @desc    Simplify text for easier understanding
   * @access  Private
   */
  simplifyText = asyncHandler(async (req: AuthRequest, res: Response) => {
    const text = decodeURIComponent(req.params.text);
    const grade = parseInt(req.query.grade as string) || req.user?.grade || 6;
    
    if (!text || text.length < 10) {
      res.status(400).json(
        errorResponse('INVALID_INPUT', 'Text too short')
      );
      return;
    }
    
    // Simplify using AI
    const simplified = await curriculumRAGService.explainConcept(text, grade);
    
    res.json(
      successResponse(
        {
          original: text,
          simplified,
          gradeLevel: grade,
        },
        'Text simplified successfully'
      )
    );
  });
}

// Export controller instance
export const explainController = new ExplainController();