// src/scripts/fix-all-issues.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function fixAllIssues() {
  console.log('🔧 إصلاح شامل لجميع مشاكل عرض الدروس');
  console.log('='.repeat(60));
  
  try {
    let fixedIssues = 0;
    
    // 1. التأكد من نشر جميع الدروس
    console.log('\n1️⃣ فحص حالة نشر الدروس...');
    
    const unpublishedLessons = await prisma.lesson.count({
      where: { isPublished: false }
    });
    
    if (unpublishedLessons > 0) {
      console.log(`   ⚠️ وجدت ${unpublishedLessons} درس غير منشور`);
      console.log('   🔄 نشر جميع الدروس...');
      
      await prisma.lesson.updateMany({
        where: { isPublished: false },
        data: {
          isPublished: true,
          publishedAt: new Date()
        }
      });
      
      console.log('   ✅ تم نشر جميع الدروس');
      fixedIssues++;
    } else {
      console.log('   ✅ جميع الدروس منشورة بالفعل');
    }
    
    // 2. إصلاح مستخدم dev@test.com
    console.log('\n2️⃣ فحص وإصلاح مستخدم التطوير...');
    
    let devUser = await prisma.user.findUnique({
      where: { email: 'dev@test.com' }
    });
    
    if (!devUser) {
      console.log('   ⚠️ المستخدم غير موجود');
      console.log('   🔄 إنشاء مستخدم جديد...');
      
      const hashedPassword = await bcrypt.hash('Dev@1234', 10);
      
      devUser = await prisma.user.create({
        data: {
          email: 'dev@test.com',
          password: hashedPassword,
          firstName: 'Dev',
          lastName: 'User',
          role: 'TEACHER',
          grade: null, // بدون صف محدد
          isActive: true,
          emailVerified: true,
          profile: {
            create: {
              bio: 'حساب التطوير والاختبار'
            }
          }
        }
      });
      
      console.log('   ✅ تم إنشاء المستخدم');
      console.log('   📧 Email: dev@test.com');
      console.log('   🔑 Password: Dev@1234');
      fixedIssues++;
      
    } else if (devUser.grade !== null || devUser.role !== 'TEACHER') {
      console.log('   ⚠️ المستخدم موجود لكن يحتاج تحديث');
      console.log(`      الصف الحالي: ${devUser.grade || 'غير محدد'}`);
      console.log(`      الدور الحالي: ${devUser.role}`);
      console.log('   🔄 تحديث المستخدم...');
      
      devUser = await prisma.user.update({
        where: { email: 'dev@test.com' },
        data: {
          grade: null,
          role: 'TEACHER',
          isActive: true,
          emailVerified: true
        }
      });
      
      console.log('   ✅ تم تحديث المستخدم');
      fixedIssues++;
    } else {
      console.log('   ✅ المستخدم جاهز');
    }
    
    // 3. إنشاء مستخدمين إضافيين للاختبار
    console.log('\n3️⃣ إنشاء مستخدمين إضافيين للاختبار...');
    
    const testUsers = [
      { email: 'student6@test.com', role: 'STUDENT', grade: 6, name: 'طالب الصف السادس' },
      { email: 'student9@test.com', role: 'STUDENT', grade: 9, name: 'طالب الصف التاسع' },
      { email: 'teacher@test.com', role: 'TEACHER', grade: null, name: 'معلم' }
    ];
    
    for (const userData of testUsers) {
      const exists = await prisma.user.findUnique({
        where: { email: userData.email }
      });
      
      if (!exists) {
        const hashedPassword = await bcrypt.hash('Test@1234', 10);
        await prisma.user.create({
          data: {
            email: userData.email,
            password: hashedPassword,
            firstName: userData.name.split(' ')[0],
            lastName: userData.name.split(' ')[1] || '',
            role: userData.role as any,
            grade: userData.grade,
            isActive: true,
            emailVerified: true,
            profile: {
              create: { bio: `حساب ${userData.name}` }
            }
          }
        });
        console.log(`   ✅ تم إنشاء: ${userData.email}`);
        fixedIssues++;
      }
    }
    
    // 4. التأكد من وجود دروس لكل صف
    console.log('\n4️⃣ فحص توزيع الدروس على الصفوف...');
    
    const grades = [6, 9, 12];
    for (const grade of grades) {
      const lessonCount = await prisma.lesson.count({
        where: {
          isPublished: true,
          unit: {
            subject: { grade }
          }
        }
      });
      
      console.log(`   الصف ${grade}: ${lessonCount} درس`);
      
      if (lessonCount === 0) {
        console.log(`      ⚠️ لا توجد دروس للصف ${grade}`);
      }
    }
    
    // 5. التأكد من وجود محتوى للدروس
    console.log('\n5️⃣ فحص محتوى الدروس...');
    
    const lessonsWithoutContent = await prisma.lesson.count({
      where: {
        isPublished: true,
        content: null
      }
    });
    
    if (lessonsWithoutContent > 0) {
      console.log(`   ⚠️ ${lessonsWithoutContent} درس بدون محتوى`);
      console.log('   💡 قد تحتاج لتشغيل: npm run seed');
    } else {
      console.log('   ✅ جميع الدروس لديها محتوى');
    }
    
    // 6. الإحصائيات النهائية
    console.log('\n' + '='.repeat(60));
    console.log('📊 الإحصائيات النهائية:');
    console.log('='.repeat(60));
    
    const stats = {
      totalLessons: await prisma.lesson.count(),
      publishedLessons: await prisma.lesson.count({ where: { isPublished: true } }),
      lessonsWithContent: await prisma.lesson.count({ 
        where: { 
          isPublished: true,
          content: { isNot: null }
        }
      }),
      users: await prisma.user.count(),
      subjects: await prisma.subject.count({ where: { isActive: true } }),
      units: await prisma.unit.count({ where: { isActive: true } })
    };
    
    console.log(`\n✅ الدروس:`);
    console.log(`   إجمالي: ${stats.totalLessons}`);
    console.log(`   منشورة: ${stats.publishedLessons}`);
    console.log(`   مع محتوى: ${stats.lessonsWithContent}`);
    
    console.log(`\n✅ المحتوى:`);
    console.log(`   المواد: ${stats.subjects}`);
    console.log(`   الوحدات: ${stats.units}`);
    
    console.log(`\n✅ المستخدمين: ${stats.users}`);
    
    // 7. عرض حسابات الاختبار
    console.log('\n' + '='.repeat(60));
    console.log('🔑 حسابات الاختبار المتاحة:');
    console.log('='.repeat(60));
    
    console.log('\n1. حساب التطوير الرئيسي (يرى جميع الدروس):');
    console.log('   📧 dev@test.com');
    console.log('   🔑 Dev@1234');
    
    console.log('\n2. حساب معلم (يرى جميع الدروس):');
    console.log('   📧 teacher@test.com');
    console.log('   🔑 Test@1234');
    
    console.log('\n3. حساب طالب الصف 6:');
    console.log('   📧 student6@test.com');
    console.log('   🔑 Test@1234');
    
    console.log('\n4. حساب طالب الصف 9:');
    console.log('   📧 student9@test.com');
    console.log('   🔑 Test@1234');
    
    // 8. التعليمات النهائية
    console.log('\n' + '='.repeat(60));
    console.log('🎯 الخطوات النهائية:');
    console.log('='.repeat(60));
    
    console.log('\n1️⃣ أعد تشغيل الخادم:');
    console.log('   npm run dev');
    
    console.log('\n2️⃣ افتح صفحة الاختبار:');
    console.log('   http://localhost:3000/test-complete-system.html');
    
    console.log('\n3️⃣ في صفحة الاختبار:');
    console.log('   • اضغط على زر "اتصال"');
    console.log('   • انتظر حتى يتم الاتصال');
    console.log('   • اضغط على "تحديث الدروس"');
    console.log('   • يجب أن تظهر الدروس في القائمة');
    
    console.log('\n4️⃣ إذا لم تظهر الدروس:');
    console.log('   • افتح Console في المتصفح (F12)');
    console.log('   • تحقق من وجود رسائل خطأ');
    console.log('   • تحقق من logs الخادم في Terminal');
    
    if (fixedIssues > 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`✅ تم إصلاح ${fixedIssues} مشكلة بنجاح! 🎉`);
      console.log('='.repeat(60));
    } else {
      console.log('\n✅ لا توجد مشاكل تحتاج إصلاح - كل شيء جاهز!');
    }
    
  } catch (error) {
    console.error('\n❌ خطأ في الإصلاح:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// تشغيل الإصلاح الشامل
fixAllIssues().catch(console.error);