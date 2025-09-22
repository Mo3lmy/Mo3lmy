// 📍 المكان: src/services/orchestrator/lesson-orchestrator.service.ts
// الوظيفة: تنسيق كل الخدمات وإدارة تدفق الدرس بذكاء

import { prisma } from '../../config/database.config';
import { websocketService } from '../websocket/websocket.service';
import { sessionService } from '../websocket/session.service';
import { realtimeChatService } from '../websocket/realtime-chat.service';
import { slideGenerator } from '../../core/video/slide.generator';
import { ragService } from '../../core/rag/rag.service';
import { openAIService } from '../ai/openai.service';
import type { Lesson, Unit, Subject } from '@prisma/client';

// ============= TYPES =============

export interface LessonFlow {
  lessonId: string;
  userId: string;
  sessionId: string;
  
  // Content Structure
  sections: LessonSection[];
  currentSection: number;
  currentSlide: number;
  totalSlides: number;
  
  // Timing
  estimatedDuration: number; // minutes
  actualDuration: number; // seconds
  startTime: Date;
  
  // User State
  comprehensionLevel: 'low' | 'medium' | 'high';
  engagementScore: number; // 0-100
  questionsAsked: number;
  
  // Settings
  autoAdvance: boolean;
  voiceEnabled: boolean;
  playbackSpeed: number;
  theme: string;
}

export interface LessonSection {
  id: string;
  type: 'intro' | 'concept' | 'example' | 'practice' | 'quiz' | 'summary';
  title: string;
  slides: GeneratedSlide[];
  duration: number; // seconds
  completed: boolean;
  
  // Learning objectives for this section
  objectives: string[];
  
  // Keywords to track
  keywords: string[];
  
  // Questions that might arise
  anticipatedQuestions: string[];
}

export interface GeneratedSlide {
  number: number;
  type: string;
  content: any;
  html?: string;
  audioUrl?: string;
  duration: number;
  userSpentTime?: number;
  interactions?: SlideInteraction[];
}

export interface SlideInteraction {
  type: 'click' | 'question' | 'replay' | 'skip';
  timestamp: Date;
  data?: any;
}

export interface ActionTrigger {
  trigger: string; // الكلمة المفتاحية
  action: 'generate_slide' | 'show_example' | 'start_quiz' | 'explain_more' | 'simplify' | 'show_video';
  confidence: number;
}

// ============= MAIN SERVICE =============

export class LessonOrchestratorService {
  private activeLessons: Map<string, LessonFlow> = new Map();
  
  /**
   * بدء درس جديد أو استكمال درس موجود
   */
  async startLesson(
    userId: string,
    lessonId: string,
    sessionId: string
  ): Promise<LessonFlow> {
    console.log('🎯 Starting Lesson Orchestration');
    
    // Check for existing flow
    const flowKey = `${userId}-${lessonId}`;
    if (this.activeLessons.has(flowKey)) {
      console.log('📚 Resuming existing lesson flow');
      return this.activeLessons.get(flowKey)!;
    }
    
    // Load lesson content
    const lesson = await this.loadLessonWithContent(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }
    
    // Create lesson structure
    const sections = await this.createLessonSections(lesson);
    
    // Calculate total slides
    const totalSlides = sections.reduce((sum, section) => 
      sum + section.slides.length, 0
    );
    
    // Create flow
    const flow: LessonFlow = {
      lessonId,
      userId,
      sessionId,
      sections,
      currentSection: 0,
      currentSlide: 0,
      totalSlides,
      estimatedDuration: Math.ceil(totalSlides * 0.5), // 30 sec per slide average
      actualDuration: 0,
      startTime: new Date(),
      comprehensionLevel: 'medium',
      engagementScore: 100,
      questionsAsked: 0,
      autoAdvance: true,
      voiceEnabled: true,
      playbackSpeed: 1,
      theme: this.getThemeByGrade(lesson.unit.subject.grade)
    };
    
    // Store flow
    this.activeLessons.set(flowKey, flow);
    
    // Generate first slides
    await this.generateInitialSlides(flow);
    
    console.log(`✅ Lesson flow created: ${totalSlides} slides in ${sections.length} sections`);
    
    return flow;
  }
  
  /**
   * إنشاء هيكل الدرس بذكاء
   */
  private async createLessonSections(lesson: any): Promise<LessonSection[]> {
    const sections: LessonSection[] = [];
    
    // 1. Introduction Section
    sections.push({
      id: 'intro',
      type: 'intro',
      title: 'مقدمة الدرس',
      slides: [
        {
          number: 1,
          type: 'title',
          content: {
            title: lesson.title,
            subtitle: lesson.unit.title
          },
          duration: 5
        },
        {
          number: 2,
          type: 'bullet',
          content: {
            title: 'ماذا سنتعلم اليوم؟',
            bullets: JSON.parse(lesson.objectives || '[]')
          },
          duration: 10
        }
      ],
      duration: 15,
      completed: false,
      objectives: ['فهم موضوع الدرس', 'معرفة الأهداف'],
      keywords: ['مقدمة', 'أهداف'],
      anticipatedQuestions: ['ما هو موضوع الدرس؟', 'ماذا سنتعلم؟']
    });
    
    // 2. Main Content Sections (from lesson content)
    const mainContent = JSON.parse(lesson.content || '{}');
    const keyPoints = JSON.parse(lesson.keyPoints || '[]');
    
    // قسّم المحتوى لأجزاء منطقية
    for (let i = 0; i < keyPoints.length; i++) {
      const point = keyPoints[i];
      const sectionSlides: GeneratedSlide[] = [];
      
      // Concept slide
      sectionSlides.push({
        number: sections.length * 3 + 1,
        type: 'content',
        content: {
          title: point,
          text: this.extractContentForPoint(mainContent, point)
        },
        duration: 15
      });
      
      // Bullet points slide
      sectionSlides.push({
        number: sections.length * 3 + 2,
        type: 'bullet',
        content: {
          title: `نقاط مهمة: ${point}`,
          bullets: this.generateBulletPoints(mainContent, point)
        },
        duration: 10
      });
      
      sections.push({
        id: `concept-${i}`,
        type: 'concept',
        title: point,
        slides: sectionSlides,
        duration: 25,
        completed: false,
        objectives: [`فهم ${point}`, `تطبيق ${point}`],
        keywords: this.extractKeywords(point),
        anticipatedQuestions: [
          `ما معنى ${point}؟`,
          `كيف أطبق ${point}؟`,
          `أعطني مثال على ${point}`
        ]
      });
    }
    
    // 3. Examples Section
    const examples = JSON.parse(lesson.examples || '[]');
    if (examples.length > 0) {
      const exampleSlides: GeneratedSlide[] = examples.map((ex: any, i: number) => ({
        number: sections.length * 2 + i + 1,
        type: 'content',
        content: {
          title: `مثال ${i + 1}`,
          text: ex.content || ex
        },
        duration: 12
      }));
      
      sections.push({
        id: 'examples',
        type: 'example',
        title: 'أمثلة تطبيقية',
        slides: exampleSlides,
        duration: exampleSlides.length * 12,
        completed: false,
        objectives: ['فهم التطبيق العملي', 'ربط النظرية بالواقع'],
        keywords: ['مثال', 'تطبيق'],
        anticipatedQuestions: ['مثال آخر؟', 'كيف أحل هذا؟']
      });
    }
    
    // 4. Practice/Quiz Section
    const currentSlideCount = sections.reduce((sum, s) => sum + s.slides.length, 0);
    sections.push({
      id: 'practice',
      type: 'practice',
      title: 'تدريبات',
      slides: [
        {
          number: currentSlideCount + 1,
          type: 'quiz',
          content: {
            quiz: {
              question: 'اختبر فهمك: اختر الإجابة الصحيحة',
              options: ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'],
              correctIndex: 0
            }
          },
          duration: 20
        }
      ],
      duration: 20,
      completed: false,
      objectives: ['اختبار الفهم', 'التطبيق العملي'],
      keywords: ['تدريب', 'اختبار'],
      anticipatedQuestions: ['هل الإجابة صحيحة؟', 'اشرح لي الحل']
    });
    
    // 5. Summary Section
    const finalSlideCount = sections.reduce((sum, s) => sum + s.slides.length, 0);
    sections.push({
      id: 'summary',
      type: 'summary',
      title: 'ملخص الدرس',
      slides: [
        {
          number: finalSlideCount + 1,
          type: 'summary',
          content: {
            title: 'ما تعلمناه اليوم',
            bullets: keyPoints
          },
          duration: 15
        }
      ],
      duration: 15,
      completed: false,
      objectives: ['مراجعة النقاط المهمة'],
      keywords: ['ملخص', 'مراجعة'],
      anticipatedQuestions: ['ما أهم نقطة؟', 'ماذا بعد؟']
    });
    
    return sections;
  }
  
  /**
   * توليد الشرائح الأولية
   */
  private async generateInitialSlides(flow: LessonFlow): Promise<void> {
    // Generate first 5 slides HTML
    const slidesToGenerate = Math.min(5, flow.totalSlides);
    
    for (let i = 0; i < slidesToGenerate; i++) {
      const slide = this.getSlideByNumber(flow, i);
      if (!slide) continue;
      
      // Generate HTML
      slide.html = slideGenerator.generateRealtimeSlideHTML(
        {
          id: `slide-${i}`,
          type: slide.type as any,
          content: slide.content,
          duration: slide.duration,
          transitions: { in: 'fade', out: 'fade' }
        },
        flow.theme as any
      );
    }
  }
  
  /**
   * الانتقال للشريحة التالية مع الذكاء
   */
  async navigateNext(userId: string, lessonId: string): Promise<GeneratedSlide | null> {
    const flow = this.getFlow(userId, lessonId);
    if (!flow) return null;
    
    // Check if we can advance
    if (flow.currentSlide >= flow.totalSlides - 1) {
      // Lesson completed
      await this.completeLessonFlow(flow);
      return null;
    }
    
    // Update position
    flow.currentSlide++;
    
    // Check if moving to new section
    const currentSectionSlides = flow.sections[flow.currentSection].slides.length;
    const sectionStartSlide = this.getSectionStartSlide(flow, flow.currentSection);
    
    if (flow.currentSlide >= sectionStartSlide + currentSectionSlides) {
      flow.currentSection++;
      
      // Notify about section change
      websocketService.sendToUser(userId, 'section_changed', {
        section: flow.sections[flow.currentSection].title,
        type: flow.sections[flow.currentSection].type
      });
    }
    
    // Get slide
    const slide = this.getSlideByNumber(flow, flow.currentSlide);
    if (!slide) return null;
    
    // Generate HTML if not exists
    if (!slide.html) {
      slide.html = await this.generateSlideHTML(flow, slide);
    }
    
    // Pre-generate next 2 slides
    this.preGenerateUpcomingSlides(flow, 2);
    
    // Update session
    await sessionService.updateSlidePosition(
      flow.sessionId,
      flow.currentSlide,
      flow.totalSlides
    );
    
    // Track engagement
    this.trackSlideEngagement(flow, slide);
    
    return slide;
  }
  
  /**
   * معالجة رسالة من المستخدم وتحليل النية
   */
  async processUserMessage(
    userId: string,
    lessonId: string,
    message: string
  ): Promise<ActionTrigger | null> {
    const flow = this.getFlow(userId, lessonId);
    if (!flow) return null;
    
    flow.questionsAsked++;
    
    // Analyze intent and determine action
    const action = await this.analyzeMessageIntent(message, flow);
    
    // Execute action if high confidence
    if (action && action.confidence > 0.7) {
      await this.executeAction(flow, action);
    }
    
    return action;
  }
  
  /**
   * تحليل رسالة المستخدم وتحديد الإجراء المناسب
   */
  private async analyzeMessageIntent(
    message: string,
    flow: LessonFlow
  ): Promise<ActionTrigger | null> {
    const lowerMessage = message.toLowerCase();
    
    // Pattern matching for actions
    const patterns: Array<{pattern: RegExp | string[], action: ActionTrigger['action']}> = [
      {
        pattern: ['اشرح', 'وضح', 'فسر', 'ما معنى', 'لم أفهم'],
        action: 'explain_more'
      },
      {
        pattern: ['مثال', 'مثل', 'أمثلة', 'تطبيق'],
        action: 'show_example'
      },
      {
        pattern: ['اختبر', 'تمرين', 'سؤال', 'quiz'],
        action: 'start_quiz'
      },
      {
        pattern: ['بسط', 'سهل', 'ابسط', 'صعب'],
        action: 'simplify'
      },
      {
        pattern: ['فيديو', 'شاهد', 'عرض'],
        action: 'show_video'
      },
      {
        pattern: ['شريحة', 'اعرض', 'ارسم', 'وضح بالرسم'],
        action: 'generate_slide'
      }
    ];
    
    for (const { pattern, action } of patterns) {
      const matches = Array.isArray(pattern)
        ? pattern.some(p => lowerMessage.includes(p))
        : pattern.test(lowerMessage);
        
      if (matches) {
        return {
          trigger: message,
          action,
          confidence: 0.85
        };
      }
    }
    
    // Use AI for complex intent analysis if no pattern matches
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `
تحليل نية المستخدم في سياق درس تعليمي.
الرسالة: "${message}"
السياق: درس عن ${flow.sections[flow.currentSection].title}

حدد الإجراء المناسب من:
- explain_more: يريد شرح إضافي
- show_example: يريد مثال
- start_quiz: يريد تمرين
- simplify: يريد تبسيط
- generate_slide: يريد شريحة جديدة
- none: لا يحتاج إجراء خاص

الرد (إجراء واحد فقط):`;

        const response = await openAIService.chat([
          { role: 'user', content: prompt }
        ], {
          temperature: 0.3,
          maxTokens: 20
        });
        
        const actionStr = response.trim().toLowerCase();
        if (actionStr !== 'none') {
          return {
            trigger: message,
            action: actionStr as any,
            confidence: 0.75
          };
        }
      } catch (error) {
        console.error('Intent analysis failed:', error);
      }
    }
    
    return null;
  }
  
  /**
   * تنفيذ الإجراء المطلوب
   */
  private async executeAction(flow: LessonFlow, action: ActionTrigger): Promise<void> {
    console.log(`🎬 Executing action: ${action.action}`);
    
    switch (action.action) {
      case 'generate_slide':
        await this.generateExplanationSlide(flow, action.trigger);
        break;
        
      case 'show_example':
        await this.generateExampleSlide(flow);
        break;
        
      case 'start_quiz':
        await this.generateQuizSlide(flow);
        break;
        
      case 'explain_more':
        await this.generateDetailedExplanation(flow);
        break;
        
      case 'simplify':
        await this.generateSimplifiedSlide(flow);
        break;
        
      case 'show_video':
        await this.suggestVideo(flow);
        break;
    }
    
    // Notify user
    websocketService.sendToUser(flow.userId, 'action_executed', {
      action: action.action,
      trigger: action.trigger
    });
  }
  
  /**
   * توليد شريحة شرح إضافية
   */
  private async generateExplanationSlide(flow: LessonFlow, topic: string): Promise<void> {
    const currentSection = flow.sections[flow.currentSection];
    
    // Generate explanation content using AI
    let content = `شرح تفصيلي عن: ${topic}`;
    
    if (process.env.OPENAI_API_KEY) {
      const prompt = `
اشرح للطالب في الصف ${this.getGradeFromFlow(flow)} الموضوع التالي:
"${topic}"

في سياق درس: ${currentSection.title}

الشرح (فقرة واحدة واضحة):`;
      
      try {
        content = await openAIService.chat([
          { role: 'user', content: prompt }
        ], {
          temperature: 0.7,
          maxTokens: 200
        });
      } catch (error) {
        console.error('Failed to generate explanation:', error);
      }
    }
    
    // Create new slide
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'content',
      content: {
        title: `شرح إضافي: ${topic}`,
        text: content
      },
      duration: 20
    };
    
    // Generate HTML
    newSlide.html = slideGenerator.generateRealtimeSlideHTML(
      {
        id: `slide-${newSlide.number}`,
        type: 'content',
        content: newSlide.content,
        duration: newSlide.duration,
        transitions: { in: 'fade', out: 'fade' }
      },
      flow.theme as any
    );
    
    // Insert slide after current
    this.insertSlideAfterCurrent(flow, newSlide);
    
    // Send to user
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: newSlide,
      reason: 'explanation_requested'
    });
  }
  
  /**
   * توليد شريحة مثال
   */
  private async generateExampleSlide(flow: LessonFlow): Promise<void> {
    const currentSection = flow.sections[flow.currentSection];
    const topic = currentSection.title;
    
    // Generate example using AI or use predefined
    let example = {
      title: `مثال على ${topic}`,
      content: 'مثال توضيحي...'
    };
    
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `
أعط مثال واضح ومناسب للصف ${this.getGradeFromFlow(flow)} على:
"${topic}"

المثال (مع الشرح):`;
        
        const response = await openAIService.chat([
          { role: 'user', content: prompt }
        ], {
          temperature: 0.7,
          maxTokens: 150
        });
        
        example.content = response;
      } catch (error) {
        console.error('Failed to generate example:', error);
      }
    }
    
    // Create slide
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'content',
      content: {
        title: example.title,
        text: example.content
      },
      duration: 15
    };
    
    // Generate HTML
    newSlide.html = slideGenerator.generateRealtimeSlideHTML(
      {
        id: `slide-${newSlide.number}`,
        type: 'content',
        content: newSlide.content,
        duration: newSlide.duration,
        transitions: { in: 'slide', out: 'slide' }
      },
      'colorful' // Use colorful theme for examples
    );
    
    // Insert and notify
    this.insertSlideAfterCurrent(flow, newSlide);
    
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: newSlide,
      reason: 'example_requested'
    });
  }
  
  /**
   * توليد شريحة تمرين/اختبار
   */
  private async generateQuizSlide(flow: LessonFlow): Promise<void> {
    const currentSection = flow.sections[flow.currentSection];
    
    // Generate quiz question
    const quiz = {
      question: `اختبر فهمك: ${currentSection.title}`,
      options: [
        'الإجابة الأولى',
        'الإجابة الثانية',
        'الإجابة الثالثة',
        'الإجابة الرابعة'
      ],
      correctIndex: Math.floor(Math.random() * 4)
    };
    
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `
اكتب سؤال اختيار من متعدد للصف ${this.getGradeFromFlow(flow)} عن:
"${currentSection.title}"

بصيغة JSON:
{
  "question": "السؤال",
  "options": ["خيار1", "خيار2", "خيار3", "خيار4"],
  "correctIndex": رقم_الإجابة_الصحيحة
}`;
        
        const response = await openAIService.chat([
          { role: 'system', content: 'You are a JSON generator. Always respond with valid JSON only, no text outside the JSON structure.' },
          { role: 'user', content: prompt }
        ], {
          temperature: 0.5,
          maxTokens: 200
        });
        
        // Clean response and parse JSON
        const cleanedResponse = response
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        
        // Try to extract JSON if the response contains text before/after
        let jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          Object.assign(quiz, parsed);
        }
      } catch (error) {
        console.error('Failed to generate quiz:', error);
      }
    }
    
    // Create quiz slide
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'quiz',
      content: { quiz },
      duration: 30
    };
    
    // Generate HTML
    newSlide.html = slideGenerator.generateRealtimeSlideHTML(
      {
        id: `slide-${newSlide.number}`,
        type: 'quiz',
        content: newSlide.content,
        duration: newSlide.duration,
        transitions: { in: 'zoom', out: 'zoom' }
      },
      'blue' // Blue theme for quizzes
    );
    
    // Insert and notify
    this.insertSlideAfterCurrent(flow, newSlide);
    
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: newSlide,
      reason: 'quiz_requested'
    });
  }
  
  // ============= HELPER METHODS =============
  
  private getFlow(userId: string, lessonId: string): LessonFlow | undefined {
    return this.activeLessons.get(`${userId}-${lessonId}`);
  }
  
  private async loadLessonWithContent(lessonId: string): Promise<any> {
    return await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        unit: {
          include: {
            subject: true
          }
        }
      }
    });
  }
  
  private getThemeByGrade(grade: number): string {
    if (grade <= 6) return 'colorful';
    if (grade <= 9) return 'blue';
    return 'dark';
  }
  
  private getSlideByNumber(flow: LessonFlow, slideNumber: number): GeneratedSlide | null {
    let count = 0;
    for (const section of flow.sections) {
      for (const slide of section.slides) {
        if (count === slideNumber) return slide;
        count++;
      }
    }
    return null;
  }
  
  private getSectionStartSlide(flow: LessonFlow, sectionIndex: number): number {
    let count = 0;
    for (let i = 0; i < sectionIndex; i++) {
      count += flow.sections[i].slides.length;
    }
    return count;
  }
  
  private insertSlideAfterCurrent(flow: LessonFlow, newSlide: GeneratedSlide): void {
    const currentSection = flow.sections[flow.currentSection];
    const insertIndex = flow.currentSlide - this.getSectionStartSlide(flow, flow.currentSection) + 1;
    
    currentSection.slides.splice(insertIndex, 0, newSlide);
    flow.totalSlides++;
    
    // Update slide numbers
    this.renumberSlides(flow);
  }
  
  private renumberSlides(flow: LessonFlow): void {
    let number = 0;
    for (const section of flow.sections) {
      for (const slide of section.slides) {
        slide.number = number++;
      }
    }
  }
  
  private async generateSlideHTML(flow: LessonFlow, slide: GeneratedSlide): Promise<string> {
    return slideGenerator.generateRealtimeSlideHTML(
      {
        id: `slide-${slide.number}`,
        type: slide.type as any,
        content: slide.content,
        duration: slide.duration,
        transitions: { in: 'fade', out: 'fade' }
      },
      flow.theme as any
    );
  }
  
  private async preGenerateUpcomingSlides(flow: LessonFlow, count: number): Promise<void> {
    // Generate next N slides in background
    setTimeout(async () => {
      for (let i = 1; i <= count; i++) {
        const slideNum = flow.currentSlide + i;
        if (slideNum >= flow.totalSlides) break;
        
        const slide = this.getSlideByNumber(flow, slideNum);
        if (slide && !slide.html) {
          slide.html = await this.generateSlideHTML(flow, slide);
        }
      }
    }, 100);
  }
  
  private trackSlideEngagement(flow: LessonFlow, slide: GeneratedSlide): void {
    // Track time spent
    if (!slide.userSpentTime) slide.userSpentTime = 0;
    
    // Update engagement score
    flow.engagementScore = Math.max(0, Math.min(100, 
      flow.engagementScore - (slide.userSpentTime > slide.duration * 2 ? 5 : 0)
    ));
    
    // Track interaction
    if (!slide.interactions) slide.interactions = [];
    slide.interactions.push({
      type: 'click',
      timestamp: new Date()
    });
  }
  
  private async completeLessonFlow(flow: LessonFlow): Promise<void> {
    // Mark all sections as completed
    flow.sections.forEach(s => s.completed = true);
    
    // Calculate final stats
    flow.actualDuration = Math.floor((Date.now() - flow.startTime.getTime()) / 1000);
    
    // Send completion event
    websocketService.sendToUser(flow.userId, 'lesson_completed', {
      lessonId: flow.lessonId,
      duration: flow.actualDuration,
      questionsAsked: flow.questionsAsked,
      engagementScore: flow.engagementScore,
      comprehensionLevel: flow.comprehensionLevel
    });
    
    // Clean up
    this.activeLessons.delete(`${flow.userId}-${flow.lessonId}`);
  }
  
  private extractContentForPoint(content: any, point: string): string {
    // Extract relevant content for a key point
    if (typeof content === 'string') return content.substring(0, 200);
    if (content[point]) return content[point];
    return `شرح مفصل عن ${point}`;
  }
  
  private generateBulletPoints(content: any, point: string): string[] {
    // Generate bullet points for a concept
    return [
      `التعريف: ${point}`,
      `الأهمية: لماذا ندرس ${point}`,
      `التطبيق: كيف نستخدم ${point}`,
      `ملاحظة: نقطة مهمة عن ${point}`
    ];
  }
  
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    return text.split(' ')
      .filter(word => word.length > 3)
      .slice(0, 5);
  }
  
  private getGradeFromFlow(flow: LessonFlow): number {
    // Extract grade from flow or default
    return 6; // Default, should be from lesson data
  }
  
  private async generateDetailedExplanation(flow: LessonFlow): Promise<void> {
    // Similar to generateExplanationSlide but more detailed
    await this.generateExplanationSlide(flow, flow.sections[flow.currentSection].title);
  }
  
  private async generateSimplifiedSlide(flow: LessonFlow): Promise<void> {
    const current = this.getSlideByNumber(flow, flow.currentSlide);
    if (!current) return;
    
    // Simplify current content
    const simplified: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'content',
      content: {
        title: 'شرح مبسط',
        text: `نسخة مبسطة من: ${current.content.title || 'المحتوى'}`
      },
      duration: 15
    };
    
    // Generate and insert
    simplified.html = await this.generateSlideHTML(flow, simplified);
    this.insertSlideAfterCurrent(flow, simplified);
    
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: simplified,
      reason: 'simplification_requested'
    });
  }
  
  private async suggestVideo(flow: LessonFlow): Promise<void> {
    // Suggest a YouTube video
    websocketService.sendToUser(flow.userId, 'video_suggestion', {
      url: 'https://youtube.com/example',
      title: `فيديو عن ${flow.sections[flow.currentSection].title}`,
      duration: '5:30'
    });
  }
}

// Export singleton
export const lessonOrchestrator = new LessonOrchestratorService();