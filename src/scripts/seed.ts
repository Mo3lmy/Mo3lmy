import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')
  
  try {
    // حذف المستخدم القديم إن وجد
    await prisma.user.deleteMany({
      where: { email: 'demo@test.com' }
    })
    
    // إنشاء كلمة مرور مشفرة
    const hashedPassword = await bcrypt.hash('Demo123!', 10)
    
    // إنشاء طالب تجريبي
    const student = await prisma.user.create({
      data: {
        email: 'demo@test.com',
        password: hashedPassword,
        firstName: 'أحمد',
        lastName: 'محمد',
        role: 'STUDENT',
        grade: 6,
        emailVerified: true,
        isActive: true,
      }
    })
    
    // إنشاء profile للطالب
    await prisma.profile.create({
      data: {
        userId: student.id,
        points: 0,
        level: 1,
        coins: 0,
        streak: 0,
      }
    })
    
    console.log('✅ Created demo user:')
    console.log('   Email: demo@test.com')
    console.log('   Password: Demo123!')
    console.log('   Name: أحمد محمد')
    
  } catch (error) {
    console.error('❌ Seed error:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })