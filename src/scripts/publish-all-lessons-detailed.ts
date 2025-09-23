// src/scripts/publish-all-lessons-detailed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function publishAllLessonsDetailed() {
  try {
    console.log('🔍 جاري فحص الدروس في قاعدة البيانات...\n');
    
    // 1. احصل على إحصائيات قبل النشر
    const totalLessons = await prisma.lesson.count();
    const publishedBefore = await prisma.lesson.count({
      where: { isPublished: true }
    });
    const unpublished = totalLessons - publishedBefore;
    
    console.log('📊 الإحصائيات الحالية:');
    console.log(`   إجمالي الدروس: ${totalLessons}`);
    console.log(`   دروس منشورة: ${publishedBefore}`);
    console.log(`   دروس غير منشورة: ${unpublished}`);
    console.log('─'.repeat(50));
    
    if (unpublished === 0) {
      console.log('✅ جميع الدروس منشورة بالفعل!');
      await prisma.$disconnect();
      return;
    }
    
    // 2. احصل على قائمة الدروس غير المنشورة
    const unpublishedLessons = await prisma.lesson.findMany({
      where: { isPublished: false },
      select: {
        id: true,
        title: true,
        titleAr: true,
        unit: {
          select: {
            title: true,
            subject: {
              select: { name: true, grade: true }
            }
          }
        }
      }
    });
    
    console.log('\n📝 الدروس التي سيتم نشرها:');
    unpublishedLessons.forEach((lesson, index) => {
      const title = lesson.titleAr || lesson.title;
      const subject = lesson.unit.subject.name;
      const grade = lesson.unit.subject.grade;
      console.log(`   ${index + 1}. ${title} (${subject} - الصف ${grade})`);
    });
    
    // 3. نشر جميع الدروس غير المنشورة
    console.log('\n🚀 بدء عملية النشر...');
    const result = await prisma.lesson.updateMany({
      where: { isPublished: false },
      data: {
        isPublished: true,
        publishedAt: new Date()
      }
    });
    
    console.log(`\n✅ تم نشر ${result.count} درس بنجاح!`);
    
    // 4. التحقق من الدروس مع enrichment
    console.log('\n🔍 فحص حالة الـ Enrichment...');
    
    // Check lessons with content
    const lessonsWithContent = await prisma.lesson.count({
      where: {
        isPublished: true,
        content: { isNot: null }
      }
    });
    
    // Check lessons with embeddings
    const lessonsWithEmbeddings = await prisma.lesson.findMany({
      where: {
        isPublished: true,
        content: {
          embeddings: {
            some: {}
          }
        }
      },
      select: {
        id: true,
        title: true,
        titleAr: true
      }
    });
    
    console.log(`   دروس مع محتوى: ${lessonsWithContent}`);
    console.log(`   دروس مع Embeddings (RAG): ${lessonsWithEmbeddings.length}`);
    
    if (lessonsWithEmbeddings.length === 0) {
      console.log('\n⚠️  تنبيه: لا توجد دروس مع embeddings!');
      console.log('   لتفعيل RAG والبحث الذكي، قم بتشغيل:');
      console.log('   npm run process-rag');
    } else {
      console.log('\n✅ الدروس التالية جاهزة للـ RAG:');
      lessonsWithEmbeddings.forEach((lesson, i) => {
        const title = lesson.titleAr || lesson.title;
        console.log(`   ${i + 1}. ${title}`);
      });
    }
    
    // 5. إحصائيات نهائية
    console.log('\n' + '='.repeat(50));
    console.log('📊 الإحصائيات النهائية:');
    console.log('='.repeat(50));
    
    const finalStats = {
      totalLessons: await prisma.lesson.count(),
      publishedLessons: await prisma.lesson.count({ where: { isPublished: true } }),
      subjects: await prisma.subject.count({ where: { isActive: true } }),
      units: await prisma.unit.count({ where: { isActive: true } }),
      questions: await prisma.question.count(),
      embeddings: await prisma.contentEmbedding.count()
    };
    
    console.log(`✅ إجمالي الدروس: ${finalStats.totalLessons}`);
    console.log(`✅ الدروس المنشورة: ${finalStats.publishedLessons}`);
    console.log(`📚 المواد الدراسية: ${finalStats.subjects}`);
    console.log(`📂 الوحدات: ${finalStats.units}`);
    console.log(`❓ الأسئلة: ${finalStats.questions}`);
    console.log(`🧠 Embeddings: ${finalStats.embeddings}`);
    
    // 6. اقتراحات
    console.log('\n💡 الخطوات التالية المقترحة:');
    console.log('1. افتح صفحة الاختبار: http://localhost:3000/test-complete-system.html');
    console.log('2. سجل الدخول بأحد الحسابات التجريبية');
    console.log('3. اضغط على "تحديث الدروس" لرؤية الدروس المنشورة');
    
    if (finalStats.embeddings === 0) {
      console.log('\n⚠️  لتفعيل البحث الذكي و RAG:');
      console.log('   npm run process-rag');
    }
    
  } catch (error) {
    console.error('❌ خطأ في نشر الدروس:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// تشغيل السكريبت
publishAllLessonsDetailed().catch(console.error);