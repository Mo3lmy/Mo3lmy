import { prisma } from '../../config/database.config';
import { openAIService } from '../../services/ai/openai.service';
import type { VideoScript, VideoSection, Slide } from '../../types/video.types';
import type { LessonContent } from '../../types/content.types';

export class ScriptGenerator {
  
  /**
   * Generate video script from lesson content
   */
  async generateScript(lessonId: string): Promise<VideoScript> {
    console.log('📝 Generating video script for lesson:', lessonId);
    
    // Get lesson content
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        content: true,
        unit: {
          include: {
            subject: true,
          },
        },
      },
    });
    
    if (!lesson || !lesson.content) {
      throw new Error('Lesson or content not found');
    }
    
    // Parse content
    const keyPoints = lesson.content.keyPoints 
      ? JSON.parse(lesson.content.keyPoints) 
      : [];
    const examples = lesson.content.examples 
      ? JSON.parse(lesson.content.examples) 
      : [];
    
    // Check if we have OpenAI API key
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    
    if (!hasOpenAI) {
      // Generate mock script for testing
      return this.generateMockScript(lesson, keyPoints, examples);
    }
    
    // Generate script using AI
    return await this.generateAIScript(lesson, keyPoints, examples);
  }
  
  /**
   * Generate mock script for testing (no API needed)
   */
  private generateMockScript(
    lesson: any,
    keyPoints: string[],
    examples: any[]
  ): VideoScript {
    console.log('🎭 Generating mock script (no API key)...');
    
    const sections: VideoSection[] = [];
    
    // Intro section
    sections.push({
      id: 'intro',
      type: 'intro',
      title: 'المقدمة',
      narration: `مرحباً بكم في درس ${lesson.title}. سنتعلم اليوم عن ${lesson.description || lesson.title}.`,
      slides: [
        {
          id: 'intro-1',
          type: 'title',
          content: {
            title: lesson.title,
            subtitle: lesson.unit.subject.name,
          },
          duration: 5,
          transitions: { in: 'fade', out: 'fade' },
        },
      ],
      duration: 5,
    });
    
    // Content sections from key points
    keyPoints.forEach((point: string, index: number) => {
      sections.push({
        id: `content-${index}`,
        type: 'content',
        title: `النقطة ${index + 1}`,
        narration: point,
        slides: [
          {
            id: `slide-content-${index}`,
            type: 'content',
            content: {
              title: `النقطة الرئيسية ${index + 1}`,
              text: point,
            },
            duration: 10,
            transitions: { in: 'slide', out: 'slide' },
          },
        ],
        duration: 10,
      });
    });
    
    // Example section
    if (examples.length > 0) {
      const example = examples[0];
      sections.push({
        id: 'example',
        type: 'example',
        title: 'مثال تطبيقي',
        narration: `دعونا نرى مثالاً: ${example.description}`,
        slides: [
          {
            id: 'example-1',
            type: 'content',
            content: {
              title: example.title,
              text: example.description,
            },
            duration: 10,
            transitions: { in: 'zoom', out: 'fade' },
          },
        ],
        duration: 10,
      });
    }
    
    // Summary section
    sections.push({
      id: 'summary',
      type: 'summary',
      title: 'الخلاصة',
      narration: lesson.content.summary || `هذا ما تعلمناه اليوم عن ${lesson.title}`,
      slides: [
        {
          id: 'summary-1',
          type: 'bullet',
          content: {
            title: 'ملخص الدرس',
            bullets: keyPoints.slice(0, 3),
          },
          duration: 8,
          transitions: { in: 'fade', out: 'fade' },
        },
      ],
      duration: 8,
    });
    
    // Calculate total duration
    const totalDuration = sections.reduce((sum, section) => sum + section.duration, 0);
    
    return {
      title: lesson.title,
      duration: totalDuration,
      sections,
    };
  }
  
  /**
   * Generate AI-powered script
   */
  private async generateAIScript(
    lesson: any,
    keyPoints: string[],
    examples: any[]
  ): Promise<VideoScript> {
    console.log('🤖 Generating AI script...');
    
    const prompt = `Create a video script for an educational lesson with the following details:

Title: ${lesson.title}
Description: ${lesson.description || ''}
Key Points: ${JSON.stringify(keyPoints)}
Examples: ${JSON.stringify(examples)}
Grade Level: ${lesson.unit.subject.grade}

Create a structured script with:
1. Introduction (5-10 seconds)
2. Main content sections (one for each key point)
3. Example section
4. Summary/conclusion

For each section, provide:
- Narration text (in Arabic)
- Slide content
- Duration in seconds

Return as JSON in this format:
{
  "sections": [
    {
      "type": "intro|content|example|summary",
      "narration": "text to be spoken",
      "slideTitle": "slide title",
      "slideContent": "slide main content or bullet points array",
      "duration": seconds
    }
  ]
}`;
    
    try {
      const response = await openAIService.chat([
        { 
          role: 'system', 
          content: 'You are an educational video script writer. Create engaging scripts for students.' 
        },
        { role: 'user', content: prompt },
      ], {
        temperature: 0.7,
        maxTokens: 1500,
      });
      
      const parsed = JSON.parse(response);
      return this.formatAIScript(lesson.title, parsed.sections);
    } catch (error) {
      console.error('AI script generation failed, using mock:', error);
      return this.generateMockScript(lesson, keyPoints, examples);
    }
  }
  
  /**
   * Format AI response to VideoScript
   */
  private formatAIScript(title: string, aiSections: any[]): VideoScript {
    const sections: VideoSection[] = aiSections.map((section, index) => ({
      id: `section-${index}`,
      type: section.type || 'content',
      title: section.slideTitle || `Section ${index + 1}`,
      narration: section.narration,
      slides: [
        {
          id: `slide-${index}`,
          type: Array.isArray(section.slideContent) ? 'bullet' : 'content',
          content: Array.isArray(section.slideContent)
            ? {
                title: section.slideTitle,
                bullets: section.slideContent,
              }
            : {
                title: section.slideTitle,
                text: section.slideContent,
              },
          duration: section.duration || 10,
          transitions: { in: 'fade', out: 'fade' },
        },
      ],
      duration: section.duration || 10,
    }));
    
    const totalDuration = sections.reduce((sum, s) => sum + s.duration, 0);
    
    return {
      title,
      duration: totalDuration,
      sections,
    };
  }
  
  /**
   * Optimize script timing
   */
  optimizeScriptTiming(script: VideoScript): VideoScript {
    // Ensure minimum durations
    script.sections.forEach(section => {
      section.slides.forEach(slide => {
        // Minimum 3 seconds per slide
        if (slide.duration < 3) {
          slide.duration = 3;
        }
        
        // Calculate based on content
        if (slide.content.bullets) {
          slide.duration = Math.max(slide.duration, slide.content.bullets.length * 3);
        }
        if (slide.content.text) {
          // Estimate reading time (150 words per minute in Arabic)
          const words = slide.content.text.split(' ').length;
          const readingTime = Math.ceil((words / 150) * 60);
          slide.duration = Math.max(slide.duration, readingTime);
        }
      });
      
      // Update section duration
      section.duration = section.slides.reduce((sum, slide) => sum + slide.duration, 0);
    });
    
    // Update total duration
    script.duration = script.sections.reduce((sum, section) => sum + section.duration, 0);
    
    return script;
  }
}

// Export singleton instance
export const scriptGenerator = new ScriptGenerator();