// 📍 المكان: src/services/orchestrator/lesson-orchestrator.service.ts
// الوظيفة: تنسيق كل الخدمات وإدارة تدفق الدرس بذكاء مع دعم المكونات الرياضية

import { prisma } from '../../config/database.config';
import { websocketService } from '../websocket/websocket.service';
import { sessionService } from '../websocket/session.service';
import { realtimeChatService } from '../websocket/realtime-chat.service';
import { slideGenerator } from '../../core/video/slide.generator';
import { ragService } from '../../core/rag/rag.service';
import { openAIService } from '../ai/openai.service';
import type { Lesson, Unit, Subject } from '@prisma/client';

// استيراد المكونات الرياضية الجديدة
import { latexRenderer, type MathExpression } from '../../core/interactive/math/latex-renderer';
import { mathSlideGenerator } from '../../core/video/enhanced-slide.generator';

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
  
  // Math Settings (جديد)
  isMathLesson?: boolean;
  mathInteractive?: boolean;
  mathProblemsAttempted?: number;
  mathProblemsSolved?: number;
}

export interface LessonSection {
  id: string;
  type: 'intro' | 'concept' | 'example' | 'practice' | 'quiz' | 'summary' | 'math-concept' | 'math-practice';
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
  
  // Math content (جديد)
  mathExpressions?: MathExpression[];
  hasMathContent?: boolean;
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
  
  // Math properties (جديد)
  isMathSlide?: boolean;
  mathExpressions?: MathExpression[];
}

export interface SlideInteraction {
  type: 'click' | 'question' | 'replay' | 'skip' | 'math-variable-change' | 'equation-solve';
  timestamp: Date;
  data?: any;
}

export interface ActionTrigger {
  trigger: string; // الكلمة المفتاحية
  action: 'generate_slide' | 'show_example' | 'start_quiz' | 'explain_more' | 'simplify' | 'show_video' | 'show_math' | 'solve_equation';
  confidence: number;
  mathRelated?: boolean; // جديد
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
    
    // Check if it's a math lesson
    const isMathLesson = this.checkIfMathLesson(lesson);
    
    // Create lesson structure
    const sections = await this.createLessonSections(lesson, isMathLesson);
    
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
      theme: this.getThemeByGrade(lesson.unit.subject.grade),
      // Math properties
      isMathLesson,
      mathInteractive: isMathLesson,
      mathProblemsAttempted: 0,
      mathProblemsSolved: 0
    };
    
    // Store flow
    this.activeLessons.set(flowKey, flow);
    
    // Generate first slides
    await this.generateInitialSlides(flow);
    
    console.log(`✅ Lesson flow created: ${totalSlides} slides in ${sections.length} sections${isMathLesson ? ' (Math Lesson)' : ''}`);
    
    return flow;
  }
  
  /**
   * التحقق من كون الدرس رياضيات
   */
  private checkIfMathLesson(lesson: any): boolean {
    const subjectName = lesson.unit.subject.name.toLowerCase();
    const subjectNameEn = (lesson.unit.subject.nameEn || '').toLowerCase();
    
    return subjectName.includes('رياضيات') || 
           subjectName.includes('رياضة') ||
           subjectNameEn.includes('math') ||
           subjectNameEn.includes('algebra') ||
           subjectNameEn.includes('geometry');
  }
  
  /**
   * إنشاء هيكل الدرس بذكاء مع دعم المحتوى الرياضي
   */
  private async createLessonSections(lesson: any, isMathLesson: boolean): Promise<LessonSection[]> {
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
          duration: 5,
          isMathSlide: false
        },
        {
          number: 2,
          type: 'bullet',
          content: {
            title: 'ماذا سنتعلم اليوم؟',
            bullets: JSON.parse(lesson.objectives || '[]')
          },
          duration: 10,
          isMathSlide: false
        }
      ],
      duration: 15,
      completed: false,
      objectives: ['فهم موضوع الدرس', 'معرفة الأهداف'],
      keywords: ['مقدمة', 'أهداف'],
      anticipatedQuestions: ['ما هو موضوع الدرس؟', 'ماذا سنتعلم؟'],
      hasMathContent: false
    });
    
    // 2. Main Content Sections (from lesson content)
    const mainContent = JSON.parse(lesson.content || '{}');
    const keyPoints = JSON.parse(lesson.keyPoints || '[]');
    
    // قسّم المحتوى لأجزاء منطقية
    for (let i = 0; i < keyPoints.length; i++) {
      const point = keyPoints[i];
      const sectionSlides: GeneratedSlide[] = [];
      
      // Check if this point contains math content
      const hasMathInPoint = isMathLesson && this.detectMathContent(point);
      
      // Concept slide
      if (hasMathInPoint) {
        // Math concept slide
        const mathExpression = this.extractMathExpression(point);
        sectionSlides.push({
          number: sections.length * 3 + 1,
          type: 'math-content',
          content: {
            title: point,
            text: this.extractContentForPoint(mainContent, point),
            mathExpression: mathExpression
          },
          duration: 20,
          isMathSlide: true,
          mathExpressions: mathExpression ? [mathExpression] : []
        });
      } else {
        // Regular concept slide
        sectionSlides.push({
          number: sections.length * 3 + 1,
          type: 'content',
          content: {
            title: point,
            text: this.extractContentForPoint(mainContent, point)
          },
          duration: 15,
          isMathSlide: false
        });
      }
      
      // Bullet points slide
      sectionSlides.push({
        number: sections.length * 3 + 2,
        type: 'bullet',
        content: {
          title: `نقاط مهمة: ${point}`,
          bullets: this.generateBulletPoints(mainContent, point)
        },
        duration: 10,
        isMathSlide: false
      });
      
      sections.push({
        id: `concept-${i}`,
        type: hasMathInPoint ? 'math-concept' : 'concept',
        title: point,
        slides: sectionSlides,
        duration: hasMathInPoint ? 30 : 25,
        completed: false,
        objectives: [`فهم ${point}`, `تطبيق ${point}`],
        keywords: this.extractKeywords(point),
        anticipatedQuestions: [
          `ما معنى ${point}؟`,
          `كيف أطبق ${point}؟`,
          `أعطني مثال على ${point}`,
          ...(hasMathInPoint ? [`احسب ${point}`, `حل معادلة ${point}`] : [])
        ],
        hasMathContent: hasMathInPoint
      });
    }
    
    // 3. Examples Section (with math examples if applicable)
    const examples = JSON.parse(lesson.examples || '[]');
    if (examples.length > 0) {
      const exampleSlides: GeneratedSlide[] = [];
      
      for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        const hasMathExample = isMathLesson && this.detectMathContent(ex.content || ex);
        
        if (hasMathExample) {
          // Math example slide
          exampleSlides.push({
            number: sections.length * 2 + i + 1,
            type: 'math-example',
            content: {
              title: `مثال ${i + 1}`,
              problem: ex.problem || ex.content || ex,
              solution: ex.solution,
              equation: this.extractEquation(ex.content || ex)
            },
            duration: 20,
            isMathSlide: true
          });
        } else {
          // Regular example slide
          exampleSlides.push({
            number: sections.length * 2 + i + 1,
            type: 'content',
            content: {
              title: `مثال ${i + 1}`,
              text: ex.content || ex
            },
            duration: 12,
            isMathSlide: false
          });
        }
      }
      
      sections.push({
        id: 'examples',
        type: 'example',
        title: 'أمثلة تطبيقية',
        slides: exampleSlides,
        duration: exampleSlides.length * (isMathLesson ? 20 : 12),
        completed: false,
        objectives: ['فهم التطبيق العملي', 'ربط النظرية بالواقع'],
        keywords: ['مثال', 'تطبيق'],
        anticipatedQuestions: ['مثال آخر؟', 'كيف أحل هذا؟'],
        hasMathContent: isMathLesson
      });
    }
    
    // 4. Practice/Quiz Section (enhanced for math)
    const currentSlideCount = sections.reduce((sum, s) => sum + s.slides.length, 0);
    
    if (isMathLesson) {
      // Math practice section
      sections.push({
        id: 'math-practice',
        type: 'math-practice',
        title: 'تدريبات رياضية',
        slides: [
          {
            number: currentSlideCount + 1,
            type: 'math-problem',
            content: {
              title: 'حل المسألة التالية',
              problem: 'إذا كانت x + 5 = 12، فما قيمة x؟',
              hints: ['انقل 5 للطرف الآخر', 'غير الإشارة'],
              solution: 'x = 7'
            },
            duration: 30,
            isMathSlide: true
          },
          {
            number: currentSlideCount + 2,
            type: 'math-interactive',
            content: {
              title: 'معادلة تفاعلية',
              equation: 'ax^2 + bx + c = 0',
              variables: [
                { name: 'a', value: 1, min: -10, max: 10 },
                { name: 'b', value: 2, min: -10, max: 10 },
                { name: 'c', value: -3, min: -10, max: 10 }
              ]
            },
            duration: 40,
            isMathSlide: true
          }
        ],
        duration: 70,
        completed: false,
        objectives: ['حل المسائل', 'التطبيق العملي'],
        keywords: ['تدريب', 'حل', 'معادلة'],
        anticipatedQuestions: ['كيف أحل هذا؟', 'ما هي الخطوات؟'],
        hasMathContent: true
      });
    } else {
      // Regular practice section
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
            duration: 20,
            isMathSlide: false
          }
        ],
        duration: 20,
        completed: false,
        objectives: ['اختبار الفهم', 'التطبيق العملي'],
        keywords: ['تدريب', 'اختبار'],
        anticipatedQuestions: ['هل الإجابة صحيحة؟', 'اشرح لي الحل'],
        hasMathContent: false
      });
    }
    
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
          duration: 15,
          isMathSlide: false
        }
      ],
      duration: 15,
      completed: false,
      objectives: ['مراجعة النقاط المهمة'],
      keywords: ['ملخص', 'مراجعة'],
      anticipatedQuestions: ['ما أهم نقطة؟', 'ماذا بعد؟'],
      hasMathContent: false
    });
    
    return sections;
  }
  
  /**
   * توليد الشرائح الأولية مع دعم المحتوى الرياضي
   */
  private async generateInitialSlides(flow: LessonFlow): Promise<void> {
    // Generate first 5 slides HTML
    const slidesToGenerate = Math.min(5, flow.totalSlides);
    
    for (let i = 0; i < slidesToGenerate; i++) {
      const slide = this.getSlideByNumber(flow, i);
      if (!slide) continue;
      
      // Generate HTML based on slide type
      if (slide.isMathSlide) {
        // Generate math slide
        slide.html = await this.generateMathSlideHTML(slide, flow);
      } else {
        // Generate regular slide
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
  }
  
  /**
   * توليد HTML لشريحة رياضية
   */
  private async generateMathSlideHTML(slide: GeneratedSlide, flow: LessonFlow): Promise<string> {
    const content = slide.content;
    
    switch (slide.type) {
      case 'math-content':
        // Math concept slide
        const expression = content.mathExpression || this.createDefaultExpression(content.title);
        return await mathSlideGenerator.generateMathSlide({
          title: content.title,
          mathExpressions: [expression],
          text: content.text,
          interactive: flow.mathInteractive || false
        });
        
      case 'math-example':
        // Math example slide
        return await mathSlideGenerator.generateMathProblemSlide({
          title: content.title,
          question: content.problem,
          equation: content.equation,
          solution: content.solution,
          hints: ['فكر في الخطوات', 'راجع القانون']
        });
        
      case 'math-problem':
        // Math practice problem
        return await mathSlideGenerator.generateMathProblemSlide({
          title: content.title,
          question: content.problem,
          hints: content.hints,
          solution: content.solution
        });
        
      case 'math-interactive':
        // Interactive math slide
        const quadratic = latexRenderer.getCommonExpressions().quadratic;
        quadratic.variables = content.variables || quadratic.variables;
        
        return await mathSlideGenerator.generateMathSlide({
          title: content.title,
          mathExpressions: [quadratic],
          interactive: true,
          showSteps: true
        });
        
      default:
        // Fallback to regular slide
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
        type: flow.sections[flow.currentSection].type,
        hasMathContent: flow.sections[flow.currentSection].hasMathContent
      });
    }
    
    // Get slide
    const slide = this.getSlideByNumber(flow, flow.currentSlide);
    if (!slide) return null;
    
    // Generate HTML if not exists
    if (!slide.html) {
      if (slide.isMathSlide) {
        slide.html = await this.generateMathSlideHTML(slide, flow);
      } else {
        slide.html = await this.generateSlideHTML(flow, slide);
      }
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
   * معالجة رسالة من المستخدم وتحليل النية مع دعم المحتوى الرياضي
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
   * تحليل رسالة المستخدم وتحديد الإجراء المناسب مع دعم الرياضيات
   */
  private async analyzeMessageIntent(
    message: string,
    flow: LessonFlow
  ): Promise<ActionTrigger | null> {
    const lowerMessage = message.toLowerCase();
    
    // Math-specific patterns (أولوية عالية)
    if (flow.isMathLesson) {
      const mathPatterns: Array<{pattern: RegExp | string[], action: ActionTrigger['action']}> = [
        {
          pattern: ['احسب', 'حل المعادلة', 'حل المسألة', 'solve', 'calculate'],
          action: 'solve_equation'
        },
        {
          pattern: ['معادلة', 'equation', 'دالة', 'function', 'رسم بياني', 'graph'],
          action: 'show_math'
        },
        {
          pattern: ['خطوات الحل', 'كيف أحل', 'طريقة الحل', 'steps'],
          action: 'show_math'
        }
      ];
      
      for (const { pattern, action } of mathPatterns) {
        const matches = Array.isArray(pattern)
          ? pattern.some(p => lowerMessage.includes(p))
          : pattern.test(lowerMessage);
          
        if (matches) {
          return {
            trigger: message,
            action,
            confidence: 0.9,
            mathRelated: true
          };
        }
      }
    }
    
    // General patterns
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
          confidence: 0.85,
          mathRelated: false
        };
      }
    }
    
    // Use AI for complex intent analysis if no pattern matches
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `
تحليل نية المستخدم في سياق درس تعليمي${flow.isMathLesson ? ' رياضي' : ''}.
الرسالة: "${message}"
السياق: درس عن ${flow.sections[flow.currentSection].title}

حدد الإجراء المناسب من:
- explain_more: يريد شرح إضافي
- show_example: يريد مثال
- start_quiz: يريد تمرين
- simplify: يريد تبسيط
- generate_slide: يريد شريحة جديدة
${flow.isMathLesson ? '- show_math: يريد معادلة أو رسم\n- solve_equation: يريد حل معادلة' : ''}
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
            confidence: 0.75,
            mathRelated: ['show_math', 'solve_equation'].includes(actionStr)
          };
        }
      } catch (error) {
        console.error('Intent analysis failed:', error);
      }
    }
    
    return null;
  }
  
  /**
   * تنفيذ الإجراء المطلوب مع دعم الإجراءات الرياضية
   */
  private async executeAction(flow: LessonFlow, action: ActionTrigger): Promise<void> {
    console.log(`🎬 Executing action: ${action.action}${action.mathRelated ? ' (Math)' : ''}`);
    
    switch (action.action) {
      case 'generate_slide':
        await this.generateExplanationSlide(flow, action.trigger);
        break;
        
      case 'show_example':
        if (flow.isMathLesson) {
          await this.generateMathExampleSlide(flow);
        } else {
          await this.generateExampleSlide(flow);
        }
        break;
        
      case 'start_quiz':
        if (flow.isMathLesson) {
          await this.generateMathQuizSlide(flow);
        } else {
          await this.generateQuizSlide(flow);
        }
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
        
      // Math-specific actions
      case 'show_math':
        await this.generateInteractiveMathSlide(flow, action.trigger);
        break;
        
      case 'solve_equation':
        await this.generateSolutionSlide(flow, action.trigger);
        break;
    }
    
    // Notify user
    websocketService.sendToUser(flow.userId, 'action_executed', {
      action: action.action,
      trigger: action.trigger,
      mathRelated: action.mathRelated
    });
  }
  
  /**
   * توليد شريحة رياضية تفاعلية
   */
  private async generateInteractiveMathSlide(flow: LessonFlow, topic: string): Promise<void> {
    console.log(`🧮 Generating interactive math slide for: ${topic}`);
    
    // Determine which type of math content to generate
    let mathExpression: MathExpression;
    
    if (topic.includes('تربيعية') || topic.includes('quadratic')) {
      mathExpression = latexRenderer.getCommonExpressions().quadratic;
    } else if (topic.includes('فيثاغورس') || topic.includes('pythagorean')) {
      mathExpression = latexRenderer.getCommonExpressions().pythagorean;
    } else if (topic.includes('كسر') || topic.includes('fraction')) {
      mathExpression = latexRenderer.getCommonExpressions().fraction;
    } else {
      // Generate custom expression based on topic
      mathExpression = {
        id: 'custom',
        latex: 'f(x) = mx + b',
        type: 'equation',
        description: topic,
        isInteractive: true,
        variables: [
          { name: 'm', value: 2, min: -10, max: 10, step: 1 },
          { name: 'b', value: 3, min: -10, max: 10, step: 1 }
        ]
      };
    }
    
    // Generate HTML
    const html = await mathSlideGenerator.generateMathSlide({
      title: `معادلة تفاعلية: ${topic}`,
      mathExpressions: [mathExpression],
      text: `استخدم الأشرطة المتحركة لتغيير قيم المتغيرات ولاحظ التأثير على المعادلة`,
      interactive: true,
      showSteps: true
    });
    
    // Create new slide
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'math-interactive',
      content: {
        title: `معادلة تفاعلية`,
        expression: mathExpression
      },
      duration: 30,
      html,
      isMathSlide: true,
      mathExpressions: [mathExpression]
    };
    
    // Insert and notify
    this.insertSlideAfterCurrent(flow, newSlide);
    if (flow.mathProblemsAttempted !== undefined) flow.mathProblemsAttempted++;
    
    websocketService.sendToUser(flow.userId, 'math_slide_generated', {
      slide: newSlide,
      reason: 'interactive_math_requested'
    });
  }
  
  /**
   * توليد شريحة حل معادلة
   */
  private async generateSolutionSlide(flow: LessonFlow, equation: string): Promise<void> {
    console.log(`🔢 Generating solution slide for: ${equation}`);
    
    // Extract equation from message
    const extractedEquation = this.extractEquation(equation) || 'x + 5 = 10';
    
    // Generate solution steps
    const steps = await this.generateSolutionSteps(extractedEquation);
    
    // Create math expression with steps
    const mathExpression: MathExpression = {
      id: 'solution',
      latex: extractedEquation,
      type: 'equation',
      description: 'حل المعادلة خطوة بخطوة',
      steps: steps
    };
    
    // Generate HTML
    const html = await mathSlideGenerator.generateMathProblemSlide({
      title: 'حل المعادلة',
      question: equation,
      equation: extractedEquation,
      solution: steps[steps.length - 1]?.latex || 'x = ?',
      steps: steps
    });
    
    // Create new slide
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'math-solution',
      content: {
        title: 'حل المعادلة',
        equation: extractedEquation,
        steps: steps
      },
      duration: 40,
      html,
      isMathSlide: true,
      mathExpressions: [mathExpression]
    };
    
    // Insert and notify
    this.insertSlideAfterCurrent(flow, newSlide);
    if (flow.mathProblemsSolved !== undefined) flow.mathProblemsSolved++;
    
    websocketService.sendToUser(flow.userId, 'solution_slide_generated', {
      slide: newSlide,
      reason: 'solution_requested'
    });
  }
  
  /**
   * توليد شريحة مثال رياضي
   */
  private async generateMathExampleSlide(flow: LessonFlow): Promise<void> {
    const currentSection = flow.sections[flow.currentSection];
    
    // Generate math example
    const example = {
      title: `مثال رياضي: ${currentSection.title}`,
      question: 'إذا كانت س + 3 = 10، فما قيمة س؟',
      solution: 'س = 7',
      equation: 'x + 3 = 10'
    };
    
    // Generate HTML
    const html = await mathSlideGenerator.generateMathProblemSlide(example);
    
    // Create slide
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'math-example',
      content: example,
      duration: 25,
      html,
      isMathSlide: true
    };
    
    // Insert and notify
    this.insertSlideAfterCurrent(flow, newSlide);
    
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: newSlide,
      reason: 'math_example_requested'
    });
  }
  
  /**
   * توليد شريحة اختبار رياضي
   */
  private async generateMathQuizSlide(flow: LessonFlow): Promise<void> {
    const currentSection = flow.sections[flow.currentSection];
    
    // Generate math quiz
    const quiz = {
      title: 'اختبار سريع',
      problem: 'حل المعادلة: 2x - 4 = 10',
      options: ['x = 7', 'x = 3', 'x = 5', 'x = 14'],
      correctIndex: 0,
      solution: 'x = 7',
      explanation: 'نضيف 4 للطرفين: 2x = 14، ثم نقسم على 2: x = 7'
    };
    
    // Generate HTML
    const html = await mathSlideGenerator.generateMathProblemSlide({
      title: quiz.title,
      question: quiz.problem,
      solution: quiz.solution,
      hints: ['أضف 4 للطرفين أولاً', 'ثم اقسم على 2']
    });
    
    // Create quiz slide
    const newSlide: GeneratedSlide = {
      number: flow.totalSlides,
      type: 'math-quiz',
      content: { quiz },
      duration: 35,
      html,
      isMathSlide: true
    };
    
    // Insert and notify
    this.insertSlideAfterCurrent(flow, newSlide);
    if (flow.mathProblemsAttempted !== undefined) flow.mathProblemsAttempted++;
    
    websocketService.sendToUser(flow.userId, 'slide_generated', {
      slide: newSlide,
      reason: 'math_quiz_requested'
    });
  }
  
  // ============= MATH HELPER METHODS (جديد) =============
  
  /**
   * اكتشاف المحتوى الرياضي في النص
   */
  private detectMathContent(text: string): boolean {
    if (!text) return false;
    
    const mathIndicators = [
      // Arabic
      'معادلة', 'حل', 'احسب', 'رقم', 'عدد', 'جمع', 'طرح', 'ضرب', 'قسمة',
      'مربع', 'جذر', 'أس', 'كسر', 'نسبة', 'متغير', 'دالة', 'رسم بياني',
      // English
      'equation', 'solve', 'calculate', 'number', 'add', 'subtract',
      'multiply', 'divide', 'square', 'root', 'power', 'fraction',
      'ratio', 'variable', 'function', 'graph',
      // Math symbols
      '+', '-', '×', '÷', '=', 'x', 'y', '^', '²', '³'
    ];
    
    const lowerText = text.toLowerCase();
    return mathIndicators.some(indicator => lowerText.includes(indicator));
  }
  
  /**
   * استخراج المعادلة من النص
   */
  private extractEquation(text: string): string | null {
    // Simple pattern matching for equations
    const patterns = [
      /([a-z0-9\s\+\-\*\/\^\(\)]+)\s*=\s*([a-z0-9\s\+\-\*\/\^\(\)]+)/i,
      /([س-ي]\s*[\+\-\*\/]\s*\d+)\s*=\s*(\d+)/,
      /(\d+[a-z])\s*[\+\-]\s*(\d+)\s*=\s*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return null;
  }
  
  /**
   * استخراج تعبير رياضي من النص
   */
  private extractMathExpression(text: string): MathExpression | null {
    const equation = this.extractEquation(text);
    if (!equation) return null;
    
    return {
      id: 'extracted',
      latex: equation.replace(/س/g, 'x').replace(/ص/g, 'y'),
      type: 'equation',
      description: text
    };
  }
  
  /**
   * إنشاء تعبير رياضي افتراضي
   */
  private createDefaultExpression(title: string): MathExpression {
    return {
      id: 'default',
      latex: 'ax + b = c',
      type: 'equation',
      description: title,
      isInteractive: true,
      variables: [
        { name: 'a', value: 2, min: -10, max: 10, step: 1 },
        { name: 'b', value: 3, min: -10, max: 10, step: 1 },
        { name: 'c', value: 7, min: -10, max: 10, step: 1 }
      ]
    };
  }
  
  /**
   * توليد خطوات الحل
   */
  private async generateSolutionSteps(equation: string): Promise<any[]> {
    // Simple solution steps generator
    // In production, use OpenAI or a math solver library
    
    const steps = [
      {
        stepNumber: 1,
        latex: equation,
        explanation: 'المعادلة الأصلية',
        highlight: []
      },
      {
        stepNumber: 2,
        latex: equation.replace('=', '\\Rightarrow'),
        explanation: 'نبدأ بتبسيط المعادلة',
        highlight: []
      },
      {
        stepNumber: 3,
        latex: 'x = ?',
        explanation: 'الحل النهائي',
        highlight: ['x']
      }
    ];
    
    return steps;
  }
  
  // ============= ORIGINAL HELPER METHODS =============
  
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
          if (slide.isMathSlide) {
            slide.html = await this.generateMathSlideHTML(slide, flow);
          } else {
            slide.html = await this.generateSlideHTML(flow, slide);
          }
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
      type: slide.isMathSlide ? 'math-variable-change' : 'click',
      timestamp: new Date()
    });
  }
  
  private async completeLessonFlow(flow: LessonFlow): Promise<void> {
    // Mark all sections as completed
    flow.sections.forEach(s => s.completed = true);
    
    // Calculate final stats
    flow.actualDuration = Math.floor((Date.now() - flow.startTime.getTime()) / 1000);
    
    // Send completion event with math stats
    websocketService.sendToUser(flow.userId, 'lesson_completed', {
      lessonId: flow.lessonId,
      duration: flow.actualDuration,
      questionsAsked: flow.questionsAsked,
      engagementScore: flow.engagementScore,
      comprehensionLevel: flow.comprehensionLevel,
      // Math stats
      isMathLesson: flow.isMathLesson,
      mathProblemsAttempted: flow.mathProblemsAttempted || 0,
      mathProblemsSolved: flow.mathProblemsSolved || 0
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
      duration: 15,
      isMathSlide: false
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
  
  // Existing helper methods remain unchanged...
  
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
      duration: 20,
      isMathSlide: false
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
      duration: 15,
      isMathSlide: false
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
      duration: 30,
      isMathSlide: false
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
}

// Export singleton
export const lessonOrchestrator = new LessonOrchestratorService();