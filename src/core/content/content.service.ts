import { z } from 'zod';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { prisma } from '../../config/database.config';
import { NotFoundError, ValidationError } from '../../utils/errors';
import type { 
  Subject, 
  Unit, 
  Lesson, 
  Content,
  Difficulty 
} from '@prisma/client';
import type { LessonContent } from '../../types/content.types';

// Validation schemas
const createLessonSchema = z.object({
  unitId: z.string().uuid(),
  title: z.string().min(3).max(200),
  titleEn: z.string().min(3).max(200),
  description: z.string().optional(),
  duration: z.number().min(5).max(180).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
});

const lessonContentSchema = z.object({
  fullText: z.string().min(100),
  summary: z.string().min(50).max(500),
  keyPoints: z.array(z.string()).min(3).max(10),
  examples: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    code: z.string().optional(),
    image: z.string().url().optional(),
  })).optional(),
  exercises: z.array(z.object({
    id: z.string(),
    question: z.string(),
    hint: z.string().optional(),
    solution: z.string(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  })).optional(),
});

export class ContentManagementService {
  
  /**
   * Create a new subject
   */
  async createSubject(data: {
    name: string;
    nameEn: string;
    grade: number;
    description?: string;
    icon?: string;
  }): Promise<Subject> {
    return await prisma.subject.create({
      data: {
        ...data,
        order: await this.getNextOrder('subject', { grade: data.grade }),
      },
    });
  }
  
  /**
   * Create a new unit
   */
  async createUnit(data: {
    subjectId: string;
    title: string;
    titleEn: string;
    description?: string;
  }): Promise<Unit> {
    // Check if subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: data.subjectId },
    });
    
    if (!subject) {
      throw new NotFoundError('Subject');
    }
    
    return await prisma.unit.create({
      data: {
        ...data,
        order: await this.getNextOrder('unit', { subjectId: data.subjectId }),
      },
      include: {
        subject: true,
      },
    });
  }
  
  /**
   * Create a new lesson
   */
  async createLesson(data: z.infer<typeof createLessonSchema>): Promise<Lesson> {
    const validated = createLessonSchema.parse(data);
    
    // Check if unit exists
    const unit = await prisma.unit.findUnique({
      where: { id: validated.unitId },
    });
    
    if (!unit) {
      throw new NotFoundError('Unit');
    }
    
    return await prisma.lesson.create({
      data: {
        ...validated,
        order: await this.getNextOrder('lesson', { unitId: validated.unitId }),
      },
      include: {
        unit: {
          include: {
            subject: true,
          },
        },
      },
    });
  }
  
  /**
   * Add or update lesson content
   */
  async upsertLessonContent(
    lessonId: string, 
    contentData: z.infer<typeof lessonContentSchema>
  ): Promise<Content> {
    // Validate input
    const validated = lessonContentSchema.parse(contentData);
    
    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });
    
    if (!lesson) {
      throw new NotFoundError('Lesson');
    }
    
    // Process and sanitize content
    const processedContent = {
      fullText: this.sanitizeContent(validated.fullText),
      summary: this.sanitizeContent(validated.summary),
      keyPoints: JSON.stringify(validated.keyPoints),
      examples: validated.examples ? JSON.stringify(validated.examples) : null,
      exercises: validated.exercises ? JSON.stringify(validated.exercises) : null,
    };
    
    // Upsert content
    return await prisma.content.upsert({
      where: { lessonId },
      update: processedContent,
      create: {
        lessonId,
        ...processedContent,
      },
    });
  }
  
  /**
   * Get lesson with full content
   */
  async getLessonWithContent(lessonId: string): Promise<{
    lesson: Lesson;
    content: LessonContent | null;
  }> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        content: true,
        unit: {
          include: {
            subject: true,
          },
        },
        video: true,
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });
    
    if (!lesson) {
      throw new NotFoundError('Lesson');
    }
    
    // Parse content JSON fields
    let parsedContent: LessonContent | null = null;
    if (lesson.content) {
      parsedContent = {
        fullText: lesson.content.fullText,
        summary: lesson.content.summary || '',
        keyPoints: lesson.content.keyPoints 
          ? JSON.parse(lesson.content.keyPoints) 
          : [],
        examples: lesson.content.examples 
          ? JSON.parse(lesson.content.examples) 
          : [],
        exercises: lesson.content.exercises 
          ? JSON.parse(lesson.content.exercises) 
          : [],
      };
    }
    
    return {
      lesson,
      content: parsedContent,
    };
  }
  
  /**
   * Get all subjects by grade
   */
  async getSubjectsByGrade(grade: number): Promise<Subject[]> {
    return await prisma.subject.findMany({
      where: { 
        grade,
        isActive: true,
      },
      orderBy: { order: 'asc' },
    });
  }
  
  /**
   * Get units by subject
   */
  async getUnitsBySubject(subjectId: string): Promise<Unit[]> {
    return await prisma.unit.findMany({
      where: { 
        subjectId,
        isActive: true,
      },
      orderBy: { order: 'asc' },
      include: {
        lessons: {
          where: { isPublished: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  }
  
  /**
   * Get lessons by unit
   */
  async getLessonsByUnit(unitId: string): Promise<Lesson[]> {
    return await prisma.lesson.findMany({
      where: { 
        unitId,
        isPublished: true,
      },
      orderBy: { order: 'asc' },
      include: {
        content: {
          select: {
            id: true,
            summary: true,
          },
        },
        video: {
          select: {
            id: true,
            status: true,
            url: true,
            thumbnailUrl: true,
          },
        },
      },
    });
  }
  
  /**
   * Publish a lesson
   */
  async publishLesson(lessonId: string): Promise<Lesson> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true },
    });
    
    if (!lesson) {
      throw new NotFoundError('Lesson');
    }
    
    if (!lesson.content) {
      throw new ValidationError('Cannot publish lesson without content');
    }
    
    return await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }
  
  /**
   * Search lessons
   */
  async searchLessons(query: string, grade?: number): Promise<Lesson[]> {
    const whereClause: any = {
      isPublished: true,
      OR: [
        { title: { contains: query } },
        { titleEn: { contains: query } },
        { description: { contains: query } },
        { content: { fullText: { contains: query } } },
      ],
    };
    
    if (grade) {
      whereClause.unit = {
        subject: { grade },
      };
    }
    
    return await prisma.lesson.findMany({
      where: whereClause,
      take: 20,
      include: {
        unit: {
          include: {
            subject: true,
          },
        },
      },
    });
  }
  
  /**
   * Helper: Sanitize HTML content
   */
  private sanitizeContent(content: string): string {
  // Convert markdown to HTML (marked.parse for sync operation)
  const html = marked.parse(content) as string;
  
  // Sanitize HTML
  return sanitizeHtml(html, {
      allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'em', 'u', 's',
        'ul', 'ol', 'li',
        'blockquote', 'code', 'pre',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      allowedAttributes: {
        a: ['href', 'target'],
        img: ['src', 'alt', 'width', 'height'],
      },
      allowedSchemes: ['http', 'https'],
    });
  }
  
  /**
   * Helper: Get next order number
   */
  private async getNextOrder(
    entity: 'subject' | 'unit' | 'lesson',
    where: any
  ): Promise<number> {
    let maxOrder = 0;
    
    if (entity === 'subject') {
      const result = await prisma.subject.findFirst({
        where,
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      maxOrder = result?.order || 0;
    } else if (entity === 'unit') {
      const result = await prisma.unit.findFirst({
        where,
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      maxOrder = result?.order || 0;
    } else if (entity === 'lesson') {
      const result = await prisma.lesson.findFirst({
        where,
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      maxOrder = result?.order || 0;
    }
    
    return maxOrder + 1;
  }
}

// Export singleton instance
export const contentService = new ContentManagementService();