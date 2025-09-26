# 📱 دليل التكامل مع واجهة Frontend - منصة التعليم الذكية (محدث)

## 🌟 نظرة عامة
هذا الدليل موجه لفريق تطوير الواجهات الأمامية لربط الواجهة مع خدمات Backend المتقدمة للمنصة التعليمية.

**Backend URL:** `http://localhost:3001/api/v1`

---

## 📋 قائمة المحتويات
1. [المصادقة والتسجيل](#authentication)
2. [المحتوى والمواد الدراسية](#content-management)
3. [نظام Quiz المحسّن](#quiz-system)
4. [المحتوى التعليمي المثرى](#educational-content)
5. [المساعد التعليمي الذكي](#teaching-assistant)
6. [نظام الدردشة الذكية](#chat-system)
7. [سياق الطالب والإنجازات](#student-context)
8. [تقارير أولياء الأمور](#parent-reports)
9. [WebSocket للتواصل الفوري](#websocket)
10. [معلومات مهمة](#important-notes)

---

## 🔐 <a name="authentication"></a>1. المصادقة والتسجيل

### تسجيل مستخدم جديد
```javascript
// POST /api/v1/auth/register
// يحتاج Authentication: لا
const registerUser = async (userData) => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'student@example.com',
      password: 'SecurePass123!',
      firstName: 'أحمد',
      lastName: 'محمد',
      role: 'STUDENT', // أو 'TEACHER', 'PARENT'
      grade: 6 // الصف الدراسي
    })
  });

  const data = await response.json();
  // Response: { success: true, data: { user, token } }
  localStorage.setItem('token', data.data.token);
  return data;
};
```

### تسجيل الدخول
```javascript
// POST /api/v1/auth/login
// يحتاج Authentication: لا
const login = async (email, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  // Response: { success: true, data: { user, token } }
  localStorage.setItem('token', data.data.token);
  return data;
};
```

### استخدام Token في كل الطلبات
```javascript
// مساعد لإضافة headers
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});
```

---

## 📚 <a name="content-management"></a>2. المحتوى والمواد الدراسية

### الحصول على المواد الدراسية
```javascript
// GET /api/v1/subjects
// يحتاج Authentication: نعم
const getSubjects = async (grade) => {
  const params = grade ? `?grade=${grade}` : '';
  const response = await fetch(`${API_URL}/subjects${params}`, {
    headers: getAuthHeaders()
  });

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: [
      {
        id: "SUBJECT_ID",
        name: "Mathematics",
        nameAr: "الرياضيات",
        nameEn: "Mathematics",
        grade: 6,
        description: "مادة الرياضيات للصف السادس",
        icon: "🗽",
        order: 1
      }
    ]
  }
  */
  return data;
};

// GET /api/v1/subjects/:id
// يحتاج Authentication: نعم
const getSubjectDetails = async (subjectId) => {
  const response = await fetch(`${API_URL}/subjects/${subjectId}`, {
    headers: getAuthHeaders()
  });

  const data = await response.json();
  return data;
};
```

### الحصول على المحتوى حسب المستوى
```javascript
// GET /api/v1/content/subjects
// يحتاج Authentication: لا (عام)
const getContentByGrade = async (grade) => {
  const response = await fetch(`${API_URL}/content/subjects?grade=${grade}`);
  return await response.json();
};

// GET /api/v1/content/subjects/:id/units
// يحتاج Authentication: لا (عام)
const getUnits = async (subjectId) => {
  const response = await fetch(`${API_URL}/content/subjects/${subjectId}/units`);
  const data = await response.json();
  /*
  Response: {
    success: true,
    data: [
      {
        id: "UNIT_ID",
        title: "Unit Title",
        titleAr: "عنوان الوحدة",
        order: 1,
        description: "وصف الوحدة"
      }
    ]
  }
  */
  return data;
};

// GET /api/v1/content/units/:id/lessons
// يحتاج Authentication: لا (عام)
const getLessons = async (unitId) => {
  const response = await fetch(`${API_URL}/content/units/${unitId}/lessons`);
  const data = await response.json();
  /*
  Response: {
    success: true,
    data: [
      {
        id: "LESSON_ID",
        title: "Lesson Title",
        titleAr: "عنوان الدرس",
        order: 1,
        duration: 45,
        difficulty: "MEDIUM",
        isPublished: true
      }
    ]
  }
  */
  return data;
};

// GET /api/v1/content/lessons/:id
// يحتاج Authentication: اختياري (optional)
const getLessonContent = async (lessonId) => {
  const headers = localStorage.getItem('token')
    ? getAuthHeaders()
    : { 'Content-Type': 'application/json' };

  const response = await fetch(`${API_URL}/content/lessons/${lessonId}`, {
    headers
  });

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      lesson: { ...lessonDetails },
      content: {
        id: "CONTENT_ID",
        fullText: "نص الدرس الكامل",
        summary: "ملخص الدرس",
        keyPoints: [...],
        examples: [...],
        exercises: [...],
        enrichmentLevel: 3,
        realWorldApplications: [...],
        commonMistakes: [...],
        studentTips: [...],
        educationalStories: [...],
        funFacts: [...]
      }
    }
  }
  */
  return data;
};

// GET /api/v1/content/lessons/:id/questions
// يحتاج Authentication: نعم
const getLessonQuestions = async (lessonId) => {
  const response = await fetch(`${API_URL}/content/lessons/${lessonId}/questions`, {
    headers: getAuthHeaders()
  });
  return await response.json();
};

// GET /api/v1/content/search
// يحتاج Authentication: لا (عام)
const searchLessons = async (query, grade) => {
  const params = new URLSearchParams({ q: query });
  if (grade) params.append('grade', grade);

  const response = await fetch(`${API_URL}/content/search?${params}`);
  return await response.json();
};
```

---

## 🎯 <a name="quiz-system"></a>3. نظام Quiz المحسّن

### الحصول على التمارين المثراة
```javascript
// GET /api/v1/quiz/lessons/:lessonId/exercises
// يحتاج Authentication: نعم
const getEnrichedExercises = async (lessonId, options = {}) => {
  const params = new URLSearchParams({
    count: options.count || 10,
    difficulty: options.difficulty || 'MEDIUM' // EASY, MEDIUM, HARD
  });

  const response = await fetch(
    `${API_URL}/quiz/lessons/${lessonId}/exercises?${params}`,
    {
      headers: getAuthHeaders()
    }
  );

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      exercises: [
        {
          number: 1,
          question: "ما هو العامل المشترك الأكبر للعددين 12 و 18؟",
          type: "multiple_choice",
          options: ["2", "3", "6", "9"],
          correctAnswer: "6",
          explanation: "نحلل العددين: 12 = 2² × 3, 18 = 2 × 3²",
          hint: "حلل كل عدد إلى عوامله الأولية",
          difficulty: "medium",
          points: 2
        }
      ],
      total: 10,
      lessonId: "LESSON_ID",
      lessonTitle: "العامل المشترك الأكبر",
      hasMore: false,
      enrichmentLevel: 3
    }
  }
  */
  return data;
};
```

### بدء Quiz جديد
```javascript
// POST /api/v1/quiz/start
// يحتاج Authentication: نعم
const startQuiz = async (lessonId, questionCount = 10) => {
  const response = await fetch(`${API_URL}/quiz/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      lessonId,
      questionCount
    })
  });

  return await response.json();
};
```

### إرسال إجابة
```javascript
// POST /api/v1/quiz/answer
// يحتاج Authentication: نعم
const submitAnswer = async (attemptId, questionId, answer, timeSpent) => {
  const response = await fetch(`${API_URL}/quiz/answer`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      attemptId,
      questionId,
      answer,
      timeSpent // بالثواني
    })
  });

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      isCorrect: true
    }
  }
  */
  return data;
};
```

### إكمال Quiz
```javascript
// POST /api/v1/quiz/complete/:attemptId
// يحتاج Authentication: نعم
const completeQuiz = async (attemptId) => {
  const response = await fetch(`${API_URL}/quiz/complete/${attemptId}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      id: "ATTEMPT_ID",
      score: 85,
      totalQuestions: 10,
      correctAnswers: 8,
      incorrectAnswers: 2,
      timeSpent: 300,
      insights: [],
      avgTimePerQuestion: 30,
      streakBonus: 5,
      performanceLevel: 'intermediate',
      achievements: [...],
      feedback: {
        message: "ممتاز! أداء رائع",
        strengths: [...],
        areasToImprove: [...]
      }
    }
  }
  */
  return data;
};
```

### endpoints إضافية للـ Quiz
```javascript
// GET /api/v1/quiz/progress
// يحتاج Authentication: نعم
const getProgress = async () => {
  const response = await fetch(`${API_URL}/quiz/progress`, {
    headers: getAuthHeaders()
  });
  return await response.json();
};

// GET /api/v1/quiz/analytics
// يحتاج Authentication: نعم
const getAnalytics = async (subjectId) => {
  const params = subjectId ? `?subjectId=${subjectId}` : '';
  const response = await fetch(`${API_URL}/quiz/analytics${params}`, {
    headers: getAuthHeaders()
  });
  return await response.json();
};

// GET /api/v1/quiz/leaderboard
// يحتاج Authentication: نعم
const getLeaderboard = async (subjectId, grade, limit = 10) => {
  const params = new URLSearchParams({ limit });
  if (subjectId) params.append('subjectId', subjectId);
  if (grade) params.append('grade', grade);

  const response = await fetch(`${API_URL}/quiz/leaderboard?${params}`, {
    headers: getAuthHeaders()
  });
  return await response.json();
};
```

---

## 📖 <a name="educational-content"></a>4. المحتوى التعليمي المثرى

### الحصول على التلميحات
```javascript
// GET /api/v1/educational/lessons/:lessonId/tips
// يحتاج Authentication: لا
const getLessonTips = async (lessonId) => {
  const response = await fetch(`${API_URL}/educational/lessons/${lessonId}/tips`);
  return await response.json();
};
```

### الحصول على القصص التعليمية
```javascript
// GET /api/v1/educational/lessons/:lessonId/stories
// يحتاج Authentication: لا
const getLessonStories = async (lessonId) => {
  const response = await fetch(`${API_URL}/educational/lessons/${lessonId}/stories`);
  return await response.json();
};
```

### الحصول على التطبيقات الواقعية
```javascript
// GET /api/v1/educational/lessons/:lessonId/applications
// يحتاج Authentication: لا
const getRealWorldApplications = async (lessonId) => {
  const response = await fetch(`${API_URL}/educational/lessons/${lessonId}/applications`);
  return await response.json();
};
```

### الحصول على محتوى عشوائي
```javascript
// GET /api/v1/educational/lessons/:lessonId/random
// يحتاج Authentication: لا
const getRandomContent = async (lessonId) => {
  const response = await fetch(`${API_URL}/educational/lessons/${lessonId}/random`);
  return await response.json();
};
```

### الحصول على كل المحتوى المثرى
```javascript
// GET /api/v1/educational/lessons/:lessonId/all
// يحتاج Authentication: لا
const getAllEnrichedContent = async (lessonId) => {
  const response = await fetch(`${API_URL}/educational/lessons/${lessonId}/all`);
  return await response.json();
};
```

---

## 🤖 <a name="teaching-assistant"></a>5. المساعد التعليمي الذكي

### توليد نص تعليمي
```javascript
// POST /api/v1/lessons/:lessonId/teaching/script
// يحتاج Authentication: نعم
const generateTeachingScript = async (lessonId, slideContent, options = {}) => {
  const response = await fetch(`${API_URL}/lessons/${lessonId}/teaching/script`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      slideContent,
      generateVoice: options.generateVoice || false,
      options: {
        voiceStyle: options.voiceStyle || 'friendly',
        paceSpeed: options.paceSpeed || 'normal',
        useAnalogies: options.useAnalogies || true,
        useStories: options.useStories || true,
        needMoreDetail: options.needMoreDetail,
        needExample: options.needExample,
        needProblem: options.needProblem,
        problemDifficulty: options.problemDifficulty || 'medium'
      }
    })
  });

  return await response.json();
};
```

### التفاعل مع المساعد التعليمي
```javascript
// POST /api/v1/lessons/:lessonId/teaching/interaction
// يحتاج Authentication: نعم
const handleTeachingInteraction = async (lessonId, interactionType, currentSlide, context) => {
  const response = await fetch(`${API_URL}/lessons/${lessonId}/teaching/interaction`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      type: interactionType, // 'explain', 'more_detail', 'example', 'problem', 'repeat', 'continue', 'stop', 'quiz', 'summary'
      currentSlide,
      context
    })
  });

  return await response.json();
};
```

### توليد مسألة تعليمية
```javascript
// POST /api/v1/lessons/:lessonId/teaching/problem
// يحتاج Authentication: نعم
const generateProblem = async (lessonId, topic, difficulty = 'medium') => {
  const response = await fetch(`${API_URL}/lessons/${lessonId}/teaching/problem`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      topic,
      difficulty,
      generateVoice: true
    })
  });

  return await response.json();
};
```

---

## 💬 <a name="chat-system"></a>6. نظام الدردشة الذكية

### إرسال رسالة
```javascript
// POST /api/v1/chat/message
// يحتاج Authentication: نعم
const sendChatMessage = async (message, sessionId, lessonId, language = 'ar') => {
  const response = await fetch(`${API_URL}/chat/message`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      message,
      sessionId,
      lessonId,
      context: { language }
    })
  });

  return await response.json();
};
```

### الحصول على سجل المحادثة
```javascript
// GET /api/v1/chat/history
// يحتاج Authentication: نعم
const getChatHistory = async (lessonId, limit = 50) => {
  const params = new URLSearchParams({ limit });
  if (lessonId) params.append('lessonId', lessonId);

  const response = await fetch(`${API_URL}/chat/history?${params}`, {
    headers: getAuthHeaders()
  });

  return await response.json();
};
```

### الحصول على ملخص المحادثة
```javascript
// GET /api/v1/chat/session/:sessionId/summary
// يحتاج Authentication: نعم
const getSessionSummary = async (sessionId) => {
  const response = await fetch(`${API_URL}/chat/session/${sessionId}/summary`, {
    headers: getAuthHeaders()
  });

  return await response.json();
};
```

### إرسال تقييم للرسالة
```javascript
// POST /api/v1/chat/feedback
// يحتاج Authentication: نعم
const submitFeedback = async (messageId, rating, feedback) => {
  const response = await fetch(`${API_URL}/chat/feedback`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      messageId,
      rating,
      feedback
    })
  });

  return await response.json();
};
```

### الحصول على اقتراحات
```javascript
// GET /api/v1/chat/suggestions
// يحتاج Authentication: نعم
const getChatSuggestions = async (lessonId) => {
  const params = lessonId ? `?lessonId=${lessonId}` : '';

  const response = await fetch(`${API_URL}/chat/suggestions${params}`, {
    headers: getAuthHeaders()
  });

  return await response.json();
};
```

---

## 👤 <a name="student-context"></a>7. سياق الطالب والإنجازات

### الحصول على سياق الطالب
```javascript
// GET /api/v1/student-context/:userId
// يحتاج Authentication: لا
const getStudentContext = async (userId) => {
  const response = await fetch(`${API_URL}/student-context/${userId}`);
  return await response.json();
};
```

### تحديث سياق الطالب
```javascript
// PUT /api/v1/student-context/:userId
// يحتاج Authentication: لا
const updateStudentContext = async (userId, updates) => {
  const response = await fetch(`${API_URL}/student-context/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });

  return await response.json();
};
```

### الحالة العاطفية
```javascript
// GET /api/v1/student-context/:userId/emotional-state
// يحتاج Authentication: لا
const getEmotionalState = async (userId) => {
  const response = await fetch(`${API_URL}/student-context/${userId}/emotional-state`);
  return await response.json();
};

// POST /api/v1/student-context/:userId/emotional-state
// يحتاج Authentication: لا
const updateEmotionalState = async (userId, state) => {
  const response = await fetch(`${API_URL}/student-context/${userId}/emotional-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });

  return await response.json();
};
```

### الإنجازات
```javascript
// GET /api/v1/achievements/:userId
// يحتاج Authentication: لا
const getUserAchievements = async (userId) => {
  const response = await fetch(`${API_URL}/achievements/${userId}`);
  return await response.json();
};

// POST /api/v1/achievements/:userId/unlock
// يحتاج Authentication: لا
const unlockAchievement = async (userId, achievementData) => {
  const response = await fetch(`${API_URL}/achievements/${userId}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(achievementData)
  });

  return await response.json();
};

// GET /api/v1/achievements/:userId/progress
// يحتاج Authentication: لا
const getAchievementProgress = async (userId) => {
  const response = await fetch(`${API_URL}/achievements/${userId}/progress`);
  return await response.json();
};

// GET /api/v1/achievements/leaderboard/top
// يحتاج Authentication: لا
const getLeaderboardTop = async () => {
  const response = await fetch(`${API_URL}/achievements/leaderboard/top`);
  return await response.json();
};
```

---

## 📊 <a name="parent-reports"></a>8. تقارير أولياء الأمور

### الحصول على آخر تقرير
```javascript
// GET /api/v1/parent-reports/:userId/latest
// يحتاج Authentication: لا
const getLatestReport = async (userId) => {
  const response = await fetch(`${API_URL}/parent-reports/${userId}/latest`);
  return await response.json();
};
```

### الحصول على سجل التقارير
```javascript
// GET /api/v1/parent-reports/:userId/history
// يحتاج Authentication: لا
const getReportHistory = async (userId) => {
  const response = await fetch(`${API_URL}/parent-reports/${userId}/history`);
  return await response.json();
};
```

### توليد تقرير جديد
```javascript
// POST /api/v1/parent-reports/:userId/generate
// يحتاج Authentication: لا
const generateNewReport = async (userId) => {
  const response = await fetch(`${API_URL}/parent-reports/${userId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  return await response.json();
};
```

### إرسال التقرير بالبريد الإلكتروني
```javascript
// POST /api/v1/parent-reports/:userId/send-email
// يحتاج Authentication: لا
const sendReportByEmail = async (userId, email) => {
  const response = await fetch(`${API_URL}/parent-reports/${userId}/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  return await response.json();
};
```

---

## 🔌 <a name="websocket"></a>9. WebSocket للتواصل الفوري

### الاتصال بـ WebSocket
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: localStorage.getItem('token')
  }
});

// Authentication
socket.on('connect', () => {
  socket.emit('authenticate', { token: localStorage.getItem('token') });
});

// Student Context Events
socket.emit('student:update-context', {
  userId: 'USER_ID',
  updates: { currentMood: 'happy' }
});

socket.on('student:context-updated', (data) => {
  console.log('Context updated:', data);
});

// Teaching Events
socket.emit('teaching:request-script', {
  lessonId: 'LESSON_ID',
  slideContent: { /* ... */ }
});

socket.on('teaching:script-ready', (script) => {
  console.log('Teaching script:', script);
});

// Quiz Events
socket.emit('quiz:start', {
  lessonId: 'LESSON_ID',
  userId: 'USER_ID'
});

socket.on('quiz:question', (question) => {
  console.log('New question:', question);
});

socket.emit('quiz:answer', {
  attemptId: 'ATTEMPT_ID',
  questionId: 'QUESTION_ID',
  answer: 'USER_ANSWER'
});

socket.on('quiz:feedback', (feedback) => {
  console.log('Feedback:', feedback);
});

// Emotional State Tracking
socket.emit('emotion:update', {
  userId: 'USER_ID',
  emotion: 'confident',
  confidence: 85
});

socket.on('emotion:support', (supportMessage) => {
  console.log('Emotional support:', supportMessage);
});

// Reconnection Strategy
socket.on('disconnect', () => {
  setTimeout(() => socket.connect(), 1000);
});
```

---

## ⚠️ <a name="important-notes"></a>10. معلومات مهمة

### Rate Limiting
```javascript
// معدلات الحد الأقصى للطلبات:
const RATE_LIMITS = {
  'AI_ENDPOINTS': '10 requests/minute',     // للـ teaching، chat endpoints
  'REGULAR_API': '100 requests/15 minutes',  // للـ API العادي
  'AUTH_ENDPOINTS': '5 requests/15 minutes', // للـ login/register
  'WEBSOCKET': 'unlimited'                   // للمستخدمين المصدقين
};
```

### Error Codes
```javascript
const ERROR_CODES = {
  'AUTH_REQUIRED': 401,        // يحتاج تسجيل دخول
  'FORBIDDEN': 403,            // غير مصرح
  'NOT_FOUND': 404,            // المورد غير موجود
  'VALIDATION_ERROR': 400,     // بيانات غير صحيحة
  'RATE_LIMIT_EXCEEDED': 429,  // تجاوز حد الطلبات
  'INTERNAL_ERROR': 500        // خطأ في السيرفر
};
```

### معالجة الأخطاء
```javascript
const handleApiError = (error) => {
  switch (error.status) {
    case 401:
      // توجيه لصفحة تسجيل الدخول
      window.location.href = '/login';
      break;
    case 429:
      // عرض رسالة انتظار
      showNotification('الرجاء الانتظار قبل المحاولة مرة أخرى');
      break;
    case 500:
      // عرض رسالة خطأ عام
      showNotification('حدث خطأ في السيرفر');
      break;
    default:
      console.error('API Error:', error);
  }
};
```

### نصائح للأداء
1. **استخدام Cache**: المحتوى المثرى محفوظ في cache، استفد منه
2. **Batch Requests**: جمع الطلبات المتعددة قدر الإمكان
3. **Lazy Loading**: تحميل المحتوى عند الحاجة فقط
4. **WebSocket**: استخدم WebSocket للتحديثات الفورية بدلاً من polling

### SDK جاهز للاستخدام
```javascript
// يمكنك استخدام SDK جاهز:
import SmartEducationSDK from './sdk/smart-education-sdk';

const sdk = new SmartEducationSDK({
  baseURL: 'http://localhost:3001/api/v1',
  token: localStorage.getItem('token')
});

// أمثلة على الاستخدام:
const subjects = await sdk.content.getSubjects(6);
const quiz = await sdk.quiz.start('LESSON_ID', 10);
const chat = await sdk.chat.sendMessage('سؤالي هو...');
```

---

## 📝 ملاحظات التحديث

### التحديثات الرئيسية في هذا الدليل:
1. ✅ إضافة جميع Content و Subjects endpoints المفقودة
2. ✅ تصحيح Parent Reports endpoints
3. ✅ إضافة Chat endpoints بالكامل
4. ✅ توضيح متطلبات Authentication لكل endpoint
5. ✅ إضافة Progress و Analytics و Leaderboard endpoints
6. ✅ إضافة معلومات Rate Limiting و Error Codes
7. ✅ تحديث Response formats بناءً على الكود الفعلي
8. ✅ إضافة Achievement leaderboard endpoint الصحيح

### Endpoints المهمة المضافة:
- `/api/v1/content/*` - إدارة المحتوى التعليمي
- `/api/v1/subjects/*` - المواد الدراسية
- `/api/v1/chat/*` - نظام الدردشة الذكية
- `/api/v1/quiz/progress` - تقدم الطالب
- `/api/v1/quiz/analytics` - تحليلات التعلم
- `/api/v1/quiz/leaderboard` - لوحة المتصدرين

---

## 🚀 البدء السريع

1. تأكد من تشغيل Backend على المنفذ 3001
2. قم بتسجيل مستخدم جديد أو سجل دخول
3. احفظ Token في localStorage
4. استخدم `getAuthHeaders()` في كل طلب يحتاج authentication
5. راجع Rate Limits لتجنب حظر الطلبات

---

## 💡 للمساعدة والدعم

في حالة وجود أي استفسارات أو مشاكل:
1. راجع Error Codes لفهم الأخطاء
2. تحقق من Rate Limits
3. تأكد من صحة Token
4. راجع console للأخطاء التفصيلية

---

تم التحديث بواسطة: فريق Backend
التاريخ: ${new Date().toLocaleDateString('ar-EG')}
الإصدار: 2.0.0