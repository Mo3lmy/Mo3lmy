// fix-auth.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Check if test user exists
    let user = await prisma.user.findFirst({
      where: { email: 'test@test.com' }
    });
    
    if (!user) {
      // Create test user
      user = await prisma.user.create({
        data: {
          email: 'test@test.com',
          password: '$2b$10$dummyhash',
          firstName: 'أحمد',
          lastName: 'التجريبي',
          role: 'STUDENT',
          grade: 6,
          isActive: true,
          emailVerified: true
        }
      });
      console.log('✅ Test user created:', user.email);
    } else {
      console.log('✅ Test user already exists:', user.email);
    }
    
    // Create a test lesson if needed
    let lesson = await prisma.lesson.findFirst();
    if (!lesson) {
      // First create subject and unit
      const subject = await prisma.subject.create({
        data: {
          name: 'الرياضيات',
          nameEn: 'Mathematics',
          nameAr: 'الرياضيات',
          grade: 6,
          description: 'منهج الرياضيات للصف السادس'
        }
      });
      
      const unit = await prisma.unit.create({
        data: {
          subjectId: subject.id,
          title: 'الجبر',
          titleEn: 'Algebra',
          titleAr: 'الجبر',
          description: 'أساسيات الجبر',
          order: 1
        }
      });
      
      lesson = await prisma.lesson.create({
        data: {
          unitId: unit.id,
          title: 'المعادلات الخطية',
          titleEn: 'Linear Equations',
          titleAr: 'المعادلات الخطية',
          description: 'تعلم حل المعادلات من الدرجة الأولى',
          order: 1,
          difficulty: 'MEDIUM',
          isPublished: true,
          keyPoints: JSON.stringify([
            'تعريف المعادلة الخطية',
            'طرق حل المعادلات',
            'أمثلة تطبيقية'
          ])
        }
      });
      
      console.log('✅ Test lesson created:', lesson.title);
    }
    
    console.log('\n📝 Test Credentials:');
    console.log('Email:', user.email);
    console.log('Token: test-token');
    console.log('Lesson ID:', lesson.id);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();