/* cspell:disable */
// prisma/seeds/seed-curriculum.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// توليد embedding محلي (مؤقت حتى نشغل OpenAI)
function generateLocalEmbedding(text: string): number[] {
  const hash = createHash('sha256').update(text).digest();
  const embedding: number[] = [];
  
  // OpenAI يستخدم 1536 dimensions
  for (let i = 0; i < 1536; i++) {
    const byte = hash[i % hash.length];
    embedding.push((byte / 255) * 2 - 1);
  }
  
  return embedding;
}

// توليد embedding حقيقي مع OpenAI أو محلي كـ fallback
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // جرب OpenAI لو متاح
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== '') {
      const { openAIService } = await import('../../src/services/ai/openai.service');
      const { embedding } = await openAIService.generateEmbedding(text);
      return embedding;
    }
  } catch (error) {
    console.log('      ⚠️ OpenAI غير متاح، استخدام embedding محلي');
  }
  
  // استخدم محلي كـ fallback
  return generateLocalEmbedding(text);
}

// دالة مساعدة لتوليد معرف فريد
function generateUniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// دالة مساعدة لاستخراج النص من أي structure
function extractText(obj: any): string {
  if (typeof obj === 'string') return obj;
  if (obj?.text) return obj.text;
  if (obj?.description) return obj.description;
  if (obj?.content) return extractText(obj.content);
  if (obj?.value) return obj.value;
  if (Array.isArray(obj)) {
    return obj.map(item => extractText(item)).filter(Boolean).join('\n');
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).map(val => extractText(val)).filter(Boolean).join('\n');
  }
  return '';
}

// دالة حذف البيانات القديمة
async function cleanDatabase() {
  console.log('🧹 حذف البيانات القديمة...');
  
  try {
    // حذف بالترتيب الصحيح (احترام العلاقات)
    await prisma.quizAttemptAnswer.deleteMany();
    await prisma.quizAttempt.deleteMany();
    await prisma.question.deleteMany();
    await prisma.contentEmbedding.deleteMany();
    await prisma.example.deleteMany();
    await prisma.concept.deleteMany();
    await prisma.formula.deleteMany();
    await prisma.rAGContent.deleteMany();
    await prisma.content.deleteMany();
    await prisma.video.deleteMany();
    await prisma.chatMessage.deleteMany();
    await prisma.progress.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.subject.deleteMany();
    
    console.log('✅ تم حذف البيانات القديمة');
  } catch (error) {
    console.log('⚠️ بعض الجداول غير موجودة، تجاهل...');
  }
}

async function seedMathCurriculum() {
  console.log('🚀 بدء إدخال منهج الرياضيات الكامل...');
  console.log('════════════════════════════════════════\n');
  
  // تحقق من OpenAI API
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
    console.log('✅ OpenAI API متاح - سيتم إنشاء embeddings حقيقية');
  } else {
    console.log('⚠️ OpenAI API غير متاح - سيتم استخدام embeddings محلية');
  }
  
  try {
    // قراءة البيانات من الملف
    const dataPath = path.join(__dirname, '../../data/curriculum-data.json');
    
    let curriculumData: any;
    
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, 'utf-8');
      curriculumData = JSON.parse(fileContent);
    } else {
      // مسار بديل
      const altPath = path.join(process.cwd(), 'data/curriculum-data.json');
      if (fs.existsSync(altPath)) {
        const fileContent = fs.readFileSync(altPath, 'utf-8');
        curriculumData = JSON.parse(fileContent);
      } else {
        throw new Error('❌ لا يمكن العثور على ملف curriculum-data.json');
      }
    }
    
    // التحقق من البيانات
    if (!curriculumData.units || !Array.isArray(curriculumData.units)) {
      throw new Error('❌ البيانات غير صحيحة - لا توجد وحدات');
    }
    
    const totalUnits = curriculumData.units.length;
    console.log(`📚 تم قراءة ${totalUnits} وحدات من الملف\n`);
    
    // عرض ملخص البيانات
    let totalLessonsInFile = 0;
    curriculumData.units.forEach((unit: any, i: number) => {
      const lessonCount = unit.lessons?.length || 0;
      totalLessonsInFile += lessonCount;
      console.log(`   ${i + 1}. ${unit.title}: ${lessonCount} دروس`);
    });
    console.log(`   ──────────────────────`);
    console.log(`   المجموع: ${totalLessonsInFile} درس\n`);
    
    // 1. إنشاء المادة الدراسية
    const subjectName = curriculumData.subject?.name || 'الرياضيات';
    const subjectNameEn = curriculumData.subject?.nameEn || 'Mathematics';
    const subjectGrade = curriculumData.subject?.grade || 6;
    
    const subject = await prisma.subject.upsert({
      where: {
        name_grade: {
          name: subjectName,
          grade: subjectGrade
        }
      },
      update: {
        description: curriculumData.subject?.description || `منهج ${subjectName} للصف ${subjectGrade}`
      },
      create: {
        id: generateUniqueId('SUBJ'),
        name: subjectName,
        nameEn: subjectNameEn,
        nameAr: subjectName,
        grade: subjectGrade,
        description: curriculumData.subject?.description || `منهج ${subjectName} للصف ${subjectGrade} الابتدائي`,
        isActive: true,
        order: 1
      }
    });
    
    console.log(`✅ تم إنشاء المادة: ${subject.name} (${subject.nameEn})\n`);
    
    let totalLessons = 0;
    let totalConcepts = 0;
    let totalExamples = 0;
    let totalQuestions = 0;
    let totalEmbeddings = 0;
    
    // 2. معالجة كل الوحدات
    console.log('🔄 بدء معالجة الوحدات والدروس...');
    console.log('════════════════════════════════════════\n');
    
    // Loop through ALL units (not just 3!)
    for (let unitIndex = 0; unitIndex < totalUnits; unitIndex++) {
      const unitData = curriculumData.units[unitIndex];
      
      if (!unitData) {
        console.log(`⚠️ تخطي الوحدة ${unitIndex + 1} - لا توجد بيانات`);
        continue;
      }
      
      // استخراج بيانات الوحدة
      const unitTitle = unitData.title || unitData.titleAr || `الوحدة ${unitIndex + 1}`;
      const unitTitleEn = unitData.titleEn || unitData.title || `Unit ${unitIndex + 1}`;
      const unitOrder = unitData.unitNumber || (unitIndex + 1);
      
      console.log(`📂 [${unitIndex + 1}/${totalUnits}] معالجة الوحدة: ${unitTitle}`);
      console.log(`   ترتيب الوحدة: ${unitOrder}`);
      console.log(`   عدد الدروس: ${unitData.lessons?.length || 0}`);
      
      // إنشاء الوحدة
      const unit = await prisma.unit.create({
        data: {
          id: generateUniqueId('UNIT'),
          title: unitTitle,
          titleEn: unitTitleEn,
          titleAr: unitTitle,
          order: unitOrder,
          subjectId: subject.id,
          description: unitData.objectives?.[0] || unitData.description || unitTitle,
          isActive: true
        }
      });
      
      console.log(`   ✅ تم إنشاء الوحدة\n`);
      
      // إدخال دروس الوحدة
      const lessons = unitData.lessons || [];
      
      for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex++) {
        const lessonData = lessons[lessonIndex];
        
        if (!lessonData) {
          console.log(`   ⚠️ تخطي الدرس ${lessonIndex + 1} - لا توجد بيانات`);
          continue;
        }
        
        // استخراج بيانات الدرس
        const lessonTitle = lessonData.title || lessonData.titleAr || `الدرس ${lessonIndex + 1}`;
        const lessonTitleEn = lessonData.titleEn || lessonData.title || `Lesson ${lessonIndex + 1}`;
        const lessonOrder = lessonData.lessonNumber || (lessonIndex + 1);
        
        console.log(`   📝 [${lessonIndex + 1}/${lessons.length}] ${lessonTitle}`);
        totalLessons++;
        
        // إنشاء الدرس
        const lesson = await prisma.lesson.create({
          data: {
            id: generateUniqueId('LESSON'),
            title: lessonTitle,
            titleEn: lessonTitleEn,
            titleAr: lessonTitle,
            order: lessonOrder,
            unitId: unit.id,
            difficulty: 'MEDIUM',
            duration: 45,
            isPublished: true,
            publishedAt: new Date(),
            description: lessonData.objectives?.[0] || lessonTitle,
            summary: lessonData.content?.summary || '',
            keyPoints: JSON.stringify(lessonData.objectives || [])
          }
        });
        
        // معالجة المحتوى
        let fullText = '';
        let summary = '';
        let keyPoints: string[] = [];
        let examples: any[] = [];
        let concepts: string[] = [];
        
        if (lessonData.content) {
          // جمع النصوص
          const textParts: string[] = [];
          
          if (lessonData.content.introduction) textParts.push(lessonData.content.introduction);
          if (lessonData.content.fullText) textParts.push(lessonData.content.fullText);
          if (lessonData.content.summary) textParts.push(lessonData.content.summary);
          
          fullText = textParts.filter(Boolean).join('\n\n') || `محتوى ${lessonTitle}`;
          summary = lessonData.content.summary || fullText.substring(0, 500);
          keyPoints = lessonData.objectives || lessonData.content.keyPoints || [];
          
          // الأمثلة
          if (lessonData.content.examples && Array.isArray(lessonData.content.examples)) {
            examples = lessonData.content.examples;
          }
          
          // المفاهيم
          concepts = lessonData.content.concepts || [lessonTitle];
        } else {
          fullText = `محتوى ${lessonTitle}`;
          summary = fullText;
          keyPoints = lessonData.objectives || [];
          concepts = [lessonTitle];
        }
        
        // إنشاء محتوى الدرس
        const content = await prisma.content.create({
          data: {
            id: generateUniqueId('CONTENT'),
            lessonId: lesson.id,
            fullText: fullText,
            summary: summary,
            keyPoints: JSON.stringify(keyPoints),
            examples: JSON.stringify(examples),
            exercises: JSON.stringify([])
          }
        });
        
        // إنشاء ContentEmbedding
        try {
          const contentForEmbedding = `
            ${lessonTitle} ${lessonTitleEn}
            ${summary}
            ${keyPoints.join(' ')}
            ${concepts.join(' ')}
          `.trim().substring(0, 2000);
          
          const embedding = await generateEmbedding(contentForEmbedding);
          
          await prisma.contentEmbedding.create({
            data: {
              id: generateUniqueId('EMBED'),
              contentId: content.id,
              chunkIndex: 0,
              chunkText: contentForEmbedding.substring(0, 1000),
              embedding: JSON.stringify(embedding),
              metadata: JSON.stringify({
                lessonTitle: lessonTitle,
                unitTitle: unitTitle,
                subject: subject.name,
                grade: subjectGrade
              })
            }
          });
          
          totalEmbeddings++;
          console.log(`      ✅ تم إنشاء embedding`);
        } catch (error) {
          console.log(`      ⚠️ فشل إنشاء embedding`);
        }
        
        // إضافة بعض الأسئلة
        const sampleQuestions = [
          {
            type: 'MCQ',
            text: `ما هو موضوع درس "${lessonTitle}"؟`,
            options: [summary.substring(0, 50), 'إجابة خاطئة', 'خيار آخر', 'لا شيء'],
            correctAnswer: '0',
            difficulty: 'EASY'
          },
          {
            type: 'TRUE_FALSE',
            text: `${lessonTitle} من دروس ${unitTitle}`,
            correctAnswer: 'true',
            difficulty: 'EASY'
          }
        ];
        
        for (const q of sampleQuestions) {
          try {
            await prisma.question.create({
              data: {
                id: generateUniqueId('QUESTION'),
                lessonId: lesson.id,
                type: q.type as any,
                difficulty: q.difficulty as any,
                question: q.text,
                options: q.type === 'MCQ' ? JSON.stringify(q.options) : null,
                correctAnswer: q.correctAnswer,
                explanation: 'شرح تلقائي',
                points: 1,
                order: 0
              }
            });
            totalQuestions++;
          } catch (error) {
            // تجاهل أخطاء الأسئلة
          }
        }
      }
      
      console.log(''); // سطر فارغ بين الوحدات
    }
    
    // الإحصائيات النهائية
    console.log('════════════════════════════════════════');
    console.log('✅ تم إدخال البيانات بنجاح!');
    console.log('════════════════════════════════════════\n');
    
    const stats = {
      subjects: await prisma.subject.count(),
      units: await prisma.unit.count(),
      lessons: await prisma.lesson.count(),
      questions: await prisma.question.count(),
      content: await prisma.content.count(),
      contentEmbeddings: await prisma.contentEmbedding.count()
    };
    
    console.log('📊 الإحصائيات النهائية:');
    console.log('------------------------');
    console.log(`📚 المواد: ${stats.subjects}`);
    console.log(`📂 الوحدات: ${stats.units} ${stats.units === totalUnits ? '✅' : `⚠️ (متوقع: ${totalUnits})`}`);
    console.log(`📝 الدروس: ${stats.lessons} ${stats.lessons === totalLessonsInFile ? '✅' : `⚠️ (متوقع: ${totalLessonsInFile})`}`);
    console.log(`📄 المحتوى: ${stats.content}`);
    console.log(`🧠 Embeddings: ${stats.contentEmbeddings}`);
    console.log(`❓ الأسئلة: ${stats.questions}`);
    console.log('------------------------\n');
    
    if (stats.contentEmbeddings > 0) {
      console.log('✅ النظام جاهز للعمل مع RAG!');
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
        console.log('   ✨ باستخدام OpenAI embeddings حقيقية');
      } else {
        console.log('   ⚠️ باستخدام embeddings محلية');
      }
    }
    
    console.log('\n✨ الخطوات التالية:');
    console.log('1. فتح Prisma Studio: npx prisma studio');
    console.log('2. اختبار RAG: npm run test:rag');
    console.log('3. بدء الخادم: npm run dev');
    
  } catch (error) {
    console.error('\n❌ خطأ في إدخال البيانات:', error);
    throw error;
  }
}

// الدالة الرئيسية
async function main() {
  console.log('════════════════════════════════════════');
  console.log('   منصة التعليم الذكية - إدخال البيانات');
  console.log('════════════════════════════════════════\n');
  
  const args = process.argv.slice(2);
  
  // حذف البيانات القديمة إذا طُلب
  if (args.includes('--clean')) {
    await cleanDatabase();
    console.log('');
  }
  
  // إدخال البيانات
  await seedMathCurriculum();
}

// تشغيل البرنامج
main()
  .then(() => {
    console.log('\n🎉 اكتمل بنجاح!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 فشل:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });