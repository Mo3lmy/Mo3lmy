// test-quiz-generation.js
// اختبار نظام توليد الأسئلة مع PROBLEM type

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api/v1';

// بيانات تسجيل دخول مؤقتة
const testUser = {
  email: 'quiztest@example.com',
  password: 'QuizTest123'
};

async function testQuizGeneration() {
  console.log('🚀 بدء اختبار نظام Quiz Generation مع PROBLEM type...\n');

  try {
    // 1. تسجيل الدخول
    console.log('1. تسجيل الدخول...');

    // الانتظار قليلاً لتجنب حد المحاولات
    await new Promise(resolve => setTimeout(resolve, 2000));

    const loginResponse = await axios.post(`${API_BASE}/auth/login`, testUser);
    const token = loginResponse.data.data?.token || loginResponse.data.token || loginResponse.data.accessToken;

    if (!token) {
      console.error('❌ لم يتم الحصول على التوكن');
      console.error('الاستجابة:', JSON.stringify(loginResponse.data, null, 2));
      return;
    }

    console.log('✅ تم تسجيل الدخول بنجاح');

    const headers = { Authorization: `Bearer ${token}` };

    // 2. الحصول على دروس متاحة
    console.log('\n2. البحث عن دروس متاحة...');
    const lessonsResponse = await axios.get(`${API_BASE}/lessons?limit=1`, { headers });

    const lessons = lessonsResponse.data.data?.lessons || lessonsResponse.data.data || [];

    if (!lessons || lessons.length === 0) {
      console.log('❌ لا توجد دروس متاحة. يرجى إنشاء دروس أولاً.');
      return;
    }

    const lesson = lessons[0];
    const lessonId = lesson.id;
    console.log(`✅ تم العثور على درس: ${lesson.title || lesson.titleAr || 'بدون عنوان'}`);

    // 3. توليد أسئلة مع أنواع مختلفة بما فيها PROBLEM
    console.log('\n3. توليد أسئلة متنوعة (تتضمن PROBLEM)...');
    const quizResponse = await axios.post(
      `${API_BASE}/quiz/generate`,
      {
        lessonId,
        count: 10, // طلب 10 أسئلة متنوعة
        difficulty: 'MEDIUM'
      },
      { headers }
    );

    // 4. تحليل الأسئلة المولدة
    console.log('\n✅ تم توليد الأسئلة بنجاح!');
    console.log('=====================================\n');

    const questions = quizResponse.data.data.questions || quizResponse.data.data;

    // إحصائيات الأنواع
    const typeStats = {};
    questions.forEach(q => {
      typeStats[q.type] = (typeStats[q.type] || 0) + 1;
    });

    console.log('📊 إحصائيات أنواع الأسئلة:');
    console.log('----------------------------');
    Object.entries(typeStats).forEach(([type, count]) => {
      const percentage = Math.round((count / questions.length) * 100);
      console.log(`${type}: ${count} سؤال (${percentage}%)`);
    });

    // عرض أمثلة من أسئلة PROBLEM
    console.log('\n📝 أمثلة من أسئلة PROBLEM:');
    console.log('----------------------------');

    const problemQuestions = questions.filter(q => q.type === 'PROBLEM');

    if (problemQuestions.length > 0) {
      console.log(`✅ تم العثور على ${problemQuestions.length} أسئلة من نوع PROBLEM\n`);

      problemQuestions.slice(0, 3).forEach((q, index) => {
        console.log(`\nمسألة ${index + 1}:`);
        console.log(`السؤال: ${q.question}`);
        console.log(`الصعوبة: ${q.difficulty}`);
        console.log(`النقاط: ${q.points}`);
        if (q.hint) console.log(`التلميح: ${q.hint}`);
        if (q.requiresSteps) console.log(`تتطلب خطوات: نعم`);
        if (q.timeLimit) console.log(`الوقت المحدد: ${q.timeLimit} ثانية`);
        console.log('---');
      });
    } else {
      console.log('⚠️  لم يتم العثور على أسئلة من نوع PROBLEM');
      console.log('قد يكون السبب:');
      console.log('- المحتوى لا يحتوي على مسائل');
      console.log('- نسبة PROBLEM في التوزيع قليلة');
    }

    // 5. اختبار بدء جلسة Quiz
    console.log('\n5. اختبار بدء جلسة Quiz...');
    const sessionResponse = await axios.post(
      `${API_BASE}/quiz/start`,
      {
        lessonId,
        questionCount: 5,
        mode: 'practice'
      },
      { headers }
    );

    const session = sessionResponse.data.data;
    console.log(`✅ تم بدء جلسة Quiz: ${session.id}`);

    // التحقق من وجود أسئلة PROBLEM في الجلسة
    const sessionProblemQuestions = session.questions.filter(q => q.type === 'PROBLEM');
    if (sessionProblemQuestions.length > 0) {
      console.log(`✅ الجلسة تحتوي على ${sessionProblemQuestions.length} أسئلة PROBLEM`);
    }

    // 6. اختبار الإجابة على سؤال PROBLEM
    if (sessionProblemQuestions.length > 0) {
      console.log('\n6. اختبار الإجابة على سؤال PROBLEM...');
      const problemQ = sessionProblemQuestions[0];

      // محاولة إجابة رقمية
      const answer = '15'; // إجابة تجريبية

      try {
        const answerResponse = await axios.post(
          `${API_BASE}/quiz/answer`,
          {
            attemptId: session.id,
            questionId: problemQ.id,
            answer: answer,
            timeSpent: 45
          },
          { headers }
        );

        const result = answerResponse.data.data;
        console.log(`✅ تم تقييم الإجابة:`);
        console.log(`   - صحيحة: ${result.isCorrect ? 'نعم ✅' : 'لا ❌'}`);
        console.log(`   - النقاط: ${result.pointsEarned}`);
        if (result.hint) console.log(`   - تلميح: ${result.hint}`);
        if (result.encouragement) console.log(`   - تشجيع: ${result.encouragement}`);

      } catch (error) {
        console.log('❌ خطأ في تقييم الإجابة:', error.response?.data?.message || error.message);
      }
    }

    console.log('\n=====================================');
    console.log('✅ اكتمل اختبار نظام Quiz Generation!');
    console.log('=====================================\n');

    // ملخص النتائج
    console.log('📋 ملخص النتائج:');
    console.log('----------------');
    console.log(`✅ تم توليد ${questions.length} سؤال بنجاح`);
    console.log(`✅ تم العثور على ${problemQuestions.length} أسئلة PROBLEM`);
    console.log(`✅ نسبة أسئلة PROBLEM: ${Math.round((problemQuestions.length / questions.length) * 100)}%`);

    if (problemQuestions.length === 0) {
      console.log('\n⚠️  توصيات لتحسين توليد أسئلة PROBLEM:');
      console.log('1. تأكد من وجود محتوى مُثري يحتوي على تمارين');
      console.log('2. تحقق من نسبة PROBLEM في QUESTION_TYPE_MIX');
      console.log('3. تأكد من أن المحتوى يحتوي على مسائل رياضية أو علمية');
    }

  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:');
    console.error('الرسالة:', error.response?.data?.message || error.message);

    if (error.response?.status === 404) {
      console.error('تأكد من أن الخادم يعمل على http://localhost:3000');
    } else if (error.response?.status === 401) {
      console.error('مشكلة في المصادقة. تحقق من بيانات تسجيل الدخول.');
    } else if (error.response?.data) {
      console.error('تفاصيل:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// تشغيل الاختبار
console.log('========================================');
console.log('   اختبار نظام Quiz Generation        ');
console.log('   مع دعم PROBLEM type                 ');
console.log('========================================\n');

testQuizGeneration().then(() => {
  console.log('\n✅ انتهى الاختبار');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ فشل الاختبار:', error);
  process.exit(1);
});