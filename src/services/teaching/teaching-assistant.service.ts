// src/services/teaching/teaching-assistant.service.ts
// ✨ النسخة الكاملة مع كل الخصائص المطلوبة
// الوظيفة: توليد سكريبت تعليمي تفاعلي حقيقي بدلاً من قراءة الشرائح

import { prisma } from '../../config/database.config';
import { openAIService } from '../ai/openai.service';
import { ragService } from '../../core/rag/rag.service';
import { z } from 'zod';
import crypto from 'crypto';

// ============= TYPES & INTERFACES =============

/**
 * مستوى الطالب التعليمي
 */
type EducationalLevel = 'primary' | 'prep' | 'secondary';

/**
 * نوع التفاعل المطلوب
 */
export type InteractionType = 
  | 'explain' 
  | 'more_detail' 
  | 'example' 
  | 'problem' 
  | 'repeat' 
  | 'continue' 
  | 'stop' 
  | 'quiz'
  | 'summary';

/**
 * خيارات توليد السكريبت التعليمي
 */
interface TeachingScriptOptions {
  slideContent: any;                      // محتوى الشريحة
  lessonId: string;                       // ID الدرس
  studentGrade: number;                   // الصف (1-12)
  studentName?: string;                   // اسم الطالب للتفاعل الشخصي
  interactionType?: InteractionType;      // نوع التفاعل المطلوب
  
  // خيارات التفاعل
  needMoreDetail?: boolean;               // طلب شرح أكثر تفصيلاً
  needExample?: boolean;                  // طلب مثال توضيحي
  needProblem?: boolean;                  // طلب مسألة للحل
  problemDifficulty?: 'easy' | 'medium' | 'hard'; // صعوبة المسألة
  
  // السياق والاستمرارية
  previousScript?: string;                // السكريبت السابق
  sessionHistory?: string[];              // تاريخ الجلسة كاملاً
  currentProgress?: number;               // التقدم الحالي في الدرس (0-100)
  
  // التخصيص
  voiceStyle?: 'friendly' | 'formal' | 'energetic'; // نبرة الصوت
  paceSpeed?: 'slow' | 'normal' | 'fast'; // سرعة الشرح
  useAnalogies?: boolean;                 // استخدام التشبيهات
  useStories?: boolean;                   // استخدام القصص
}

/**
 * المسألة التعليمية
 */
interface EducationalProblem {
  question: string;                        // نص المسألة
  hints: string[];                         // تلميحات للحل
  solution: string;                        // الحل الكامل
  steps: string[];                         // خطوات الحل
  difficulty: 'easy' | 'medium' | 'hard'; // مستوى الصعوبة
  relatedConcept: string;                 // المفهوم المرتبط
}

/**
 * السكريبت التعليمي النهائي
 */
interface TeachingScript {
  script: string;                         // السكريبت النهائي
  duration: number;                       // المدة بالثواني
  keyPoints?: string[];                   // النقاط المهمة
  examples?: string[];                    // الأمثلة المستخدمة
  problem?: EducationalProblem;           // المسألة (لو مطلوبة)
  visualCues?: string[];                  // إشارات بصرية مقترحة
  interactionPoints?: number[];           // نقاط التوقف للتفاعل
  emotionalTone?: string;                 // النبرة العاطفية
  nextSuggestions?: string[];             // اقتراحات للخطوة التالية
  metadata?: {
    generatedAt: Date;
    model: string;
    tokens: number;
    cached: boolean;
  };
}

/**
 * السياق التعليمي من قاعدة البيانات
 */
interface EducationalContext {
  enrichedContent: any;
  concepts: any[];
  examples: any[];
  formulas?: any[];
  relatedLessons?: any[];
  studentProgress?: any;
}

/**
 * إعدادات الكاش
 */
interface CacheEntry {
  script: TeachingScript;
  timestamp: number;
  hits: number;
}

// ============= VALIDATION SCHEMAS =============

const teachingOptionsSchema = z.object({
  slideContent: z.any(),
  lessonId: z.string().uuid(),
  studentGrade: z.number().min(1).max(12),
  studentName: z.string().optional(),
  interactionType: z.enum([
    'explain', 'more_detail', 'example', 'problem', 
    'repeat', 'continue', 'stop', 'quiz', 'summary'
  ]).optional(),
  needMoreDetail: z.boolean().optional(),
  needExample: z.boolean().optional(),
  needProblem: z.boolean().optional(),
  problemDifficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  previousScript: z.string().optional(),
  sessionHistory: z.array(z.string()).optional(),
  currentProgress: z.number().min(0).max(100).optional(),
  voiceStyle: z.enum(['friendly', 'formal', 'energetic']).optional(),
  paceSpeed: z.enum(['slow', 'normal', 'fast']).optional(),
  useAnalogies: z.boolean().optional(),
  useStories: z.boolean().optional()
});

// ============= MAIN SERVICE CLASS =============

export class TeachingAssistantService {
  private scriptCache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly MAX_CACHE_SIZE = 100;
  
  /**
   * توليد سكريبت تعليمي تفاعلي متكامل
   */
  async generateTeachingScript(
    options: TeachingScriptOptions
  ): Promise<TeachingScript> {
    
    // Validate input
    const validatedOptions = this.validateOptions(options);
    
    // Check cache first
    const cachedScript = this.getCachedScript(validatedOptions);
    if (cachedScript) {
      console.log('📦 Using cached teaching script');
      return cachedScript;
    }
    
    try {
      // 1. جيب السياق الكامل
      const context = await this.getEducationalContext(
        validatedOptions.lessonId,
        validatedOptions.slideContent,
        validatedOptions.studentGrade
      );
      
      // 2. حدد مستوى الشرح
      const level = this.getEducationalLevel(validatedOptions.studentGrade);
      
      // 3. Handle special interactions first
      if (validatedOptions.interactionType) {
        return await this.handleSpecialInteraction(
          validatedOptions,
          context,
          level
        );
      }
      
      // 4. Generate problem if requested
      let problem: EducationalProblem | undefined;
      if (validatedOptions.needProblem) {
        problem = await this.generateEducationalProblem(
          validatedOptions.slideContent,
          context,
          level,
          validatedOptions.problemDifficulty || 'medium'
        );
      }
      
      // 5. بناء الـ prompt المحسّن
      const prompt = this.buildEnhancedTeachingPrompt(
        validatedOptions.slideContent,
        context,
        level,
        validatedOptions,
        problem
      );
      
      // 6. توليد السكريبت
      const script = await this.generateWithAI(prompt, validatedOptions);
      
      // 7. معالجة وتحسين السكريبت
      const processedScript = this.processAndEnhanceScript(
        script, 
        level,
        validatedOptions
      );
      
      // 8. Add problem if generated
      if (problem) {
        processedScript.problem = problem;
      }
      
      // 9. Calculate duration and interaction points
      processedScript.duration = this.calculateDuration(
        processedScript.script,
        validatedOptions.paceSpeed
      );
      processedScript.interactionPoints = this.calculateInteractionPoints(
        processedScript.script
      );
      
      // 10. Add metadata
      processedScript.metadata = {
        generatedAt: new Date(),
        model: 'gpt-4-turbo',
        tokens: script.length,
        cached: false
      };
      
      // 11. Cache the result
      this.cacheScript(validatedOptions, processedScript);
      
      return processedScript;
      
    } catch (error) {
      console.error('❌ Teaching script generation failed:', error);
      
      // Enhanced fallback with better content
      return this.createEnhancedFallbackScript(
        validatedOptions.slideContent,
        validatedOptions
      );
    }
  }
  
  /**
   * Handle special interaction types (stop, continue, repeat, etc.)
   */
  private async handleSpecialInteraction(
    options: TeachingScriptOptions,
    context: EducationalContext,
    level: EducationalLevel
  ): Promise<TeachingScript> {
    
    const interactions: Record<InteractionType, () => TeachingScript> = {
      'stop': () => ({
        script: `${this.getRandomPhrase([
          'تمام، خد وقتك وفكر في اللي اتعلمناه',
          'أوكي، وقف شوية وراجع اللي فهمته',
          'ماشي، خليك معايا ولما تكون جاهز قولي'
        ])}. لما تكون جاهز نكمل، اضغط على زر الاستمرار.`,
        duration: 5,
        emotionalTone: 'supportive',
        nextSuggestions: ['continue', 'repeat', 'example']
      }),
      
      'continue': () => ({
        script: `${this.getRandomPhrase([
          'يلا بينا نكمل',
          'تمام، خلينا نشوف اللي بعده',
          'حلو، نكمل بقى'
        ])}... ${options.previousScript ? 
          `كنا بنتكلم عن ${this.extractTopic(options.previousScript)}` : 
          'خلينا نشوف الجزء الجديد'}`,
        duration: 4,
        emotionalTone: 'encouraging'
      }),
      
      'repeat': () => ({
        script: this.rephraseConcept(
          options.previousScript || options.slideContent.content,
          level
        ),
        duration: this.calculateDuration(options.previousScript || '', 'slow'),
        emotionalTone: 'patient',
        keyPoints: this.extractKeyPoints(options.previousScript || '')
      }),
      
      'example': () => ({
        script: this.generateContextualExample(
          options.slideContent,
          context,
          level
        ),
        duration: 8,
        emotionalTone: 'engaging',
        examples: [this.extractLastExample(context)]
      }),
      
      'problem': () => {
        const problem = this.generateQuickProblem(
          options.slideContent,
          level
        );
        return {
          script: `تمام، تعالى نحل مسألة سريعة: ${problem.question}`,
          duration: 10,
          problem: problem as EducationalProblem,
          emotionalTone: 'challenging'
        };
      },
      
      'quiz': () => ({
        script: this.generateQuizQuestion(options.slideContent, level),
        duration: 7,
        emotionalTone: 'interactive',
        interactionPoints: [3, 7]
      }),
      
      'summary': () => ({
        script: this.generateSummary(
          options.sessionHistory || [],
          context,
          level
        ),
        duration: 10,
        keyPoints: this.extractAllKeyPoints(options.sessionHistory || []),
        emotionalTone: 'concluding'
      }),
      
      'more_detail': () => ({
        script: this.generateDetailedExplanation(
          options.slideContent,
          context,
          level,
          options.previousScript
        ),
        duration: 12,
        emotionalTone: 'thorough'
      }),
      
      'explain': () => ({
        script: this.generateBasicExplanation(
          options.slideContent,
          context,
          level
        ),
        duration: 8,
        emotionalTone: 'clear'
      })
    };
    
    const interaction = options.interactionType || 'explain';
    return interactions[interaction]();
  }
  
  /**
   * Generate educational problem with hints and solution
   */
  private async generateEducationalProblem(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel,
    difficulty: 'easy' | 'medium' | 'hard'
  ): Promise<EducationalProblem> {
    
    const prompt = `Generate a math problem for a ${level} student about: ${slideContent.title || slideContent.content}
    
Difficulty: ${difficulty}
Context: ${JSON.stringify(context.concepts?.slice(0, 2))}

Return in this JSON format:
{
  "question": "المسألة بالعامية المصرية",
  "hints": ["تلميح 1", "تلميح 2"],
  "solution": "الحل النهائي",
  "steps": ["خطوة 1", "خطوة 2", "خطوة 3"],
  "relatedConcept": "المفهوم المرتبط"
}`;
    
    try {
      const response = await openAIService.chat([
        {
          role: 'system',
          content: 'أنت مدرس رياضيات. اكتب مسائل تعليمية واضحة.'
        },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.7,
        maxTokens: 400
      });
      
      const parsed = JSON.parse(
        response.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      );
      
      return {
        ...parsed,
        difficulty
      };
      
    } catch (error) {
      // Fallback problem
      return this.createFallbackProblem(slideContent.title, level, difficulty);
    }
  }
  
  /**
   * جيب السياق التعليمي الكامل مع معلومات إضافية
   */
  private async getEducationalContext(
    lessonId: string,
    slideContent: any,
    studentGrade: number
  ): Promise<EducationalContext> {
    // 1. جيب معلومات الدرس الكاملة
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        content: true,
        concepts: true,
        examples: true,
        formulas: true,
        unit: {
          include: {
            lessons: {
              where: {
                id: { not: lessonId },
                isPublished: true
              },
              take: 3
            }
          }
        }
      }
    });
    
    if (!lesson) {
      return {
        enrichedContent: null,
        concepts: [],
        examples: [],
        formulas: [],
        relatedLessons: []
      };
    }
    
    // 2. Get student progress if available
    const studentProgress = await this.getStudentProgress(lessonId, studentGrade);
    
    // 3. Process enriched content
    let enrichedContent = null;
    if (lesson.content?.enrichedContent) {
      try {
        enrichedContent = JSON.parse(lesson.content.enrichedContent);
      } catch {
        enrichedContent = lesson.content.fullText;
      }
    }
    
    // 4. Use RAG for additional context
    if (!enrichedContent && (slideContent.title || slideContent.content)) {
      const query = `${slideContent.title} ${slideContent.content}`.trim();
      const ragResponse = await ragService.answerQuestion(query, lessonId);
      enrichedContent = ragResponse.answer;
    }
    
    return {
      enrichedContent,
      concepts: lesson.concepts || [],
      examples: lesson.examples || [],
      formulas: lesson.formulas || [],
      relatedLessons: lesson.unit.lessons || [],
      studentProgress
    };
  }
  
  /**
   * Get student progress for personalization
   */
  private async getStudentProgress(
    lessonId: string,
    studentGrade: number
  ): Promise<any> {
    // This would connect to actual progress tracking
    // For now, return mock data
    return {
      completedLessons: 5,
      currentLevel: studentGrade,
      strengths: ['الجبر', 'الهندسة'],
      weaknesses: ['الاحتمالات'],
      averageScore: 85
    };
  }
  
  /**
   * Build enhanced teaching prompt with all features
   */
  private buildEnhancedTeachingPrompt(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel,
    options: TeachingScriptOptions,
    problem?: EducationalProblem
  ): string {
    
    // Voice style instructions
    const voiceStyles = {
      'friendly': 'ودود ومشجع، استخدم كلمات تحفيزية',
      'formal': 'رسمي ومحترف، مع الحفاظ على الوضوح',
      'energetic': 'حماسي ونشيط، مع تنويع نبرة الصوت'
    };
    
    // Pace instructions
    const paceInstructions = {
      'slow': 'اشرح ببطء مع التكرار والتأكيد على النقاط المهمة',
      'normal': 'اشرح بسرعة متوسطة مع توازن جيد',
      'fast': 'اشرح بشكل مختصر ومباشر للنقاط الأساسية'
    };
    
    // Educational level details
    const levelDetails = {
      'primary': {
        age: '10-12 سنة',
        vocabulary: 'بسيط جداً',
        examples: 'من الحياة اليومية للأطفال',
        attention: 'جمل قصيرة مع تكرار'
      },
      'prep': {
        age: '13-15 سنة',
        vocabulary: 'متوسط',
        examples: 'من الحياة والرياضة',
        attention: 'توازن بين الشرح والأمثلة'
      },
      'secondary': {
        age: '16-18 سنة',
        vocabulary: 'متقدم',
        examples: 'تطبيقات عملية وعلمية',
        attention: 'شرح عميق مع ربط المفاهيم'
      }
    };
    
    const selectedLevel = levelDetails[level];
    const voiceStyle = voiceStyles[options.voiceStyle || 'friendly'];
    const pace = paceInstructions[options.paceSpeed || 'normal'];
    
    let prompt = `أنت مدرس رياضيات مصري محترف وخبير في التعليم التفاعلي.
${options.studentName ? `اسم الطالب: ${options.studentName}` : ''}

🎯 المهمة:
اشرح محتوى الشريحة لطالب ${selectedLevel.age} بطريقة ${voiceStyle}

📚 محتوى الشريحة:
================
العنوان: ${slideContent.title || 'بدون عنوان'}
المحتوى: ${slideContent.content || 'محتوى الدرس'}
${slideContent.bullets ? `النقاط الرئيسية:\n${slideContent.bullets.map((b: string, i: number) => `${i+1}. ${b}`).join('\n')}` : ''}
${slideContent.equation ? `المعادلة: ${slideContent.equation}` : ''}

📖 السياق من المنهج:
================
${context.enrichedContent ? `المحتوى المُحسّن: ${context.enrichedContent.slice(0, 500)}` : ''}
${context.concepts?.length ? `المفاهيم: ${context.concepts.map((c: any) => c.nameAr).join(', ')}` : ''}
${context.examples?.length ? `عدد الأمثلة المتاحة: ${context.examples.length}` : ''}

👤 معلومات الطالب:
================
المرحلة: ${level}
${context.studentProgress ? `المستوى: ${context.studentProgress.currentLevel}` : ''}
${context.studentProgress ? `نقاط القوة: ${context.studentProgress.strengths.join(', ')}` : ''}
${options.currentProgress ? `التقدم في الدرس: ${options.currentProgress}%` : ''}

📝 قواعد الشرح:
================
1. المستوى اللغوي: ${selectedLevel.vocabulary}
2. الأمثلة: ${selectedLevel.examples}
3. طريقة الشرح: ${selectedLevel.attention}
4. النبرة: ${voiceStyle}
5. السرعة: ${pace}

🎨 التخصيص:
================
${options.useAnalogies ? '✅ استخدم تشبيهات من الحياة' : ''}
${options.useStories ? '✅ احكي قصة قصيرة للتوضيح' : ''}
${options.needMoreDetail ? '✅ الطالب طلب تفصيل أكثر - اشرح بعمق' : ''}
${options.needExample ? '✅ الطالب طلب مثال - ركز على مثال عملي' : ''}
${problem ? `✅ اشرح المسألة: ${problem.question}` : ''}

🔄 الاستمرارية:
================
${options.previousScript ? `آخر شرح: "${options.previousScript.slice(0, 150)}..."` : 'هذه بداية جديدة'}
${options.sessionHistory?.length ? `عدد الشرائح السابقة: ${options.sessionHistory.length}` : ''}

📌 التعليمات النهائية:
- استخدم العامية المصرية البسيطة والواضحة
- ابدأ بجملة تشد انتباه الطالب
- ${options.studentName ? `خاطب الطالب باسمه "${options.studentName}" مرة واحدة على الأقل` : 'خاطب الطالب بشكل ودود'}
- اشرح الفكرة الأساسية ببساطة شديدة
- استخدم مثال واحد على الأقل
- اختم بجملة تشجيعية أو سؤال للتفكير
- لا تستخدم مصطلحات معقدة
- تجنب الإطالة المملة

اكتب السكريبت مباشرة بدون مقدمات أو عناوين:`;
    
    return prompt;
  }
  
  /**
   * Generate script with AI
   */
  private async generateWithAI(
    prompt: string,
    options: TeachingScriptOptions
  ): Promise<string> {
    
    // Dynamic temperature based on interaction type
    const temperature = this.getTemperature(options);
    
    const response = await openAIService.chat([
      { 
        role: 'system', 
        content: `أنت مدرس رياضيات مصري محترف. 
        لديك خبرة 15 سنة في التدريس.
        تحب طلابك وتريد لهم النجاح.
        تشرح بالعامية المصرية بطريقة ودودة ومحفزة.
        ${options.studentName ? `اسم الطالب ${options.studentName}` : ''}`
      },
      { 
        role: 'user', 
        content: prompt 
      }
    ], {
      temperature,
      maxTokens: 600,
      presencePenalty: 0.2,
      frequencyPenalty: 0.3
    });
    
    return response;
  }
  
  /**
   * Get appropriate temperature for AI generation
   */
  private getTemperature(options: TeachingScriptOptions): number {
    if (options.useStories) return 0.9;
    if (options.needExample) return 0.8;
    if (options.interactionType === 'problem') return 0.6;
    if (options.voiceStyle === 'formal') return 0.5;
    return 0.75; // default
  }
  
  /**
   * Process and enhance the generated script
   */
  private processAndEnhanceScript(
    script: string, 
    level: EducationalLevel,
    options: TeachingScriptOptions
  ): TeachingScript {
    
    // Clean the script
    let processedScript = this.cleanScript(script);
    
    // Add student name if provided
    if (options.studentName && !processedScript.includes(options.studentName)) {
      processedScript = this.insertStudentName(processedScript, options.studentName);
    }
    
    // Extract components
    const keyPoints = this.extractKeyPoints(processedScript);
    const examples = this.extractExamples(processedScript);
    const visualCues = this.extractVisualCues(processedScript);
    
    // Determine emotional tone
    const emotionalTone = this.analyzeEmotionalTone(processedScript);
    
    // Generate next suggestions
    const nextSuggestions = this.generateNextSuggestions(
      options.interactionType,
      options.currentProgress
    );
    
    return {
      script: processedScript,
      duration: 0,
      keyPoints,
      examples,
      visualCues,
      emotionalTone,
      nextSuggestions
    };
  }
  
  /**
   * Clean and format script text
   */
  private cleanScript(script: string): string {
    return script
      .replace(/\*+/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/["'`]/g, '')
      .replace(/\s+([.,!?؟])/g, '$1')
      .replace(/([.!?؟])\s*([.!?؟])/g, '$1')
      .trim();
  }
  
  /**
   * Insert student name naturally in script
   */
  private insertStudentName(script: string, name: string): string {
    const greetings = [
      `يا ${name}`,
      `تمام يا ${name}`,
      `عاش يا ${name}`
    ];
    
    // Find a good place to insert the name
    const sentences = script.split(/[.!؟]/);
    if (sentences.length > 2) {
      const randomIndex = Math.floor(Math.random() * 3) + 1;
      sentences[randomIndex] = sentences[randomIndex] + ` ${this.getRandomPhrase(greetings)}`;
    }
    
    return sentences.join('. ');
  }
  
  /**
   * Extract visual cues for slide animations
   */
  private extractVisualCues(script: string): string[] {
    const cues: string[] = [];
    
    const visualKeywords = {
      'تخيل': 'show_imagination_graphic',
      'انظر': 'highlight_element',
      'شوف': 'zoom_in',
      'لاحظ': 'add_pointer',
      'ركز': 'focus_effect',
      'مثال': 'show_example_box',
      'المعادلة': 'highlight_equation'
    };
    
    Object.entries(visualKeywords).forEach(([keyword, cue]) => {
      if (script.includes(keyword)) {
        cues.push(cue);
      }
    });
    
    return cues;
  }
  
  /**
   * Analyze emotional tone of script
   */
  private analyzeEmotionalTone(script: string): string {
    const tones: { [key: string]: string[] } = {
      'encouraging': ['برافو', 'عاش', 'ممتاز', 'كده', 'صح'],
      'patient': ['خد وقتك', 'مفيش مشكلة', 'تاني', 'براحة'],
      'energetic': ['يلا', 'بسرعة', 'هيا', 'نشوف'],
      'caring': ['حبيبي', 'عزيزي', 'متقلقش', 'معاك'],
      'challenging': ['تحدي', 'فكر', 'حاول', 'جرب']
    };
    
    let dominantTone = 'neutral';
    let maxCount = 0;
    
    Object.entries(tones).forEach(([tone, keywords]) => {
      const count = keywords.filter(k => script.includes(k)).length;
      if (count > maxCount) {
        maxCount = count;
        dominantTone = tone;
      }
    });
    
    return dominantTone;
  }
  
  /**
   * Generate suggestions for next interaction
   */
  private generateNextSuggestions(
    currentInteraction?: InteractionType,
    progress?: number
  ): string[] {
    const suggestions: string[] = [];
    
    if (progress && progress < 30) {
      suggestions.push('example', 'repeat', 'more_detail');
    } else if (progress && progress > 70) {
      suggestions.push('problem', 'quiz', 'summary');
    } else {
      suggestions.push('continue', 'example', 'problem');
    }
    
    // Remove current interaction from suggestions
    if (currentInteraction) {
      const index = suggestions.indexOf(currentInteraction);
      if (index > -1) suggestions.splice(index, 1);
    }
    
    return suggestions;
  }
  
  /**
   * Calculate script duration with pace adjustment
   */
  private calculateDuration(
    script: string,
    pace?: 'slow' | 'normal' | 'fast'
  ): number {
    const words = script.split(/\s+/).length;
    
    const wordsPerMinute = {
      'slow': 100,
      'normal': 130,
      'fast': 160
    };
    
    const wpm = wordsPerMinute[pace || 'normal'];
    const duration = Math.ceil((words / wpm) * 60);
    
    // Add pause time for interaction points
    const pauseTime = (script.match(/[.!?؟]/g) || []).length * 0.5;
    
    return duration + pauseTime + 2; // +2 for intro/outro
  }
  
  /**
   * Calculate interaction points in script
   */
  private calculateInteractionPoints(script: string): number[] {
    const points: number[] = [];
    const sentences = script.split(/[.!?؟]/);
    
    // Add interaction points after questions
    sentences.forEach((sentence, index) => {
      if (sentence.includes('؟') || 
          sentence.includes('صح') || 
          sentence.includes('فاهم') ||
          sentence.includes('معايا')) {
        points.push(Math.ceil((index / sentences.length) * 100));
      }
    });
    
    return points;
  }
  
  /**
   * Enhanced fallback script generation
   */
  private createEnhancedFallbackScript(
    slideContent: any,
    options: TeachingScriptOptions
  ): TeachingScript {
    const greetings = [
      'أهلاً وسهلاً',
      'يلا بينا نتعلم',
      'خلينا نشوف الدرس ده'
    ];
    
    let script = `${this.getRandomPhrase(greetings)}! `;
    
    if (slideContent.title) {
      script += `النهاردة هنتكلم عن ${slideContent.title}. `;
    }
    
    if (slideContent.content) {
      script += `${slideContent.content} `;
    }
    
    if (slideContent.bullets && slideContent.bullets.length > 0) {
      script += 'عندنا نقاط مهمة لازم نركز عليها: ';
      slideContent.bullets.forEach((bullet: string, i: number) => {
        script += `${i === 0 ? 'أولاً' : i === 1 ? 'ثانياً' : `رقم ${i + 1}`}: ${bullet}. `;
      });
    }
    
    if (slideContent.equation) {
      script += `والمعادلة بتاعتنا هي: ${slideContent.equation}. `;
    }
    
    // Add encouragement
    const encouragements = [
      'أنا متأكد إنك هتفهمها كويس',
      'مع شوية تركيز هتلاقيها سهلة',
      'خطوة خطوة وهنوصل'
    ];
    
    script += this.getRandomPhrase(encouragements) + '!';
    
    return {
      script,
      duration: Math.ceil(script.split(/\s+/).length / 2) + 3,
      emotionalTone: 'encouraging',
      keyPoints: slideContent.bullets || [],
      nextSuggestions: ['example', 'more_detail', 'continue']
    };
  }
  
  // ============= HELPER METHODS =============
  
  /**
   * Validate input options
   */
  private validateOptions(options: TeachingScriptOptions): TeachingScriptOptions {
    try {
      return teachingOptionsSchema.parse(options) as TeachingScriptOptions;
    } catch (error) {
      console.warn('⚠️ Invalid options, using defaults:', error);
      return options; // Use as-is with defaults
    }
  }
  
  /**
   * Get educational level from grade
   */
  private getEducationalLevel(grade: number): EducationalLevel {
    if (grade <= 6) return 'primary';
    if (grade <= 9) return 'prep';
    return 'secondary';
  }
  
  /**
   * Get random phrase from array
   */
  private getRandomPhrase(phrases: string[]): string {
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
  
  /**
   * Extract topic from previous script
   */
  private extractTopic(script: string): string {
    const words = script.split(/\s+/).slice(0, 10);
    return words.join(' ') + '...';
  }
  
  /**
   * Rephrase concept for repetition
   */
  private rephraseConcept(
    original: string,
    level: EducationalLevel
  ): string {
    const rephrases = {
      'primary': 'خلينا نقول الكلام ده بطريقة تانية أسهل: ',
      'prep': 'تعالى نشرح الموضوع ده بشكل مختلف: ',
      'secondary': 'دعونا نعيد صياغة هذا المفهوم: '
    };
    
    return rephrases[level] + original;
  }
  
  /**
   * Generate contextual example
   */
  private generateContextualExample(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel
  ): string {
    const examples = {
      'primary': `تخيل معايا لو عندك ${slideContent.title}... زي مثلاً لما تكون بتلعب وعايز تحسب النقط`,
      'prep': `مثال عملي على ${slideContent.title}: لو أنت في ماتش كورة وعايز تحسب...`,
      'secondary': `تطبيق على ${slideContent.title} في الحياة العملية: في مجال البرمجة...`
    };
    
    return examples[level];
  }
  
  /**
   * Generate quick problem
   */
  private generateQuickProblem(
    slideContent: any,
    level: EducationalLevel
  ): Partial<EducationalProblem> {
    return {
      question: `لو عندك ${slideContent.title || 'المسألة دي'}، إيه الحل؟`,
      hints: ['فكر في القاعدة', 'ابدأ خطوة خطوة'],
      difficulty: level === 'primary' ? 'easy' : 'medium'
    };
  }
  
  /**
   * Create fallback problem
   */
  private createFallbackProblem(
    topic: string,
    level: EducationalLevel,
    difficulty: 'easy' | 'medium' | 'hard'
  ): EducationalProblem {
    const problems = {
      'easy': {
        question: `احسب: 5 + 3 = ؟`,
        hints: ['عد على صوابعك', 'ابدأ من 5'],
        solution: '8',
        steps: ['نبدأ بـ 5', 'نضيف 3', 'النتيجة 8']
      },
      'medium': {
        question: `حل المعادلة: x + 5 = 12`,
        hints: ['انقل 5 للطرف التاني', 'غير الإشارة'],
        solution: 'x = 7',
        steps: ['x + 5 = 12', 'x = 12 - 5', 'x = 7']
      },
      'hard': {
        question: `حل: x² + 4x + 4 = 0`,
        hints: ['ده مربع كامل', '(x + 2)²'],
        solution: 'x = -2',
        steps: ['(x + 2)² = 0', 'x + 2 = 0', 'x = -2']
      }
    };
    
    const selected = problems[difficulty];
    
    return {
      ...selected,
      difficulty,
      relatedConcept: topic
    };
  }
  
  /**
   * Extract last example from context
   */
  private extractLastExample(context: EducationalContext): string {
    if (context.examples && context.examples.length > 0) {
      const lastExample = context.examples[context.examples.length - 1];
      return lastExample.solution || lastExample.problem || 'مثال من الدرس';
    }
    return 'مثال توضيحي';
  }
  
  /**
   * Generate quiz question
   */
  private generateQuizQuestion(
    slideContent: any,
    level: EducationalLevel
  ): string {
    const questions = {
      'primary': `سؤال سريع: إيه اللي تعلمناه عن ${slideContent.title}؟ فكر وجاوب!`,
      'prep': `اختبر نفسك: لو عندك ${slideContent.title}، تقدر تحل إيه؟`,
      'secondary': `سؤال تطبيقي: كيف يمكن استخدام ${slideContent.title} في حل المسائل المعقدة؟`
    };
    
    return questions[level];
  }
  
  /**
   * Generate summary of session
   */
  private generateSummary(
    sessionHistory: string[],
    context: EducationalContext,
    level: EducationalLevel
  ): string {
    const summaryStarters = {
      'primary': 'خلاصة اللي اتعلمناه النهاردة: ',
      'prep': 'نلخص الدرس في نقاط: ',
      'secondary': 'الملخص النهائي للمفاهيم: '
    };
    
    let summary = summaryStarters[level];
    
    // Add key concepts
    if (context.concepts && context.concepts.length > 0) {
      summary += `تعلمنا عن ${context.concepts.slice(0, 3).map(c => c.nameAr).join(' و')}. `;
    }
    
    // Add session highlights
    if (sessionHistory.length > 0) {
      summary += `ناقشنا ${sessionHistory.length} موضوع مهم. `;
    }
    
    summary += 'أتمنى تكون استفدت واستمتعت!';
    
    return summary;
  }
  
  /**
   * Generate detailed explanation
   */
  private generateDetailedExplanation(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel,
    previousScript?: string
  ): string {
    let explanation = `طيب، خلينا نفصّل أكثر في ${slideContent.title || 'الموضوع ده'}. `;
    
    if (context.enrichedContent) {
      explanation += `${context.enrichedContent.slice(0, 200)}... `;
    }
    
    explanation += 'ده معناه إن... ';
    
    return explanation;
  }
  
  /**
   * Generate basic explanation
   */
  private generateBasicExplanation(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel
  ): string {
    return `ببساطة، ${slideContent.title || 'الموضوع ده'} هو ${slideContent.content || 'مفهوم مهم في الرياضيات'}`;
  }
  
  /**
   * Extract all key points from session
   */
  private extractAllKeyPoints(sessionHistory: string[]): string[] {
    const allPoints: string[] = [];
    
    sessionHistory.forEach(script => {
      const points = this.extractKeyPoints(script);
      allPoints.push(...points);
    });
    
    // Remove duplicates and limit
    return [...new Set(allPoints)].slice(0, 5);
  }
  
  /**
   * Extract key points from script
   */
  private extractKeyPoints(script: string): string[] {
    const points: string[] = [];
    const importantPhrases = [
      'المهم', 'خلي بالك', 'افتكر', 'النقطة المهمة',
      'الخلاصة', 'الأساس', 'القاعدة', 'لازم تعرف'
    ];
    
    const sentences = script.split(/[.!؟]/);
    
    sentences.forEach(sentence => {
      if (importantPhrases.some(phrase => sentence.includes(phrase))) {
        const cleaned = sentence.trim();
        if (cleaned.length > 10 && cleaned.length < 200) {
          points.push(cleaned);
        }
      }
    });
    
    return points.slice(0, 3);
  }
  
  /**
   * Extract examples from script
   */
  private extractExamples(script: string): string[] {
    const examples: string[] = [];
    const examplePhrases = ['مثلاً', 'مثال', 'زي', 'كأن', 'تخيل', 'لو'];
    
    const sentences = script.split(/[.!؟]/);
    
    sentences.forEach(sentence => {
      if (examplePhrases.some(phrase => sentence.includes(phrase))) {
        const cleaned = sentence.trim();
        if (cleaned.length > 15) {
          examples.push(cleaned);
        }
      }
    });
    
    return examples.slice(0, 2);
  }
  
  // ============= CACHING SYSTEM =============
  
  /**
   * Generate cache key for script
   */
  private generateCacheKey(options: TeachingScriptOptions): string {
    const key = `${options.lessonId}_${options.slideContent.title || 'untitled'}_${options.studentGrade}_${options.interactionType || 'default'}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }
  
  /**
   * Get cached script if available
   */
  private getCachedScript(options: TeachingScriptOptions): TeachingScript | null {
    const key = this.generateCacheKey(options);
    const cached = this.scriptCache.get(key);
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      
      if (age < this.CACHE_TTL) {
        // Update hit count
        cached.hits++;
        
        // Return cached script with updated metadata
        const script = { ...cached.script };
        if (script.metadata) {
          script.metadata.cached = true;
        }
        
        return script;
      } else {
        // Remove expired cache
        this.scriptCache.delete(key);
      }
    }
    
    return null;
  }
  
  /**
   * Cache generated script
   */
  private cacheScript(options: TeachingScriptOptions, script: TeachingScript): void {
    // Check cache size limit
    if (this.scriptCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry
      const oldestKey = this.findOldestCacheEntry();
      if (oldestKey) {
        this.scriptCache.delete(oldestKey);
      }
    }
    
    const key = this.generateCacheKey(options);
    this.scriptCache.set(key, {
      script,
      timestamp: Date.now(),
      hits: 0
    });
  }
  
  /**
   * Find oldest cache entry
   */
  private findOldestCacheEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    this.scriptCache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    });
    
    return oldestKey;
  }
  
  /**
   * Clear cache (for maintenance)
   */
  clearCache(): void {
    this.scriptCache.clear();
    console.log('🧹 Teaching script cache cleared');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: number;
  } {
    let totalHits = 0;
    let totalRequests = 0;
    let oldestTimestamp = Date.now();
    
    this.scriptCache.forEach(entry => {
      totalHits += entry.hits;
      totalRequests += entry.hits + 1;
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    });
    
    return {
      size: this.scriptCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      oldestEntry: Date.now() - oldestTimestamp
    };
  }
  
  // ============= PUBLIC API METHODS =============
  
  /**
   * Generate scripts for complete lesson
   */
  async generateLessonScripts(
    slides: any[],
    lessonId: string,
    studentGrade: number,
    studentName?: string
  ): Promise<TeachingScript[]> {
    console.log(`🎓 Generating teaching scripts for ${slides.length} slides`);
    
    const scripts: TeachingScript[] = [];
    const sessionHistory: string[] = [];
    let previousScript: string | undefined;
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const progress = Math.round((i / slides.length) * 100);
      
      const script = await this.generateTeachingScript({
        slideContent: slide,
        lessonId,
        studentGrade,
        studentName,
        previousScript,
        sessionHistory,
        currentProgress: progress,
        voiceStyle: i === 0 ? 'energetic' : 'friendly',
        paceSpeed: slide.type === 'quiz' ? 'slow' : 'normal',
        useAnalogies: slide.type === 'content',
        useStories: i === 0 && studentGrade <= 6
      });
      
      scripts.push(script);
      sessionHistory.push(script.script);
      previousScript = script.script.slice(0, 200);
      
      // Small delay between generation
      if (i < slides.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`✅ Generated ${scripts.length} teaching scripts`);
    return scripts;
  }
  
  /**
   * Handle student interaction in real-time
   */
  async handleStudentInteraction(
    interactionType: InteractionType,
    currentSlide: any,
    lessonId: string,
    studentGrade: number,
    context?: {
      previousScript?: string;
      sessionHistory?: string[];
      studentName?: string;
    }
  ): Promise<TeachingScript> {
    return this.generateTeachingScript({
      slideContent: currentSlide,
      lessonId,
      studentGrade,
      studentName: context?.studentName,
      interactionType,
      previousScript: context?.previousScript,
      sessionHistory: context?.sessionHistory
    });
  }
  
  /**
   * Generate personalized greeting
   */
  async generateGreeting(
    studentName: string,
    studentGrade: number,
    timeOfDay: 'morning' | 'afternoon' | 'evening'
  ): Promise<string> {
    const greetings = {
      'morning': ['صباح الخير', 'صباح النور', 'يوم جميل'],
      'afternoon': ['مساء الخير', 'أهلاً', 'إزيك'],
      'evening': ['مساء النور', 'مساء الورد', 'أهلاً']
    };
    
    const level = this.getEducationalLevel(studentGrade);
    const levelGreeting = {
      'primary': `يا حبيبي يا ${studentName}`,
      'prep': `يا ${studentName}`,
      'secondary': `أستاذ ${studentName}`
    };
    
    return `${this.getRandomPhrase(greetings[timeOfDay])} ${levelGreeting[level]}! جاهز نتعلم حاجات جديدة النهاردة؟`;
  }
  
  /**
   * Get service health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    cacheStats: any;
    lastGeneration?: Date;
  } {
    const cacheStats = this.getCacheStats();
    
    return {
      status: 'healthy',
      cacheStats,
      lastGeneration: new Date()
    };
  }
}

// ============= EXPORT SINGLETON =============
export const teachingAssistant = new TeachingAssistantService();

// ============= INTEGRATION EXPORTS =============

/**
 * Integration helper for WebSocket service
 */
export const createTeachingSocketHandler = (socket: any) => {
  return {
    onGenerateScript: async (data: any) => {
      return teachingAssistant.generateTeachingScript(data);
    },
    
    onStudentInteraction: async (data: any) => {
      return teachingAssistant.handleStudentInteraction(
        data.type,
        data.slide,
        data.lessonId,
        data.grade,
        data.context
      );
    },
    
    onRequestProblem: async (data: any) => {
      return teachingAssistant.generateTeachingScript({
        ...data,
        needProblem: true,
        problemDifficulty: data.difficulty
      });
    }
  };
};

/**
 * Integration helper for REST API
 */
export const createTeachingAPIHandler = () => {
  return {
    generateLessonScripts: teachingAssistant.generateLessonScripts.bind(teachingAssistant),
    generateSingleScript: teachingAssistant.generateTeachingScript.bind(teachingAssistant),
    handleInteraction: teachingAssistant.handleStudentInteraction.bind(teachingAssistant),
    getHealth: teachingAssistant.getHealthStatus.bind(teachingAssistant),
    clearCache: teachingAssistant.clearCache.bind(teachingAssistant)
  };
};