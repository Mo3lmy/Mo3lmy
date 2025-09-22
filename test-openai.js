// test-openai-fixed.js
const fetch = require('node-fetch'); // تأكد من تثبيتها: npm install node-fetch@2

const API_URL = 'http://localhost:3000/api/v1';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m',
};

// Helper function for fetch with better error handling
async function safeFetch(url, options = {}) {
  try {
    console.log(`📡 Calling: ${url}`);
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    
    const text = await response.text();
    
    try {
      return { 
        ok: response.ok, 
        status: response.status,
        data: JSON.parse(text) 
      };
    } catch {
      return { 
        ok: response.ok, 
        status: response.status,
        data: text 
      };
    }
  } catch (error) {
    console.error(`❌ Fetch error: ${error.message}`);
    return { 
      ok: false, 
      error: error.message,
      status: 0,
      data: null 
    };
  }
}

async function testOpenAI() {
  console.log(`${colors.blue}${colors.bold}
╔════════════════════════════════════════════╗
║     🧪 اختبار تكامل OpenAI API            ║
╚════════════════════════════════════════════╝
${colors.reset}`);
  
  let token = '';
  let allTestsPassed = true;
  
  // 1. Test server health first
  console.log(`\n${colors.yellow}🏥 فحص صحة السيرفر...${colors.reset}`);
  const healthRes = await safeFetch('http://localhost:3000/health');
  
  if (!healthRes.ok && healthRes.status === 0) {
    console.log(`${colors.red}❌ السيرفر غير متاح على http://localhost:3000${colors.reset}`);
    console.log(`\nتأكد من:`);
    console.log(`1. السيرفر شغال: npm run dev`);
    console.log(`2. السيرفر على البورت 3000`);
    return;
  }
  
  console.log(`${colors.green}✅ السيرفر يعمل${colors.reset}`);
  
  // 2. Test registration endpoint
  console.log(`\n${colors.yellow}📝 اختبار التسجيل...${colors.reset}`);
  
  const email = `test-${Date.now()}@example.com`;
  const authData = {
    email: email,
    password: 'Test@1234',
    firstName: 'محمد',
    lastName: 'أحمد',
    grade: 6
  };
  
  console.log(`   Email: ${email}`);
  
  const authRes = await safeFetch(`${API_URL}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(authData)
  });
  
  if (!authRes.ok) {
    console.log(`${colors.red}❌ فشل التسجيل${colors.reset}`);
    console.log(`   Status: ${authRes.status}`);
    console.log(`   Response:`, authRes.data);
    
    // Try login instead
    console.log(`\n${colors.yellow}🔑 محاولة تسجيل الدخول بدلاً من التسجيل...${colors.reset}`);
    
    const loginRes = await safeFetch(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test@1234'
      })
    });
    
    if (loginRes.ok && loginRes.data?.data?.token) {
      token = loginRes.data.data.token;
      console.log(`${colors.green}✅ تم تسجيل الدخول${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ فشل تسجيل الدخول أيضاً${colors.reset}`);
      console.log(`\n${colors.yellow}📌 تحقق من:`);
      console.log(`1. قاعدة البيانات تعمل`);
      console.log(`2. الجداول موجودة: npm run db:migrate`);
      console.log(`3. البيانات الأساسية: npm run db:seed${colors.reset}`);
      return;
    }
  } else if (authRes.data?.data?.token) {
    token = authRes.data.data.token;
    console.log(`${colors.green}✅ تم التسجيل بنجاح${colors.reset}`);
  }
  
  if (!token) {
    console.log(`${colors.red}❌ لا يوجد token - لا يمكن إكمال الاختبارات${colors.reset}`);
    return;
  }
  
  // 3. Test OpenAI features
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.yellow}🤖 اختبار ميزات OpenAI...${colors.reset}`);
  
  // Test RAG
  console.log(`\n${colors.yellow}🔍 اختبار البحث RAG...${colors.reset}`);
  const searchRes = await safeFetch(`${API_URL}/curriculum/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      query: 'الأعداد الطبيعية',
      grade: 6
    })
  });
  
  if (searchRes.ok) {
    const results = searchRes.data?.data?.results || [];
    const isMock = results.some(r => 
      r.content?.includes('رسالة تجريبية') || 
      r.content?.includes('mock')
    );
    
    if (isMock) {
      console.log(`${colors.yellow}⚠️ RAG في وضع Mock${colors.reset}`);
      allTestsPassed = false;
    } else {
      console.log(`${colors.green}✅ RAG يعمل مع OpenAI${colors.reset}`);
      if (results.length > 0) {
        console.log(`   عدد النتائج: ${results.length}`);
      }
    }
  } else {
    console.log(`${colors.red}❌ فشل اختبار RAG${colors.reset}`);
    allTestsPassed = false;
  }
  
  // Test Q&A
  console.log(`\n${colors.yellow}❓ اختبار الأسئلة والأجوبة...${colors.reset}`);
  const askRes = await safeFetch(`${API_URL}/curriculum/ask`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      question: 'ما هي الأعداد الطبيعية؟'
    })
  });
  
  if (askRes.ok) {
    const answer = askRes.data?.data?.answer || '';
    const isMock = answer.includes('رسالة تجريبية') || answer.includes('mock');
    
    if (isMock) {
      console.log(`${colors.yellow}⚠️ Q&A في وضع Mock${colors.reset}`);
      allTestsPassed = false;
    } else {
      console.log(`${colors.green}✅ Q&A يعمل مع OpenAI${colors.reset}`);
      console.log(`   الإجابة: ${answer.substring(0, 100)}...`);
    }
  } else {
    console.log(`${colors.red}❌ فشل اختبار Q&A${colors.reset}`);
    allTestsPassed = false;
  }
  
  // Test Chat
  console.log(`\n${colors.yellow}💬 اختبار المحادثة...${colors.reset}`);
  const chatRes = await safeFetch(`${API_URL}/chat/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message: 'مرحباً، اشرح لي الكسور'
    })
  });
  
  if (chatRes.ok) {
    const message = chatRes.data?.data?.message || '';
    const isMock = message.includes('رسالة تجريبية') || message.includes('mock');
    
    if (isMock) {
      console.log(`${colors.yellow}⚠️ Chat في وضع Mock${colors.reset}`);
      allTestsPassed = false;
    } else {
      console.log(`${colors.green}✅ Chat يعمل مع OpenAI${colors.reset}`);
      console.log(`   الرد: ${message.substring(0, 100)}...`);
    }
  } else {
    console.log(`${colors.red}❌ فشل اختبار Chat${colors.reset}`);
    allTestsPassed = false;
  }
  
  // Final Report
  console.log(`\n${colors.blue}${colors.bold}
╔════════════════════════════════════════════╗
║              📊 نتيجة الاختبار            ║
╚════════════════════════════════════════════╝${colors.reset}`);
  
  if (allTestsPassed && token) {
    console.log(`${colors.green}${colors.bold}
    ✨ ممتاز! OpenAI API يعمل بشكل كامل
    النظام جاهز للاستخدام الحقيقي
    ${colors.reset}`);
  } else {
    console.log(`${colors.yellow}
    ⚠️ بعض الميزات تعمل في وضع Mock
    
    تأكد من:
    1. وضع OPENAI_API_KEY في .env
    2. إعادة تشغيل السيرفر
    3. التأكد من وجود رصيد في OpenAI
    4. التأكد من تشغيل: npm run db:seed
    ${colors.reset}`);
  }
}

// Main execution
async function main() {
  try {
    await testOpenAI();
  } catch (error) {
    console.error(`${colors.red}خطأ غير متوقع: ${error.message}${colors.reset}`);
  }
  process.exit(0);
}

// Run
main();