// src/core/quiz/quiz.service.ts

import { z } from 'zod';
import { prisma } from '../../config/database.config';
import { ragService } from '../rag/rag.service';
import { openAIService } from '../../services/ai/openai.service';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { Difficulty } from '@prisma/client';
import type { 
  QuizQuestion, 
  QuizSession, 
  QuizResult, 
  UserAnswer,
  QuestionResult,
  QuizStatistics,
  QuizPerformance,
  AnswerSubmissionResult
} from '../../types/quiz.types';
import type { Question, QuizAttempt, QuestionType } from '@prisma/client';

// 🆕 Import for student context integration
interface StudentQuizContext {
  id: string;
  name: string;
  emotionalState?: {
    mood: 'happy' | 'neutral' | 'frustrated' | 'confused' | 'tired';
    confidence: number;
    engagement: number;
  };
  quizHistory: {
    totalAttempts: number;
    averageScore: number;
    strongTopics: string[];
    weakTopics: string[];
    commonMistakes: string[];
    lastAttemptDate?: Date;
  };
  learningStyle: {
    preferredQuestionTypes: string[];
    averageResponseTime: number;
    hintsUsed: number;
  };
}

// Extended interfaces for new features
interface ExtendedQuizSession extends QuizSession {
  welcomeMessage?: string;
  emotionalSupport?: any;
}

interface ExtendedAnswerSubmissionResult extends AnswerSubmissionResult {
  encouragement?: string;
}

interface ExtendedQuizResult extends QuizResult {
  parentReport?: any;
}

/**
 * Enhanced Quiz Service with Adaptive & Dynamic Features
 * Version: 3.1 - With Student Context & Emotional Intelligence
 */
export class QuizService {
  private readonly PASS_THRESHOLD = 60;
  private readonly MAX_QUESTIONS_PER_QUIZ = 10;
  
  // Dynamic quiz settings
  private readonly QUIZ_SETTINGS = {
    adaptiveDifficulty: true,
    mixQuestionTypes: true,
    useGamification: true,
    provideHints: true,
    instantFeedback: true,
    emotionalAdaptation: true, // 🆕
    parentReporting: true, // 🆕
  };
  
  // Question type distribution
  private readonly QUESTION_TYPE_MIX = {
    MCQ: 35,
    TRUE_FALSE: 20,
    FILL_BLANK: 15,
    SHORT_ANSWER: 10,
    PROBLEM: 15,
    ESSAY: 5,
  };
  
  // Performance tracking (in-memory)
  private userPerformance: Map<string, QuizPerformance> = new Map();
  
  // 🆕 Student contexts
  private studentContexts: Map<string, StudentQuizContext> = new Map();
  
  // 🆕 Emotional response templates
  private readonly EMOTIONAL_RESPONSES = {
    frustrated: {
      encouragement: 'لا تقلق، كل واحد بيغلط. المهم نتعلم من أخطائنا!',
      hint: 'خد نفس عميق وفكر تاني. أنت قادر!',
      afterCorrect: 'شفت؟ قلتلك إنك تقدر! 🌟'
    },
    confused: {
      encouragement: 'خلينا نفكر سوا خطوة بخطوة',
      hint: 'الموضوع أبسط مما تتخيل. فكر في الأساسيات',
      afterCorrect: 'ممتاز! بدأت تفهم الموضوع'
    },
    tired: {
      encouragement: 'أعرف إنك تعبان، بس شوية كمان وهنخلص',
      hint: 'ركز في النقطة الأساسية بس',
      afterCorrect: 'برافو! حتى وأنت تعبان بتحل صح'
    },
    happy: {
      encouragement: 'حماسك جميل! يلا نكمل',
      hint: 'أنت على الطريق الصحيح!',
      afterCorrect: 'رائع! استمر كده'
    },
    neutral: {
      encouragement: 'أنت بتبلي بلاء حسن',
      hint: 'راجع السؤال مرة تانية',
      afterCorrect: 'أحسنت!'
    }
  };

  /**
   * 🆕 Get or create student quiz context
   */
  private async getStudentContext(userId: string): Promise<StudentQuizContext> {
    if (!this.studentContexts.has(userId)) {
      // Load from database or create new
      const history = await this.getUserQuizHistory(userId);
      
      const context: StudentQuizContext = {
        id: userId,
        name: userId, // In production, get from user profile
        emotionalState: {
          mood: 'neutral',
          confidence: 70,
          engagement: 70
        },
        quizHistory: {
          totalAttempts: history.length,
          averageScore: history.length > 0 
            ? history.reduce((sum, h) => sum + (h.score || 0), 0) / history.length
            : 0,
          strongTopics: [],
          weakTopics: [],
          commonMistakes: [],
          lastAttemptDate: history[0]?.createdAt
        },
        learningStyle: {
          preferredQuestionTypes: [],
          averageResponseTime: 45,
          hintsUsed: 0
        }
      };
      
      this.studentContexts.set(userId, context);
    }
    
    return this.studentContexts.get(userId)!;
  }

  /**
   * Generate adaptive quiz questions with student context
   * 🆕 UPDATED: Priority to use enriched exercises from content
   */
  async generateQuizQuestions(
    lessonId: string,
    count: number = 5,
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD',
    userId?: string
  ): Promise<Question[]> {
    console.log(`📝 Generating ${count} adaptive questions`);

    // 🆕 Get student context
    const studentContext = userId ? await this.getStudentContext(userId) : null;

    // Check lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true },
    });

    if (!lesson) {
      throw new NotFoundError('Lesson not found');
    }

    // 🆕 Use enriched exercises FIRST
    if (lesson?.content) {
      // Parse exercises from enrichedContent
      let availableExercises: any[] = [];

      // Check enrichedContent first
      if (lesson.content.enrichedContent) {
        try {
          const enriched = typeof lesson.content.enrichedContent === 'string'
            ? JSON.parse(lesson.content.enrichedContent)
            : lesson.content.enrichedContent;
          if (enriched.exercises && enriched.exercises.length > 0) {
            console.log(`✨ Found ${enriched.exercises.length} enriched exercises`);
            availableExercises = enriched.exercises;
          }
        } catch (e) {
          console.error('Error parsing enrichedContent:', e);
        }
      }

      // Fallback to exercises field
      if (availableExercises.length === 0 && lesson.content.exercises) {
        try {
          const exercises = typeof lesson.content.exercises === 'string'
            ? JSON.parse(lesson.content.exercises)
            : lesson.content.exercises;
          if (Array.isArray(exercises)) {
            console.log(`📚 Found ${exercises.length} regular exercises`);
            availableExercises = exercises;
          }
        } catch (e) {
          console.error('Error parsing exercises:', e);
        }
      }

      // Filter by difficulty if specified
      if (difficulty && availableExercises.length > 0) {
        const filtered = availableExercises.filter(ex =>
          !ex.difficulty || ex.difficulty.toUpperCase() === difficulty
        );
        if (filtered.length > 0) {
          availableExercises = filtered;
        }
      }

      // Convert exercises to Question format
      const questions: Question[] = [];
      const exercisesToUse = this.shuffleArray(availableExercises).slice(0, count);

      for (const ex of exercisesToUse) {
        // Determine question type
        let type: QuestionType = 'MCQ';
        if (ex.type) {
          const typeMap: Record<string, QuestionType> = {
            'multiple_choice': 'MCQ',
            'mcq': 'MCQ',
            'true_false': 'TRUE_FALSE',
            'fill_blank': 'FILL_BLANK',
            'short_answer': 'SHORT_ANSWER',
            'problem': 'PROBLEM',
            'essay': 'ESSAY'
          };
          type = typeMap[ex.type.toLowerCase()] || 'MCQ';
        }

        // Create question in database
        const question = await prisma.question.create({
          data: {
            lessonId,
            type,
            question: ex.question || ex.text || 'سؤال',
            options: ex.options ? JSON.stringify(ex.options) : null,
            correctAnswer: ex.correctAnswer || ex.answer || 'الإجابة',
            explanation: ex.explanation || ex.hint || null,
            points: ex.points || (difficulty === 'HARD' ? 3 : difficulty === 'EASY' ? 1 : 2),
            difficulty: (difficulty || 'MEDIUM') as Difficulty,
            hints: ex.hints ? JSON.stringify(ex.hints) :
                  ex.hint ? JSON.stringify([ex.hint]) : null,
            tags: ex.tags ? JSON.stringify(ex.tags) : null
          }
        });

        questions.push(question);
      }

      if (questions.length >= count) {
        console.log(`✅ Returned ${questions.length} questions from enriched content`);
        return questions;
      }

      // If not enough, complete with dynamic questions
      console.log(`⚠️ Only ${questions.length} exercises found, generating ${count - questions.length} more`);
      const remaining = count - questions.length;
      const dynamicQuestions = await this.generateDynamicQuestions(
        lesson, remaining, difficulty || 'MEDIUM', userId
      );

      const savedDynamicQuestions = await this.saveGeneratedQuestions(
        lessonId, dynamicQuestions, questions.length
      );

      return [...questions, ...savedDynamicQuestions];
    }

    // Fallback: Use existing flow if no enriched content
    console.log('⚠️ No enriched content found, using dynamic generation');

    // Get user performance for adaptive difficulty
    const userLevel = userId ? this.getUserLevel(userId) : null;
    const adaptedDifficulty = this.adaptDifficulty(difficulty, userLevel, studentContext);

    // 🆕 Adapt question types based on student preference
    const preferredTypes = studentContext?.learningStyle.preferredQuestionTypes || [];

    // Check existing questions
    let existingQuestions = await prisma.question.findMany({
      where: {
        lessonId,
        ...(adaptedDifficulty && { difficulty: adaptedDifficulty as Difficulty }),
        ...(preferredTypes.length > 0 && { type: { in: preferredTypes as QuestionType[] } })
      },
      take: Math.floor(count / 2),
    });

    // 🆕 Avoid questions that caused mistakes before
    if (studentContext && studentContext.quizHistory.commonMistakes.length > 0) {
      existingQuestions = existingQuestions.filter(q =>
        !studentContext.quizHistory.commonMistakes.includes(q.id)
      );
    }

    // Shuffle for variety
    existingQuestions = this.shuffleArray(existingQuestions);

    // Generate new dynamic questions
    const newCount = count - existingQuestions.length;
    if (newCount > 0) {
      const generatedQuestions = await this.generateDynamicQuestions(
        lesson,
        newCount,
        adaptedDifficulty,
        userId
      );

      // Save generated questions
      const savedQuestions = await this.saveGeneratedQuestions(
        lessonId,
        generatedQuestions,
        existingQuestions.length
      );

      return [...existingQuestions, ...savedQuestions];
    }

    return existingQuestions;
  }
  
  /**
   * Generate dynamic questions with variety
   */
  private async generateDynamicQuestions(
    lesson: any,
    count: number,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD',
    userId?: string
  ): Promise<QuizQuestion[]> {
    try {
      const questions = await ragService.generateQuizQuestions(
        lesson.id, 
        count,
        userId
      );
      
      // 🆕 Get student context for personalization
      const studentContext = userId ? await this.getStudentContext(userId) : null;
      
      // Enhance with variety and features
      return questions.map((q, index) => this.enhanceQuestion(q, index, difficulty, studentContext));
      
    } catch (error) {
      console.error('Dynamic generation failed:', error);
      return this.generateVariedMockQuestions(lesson, count, difficulty);
    }
  }
  
  /**
   * Enhance question with additional features and personalization
   */
  private enhanceQuestion(
    question: any,
    index: number,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD',
    studentContext?: StudentQuizContext | null
  ): QuizQuestion {
    // Ensure variety in question types
    const type = this.selectQuestionType(index, studentContext) as QuizQuestion['type'];
    
    // Transform based on type
    let enhanced = { ...question };
    
    switch (type) {
      case 'TRUE_FALSE':
        enhanced = this.convertToTrueFalse(question);
        break;
      case 'FILL_BLANK':
        enhanced = this.convertToFillBlank(question);
        break;
      case 'PROBLEM':
        enhanced = this.convertToProblem(question);
        break;
    }
    
    // Add gamification elements
    enhanced.points = this.calculatePoints(difficulty, type);
    enhanced.timeBonus = difficulty === 'HARD' ? 10 : 5;
    
    // 🆕 Personalized hints based on student's weak points
    enhanced.hint = this.generatePersonalizedHint(enhanced.question, studentContext);
    
    // 🆕 Add encouragement based on emotional state
    if (studentContext?.emotionalState) {
      enhanced.encouragement = this.EMOTIONAL_RESPONSES[studentContext.emotionalState.mood].encouragement;
    }
    
    // Add metadata
    enhanced.tags = enhanced.tags || this.extractTags(enhanced.question);
    enhanced.difficulty = difficulty;
    enhanced.type = type;
    
    return enhanced;
  }
  
  /**
   * 🆕 Select question type based on student preference
   */
  private selectQuestionType(index: number, studentContext?: StudentQuizContext | null): string {
    const types = Object.keys(this.QUESTION_TYPE_MIX);
    const weights = Object.values(this.QUESTION_TYPE_MIX);
    
    // 🆕 Prefer student's successful question types
    if (studentContext?.learningStyle?.preferredQuestionTypes && 
        studentContext.learningStyle.preferredQuestionTypes.length > 0) {
      const preferred = studentContext.learningStyle.preferredQuestionTypes;
      if (index % 2 === 0 && preferred.length > 0) {
        return preferred[index % preferred.length];
      }
    }
    
    // Rotate through types for variety
    if (this.QUIZ_SETTINGS.mixQuestionTypes) {
      return types[index % types.length];
    }
    
    // Random weighted selection
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < types.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return types[i];
      }
    }
    
    return 'MCQ';
  }
  
  /**
   * Convert MCQ to True/False
   */
  private convertToTrueFalse(question: any): any {
    if (question.type === 'TRUE_FALSE') return question;
    
    const statement = question.options?.[0] 
      ? `${question.question.replace('؟', '')}: ${question.options[0]}`
      : question.question;
    
    const isTrue = Math.random() > 0.5;
    
    return {
      ...question,
      type: 'TRUE_FALSE',
      question: isTrue ? statement : statement.replace(question.options[0], question.options[1] || 'خطأ'),
      options: ['صح', 'خطأ'],
      correctAnswer: isTrue ? 'صح' : 'خطأ',
      explanation: question.explanation || 'تحقق من المعلومة في الدرس'
    };
  }
  
  /**
   * Convert to Fill in the Blank
   */
  private convertToFillBlank(question: any): any {
    if (question.type === 'FILL_BLANK') return question;
    
    const answer = question.correctAnswer || question.options?.[0] || 'الإجابة';
    const blank = '_____';
    
    let blankQuestion = question.question;
    if (blankQuestion.includes(answer)) {
      blankQuestion = blankQuestion.replace(answer, blank);
    } else {
      blankQuestion = `${question.question.replace('؟', '')} هو ${blank}`;
    }
    
    return {
      ...question,
      type: 'FILL_BLANK',
      question: blankQuestion,
      correctAnswer: answer,
      options: undefined,
      hint: `${answer.length} أحرف`
    };
  }
  
  /**
   * Convert to Problem
   */
  private convertToProblem(question: any): any {
    if (question.type === 'PROBLEM') return question;

    return {
      ...question,
      type: 'PROBLEM' as QuestionType,
      question: `مسألة: ${question.question}`,
      requiresSteps: true,
      points: (question.points || 2) * 2,
      hint: 'ابدأ بتحديد المعطيات والمطلوب',
      timeLimit: 180,
      showCalculator: true,
      allowPartialCredit: true
    };
  }
  
  /**
   * 🆕 Generate personalized hint
   */
  private generatePersonalizedHint(question: string, studentContext?: StudentQuizContext | null): string {
    const baseHints = [
      'راجع الدرس مرة أخرى',
      'فكر في المعطيات',
      'ابحث عن الكلمات المفتاحية',
      'تذكر القاعدة الأساسية',
      'حاول التبسيط أولاً'
    ];
    
    if (!studentContext) {
      return baseHints[Math.floor(Math.random() * baseHints.length)];
    }
    
    // Personalized hints based on weak topics
    if (studentContext.quizHistory.weakTopics.length > 0) {
      const weakTopic = studentContext.quizHistory.weakTopics[0];
      return `راجع ${weakTopic} - ده نقطة ضعفك`;
    }
    
    // Based on emotional state
    if (studentContext.emotionalState?.mood === 'frustrated') {
      return 'خد نفس عميق. الإجابة أبسط مما تتخيل';
    } else if (studentContext.emotionalState?.mood === 'confused') {
      return 'ابدأ بالأساسيات وابني عليها';
    }
    
    return baseHints[Math.floor(Math.random() * baseHints.length)];
  }
  
  /**
   * Generate varied mock questions
   */
  private generateVariedMockQuestions(
    lesson: any,
    count: number,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  ): QuizQuestion[] {
    const questions: QuizQuestion[] = [];
    const types: QuizQuestion['type'][] = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'];
    
    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      
      questions.push({
        id: `mock-${i}`,
        type,
        question: this.getMockQuestionByType(type, i, lesson.title),
        options: type === 'MCQ' ? ['خيار أ', 'خيار ب', 'خيار ج', 'خيار د'] :
                 type === 'TRUE_FALSE' ? ['صح', 'خطأ'] : undefined,
        correctAnswer: type === 'MCQ' ? 'خيار أ' : 
                      type === 'TRUE_FALSE' ? 'صح' : 
                      'الإجابة النموذجية',
        explanation: 'هذا شرح للإجابة',
        points: this.calculatePoints(difficulty, type),
        difficulty,
        hint: 'راجع الدرس',
        tags: [lesson.title, type],
        timeLimit: 60,
      });
    }
    
    return questions;
  }
  
  /**
   * Get mock question by type
   */
  private getMockQuestionByType(type: string, index: number, lessonTitle: string): string {
    switch (type) {
      case 'TRUE_FALSE':
        return `صح أم خطأ: ${lessonTitle} يحتوي على ${index + 3} مفاهيم أساسية`;
      case 'FILL_BLANK':
        return `أكمل: ${lessonTitle} يتحدث عن _____ و _____`;
      case 'SHORT_ANSWER':
        return `اذكر ثلاثة أمثلة من ${lessonTitle}`;
      case 'PROBLEM':
        return `احسب: إذا كان لديك ${index + 5} وحدات من ${lessonTitle}، كم تحتاج لإكمال 20 وحدة؟`;
      case 'ESSAY':
        return `اشرح بالتفصيل أهمية ${lessonTitle} في الحياة اليومية`;
      default:
        return `سؤال ${index + 1} عن ${lessonTitle}؟`;
    }
  }
  
  /**
   * Start adaptive quiz session with emotional support
   */
  async startQuizAttempt(
    userId: string,
    lessonId: string,
    questionCount?: number,
    mode?: 'practice' | 'test' | 'challenge'
  ): Promise<ExtendedQuizSession> {
    console.log(`🎮 Starting ${mode || 'practice'} quiz for ${userId}`);
    
    // 🆕 Get student context
    const studentContext = await this.getStudentContext(userId);
    
    // 🆕 Welcome message based on history
    let welcomeMessage = '';
    if (studentContext.quizHistory.lastAttemptDate) {
      const daysSinceLastAttempt = Math.floor(
        (Date.now() - new Date(studentContext.quizHistory.lastAttemptDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastAttempt === 0) {
        welcomeMessage = 'أهلاً بيك تاني! حماسك جميل';
      } else if (daysSinceLastAttempt === 1) {
        welcomeMessage = 'رجعت بعد يوم! ممتاز';
      } else if (daysSinceLastAttempt > 7) {
        welcomeMessage = `اشتقنالك! غايب من ${daysSinceLastAttempt} يوم`;
      }
    } else {
      welcomeMessage = 'أول اختبار ليك! بالتوفيق';
    }
    
    // Get adaptive questions
    const requestedCount = questionCount || this.MAX_QUESTIONS_PER_QUIZ;
    const questions = await this.generateQuizQuestions(
      lessonId,
      requestedCount,
      undefined,
      userId
    );
    
    // 🆕 Order questions based on student's emotional state
    const orderedQuestions = this.orderQuestionsByEmotionalState(questions, studentContext);
    
    // Create attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        lessonId,
        totalQuestions: orderedQuestions.length,
        correctAnswers: 0,
      },
    });
    
    // Enhanced session with features
    const session: ExtendedQuizSession = {
      id: attempt.id,
      userId,
      lessonId,
      mode: mode || 'practice',
      questions: orderedQuestions.map(q => ({
        id: q.id,
        type: q.type as QuizQuestion['type'],
        question: q.question,
        options: q.options ? JSON.parse(q.options) : undefined,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || undefined,
        points: q.points,
        difficulty: q.difficulty as 'EASY' | 'MEDIUM' | 'HARD',
        hint: q.hints ? JSON.parse(q.hints)[0] : undefined,
        timeLimit: this.getTimeLimit(q.difficulty as string, q.type as string),
      })),
      answers: [],
      startedAt: attempt.createdAt,
      timeLimit: orderedQuestions.length * 60,
      // Gamification
      lives: mode === 'challenge' ? 3 : undefined,
      streakCount: 0,
      bonusPoints: 0,
      // 🆕 Personalization
      welcomeMessage,
      emotionalSupport: this.EMOTIONAL_RESPONSES[studentContext.emotionalState?.mood || 'neutral'],
    };
    
    return session;
  }
  
  /**
   * 🆕 Order questions based on emotional state
   */
  private orderQuestionsByEmotionalState(questions: any[], studentContext: StudentQuizContext): any[] {
    const mood = studentContext.emotionalState?.mood || 'neutral';
    
    if (mood === 'frustrated' || mood === 'tired') {
      // Start with easy questions to build confidence
      return this.orderQuestionsByDifficulty(questions);
    } else if (mood === 'happy') {
      // Mix difficulties for engagement
      const easy = questions.filter(q => q.difficulty === 'EASY');
      const medium = questions.filter(q => q.difficulty === 'MEDIUM');
      const hard = questions.filter(q => q.difficulty === 'HARD');
      
      const mixed: any[] = [];
      const maxLength = Math.max(easy.length, medium.length, hard.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (easy[i]) mixed.push(easy[i]);
        if (medium[i]) mixed.push(medium[i]);
        if (hard[i]) mixed.push(hard[i]);
      }
      
      return mixed;
    }
    
    // Default: easy to hard
    return this.orderQuestionsByDifficulty(questions);
  }
  
  /**
   * Submit answer with instant feedback and emotional support
   */
  async submitAnswer(
    attemptId: string,
    questionId: string,
    answer: string,
    timeSpent: number
  ): Promise<ExtendedAnswerSubmissionResult> {
    // Get question
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });
    
    if (!question) {
      throw new NotFoundError('Question');
    }
    
    // Get attempt for streak tracking
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true }
    });
    
    // 🆕 Get student context
    const studentContext = attempt?.userId 
      ? await this.getStudentContext(attempt.userId) 
      : null;
    
    // Check answer
    const isCorrect = this.checkAnswer(question, answer);
    
    // Calculate points with bonuses
    let pointsEarned = 0;
    let streakBonus = 0;
    
    if (isCorrect) {
      pointsEarned = question.points;
      
      // Time bonus
      if (timeSpent < 30 && question.difficulty === 'HARD') {
        pointsEarned += 5;
      } else if (timeSpent < 20) {
        pointsEarned += 2;
      }
      
      // Streak bonus
      const currentStreak = this.calculateStreak(attempt?.answers || []);
      if (currentStreak >= 3) {
        streakBonus = Math.min(currentStreak * 2, 10);
        pointsEarned += streakBonus;
      }
      
      // 🆕 Update emotional state positively
      if (studentContext && studentContext.emotionalState) {
        studentContext.emotionalState.confidence = Math.min(100, studentContext.emotionalState.confidence + 5);
        studentContext.emotionalState.engagement = Math.min(100, studentContext.emotionalState.engagement + 3);
      }
    } else {
      // 🆕 Update emotional state
      if (studentContext && studentContext.emotionalState) {
        studentContext.emotionalState.confidence = Math.max(0, studentContext.emotionalState.confidence - 3);
        
        // Check if student is getting frustrated
        const recentWrong = attempt?.answers.slice(-3).filter(a => !a.isCorrect).length || 0;
        if (recentWrong >= 2) {
          studentContext.emotionalState.mood = 'frustrated';
        }
        
        // Track common mistake
        if (!studentContext.quizHistory.commonMistakes.includes(questionId)) {
          studentContext.quizHistory.commonMistakes.push(questionId);
          if (studentContext.quizHistory.commonMistakes.length > 10) {
            studentContext.quizHistory.commonMistakes.shift();
          }
        }
      }
    }
    
    // Save answer
    await prisma.quizAttemptAnswer.create({
      data: {
        attemptId,
        questionId,
        userAnswer: answer,
        isCorrect,
        timeSpent,
      },
    });
    
    // Update attempt
    if (isCorrect) {
      await prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          correctAnswers: { increment: 1 },
        },
      });
    }
    
    // Update user performance
    if (attempt?.userId) {
      this.updateUserPerformance(attempt.userId, isCorrect, timeSpent);
      ragService.updateUserPerformance(attempt.userId, isCorrect);
    }
    
    // 🆕 Generate personalized explanation and encouragement
    let explanation = question.explanation || '';
    let encouragement = '';
    
    if (!isCorrect && studentContext && studentContext.emotionalState) {
      explanation = await this.getPersonalizedExplanation(
        question,
        answer,
        attempt!.userId
      );
      encouragement = this.EMOTIONAL_RESPONSES[studentContext.emotionalState.mood].hint;
    } else if (isCorrect && studentContext && studentContext.emotionalState) {
      encouragement = this.EMOTIONAL_RESPONSES[studentContext.emotionalState.mood].afterCorrect;
    }
    
    return {
      isCorrect,
      explanation,
      pointsEarned,
      streakBonus,
      hint: !isCorrect ? this.generatePersonalizedHint(question.question, studentContext) : undefined,
      encouragement // 🆕
    };
  }
  
  /**
   * Get personalized explanation for wrong answer
   */
  private async getPersonalizedExplanation(
    question: Question,
    userAnswer: string,
    userId: string
  ): Promise<string> {
    try {
      return await ragService.explainWrongAnswer(
        question.question,
        userAnswer,
        question.correctAnswer,
        userId
      );
    } catch (error) {
      return question.explanation || 'حاول مرة أخرى مع التركيز على المعطيات.';
    }
  }
  
  /**
   * Check answer with fuzzy matching
   */
  private checkAnswer(question: Question, userAnswer: string): boolean {
    const correct = question.correctAnswer.toLowerCase().trim();
    const user = userAnswer.toLowerCase().trim();

    switch (question.type) {
      case 'TRUE_FALSE':
        const trueAnswers = ['صح', 'صحيح', 'نعم', 'true', '1'];
        const falseAnswers = ['خطأ', 'خاطئ', 'لا', 'false', '0'];

        if (trueAnswers.includes(user)) return trueAnswers.includes(correct);
        if (falseAnswers.includes(user)) return falseAnswers.includes(correct);
        return false;

      case 'MCQ':
        if (!isNaN(Number(user))) {
          return correct === user;
        }
        return this.fuzzyMatch(correct, user, 0.9);

      case 'FILL_BLANK':
      case 'SHORT_ANSWER':
        return this.fuzzyMatch(correct, user, 0.8);

      case 'PROBLEM':
        // للمسائل الرقمية، نسمح بهامش خطأ صغير
        const correctNum = parseFloat(correct);
        const userNum = parseFloat(user);

        if (!isNaN(correctNum) && !isNaN(userNum)) {
          const tolerance = Math.abs(correctNum * 0.01); // 1% هامش خطأ
          return Math.abs(correctNum - userNum) <= tolerance;
        }

        // إذا لم تكن أرقام، نستخدم fuzzy match
        return this.fuzzyMatch(correct, user, 0.7);

      case 'ESSAY':
        // المقالات تحتاج تقييم يدوي أو AI
        return true; // مؤقتاً

      default:
        return correct === user;
    }
  }
  
  /**
   * Enhanced fuzzy matching
   */
  private fuzzyMatch(correct: string, user: string, threshold: number = 0.8): boolean {
    const normalize = (str: string) => str
      .replace(/[ًٌٍَُِّْ]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const cleanCorrect = normalize(correct);
    const cleanUser = normalize(user);
    
    if (cleanCorrect === cleanUser) return true;
    
    const correctWords = cleanCorrect.split(' ');
    const userWords = cleanUser.split(' ');
    
    const matchedWords = correctWords.filter(word => 
      userWords.some(userWord => 
        userWord === word || 
        (word.length > 3 && (userWord.includes(word) || word.includes(userWord)))
      )
    );
    
    return matchedWords.length >= correctWords.length * threshold;
  }
  
  /**
   * Complete quiz with enhanced analysis and parent report
   */
  async completeQuiz(attemptId: string): Promise<ExtendedQuizResult> {
    console.log(`🏁 Completing quiz ${attemptId}`);
    
    // Get attempt with all data
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
        user: true,
      },
    });
    
    if (!attempt) {
      throw new NotFoundError('Quiz attempt');
    }
    
    // 🆕 Get student context
    const studentContext = await this.getStudentContext(attempt.userId);
    
    // Calculate scores
    const totalPoints = attempt.answers.reduce(
      (sum, a) => sum + a.question.points, 0
    );
    const earnedPoints = attempt.answers.reduce(
      (sum, a) => sum + (a.isCorrect ? a.question.points : 0), 0
    );
    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = percentage >= this.PASS_THRESHOLD;
    
    // Time analysis
    const timeSpent = attempt.answers.reduce(
      (sum, a) => sum + (a.timeSpent || 0), 0
    );
    const avgTimePerQuestion = Math.round(timeSpent / attempt.answers.length);
    
    // Update attempt
    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        score: percentage,
        timeSpent,
        completedAt: new Date(),
      },
    });
    
    // Question results
    const questionResults: QuestionResult[] = attempt.answers.map(a => ({
      questionId: a.questionId,
      question: a.question.question,
      userAnswer: a.userAnswer,
      correctAnswer: a.question.correctAnswer,
      isCorrect: a.isCorrect,
      points: a.isCorrect ? a.question.points : 0,
      explanation: a.question.explanation || undefined,
      timeSpent: a.timeSpent || 0,
      difficulty: a.question.difficulty as 'EASY' | 'MEDIUM' | 'HARD',
      type: a.question.type as QuestionResult['type'],
    }));
    
    // Enhanced performance analysis
    const analysis = this.analyzeEnhancedPerformance(questionResults, avgTimePerQuestion);
    
    // 🆕 Update student context
    studentContext.quizHistory.totalAttempts++;
    studentContext.quizHistory.averageScore = 
      (studentContext.quizHistory.averageScore * (studentContext.quizHistory.totalAttempts - 1) + percentage) / 
      studentContext.quizHistory.totalAttempts;
    
    // Update strong/weak topics
    analysis.strengths.forEach(s => {
      if (!studentContext.quizHistory.strongTopics.includes(s)) {
        studentContext.quizHistory.strongTopics.push(s);
      }
    });
    
    analysis.weaknesses.forEach(w => {
      if (!studentContext.quizHistory.weakTopics.includes(w)) {
        studentContext.quizHistory.weakTopics.push(w);
      }
    });
    
    // Generate personalized recommendations
    const recommendations = await this.generatePersonalizedRecommendations(
      attempt.userId,
      attempt.lessonId,
      analysis,
      percentage,
      studentContext // 🆕
    );
    
    // Calculate achievements
    const achievements = this.checkAchievements(
      attempt.userId,
      percentage,
      attempt.answers.length,
      timeSpent
    );
    
    // 🆕 Generate parent report if needed
    const parentReport = this.generateParentReport(
      studentContext,
      percentage,
      analysis,
      recommendations
    );
    
    // Update progress
    await this.updateProgress(attempt.userId, attempt.lessonId, passed, percentage);
    
    return {
      attemptId,
      userId: attempt.userId,
      lessonId: attempt.lessonId,
      score: earnedPoints,
      totalScore: totalPoints,
      percentage: Math.round(percentage),
      passed,
      timeSpent,
      avgTimePerQuestion,
      correctAnswers: attempt.correctAnswers,
      totalQuestions: attempt.totalQuestions,
      questionResults,
      ...analysis,
      recommendations,
      achievements,
      nextSteps: this.getNextSteps(passed, percentage),
      parentReport // 🆕
    };
  }
  
  /**
   * 🆕 Generate parent report
   */
  private generateParentReport(
    studentContext: StudentQuizContext,
    percentage: number,
    analysis: any,
    recommendations: string[]
  ): any {
    return {
      studentName: studentContext.name,
      date: new Date().toLocaleDateString('ar-EG'),
      performance: {
        currentScore: Math.round(percentage),
        averageScore: Math.round(studentContext.quizHistory.averageScore),
        totalAttempts: studentContext.quizHistory.totalAttempts,
        trend: percentage > studentContext.quizHistory.averageScore ? 'تحسن' : 'يحتاج دعم'
      },
      emotionalState: {
        mood: studentContext.emotionalState?.mood === 'happy' ? 'سعيد ومتحمس' :
              studentContext.emotionalState?.mood === 'frustrated' ? 'محبط قليلاً' :
              studentContext.emotionalState?.mood === 'tired' ? 'متعب' :
              'عادي',
        confidence: `${studentContext.emotionalState?.confidence || 70}%`,
        engagement: `${studentContext.emotionalState?.engagement || 70}%`
      },
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: recommendations.slice(0, 3),
      parentActions: [
        percentage < 50 ? 'يحتاج مساعدة في المذاكرة' : 'شجعوه على الاستمرار',
        studentContext.emotionalState?.mood === 'frustrated' ? 'امنحوه راحة وادعموه نفسياً' : '',
        'راجعوا معه الأخطاء بهدوء'
      ].filter(a => a)
    };
  }
  
  /**
   * Enhanced performance analysis
   */
  private analyzeEnhancedPerformance(
    results: QuestionResult[],
    avgTime: number
  ): {
    strengths: string[];
    weaknesses: string[];
    insights: string[];
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const insights: string[] = [];
    
    // By difficulty
    const byDifficulty = {
      EASY: results.filter(r => r.difficulty === 'EASY'),
      MEDIUM: results.filter(r => r.difficulty === 'MEDIUM'),
      HARD: results.filter(r => r.difficulty === 'HARD'),
    };
    
    // Analyze each difficulty
    Object.entries(byDifficulty).forEach(([level, questions]) => {
      if (questions.length > 0) {
        const correct = questions.filter(q => q.isCorrect).length;
        const rate = (correct / questions.length) * 100;
        
        if (rate >= 80) {
          strengths.push(`إتقان الأسئلة ${level === 'EASY' ? 'السهلة' : level === 'MEDIUM' ? 'المتوسطة' : 'الصعبة'}`);
        } else if (rate < 50) {
          weaknesses.push(`تحتاج تحسين في الأسئلة ${level === 'EASY' ? 'السهلة' : level === 'MEDIUM' ? 'المتوسطة' : 'الصعبة'}`);
        }
      }
    });
    
    // By question type
    const byType = {
      MCQ: results.filter(r => r.type === 'MCQ'),
      TRUE_FALSE: results.filter(r => r.type === 'TRUE_FALSE'),
      FILL_BLANK: results.filter(r => r.type === 'FILL_BLANK'),
    };
    
    Object.entries(byType).forEach(([type, questions]) => {
      if (questions.length > 0) {
        const correct = questions.filter(q => q.isCorrect).length;
        const rate = (correct / questions.length) * 100;
        
        if (rate >= 90) {
          insights.push(`أداء ممتاز في أسئلة ${this.getTypeNameArabic(type)}`);
        } else if (rate < 40) {
          insights.push(`تحتاج مراجعة أسئلة ${this.getTypeNameArabic(type)}`);
        }
      }
    });
    
    // Time management
    if (avgTime < 30) {
      strengths.push('سرعة ممتازة في الحل');
      insights.push('⚡ تجيب بسرعة - تأكد من القراءة الجيدة');
    } else if (avgTime > 90) {
      weaknesses.push('تحتاج تحسين السرعة');
      insights.push('⏱️ خذ وقتك ولكن حاول الإسراع قليلاً');
    }
    
    // Pattern detection
    const lastThree = results.slice(-3);
    if (lastThree.every(r => !r.isCorrect)) {
      insights.push('📉 آخر 3 أسئلة خاطئة - ربما تحتاج راحة');
    } else if (lastThree.every(r => r.isCorrect)) {
      insights.push('📈 أنهيت بقوة! آخر 3 أسئلة صحيحة');
    }
    
    return { strengths, weaknesses, insights };
  }
  
  /**
   * Generate personalized recommendations with emotional support
   */
  private async generatePersonalizedRecommendations(
    userId: string,
    lessonId: string,
    analysis: any,
    percentage: number,
    studentContext?: StudentQuizContext // 🆕
  ): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Based on score
    if (percentage >= 90) {
      recommendations.push('🌟 أداء رائع! جاهز للمستوى التالي');
      recommendations.push('جرب التحديات الصعبة لتطوير مهاراتك أكثر');
    } else if (percentage >= 70) {
      recommendations.push('أداء جيد! راجع النقاط التي أخطأت فيها');
      recommendations.push('حل المزيد من التمارين المتوسطة');
    } else if (percentage >= 50) {
      recommendations.push('تحتاج مراجعة الدرس مرة أخرى');
      recommendations.push('ركز على الأمثلة والتطبيقات');
      recommendations.push('اطلب شرح إضافي من المساعد الذكي');
    } else {
      recommendations.push('لا تيأس! التعلم يحتاج وقت');
      recommendations.push('ابدأ بمراجعة الأساسيات');
      recommendations.push('شاهد فيديوهات الشرح');
      recommendations.push('حل تمارين سهلة أولاً');
    }
    
    // 🆕 Based on emotional state
    if (studentContext?.emotionalState?.mood === 'frustrated') {
      recommendations.push('خذ راحة 15 دقيقة وارجع بنشاط');
      recommendations.push('تذكر أن كل شخص يتعلم بسرعته الخاصة');
    } else if (studentContext?.emotionalState?.mood === 'tired') {
      recommendations.push('أجل باقي المراجعة لوقت آخر');
      recommendations.push('النوم الجيد يساعد على التركيز');
    }
    
    // Based on weaknesses
    if (analysis.weaknesses.includes('تحتاج تحسين السرعة')) {
      recommendations.push('⏱️ تدرب على حل الأسئلة بوقت محدد');
    }
    
    // 🆕 Based on common mistakes
    if (studentContext && studentContext.quizHistory.commonMistakes.length > 5) {
      recommendations.push('راجع الأسئلة التي تخطئ فيها باستمرار');
    }
    
    // Based on insights
    analysis.insights.forEach((insight: string) => {
      if (insight.includes('راحة')) {
        recommendations.push('خذ استراحة 10 دقائق ثم عد للمحاولة');
      }
    });
    
    return recommendations.slice(0, 5);
  }
  
  /**
   * Check achievements
   */
  private checkAchievements(
    userId: string,
    percentage: number,
    questionsCount: number,
    timeSpent: number
  ): string[] {
    const achievements: string[] = [];
    
    if (percentage === 100) {
      achievements.push('🏆 الكمال - درجة كاملة!');
    }
    if (percentage >= 90 && questionsCount >= 10) {
      achievements.push('⭐ نجم الاختبارات');
    }
    if (timeSpent < questionsCount * 30) {
      achievements.push('⚡ البرق - سريع جداً');
    }
    if (percentage >= 60 && percentage < 70) {
      achievements.push('💪 على الحافة - نجحت بالضبط');
    }
    
    const userPerf = this.getUserPerformance(userId);
    if (userPerf.streakCount >= 5) {
      achievements.push(`🔥 سلسلة ${userPerf.streakCount} اختبارات ناجحة`);
    }
    
    // 🆕 Emotional achievements
    const studentContext = this.studentContexts.get(userId);
    if (studentContext?.emotionalState?.mood === 'frustrated' && percentage >= 60) {
      achievements.push('💪 تغلبت على الإحباط');
    }
    
    return achievements;
  }
  
  /**
   * Get next steps
   */
  private getNextSteps(passed: boolean, percentage: number): string[] {
    if (passed) {
      if (percentage >= 90) {
        return [
          'انتقل للدرس التالي',
          'جرب مستوى أصعب',
          'ساعد زملاءك في الفهم'
        ];
      } else {
        return [
          'راجع الأخطاء',
          'انتقل للدرس التالي',
          'حل تمارين إضافية'
        ];
      }
    } else {
      return [
        'راجع الدرس',
        'اطلب مساعدة المعلم الذكي',
        'أعد المحاولة بعد المراجعة',
        'شاهد فيديوهات الشرح'
      ];
    }
  }
  
  // Helper methods
  
  private getUserLevel(userId: string): any {
    const perf = this.getUserPerformance(userId);
    const successRate = perf.totalAttempts > 0 
      ? perf.correctAnswers / perf.totalAttempts 
      : 0.5;
    
    return {
      level: successRate > 0.8 ? 'advanced' : successRate > 0.5 ? 'intermediate' : 'beginner',
      performance: perf
    };
  }
  
  /**
   * 🆕 Enhanced difficulty adaptation
   */
  private adaptDifficulty(
    requested?: 'EASY' | 'MEDIUM' | 'HARD', 
    userLevel?: any,
    studentContext?: StudentQuizContext | null
  ): 'EASY' | 'MEDIUM' | 'HARD' {
    if (!this.QUIZ_SETTINGS.adaptiveDifficulty || !userLevel) {
      return requested || 'MEDIUM';
    }
    
    // 🆕 Consider emotional state
    if (studentContext?.emotionalState?.mood === 'frustrated') {
      return 'EASY'; // Give easier questions when frustrated
    } else if (studentContext?.emotionalState?.mood === 'happy' && 
               studentContext.emotionalState && 
               studentContext.emotionalState.confidence > 80) {
      return 'HARD'; // Challenge when confident and happy
    }
    
    if (userLevel.level === 'advanced') {
      return userLevel.performance.lastDifficulty === 'HARD' ? 'HARD' : 'MEDIUM';
    } else if (userLevel.level === 'beginner') {
      return 'EASY';
    }
    
    return requested || 'MEDIUM';
  }
  
  private getUserPerformance(userId: string): QuizPerformance {
    if (!this.userPerformance.has(userId)) {
      this.userPerformance.set(userId, {
        userId,
        totalAttempts: 0,
        correctAnswers: 0,
        averageTime: 0,
        streakCount: 0,
        lastDifficulty: 'MEDIUM',
        level: 'intermediate'
      });
    }
    return this.userPerformance.get(userId)!;
  }
  
  private updateUserPerformance(userId: string, correct: boolean, time: number): void {
    const perf = this.getUserPerformance(userId);
    perf.totalAttempts++;
    if (correct) {
      perf.correctAnswers++;
      perf.streakCount++;
    } else {
      perf.streakCount = 0;
    }
    perf.averageTime = (perf.averageTime * (perf.totalAttempts - 1) + time) / perf.totalAttempts;
    
    // Update level
    const successRate = perf.correctAnswers / perf.totalAttempts;
    perf.level = successRate > 0.8 ? 'advanced' : successRate > 0.5 ? 'intermediate' : 'beginner';
  }
  
  private calculateStreak(answers: any[]): number {
    let streak = 0;
    for (let i = answers.length - 1; i >= 0; i--) {
      if (answers[i].isCorrect) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }
  
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  private orderQuestionsByDifficulty(questions: any[]): any[] {
    const order = { EASY: 1, MEDIUM: 2, HARD: 3 };
    return questions.sort((a, b) => 
      (order[a.difficulty as keyof typeof order] || 2) - 
      (order[b.difficulty as keyof typeof order] || 2)
    );
  }
  
  private calculatePoints(difficulty: string, type: string): number {
    let base = difficulty === 'EASY' ? 1 : difficulty === 'HARD' ? 3 : 2;
    if (type === 'PROBLEM' || type === 'ESSAY') base *= 2;
    if (type === 'SHORT_ANSWER') base *= 1.5;
    return Math.round(base);
  }
  
  private getTimeLimit(difficulty: string, type: string): number {
    let base = 60; // seconds
    if (difficulty === 'HARD') base += 30;
    if (type === 'PROBLEM' || type === 'ESSAY') base += 60;
    if (type === 'SHORT_ANSWER') base += 30;
    return base;
  }
  
  private extractTags(question: string): string[] {
    const tags: string[] = [];
    
    // Extract math terms
    if (question.includes('معادلة')) tags.push('معادلات');
    if (question.includes('كسر') || question.includes('كسور')) tags.push('كسور');
    if (question.includes('جمع')) tags.push('جمع');
    if (question.includes('طرح')) tags.push('طرح');
    if (question.includes('ضرب')) tags.push('ضرب');
    if (question.includes('قسمة')) tags.push('قسمة');
    
    return tags.slice(0, 3);
  }
  
  private getTypeNameArabic(type: string): string {
    const names: Record<string, string> = {
      MCQ: 'الاختيار من متعدد',
      TRUE_FALSE: 'صح أو خطأ',
      FILL_BLANK: 'أكمل الفراغات',
      SHORT_ANSWER: 'الإجابة القصيرة',
      PROBLEM: 'المسائل',
      ESSAY: 'المقالية'
    };
    return names[type] || type;
  }
  
  private async saveGeneratedQuestions(
    lessonId: string,
    questions: QuizQuestion[],
    startIndex: number
  ): Promise<Question[]> {
    return await Promise.all(
      questions.map(async (q, index) => {
        return await prisma.question.create({
          data: {
            lessonId,
            type: (q.type || 'MCQ') as QuestionType,
            question: q.question,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer.toString(),
            explanation: q.explanation,
            points: q.points || 1,
            difficulty: (q.difficulty || 'MEDIUM') as Difficulty,
            order: startIndex + index + 1,
            hints: q.hint ? JSON.stringify([q.hint]) : null,
            tags: q.tags ? JSON.stringify(q.tags) : null,
            learningObjective: q.learningObjective,
            stepByStepSolution: q.stepByStepSolution ? JSON.stringify(q.stepByStepSolution) : null,
          },
        });
      })
    );
  }
  
  /**
   * Update progress
   */
  private async updateProgress(
    userId: string,
    lessonId: string,
    passed: boolean,
    score: number
  ): Promise<void> {
    await prisma.progress.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      update: {
        quizCompleted: passed,
        completionRate: Math.max(score, 50),
        status: passed ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: passed ? new Date() : undefined,
      },
      create: {
        userId,
        lessonId,
        quizCompleted: passed,
        completionRate: score,
        status: passed ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: passed ? new Date() : undefined,
      },
    });
  }
  
  /**
   * Get quiz statistics
   */
  async getQuizStatistics(lessonId: string): Promise<QuizStatistics> {
    const attempts = await prisma.quizAttempt.findMany({
      where: { lessonId },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
    });
    
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
        averageTimeSpent: 0,
        mostDifficultQuestions: [],
        easiestQuestions: [],
        commonMistakes: [],
      };
    }
    
    const totalAttempts = attempts.length;
    const scores = attempts.map(a => a.score || 0);
    const averageScore = scores.reduce((a, b) => a + b, 0) / totalAttempts;
    const passedCount = scores.filter(s => s >= this.PASS_THRESHOLD).length;
    const passRate = (passedCount / totalAttempts) * 100;
    
    const times = attempts.map(a => a.timeSpent || 0);
    const averageTimeSpent = times.reduce((a, b) => a + b, 0) / totalAttempts;
    
    // Question analysis
    const questionStats = new Map<string, { correct: number; total: number }>();
    
    attempts.forEach(attempt => {
      attempt.answers.forEach(answer => {
        const stats = questionStats.get(answer.questionId) || { correct: 0, total: 0 };
        stats.total++;
        if (answer.isCorrect) stats.correct++;
        questionStats.set(answer.questionId, stats);
      });
    });
    
    const questionDifficulty = Array.from(questionStats.entries())
      .map(([id, stats]) => ({
        id,
        successRate: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      }))
      .sort((a, b) => a.successRate - b.successRate);
    
    const mostDifficultQuestions = questionDifficulty
      .slice(0, 3)
      .map(q => q.id);
    
    const easiestQuestions = questionDifficulty
      .slice(-3)
      .map(q => q.id);
    
    return {
      totalAttempts,
      averageScore: Math.round(averageScore),
      passRate: Math.round(passRate),
      averageTimeSpent: Math.round(averageTimeSpent),
      mostDifficultQuestions,
      easiestQuestions,
      commonMistakes: [],
    };
  }
  
  /**
   * Get user quiz history
   */
  async getUserQuizHistory(
    userId: string,
    lessonId?: string
  ): Promise<QuizAttempt[]> {
    return await prisma.quizAttempt.findMany({
      where: {
        userId,
        ...(lessonId && { lessonId }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });
  }
  
  /**
   * 🆕 Clear student context (for testing)
   */
  clearStudentContext(userId: string): void {
    this.studentContexts.delete(userId);
    this.userPerformance.delete(userId);
  }
  
  /**
   * 🆕 Get all student contexts (for analytics)
   */
  getAllStudentContexts(): Map<string, StudentQuizContext> {
    return this.studentContexts;
  }
}

// Export singleton
export const quizService = new QuizService();