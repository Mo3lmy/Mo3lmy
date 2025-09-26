// test-platform.js
// سكريبت اختبار شامل لمنصة التعليم الذكية

const API_URL = 'http://localhost:3001';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m'
};

let testsPassed = 0;
let testsFailed = 0;

// دالة مساعدة للطباعة الملونة
function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

// دالة لعمل HTTP request
async function makeRequest(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// اختبار واحد
async function runTest(testName, endpoint, method = 'GET', body = null, checkFunction = null) {
  process.stdout.write(`⏳ ${testName}... `);
  
  try {
    const result = await makeRequest(endpoint, method, body);
    
    // التحقق من النتيجة
    let passed = false;
    if (checkFunction) {
      passed = checkFunction(result);
    } else {
      passed = result.success === true;
    }
    
    if (passed) {
      log('✅ نجح', 'green');
      testsPassed++;
      return { passed: true, data: result };
    } else {
      log('❌ فشل', 'red');
      if (result.error) {
        log(`   السبب: ${result.error}`, 'yellow');
      }
      testsFailed++;
      return { passed: false, data: result };
    }
  } catch (error) {
    log('❌ خطأ', 'red');
    log(`   ${error.message}`, 'yellow');
    testsFailed++;
    return { passed: false, error: error.message };
  }
}

// الاختبار الرئيسي
async function runAllTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('        🧪 اختبار شامل لمنصة التعليم الذكية', 'bold');
  log('='.repeat(60) + '\n', 'blue');
  
  // ================== 1. اختبار صحة النظام ==================
  log('\n📋 القسم الأول: صحة النظام', 'bold');
  log('-'.repeat(40));
  
  await runTest(
    'فحص صحة النظام العام',
    '/api/test/health',
    'GET',
    null,
    (result) => result.status === 'healthy'
  );
  
  await runTest(
    'فحص حالة الخدمات',
    '/api/status',
    'GET',
    null,
    (result) => result.status === 'operational'
  );
  
  // ================== 2. اختبار المحتوى المثري ==================
  log('\n\n📚 القسم الثاني: المحتوى المثري', 'bold');
  log('-'.repeat(40));
  
  // اختبار الأمثلة
  const examplesTest = await runTest(
    'البحث عن أمثلة القابلية للقسمة',
    '/api/test/rag/answer',
    'POST',
    { question: 'أعطني 3 أمثلة على القابلية للقسمة' },
    (result) => result.success && result.answer && result.answer.includes('مثال')
  );
  
  if (examplesTest.passed && examplesTest.data.answer) {
    log(`   📝 الإجابة: ${examplesTest.data.answer.substring(0, 100)}...`, 'blue');
  }
  
  // اختبار التمارين
  const exercisesTest = await runTest(
    'البحث عن تمارين MCQ',
    '/api/test/rag/answer',
    'POST',
    { question: 'أعطني تمارين اختيار من متعدد عن الأعداد النسبية' },
    (result) => result.success && result.answer
  );
  
  if (exercisesTest.passed && exercisesTest.data.answer) {
    log(`   📝 الإجابة: ${exercisesTest.data.answer.substring(0, 100)}...`, 'blue');
  }
  
  // اختبار الأخطاء الشائعة
  await runTest(
    'البحث عن الأخطاء الشائعة',
    '/api/test/rag/answer',
    'POST',
    { question: 'ما هي الأخطاء الشائعة في العامل المشترك الأكبر؟' },
    (result) => result.success && result.answer
  );
  
  // اختبار التطبيقات الواقعية
  await runTest(
    'البحث عن التطبيقات الواقعية',
    '/api/test/rag/answer',
    'POST',
    { question: 'كيف أستخدم المضاعف المشترك الأصغر في الحياة اليومية؟' },
    (result) => result.success && result.answer
  );
  
  // ================== 3. اختبار توليد الأسئلة ==================
  log('\n\n❓ القسم الثالث: توليد الأسئلة', 'bold');
  log('-'.repeat(40));
  
  const quizTest = await runTest(
    'توليد 5 أسئلة عشوائية',
    '/api/test/quiz/generate',
    'POST',
    { count: 5 },
    (result) => result.success && result.questions && result.questions.length > 0
  );
  
  if (quizTest.passed && quizTest.data.questions) {
    log(`   ✅ تم توليد ${quizTest.data.questions.length} أسئلة`, 'green');
    const question = quizTest.data.questions[0];
    log(`   📝 مثال: ${question.question || question.text || 'سؤال'}`, 'blue');
  }
  
  await runTest(
    'توليد أسئلة من RAG',
    '/api/test/rag/quiz-questions',
    'POST',
    { count: 3 },
    (result) => result.success && result.questions
  );
  
  // ================== 4. اختبار الصعوبات المختلفة ==================
  log('\n\n📊 القسم الرابع: مستويات الصعوبة', 'bold');
  log('-'.repeat(40));
  
  await runTest(
    'أمثلة سهلة',
    '/api/test/rag/answer',
    'POST',
    { question: 'أعطني مثال سهل على القسمة' },
    (result) => result.success && result.answer
  );
  
  await runTest(
    'تمارين متوسطة',
    '/api/test/rag/answer',
    'POST',
    { question: 'أعطني تمرين متوسط الصعوبة في الأعداد النسبية' },
    (result) => result.success && result.answer
  );
  
  await runTest(
    'تحديات صعبة',
    '/api/test/rag/answer',
    'POST',
    { question: 'أعطني تحدي صعب في التعبيرات الجبرية' },
    (result) => result.success && result.answer
  );
  
  // ================== 5. اختبار البحث المتخصص ==================
  log('\n\n🔍 القسم الخامس: البحث المتخصص', 'bold');
  log('-'.repeat(40));
  
  await runTest(
    'البحث عن نصائح للطلاب',
    '/api/test/rag/answer',
    'POST',
    { question: 'ما هي النصائح لدراسة القابلية للقسمة؟' },
    (result) => result.success && result.answer
  );
  
  await runTest(
    'البحث عن قصص تعليمية',
    '/api/test/rag/answer',
    'POST',
    { question: 'هل يوجد قصص تعليمية عن الأعداد؟' },
    (result) => result.success && result.answer
  );
  
  // ================== 6. اختبار المساعد التعليمي ==================
  log('\n\n🤖 القسم السادس: المساعد التعليمي', 'bold');
  log('-'.repeat(40));
  
  await runTest(
    'شرح مفهوم',
    '/api/test/rag/explain-concept',
    'POST',
    { concept: 'العامل المشترك الأكبر' },
    (result) => result.success && result.explanation
  );
  
  await runTest(
    'المساعدة في الأخطاء',
    '/api/test/rag/wrong-answer',
    'POST',
    { 
      question: 'ما هو العامل المشترك الأكبر للعددين 12 و 18؟',
      wrongAnswer: '2'
    },
    (result) => result.success && result.explanation
  );
  
  // ================== النتائج النهائية ==================
  log('\n\n' + '='.repeat(60), 'blue');
  log('                📊 النتائج النهائية', 'bold');
  log('='.repeat(60), 'blue');
  
  const total = testsPassed + testsFailed;
  const percentage = total > 0 ? Math.round((testsPassed / total) * 100) : 0;
  
  log(`\n✅ اختبارات ناجحة: ${testsPassed}`, 'green');
  log(`❌ اختبارات فاشلة: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');
  log(`📊 نسبة النجاح: ${percentage}%`, percentage >= 80 ? 'green' : 'yellow');
  
  if (percentage === 100) {
    log('\n🎉 ممتاز! كل الاختبارات نجحت!', 'green');
    log('✨ النظام يعمل بكفاءة عالية', 'green');
  } else if (percentage >= 80) {
    log('\n👍 جيد جداً! معظم الاختبارات نجحت', 'green');
    log('⚠️ راجع الاختبارات الفاشلة', 'yellow');
  } else if (percentage >= 60) {
    log('\n⚠️ النظام يعمل جزئياً', 'yellow');
    log('🔧 يحتاج إلى إصلاحات', 'yellow');
  } else {
    log('\n❌ النظام يحتاج مراجعة شاملة', 'red');
    log('🔴 معظم الاختبارات فشلت', 'red');
  }
  
  // تفاصيل إضافية عند وجود مشاكل
  if (testsFailed > 0) {
    log('\n💡 نصائح للإصلاح:', 'yellow');
    log('1. تأكد من أن الخادم يعمل على المنفذ 3002', 'yellow');
    log('2. تأكد من وجود البيانات في قاعدة البيانات', 'yellow');
    log('3. تأكد من أن الـ embeddings محدثة (724 صف)', 'yellow');
    log('4. راجع الـ logs للأخطاء التفصيلية', 'yellow');
  }
  
  log('\n' + '='.repeat(60) + '\n', 'blue');
  
  // إنهاء العملية بكود مناسب
  process.exit(testsFailed > 0 ? 1 : 0);
}

// بدء الاختبارات
console.log('🚀 بدء الاختبار الشامل...\n');
console.log('📌 تأكد من أن الخادم يعمل على: http://localhost:3002');
console.log('📌 الأمر: npm run dev\n');

// انتظار ثانية قبل البدء
setTimeout(() => {
  runAllTests().catch(error => {
    log('\n❌ خطأ في تشغيل الاختبارات:', 'red');
    log(error.message, 'red');
    process.exit(1);
  });
}, 1000);