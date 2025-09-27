// src/services/teaching/teaching-assistant.service.ts
// ✨ النسخة المحسنة مع AI Personalization & Adaptive Learning
// Version: 3.0 - Enhanced with Smart Features

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
  | 'summary'
  | 'socratic'     // 🆕 Socratic method
  | 'motivate'     // 🆕 Motivation
  | 'hint'         // 🆕 Give hint
  | 'check';       // 🆕 Check understanding

/**
 * 🆕 Student emotional state
 */
interface EmotionalState {
  mood: 'happy' | 'neutral' | 'frustrated' | 'confused' | 'tired';
  confidence: number; // 0-100
  engagement: number; // 0-100
  needsBreak: boolean;
}

/**
 * 🆕 Learning style preference
 */
interface LearningStyle {
  visual: number;    // 0-1
  auditory: number;  // 0-1
  kinesthetic: number; // 0-1
  reading: number;   // 0-1
}

/**
 * خيارات توليد السكريبت التعليمي المحسنة
 */
interface TeachingScriptOptions {
  slideContent: any;
  lessonId: string;
  studentGrade: number;
  studentName?: string;
  interactionType?: InteractionType;
  
  // خيارات التفاعل
  needMoreDetail?: boolean;
  needExample?: boolean;
  needProblem?: boolean;
  problemDifficulty?: 'easy' | 'medium' | 'hard';
  
  // السياق والاستمرارية
  previousScript?: string;
  sessionHistory?: string[];
  currentProgress?: number;
  
  // التخصيص
  voiceStyle?: 'friendly' | 'formal' | 'energetic';
  paceSpeed?: 'slow' | 'normal' | 'fast';
  useAnalogies?: boolean;
  useStories?: boolean;
  
  // 🆕 Enhanced personalization
  emotionalState?: EmotionalState;
  learningStyle?: LearningStyle;
  mistakeHistory?: string[];
  successHistory?: string[];
  preferredLanguage?: 'ar' | 'en' | 'mixed';
  specialNeeds?: string[];
}

/**
 * 🆕 Step-by-step problem solving
 */
interface StepByStepProblem {
  problem: string;
  currentStep: number;
  totalSteps: number;
  steps: {
    number: number;
    instruction: string;
    hint: string;
    expectedAnswer?: string;
    completed: boolean;
  }[];
  socraticQuestions: string[];
}

/**
 * المسألة التعليمية المحسنة
 */
interface EducationalProblem {
  question: string;
  hints: string[];
  solution: string;
  steps: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  relatedConcept: string;
  // 🆕 New fields
  socraticApproach?: StepByStepProblem;
  visualAids?: string[];
  realWorldApplication?: string;
  commonMistakes?: string[];
}

/**
 * السكريبت التعليمي النهائي المحسن
 */
interface TeachingScript {
  script: string;
  duration: number;
  keyPoints?: string[];
  examples?: string[];
  problem?: EducationalProblem;
  visualCues?: string[];
  interactionPoints?: number[];
  emotionalTone?: string;
  nextSuggestions?: string[];
  metadata?: {
    generatedAt: Date;
    model: string;
    tokens: number;
    cached: boolean;
  };
  // 🆕 New fields
  adaptiveElements?: {
    difficultyAdjustment?: 'easier' | 'harder' | 'same';
    emotionalSupport?: string[];
    breakSuggested?: boolean;
    alternativeExplanation?: string;
  };
  parentReport?: {
    summary: string;
    strengths: string[];
    areasToImprove: string[];
    recommendations: string[];
  };
}

/**
 * السياق التعليمي المحسن
 */
interface EducationalContext {
  enrichedContent: any;
  concepts: any[];
  examples: any[];
  formulas?: any[];
  relatedLessons?: any[];
  studentProgress?: any;
  // 🆕 New fields
  learningObjectives?: string[];
  prerequisites?: string[];
  commonMisconceptions?: string[];
}

/**
 * 🆕 Student profile for personalization
 */
interface StudentProfile {
  id: string;
  name: string;
  grade: number;
  level: EducationalLevel;
  learningStyle: LearningStyle;
  emotionalBaseline: EmotionalState;
  strengths: string[];
  weaknesses: string[];
  interests: string[];
  sessionCount: number;
  totalLearningTime: number;
  lastSessionDate?: Date;
  preferredTeachingStyle?: string;
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
  lessonId: z.string().min(1),
  studentGrade: z.number().min(1).max(12).default(6),
  studentName: z.string().optional(),
  interactionType: z.enum([
    'explain', 'more_detail', 'example', 'problem', 
    'repeat', 'continue', 'stop', 'quiz', 'summary',
    'socratic', 'motivate', 'hint', 'check'
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
  useStories: z.boolean().optional(),
  // 🆕 New validations
  emotionalState: z.object({
    mood: z.enum(['happy', 'neutral', 'frustrated', 'confused', 'tired']),
    confidence: z.number().min(0).max(100),
    engagement: z.number().min(0).max(100),
    needsBreak: z.boolean()
  }).optional(),
  learningStyle: z.object({
    visual: z.number().min(0).max(1),
    auditory: z.number().min(0).max(1),
    kinesthetic: z.number().min(0).max(1),
    reading: z.number().min(0).max(1)
  }).optional(),
  mistakeHistory: z.array(z.string()).optional(),
  successHistory: z.array(z.string()).optional(),
  preferredLanguage: z.enum(['ar', 'en', 'mixed']).optional(),
  specialNeeds: z.array(z.string()).optional()
});

// ============= MAIN SERVICE CLASS =============

export class TeachingAssistantService {
  private scriptCache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly MAX_CACHE_SIZE = 100;
  
  // 🆕 Student profiles storage (in production, use database)
  private studentProfiles: Map<string, StudentProfile> = new Map();
  
  // 🆕 Session tracking
  private activeSessions: Map<string, {
    startTime: Date;
    interactions: number;
    emotionalHistory: EmotionalState[];
    problemsSolved: number;
    correctAnswers: number;
  }> = new Map();
  
  /**
   * توليد سكريبت تعليمي تفاعلي متكامل - محسن
   */
  async generateTeachingScript(
    options: TeachingScriptOptions
  ): Promise<TeachingScript> {
    
    // Validate input
    const validatedOptions = this.validateOptions(options);
    
    // 🆕 Get or create student profile
    const studentProfile = await this.getOrCreateStudentProfile(
      validatedOptions.studentName || 'student',
      validatedOptions.studentGrade
    );
    
    // 🆕 Detect emotional state if not provided
    if (!validatedOptions.emotionalState) {
      validatedOptions.emotionalState = await this.detectEmotionalState(
        validatedOptions.sessionHistory || [],
        validatedOptions.previousScript
      );
    }
    
    // Check cache
    const cachedScript = this.getCachedScript(validatedOptions);
    if (cachedScript && !validatedOptions.emotionalState?.needsBreak) {
      console.log('📦 Using cached teaching script');
      return cachedScript;
    }
    
    try {
      // 1. Get comprehensive context
      const context = await this.getEducationalContext(
        validatedOptions.lessonId,
        validatedOptions.slideContent,
        validatedOptions.studentGrade || 6
      );
      
      // 2. Determine educational level
      const level = this.getEducationalLevel(validatedOptions.studentGrade || 6);
      
      // 3. 🆕 Check if student needs a break
      if (validatedOptions.emotionalState?.needsBreak) {
        return this.generateBreakScript(validatedOptions, studentProfile);
      }
      
      // 4. Handle special interactions
      if (validatedOptions.interactionType) {
        return await this.handleEnhancedInteraction(
          validatedOptions,
          context,
          level,
          studentProfile
        );
      }
      
      // 5. 🆕 Generate adaptive problem if requested
      let problem: EducationalProblem | undefined;
      if (validatedOptions.needProblem) {
        problem = await this.generateAdaptiveProblem(
          validatedOptions.slideContent,
          context,
          level,
          validatedOptions.problemDifficulty || 'medium',
          studentProfile
        );
      }
      
      // 6. Build personalized prompt
      const prompt = this.buildPersonalizedPrompt(
        validatedOptions.slideContent,
        context,
        level,
        validatedOptions,
        studentProfile,
        problem
      );
      
      // 7. Generate with smart model selection
      const script = await this.generateWithSmartModel(prompt, validatedOptions, studentProfile);
      
      // 8. Process and enhance
      const processedScript = this.processAndEnhanceScript(
        script, 
        level,
        validatedOptions,
        studentProfile
      );
      
      // 9. Add adaptive elements
      processedScript.adaptiveElements = this.generateAdaptiveElements(
        validatedOptions,
        studentProfile,
        context
      );
      
      // 10. 🆕 Generate parent report if needed
      if (this.shouldGenerateParentReport(validatedOptions, studentProfile)) {
        processedScript.parentReport = await this.generateParentReport(
          studentProfile,
          validatedOptions,
          processedScript
        );
      }
      
      // 11. Add problem if generated
      if (problem) {
        processedScript.problem = problem;
      }
      
      // 12. Calculate metrics
      processedScript.duration = this.calculateAdaptiveDuration(
        processedScript.script,
        validatedOptions.paceSpeed,
        studentProfile
      );
      processedScript.interactionPoints = this.calculateInteractionPoints(
        processedScript.script
      );
      
      // 13. Add metadata
      processedScript.metadata = {
        generatedAt: new Date(),
        model: 'adaptive',
        tokens: script.length,
        cached: false
      };
      
      // 14. Update student profile
      await this.updateStudentProfile(studentProfile, processedScript, validatedOptions);
      
      // 15. Cache the result
      this.cacheScript(validatedOptions, processedScript);
      
      return processedScript;
      
    } catch (error) {
      console.error('❌ Teaching script generation failed:', error);
      return this.createAdaptiveFallbackScript(
        validatedOptions.slideContent,
        validatedOptions,
        studentProfile
      );
    }
  }
  
  /**
   * 🆕 Get or create student profile
   */
  private async getOrCreateStudentProfile(
    studentName: string,
    grade: number
  ): Promise<StudentProfile> {
    const profileId = `${studentName}_${grade}`;
    
    if (this.studentProfiles.has(profileId)) {
      return this.studentProfiles.get(profileId)!;
    }
    
    // Create new profile
    const newProfile: StudentProfile = {
      id: profileId,
      name: studentName,
      grade: grade,
      level: this.getEducationalLevel(grade),
      learningStyle: {
        visual: 0.5,
        auditory: 0.5,
        kinesthetic: 0.3,
        reading: 0.4
      },
      emotionalBaseline: {
        mood: 'neutral',
        confidence: 60,
        engagement: 70,
        needsBreak: false
      },
      strengths: [],
      weaknesses: [],
      interests: [],
      sessionCount: 0,
      totalLearningTime: 0
    };
    
    this.studentProfiles.set(profileId, newProfile);
    return newProfile;
  }
  
  /**
   * 🆕 Detect emotional state from conversation
   */
  private async detectEmotionalState(
    sessionHistory: string[],
    previousScript?: string
  ): Promise<EmotionalState> {
    const recentText = previousScript || sessionHistory.slice(-2).join(' ');
    
    if (!recentText) {
      return {
        mood: 'neutral',
        confidence: 70,
        engagement: 70,
        needsBreak: false
      };
    }
    
    // Analyze for emotional indicators
    const frustrationIndicators = ['مش فاهم', 'صعب', 'مش عارف', 'تاني', 'زهقت'];
    const confusionIndicators = ['إزاي', 'ليه', 'معقد', 'مش واضح'];
    const tirednessIndicators = ['تعبت', 'زهقان', 'خلاص', 'كفاية'];
    const happyIndicators = ['فهمت', 'حلو', 'تمام', 'عاش'];
    
    let mood: EmotionalState['mood'] = 'neutral';
    let confidence = 70;
    let engagement = 70;
    let needsBreak = false;
    
    // Count indicators
    const frustrationCount = frustrationIndicators.filter(i => recentText.includes(i)).length;
    const confusionCount = confusionIndicators.filter(i => recentText.includes(i)).length;
    const tirednessCount = tirednessIndicators.filter(i => recentText.includes(i)).length;
    const happyCount = happyIndicators.filter(i => recentText.includes(i)).length;
    
    // Determine mood
    if (frustrationCount > 1) {
      mood = 'frustrated';
      confidence -= 20;
      engagement -= 10;
    } else if (confusionCount > 1) {
      mood = 'confused';
      confidence -= 15;
    } else if (tirednessCount > 0) {
      mood = 'tired';
      engagement -= 30;
      needsBreak = true;
    } else if (happyCount > 1) {
      mood = 'happy';
      confidence += 10;
      engagement += 10;
    }
    
    // Check session length for fatigue
    if (sessionHistory.length > 10) {
      engagement -= 10;
      if (sessionHistory.length > 15) {
        needsBreak = true;
      }
    }
    
    return {
      mood,
      confidence: Math.max(0, Math.min(100, confidence)),
      engagement: Math.max(0, Math.min(100, engagement)),
      needsBreak
    };
  }
  
  /**
   * 🆕 Generate break script
   */
  private generateBreakScript(
    options: TeachingScriptOptions,
    profile: StudentProfile
  ): TeachingScript {
    const breakActivities = [
      'خد نفس عميق 3 مرات',
      'قوم اتحرك شوية',
      'اشرب مية',
      'ارسم رسمة سريعة',
      'العب لعبة صغيرة'
    ];
    
    const script = `${profile.name ? `يا ${profile.name}` : ''}, 
    أنا حاسس إنك محتاج break شوية! 
    ${this.getRandomPhrase(breakActivities)}. 
    خد 5 دقايق راحة وارجع تاني. 
    أنت بتعمل مجهود رائع والراحة جزء مهم من التعلم! 
    لما ترجع هنكمل بحماس أكتر! 🌟`;
    
    return {
      script,
      duration: 10,
      emotionalTone: 'caring',
      nextSuggestions: ['continue', 'motivate'],
      adaptiveElements: {
        breakSuggested: true,
        emotionalSupport: ['أنت شاطر', 'الراحة مهمة', 'هترجع أقوى']
      }
    };
  }
  
  /**
   * 🆕 Handle enhanced interactions with more types
   */
  private async handleEnhancedInteraction(
    options: TeachingScriptOptions,
    context: EducationalContext,
    level: EducationalLevel,
    profile: StudentProfile
  ): Promise<TeachingScript> {
    
    const interactions: Record<InteractionType, () => Promise<TeachingScript> | TeachingScript> = {
      // Original interactions...
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
          level,
          profile.learningStyle
        ),
        duration: this.calculateAdaptiveDuration(options.previousScript || '', 'slow', profile),
        emotionalTone: 'patient',
        keyPoints: this.extractKeyPoints(options.previousScript || '')
      }),
      
      'example': () => ({
        script: this.generatePersonalizedExample(
          options.slideContent,
          context,
          level,
          profile
        ),
        duration: 8,
        emotionalTone: 'engaging',
        examples: [this.extractLastExample(context)]
      }),
      
      'problem': () => {
        const problem = this.generateQuickProblem(
          options.slideContent,
          level,
          profile
        );
        return {
          script: `تعالى نحل مسألة ${profile.name ? `يا ${profile.name}` : ''}: ${problem.question}`,
          duration: 10,
          problem: problem as EducationalProblem,
          emotionalTone: 'challenging'
        };
      },
      
      'quiz': () => ({
        script: this.generateAdaptiveQuizQuestion(options.slideContent, level, profile),
        duration: 7,
        emotionalTone: 'interactive',
        interactionPoints: [3, 7]
      }),
      
      'summary': () => ({
        script: this.generatePersonalizedSummary(
          options.sessionHistory || [],
          context,
          level,
          profile
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
          options.previousScript,
          profile
        ),
        duration: 12,
        emotionalTone: 'thorough'
      }),
      
      'explain': () => ({
        script: this.generateAdaptiveExplanation(
          options.slideContent,
          context,
          level,
          profile
        ),
        duration: 8,
        emotionalTone: 'clear'
      }),
      
      // 🆕 New interaction types
      'socratic': async () => ({
        script: await this.generateSocraticDialogue(
          options.slideContent,
          context,
          level,
          profile
        ),
        duration: 10,
        emotionalTone: 'inquisitive',
        interactionPoints: [2, 5, 8]
      }),
      
      'motivate': () => ({
        script: this.generateMotivationalMessage(
          profile,
          options.emotionalState || profile.emotionalBaseline
        ),
        duration: 5,
        emotionalTone: 'inspiring',
        adaptiveElements: {
          emotionalSupport: this.getEmotionalSupport(profile)
        }
      }),
      
      'hint': () => ({
        script: this.generateProgressiveHint(
          options.slideContent,
          context,
          level,
          options.mistakeHistory || []
        ),
        duration: 6,
        emotionalTone: 'helpful'
      }),
      
      'check': async () => ({
        script: await this.generateUnderstandingCheck(
          options.slideContent,
          context,
          profile
        ),
        duration: 8,
        emotionalTone: 'assessment',
        interactionPoints: [3, 6]
      })
    };
    
    const interaction = options.interactionType || 'explain';
    const handler = interactions[interaction];
    return typeof handler === 'function' ? await handler() : handler;
  }
  
  /**
   * 🆕 Generate Socratic dialogue
   */
  private async generateSocraticDialogue(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel,
    profile: StudentProfile
  ): Promise<string> {
    const questions = [
      `إيه اللي تعرفه عن ${slideContent.title}؟`,
      `ليه تفتكر ده مهم؟`,
      `ممكن تديني مثال من حياتك؟`,
      `إيه اللي ممكن يحصل لو...؟`,
      `إزاي ممكن نستخدم ده في...؟`
    ];
    
    const selectedQuestion = questions[Math.floor(Math.random() * questions.length)];
    
    return `${profile.name ? `${profile.name}، ` : ''}عايز أسألك سؤال مهم: ${selectedQuestion} 
    فكر كويس وجاوب، ومفيش إجابة غلط! المهم نفكر سوا.`;
  }
  
  /**
   * 🆕 Generate motivational message
   */
  private generateMotivationalMessage(
    profile: StudentProfile,
    emotionalState: EmotionalState
  ): string {
    const messages = {
      frustrated: [
        'أنت قريب جداً من الفهم، استمر!',
        'كل العلماء العظماء واجهوا صعوبات، أنت زيهم!',
        'الغلط جزء من التعلم، وأنت بتتعلم كويس!'
      ],
      confused: [
        'مفيش حاجة اسمها سؤال غبي، اسأل براحتك!',
        'التعلم زي بناء البيت، طوبة طوبة',
        'خلينا نجرب طريقة تانية'
      ],
      tired: [
        'شوية راحة وترجع أقوى!',
        'العقل المرتاح بيفهم أحسن',
        'إنجازك النهاردة ممتاز!'
      ],
      happy: [
        'ما شاء الله! استمر كده!',
        'أنت نجم حقيقي!',
        'فخور بيك جداً!'
      ],
      neutral: [
        'كل خطوة بتقربك من الهدف',
        'التعلم رحلة جميلة',
        'أنت أقوى مما تتصور'
      ]
    };
    
    const selectedMessages = messages[emotionalState.mood];
    const message = selectedMessages[Math.floor(Math.random() * selectedMessages.length)];
    
    return `${profile.name ? `يا ${profile.name}، ` : ''}${message} 
    ${profile.strengths.length > 0 ? `أنت ممتاز في ${profile.strengths[0]}! ` : ''}
    يلا نكمل بنفس الحماس! 💪`;
  }
  
  /**
   * 🆕 Generate progressive hint
   */
  private generateProgressiveHint(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel,
    mistakeHistory: string[]
  ): string {
    const hintLevel = Math.min(mistakeHistory.length, 3);
    
    const hints = [
      `تلميح بسيط: فكر في ${slideContent.title} كأنه...`,
      `تلميح أوضح: الخطوة الأولى هي...`,
      `تلميح مباشر: استخدم القاعدة دي...`
    ];
    
    return hints[hintLevel] || hints[2];
  }
  
  /**
   * 🆕 Generate understanding check
   */
  private async generateUnderstandingCheck(
    slideContent: any,
    context: EducationalContext,
    profile: StudentProfile
  ): Promise<string> {
    const checks = [
      `ممكن تشرحلي ${slideContent.title} بكلماتك؟`,
      `لو صاحبك سألك عن ${slideContent.title}، هتقوله إيه؟`,
      `إيه أهم حاجة فهمتها؟`,
      `فين ممكن نستخدم ${slideContent.title}؟`
    ];
    
    const selected = checks[Math.floor(Math.random() * checks.length)];
    
    return `${profile.name ? `${profile.name}، ` : ''}وقت التأكد من الفهم! ${selected} 
    خد وقتك وفكر، وقولي إيه اللي فهمته.`;
  }
  
  /**
   * 🆕 Generate adaptive problem with Socratic method
   */
  private async generateAdaptiveProblem(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel,
    difficulty: 'easy' | 'medium' | 'hard',
    profile: StudentProfile
  ): Promise<EducationalProblem> {
    
    // Adjust difficulty based on profile
    const adjustedDifficulty = this.adjustDifficultyForStudent(difficulty, profile);
    
    const prompt = `Generate a ${adjustedDifficulty} math problem for a ${level} student.
Topic: ${slideContent.title || slideContent.content}
Student strengths: ${profile.strengths.join(', ')}
Student weaknesses: ${profile.weaknesses.join(', ')}
Learning style: Visual=${profile.learningStyle.visual}, Kinesthetic=${profile.learningStyle.kinesthetic}

Create a problem with:
1. Clear real-world context (use ${profile.interests.length > 0 ? profile.interests[0] : 'sports'})
2. Step-by-step Socratic questions to guide solving
3. Visual aids descriptions
4. Common mistakes to avoid

Return JSON format:
{
  "question": "المسألة",
  "hints": ["تلميح 1", "تلميح 2", "تلميح 3"],
  "solution": "الحل",
  "steps": ["خطوة 1", "خطوة 2"],
  "socraticApproach": {
    "problem": "المسألة",
    "currentStep": 0,
    "totalSteps": 3,
    "steps": [
      {
        "number": 1,
        "instruction": "التعليمة",
        "hint": "التلميح",
        "expectedAnswer": "الإجابة المتوقعة",
        "completed": false
      }
    ],
    "socraticQuestions": ["سؤال 1", "سؤال 2"]
  },
  "visualAids": ["رسم توضيحي 1"],
  "realWorldApplication": "التطبيق في الحياة",
  "commonMistakes": ["خطأ شائع 1"],
  "relatedConcept": "المفهوم"
}`;
    
    try {
      const response = await openAIService.chatJSON([
        {
          role: 'system',
          content: 'أنت معلم خبير في التعلم التكيفي والطريقة السقراطية.'
        },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.7,
        maxTokens: 800,
        autoSelectModel: true
      });
      
      return {
        ...response,
        difficulty: adjustedDifficulty
      };
      
    } catch (error) {
      return this.createAdaptiveFallbackProblem(slideContent.title, level, adjustedDifficulty, profile);
    }
  }
  
  /**
   * 🆕 Adjust difficulty based on student profile
   */
  private adjustDifficultyForStudent(
    requestedDifficulty: string,
    profile: StudentProfile
  ): 'easy' | 'medium' | 'hard' {
    const successRate = profile.sessionCount > 0 
      ? (profile.strengths.length / (profile.strengths.length + profile.weaknesses.length + 1))
      : 0.5;
    
    if (successRate < 0.3) {
      return 'easy';
    } else if (successRate > 0.8) {
      return requestedDifficulty === 'easy' ? 'medium' : 'hard';
    }
    
    return requestedDifficulty as any;
  }
  
  /**
   * 🆕 Create adaptive fallback problem
   */
  private createAdaptiveFallbackProblem(
    topic: string,
    level: EducationalLevel,
    difficulty: string,
    profile: StudentProfile
  ): EducationalProblem {
    const base = this.createFallbackProblem(topic, level, difficulty as any);
    
    return {
      ...base,
      socraticApproach: {
        problem: base.question,
        currentStep: 0,
        totalSteps: 3,
        steps: [
          {
            number: 1,
            instruction: 'حدد المعطيات',
            hint: 'إيه اللي معاك في المسألة؟',
            completed: false
          },
          {
            number: 2,
            instruction: 'حدد المطلوب',
            hint: 'إيه اللي المسألة عايزاه؟',
            completed: false
          },
          {
            number: 3,
            instruction: 'احسب الحل',
            hint: 'استخدم القاعدة',
            completed: false
          }
        ],
        socraticQuestions: [
          'إيه المعطيات؟',
          'إيه المطلوب؟',
          'إيه القاعدة اللي هنستخدمها؟'
        ]
      },
      visualAids: ['ارسم المسألة', 'استخدم الألوان'],
      realWorldApplication: 'في الحياة اليومية',
      commonMistakes: ['نسيان الوحدات', 'عدم التحقق من الإجابة']
    };
  }
  
  /**
   * Get educational context with enhanced data
   * 🆕 UPDATED: Better use of enriched content
   */
  private async getEducationalContext(
    lessonId: string,
    slideContent: any,
    studentGrade: number
  ): Promise<EducationalContext> {

    try {
      // Get comprehensive lesson data
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
          relatedLessons: [],
          learningObjectives: [],
          prerequisites: [],
          commonMisconceptions: [],
          // 🆕 New enriched fields
          realWorldApplications: [],
          studentTips: [],
          educationalStories: [],
          commonMistakes: [],
          funFacts: [],
          challenges: []
        };
      }

      // Get student progress
      const studentProgress = await this.getStudentProgress(lessonId, studentGrade);

      // 🆕 Process enriched content comprehensively
      let enrichedData: any = null;
      let realWorldApplications: any[] = [];
      let studentTips: string[] = [];
      let educationalStories: any[] = [];
      let commonMistakes: any[] = [];
      let funFacts: any[] = [];
      let challenges: any[] = [];

      if (lesson.content?.enrichedContent) {
        try {
          const parsed = typeof lesson.content.enrichedContent === 'string'
            ? JSON.parse(lesson.content.enrichedContent)
            : lesson.content.enrichedContent;

          // Extract all enriched fields
          enrichedData = parsed;
          realWorldApplications = parsed.realWorldApplications || [];
          studentTips = parsed.studentTips || [];
          educationalStories = parsed.educationalStories || [];
          commonMistakes = parsed.commonMistakes || [];
          funFacts = parsed.funFacts || [];
          challenges = parsed.challenges || [];

          console.log(`✨ Found enriched content with ${realWorldApplications.length} applications, ${educationalStories.length} stories`);
        } catch (e) {
          console.error('Error parsing enrichedContent:', e);
          enrichedData = lesson.content.enrichedContent;
        }
      } else if (lesson.content?.fullText) {
        enrichedData = lesson.content.fullText;
      }

      // Use RAG for additional context if needed
      if (!enrichedData && (slideContent.title || slideContent.content)) {
        try {
          const query = `${slideContent.title || ''} ${slideContent.content || ''}`.trim();
          const ragResponse = await ragService.answerQuestion(query, lessonId);
          enrichedData = ragResponse.answer;
        } catch (error) {
          console.log('⚠️ RAG search failed');
        }
      }

      // 🆕 Extract learning objectives and prerequisites
      const learningObjectives = this.extractLearningObjectives(lesson);
      const prerequisites = this.extractPrerequisites(lesson);
      const commonMisconceptions = this.extractCommonMisconceptions(lesson, slideContent);

      return {
        enrichedContent: enrichedData || '',
        concepts: lesson.concepts || [],
        examples: lesson.examples || [],
        formulas: lesson.formulas || [],
        relatedLessons: lesson.unit?.lessons || [],
        studentProgress,
        learningObjectives,
        prerequisites,
        commonMisconceptions,
        // 🆕 Include enriched fields
        realWorldApplications,
        studentTips,
        educationalStories,
        commonMistakes,
        funFacts,
        challenges
      };
      
    } catch (error) {
      console.error('❌ Failed to get educational context:', error);
      
      return {
        enrichedContent: '',
        concepts: [],
        examples: [],
        formulas: [],
        relatedLessons: [],
        studentProgress: null,
        learningObjectives: [],
        prerequisites: [],
        commonMisconceptions: []
      };
    }
  }
  
  /**
   * 🆕 Extract learning objectives
   */
  private extractLearningObjectives(lesson: any): string[] {
    const objectives = [];
    
    if (lesson.objectives) {
      objectives.push(...lesson.objectives);
    }
    
    // Generate from content if not explicit
    if (objectives.length === 0 && lesson.title) {
      objectives.push(
        `فهم ${lesson.title}`,
        `تطبيق ${lesson.title} في حل المسائل`,
        `ربط ${lesson.title} بالحياة اليومية`
      );
    }
    
    return objectives;
  }
  
  /**
   * 🆕 Extract prerequisites
   */
  private extractPrerequisites(lesson: any): string[] {
    const prerequisites = [];
    
    if (lesson.prerequisites) {
      prerequisites.push(...lesson.prerequisites);
    }
    
    // Infer from grade level
    if (lesson.gradeId) {
      const grade = parseInt(lesson.gradeId);
      if (grade > 1) {
        prerequisites.push(`مفاهيم الصف ${grade - 1}`);
      }
    }
    
    return prerequisites;
  }
  
  /**
   * 🆕 Extract common misconceptions
   */
  private extractCommonMisconceptions(lesson: any, slideContent: any): string[] {
    const misconceptions = [];
    
    // Math-specific misconceptions
    if (slideContent.title?.includes('كسور')) {
      misconceptions.push('الكسر الأكبر في البسط هو الأكبر دائماً');
    }
    if (slideContent.title?.includes('معادلة')) {
      misconceptions.push('نقل الأعداد بدون تغيير الإشارة');
    }
    
    return misconceptions;
  }
  
  /**
   * Get student progress with more details
   */
  private async getStudentProgress(
    lessonId: string,
    studentGrade: number
  ): Promise<any> {
    // In production, fetch from database
    return {
      completedLessons: 5,
      currentLevel: studentGrade,
      strengths: ['الجبر', 'الهندسة'],
      weaknesses: ['الاحتمالات'],
      averageScore: 85,
      lastTopics: ['المعادلات', 'الكسور'],
      strugglingWith: [],
      masteredConcepts: ['الجمع', 'الطرح']
    };
  }
  
  /**
   * 🆕 Build personalized prompt with all enhancements
   */
  private buildPersonalizedPrompt(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel,
    options: TeachingScriptOptions,
    profile: StudentProfile,
    problem?: EducationalProblem
  ): string {
    
    // Teaching style based on profile
    const teachingStyle = this.determineTeachingStyle(profile, options);
    
    // Language mix based on preference
    const languageInstructions = {
      'ar': 'استخدم العربية العامية المصرية فقط',
      'en': 'Use simple English with Arabic terms when needed',
      'mixed': 'امزج بين العربية والإنجليزية حسب الحاجة'
    };
    
    const language = options.preferredLanguage || 'ar';
    
    // Emotional support based on state
    const emotionalSupport = options.emotionalState 
      ? this.getEmotionalSupportInstructions(options.emotionalState)
      : '';
    
    // Learning style adaptation
    const learningStyleInstructions = this.getLearningStyleInstructions(profile.learningStyle);
    
    let prompt = `أنت معلم رياضيات خبير ومتخصص في التعلم التكيفي والذكاء العاطفي.
${profile.name ? `اسم الطالب: ${profile.name}` : ''}
الصف: ${options.studentGrade || 6}
المرحلة: ${level}

🧠 ملف الطالب الشخصي:
================
مستوى الثقة: ${options.emotionalState?.confidence ?? 70}%
مستوى التفاعل: ${options.emotionalState?.engagement ?? 70}%
المزاج الحالي: ${options.emotionalState?.mood ?? 'neutral'}
نقاط القوة: ${profile.strengths.join(', ') || 'عام'}
نقاط الضعف: ${profile.weaknesses.join(', ') || 'عام'}
الاهتمامات: ${profile.interests.join(', ') || 'الرياضة، الألعاب'}
عدد الجلسات: ${profile.sessionCount}
${context.studentProgress ? `التقدم: ${context.studentProgress.averageScore}%` : ''}

📚 محتوى الشريحة:
================
العنوان: ${slideContent.title || 'بدون عنوان'}
المحتوى: ${slideContent.content || 'محتوى الدرس'}
${slideContent.bullets ? `النقاط: ${slideContent.bullets.join(', ')}` : ''}
${slideContent.equation ? `المعادلة: ${slideContent.equation}` : ''}

🎯 الأهداف التعليمية:
================
${context.learningObjectives?.join('\n') || 'فهم المفهوم وتطبيقه'}

⚠️ أخطاء شائعة يجب تجنبها:
================
${context.commonMisconceptions?.join('\n') || 'لا توجد'}

🎨 أسلوب التعلم المفضل:
================
${learningStyleInstructions}

🗣️ اللغة والنبرة:
================
${languageInstructions[language]}
النبرة: ${teachingStyle}
${emotionalSupport}

📝 التعليمات الخاصة:
================
${options.useAnalogies ? '✅ استخدم تشبيهات من ${profile.interests[0] || "الحياة"}' : ''}
${options.useStories ? '✅ احكي قصة قصيرة مرتبطة بـ ${profile.interests[0] || "المغامرات"}' : ''}
${problem ? `✅ اشرح المسألة بطريقة سقراطية: ${problem.question}` : ''}
${options.specialNeeds?.length ? `احتياجات خاصة: ${options.specialNeeds.join(', ')}` : ''}

🔄 السياق والاستمرارية:
================
${options.previousScript ? `آخر شرح: "${options.previousScript.slice(0, 100)}..."` : ''}
${options.sessionHistory?.length ? `تم شرح: ${options.sessionHistory.length} مفهوم` : ''}
${options.mistakeHistory?.length ? `أخطاء سابقة: ${options.mistakeHistory.slice(-2).join(', ')}` : ''}

💡 استراتيجية التدريس:
================
1. ابدأ بربط المفهوم بشيء من اهتمامات الطالب
2. ${profile.learningStyle.visual > 0.5 ? 'استخدم وصف بصري قوي' : 'ركز على الشرح الصوتي'}
3. ${(options.emotionalState?.confidence ?? 70) < 50 ? 'ابدأ بمثال سهل جداً للثقة' : 'ابدأ بتحدي محفز'}
4. ${profile.learningStyle.kinesthetic > 0.5 ? 'اقترح نشاط عملي' : 'اشرح نظرياً'}
5. تحقق من الفهم بسؤال بسيط
6. ${options.emotionalState?.mood === 'frustrated' ? 'كن صبوراً ومشجعاً جداً' : 'حافظ على الحماس'}

✨ النتيجة المطلوبة:
================
سكريبت تعليمي:
- يناسب الحالة العاطفية للطالب
- يستخدم أسلوب التعلم المفضل
- يربط باهتمامات الطالب
- يتجنب نقاط الضعف المعروفة
- يبني على نقاط القوة
- ${options.emotionalState?.needsBreak ? 'قصير ومحفز' : 'شامل ومفصل'}

اكتب السكريبت مباشرة بدون مقدمات:`;
    
    return prompt;
  }
  
  /**
   * 🆕 Determine teaching style based on profile
   */
  private determineTeachingStyle(
    profile: StudentProfile,
    options: TeachingScriptOptions
  ): string {
    if (options.voiceStyle) {
      return options.voiceStyle;
    }
    
    // Adapt based on emotional state
    if (options.emotionalState?.mood === 'frustrated') {
      return 'صبور ومشجع جداً';
    } else if (options.emotionalState?.mood === 'happy') {
      return 'حماسي ومليء بالتحديات';
    } else if (options.emotionalState?.mood === 'tired') {
      return 'هادئ ومريح';
    }
    
    // Default based on profile
    if (profile.sessionCount < 3) {
      return 'ودود ومرحب';
    } else if (profile.strengths.length > profile.weaknesses.length) {
      return 'محفز للتحدي';
    }
    
    return 'متوازن ومشجع';
  }
  
  /**
   * 🆕 Get emotional support instructions
   */
  private getEmotionalSupportInstructions(state: EmotionalState): string {
    const instructions = {
      frustrated: 'كن صبوراً جداً، قسّم الشرح لخطوات صغيرة، أكد على قدرة الطالب',
      confused: 'أعد الشرح ببساطة أكثر، استخدم أمثلة متعددة، تحقق من كل خطوة',
      tired: 'اجعل الشرح قصيراً ومركزاً، اقترح راحة، استخدم طاقة هادئة',
      happy: 'استغل الحماس، أضف تحديات، شجع على الاستكشاف',
      neutral: 'حافظ على التوازن، راقب ردود الفعل'
    };
    
    return instructions[state.mood];
  }
  
  /**
   * 🆕 Get learning style instructions
   */
  private getLearningStyleInstructions(style: LearningStyle): string {
    const dominant = Object.entries(style).reduce((a, b) => 
      b[1] > a[1] ? b : a
    );
    
    const instructions = {
      visual: 'استخدم أوصاف بصرية قوية، اذكر الألوان والأشكال، ارسم بالكلمات',
      auditory: 'استخدم إيقاع في الكلام، كرر المفاهيم المهمة، استخدم قوافي',
      kinesthetic: 'اقترح حركات، اربط بأنشطة عملية، "تخيل أنك تمسك..."',
      reading: 'نظم المعلومات في نقاط، استخدم تسلسل منطقي، أعط مراجع'
    };
    
    return instructions[dominant[0] as keyof typeof instructions];
  }
  
  /**
   * 🆕 Get emotional support phrases
   */
  private getEmotionalSupport(profile: StudentProfile): string[] {
    const support = [
      `أنت قادر يا ${profile.name || 'بطل'}`,
      'كل خطوة تقربك من النجاح',
      'أنا فخور بمجهودك',
      'الأخطاء فرص للتعلم'
    ];
    
    if (profile.strengths.length > 0) {
      support.push(`أنت ممتاز في ${profile.strengths[0]}`);
    }
    
    return support;
  }
  
  /**
   * 🆕 Generate with smart model selection
   */
  private async generateWithSmartModel(
    prompt: string,
    options: TeachingScriptOptions,
    profile: StudentProfile
  ): Promise<string> {
    
    // Select temperature based on need
    const temperature = this.getAdaptiveTemperature(options, profile);
    
    // Determine task type for model selection
    const taskType = this.determineTaskType(options);
    
    const response = await openAIService.chat([
      { 
        role: 'system', 
        content: `أنت معلم خبير في التعلم التكيفي والذكاء العاطفي.
        لديك خبرة في التعامل مع جميع أنواع الطلاب.
        ${profile.name ? `تتحدث مع ${profile.name}` : ''}
        مستوى الطالب: ${profile.level}`
      },
      { 
        role: 'user', 
        content: prompt 
      }
    ], {
      temperature,
      maxTokens: 800,
      autoSelectModel: true,
      taskType: taskType as any,
      presencePenalty: 0.3,
      frequencyPenalty: 0.4
    });
    
    return response;
  }
  
  /**
   * 🆕 Get adaptive temperature
   */
  private getAdaptiveTemperature(
    options: TeachingScriptOptions,
    profile: StudentProfile
  ): number {
    // More creative for stories
    if (options.useStories) return 0.9;
    
    // More creative for engaged students
    if ((options.emotionalState?.engagement ?? 70) > 80) return 0.8;
    
    // More consistent for confused students
    if (options.emotionalState?.mood === 'confused') return 0.5;
    
    // Problem solving needs precision
    if (options.interactionType === 'problem') return 0.6;
    
    // Default balanced
    return 0.7;
  }
  
  /**
   * 🆕 Determine task type for model selection
   */
  private determineTaskType(options: TeachingScriptOptions): string {
    if (options.needProblem || options.interactionType === 'problem') {
      return 'math';
    }
    if (options.interactionType === 'socratic') {
      return 'reasoning';
    }
    if (options.useStories) {
      return 'creative';
    }
    if (options.needMoreDetail) {
      return 'explanation';
    }
    return 'general';
  }
  
  /**
   * Process and enhance script with personalization
   */
  private processAndEnhanceScript(
    script: string, 
    level: EducationalLevel,
    options: TeachingScriptOptions,
    profile: StudentProfile
  ): TeachingScript {
    
    // Clean the script
    let processedScript = this.cleanScript(script);
    
    // Add student name naturally
    if (profile.name && !processedScript.includes(profile.name)) {
      processedScript = this.insertStudentName(processedScript, profile.name);
    }
    
    // 🆕 Adapt language complexity
    if (profile.level === 'primary') {
      processedScript = this.simplifyLanguage(processedScript);
    }
    
    // Extract components
    const keyPoints = this.extractKeyPoints(processedScript);
    const examples = this.extractExamples(processedScript);
    const visualCues = this.extractEnhancedVisualCues(processedScript, profile.learningStyle);
    
    // Determine emotional tone
    const emotionalTone = this.analyzeEmotionalTone(processedScript);
    
    // Generate next suggestions
    const nextSuggestions = this.generateSmartNextSuggestions(
      options,
      profile,
      processedScript
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
   * 🆕 Simplify language for younger students
   */
  private simplifyLanguage(script: string): string {
    const replacements = {
      'بالتالي': 'يعني',
      'وبناءً على': 'وعشان',
      'نستنتج': 'نعرف',
      'العملية الحسابية': 'الحساب',
      'المعادلة': 'المسألة'
    };
    
    let simplified = script;
    Object.entries(replacements).forEach(([complex, simple]) => {
      simplified = simplified.replace(new RegExp(complex, 'g'), simple);
    });
    
    return simplified;
  }
  
  /**
   * 🆕 Extract enhanced visual cues based on learning style
   */
  private extractEnhancedVisualCues(
    script: string,
    learningStyle: LearningStyle
  ): string[] {
    const cues: string[] = [];
    
    // Base visual keywords
    const visualKeywords: Record<string, string> = {
      'تخيل': 'show_imagination_graphic',
      'انظر': 'highlight_element',
      'شوف': 'zoom_in',
      'لاحظ': 'add_pointer',
      'ركز': 'focus_effect',
      'مثال': 'show_example_box',
      'المعادلة': 'highlight_equation'
    };
    
    // Add more cues for visual learners
    if (learningStyle.visual > 0.6) {
      visualKeywords['اللون'] = 'color_code';
      visualKeywords['الشكل'] = 'draw_shape';
      visualKeywords['الرسم'] = 'show_diagram';
    }
    
    Object.entries(visualKeywords).forEach(([keyword, cue]) => {
      if (script.includes(keyword)) {
        cues.push(cue);
      }
    });
    
    // Add kinesthetic cues
    if (learningStyle.kinesthetic > 0.6) {
      cues.push('interactive_element', 'drag_and_drop');
    }
    
    return cues;
  }
  
  /**
   * 🆕 Generate smart next suggestions
   */
  private generateSmartNextSuggestions(
    options: TeachingScriptOptions,
    profile: StudentProfile,
    script: string
  ): string[] {
    const suggestions: string[] = [];
    
    // Based on emotional state
    if (options.emotionalState?.mood === 'frustrated') {
      suggestions.push('motivate', 'example', 'hint');
    } else if (options.emotionalState?.mood === 'happy') {
      suggestions.push('problem', 'challenge', 'continue');
    } else if (options.emotionalState?.mood === 'tired') {
      suggestions.push('summary', 'stop', 'motivate');
    }
    
    // Based on progress
    if (options.currentProgress && options.currentProgress > 80) {
      suggestions.push('quiz', 'problem', 'summary');
    } else if (options.currentProgress && options.currentProgress < 30) {
      suggestions.push('example', 'more_detail', 'socratic');
    }
    
    // Based on understanding check
    if (script.includes('فاهم') || script.includes('معايا')) {
      suggestions.push('check', 'quiz', 'problem');
    }
    
    // Remove duplicates and limit
    return [...new Set(suggestions)].slice(0, 4);
  }
  
  /**
   * 🆕 Generate adaptive elements
   */
  private generateAdaptiveElements(
    options: TeachingScriptOptions,
    profile: StudentProfile,
    context: EducationalContext
  ): any {
    const elements: any = {};
    
    // Difficulty adjustment
    if (options.mistakeHistory && options.mistakeHistory.length > 2) {
      elements.difficultyAdjustment = 'easier';
    } else if (options.successHistory && options.successHistory.length > 3) {
      elements.difficultyAdjustment = 'harder';
    }
    
    // Emotional support
    if ((options.emotionalState?.confidence ?? 70) < 50) {
      elements.emotionalSupport = this.getEmotionalSupport(profile);
    }
    
    // Break suggestion
    if (options.emotionalState?.needsBreak) {
      elements.breakSuggested = true;
    }
    
    // Alternative explanation
    if (options.mistakeHistory && options.mistakeHistory.length > 0) {
      elements.alternativeExplanation = 'جرب طريقة مختلفة للشرح';
    }
    
    return elements;
  }
  
  /**
   * 🆕 Should generate parent report
   */
  private shouldGenerateParentReport(
    options: TeachingScriptOptions,
    profile: StudentProfile
  ): boolean {
    // Generate after every 5 sessions
    if (profile.sessionCount % 5 === 0 && profile.sessionCount > 0) {
      return true;
    }
    
    // Generate if struggling
    if (options.mistakeHistory && options.mistakeHistory.length > 3) {
      return true;
    }
    
    // Generate on summary
    if (options.interactionType === 'summary') {
      return true;
    }
    
    return false;
  }
  
  /**
   * 🆕 Generate parent report
   */
  private async generateParentReport(
    profile: StudentProfile,
    options: TeachingScriptOptions,
    script: TeachingScript
  ): Promise<any> {
    const report = {
      summary: `${profile.name} أكمل ${profile.sessionCount} جلسة تعليمية`,
      strengths: profile.strengths.length > 0 
        ? profile.strengths 
        : ['التفاعل الإيجابي', 'المحاولة المستمرة'],
      areasToImprove: profile.weaknesses.length > 0
        ? profile.weaknesses
        : ['التركيز لفترات أطول'],
      recommendations: [
        'مراجعة يومية 15 دقيقة',
        'حل 3 مسائل يومياً',
        'التشجيع المستمر'
      ]
    };
    
    // Add emotional insights
    if (options.emotionalState) {
      if (options.emotionalState.confidence < 50) {
        report.recommendations.push('بناء الثقة بمسائل سهلة أولاً');
      }
      if (options.emotionalState.engagement < 50) {
        report.recommendations.push('ربط الدروس باهتمامات الطالب');
      }
    }
    
    return report;
  }
  
  /**
   * 🆕 Update student profile after session
   */
  private async updateStudentProfile(
    profile: StudentProfile,
    script: TeachingScript,
    options: TeachingScriptOptions
  ): Promise<void> {
    profile.sessionCount++;
    profile.totalLearningTime += script.duration;
    profile.lastSessionDate = new Date();
    
    // Update strengths and weaknesses
    if (options.successHistory && options.successHistory.length > 0) {
      const lastSuccess = options.successHistory[options.successHistory.length - 1];
      if (!profile.strengths.includes(lastSuccess)) {
        profile.strengths.push(lastSuccess);
        if (profile.strengths.length > 5) {
          profile.strengths.shift();
        }
      }
    }
    
    if (options.mistakeHistory && options.mistakeHistory.length > 0) {
      const lastMistake = options.mistakeHistory[options.mistakeHistory.length - 1];
      if (!profile.weaknesses.includes(lastMistake)) {
        profile.weaknesses.push(lastMistake);
        if (profile.weaknesses.length > 5) {
          profile.weaknesses.shift();
        }
      }
    }
    
    // Update emotional baseline
    if (options.emotionalState) {
      profile.emotionalBaseline = {
        ...profile.emotionalBaseline,
        confidence: Math.round(
          (profile.emotionalBaseline.confidence + options.emotionalState.confidence) / 2
        ),
        engagement: Math.round(
          (profile.emotionalBaseline.engagement + options.emotionalState.engagement) / 2
        )
      };
    }
    
    // Save to storage
    this.studentProfiles.set(profile.id, profile);
  }
  
  /**
   * 🆕 Calculate adaptive duration
   */
  private calculateAdaptiveDuration(
    script: string,
    pace?: 'slow' | 'normal' | 'fast',
    profile?: StudentProfile
  ): number {
    const words = script.split(/\s+/).length;
    
    // Adjust WPM based on profile
    let baseWPM = {
      'slow': 100,
      'normal': 130,
      'fast': 160
    };
    
    // Slower for younger students
    if (profile && profile.level === 'primary') {
      baseWPM.slow = 80;
      baseWPM.normal = 100;
      baseWPM.fast = 120;
    }
    
    const wpm = baseWPM[pace || 'normal'];
    const duration = Math.ceil((words / wpm) * 60);
    
    // Add pause time
    const pauseTime = (script.match(/[.!?؟]/g) || []).length * 0.5;
    
    // Add interaction time
    const interactionTime = (script.match(/\?/g) || []).length * 2;
    
    return duration + pauseTime + interactionTime + 2;
  }
  
  /**
   * 🆕 Create adaptive fallback script
   */
  private createAdaptiveFallbackScript(
    slideContent: any,
    options: TeachingScriptOptions,
    profile?: StudentProfile
  ): TeachingScript {
    const greetings = profile?.name 
      ? [`أهلاً يا ${profile.name}`, `${profile.name} حبيبي`]
      : ['أهلاً وسهلاً', 'يلا بينا نتعلم'];
    
    let script = `${this.getRandomPhrase(greetings)}! `;
    
    // Adapt to emotional state
    if (options.emotionalState?.mood === 'frustrated') {
      script += 'مفيش مشكلة، هنشرح تاني بطريقة أسهل. ';
    } else if (options.emotionalState?.mood === 'happy') {
      script += 'شكلك متحمس النهاردة! ';
    }
    
    if (slideContent?.title) {
      script += `هنتكلم عن ${slideContent.title}. `;
    }
    
    if (slideContent?.content) {
      script += `${slideContent.content} `;
    }
    
    // Add personalized encouragement
    if (profile?.strengths && profile.strengths.length > 0) {
      script += `أنت ممتاز في ${profile.strengths[0]}، وده هيساعدك هنا! `;
    }
    
    const encouragements = [
      'أنا متأكد إنك هتفهمها',
      'خطوة خطوة هنوصل',
      'معاك أنا، مش لوحدك'
    ];
    
    script += this.getRandomPhrase(encouragements) + '!';
    
    return {
      script,
      duration: Math.ceil(script.split(/\s+/).length / 2) + 3,
      emotionalTone: 'encouraging',
      keyPoints: slideContent.bullets || [],
      nextSuggestions: ['example', 'more_detail', 'motivate'],
      adaptiveElements: {
        emotionalSupport: ['أنت قادر', 'معاك خطوة بخطوة']
      }
    };
  }
  
  // ============= ENHANCED HELPER METHODS =============
  
  /**
   * Validate options with smart defaults
   */
  private validateOptions(options: TeachingScriptOptions): TeachingScriptOptions {
    try {
      const optionsWithDefaults = {
        ...options,
        studentGrade: options.studentGrade || 6,
        lessonId: options.lessonId || 'default'
      };
      
      return teachingOptionsSchema.parse(optionsWithDefaults) as TeachingScriptOptions;
    } catch (error) {
      console.warn('⚠️ Invalid options, using defaults');
      
      return {
        ...options,
        studentGrade: options.studentGrade || 6,
        lessonId: options.lessonId || 'default'
      };
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
   * Get random phrase
   */
  private getRandomPhrase(phrases: string[]): string {
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
  
  /**
   * Extract topic from script
   */
  private extractTopic(script: string): string {
    const words = script.split(/\s+/).slice(0, 10);
    return words.join(' ') + '...';
  }
  
  /**
   * 🆕 Rephrase concept with learning style
   */
  private rephraseConcept(
    original: string,
    level: EducationalLevel,
    learningStyle?: LearningStyle
  ): string {
    const rephrases = {
      'primary': 'خلينا نقول الكلام ده بطريقة تانية: ',
      'prep': 'نشرح بشكل مختلف: ',
      'secondary': 'صياغة أخرى للمفهوم: '
    };
    
    let rephrased = rephrases[level] + original;
    
    // Add learning style adaptation
    if (learningStyle) {
      if (learningStyle.visual > 0.6) {
        rephrased = 'تخيل معايا: ' + rephrased;
      } else if (learningStyle.kinesthetic > 0.6) {
        rephrased = 'لو جربت بإيدك: ' + rephrased;
      }
    }
    
    return rephrased;
  }
  
  /**
   * 🆕 Generate personalized example
   */
  private generatePersonalizedExample(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel,
    profile: StudentProfile
  ): string {
    const interest = profile.interests[0] || 'الرياضة';
    
    const examples = {
      'primary': `تخيل لو ${slideContent.title} ده زي ${interest}...`,
      'prep': `مثال من ${interest}: ${slideContent.title}...`,
      'secondary': `تطبيق ${slideContent.title} في ${interest}:`
    };
    
    return examples[level];
  }
  
  /**
   * 🆕 Generate quick problem adapted to student
   */
  private generateQuickProblem(
    slideContent: any,
    level: EducationalLevel,
    profile: StudentProfile
  ): Partial<EducationalProblem> {
    const difficulty = profile.strengths.length > profile.weaknesses.length 
      ? 'medium' : 'easy';
    
    return {
      question: `${profile.name ? `يا ${profile.name}، ` : ''}لو عندك ${slideContent.title || 'المسألة دي'}، إيه الحل؟`,
      hints: ['فكر في القاعدة', 'جرب خطوة خطوة', 'راجع المثال'],
      difficulty: difficulty as any
    };
  }
  
  /**
   * 🆕 Generate adaptive quiz question
   */
  private generateAdaptiveQuizQuestion(
    slideContent: any,
    level: EducationalLevel,
    profile: StudentProfile
  ): string {
    const questions = {
      'primary': `سؤال سريع ${profile.name ? `يا ${profile.name}` : ''}: إيه اللي فهمته عن ${slideContent.title}؟`,
      'prep': `اختبر نفسك: ${slideContent.title} بيستخدم في إيه؟`,
      'secondary': `تحليل: كيف يمكن تطوير ${slideContent.title}؟`
    };
    
    return questions[level];
  }
  
  /**
   * 🆕 Generate personalized summary
   */
  private generatePersonalizedSummary(
    sessionHistory: string[],
    context: EducationalContext,
    level: EducationalLevel,
    profile: StudentProfile
  ): string {
    const summaryStarters = {
      'primary': `${profile.name ? `برافو يا ${profile.name}!` : 'برافو!'} خلصنا: `,
      'prep': 'ملخص الدرس: ',
      'secondary': 'النقاط الرئيسية: '
    };
    
    let summary = summaryStarters[level];
    
    if (context.concepts && context.concepts.length > 0) {
      summary += `تعلمنا ${context.concepts.length} مفاهيم. `;
    }
    
    if (profile.strengths.length > 0) {
      summary += `أنت تطورت في ${profile.strengths[0]}! `;
    }
    
    summary += 'فخور بيك!';
    
    return summary;
  }
  
  /**
   * 🆕 Generate detailed explanation with adaptation
   */
  private generateDetailedExplanation(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel,
    previousScript?: string,
    profile?: StudentProfile
  ): string {
    let explanation = `${profile?.name ? `يا ${profile.name}، ` : ''}خلينا نفصّل في ${slideContent.title || 'الموضوع'}. `;
    
    if (profile && profile.learningStyle.visual > 0.6) {
      explanation += 'تخيل معايا الصورة دي: ';
    }
    
    if (context.enrichedContent) {
      const contentText = typeof context.enrichedContent === 'string' 
        ? context.enrichedContent 
        : JSON.stringify(context.enrichedContent);
      explanation += `${contentText.slice(0, 200)}... `;
    }
    
    if (profile && profile.weaknesses.includes(slideContent.title)) {
      explanation += 'خد وقتك، ده موضوع محتاج تركيز. ';
    }
    
    return explanation;
  }
  
  /**
   * 🆕 Generate adaptive explanation
   */
  private generateAdaptiveExplanation(
    slideContent: any,
    context: EducationalContext,
    level: EducationalLevel,
    profile: StudentProfile
  ): string {
    const intro = profile.strengths.length > 0
      ? `زي ما أنت شاطر في ${profile.strengths[0]}, `
      : '';
    
    return `${intro}${slideContent.title || 'الموضوع ده'} ${slideContent.content || 'مهم جداً'}`;
  }
  
  /**
   * Extract all key points
   */
  private extractAllKeyPoints(sessionHistory: string[]): string[] {
    const allPoints: string[] = [];
    
    sessionHistory.forEach(script => {
      const points = this.extractKeyPoints(script);
      allPoints.push(...points);
    });
    
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
        question: `حل: x + 5 = 12`,
        hints: ['انقل 5 للطرف التاني', 'غير الإشارة'],
        solution: 'x = 7',
        steps: ['x + 5 = 12', 'x = 12 - 5', 'x = 7']
      },
      'hard': {
        question: `حل: x² + 4x + 4 = 0`,
        hints: ['مربع كامل', '(x + 2)²'],
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
   * Clean script text
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
   * Insert student name naturally
   */
  private insertStudentName(script: string, name: string): string {
    const greetings = [
      `يا ${name}`,
      `${name} حبيبي`,
      `عاش يا ${name}`
    ];
    
    const sentences = script.split(/[.!؟]/);
    if (sentences.length > 2) {
      const randomIndex = Math.floor(Math.random() * 3) + 1;
      sentences[randomIndex] = sentences[randomIndex] + ` ${this.getRandomPhrase(greetings)}`;
    }
    
    return sentences.join('. ');
  }
  
  /**
   * Analyze emotional tone
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
   * Calculate interaction points
   */
  private calculateInteractionPoints(script: string): number[] {
    const points: number[] = [];
    const sentences = script.split(/[.!?؟]/);
    
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
  
  // ============= CACHING SYSTEM =============
  
  /**
   * Generate cache key
   */
  private generateCacheKey(options: TeachingScriptOptions): string {
    const key = `${options.lessonId}_${options.slideContent?.title || 'untitled'}_${options.studentGrade || 6}_${options.interactionType || 'default'}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }
  
  /**
   * Get cached script
   */
  private getCachedScript(options: TeachingScriptOptions): TeachingScript | null {
    const key = this.generateCacheKey(options);
    const cached = this.scriptCache.get(key);
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      
      if (age < this.CACHE_TTL) {
        cached.hits++;
        
        const script = { ...cached.script };
        if (script.metadata) {
          script.metadata.cached = true;
        }
        
        return script;
      } else {
        this.scriptCache.delete(key);
      }
    }
    
    return null;
  }
  
  /**
   * Cache script
   */
  private cacheScript(options: TeachingScriptOptions, script: TeachingScript): void {
    if (this.scriptCache.size >= this.MAX_CACHE_SIZE) {
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
   * Clear cache
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
    console.log(`🎓 Generating adaptive scripts for ${slides.length} slides`);
    
    const scripts: TeachingScript[] = [];
    const sessionHistory: string[] = [];
    let previousScript: string | undefined;
    const mistakeHistory: string[] = [];
    const successHistory: string[] = [];
    
    // Get or create student profile
    const profile = await this.getOrCreateStudentProfile(
      studentName || 'student',
      studentGrade
    );
    
    // Start session tracking
    const sessionId = `${profile.id}_${Date.now()}`;
    this.activeSessions.set(sessionId, {
      startTime: new Date(),
      interactions: 0,
      emotionalHistory: [],
      problemsSolved: 0,
      correctAnswers: 0
    });
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const progress = Math.round((i / slides.length) * 100);
      
      // Detect emotional state from progress
      const emotionalState = await this.detectEmotionalState(
        sessionHistory,
        previousScript
      );
      
      const script = await this.generateTeachingScript({
        slideContent: slide,
        lessonId,
        studentGrade,
        studentName,
        previousScript,
        sessionHistory,
        currentProgress: progress,
        emotionalState,
        mistakeHistory,
        successHistory,
        voiceStyle: i === 0 ? 'energetic' : 'friendly',
        paceSpeed: slide.type === 'quiz' ? 'slow' : 'normal',
        useAnalogies: slide.type === 'content',
        useStories: i === 0 && studentGrade <= 6
      });
      
      scripts.push(script);
      sessionHistory.push(script.script);
      previousScript = script.script.slice(0, 200);
      
      // Track session
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.interactions++;
        session.emotionalHistory.push(emotionalState);
      }
      
      // Small delay
      if (i < slides.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // End session
    this.activeSessions.delete(sessionId);
    
    console.log(`✅ Generated ${scripts.length} adaptive scripts`);
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
      emotionalState?: EmotionalState;
    }
  ): Promise<TeachingScript> {
    return this.generateTeachingScript({
      slideContent: currentSlide,
      lessonId,
      studentGrade,
      studentName: context?.studentName,
      interactionType,
      previousScript: context?.previousScript,
      sessionHistory: context?.sessionHistory,
      emotionalState: context?.emotionalState
    });
  }
  
  /**
   * 🆕 Get student progress report
   */
  async getStudentProgressReport(
    studentName: string,
    studentGrade: number
  ): Promise<any> {
    const profile = await this.getOrCreateStudentProfile(studentName, studentGrade);
    
    return {
      profile,
      totalSessions: profile.sessionCount,
      totalLearningTime: `${Math.round(profile.totalLearningTime / 60)} دقيقة`,
      strengths: profile.strengths,
      weaknesses: profile.weaknesses,
      emotionalTrend: profile.emotionalBaseline,
      recommendations: [
        profile.weaknesses.length > 0 
          ? `ركز على ${profile.weaknesses[0]}`
          : 'استمر في التقدم',
        'حل 5 مسائل يومياً',
        'راجع الدروس السابقة'
      ]
    };
  }
  
  /**
   * Generate personalized greeting
   */
  async generateGreeting(
    studentName: string,
    studentGrade: number,
    timeOfDay: 'morning' | 'afternoon' | 'evening'
  ): Promise<string> {
    const profile = await this.getOrCreateStudentProfile(studentName, studentGrade);
    
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
    
    let greeting = `${this.getRandomPhrase(greetings[timeOfDay])} ${levelGreeting[level]}! `;
    
    // Add personalized touch
    if (profile.sessionCount > 0) {
      greeting += `سعيد برجوعك! `;
      if (profile.strengths.length > 0) {
        greeting += `آخر مرة كنت رائع في ${profile.strengths[0]}! `;
      }
    } else {
      greeting += `أهلاً بيك في أول جلسة! `;
    }
    
    greeting += 'جاهز نتعلم حاجات جديدة النهاردة؟';
    
    return greeting;
  }
  
  /**
   * 🆕 Get interactive content from enriched data
   */
  async getInteractiveContent(lessonId: string, contentType: string): Promise<any | null> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content?.enrichedContent) {
      return null;
    }

    try {
      const enriched = typeof lesson.content.enrichedContent === 'string'
        ? JSON.parse(lesson.content.enrichedContent)
        : lesson.content.enrichedContent;

      switch (contentType) {
        case 'challenge':
          if (enriched.challenges && enriched.challenges.length > 0) {
            return enriched.challenges[Math.floor(Math.random() * enriched.challenges.length)];
          }
          break;

        case 'visual':
          if (enriched.visualAids && enriched.visualAids.length > 0) {
            return enriched.visualAids[Math.floor(Math.random() * enriched.visualAids.length)];
          }
          break;

        case 'funFact':
          if (enriched.funFacts && enriched.funFacts.length > 0) {
            return enriched.funFacts[Math.floor(Math.random() * enriched.funFacts.length)];
          }
          break;

        case 'story':
          if (enriched.educationalStories && enriched.educationalStories.length > 0) {
            return enriched.educationalStories[0]; // Return first story
          }
          break;

        case 'application':
          if (enriched.realWorldApplications && enriched.realWorldApplications.length > 0) {
            return enriched.realWorldApplications[Math.floor(Math.random() * enriched.realWorldApplications.length)];
          }
          break;

        case 'tip':
          if (enriched.studentTips && enriched.studentTips.length > 0) {
            return enriched.studentTips[Math.floor(Math.random() * enriched.studentTips.length)];
          }
          break;

        case 'mistake':
          if (enriched.commonMistakes && enriched.commonMistakes.length > 0) {
            return enriched.commonMistakes[Math.floor(Math.random() * enriched.commonMistakes.length)];
          }
          break;

        default:
          return null;
      }
    } catch (error) {
      console.error('Error getting interactive content:', error);
      return null;
    }

    return null;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    cacheStats: any;
    activeSessions: number;
    studentProfiles: number;
    lastGeneration?: Date;
  } {
    const cacheStats = this.getCacheStats();

    return {
      status: 'healthy',
      cacheStats,
      activeSessions: this.activeSessions.size,
      studentProfiles: this.studentProfiles.size,
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
    },
    
    onEmotionalStateUpdate: async (data: any) => {
      return teachingAssistant.generateTeachingScript({
        ...data,
        emotionalState: data.emotionalState
      });
    },
    
    onGetProgressReport: async (data: any) => {
      return teachingAssistant.getStudentProgressReport(
        data.studentName,
        data.studentGrade
      );
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
    getProgressReport: teachingAssistant.getStudentProgressReport.bind(teachingAssistant),
    generateGreeting: teachingAssistant.generateGreeting.bind(teachingAssistant),
    getHealth: teachingAssistant.getHealthStatus.bind(teachingAssistant),
    clearCache: teachingAssistant.clearCache.bind(teachingAssistant)
  };
};