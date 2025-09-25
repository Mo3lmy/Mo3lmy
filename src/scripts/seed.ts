import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // إنشاء طالب تجريبي
  const hashedPassword = await bcrypt.hash('Test123456', 10)
  
  const student = await prisma.user.create({
    data: {
      email: 'student@test.com',
      password: hashedPassword,
      firstName: 'أحمد',
      lastName: 'محمد',
      role: 'STUDENT',
      grade: 6,
      emailVerified: true,
      isActive: true,
    }
  })
  
  console.log('✅ Created test user:', student.email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())