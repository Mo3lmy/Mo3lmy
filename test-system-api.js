const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4ZWY4ZjZhYS1hNWRkLTQwNmUtOWQyYy1hYWM4M2Y5OGZmMzkiLCJlbWFpbCI6InF1aXp0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6IlNUVURFTlQiLCJncmFkZSI6MTAsImlhdCI6MTc1ODkxODYzOSwiZXhwIjoxNzU5NTIzNDM5fQ.XlhmgK3uCPxijf-DosrwPBwtwX5M3QT16DGhJepRHn8';

async function testSystem() {
  const api = axios.create({
    baseURL: API_URL,
    headers: {
      'Authorization': `Bearer ${TEST_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  console.log('\n========== اختبار شامل للنظام ==========\n');

  try {
    // 1. جلب الدروس
    console.log('1. جلب قائمة الدروس...');
    const lessonsResponse = await api.get('/lessons');
    const lessons = lessonsResponse.data.data?.lessons || lessonsResponse.data.lessons || [];
    console.log(`   ✅ تم العثور على ${lessons.length} درس`);

    if (lessons.length === 0) {
      console.log('   ⚠️ لا توجد دروس في قاعدة البيانات');
      return;
    }

    const lesson = lessons[0];
    console.log(`   📚 اختبار مع الدرس: ${lesson.titleAr || lesson.title} (ID: ${lesson.id})`);

    // 2. جلب الشرائح
    console.log('\n2. جلب شرائح الدرس...');
    const slidesResponse = await api.get(`/lessons/${lesson.id}/slides?theme=default`);
    const slidesData = slidesResponse.data.data || slidesResponse.data;
    const slides = slidesData.slides || [];
    console.log(`   ✅ تم توليد ${slides.length} شريحة`);

    if (slides.length > 0) {
      console.log('   محتوى الشرائح:');
      slides.slice(0, 5).forEach((slide, i) => {
        console.log(`     - شريحة ${i + 1}: ${slide.title || slide.type || 'بدون عنوان'}`);
        if (slide.content) {
          console.log(`       المحتوى: ${slide.content.substring(0, 50)}...`);
        }
      });
    }

    // 3. اختبار توليد النص التعليمي
    console.log('\n3. اختبار توليد النص التعليمي...');
    try {
      const teachingResponse = await api.post(`/lessons/${lesson.id}/teaching/script`, {
        slideContent: {
          title: slides[0]?.title || 'عنوان تجريبي',
          content: slides[0]?.content || 'محتوى تجريبي',
          type: 'content'
        },
        generateVoice: false
      });

      const scriptData = teachingResponse.data.data || teachingResponse.data;
      if (scriptData.script) {
        console.log(`   ✅ تم توليد نص تعليمي (${scriptData.script.length} حرف)`);
        console.log(`   النص: ${scriptData.script.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`   ❌ فشل توليد النص التعليمي: ${error.response?.data?.message || error.message}`);
    }

    // 4. اختبار الشات مع سياق الدرس
    console.log('\n4. اختبار الشات بسياق الدرس...');
    try {
      const chatResponse = await api.post('/chat/message', {
        message: 'ما هو موضوع هذا الدرس؟',
        context: {
          lessonId: lesson.id,
          lessonTitle: lesson.titleAr || lesson.title,
          grade: 10,
          language: 'ar'
        }
      });

      const chatData = chatResponse.data.data || chatResponse.data;
      console.log(`   ✅ رد الشات: ${chatData.response?.substring(0, 150) || 'لا يوجد رد'}...`);

      if (chatData.sessionId) {
        console.log(`   📝 Session ID: ${chatData.sessionId}`);
      }
    } catch (error) {
      console.log(`   ❌ فشل الشات: ${error.response?.data?.message || error.message}`);
    }

    // 5. اختبار محتوى الدرس الفعلي
    console.log('\n5. فحص محتوى الدرس من قاعدة البيانات...');
    const lessonDetailResponse = await api.get(`/lessons/${lesson.id}`);
    const lessonDetail = lessonDetailResponse.data.data || lessonDetailResponse.data;

    if (lessonDetail.content) {
      console.log(`   ✅ محتوى الدرس موجود`);
      if (lessonDetail.content.summary) {
        console.log(`   الملخص: ${lessonDetail.content.summary.substring(0, 100)}...`);
      }
      if (lessonDetail.content.keyPoints && lessonDetail.content.keyPoints.length > 0) {
        console.log(`   النقاط الرئيسية: ${lessonDetail.content.keyPoints.length} نقطة`);
      }
    } else {
      console.log(`   ⚠️ لا يوجد محتوى مفصل للدرس`);
    }

    console.log('\n========== انتهى الاختبار بنجاح ==========\n');

  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('   ⚠️ التوكن منتهي الصلاحية. يرجى تسجيل الدخول مرة أخرى');
    }
  }
}

// تشغيل الاختبار
testSystem();