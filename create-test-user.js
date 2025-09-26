// create-test-user.js
// إنشاء مستخدم اختبار للنظام

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api/v1';

async function createTestUser() {
  console.log('🚀 إنشاء مستخدم اختبار...\n');

  try {
    // محاولة إنشاء مستخدم جديد
    const userData = {
      email: 'quiztest@example.com',
      password: 'QuizTest123',
      firstName: 'Quiz',
      lastName: 'Test',
      role: 'STUDENT',
      grade: 10
    };

    console.log('📝 بيانات المستخدم:');
    console.log('   البريد:', userData.email);
    console.log('   كلمة المرور:', userData.password);
    console.log('   الدور:', userData.role);
    console.log('   الصف:', userData.grade);

    try {
      // محاولة التسجيل
      const registerResponse = await axios.post(`${API_BASE}/auth/register`, userData);
      console.log('\n✅ تم إنشاء المستخدم بنجاح!');
      console.log('Token:', registerResponse.data.data.accessToken);
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('\n⚠️  المستخدم موجود بالفعل');
        console.log('يمكنك استخدام البيانات التالية لتسجيل الدخول:');
        console.log('   البريد:', userData.email);
        console.log('   كلمة المرور:', userData.password);
      } else {
        throw error;
      }
    }

    // محاولة تسجيل الدخول للتأكد
    console.log('\n📝 اختبار تسجيل الدخول...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: userData.email,
      password: userData.password
    });

    console.log('✅ تسجيل الدخول نجح!');
    console.log('Token:', loginResponse.data.data.accessToken);

  } catch (error) {
    console.error('\n❌ خطأ:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('التفاصيل:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

createTestUser().then(() => {
  console.log('\n✅ انتهى الإعداد');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ فشل الإعداد:', error);
  process.exit(1);
});