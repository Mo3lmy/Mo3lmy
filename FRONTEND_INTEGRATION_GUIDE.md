# 📱 دليل التكامل مع واجهة Frontend - منصة التعليم الذكية

## 🌟 نظرة عامة
هذا الدليل موجه لفريق تطوير الواجهات الأمامية لربط الواجهة مع خدمات Backend المتقدمة للمنصة التعليمية.

**Backend URL:** `http://localhost:3001/api/v1`

---

## 📋 قائمة المحتويات
1. [المصادقة والتسجيل](#authentication)
2. [نظام Quiz المحسّن](#quiz-system)
3. [المحتوى التعليمي المثرى](#educational-content)
4. [المساعد التعليمي الذكي](#teaching-assistant)
5. [نظام Cache والأداء](#cache-system)
6. [WebSocket للتواصل الفوري](#websocket)

---

## 🔐 <a name="authentication"></a>1. المصادقة والتسجيل

### تسجيل مستخدم جديد
```javascript
// POST /api/v1/auth/register
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

## 🎯 <a name="quiz-system"></a>2. نظام Quiz المحسّن

### الحصول على التمارين المثراة
```javascript
// GET /api/v1/quiz/lessons/:lessonId/exercises
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
const startQuiz = async (lessonId, questionCount = 10) => {
  const response = await fetch(`${API_URL}/quiz/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      lessonId,
      questionCount
    })
  });

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      id: "ATTEMPT_ID",
      questions: [...],
      timeLimit: 600, // ثواني
      mode: "practice",
      welcomeMessage: "أهلاً أحمد! بالتوفيق",
      emotionalSupport: {
        encouragement: "أنت قادر على النجاح!",
        hint: "خد وقتك وفكر بهدوء"
      }
    }
  }
  */
  return data;
};
```

### إرسال إجابة
```javascript
// POST /api/v1/quiz/answer
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
      isCorrect: true,
      explanation: "شرح الإجابة...",
      pointsEarned: 2,
      streakBonus: 5,
      encouragement: "ممتاز! استمر"
    }
  }
  */
  return data;
};
```

### إنهاء Quiz والحصول على النتائج
```javascript
// POST /api/v1/quiz/complete/:attemptId
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
      score: 85,
      percentage: 85,
      passed: true,
      correctAnswers: 17,
      totalQuestions: 20,
      timeSpent: 450,
      achievements: ["نجم الرياضيات", "سريع البديهة"],
      recommendations: ["راجع موضوع الكسور", "ممتاز في الجبر"],
      parentReport: {
        studentName: "أحمد",
        performance: { ... },
        recommendations: [...]
      }
    }
  }
  */
  return data;
};
```

---

## 📚 <a name="educational-content"></a>3. المحتوى التعليمي المثرى

### الحصول على النصائح التعليمية
```javascript
// GET /api/v1/educational/lessons/:lessonId/tips
const getStudentTips = async (lessonId) => {
  const response = await fetch(`${API_URL}/educational/lessons/${lessonId}/tips`);

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      tips: [
        "ابدأ دائماً بتحليل العدد إلى عوامله الأولية",
        "تذكر: العامل المشترك الأكبر دائماً أصغر من أو يساوي الأعداد المعطاة"
      ],
      count: 5,
      lessonTitle: "العامل المشترك الأكبر"
    }
  }
  */
  return data;
};
```

### الحصول على القصص التعليمية
```javascript
// GET /api/v1/educational/lessons/:lessonId/stories
const getEducationalStories = async (lessonId) => {
  const response = await fetch(`${API_URL}/educational/lessons/${lessonId}/stories`);

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      stories: [
        {
          title: "قصة الخوارزمي والأعداد",
          content: "في بغداد القديمة...",
          moral: "الرياضيات تحل مشاكل الحياة",
          relatedConcept: "العامل المشترك"
        }
      ],
      count: 3
    }
  }
  */
  return data;
};
```

### الحصول على التطبيقات الواقعية
```javascript
// GET /api/v1/educational/lessons/:lessonId/applications
const getRealWorldApplications = async (lessonId) => {
  const response = await fetch(`${API_URL}/educational/lessons/${lessonId}/applications`);

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      applications: [
        {
          title: "توزيع الهدايا",
          scenario: "لديك 24 قلم و 36 دفتر...",
          solution: "نجد العامل المشترك الأكبر = 12",
          realLifeConnection: "يُستخدم في المتاجر والمصانع"
        }
      ],
      count: 5
    }
  }
  */
  return data;
};
```

### الحصول على محتوى عشوائي تفاعلي
```javascript
// GET /api/v1/educational/lessons/:lessonId/random
const getRandomContent = async (lessonId, type) => {
  const params = type ? `?type=${type}` : '';
  const response = await fetch(
    `${API_URL}/educational/lessons/${lessonId}/random${params}`
  );

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      type: "funFact", // أو tip, story, application, challenge
      content: {
        text: "هل تعلم أن الرقم 6 هو أول عدد كامل؟",
        explanation: "لأن عوامله (1،2،3) مجموعها = 6"
      }
    }
  }
  */
  return data;
};
```

### الحصول على كل المحتوى المثرى
```javascript
// GET /api/v1/educational/lessons/:lessonId/all
const getAllEnrichedContent = async (lessonId) => {
  const response = await fetch(`${API_URL}/educational/lessons/${lessonId}/all`);

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      content: {
        tips: [...],
        stories: [...],
        mistakes: [...],
        applications: [...],
        funFacts: [...],
        challenges: [...],
        visualAids: [...]
      },
      stats: {
        totalTips: 10,
        totalStories: 3,
        // ...
      }
    }
  }
  */
  return data;
};
```

---

## 🤖 <a name="teaching-assistant"></a>4. المساعد التعليمي الذكي

### توليد سكريبت تعليمي
```javascript
// POST /api/v1/lessons/:lessonId/teaching/script
const generateTeachingScript = async (lessonId, slideContent, options = {}) => {
  const response = await fetch(`${API_URL}/lessons/${lessonId}/teaching/script`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      slideContent: {
        title: "العوامل والمضاعفات",
        content: "سنتعلم اليوم عن العوامل..."
      },
      generateVoice: true, // توليد صوت
      options: {
        voiceStyle: 'friendly', // formal, energetic
        paceSpeed: 'normal', // slow, fast
        useAnalogies: true,
        useStories: true,
        needMoreDetail: false,
        needExample: true,
        needProblem: false
      }
    })
  });

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      script: "أهلاً يا بطل! اليوم هنتعلم حاجة جميلة...",
      duration: 120, // ثواني
      keyPoints: ["العامل هو...", "المضاعف هو..."],
      examples: ["مثال: العدد 12..."],
      visualCues: ["ارسم دائرة", "اكتب الأعداد"],
      emotionalTone: "encouraging",
      nextSuggestions: ["example", "problem", "quiz"],
      audioUrl: "http://localhost:3001/audio/teaching_12345.mp3"
    }
  }
  */
  return data;
};
```

### التفاعل مع المساعد
```javascript
// POST /api/v1/lessons/:lessonId/teaching/interaction
const interactWithAssistant = async (lessonId, interactionType, context) => {
  const response = await fetch(`${API_URL}/lessons/${lessonId}/teaching/interaction`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      type: interactionType, // 'explain', 'example', 'problem', 'quiz', 'summary'
      currentSlide: {
        title: "العنوان الحالي",
        content: "المحتوى..."
      },
      context: {
        previousScript: "الشرح السابق...",
        sessionHistory: ["سؤال 1", "إجابة 1"]
      }
    })
  });

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      type: "example",
      script: "خلينا نشوف مثال عملي...",
      duration: 60,
      audioUrl: "http://localhost:3001/audio/interaction_12345.mp3",
      emotionalTone: "supportive",
      nextSuggestions: ["problem", "quiz"]
    }
  }
  */
  return data;
};
```

### توليد مسألة تعليمية
```javascript
// POST /api/v1/lessons/:lessonId/teaching/problem
const generateProblem = async (lessonId, topic, difficulty = 'medium') => {
  const response = await fetch(`${API_URL}/lessons/${lessonId}/teaching/problem`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      topic,
      difficulty, // easy, medium, hard
      generateVoice: true
    })
  });

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      script: "خلينا نحل مسألة جميلة...",
      problem: {
        question: "لديك 24 كرة و 36 قلم...",
        hints: ["فكر في العوامل", "استخدم التحليل"],
        solution: "العامل المشترك = 12",
        steps: ["الخطوة 1...", "الخطوة 2..."]
      },
      duration: 180,
      audioUrl: "http://localhost:3001/audio/problem_12345.mp3"
    }
  }
  */
  return data;
};
```

---

## ⚡ <a name="cache-system"></a>5. نظام Cache والأداء

### الحصول على إحصائيات Cache
```javascript
// GET /api/v1/lessons/cache/stats
const getCacheStats = async () => {
  const response = await fetch(`${API_URL}/lessons/cache/stats`, {
    headers: getAuthHeaders()
  });

  const data = await response.json();
  /*
  Response: {
    success: true,
    data: {
      keys: 45,
      hits: 1250,
      misses: 85,
      hitRate: 0.936,
      memoryUsage: "2.5 MB",
      avgHitTime: 2.3 // milliseconds
    }
  }
  */
  return data;
};
```

### تسخين Cache
```javascript
// POST /api/v1/lessons/cache/warmup
const warmupCache = async () => {
  const response = await fetch(`${API_URL}/lessons/cache/warmup`, {
    method: 'POST',
    headers: getAuthHeaders()
  });

  return response.json();
};
```

---

## 🔌 <a name="websocket"></a>6. WebSocket للتواصل الفوري

### الاتصال بـ WebSocket
```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001', {
  auth: {
    token: localStorage.getItem('token')
  }
});

// الاتصال
socket.on('connect', () => {
  console.log('Connected to WebSocket');

  // الانضمام لغرفة الدرس
  socket.emit('join-lesson', {
    lessonId: 'LESSON_ID',
    userId: 'USER_ID'
  });
});

// استقبال رسائل المعلم
socket.on('teaching-update', (data) => {
  console.log('New teaching content:', data);
  /*
  data: {
    type: 'explanation',
    content: 'شرح جديد...',
    audioUrl: '...',
    visualAids: [...]
  }
  */
});

// إرسال تفاعل الطالب
const sendStudentInteraction = (type, data) => {
  socket.emit('student-interaction', {
    type, // 'question', 'answer', 'confused', 'understood'
    data,
    timestamp: new Date()
  });
};

// تحديث الحالة العاطفية
const updateEmotionalState = (mood, confidence) => {
  socket.emit('emotional-update', {
    mood, // 'happy', 'neutral', 'frustrated', 'confused', 'tired'
    confidence, // 0-100
    engagement: 75 // 0-100
  });
};

// استقبال التشجيع الشخصي
socket.on('personalized-encouragement', (data) => {
  console.log('Encouragement:', data.message);
  // عرض رسالة تشجيعية للطالب
});
```

---

## 🎨 أفضل الممارسات للـ Frontend

### 1. إدارة الحالة (State Management)
```javascript
// استخدام Redux أو Context API
const initialState = {
  user: null,
  currentLesson: null,
  quizSession: null,
  enrichedContent: {},
  teachingScript: null,
  emotionalState: {
    mood: 'neutral',
    confidence: 70,
    engagement: 70
  }
};
```

### 2. معالجة الأخطاء
```javascript
const apiCall = async (url, options) => {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'API Error');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    // عرض رسالة خطأ للمستخدم
    showErrorNotification(error.message);
    throw error;
  }
};
```

### 3. التخزين المحلي (Caching)
```javascript
// تخزين البيانات التي لا تتغير كثيراً
const cacheData = (key, data, expiryMinutes = 60) => {
  const item = {
    data,
    expiry: new Date().getTime() + (expiryMinutes * 60 * 1000)
  };
  localStorage.setItem(key, JSON.stringify(item));
};

const getCachedData = (key) => {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) return null;

  const item = JSON.parse(itemStr);
  if (new Date().getTime() > item.expiry) {
    localStorage.removeItem(key);
    return null;
  }

  return item.data;
};
```

### 4. تحسين الأداء
```javascript
// Lazy Loading للمحتوى
const LazyContent = React.lazy(() => import('./components/EnrichedContent'));

// Debounce للبحث
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const searchLessons = debounce(async (query) => {
  // API call
}, 500);
```

### 5. واجهات تفاعلية
```javascript
// عرض التقدم في الوقت الفعلي
const QuizProgress = ({ current, total, score }) => (
  <div className="quiz-progress">
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: `${(current/total) * 100}%` }}
      />
    </div>
    <div className="stats">
      <span>السؤال {current} من {total}</span>
      <span>النقاط: {score}</span>
    </div>
  </div>
);

// رسائل تشجيعية متحركة
const EncouragementMessage = ({ message, type }) => (
  <motion.div
    className={`encouragement ${type}`}
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
  >
    {message}
  </motion.div>
);
```

---

## 📊 مؤشرات الأداء المطلوبة

### Core Web Vitals المستهدفة:
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1

### معدلات الاستجابة:
- **API Calls:** < 200ms (مع cache)
- **WebSocket Latency:** < 50ms
- **Audio Loading:** < 1s
- **Quiz Response:** فوري

---

## 🔧 أدوات مساعدة

### SDK جاهز للاستخدام
```javascript
// smart-education-sdk.js
class SmartEducationAPI {
  constructor(apiUrl = 'http://localhost:3001/api/v1') {
    this.apiUrl = apiUrl;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  async request(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  // Auth methods
  auth = {
    login: (email, password) =>
      this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }),

    register: (userData) =>
      this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      })
  };

  // Quiz methods
  quiz = {
    start: (lessonId, questionCount) =>
      this.request('/quiz/start', {
        method: 'POST',
        body: JSON.stringify({ lessonId, questionCount })
      }),

    submitAnswer: (data) =>
      this.request('/quiz/answer', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    complete: (attemptId) =>
      this.request(`/quiz/complete/${attemptId}`, {
        method: 'POST'
      })
  };

  // Educational content methods
  educational = {
    getTips: (lessonId) =>
      this.request(`/educational/lessons/${lessonId}/tips`),

    getStories: (lessonId) =>
      this.request(`/educational/lessons/${lessonId}/stories`),

    getAll: (lessonId) =>
      this.request(`/educational/lessons/${lessonId}/all`)
  };

  // Teaching assistant methods
  teaching = {
    generateScript: (lessonId, data) =>
      this.request(`/lessons/${lessonId}/teaching/script`, {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    interact: (lessonId, data) =>
      this.request(`/lessons/${lessonId}/teaching/interaction`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
  };
}

// استخدام SDK
const api = new SmartEducationAPI();
api.setToken('your-token-here');

// مثال
const startLearning = async () => {
  try {
    // تسجيل الدخول
    const authResult = await api.auth.login('student@example.com', 'password');
    api.setToken(authResult.data.token);

    // بدء quiz
    const quizSession = await api.quiz.start('LESSON_ID', 10);

    // الحصول على نصائح
    const tips = await api.educational.getTips('LESSON_ID');

    console.log('Ready to learn!', { quizSession, tips });
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## 📝 ملاحظات مهمة

1. **المصادقة مطلوبة** لمعظم الـ endpoints - تأكد من إرسال token في headers
2. **معدلات الطلبات محدودة** - 100 طلب/15 دقيقة للـ API العادي، 10 طلبات/دقيقة للـ AI
3. **WebSocket يدعم reconnection** تلقائياً - استخدم socket.io-client
4. **الصوت يُحفظ تلقائياً** في `/audio` ويمكن الوصول إليه مباشرة
5. **Cache يحسن الأداء بشكل كبير** - استفد من الـ endpoints المُحسنة
6. **المحتوى المثرى متاح** لجميع الدروس المنشورة
7. **التقارير للآباء** تُولد تلقائياً بعد كل quiz

---

## 🚀 البداية السريعة

```bash
# 1. تأكد من تشغيل Backend
npm run dev # على port 3001

# 2. في مشروع Frontend
npm install axios socket.io-client

# 3. إنشاء ملف config
// config.js
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
export const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';

# 4. البدء في التطوير!
```

---

## 📞 الدعم

للأسئلة والاستفسارات:
- راجع الـ Postman Collection المرفقة
- اختبر مع `test-enriched-system.js`
- راجع logs الـ backend للـ debugging

تم إعداد هذا الدليل بواسطة فريق Backend - آخر تحديث: ${new Date().toLocaleDateString('ar-EG')}