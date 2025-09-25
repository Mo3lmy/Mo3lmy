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

/**
 * Enhanced Quiz Service with Adaptive & Dynamic Features
 * Version: 3.0 - Smart Quiz Generation
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
  };
  
  // Question type distribution
  private readonly QUESTION_TYPE_MIX = {
    MCQ: 40,
    TRUE_FALSE: 20,
    FILL_BLANK: 20,
    SHORT_ANSWER: 10,
    ESSAY: 10,
  };
  
  // Performance tracking (in-memory)
  private userPerformance: Map<string, QuizPerformance> = new Map();

  /**
   * Generate adaptive quiz questions
   */
  async generateQuizQuestions(
    lessonId: string,
    count: number = 5,
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD',
    userId?: string
  ): Promise<Question[]> {
    console.log(`📝 Generating ${count} adaptive questions`);
    
    // Check lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true },
    });
    
    if (!lesson || !lesson.content) {
      throw new NotFoundError('Lesson or content');
    }
    
    // Get user performance for adaptive difficulty
    const userLevel = userId ? this.getUserLevel(userId) : null;
    const adaptedDifficulty = this.adaptDifficulty(difficulty, userLevel);
    
    // Check existing questions
    let existingQuestions = await prisma.question.findMany({
      where: { 
        lessonId,
        ...(adaptedDifficulty && { difficulty: adaptedDifficulty as Difficulty }),
      },
      take: Math.floor(count / 2),
    });
    
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
      
      // Enhance with variety and features
      return questions.map((q, index) => this.enhanceQuestion(q, index, difficulty));
      
    } catch (error) {
      console.error('Dynamic generation failed:', error);
      return this.generateVariedMockQuestions(lesson, count, difficulty);
    }
  }
  
  /**
   * Enhance question with additional features
   */
  private enhanceQuestion(
    question: any,
    index: number,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  ): QuizQuestion {
    // Ensure variety in question types
    const type = this.selectQuestionType(index) as QuizQuestion['type'];
    
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
    enhanced.hint = enhanced.hint || this.generateHint(enhanced.question);
    
    // Add metadata
    enhanced.tags = enhanced.tags || this.extractTags(enhanced.question);
    enhanced.difficulty = difficulty;
    enhanced.type = type;
    
    return enhanced;
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
      type: 'PROBLEM',
      question: `مسألة: ${question.question}`,
      requiresSteps: true,
      points: (question.points || 2) * 2,
      hint: 'ابدأ بتحديد المعطيات والمطلوب'
    };
  }
  
  /**
   * Select question type for variety
   */
  private selectQuestionType(index: number): string {
    const types = Object.keys(this.QUESTION_TYPE_MIX);
    const weights = Object.values(this.QUESTION_TYPE_MIX);
    
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
      default:
        return `سؤال ${index + 1} عن ${lessonTitle}؟`;
    }
  }
  
  /**
   * Start adaptive quiz session
   */
  async startQuizAttempt(
    userId: string,
    lessonId: string,
    questionCount?: number,
    mode?: 'practice' | 'test' | 'challenge'
  ): Promise<QuizSession> {
    console.log(`🎮 Starting ${mode || 'practice'} quiz for ${userId}`);
    
    // Get adaptive questions
    const requestedCount = questionCount || this.MAX_QUESTIONS_PER_QUIZ;
    const questions = await this.generateQuizQuestions(
      lessonId,
      requestedCount,
      undefined,
      userId
    );
    
    // Order questions by difficulty (easy to hard)
    const orderedQuestions = this.orderQuestionsByDifficulty(questions);
    
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
    const session: QuizSession = {
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
    };
    
    return session;
  }
  
  /**
   * Submit answer with instant feedback
   */
  async submitAnswer(
    attemptId: string,
    questionId: string,
    answer: string,
    timeSpent: number
  ): Promise<AnswerSubmissionResult> {
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
    
    // Generate personalized explanation if wrong
    let explanation = question.explanation || '';
    if (!isCorrect && attempt?.userId) {
      explanation = await this.getPersonalizedExplanation(
        question,
        answer,
        attempt.userId
      );
    }
    
    return {
      isCorrect,
      explanation,
      pointsEarned,
      streakBonus,
      hint: !isCorrect ? this.generateHint(question.question) : undefined
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
   * Complete quiz with enhanced analysis
   */
  async completeQuiz(attemptId: string): Promise<QuizResult> {
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
    
    // Generate personalized recommendations
    const recommendations = await this.generatePersonalizedRecommendations(
      attempt.userId,
      attempt.lessonId,
      analysis,
      percentage
    );
    
    // Calculate achievements
    const achievements = this.checkAchievements(
      attempt.userId,
      percentage,
      attempt.answers.length,
      timeSpent
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
   * Generate personalized recommendations
   */
  private async generatePersonalizedRecommendations(
    userId: string,
    lessonId: string,
    analysis: any,
    percentage: number
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
    
    // Based on weaknesses
    if (analysis.weaknesses.includes('تحتاج تحسين السرعة')) {
      recommendations.push('⏱️ تدرب على حل الأسئلة بوقت محدد');
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
  
  private adaptDifficulty(requested?: 'EASY' | 'MEDIUM' | 'HARD', userLevel?: any): 'EASY' | 'MEDIUM' | 'HARD' {
    if (!this.QUIZ_SETTINGS.adaptiveDifficulty || !userLevel) {
      return requested || 'MEDIUM';
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
  
  private generateHint(question: string): string {
    const hints = [
      'راجع الدرس مرة أخرى',
      'فكر في المعطيات',
      'ابحث عن الكلمات المفتاحية',
      'تذكر القاعدة الأساسية',
      'حاول التبسيط أولاً'
    ];
    return hints[Math.floor(Math.random() * hints.length)];
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
}

// Export singleton
export const quizService = new QuizService();