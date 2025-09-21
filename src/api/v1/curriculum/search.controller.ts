import { Request, Response } from 'express';
import { z } from 'zod';
import { curriculumRAGService } from '../../../core/rag/curriculum-rag.service';
import { successResponse, errorResponse } from '../../../utils/response.utils';
import asyncHandler from 'express-async-handler';

// Validation schemas
const searchSchema = z.object({
  query: z.string().min(2).max(500),
  subjectId: z.string().optional(),
  unitId: z.string().optional(),
  lessonId: z.string().optional(),
  grade: z.number().min(1).max(12).optional(),
  limit: z.number().min(1).max(20).default(5),
  includeExamples: z.boolean().default(false),
  includeFormulas: z.boolean().default(false),
});

const answerQuestionSchema = z.object({
  question: z.string().min(5).max(1000),
  lessonId: z.string().optional(),
  includeVisuals: z.boolean().default(false),
});

export class SearchController {
  
  /**
   * @route   POST /api/v1/curriculum/search
   * @desc    Search curriculum with RAG
   * @access  Private
   */
  search = asyncHandler(async (req: Request, res: Response) => {
    // Validate input
    const validated = searchSchema.parse(req.body);
    
    // Perform search
    const results = await curriculumRAGService.searchCurriculum(validated);
    
    res.json(
      successResponse(
        {
          query: validated.query,
          results,
          count: results.length,
        },
        'Search completed successfully'
      )
    );
  });
  
  /**
   * @route   POST /api/v1/curriculum/ask
   * @desc    Ask a question about the curriculum
   * @access  Private
   */
  askQuestion = asyncHandler(async (req: Request, res: Response) => {
    // Validate input
    const validated = answerQuestionSchema.parse(req.body);
    
    // Get answer using RAG
    const response = await curriculumRAGService.answerQuestion(
      validated.question,
      {
        lessonId: validated.lessonId,
        userId: req.user?.userId,
        includeVisuals: validated.includeVisuals,
      }
    );
    
    res.json(
      successResponse(response, 'Question answered successfully')
    );
  });
  
  /**
   * @route   GET /api/v1/curriculum/suggest
   * @desc    Get search suggestions
   * @access  Private
   */
  getSuggestions = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query.q as string;
    
    if (!query || query.length < 2) {
      res.json(
        successResponse([], 'No suggestions available')
      );
      return;
    }
    
    // Generate suggestions based on common queries
    const suggestions = [
      `ما هو ${query}؟`,
      `اشرح ${query} بطريقة بسيطة`,
      `أمثلة على ${query}`,
      `تمارين ${query}`,
      `الفرق بين ${query} و`,
    ];
    
    res.json(
      successResponse(suggestions, 'Suggestions generated')
    );
  });
  
  /**
   * @route   GET /api/v1/curriculum/trending
   * @desc    Get trending search topics
   * @access  Private
   */
  getTrendingTopics = asyncHandler(async (req: Request, res: Response) => {
    // Mock trending topics (would come from analytics)
    const trending = [
      { topic: 'الأعداد الطبيعية', count: 245 },
      { topic: 'العمليات الحسابية', count: 189 },
      { topic: 'الكسور العشرية', count: 156 },
      { topic: 'المعادلات', count: 134 },
      { topic: 'الهندسة', count: 98 },
    ];
    
    res.json(
      successResponse(trending, 'Trending topics retrieved')
    );
  });
}

// Export controller instance
export const searchController = new SearchController();