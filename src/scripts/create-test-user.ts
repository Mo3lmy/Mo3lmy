// src/scripts/create-test-user.ts
import 'dotenv/config';
import { prisma } from '../config/database.config';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

async function createTestUser() {
  console.log('🔧 Creating test user...');
  console.log('📍 Using database:', process.env.DATABASE_URL);

  try {
    // الباسورد الجديد
    const password = 'Test1234!';
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('📝 Password hashed successfully');
    console.log('   Hash:', hashedPassword.substring(0, 30) + '...');

    // حاول تحديث المستخدم الموجود أو إنشاء واحد جديد
    const user = await prisma.user.upsert({
      where: { email: 'test@test.com' },
      update: {
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        emailVerified: true
      },
      create: {
        email: 'test@test.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'STUDENT',
        grade: 6,
        isActive: true,
        emailVerified: true
      }
    });

    console.log('✅ User updated/created:', user.email);

    // إنشاء profile
    await prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        points: 0,
        level: 1,
        coins: 0,
        streak: 0,
      }
    });
    console.log('✅ Profile created');

    // اختبار الباسورد
    console.log('\n🔐 Testing password verification...');
    const userFromDb = await prisma.user.findUnique({
      where: { email: 'test@test.com' }
    });

    if (userFromDb) {
      const isValid = await bcrypt.compare(password, userFromDb.password);
      console.log('   Password verification:', isValid ? '✅ PASSED' : '❌ FAILED');

      if (!isValid) {
        console.log('   ⚠️  Password verification failed!');
        console.log('   Stored hash:', userFromDb.password);
        console.log('   Testing password:', password);
      }
    }

    // إنشاء token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-minimum-32-chars',
      { expiresIn: '7d' }
    );

    console.log('\n✅ User Created Successfully!');
    console.log('📧 Email: test@test.com');
    console.log('🔑 Password: Test1234!');
    console.log('\n🎟️ JWT Token for testing:\n');
    console.log(token);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();