// src/scripts/create-dev-user.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createDevUser() {
  console.log('🔧 إنشاء مستخدم التطوير dev@test.com\n');
  console.log('='.repeat(50));
  
  try {
    // 1. تحقق هل المستخدم موجود
    let user = await prisma.user.findUnique({
      where: { email: 'dev@test.com' }
    });
    
    if (user) {
      console.log('✅ المستخدم موجود بالفعل!');
      console.log(`   ID: ${user.id}`);
      console.log(`   الاسم: ${user.firstName} ${user.lastName}`);
      console.log(`   الدور: ${user.role}`);
      console.log(`   الصف: ${user.grade || 'غير محدد'}`);
      
      // تحديث الصف إذا لزم الأمر
      if (user.grade !== 6 && user.grade !== null) {
        console.log('\n🔄 تحديث الصف إلى 6...');
        user = await prisma.user.update({
          where: { email: 'dev@test.com' },
          data: { 
            grade: 6,  // نفس صف الدروس المتاحة
            isActive: true,
            emailVerified: true
          }
        });
        console.log('✅ تم التحديث');
      }
      
    } else {
      console.log('⚠️ المستخدم غير موجود');
      console.log('📝 إنشاء مستخدم جديد...');
      
      // إنشاء كلمة مرور مشفرة
      const hashedPassword = await bcrypt.hash('Dev@1234', 10);
      
      user = await prisma.user.create({
        data: {
          email: 'dev@test.com',
          password: hashedPassword,
          firstName: 'Dev',
          lastName: 'User',
          role: 'STUDENT',
          grade: 6,  // نفس صف الدروس المتاحة
          isActive: true,
          emailVerified: true,
          profile: {
            create: {
              bio: 'حساب التطوير والاختبار',
              dateOfBirth: new Date('2000-01-01')
            }
          }
        }
      });
      
      console.log('✅ تم إنشاء المستخدم بنجاح!');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: dev@test.com`);
      console.log(`   Password: Dev@1234`);
      console.log(`   الصف: ${user.grade}`);
    }
    
    // 2. التحقق من وجود دروس للصف 6
    console.log('\n📚 فحص الدروس المتاحة...');
    
    const lessonsCount = await prisma.lesson.count({
      where: {
        isPublished: true,
        unit: {
          subject: {
            grade: 6
          }
        }
      }
    });
    
    console.log(`   دروس الصف 6 المنشورة: ${lessonsCount}`);
    
    // 3. عرض أول درس كمثال
    const firstLesson = await prisma.lesson.findFirst({
      where: {
        isPublished: true,
        unit: {
          subject: {
            grade: 6
          }
        }
      },
      include: {
        unit: {
          include: {
            subject: true
          }
        }
      }
    });
    
    if (firstLesson) {
      console.log('\n📝 مثال على درس متاح:');
      console.log(`   ID: ${firstLesson.id}`);
      console.log(`   العنوان: ${firstLesson.titleAr || firstLesson.title}`);
      console.log(`   المادة: ${firstLesson.unit.subject.name}`);
      console.log(`   الصف: ${firstLesson.unit.subject.grade}`);
    }
    
    // 4. تنظيف الجلسات القديمة إن وجدت
    console.log('\n🧹 تنظيف الجلسات القديمة...');
    
    const deletedSessions = await prisma.learningSession.deleteMany({
      where: {
        userId: user.id,
        isActive: false
      }
    });
    
    if (deletedSessions.count > 0) {
      console.log(`   تم حذف ${deletedSessions.count} جلسة قديمة`);
    } else {
      console.log('   لا توجد جلسات قديمة');
    }
    
    // 5. التعليمات النهائية
    console.log('\n' + '='.repeat(50));
    console.log('✅ النظام جاهز!');
    console.log('='.repeat(50));
    
    console.log('\n🎯 الخطوات التالية:');
    console.log('1. أعد تشغيل الخادم: npm run dev');
    console.log('2. افتح: http://localhost:3000/test-complete-system.html');
    console.log('3. اضغط "اتصال"');
    console.log('4. اختر أي درس من القائمة');
    console.log('5. اضغط "انضم للدرس"');
    console.log('\n✨ يجب أن يعمل كل شيء الآن!');
    
  } catch (error) {
    console.error('\n❌ خطأ:', error);
    
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2002') {
      console.log('💡 المستخدم موجود بالفعل، جرب تحديثه');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// تشغيل السكريبت
createDevUser().catch(console.error);