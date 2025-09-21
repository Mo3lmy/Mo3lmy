import { authService } from './core/auth/auth.service';
import { prisma } from './config/database.config';

async function testServices() {
  console.log('🧪 Testing Services...\n');
  
  try {
    // Test 1: Register a new user
    console.log('📝 Test 1: Registering new user...');
    const newUser = await authService.register({
      email: 'student1@test.com',
      password: 'Test@1234',
      firstName: 'أحمد',
      lastName: 'محمد',
      grade: 6,
      role: 'STUDENT'
    });
    console.log('✅ User registered:', newUser.user.email);
    console.log('🔑 Token generated:', newUser.token.substring(0, 20) + '...\n');
    
    // Test 2: Login
    console.log('🔐 Test 2: Testing login...');
    const loginResult = await authService.login({
      email: 'student1@test.com',
      password: 'Test@1234'
    });
    console.log('✅ Login successful for:', loginResult.user.email);
    console.log('⏰ Last login:', loginResult.user.lastLogin, '\n');
    
    // Test 3: Verify token
    console.log('🔍 Test 3: Verifying token...');
    const decoded = await authService.verifyToken(loginResult.token);
    console.log('✅ Token valid for user:', decoded.email);
    console.log('👤 Role:', decoded.role, '\n');
    
    // Test 4: Get user
    console.log('👤 Test 4: Getting user by ID...');
    const user = await authService.getUserById(decoded.userId);
    console.log('✅ User found:', user?.firstName, user?.lastName, '\n');
    
    console.log('🎉 All tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    await prisma.user.deleteMany({
      where: { email: 'student1@test.com' }
    });
    await prisma.$disconnect();
    console.log('\n🧹 Cleanup completed');
  }
}

// Run tests
testServices();