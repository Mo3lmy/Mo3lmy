// src/api/rest/educational-content.routes.ts
// 🆕 Educational Content Endpoints for Tips, Stories, and More

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.config';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';

const router = Router();

// Helper function to safely parse JSON
const safeParseJSON = (data: any, fallback: any = null) => {
  if (!data) return fallback;
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch {
    return fallback;
  }
};

/**
 * @route   GET /api/v1/educational/lessons/:lessonId/tips
 * @desc    Get educational tips for a lesson
 * @access  Public
 */
router.get(
  '/lessons/:lessonId/tips',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No content found for this lesson')
      );
      return;
    }

    let tips: string[] = [];

    if (lesson.content.enrichedContent) {
      const enriched = safeParseJSON(lesson.content.enrichedContent, {});
      tips = enriched.studentTips || [];
    }

    res.json(
      successResponse({
        tips,
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title,
        count: tips.length,
        enrichmentLevel: lesson.content.enrichmentLevel || 0
      }, 'Tips retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/educational/lessons/:lessonId/stories
 * @desc    Get educational stories
 * @access  Public
 */
router.get(
  '/lessons/:lessonId/stories',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No content found for this lesson')
      );
      return;
    }

    let stories: any[] = [];

    if (lesson.content.enrichedContent) {
      const enriched = safeParseJSON(lesson.content.enrichedContent, {});
      stories = enriched.educationalStories || [];
    }

    res.json(
      successResponse({
        stories,
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title,
        count: stories.length,
        enrichmentLevel: lesson.content.enrichmentLevel || 0
      }, 'Stories retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/educational/lessons/:lessonId/mistakes
 * @desc    Get common mistakes to avoid
 * @access  Public
 */
router.get(
  '/lessons/:lessonId/mistakes',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No content found for this lesson')
      );
      return;
    }

    let mistakes: any[] = [];

    if (lesson.content.enrichedContent) {
      const enriched = safeParseJSON(lesson.content.enrichedContent, {});
      mistakes = enriched.commonMistakes || [];
    }

    res.json(
      successResponse({
        mistakes,
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title,
        count: mistakes.length,
        enrichmentLevel: lesson.content.enrichmentLevel || 0
      }, 'Common mistakes retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/educational/lessons/:lessonId/applications
 * @desc    Get real-world applications
 * @access  Public
 */
router.get(
  '/lessons/:lessonId/applications',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No content found for this lesson')
      );
      return;
    }

    let applications: any[] = [];

    if (lesson.content.enrichedContent) {
      const enriched = safeParseJSON(lesson.content.enrichedContent, {});
      applications = enriched.realWorldApplications || [];
    }

    res.json(
      successResponse({
        applications,
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title,
        count: applications.length,
        enrichmentLevel: lesson.content.enrichmentLevel || 0
      }, 'Applications retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/educational/lessons/:lessonId/fun-facts
 * @desc    Get fun facts
 * @access  Public
 */
router.get(
  '/lessons/:lessonId/fun-facts',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No content found for this lesson')
      );
      return;
    }

    let funFacts: any[] = [];

    if (lesson.content.enrichedContent) {
      const enriched = safeParseJSON(lesson.content.enrichedContent, {});
      funFacts = enriched.funFacts || [];
    }

    res.json(
      successResponse({
        funFacts,
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title,
        count: funFacts.length,
        enrichmentLevel: lesson.content.enrichmentLevel || 0
      }, 'Fun facts retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/educational/lessons/:lessonId/challenges
 * @desc    Get interactive challenges
 * @access  Public
 */
router.get(
  '/lessons/:lessonId/challenges',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No content found for this lesson')
      );
      return;
    }

    let challenges: any[] = [];

    if (lesson.content.enrichedContent) {
      const enriched = safeParseJSON(lesson.content.enrichedContent, {});
      challenges = enriched.challenges || [];
    }

    res.json(
      successResponse({
        challenges,
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title,
        count: challenges.length,
        enrichmentLevel: lesson.content.enrichmentLevel || 0
      }, 'Challenges retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/educational/lessons/:lessonId/visual-aids
 * @desc    Get visual aids and diagrams
 * @access  Public
 */
router.get(
  '/lessons/:lessonId/visual-aids',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No content found for this lesson')
      );
      return;
    }

    let visualAids: any[] = [];

    if (lesson.content.enrichedContent) {
      const enriched = safeParseJSON(lesson.content.enrichedContent, {});
      visualAids = enriched.visualAids || [];
    }

    res.json(
      successResponse({
        visualAids,
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title,
        count: visualAids.length,
        enrichmentLevel: lesson.content.enrichmentLevel || 0
      }, 'Visual aids retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/educational/lessons/:lessonId/all
 * @desc    Get all educational content for a lesson
 * @access  Public
 */
router.get(
  '/lessons/:lessonId/all',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No content found for this lesson')
      );
      return;
    }

    let educationalContent: any = {
      tips: [],
      stories: [],
      mistakes: [],
      applications: [],
      funFacts: [],
      challenges: [],
      visualAids: [],
      quickReview: null
    };

    if (lesson.content.enrichedContent) {
      const enriched = safeParseJSON(lesson.content.enrichedContent, {});
      educationalContent = {
        tips: enriched.studentTips || [],
        stories: enriched.educationalStories || [],
        mistakes: enriched.commonMistakes || [],
        applications: enriched.realWorldApplications || [],
        funFacts: enriched.funFacts || [],
        challenges: enriched.challenges || [],
        visualAids: enriched.visualAids || [],
        quickReview: enriched.quickReview || null
      };
    }

    res.json(
      successResponse({
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title,
        enrichmentLevel: lesson.content.enrichmentLevel || 0,
        content: educationalContent,
        stats: {
          totalTips: educationalContent.tips.length,
          totalStories: educationalContent.stories.length,
          totalMistakes: educationalContent.mistakes.length,
          totalApplications: educationalContent.applications.length,
          totalFunFacts: educationalContent.funFacts.length,
          totalChallenges: educationalContent.challenges.length,
          totalVisualAids: educationalContent.visualAids.length,
          hasQuickReview: !!educationalContent.quickReview
        }
      }, 'All educational content retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/educational/lessons/:lessonId/random
 * @desc    Get random educational content item
 * @access  Public
 */
router.get(
  '/lessons/:lessonId/random',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.params;
    const { type } = req.query as { type?: string };

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No content found for this lesson')
      );
      return;
    }

    let randomItem: any = null;
    let itemType: string = '';

    if (lesson.content.enrichedContent) {
      const enriched = safeParseJSON(lesson.content.enrichedContent, {});

      // Get all available content types
      const availableContent: { [key: string]: any[] } = {
        tip: enriched.studentTips || [],
        story: enriched.educationalStories || [],
        mistake: enriched.commonMistakes || [],
        application: enriched.realWorldApplications || [],
        funFact: enriched.funFacts || [],
        challenge: enriched.challenges || [],
        visualAid: enriched.visualAids || []
      };

      // Filter by type if specified
      if (type && availableContent[type] && availableContent[type].length > 0) {
        const items = availableContent[type];
        randomItem = items[Math.floor(Math.random() * items.length)];
        itemType = type;
      } else {
        // Get random type with content
        const typesWithContent = Object.entries(availableContent)
          .filter(([_, items]) => items.length > 0);

        if (typesWithContent.length > 0) {
          const [randomType, items] = typesWithContent[
            Math.floor(Math.random() * typesWithContent.length)
          ];
          randomItem = items[Math.floor(Math.random() * items.length)];
          itemType = randomType;
        }
      }
    }

    if (!randomItem) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No educational content available')
      );
      return;
    }

    res.json(
      successResponse({
        type: itemType,
        content: randomItem,
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title
      }, 'Random content retrieved successfully')
    );
  })
);

export default router;