// test-content.js
const API_URL = 'http://localhost:3000/api/v1';

async function testContent() {
  // احصل على token
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `test-${Date.now()}@test.com`,
      password: 'Test@1234',
      firstName: 'اختبار',
      lastName: 'المحتوى',
      grade: 6
    })
  });
  
  const { data } = await res.json();
  const token = data.token;
  
  // اختبر أسئلة مختلفة
  const questions = [
    "اشرح الضرب",
    "ما هي الكسور",
    "اعطني امثلة على الجمع",
    "كيف احسب مساحة المثلث",
    "اشرح درس الأعداد"
  ];
  
  for (const q of questions) {
    const askRes = await fetch(`${API_URL}/curriculum/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question: q })
    });
    
    const result = await askRes.json();
    console.log(`\n❓ السؤال: ${q}`);
    console.log(`✅ الإجابة: ${result.data?.answer?.substring(0, 100)}...`);
  }
}

testContent();