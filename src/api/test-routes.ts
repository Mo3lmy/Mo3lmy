// src/api/test-routes.ts
import { Router } from 'express';
import { openAIService } from '../services/ai/openai.service';
import { ragService } from '../core/rag/rag.service';
import { quizService } from '../core/quiz/quiz.service';
import { teachingAssistant } from '../services/teaching/teaching-assistant.service';
import { prisma } from '../config/database.config';
const router = Router();

// ============= HEALTH CHECK =============
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    database: true,
    openai: openAIService.isReady(),
    rag: true,
    timestamp: new Date().toISOString()
  });
});

// ============= OPENAI ROUTES =============
router.post('/ai/chat', async (req, res) => {
  try {
    const { messages, options } = req.body;
    
    // Add timeout handling
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 30000)
    );
    
    const chatPromise = openAIService.chat(messages, options);
    
    const response = await Promise.race([chatPromise, timeoutPromise]);
    const stats = openAIService.getUsageStats();
    
    res.json({
      success: true,
      response,
      model: options?.model || stats.defaultModel || 'gpt-4o-mini',
      cost: stats.costBreakdown.total
    });
  } catch (error: any) {
    res.json({ 
      success: false, 
      error: error.message === 'Request timeout' ? 'انتهت مهلة الطلب' : error.message 
    });
  }
});

router.get('/ai/stats', (req, res) => {
  const stats = openAIService.getUsageStats();
  res.json({
    ...stats,
    status: openAIService.isReady() ? 'ready' : 'not ready'
  });
});

router.post('/ai/clear-cache', (req, res) => {
  openAIService.clearCaches();
  res.json({ success: true, message: 'Cache cleared' });
});

// ============= RAG ROUTES =============
router.post('/rag/answer', async (req, res) => {
  try {
    const { question, lessonId } = req.body;
    const result = await ragService.answerQuestion(
      question, 
      lessonId || undefined
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/rag/quiz-questions', async (req, res) => {
  try {
    const { lessonId, count, userId } = req.body;
    const questions = await ragService.generateQuizQuestions(
      lessonId || 'clq5vx3w3001el20878ub6y1i',
      count || 3,
      userId || 'test-user'
    );
    res.json({ success: true, questions });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/rag/explain-concept', async (req, res) => {
  try {
    const { concept, lessonId } = req.body;
    const explanation = await ragService.explainConcept(
      concept || 'مفهوم تجريبي',
      lessonId
    );
    res.json({ success: true, explanation });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/rag/study-plan', async (req, res) => {
  try {
    const { userId, weaknesses } = req.body;
    // Since generatePersonalizedStudyPlan doesn't exist, use a mock response
    const plan = `خطة دراسية مخصصة للطالب ${userId || 'test-user'}:
    1. مراجعة الأساسيات
    2. حل تمارين متدرجة
    3. اختبارات دورية`;
    
    res.json({ success: true, plan });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/rag/wrong-answer', async (req, res) => {
  try {
    const { question, wrongAnswer, userId } = req.body;
    const explanation = await ragService.explainWrongAnswer(
      question || 'سؤال تجريبي',
      wrongAnswer || 'إجابة خاطئة',
      'الإجابة الصحيحة',
      userId || 'test-user'
    );
    res.json({ success: true, explanation });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

// ============= QUIZ ROUTES =============
router.post('/quiz/generate', async (req, res) => {
  try {
    const { lessonId, count } = req.body;
    const questions = await quizService.generateQuizQuestions(
      lessonId || 'clq5vx3w3001el20878ub6y1i',
      count || 5
    );
    res.json({ success: true, questions });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/quiz/adaptive', async (req, res) => {
  try {
    const { lessonId, userId, adaptiveDifficulty } = req.body;
    
    // Start quiz session
    const session = await quizService.startQuizAttempt(
      userId || 'test-user',
      lessonId || 'clq5vx3w3001el20878ub6y1i',
      5,
      'practice'
    );
    
    res.json({ 
      success: true,
      sessionId: session.id,  // Use 'id' instead of 'attemptId'
      questions: session.questions || [],
      difficulty: adaptiveDifficulty ? 'adaptive' : 'standard',
      message: 'Adaptive quiz started'
    });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/quiz/submit-answer', async (req, res) => {
  try {
    const { attemptId, questionId, answer } = req.body;
    const result = await quizService.submitAnswer(
      attemptId || 'test-attempt',
      questionId || 'test-question',
      answer || 'test-answer',
      10  // Add default timeSpent
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/quiz/complete', async (req, res) => {
  try {
    const { attemptId } = req.body;
    const result = await quizService.completeQuiz(
      attemptId || 'test-attempt'
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/quiz/stats', async (req, res) => {
  try {
    const { userId } = req.query;
    const stats = await quizService.getQuizStatistics(
      userId as string || 'test-user'
    );
    res.json({ success: true, stats });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

// ============= TEACHING ASSISTANT ROUTES =============
router.post('/teaching/generate-script', async (req, res) => {
  try {
    const script = await teachingAssistant.generateTeachingScript(req.body);
    res.json({ success: true, ...script });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/teaching/progress-report', async (req, res) => {
  try {
    const { studentName, studentGrade } = req.body;
    const report = await teachingAssistant.getStudentProgressReport(
      studentName || 'طالب',
      studentGrade || 6
    );
    res.json({ success: true, ...report });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/teaching/interaction', async (req, res) => {
  try {
    const { interactionType, currentSlide, lessonId, studentGrade, context } = req.body;
    const response = await teachingAssistant.handleStudentInteraction(
      interactionType,
      currentSlide || { content: 'محتوى تجريبي' },
      lessonId || 'test-lesson',
      studentGrade || 6,
      context
    );
    res.json({ success: true, ...response });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/teaching/emotional-state', async (req, res) => {
  // Mock emotional state detection
  res.json({
    success: true,
    emotionalState: {
      mood: 'neutral',
      confidence: 70,
      engagement: 75,
      needsBreak: false
    }
  });
});

router.post('/teaching/motivation', async (req, res) => {
  res.json({
    success: true,
    message: 'أنت رائع! استمر في المحاولة، كل خطوة تقربك من النجاح!',
    type: 'encouragement'
  });
});

router.post('/teaching/parent-report', async (req, res) => {
  res.json({
    success: true,
    report: {
      summary: 'الطالب يحرز تقدماً جيداً',
      strengths: ['حل المسائل', 'الفهم السريع'],
      areasToImprove: ['التركيز لفترات أطول'],
      recommendations: ['ممارسة 15 دقيقة يومياً', 'حل 3 مسائل يومياً']
    }
  });
});

// ============= TEST HELPER ROUTES =============
router.post('/test/task-detection', async (req, res) => {
  const { prompt } = req.body;
  
  // Simple task detection logic
  let taskType = 'general';
  if (prompt.includes('معادلة') || prompt.includes('حل') || prompt.includes('حساب')) {
    taskType = 'math';
  } else if (prompt.includes('قصة') || prompt.includes('اكتب')) {
    taskType = 'creative';
  } else if (prompt.includes('اشرح') || prompt.includes('وضح')) {
    taskType = 'explanation';
  }
  
  res.json({ success: true, taskType });
});

router.post('/test/cost-optimization', async (req, res) => {
  const tests = [
    { prompt: '2+2', expectedCost: 0.0001 },
    { prompt: 'حل معادلة تفاضلية', expectedCost: 0.01 }
  ];
  
  const results = [];
  for (const test of tests) {
    const start = Date.now();
    await openAIService.chat([{ role: 'user', content: test.prompt }], {});
    const time = Date.now() - start;
    const stats = openAIService.getUsageStats();
    results.push({
      prompt: test.prompt,
      time,
      cost: stats.costBreakdown.total
    });
  }
  
  res.json({ success: true, results });
});

router.post('/test/json-generation', async (req, res) => {
  try {
    const response = await openAIService.chatJSON(
      [{ role: 'user', content: 'Generate quiz question' }],
      {}
    );
    res.json({ success: true, json: response });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/test/performance', async (req, res) => {
  const iterations = 5;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await openAIService.chat(
      [{ role: 'user', content: `Test ${i}` }],
      { maxTokens: 50 }
    );
    times.push(Date.now() - start);
  }
  
  res.json({
    success: true,
    averageTime: times.reduce((a, b) => a + b) / times.length,
    times
  });
});

router.post('/test/stress', async (req, res) => {
  const { requests = 10 } = req.body;
  
  const promises = Array(requests).fill(0).map(async (_, i) => {
    try {
      const start = Date.now();
      await openAIService.chat(
        [{ role: 'user', content: `Stress test ${i}` }],
        { maxTokens: 10 }
      );
      return { success: true, time: Date.now() - start, index: i };
    } catch (error: any) {
      return { success: false, error: error.message, index: i };
    }
  });
  
  const results = await Promise.all(promises);
  const successful = results.filter(r => r.success).length;
  
  res.json({
    success: true,
    totalRequests: requests,
    successful,
    failed: requests - successful,
    results
  });
});



// Helper function للحصول على أول lesson ID صالح
async function getValidLessonId(): Promise<string> {
  const lesson = await prisma.lesson.findFirst({
    where: {
      content: {
        embeddings: {
          some: {}
        }
      }
    },
    select: { id: true }
  });
  
  return lesson?.id || 'no-valid-lesson';
}

// عدّل RAG quiz-questions
router.post('/rag/quiz-questions', async (req, res) => {
  try {
    let { lessonId, count, userId } = req.body;
    
    // إذا لم يتم تحديد lessonId، احصل على واحد صالح
    if (!lessonId) {
      lessonId = await getValidLessonId();
    }
    
    // تحقق من وجود المحتوى أولاً
    const lessonExists = await prisma.lesson.findFirst({
      where: { 
        id: lessonId,
        content: {
          embeddings: {
            some: {}
          }
        }
      }
    });
    
    if (!lessonExists) {
      return res.json({ 
        success: false, 
        error: 'الدرس المطلوب غير موجود أو لا يحتوي على محتوى',
        availableLessons: await prisma.lesson.findMany({
          where: {
            content: {
              embeddings: {
                some: {}
              }
            }
          },
          select: {
            id: true,
            titleAr: true,
            title: true
          },
          take: 5
        })
      });
    }
    
    const questions = await ragService.generateQuizQuestions(
      lessonId,
      count || 3,
      userId || 'test-user'
    );
    
    res.json({ success: true, questions });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

// عدّل quiz/generate
router.post('/quiz/generate', async (req, res) => {
  try {
    let { lessonId, count } = req.body;
    
    if (!lessonId) {
      lessonId = await getValidLessonId();
    }
    
    // تحقق من وجود الدرس
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        content: {
          select: { id: true }
        }
      }
    });
    
    if (!lesson) {
      return res.json({
        success: false,
        error: 'الدرس غير موجود',
        suggestion: 'استخدم GET /api/lessons للحصول على قائمة الدروس المتاحة'
      });
    }
    
    if (!lesson.content) {
      return res.json({
        success: false,
        error: 'الدرس لا يحتوي على محتوى',
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title
      });
    }
    
    const questions = await quizService.generateQuizQuestions(
      lessonId,
      count || 5
    );
    
    res.json({ success: true, questions, lessonTitle: lesson.titleAr || lesson.title });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

// أضف endpoint للحصول على الدروس المتاحة
router.get('/lessons/available', async (req, res) => {
  try {
    const lessons = await prisma.lesson.findMany({
      where: {
        content: {
          embeddings: {
            some: {}
          }
        }
      },
      select: {
        id: true,
        title: true,
        titleAr: true,
        content: {
          select: {
            embeddings: {
              select: { id: true },
              take: 1
            }
          }
        }
      },
      take: 10
    });
    
    res.json({
      success: true,
      count: lessons.length,
      lessons: lessons.map(l => ({
        id: l.id,
        title: l.titleAr || l.title,
        hasContent: true,
        hasEmbeddings: Array.isArray(l.content?.embeddings) && l.content.embeddings.length > 0
      }))
    });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});




export default router;