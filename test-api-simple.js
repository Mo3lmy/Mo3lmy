// test-api-simple.js
const http = require('http');

// بيانات التسجيل
const registerData = JSON.stringify({
  email: `test-${Date.now()}@example.com`,
  password: 'Test@1234',
  firstName: 'محمد',
  lastName: 'أحمد',
  grade: 6
});

// خيارات الطلب
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(registerData)
  }
};

// إرسال الطلب
const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    
    try {
      const parsed = JSON.parse(data);
      if (parsed.success) {
        console.log('✅ التسجيل نجح!');
        console.log('Token:', parsed.data?.token?.substring(0, 30) + '...');
      } else {
        console.log('❌ فشل التسجيل:', parsed.error);
      }
    } catch (e) {
      console.log('❌ خطأ في parsing:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ خطأ في الاتصال:', e.message);
});

// إرسال البيانات
req.write(registerData);
req.end();