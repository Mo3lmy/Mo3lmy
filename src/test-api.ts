interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: any;
}

const API_URL = 'http://localhost:3000/api/v1';

async function testAPI() {
  console.log('🧪 Testing API Endpoints...\n');
  
  try {
    // Test 1: Register
    console.log('1️⃣ Testing Registration...');
    const registerRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test@1234',
        firstName: 'Test',
        lastName: 'User',
        grade: 6,
      }),
    });
    const registerData = await registerRes.json() as ApiResponse;
    console.log('✅ Registration:', registerData.success ? 'Success' : 'Failed');
    const token = registerData.data?.token || '';
    
    // Test 2: Login
    console.log('\n2️⃣ Testing Login...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test@1234',
      }),
    });
    const loginData = await loginRes.json() as ApiResponse;
    console.log('✅ Login:', loginData.success ? 'Success' : 'Failed');
    
    // Test 3: Get subjects
    console.log('\n3️⃣ Testing Get Subjects...');
    const subjectsRes = await fetch(`${API_URL}/content/subjects?grade=6`);
    const subjectsData = await subjectsRes.json() as ApiResponse;
    console.log('✅ Subjects found:', subjectsData.data?.length || 0);
    
    // Test 4: Get current user
    console.log('\n4️⃣ Testing Get Current User...');
    const meRes = await fetch(`${API_URL}/auth/me`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
      },
    });
    const meData = await meRes.json() as ApiResponse;
    console.log('✅ Current user:', meData.data?.email || 'Not found');
    
    console.log('\n🎉 All API tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
testAPI();