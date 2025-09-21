import { z } from 'zod';
import { prisma } from '../../config/database.config';
import { ragService } from '../rag/rag.service';
import { openAIService } from '../../services/ai/openai.service';
import { NotFoundError, ValidationError } from '../../utils/errors';
import type { 
  QuizQuestion, 
  QuizSession, 
  QuizResult, 
  UserAnswer,
  QuestionResult,
  QuizStatistics 
} from '../../types/quiz.types';
import type { Question, QuizAttempt, QuestionType } from '@prisma/client';

export class QuizService {
  private readonly PASS_THRESHOLD = 60; // 60% to pass
  private readonly MAX_QUESTIONS_PER_QUIZ = 10;
  
  /**
   * Generate quiz questions for a lesson
   */
  async generateQuizQuestions(
    lessonId: string,
    count: number = 5,
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD'
  ): Promise<Question[]> {
    console.log(`📝 Generating ${count} quiz questions for lesson ${lessonId}`);
    
    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true },
    });
    
    if (!lesson || !lesson.content) {
      throw new NotFoundError('Lesson or content');
    }
    
    // Check for existing questions
    const existingQuestions = await prisma.question.findMany({
      where: { 
        lessonId,
        ...(difficulty && { difficulty }),
      },
    });
    
    // If we have enough questions, return them
    if (existingQuestions.length >= count) {
      return existingQuestions.slice(0, count);
    }
    
    // Generate new questions using AI
    const generatedQuestions = await this.generateAIQuestions(
      lesson,
      count - existingQuestions.length,
      difficulty
    );
    
    // Save generated questions
    const savedQuestions = await Promise.all(
      generatedQuestions.map(async (q, index) => {
        return await prisma.question.create({
          data: {
            lessonId,
            type: q.type as QuestionType,
            question: q.question,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer.toString(),
            explanation: q.explanation,
            points: q.points,
            difficulty: q.difficulty || difficulty || 'MEDIUM',
            order: existingQuestions.length + index + 1,
          },
        });
      })
    );
    
    return [...existingQuestions, ...savedQuestions];
  }
  
  /**
   * Generate questions using AI
   */
  private async generateAIQuestions(
    lesson: any,
    count: number,
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD'
  ): Promise<QuizQuestion[]> {
    // If no OpenAI key, generate mock questions
    if (!process.env.OPENAI_API_KEY) {
      return this.generateMockQuestions(lesson, count, difficulty);
    }
    
    try {
      // Use RAG service to generate questions
      const questions = await ragService.generateQuizQuestions(lesson.id, count);
      
      return questions.map((q, index) => ({
        id: `gen-${index}`,
        type: 'MCQ' as const,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        points: difficulty === 'HARD' ? 3 : difficulty === 'MEDIUM' ? 2 : 1,
        difficulty: difficulty || 'MEDIUM',
      }));
    } catch (error) {
      console.error('AI question generation failed:', error);
      return this.generateMockQuestions(lesson, count, difficulty);
    }
  }
  
  /**
   * Generate mock questions for testing
   */
  private generateMockQuestions(
    lesson: any,
    count: number,
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD'
  ): QuizQuestion[] {
    const questions: QuizQuestion[] = [];
    
    for (let i = 0; i < count; i++) {
      questions.push({
        id: `mock-${i}`,
        type: 'MCQ',
        question: `سؤال تجريبي ${i + 1} عن ${lesson.title}؟`,
        options: [
          'الإجابة الأولى',
          'الإجابة الثانية',
          'الإجابة الثالثة',
          'الإجابة الرابعة',
        ],
        correctAnswer: 0, // First option is correct
        explanation: 'هذا سؤال تجريبي للاختبار',
        points: difficulty === 'HARD' ? 3 : difficulty === 'MEDIUM' ? 2 : 1,
        difficulty: difficulty || 'MEDIUM',
        hint: 'اختر الإجابة الأولى',
      });
    }
    
    return questions;
  }
  
  /**
   * Start a quiz attempt
   */
  async startQuizAttempt(
    userId: string,
    lessonId: string,
    questionCount?: number
  ): Promise<QuizSession> {
    console.log(`🎮 Starting quiz for user ${userId} on lesson ${lessonId}`);
    
    // Get questions for the lesson
    const questions = await prisma.question.findMany({
      where: { lessonId },
      take: questionCount || this.MAX_QUESTIONS_PER_QUIZ,
      orderBy: { order: 'asc' },
    });
    
    if (questions.length === 0) {
      // Generate questions if none exist
      await this.generateQuizQuestions(lessonId, 5);
      
      const newQuestions = await prisma.question.findMany({
        where: { lessonId },
        take: questionCount || this.MAX_QUESTIONS_PER_QUIZ,
      });
      
      questions.push(...newQuestions);
    }
    
    // Create quiz attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        lessonId,
        totalQuestions: questions.length,
        correctAnswers: 0,
      },
    });
    
    // Convert to quiz session
    const session: QuizSession = {
      id: attempt.id,
      userId,
      lessonId,
      questions: questions.map(q => ({
        id: q.id,
        type: q.type as any,
        question: q.question,
        options: q.options ? JSON.parse(q.options) : undefined,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || undefined,
        points: q.points,
        difficulty: q.difficulty,
      })),
      answers: [],
      startedAt: attempt.createdAt,
      timeLimit: questions.length * 60, // 60 seconds per question
    };
    
    return session;
  }
  
  /**
   * Submit answer for a question
   */
  async submitAnswer(
    attemptId: string,
    questionId: string,
    answer: string,
    timeSpent: number
  ): Promise<boolean> {
    // Get question
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });
    
    if (!question) {
      throw new NotFoundError('Question');
    }
    
    // Check if answer is correct
    const isCorrect = this.checkAnswer(question, answer);
    
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
    
    // Update attempt if correct
    if (isCorrect) {
      await prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          correctAnswers: {
            increment: 1,
          },
        },
      });
    }
    
    return isCorrect;
  }
  
  /**
   * Check if answer is correct
   */
  private checkAnswer(question: Question, userAnswer: string): boolean {
    const correct = question.correctAnswer.toLowerCase().trim();
    const user = userAnswer.toLowerCase().trim();
    
    switch (question.type) {
      case 'TRUE_FALSE':
        return correct === user;
        
      case 'MCQ':
        // Handle both index and text answers
        if (!isNaN(Number(user))) {
          return correct === user;
        }
        return correct === user;
        
      case 'FILL_BLANK':
      case 'SHORT_ANSWER':
        // More lenient comparison for text answers
        return this.fuzzyMatch(correct, user);
        
      default:
        return correct === user;
    }
  }
  
  /**
   * Fuzzy string matching for text answers
   */
  private fuzzyMatch(correct: string, user: string): boolean {
    // Remove extra spaces and punctuation
    const cleanCorrect = correct.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    const cleanUser = user.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    
    // Exact match after cleaning
    if (cleanCorrect === cleanUser) return true;
    
    // Check if user answer contains all key words
    const correctWords = cleanCorrect.split(' ');
    const userWords = cleanUser.split(' ');
    
    const matchedWords = correctWords.filter(word => 
      userWords.some(userWord => userWord.includes(word) || word.includes(userWord))
    );
    
    // If 80% of words match, consider it correct
    return matchedWords.length >= correctWords.length * 0.8;
  }
  
  /**
   * Complete quiz and calculate results
   */
  async completeQuiz(attemptId: string): Promise<QuizResult> {
    console.log(`🏁 Completing quiz attempt ${attemptId}`);
    
    // Get attempt with answers
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
    });
    
    if (!attempt) {
      throw new NotFoundError('Quiz attempt');
    }
    
    // Calculate score
    const totalPoints = attempt.answers.reduce(
      (sum, a) => sum + a.question.points,
      0
    );
    const earnedPoints = attempt.answers.reduce(
      (sum, a) => sum + (a.isCorrect ? a.question.points : 0),
      0
    );
    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = percentage >= this.PASS_THRESHOLD;
    
    // Calculate time spent
    const timeSpent = attempt.answers.reduce(
      (sum, a) => sum + (a.timeSpent || 0),
      0
    );
    
    // Update attempt
    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        score: percentage,
        timeSpent,
        completedAt: new Date(),
      },
    });
    
    // Prepare question results
    const questionResults: QuestionResult[] = attempt.answers.map(a => ({
      questionId: a.questionId,
      question: a.question.question,
      userAnswer: a.userAnswer,
      correctAnswer: a.question.correctAnswer,
      isCorrect: a.isCorrect,
      points: a.isCorrect ? a.question.points : 0,
      explanation: a.question.explanation || undefined,
      timeSpent: a.timeSpent || 0,
    }));
    
    // Analyze strengths and weaknesses
    const { strengths, weaknesses } = this.analyzePerformance(questionResults);
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      attempt.userId,
      attempt.lessonId,
      weaknesses
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
      correctAnswers: attempt.correctAnswers,
      totalQuestions: attempt.totalQuestions,
      questionResults,
      strengths,
      weaknesses,
      recommendations,
    };
  }
  
  /**
   * Analyze quiz performance
   */
  private analyzePerformance(results: QuestionResult[]): {
    strengths: string[];
    weaknesses: string[];
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    // Group by difficulty
    const byDifficulty = {
      easy: results.filter(r => r.question.includes('سهل')),
      medium: results.filter(r => r.question.includes('متوسط')),
      hard: results.filter(r => r.question.includes('صعب')),
    };
    
    // Analyze easy questions
    const easyCorrect = byDifficulty.easy.filter(r => r.isCorrect).length;
    if (easyCorrect === byDifficulty.easy.length && byDifficulty.easy.length > 0) {
      strengths.push('إتقان المفاهيم الأساسية');
    } else if (easyCorrect < byDifficulty.easy.length * 0.5) {
      weaknesses.push('المفاهيم الأساسية تحتاج مراجعة');
    }
    
    // Analyze time management
    const avgTime = results.reduce((sum, r) => sum + r.timeSpent, 0) / results.length;
    if (avgTime < 30) {
      strengths.push('سرعة في الإجابة');
    } else if (avgTime > 90) {
      weaknesses.push('البطء في الإجابة - تحتاج لمزيد من التدريب');
    }
    
    // Overall performance
    const correctCount = results.filter(r => r.isCorrect).length;
    const accuracy = (correctCount / results.length) * 100;
    
    if (accuracy >= 90) {
      strengths.push('أداء ممتاز بشكل عام');
    } else if (accuracy >= 70) {
      strengths.push('أداء جيد');
    } else if (accuracy < 50) {
      weaknesses.push('الأداء العام يحتاج تحسين');
    }
    
    return { strengths, weaknesses };
  }
  
  /**
   * Generate learning recommendations
   */
  private async generateRecommendations(
    userId: string,
    lessonId: string,
    weaknesses: string[]
  ): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (weaknesses.length === 0) {
      recommendations.push('أحسنت! يمكنك الانتقال للدرس التالي');
      return recommendations;
    }
    
    // Basic recommendations based on weaknesses
    if (weaknesses.includes('المفاهيم الأساسية تحتاج مراجعة')) {
      recommendations.push('راجع الدرس مرة أخرى مع التركيز على الأمثلة');
      recommendations.push('حاول حل المزيد من التمارين البسيطة');
    }
    
    if (weaknesses.includes('البطء في الإجابة')) {
      recommendations.push('تدرب على حل الأسئلة بوقت محدد');
      recommendations.push('راجع القوانين والمفاهيم الأساسية لتصبح أسرع');
    }
    
    if (weaknesses.includes('الأداء العام يحتاج تحسين')) {
      recommendations.push('أعد مشاهدة فيديو الشرح');
      recommendations.push('اطلب المساعدة من المعلم الذكي');
      recommendations.push('حل الاختبار مرة أخرى بعد المراجعة');
    }
    
    return recommendations;
  }
  
  /**
   * Update user progress
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
        completionRate: Math.max(score, 50), // Minimum 50% for attempting
        status: passed ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: passed ? new Date() : null,
      },
      create: {
        userId,
        lessonId,
        quizCompleted: passed,
        completionRate: score,
        status: passed ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: passed ? new Date() : null,
      },
    });
  }
  
  /**
   * Get quiz statistics for a lesson
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
    
    // Calculate statistics
    const totalAttempts = attempts.length;
    const scores = attempts.map(a => a.score || 0);
    const averageScore = scores.reduce((a, b) => a + b, 0) / totalAttempts;
    const passedCount = scores.filter(s => s >= this.PASS_THRESHOLD).length;
    const passRate = (passedCount / totalAttempts) * 100;
    
    const times = attempts.map(a => a.timeSpent || 0);
    const averageTimeSpent = times.reduce((a, b) => a + b, 0) / totalAttempts;
    
    // Analyze questions
    const questionStats = new Map<string, { correct: number; total: number }>();
    
    attempts.forEach(attempt => {
      attempt.answers.forEach(answer => {
        const stats = questionStats.get(answer.questionId) || { correct: 0, total: 0 };
        stats.total++;
        if (answer.isCorrect) stats.correct++;
        questionStats.set(answer.questionId, stats);
      });
    });
    
    // Find difficult and easy questions
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
      commonMistakes: [], // Would need more complex analysis
    };
  }
  
  /**
   * Get user's quiz history
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

// Export singleton instance
export const quizService = new QuizService();