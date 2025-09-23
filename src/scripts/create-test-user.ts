// src/scripts/create-test-user.ts
import 'dotenv/config';
import { prisma } from '../config/database.config';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

async function createTestUser() {
  // حذف المستخدم القديم
  await prisma.user.deleteMany({
    where: { email: 'test@test.com' }
  });
  
  // إنشاء مستخدم جديد
  const hashedPassword = await bcrypt.hash('Test123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'test@test.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'STUDENT',
      grade: 9,
      isActive: true,
      emailVerified: true
    }
  });
  
  // إنشاء token بنفس الـ secret اللي في .env
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'your-secret-key-here',
    { expiresIn: '30d' }
  );
  
  console.log('\n✅ User Created Successfully!');
  console.log('📧 Email: test@test.com');
  console.log('🔑 Password: Test123');
  console.log('\n🎟️ COPY THIS TOKEN:\n');
  console.log(token);
  
  await prisma.$disconnect();
}

createTestUser();