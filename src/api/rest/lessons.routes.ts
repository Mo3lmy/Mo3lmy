// 📍 المكان: src/api/rest/lessons.routes.ts
// الوظيفة: API endpoints للدروس مع دعم الشرائح والصوت

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.config';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';

// ============= IMPORTS FOR SLIDES & VOICE =============
import { slideService, type SlideContent } from '../../services/slides/slide.service';
import { voiceService } from '../../services/voice/voice.service';
import { z } from 'zod';

const router = Router();

// Validation schemas for slides
const slideGenerationSchema = z.object({
  type: z.enum(['title', 'content', 'bullet', 'image', 'equation', 'quiz', 'summary']).optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional(),
  equation: z.string().optional(),
  quiz: z.object({
    question: z.string(),
    options: z.array(z.string()),
    correctIndex: z.number().optional()
  }).optional(),
  theme: z.enum(['default', 'dark', 'kids']).optional(),
  generateVoice: z.boolean().optional() // Added for voice
});

// Validation schema for voice generation
const voiceGenerationSchema = z.object({
  voiceId: z.string().optional(),
  speed: z.number().min(0.5).max(2).optional(),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional()
});

// Store voice generation status (in production, use Redis)
const voiceGenerationStatus = new Map<string, any>();

// Endpoint خاص للتطوير فقط - بدون authentication
if (process.env.NODE_ENV === 'development') {
  router.get('/test', async (req, res) => {
    try {
      const lessons = await prisma.lesson.findMany({
        include: {
          unit: {
            include: {
              subject: true
            }
          }
        },
        take: 20
      });
      
      res.json({
        success: true,
        data: lessons
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch lessons'
      });
    }
  });
}

/**
 * @route   GET /api/v1/lessons
 * @desc    Get all lessons or filtered lessons
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { subjectId, unitId, grade } = req.query;
    
    // Build where clause
    const where: any = {};
    
    if (unitId) {
      where.unitId = unitId;
    }
    
    if (subjectId || grade) {
      where.unit = {};
      if (subjectId) {
        where.unit.subjectId = subjectId;
      }
      if (grade) {
        where.unit.subject = { grade: parseInt(grade as string) };
      }
    }
    
    // Fetch lessons
    const lessons = await prisma.lesson.findMany({
      where,
      include: {
        unit: {
          include: {
            subject: true
          }
        }
      },
      orderBy: {
        order: 'asc'
      }
    });
    
    res.json(
      successResponse(lessons, 'Lessons retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/:id
 * @desc    Get single lesson by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        unit: {
          include: {
            subject: true
          }
        },
        video: true
      }
    });
    
    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }
    
    res.json(
      successResponse(lesson, 'Lesson retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/:id/content
 * @desc    Get lesson content
 * @access  Private
 */
router.get(
  '/:id/content',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // Get lesson with content
    const lesson = await prisma.lesson.findUnique({
      where: { id }
    });
    
    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }
    
    // Get related content if exists
    const content = await prisma.content.findFirst({
      where: { lessonId: id }
    });
    
    // Parse JSON fields
    const keyPoints = JSON.parse(lesson.keyPoints || '[]');
    
    // Build content response
    const lessonContent = {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      summary: lesson.summary,
      keyPoints,
      fullText: content?.fullText || '',
      examples: content ? JSON.parse(content.examples || '[]') : [],
      exercises: content ? JSON.parse(content.exercises || '[]') : [],
      estimatedMinutes: lesson.estimatedMinutes || 30
    };
    
    res.json(
      successResponse(lessonContent, 'Lesson content retrieved')
    );
  })
);

// ============= SLIDE ENDPOINTS WITH VOICE SUPPORT =============

/**
 * @route   GET /api/v1/lessons/:id/slides
 * @desc    Generate all slides for a lesson (with optional voice)
 * @access  Private
 */
router.get(
  '/:id/slides',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { theme = 'default', generateVoice = 'false' } = req.query as { 
      theme?: string;
      generateVoice?: string;
    };
    const shouldGenerateVoice = generateVoice === 'true';
    
    // Get lesson with content
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        unit: {
          include: {
            subject: true
          }
        },
        content: true
      }
    });
    
    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }
    
    // Parse JSON fields
    const keyPoints = JSON.parse(lesson.keyPoints || '[]');
    
    // Build slide content
    const slides: SlideContent[] = [];
    
    // 1. Title slide
    slides.push({
      type: 'title',
      title: lesson.titleAr || lesson.title,
      subtitle: lesson.unit.subject.nameAr || lesson.unit.subject.name,
      metadata: { duration: 5 }
    });
    
    // 2. Introduction slide
    if (lesson.description) {
      slides.push({
        type: 'content',
        title: 'مقدمة',
        content: lesson.description,
        metadata: { duration: 10 }
      });
    }
    
    // 3. Content slides (split if too long)
    if (lesson.content?.fullText) {
      const contentChunks = lesson.content.fullText.match(/.{1,500}/g) || [];
      contentChunks.forEach((chunk, index) => {
        slides.push({
          type: 'content',
          title: `المحتوى ${contentChunks.length > 1 ? `(${index + 1})` : ''}`,
          content: chunk,
          metadata: { duration: 15 }
        });
      });
    }
    
    // 4. Key points slide
    if (keyPoints.length > 0) {
      slides.push({
        type: 'bullet',
        title: 'النقاط الرئيسية',
        bullets: keyPoints,
        metadata: { duration: 10 }
      });
    }
    
    // 5. Examples slides
    if (lesson.content?.examples) {
      const examples = JSON.parse(lesson.content.examples || '[]');
      examples.forEach((example: any, index: number) => {
        slides.push({
          type: 'content',
          title: `مثال ${index + 1}`,
          content: example.description || example,
          metadata: { duration: 10 }
        });
      });
    }
    
    // 6. Quiz slide (if available)
    const questions = await prisma.question.findMany({
      where: { lessonId: id },
      take: 1
    });

    if (questions.length > 0) {
      const question = questions[0];
      const options = JSON.parse(question.options || '[]');
      
      slides.push({
        type: 'quiz',
        quiz: {
          question: question.question,
          options: options,
          correctIndex: parseInt(question.correctAnswer || '0')
        },
        metadata: { duration: 20 }
      });
    }
    
    // 7. Summary slide
    slides.push({
      type: 'summary',
      title: 'الخلاصة',
      subtitle: lesson.titleAr || lesson.title,
      bullets: keyPoints.slice(0, 5),
      metadata: { duration: 10 }
    });
    
    // Generate HTML for all slides
    const htmlSlides = slideService.generateLessonSlides(slides, theme);
    
    // Add animation styles to first slide
    if (htmlSlides.length > 0) {
      htmlSlides[0] = slideService.getAnimationStyles() + htmlSlides[0];
    }
    
    // Generate voice if requested
    let audioUrls: string[] = [];
    if (shouldGenerateVoice) {
      const voiceResults = await voiceService.generateLessonNarration(slides);
      audioUrls = voiceResults.map(r => r.audioUrl || '');
    }
    
    res.json(
      successResponse({
        lessonId: id,
        lessonTitle: lesson.titleAr || lesson.title,
        totalSlides: htmlSlides.length,
        estimatedDuration: slides.reduce((total, slide) => 
          total + (slide.metadata?.duration || 10), 0
        ),
        theme,
        hasVoice: shouldGenerateVoice,
        slides: htmlSlides.map((html, index) => ({
          number: index + 1,
          type: slides[index].type,
          title: slides[index].title,
          duration: slides[index].metadata?.duration || 10,
          html,
          audioUrl: shouldGenerateVoice ? audioUrls[index] : undefined
        }))
      }, 'Slides generated successfully')
    );
  })
);

// ============= NEW VOICE ENDPOINTS =============

/**
 * @route   POST /api/v1/lessons/:id/slides/:slideNumber/voice
 * @desc    Generate voice for a specific slide
 * @access  Private
 */
router.post(
  '/:id/slides/:slideNumber/voice',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id, slideNumber } = req.params;
    const slideIndex = parseInt(slideNumber) - 1;
    
    // Validate voice options
    const voiceOptions = voiceGenerationSchema.parse(req.body || {});
    
    if (isNaN(slideIndex) || slideIndex < 0) {
      res.status(400).json(
        errorResponse('INVALID_SLIDE_NUMBER', 'رقم الشريحة غير صحيح')
      );
      return;
    }
    
    // Get lesson
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        content: true,
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
    
    // Build slide content (simplified for single slide)
    const keyPoints = JSON.parse(lesson.keyPoints || '[]');
    const slides: any[] = [];
    
    // Build all slides to get the specific one
    slides.push({
      type: 'title',
      title: lesson.titleAr || lesson.title,
      subtitle: lesson.unit.subject.nameAr || lesson.unit.subject.name
    });
    
    if (lesson.description) {
      slides.push({
        type: 'content',
        title: 'مقدمة',
        content: lesson.description
      });
    }
    
    if (keyPoints.length > 0) {
      slides.push({
        type: 'bullet',
        title: 'النقاط الرئيسية',
        bullets: keyPoints
      });
    }
    
    slides.push({
      type: 'summary',
      title: 'الخلاصة',
      subtitle: lesson.titleAr || lesson.title,
      bullets: keyPoints.slice(0, 5)
    });
    
    // Check if slide exists
    if (slideIndex >= slides.length) {
      res.status(404).json(
        errorResponse('SLIDE_NOT_FOUND', 'الشريحة غير موجودة')
      );
      return;
    }
    
    // Generate voice for the specific slide
    const voiceResult = await voiceService.generateSlideNarration(
      slides[slideIndex],
      voiceOptions
    );
    
    if (!voiceResult.success) {
      res.status(500).json(
        errorResponse('VOICE_GENERATION_FAILED', voiceResult.error || 'فشل توليد الصوت')
      );
      return;
    }
    
    res.json(
      successResponse({
        lessonId: id,
        slideNumber: slideIndex + 1,
        audioUrl: voiceResult.audioUrl,
        audioPath: voiceResult.audioPath,
        cached: voiceResult.cached,
        message: voiceResult.cached ? 'تم استخدام الصوت المخزن' : 'تم توليد الصوت بنجاح'
      }, 'Voice generated successfully')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/:id/voice/generate-all
 * @desc    Generate voice for all lesson slides
 * @access  Private
 */
router.post(
  '/:id/voice/generate-all',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    // Validate voice options
    const voiceOptions = voiceGenerationSchema.parse(req.body || {});
    
    // Get lesson with content
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        content: true,
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
    
    // Build slides
    const slides: any[] = [];
    const keyPoints = JSON.parse(lesson.keyPoints || '[]');
    
    slides.push({
      type: 'title',
      title: lesson.titleAr || lesson.title,
      subtitle: lesson.unit.subject.nameAr || lesson.unit.subject.name
    });
    
    if (lesson.content) {
      slides.push({
        type: 'content',
        title: 'محتوى الدرس',
        content: lesson.content.summary || 'محتوى الدرس'
      });
      
      if (keyPoints.length > 0) {
        slides.push({
          type: 'bullet',
          title: 'النقاط الرئيسية',
          bullets: keyPoints
        });
      }
    }
    
    slides.push({
      type: 'summary',
      title: 'الخلاصة',
      subtitle: lesson.titleAr || lesson.title,
      bullets: keyPoints.slice(0, 5)
    });
    
    // Store generation status
    const statusKey = `${id}_${userId}`;
    voiceGenerationStatus.set(statusKey, {
      status: 'generating',
      progress: 0,
      totalSlides: slides.length,
      startedAt: new Date()
    });
    
    // Generate voices asynchronously
    const generateVoices = async () => {
      const voiceResults = await voiceService.generateLessonNarration(slides, voiceOptions);
      const audioUrls = voiceResults.map(r => r.audioUrl || '');
      
      // Update status
      voiceGenerationStatus.set(statusKey, {
        status: 'completed',
        progress: 100,
        totalSlides: slides.length,
        audioUrls,
        completedAt: new Date()
      });
    };
    
    // Start generation in background
    generateVoices().catch(error => {
      voiceGenerationStatus.set(statusKey, {
        status: 'failed',
        error: error.message,
        failedAt: new Date()
      });
    });
    
    res.json(
      successResponse({
        lessonId: id,
        statusId: statusKey,
        totalSlides: slides.length,
        message: 'بدء توليد الأصوات. استخدم endpoint الحالة لمتابعة التقدم'
      }, 'Voice generation started')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/:id/voice/status
 * @desc    Get voice generation status
 * @access  Private
 */
router.get(
  '/:id/voice/status',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const statusKey = `${id}_${userId}`;
    
    const status = voiceGenerationStatus.get(statusKey);
    
    if (!status) {
      res.json(
        successResponse({
          lessonId: id,
          status: 'idle',
          message: 'لا توجد عملية توليد صوت نشطة'
        }, 'No active voice generation')
      );
      return;
    }
    
    res.json(
      successResponse({
        lessonId: id,
        ...status
      }, 'Voice generation status retrieved')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/:id/voice/list
 * @desc    List available voices for the lesson
 * @access  Private
 */
router.get(
  '/:id/voice/list',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const voices = await voiceService.listAvailableVoices();
    
    res.json(
      successResponse({
        voices,
        defaultVoiceId: process.env.ELEVENLABS_VOICE_ID,
        totalVoices: voices.length,
        message: `تم العثور على ${voices.length} صوت متاح`
      }, 'Available voices retrieved')
    );
  })
);

// ============= EXISTING SLIDE ENDPOINTS (unchanged) =============

/**
 * @route   GET /api/v1/lessons/:id/slides/:slideNumber
 * @desc    Get a specific slide from a lesson
 * @access  Private
 */
router.get(
  '/:id/slides/:slideNumber',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id, slideNumber } = req.params;
    const { theme = 'default' } = req.query as { theme?: string };
    const slideIndex = parseInt(slideNumber) - 1;
    
    if (isNaN(slideIndex) || slideIndex < 0) {
      res.status(400).json(
        errorResponse('INVALID_SLIDE_NUMBER', 'رقم الشريحة غير صحيح')
      );
      return;
    }
    
    // Get lesson
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        unit: {
          include: {
            subject: true
          }
        },
        content: true
      }
    });
    
    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }
    
    // Generate all slides (you might want to cache this)
    const keyPoints = JSON.parse(lesson.keyPoints || '[]');
    const slides: SlideContent[] = [];
    
    // Build slides (same logic as above, but simplified)
    slides.push({
      type: 'title',
      title: lesson.titleAr || lesson.title,
      subtitle: lesson.unit.subject.nameAr || lesson.unit.subject.name
    });
    
    if (lesson.description) {
      slides.push({
        type: 'content',
        title: 'مقدمة',
        content: lesson.description
      });
    }
    
    if (keyPoints.length > 0) {
      slides.push({
        type: 'bullet',
        title: 'النقاط الرئيسية',
        bullets: keyPoints
      });
    }
    
    slides.push({
      type: 'summary',
      title: 'الخلاصة',
      subtitle: lesson.titleAr || lesson.title,
      bullets: keyPoints.slice(0, 5)
    });
    
    // Check if slide exists
    if (slideIndex >= slides.length) {
      res.status(404).json(
        errorResponse('SLIDE_NOT_FOUND', 'الشريحة غير موجودة')
      );
      return;
    }
    
    // Generate HTML for requested slide
    const slideHTML = slideService.generateSlideHTML(slides[slideIndex], theme);
    
    // Add animation styles if first slide
    const fullHTML = slideIndex === 0 
      ? slideService.getAnimationStyles() + slideHTML 
      : slideHTML;
    
    res.json(
      successResponse({
        lessonId: id,
        slideNumber: slideIndex + 1,
        totalSlides: slides.length,
        type: slides[slideIndex].type,
        title: slides[slideIndex].title,
        theme,
        html: fullHTML,
        hasNext: slideIndex < slides.length - 1,
        hasPrevious: slideIndex > 0
      }, 'Slide retrieved successfully')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/:id/slides/generate
 * @desc    Generate a custom slide for a lesson
 * @access  Private
 */
router.post(
  '/:id/slides/generate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // Validate request body
    const validationResult = slideGenerationSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'بيانات غير صحيحة', validationResult.error.issues)
      );
      return;
    }
    
    const slideData = validationResult.data;
    
    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id }
    });
    
    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }
    
    // Build slide content
    const slideContent: SlideContent = {
      type: slideData.type || 'content',
      title: slideData.title,
      subtitle: slideData.subtitle,
      content: slideData.content,
      bullets: slideData.bullets,
      imageUrl: slideData.imageUrl,
      equation: slideData.equation,
      quiz: slideData.quiz
    };
    
    // Generate slide HTML
    const slideHTML = slideService.generateSlideHTML(
      slideContent,
      slideData.theme || 'default'
    );
    
    // Generate voice if requested
    let audioUrl = null;
    if (slideData.generateVoice) {
      const voiceResult = await voiceService.generateSlideNarration(slideContent);
      if (voiceResult.success) {
        audioUrl = voiceResult.audioUrl;
      }
    }
    
    // Add animation styles
    const fullHTML = slideService.getAnimationStyles() + slideHTML;
    
    res.json(
      successResponse({
        lessonId: id,
        type: slideContent.type,
        theme: slideData.theme || 'default',
        html: fullHTML,
        audioUrl
      }, 'Custom slide generated successfully')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/:id/slides/themes
 * @desc    Get available slide themes
 * @access  Private
 */
router.get(
  '/:id/slides/themes',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const themes = [
      {
        name: 'default',
        label: 'الافتراضي',
        description: 'قالب احترافي بألوان الأزرق والبنفسجي',
        primaryColor: '#667eea',
        secondaryColor: '#764ba2'
      },
      {
        name: 'dark',
        label: 'الداكن',
        description: 'قالب داكن مريح للعين',
        primaryColor: '#4a5568',
        secondaryColor: '#2d3748'
      },
      {
        name: 'kids',
        label: 'للأطفال',
        description: 'قالب ملون ومرح للأطفال',
        primaryColor: '#f687b3',
        secondaryColor: '#9f7aea'
      }
    ];
    
    res.json(
      successResponse(themes, 'Available themes')
    );
  })
);

// ============= EXISTING ENDPOINTS (unchanged) =============

/**
 * @route   GET /api/v1/lessons/subject/:subjectId
 * @desc    Get lessons by subject
 * @access  Private
 */
router.get(
  '/subject/:subjectId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { subjectId } = req.params;
    
    const lessons = await prisma.lesson.findMany({
      where: {
        unit: {
          subjectId
        }
      },
      include: {
        unit: true
      },
      orderBy: [
        { unit: { order: 'asc' } },
        { order: 'asc' }
      ]
    });
    
    res.json(
      successResponse(lessons, 'Subject lessons retrieved')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/unit/:unitId
 * @desc    Get lessons by unit
 * @access  Private
 */
router.get(
  '/unit/:unitId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { unitId } = req.params;
    
    const lessons = await prisma.lesson.findMany({
      where: { unitId },
      orderBy: { order: 'asc' }
    });
    
    res.json(
      successResponse(lessons, 'Unit lessons retrieved')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/:id/start
 * @desc    Start a lesson (track progress)
 * @access  Private
 */
router.post(
  '/:id/start',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id }
    });
    
    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }
    
    // Create or update progress
    const progress = await prisma.progress.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId: id
        }
      },
      update: {
        lastAccessedAt: new Date()
      },
      create: {
        userId,
        lessonId: id,
        quizCompleted: false,
        completionRate: 0,
        timeSpent: 0
      }
    });
    
    res.json(
      successResponse(progress, 'Lesson started successfully')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/:id/complete
 * @desc    Mark lesson as complete
 * @access  Private
 */
router.post(
  '/:id/complete',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { timeSpent } = req.body;
    
    const progress = await prisma.progress.update({
      where: {
        userId_lessonId: {
          userId,
          lessonId: id
        }
      },
      data: {
        quizCompleted: true,
        completionRate: 100,
        completedAt: new Date(),
        timeSpent: timeSpent || 0,
        lastAccessedAt: new Date()
      }
    });
    
    res.json(
      successResponse(progress, 'Lesson completed successfully')
    );
  })
);

export default router;