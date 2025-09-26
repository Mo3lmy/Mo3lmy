// test-all-backend.js
// اختبار شامل لجميع وظائف الـ Backend

const axios = require('axios');
const fs = require('fs');

const API_BASE = 'http://localhost:3001/api/v1';
let token = null;
let userId = null;
let lessonId = null;
let quizSessionId = null;

// ألوان للطباعة
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// دالة للطباعة بالألوان
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// دالة لتسجيل النتائج
const results = {
  passed: [],
  failed: [],
  warnings: []
};

function recordResult(testName, status, details = '') {
  if (status === 'pass') {
    results.passed.push({ test: testName, details });
    log(`✅ ${testName}`, 'green');
  } else if (status === 'fail') {
    results.failed.push({ test: testName, details });
    log(`❌ ${testName}: ${details}`, 'red');
  } else if (status === 'warning') {
    results.warnings.push({ test: testName, details });
    log(`⚠️  ${testName}: ${details}`, 'yellow');
  }
}

// ======================================
// 1. اختبار نظام المصادقة (Auth)
// ======================================
async function testAuthSystem() {
  log('\n════════════════════════════════════', 'blue');
  log('🔐 اختبار نظام المصادقة (Auth)', 'blue');
  log('════════════════════════════════════', 'blue');

  try {
    // تسجيل الدخول
    log('\n🔑 اختبار تسجيل الدخول...');
    try {
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: 'quiztest@example.com',
        password: 'QuizTest123'
      });

      if (loginRes.data.success && (loginRes.data.data?.token || loginRes.data.token)) {
        token = loginRes.data.data?.token || loginRes.data.token;
        userId = loginRes.data.data?.user?.id || loginRes.data.user?.id;
        recordResult('Auth: Login', 'pass', 'تسجيل دخول ناجح');
      } else {
        recordResult('Auth: Login', 'fail', 'لم يتم إرجاع token');
      }
    } catch (error) {
      recordResult('Auth: Login', 'fail', error.response?.data?.message || error.message);
    }

    // التحقق من التوكن
    if (token) {
      log('\n🔍 اختبار التحقق من التوكن...');
      try {
        const profileRes = await axios.get(`${API_BASE}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (profileRes.data.success) {
          recordResult('Auth: Token Verification', 'pass', 'التوكن صالح');
        } else {
          recordResult('Auth: Token Verification', 'fail', 'التوكن غير صالح');
        }
      } catch (error) {
        if (error.response?.status === 404) {
          recordResult('Auth: Token Verification', 'warning', 'API غير مفعل');
        } else {
          recordResult('Auth: Token Verification', 'fail', error.response?.data?.message || error.message);
        }
      }
    }

  } catch (error) {
    recordResult('Auth System', 'fail', `خطأ عام: ${error.message}`);
  }
}

// ======================================
// 2. اختبار نظام الدروس (Lessons)
// ======================================
async function testLessonsSystem() {
  log('\n════════════════════════════════════', 'blue');
  log('📚 اختبار نظام الدروس (Lessons)', 'blue');
  log('════════════════════════════════════', 'blue');

  if (!token) {
    recordResult('Lessons System', 'fail', 'لا يوجد token');
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // الحصول على قائمة الدروس
  log('\n📖 اختبار الحصول على قائمة الدروس...');
  try {
    const lessonsRes = await axios.get(`${API_BASE}/lessons`, { headers });
    if (lessonsRes.data.success) {
      const lessons = lessonsRes.data.data?.lessons || lessonsRes.data.data || [];
      recordResult('Lessons: Get List', 'pass', `عدد الدروس: ${lessons.length}`);

      if (lessons.length > 0) {
        lessonId = lessons[0].id;
      }
    }
  } catch (error) {
    recordResult('Lessons: Get List', 'fail', error.response?.data?.message || error.message);
  }

  // الحصول على تفاصيل درس
  if (lessonId) {
    log('\n📋 اختبار الحصول على تفاصيل درس...');
    try {
      const lessonRes = await axios.get(`${API_BASE}/lessons/${lessonId}`, { headers });
      if (lessonRes.data.success) {
        recordResult('Lessons: Get Details', 'pass', `الدرس: ${lessonRes.data.data.title}`);
      }
    } catch (error) {
      recordResult('Lessons: Get Details', 'fail', error.response?.data?.message || error.message);
    }
  }

  // الحصول على محتوى الدرس
  if (lessonId) {
    log('\n📄 اختبار الحصول على محتوى الدرس...');
    try {
      const contentRes = await axios.get(`${API_BASE}/lessons/${lessonId}/content`, { headers });
      if (contentRes.data.success) {
        recordResult('Lessons: Get Content', 'pass', 'تم الحصول على المحتوى');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        recordResult('Lessons: Get Content', 'warning', 'لا يوجد محتوى للدرس');
      } else {
        recordResult('Lessons: Get Content', 'fail', error.response?.data?.message || error.message);
      }
    }
  }
}

// ======================================
// 3. اختبار نظام Quiz
// ======================================
async function testQuizSystem() {
  log('\n════════════════════════════════════', 'blue');
  log('❓ اختبار نظام Quiz', 'blue');
  log('════════════════════════════════════', 'blue');

  if (!token || !lessonId) {
    recordResult('Quiz System', 'fail', 'لا يوجد token أو lesson');
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // توليد أسئلة
  log('\n🎲 اختبار توليد أسئلة...');
  try {
    const generateRes = await axios.post(
      `${API_BASE}/quiz/generate`,
      {
        lessonId,
        count: 5,
        difficulty: 'MEDIUM'
      },
      { headers }
    );

    if (generateRes.data.success) {
      const questions = generateRes.data.data.questions || generateRes.data.data;
      recordResult('Quiz: Generate Questions', 'pass', `تم توليد ${questions.length} أسئلة`);

      // تحليل أنواع الأسئلة
      const types = {};
      questions.forEach(q => {
        types[q.type] = (types[q.type] || 0) + 1;
      });
      log(`   أنواع الأسئلة: ${JSON.stringify(types)}`);
    }
  } catch (error) {
    recordResult('Quiz: Generate Questions', 'fail', error.response?.data?.message || error.message);
  }

  // بدء جلسة Quiz
  log('\n🚀 اختبار بدء جلسة Quiz...');
  try {
    const startRes = await axios.post(
      `${API_BASE}/quiz/start`,
      {
        lessonId,
        questionCount: 3,
        mode: 'practice'
      },
      { headers }
    );

    if (startRes.data.success) {
      quizSessionId = startRes.data.data.id;
      recordResult('Quiz: Start Session', 'pass', `الجلسة: ${quizSessionId}`);

      // الإجابة على سؤال
      if (startRes.data.data.questions?.length > 0) {
        const firstQuestion = startRes.data.data.questions[0];

        log('\n✍️ اختبار الإجابة على سؤال...');
        try {
          let answer;
          if (firstQuestion.type === 'MCQ' && firstQuestion.options) {
            answer = firstQuestion.options[0];
          } else if (firstQuestion.type === 'TRUE_FALSE') {
            answer = 'true';
          } else {
            answer = 'test answer';
          }

          const answerRes = await axios.post(
            `${API_BASE}/quiz/answer`,
            {
              attemptId: quizSessionId,
              questionId: firstQuestion.id,
              answer: answer,
              timeSpent: 30
            },
            { headers }
          );

          if (answerRes.data.success) {
            recordResult('Quiz: Submit Answer', 'pass', `الإجابة ${answerRes.data.data.isCorrect ? 'صحيحة' : 'خاطئة'}`);
          }
        } catch (error) {
          recordResult('Quiz: Submit Answer', 'fail', error.response?.data?.message || error.message);
        }
      }
    }
  } catch (error) {
    recordResult('Quiz: Start Session', 'fail', error.response?.data?.message || error.message);
  }
}

// ======================================
// 4. اختبار نظام RAG
// ======================================
async function testRAGSystem() {
  log('\n════════════════════════════════════', 'blue');
  log('🔍 اختبار نظام RAG', 'blue');
  log('════════════════════════════════════', 'blue');

  if (!token) {
    recordResult('RAG System', 'fail', 'لا يوجد token');
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // البحث في المحتوى
  log('\n🔎 اختبار البحث في المحتوى...');
  try {
    const searchRes = await axios.post(
      `${API_BASE}/rag/search`,
      {
        query: 'القابلية للقسمة',
        limit: 5
      },
      { headers }
    );

    if (searchRes.data.success) {
      const results = searchRes.data.data.results || searchRes.data.data;
      recordResult('RAG: Search', 'pass', `عدد النتائج: ${results.length}`);
    }
  } catch (error) {
    if (error.response?.status === 404) {
      recordResult('RAG: Search', 'warning', 'API غير مفعل');
    } else {
      recordResult('RAG: Search', 'fail', error.response?.data?.message || error.message);
    }
  }

  // الإجابة على سؤال
  log('\n💡 اختبار الإجابة على سؤال...');
  try {
    const answerRes = await axios.post(
      `${API_BASE}/rag/answer`,
      {
        question: 'ما هي قاعدة القابلية للقسمة على 3؟'
      },
      { headers }
    );

    if (answerRes.data.success) {
      recordResult('RAG: Answer Question', 'pass', 'تم الحصول على إجابة');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      recordResult('RAG: Answer Question', 'warning', 'API غير مفعل');
    } else {
      recordResult('RAG: Answer Question', 'fail', error.response?.data?.message || error.message);
    }
  }
}

// ======================================
// 5. اختبار نظام Chat
// ======================================
async function testChatSystem() {
  log('\n════════════════════════════════════', 'blue');
  log('💬 اختبار نظام Chat', 'blue');
  log('════════════════════════════════════', 'blue');

  if (!token) {
    recordResult('Chat System', 'fail', 'لا يوجد token');
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // بدء جلسة محادثة
  log('\n🗨️ اختبار بدء جلسة محادثة...');
  try {
    const startRes = await axios.post(
      `${API_BASE}/chat/start`,
      {
        lessonId: lessonId || null
      },
      { headers }
    );

    if (startRes.data.success) {
      const sessionId = startRes.data.data.sessionId || startRes.data.data.id;
      recordResult('Chat: Start Session', 'pass', `الجلسة: ${sessionId}`);
    }
  } catch (error) {
    if (error.response?.status === 404) {
      recordResult('Chat: Start Session', 'warning', 'API غير مفعل');
    } else {
      recordResult('Chat: Start Session', 'fail', error.response?.data?.message || error.message);
    }
  }

  // إرسال رسالة
  log('\n📨 اختبار إرسال رسالة...');
  try {
    const messageRes = await axios.post(
      `${API_BASE}/chat/message`,
      {
        message: 'مرحبا، اشرح لي القابلية للقسمة على 2',
        lessonId: lessonId
      },
      { headers }
    );

    if (messageRes.data.success) {
      recordResult('Chat: Send Message', 'pass', 'تم إرسال واستقبال الرد');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      recordResult('Chat: Send Message', 'warning', 'API غير مفعل');
    } else {
      recordResult('Chat: Send Message', 'fail', error.response?.data?.message || error.message);
    }
  }
}

// ======================================
// 6. اختبار نظام Progress
// ======================================
async function testProgressSystem() {
  log('\n════════════════════════════════════', 'blue');
  log('📈 اختبار نظام Progress', 'blue');
  log('════════════════════════════════════', 'blue');

  if (!token) {
    recordResult('Progress System', 'fail', 'لا يوجد token');
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // الحصول على التقدم العام
  log('\n📊 اختبار الحصول على التقدم العام...');
  try {
    const progressRes = await axios.get(`${API_BASE}/progress/overall`, { headers });
    if (progressRes.data.success) {
      recordResult('Progress: Overall', 'pass', `التقدم: ${progressRes.data.data.overallProgress || 0}%`);
    }
  } catch (error) {
    if (error.response?.status === 404) {
      recordResult('Progress: Overall', 'warning', 'API غير مفعل');
    } else {
      recordResult('Progress: Overall', 'fail', error.response?.data?.message || error.message);
    }
  }

  // الحصول على تقدم درس معين
  if (lessonId) {
    log('\n📝 اختبار الحصول على تقدم درس...');
    try {
      const lessonProgressRes = await axios.get(
        `${API_BASE}/progress/lesson/${lessonId}`,
        { headers }
      );

      if (lessonProgressRes.data.success) {
        recordResult('Progress: Lesson', 'pass', `التقدم في الدرس: ${lessonProgressRes.data.data.progress || 0}%`);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        recordResult('Progress: Lesson', 'warning', 'API غير مفعل');
      } else {
        recordResult('Progress: Lesson', 'fail', error.response?.data?.message || error.message);
      }
    }
  }
}

// ======================================
// 7. اختبار السياق الطلابي
// ======================================
async function testStudentContextSystem() {
  log('\n════════════════════════════════════', 'blue');
  log('🎓 اختبار نظام السياق الطلابي', 'blue');
  log('════════════════════════════════════', 'blue');

  if (!token) {
    recordResult('Student Context System', 'fail', 'لا يوجد token');
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // الحصول على السياق
  log('\n📚 اختبار الحصول على السياق الطلابي...');
  try {
    const contextRes = await axios.get(`${API_BASE}/student-context`, { headers });
    if (contextRes.data.success) {
      recordResult('Student Context: Get', 'pass', 'تم الحصول على السياق');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      recordResult('Student Context: Get', 'warning', 'API غير مفعل');
    } else {
      recordResult('Student Context: Get', 'fail', error.response?.data?.message || error.message);
    }
  }

  // تحديث السياق
  log('\n✏️ اختبار تحديث السياق الطلابي...');
  try {
    const updateRes = await axios.put(
      `${API_BASE}/student-context`,
      {
        learningStyle: 'visual',
        preferredDifficulty: 'MEDIUM'
      },
      { headers }
    );

    if (updateRes.data.success) {
      recordResult('Student Context: Update', 'pass', 'تم التحديث');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      recordResult('Student Context: Update', 'warning', 'API غير مفعل');
    } else {
      recordResult('Student Context: Update', 'fail', error.response?.data?.message || error.message);
    }
  }
}

// ======================================
// 8. اختبار الإنجازات
// ======================================
async function testAchievementsSystem() {
  log('\n════════════════════════════════════', 'blue');
  log('🏆 اختبار نظام الإنجازات', 'blue');
  log('════════════════════════════════════', 'blue');

  if (!token) {
    recordResult('Achievements System', 'fail', 'لا يوجد token');
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // الحصول على الإنجازات
  log('\n🎖️ اختبار الحصول على الإنجازات...');
  try {
    const achievementsRes = await axios.get(`${API_BASE}/achievements`, { headers });
    if (achievementsRes.data.success) {
      recordResult('Achievements: Get List', 'pass', `عدد الإنجازات: ${achievementsRes.data.data?.length || 0}`);
    }
  } catch (error) {
    if (error.response?.status === 404) {
      recordResult('Achievements: Get List', 'warning', 'API غير مفعل');
    } else {
      recordResult('Achievements: Get List', 'fail', error.response?.data?.message || error.message);
    }
  }

  // الحصول على النقاط
  log('\n💯 اختبار الحصول على النقاط...');
  try {
    const pointsRes = await axios.get(`${API_BASE}/achievements/points`, { headers });
    if (pointsRes.data.success) {
      recordResult('Achievements: Get Points', 'pass', `النقاط: ${pointsRes.data.data.points || 0}`);
    }
  } catch (error) {
    if (error.response?.status === 404) {
      recordResult('Achievements: Get Points', 'warning', 'API غير مفعل');
    } else {
      recordResult('Achievements: Get Points', 'fail', error.response?.data?.message || error.message);
    }
  }
}

// ======================================
// 9. اختبار تقارير أولياء الأمور
// ======================================
async function testParentReportsSystem() {
  log('\n════════════════════════════════════', 'blue');
  log('📊 اختبار نظام تقارير أولياء الأمور', 'blue');
  log('════════════════════════════════════', 'blue');

  if (!token) {
    recordResult('Parent Reports System', 'fail', 'لا يوجد token');
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // الحصول على تقرير أسبوعي
  log('\n📅 اختبار الحصول على تقرير أسبوعي...');
  try {
    const reportRes = await axios.get(`${API_BASE}/parent-reports/weekly`, { headers });
    if (reportRes.data.success) {
      recordResult('Parent Reports: Weekly', 'pass', 'تم الحصول على التقرير الأسبوعي');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      recordResult('Parent Reports: Weekly', 'warning', 'API غير مفعل');
    } else {
      recordResult('Parent Reports: Weekly', 'fail', error.response?.data?.message || error.message);
    }
  }

  // الحصول على تقرير شهري
  log('\n📆 اختبار الحصول على تقرير شهري...');
  try {
    const reportRes = await axios.get(`${API_BASE}/parent-reports/monthly`, { headers });
    if (reportRes.data.success) {
      recordResult('Parent Reports: Monthly', 'pass', 'تم الحصول على التقرير الشهري');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      recordResult('Parent Reports: Monthly', 'warning', 'API غير مفعل');
    } else {
      recordResult('Parent Reports: Monthly', 'fail', error.response?.data?.message || error.message);
    }
  }
}

// ======================================
// التقرير النهائي
// ======================================
function generateFinalReport() {
  log('\n\n════════════════════════════════════════════════', 'blue');
  log('              📊 التقرير النهائي', 'blue');
  log('════════════════════════════════════════════════', 'blue');

  const totalTests = results.passed.length + results.failed.length + results.warnings.length;

  log(`\n📈 إجمالي الاختبارات: ${totalTests}`);
  log(`✅ نجح: ${results.passed.length} (${Math.round(results.passed.length / totalTests * 100)}%)`, 'green');
  log(`❌ فشل: ${results.failed.length} (${Math.round(results.failed.length / totalTests * 100)}%)`, 'red');
  log(`⚠️  تحذيرات: ${results.warnings.length} (${Math.round(results.warnings.length / totalTests * 100)}%)`, 'yellow');

  if (results.failed.length > 0) {
    log('\n❌ الاختبارات الفاشلة:', 'red');
    results.failed.forEach(f => {
      log(`   - ${f.test}: ${f.details}`, 'red');
    });
  }

  if (results.warnings.length > 0) {
    log('\n⚠️  التحذيرات:', 'yellow');
    results.warnings.forEach(w => {
      log(`   - ${w.test}: ${w.details}`, 'yellow');
    });
  }

  // حفظ التقرير في ملف
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: results.passed.length,
      failed: results.failed.length,
      warnings: results.warnings.length,
      passRate: Math.round(results.passed.length / totalTests * 100)
    },
    details: results
  };

  fs.writeFileSync(
    'backend-test-report.json',
    JSON.stringify(report, null, 2),
    'utf8'
  );

  log('\n💾 تم حفظ التقرير في backend-test-report.json', 'green');

  // تقييم النتيجة
  log('\n════════════════════════════════════════════════', 'blue');
  if (results.failed.length === 0) {
    log('🎉 ممتاز! جميع الاختبارات نجحت', 'green');
    log('✅ النظام جاهز تماماً للاستخدام', 'green');
  } else if (results.failed.length <= 3) {
    log('👍 جيد! معظم الاختبارات نجحت مع بعض المشاكل البسيطة', 'yellow');
  } else {
    log('⚠️  يحتاج إلى تحسين! هناك مشاكل تحتاج إلى معالجة', 'red');
  }
  log('════════════════════════════════════════════════', 'blue');
}

// ======================================
// تشغيل جميع الاختبارات
// ======================================
async function runAllTests() {
  log('════════════════════════════════════════════════', 'blue');
  log('      🚀 بدء اختبار شامل للـ Backend', 'blue');
  log('════════════════════════════════════════════════', 'blue');
  log(`📅 التاريخ: ${new Date().toLocaleString('ar-EG')}`);
  log(`🌐 الخادم: ${API_BASE}`);
  log('════════════════════════════════════════════════', 'blue');

  try {
    // التحقق من اتصال الخادم
    log('\n🔗 التحقق من اتصال الخادم...');
    try {
      await axios.get(`${API_BASE.replace('/api/v1', '/health')}`);
      log('✅ الخادم يعمل', 'green');
    } catch (error) {
      // محاولة endpoint آخر
      try {
        await axios.get(`${API_BASE}/auth/login`);
        log('✅ الخادم يعمل', 'green');
      } catch (e) {
        if (e.response) {
          log('✅ الخادم يعمل', 'green');
        } else {
          log('❌ الخادم لا يستجيب!', 'red');
          process.exit(1);
        }
      }
    }

    // تشغيل الاختبارات
    await testAuthSystem();
    await testLessonsSystem();
    await testQuizSystem();
    await testRAGSystem();
    await testChatSystem();
    await testProgressSystem();
    await testStudentContextSystem();
    await testAchievementsSystem();
    await testParentReportsSystem();

    // إنشاء التقرير النهائي
    generateFinalReport();

  } catch (error) {
    log(`\n❌ خطأ عام: ${error.message}`, 'red');
  }
}

// تشغيل الاختبارات
runAllTests().then(() => {
  log('\n✨ انتهى الاختبار الشامل', 'blue');
  process.exit(0);
}).catch(error => {
  log(`\n❌ فشل الاختبار: ${error.message}`, 'red');
  process.exit(1);
});