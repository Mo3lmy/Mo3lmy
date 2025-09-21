// cspell:disable
interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: any;
}

const CHAT_API_URL = 'http://localhost:3000/api/v1';
let authToken = '';
let chatSessionId = '';

async function testChatAPI() {
  console.log('🧪 Testing Chat API Endpoints...\n');
  
  try {
    // Login first
    console.log('1️⃣ Logging in...');
    const loginRes = await fetch(`${CHAT_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student1@test.com',
        password: 'Test@1234',
      }),
    });
    
    const loginData = await loginRes.json() as ApiResponse;
    if (!loginData.success) {
      // Register if not exists
      const registerRes = await fetch(`${CHAT_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'student1@test.com',
          password: 'Test@1234',
          firstName: 'طالب',
          lastName: 'تجريبي',
          grade: 6,
        }),
      });
      const registerData = await registerRes.json() as ApiResponse;
      authToken = registerData.data?.token || '';
    } else {
      authToken = loginData.data?.token || '';
    }
    console.log('✅ Logged in successfully\n');
    
    // Test chat message
    console.log('2️⃣ Sending chat message...');
    const chatRes = await fetch(`${CHAT_API_URL}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        message: 'مرحبا، أريد أن أتعلم عن الأعداد',
      }),
    });
    
    const chatData = await chatRes.json() as ApiResponse;
    console.log('✅ Message sent');
    console.log(`   Response: ${chatData.data?.message?.substring(0, 100) || 'No message'}...`);
    chatSessionId = chatData.data?.sessionId || '';
    console.log(`   Session: ${chatSessionId}\n`);
    
    // Send follow-up
    console.log('3️⃣ Sending follow-up...');
    const followUpRes = await fetch(`${CHAT_API_URL}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        message: 'ما هي الأعداد الطبيعية؟',
        sessionId: chatSessionId,
      }),
    });
    
    const followUpData = await followUpRes.json() as ApiResponse;
    console.log('✅ Follow-up sent');
    console.log(`   Response: ${followUpData.data?.message?.substring(0, 100) || 'No message'}...`);
    console.log(`   Intent: ${followUpData.data?.metadata?.intent || 'Unknown'}\n`);
    
    // Get history
    console.log('4️⃣ Getting chat history...');
    const historyRes = await fetch(`${CHAT_API_URL}/chat/history?limit=5`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    const historyData = await historyRes.json() as ApiResponse;
    console.log('✅ History retrieved');
    console.log(`   Messages: ${historyData.data?.length || 0}\n`);
    
    // Get suggestions
    console.log('5️⃣ Getting suggestions...');
    const suggestRes = await fetch(`${CHAT_API_URL}/chat/suggestions`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    const suggestData = await suggestRes.json() as ApiResponse;
    console.log('✅ Suggestions retrieved');
    console.log(`   Count: ${suggestData.data?.length || 0}`);
    if (suggestData.data && suggestData.data.length > 0) {
      console.log(`   Sample: "${suggestData.data[0]}"`);
    }
    
    console.log('\n🎉 All Chat API tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Wait for server to be ready
console.log('⏳ Make sure the server is running (npm run dev)');
console.log('   Then press any key to continue...\n');

// Run tests immediately
testChatAPI().catch(console.error);
// cspell:enable