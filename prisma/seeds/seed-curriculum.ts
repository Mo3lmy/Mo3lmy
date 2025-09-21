// prisma/seeds/seed-curriculum.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// نموذج البيانات
interface CurriculumData {
  subject: {
    name: string;
    nameEn: string;
    nameAr: string;
    grade: number;
  };
  units: Array<{
    title: string;
    titleAr: string;
    order: number;
    lessons: Array<{
      title: string;
      titleAr: string;
      order: number;
      content: {
        fullText: string;
        summary: string;
        keyPoints: string[];
        examples: Array<{
          problem: string;
          solution: string;
        }>;
        concepts: string[];
        formulas?: string[];
      };
    }>;
  }>;
}

// توليد embedding محلي (مؤقت - يمكن استبداله بـ OpenAI)
function generateLocalEmbedding(text: string): number[] {
  const hash = createHash('sha256').update(text).digest();
  const embedding: number[] = [];
  
  // توليد 384 رقم من الـ hash (محاكاة لـ embedding)
  for (let i = 0; i < 384; i++) {
    const byte = hash[i % hash.length];
    embedding.push((byte / 255) * 2 - 1); // تطبيع بين -1 و 1
  }
  
  return embedding;
}

// دالة مساعدة لتوليد معرف فريد
function generateUniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function seedMathCurriculum() {
  console.log('🚀 بدء إدخال منهج الرياضيات...');
  console.log('⚠️ ملاحظة: تأكد من تشغيل "npx prisma generate" بعد تحديث Schema');
  
  try {
    // قراءة البيانات من الملف
    const dataPath = path.join(__dirname, '../../data/curriculum-data.json');
    
    // إذا لم يجد الملف، جرب مسار آخر
    let curriculumData: CurriculumData;
    
    if (fs.existsSync(dataPath)) {
      curriculumData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } else {
      // مسار بديل
      const altPath = path.join(process.cwd(), 'data/curriculum-data.json');
      if (fs.existsSync(altPath)) {
        curriculumData = JSON.parse(fs.readFileSync(altPath, 'utf-8'));
      } else {
        console.error('❌ لا يمكن العثور على ملف curriculum-data.json');
        console.log('تأكد من وجود الملف في: data/curriculum-data.json');
        process.exit(1);
      }
    }
    
    console.log(`📚 تم قراءة ${curriculumData.units.length} وحدات`);
    
    // 1. إنشاء المادة الدراسية
    const subject = await prisma.subject.upsert({
  where: {
    name_grade: {
      name: curriculumData.subject.nameEn,
      grade: curriculumData.subject.grade
    }
  },
  update: {
    description: `منهج ${curriculumData.subject.name} للصف ${curriculumData.subject.grade} الابتدائي`
  },
  create: {
    id: generateUniqueId('SUBJ'),
    nameEn: curriculumData.subject.nameEn,
    // أضف هذا السطر المفقود:
    name: curriculumData.subject.name || curriculumData.subject.nameEn,  // <-- هنا المشكلة
    grade: curriculumData.subject.grade,
    description: `منهج ${curriculumData.subject.name} للصف ${curriculumData.subject.grade} الابتدائي`,
    isActive: true,
    order: 1
  }
});
    
    console.log(`✅ تم إنشاء المادة: ${subject.name} (${subject.nameEn})`);
    
    let totalLessons = 0;
    let totalConcepts = 0;
    let totalExamples = 0;
    let totalQuestions = 0;
    
    // 2. إدخال الوحدات والدروس
    for (const unitData of curriculumData.units) {
      console.log(`\n📂 معالجة الوحدة ${unitData.order}: ${unitData.titleAr}`);
      
      // إنشاء الوحدة
      const unit = await prisma.unit.create({
        data: {
          id: generateUniqueId('UNIT'),
          title: unitData.titleAr, // استخدم العنوان العربي في title
          titleEn: unitData.title,
          // titleAr سيضاف عند تشغيل migration الجديد
          order: unitData.order,
          subjectId: subject.id,
          description: unitData.titleAr,
          isActive: true
        }
      });
      
      // إدخال الدروس
      for (const lessonData of unitData.lessons) {
        console.log(`  📝 إضافة الدرس ${lessonData.order}: ${lessonData.titleAr}`);
        totalLessons++;
        
        // إنشاء الدرس
        const lesson = await prisma.lesson.create({
          data: {
            id: generateUniqueId('LESSON'),
            title: lessonData.titleAr, // استخدم العنوان العربي في title
            titleEn: lessonData.title,
            // titleAr سيضاف عند تشغيل migration الجديد
            order: lessonData.order,
            unitId: unit.id,
            // summary و keyPoints سيضافان عند تشغيل migration الجديد
            difficulty: 'MEDIUM',
            // estimatedMinutes سيضاف عند تشغيل migration الجديد
            duration: 45,
            isPublished: true,
            publishedAt: new Date(),
            description: lessonData.content.summary
          }
        });
        
        // إنشاء محتوى الدرس
        await prisma.content.create({
          data: {
            id: generateUniqueId('CONTENT'),
            lessonId: lesson.id,
            fullText: lessonData.content.fullText,
            summary: lessonData.content.summary,
            keyPoints: JSON.stringify(lessonData.content.keyPoints),
            examples: JSON.stringify(lessonData.content.examples),
            exercises: JSON.stringify([])
          }
        });
        
        // إضافة المفاهيم (عندما يكون النموذج متاحاً)
        if ((prisma as any).concept) {
          for (const concept of lessonData.content.concepts) {
            await (prisma as any).concept.create({
              data: {
                id: generateUniqueId('CONCEPT'),
                name: concept,
                nameAr: concept,
                description: `مفهوم: ${concept}`,
                lessonId: lesson.id
              }
            });
            totalConcepts++;
          }
        } else {
          console.log('    ⚠️ نموذج Concept غير متاح - تخطي المفاهيم');
        }
        
        // إضافة الأمثلة (عندما يكون النموذج متاحاً)
        if ((prisma as any).example) {
          let exampleOrder = 1;
          for (const example of lessonData.content.examples) {
            await (prisma as any).example.create({
              data: {
                id: generateUniqueId('EXAMPLE'),
                problem: example.problem,
                solution: example.solution,
                lessonId: lesson.id,
                order: exampleOrder++
              }
            });
            totalExamples++;
          }
        } else {
          console.log('    ⚠️ نموذج Example غير متاح - تخطي الأمثلة');
        }
        
        // إضافة الصيغ الرياضية (عندما يكون النموذج متاحاً)
        if ((prisma as any).formula && lessonData.content.formulas && lessonData.content.formulas.length > 0) {
          for (const formula of lessonData.content.formulas) {
            await (prisma as any).formula.create({
              data: {
                id: generateUniqueId('FORMULA'),
                expression: formula,
                description: `صيغة رياضية`,
                lessonId: lesson.id
              }
            });
          }
        }
        
        // إنشاء محتوى RAG (عندما يكون النموذج متاحاً)
        if ((prisma as any).rAGContent) {
          const contentForEmbedding = `
            ${lessonData.title} | ${lessonData.titleAr}
            ${lessonData.content.summary}
            ${lessonData.content.keyPoints.join(' ')}
            ${lessonData.content.concepts.join(' ')}
            ${lessonData.content.examples.map(e => `${e.problem} ${e.solution}`).join(' ')}
          `.trim();
          
          const embedding = generateLocalEmbedding(contentForEmbedding);
          
          await (prisma as any).rAGContent.create({
            data: {
              id: generateUniqueId('RAG'),
              lessonId: lesson.id,
              content: contentForEmbedding,
              contentType: 'LESSON_FULL',
              embedding: JSON.stringify(embedding),
              metadata: JSON.stringify({
                unit: unitData.title,
                unitAr: unitData.titleAr,
                lesson: lessonData.title,
                lessonAr: lessonData.titleAr,
                grade: curriculumData.subject.grade,
                subject: curriculumData.subject.nameEn,
                concepts: lessonData.content.concepts,
                keyPoints: lessonData.content.keyPoints
              })
            }
          });
        } else {
          console.log('    ⚠️ نموذج RAGContent غير متاح - تخطي محتوى RAG');
        }
        
        // إضافة بعض الأسئلة النموذجية (عينات صغيرة فقط)
        const sampleQuestions = [
          {
            type: 'MCQ',
            text: `ما هو موضوع درس "${lessonData.titleAr}"؟`,
            options: [
              lessonData.content.summary.substring(0, 50),
              'موضوع آخر غير صحيح',
              'إجابة خاطئة',
              'خيار رابع'
            ],
            correctAnswer: '0',
            difficulty: 'EASY',
            points: 1
          },
          {
            type: 'TRUE_FALSE',
            text: `صح أم خطأ: ${lessonData.content.keyPoints[0]}؟`,
            correctAnswer: 'true',
            difficulty: 'MEDIUM',
            points: 2
          },
          {
            type: 'FILL_BLANK',
            text: `أكمل: ${lessonData.titleAr} هو درس يتحدث عن _____.`,
            correctAnswer: lessonData.content.concepts[0] || 'المفهوم الأساسي',
            difficulty: 'EASY',
            points: 1
          }
        ];
        
        for (const q of sampleQuestions) {
          const questionData: any = {
            id: generateUniqueId('QUESTION'),
            lessonId: lesson.id,
            type: q.type as any,
            difficulty: q.difficulty as any,
            question: q.text,
            options: q.type === 'MCQ' ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer,
            explanation: 'شرح تلقائي',
            points: q.points,
            order: 0
          };
          
          // أضف tags و isActive فقط إذا كانت موجودة في Schema
          // سيتم إضافتها بعد تشغيل migration الجديد
          
          await prisma.question.create({
            data: questionData
          });
          totalQuestions++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ تم إدخال البيانات الأساسية بنجاح!');
    console.log('='.repeat(50));
    
    // إحصائيات
    const stats: any = {
      subjects: await prisma.subject.count(),
      units: await prisma.unit.count(),
      lessons: await prisma.lesson.count(),
      questions: await prisma.question.count(),
      content: await prisma.content.count()
    };
    
    // عد النماذج الجديدة إذا كانت متاحة
    if ((prisma as any).concept) {
      stats.concepts = await (prisma as any).concept.count();
    }
    if ((prisma as any).example) {
      stats.examples = await (prisma as any).example.count();
    }
    if ((prisma as any).formula) {
      stats.formulas = await (prisma as any).formula.count();
    }
    if ((prisma as any).rAGContent) {
      stats.ragContent = await (prisma as any).rAGContent.count();
    }
    
    console.log('\n📊 الإحصائيات النهائية:');
    console.log('------------------------');
    console.log(`📚 المواد: ${stats.subjects}`);
    console.log(`📂 الوحدات: ${stats.units}`);
    console.log(`📝 الدروس: ${stats.lessons}`);
    console.log(`📄 المحتوى: ${stats.content}`);
    console.log(`❓ الأسئلة: ${stats.questions}`);
    
    if (stats.concepts !== undefined) {
      console.log(`💡 المفاهيم: ${stats.concepts}`);
    }
    if (stats.examples !== undefined) {
      console.log(`📖 الأمثلة: ${stats.examples}`);
    }
    if (stats.formulas !== undefined) {
      console.log(`📐 الصيغ: ${stats.formulas}`);
    }
    if (stats.ragContent !== undefined) {
      console.log(`🧠 محتوى RAG: ${stats.ragContent}`);
    }
    console.log('------------------------');
    
    // تحذير إذا كانت بعض النماذج غير متاحة
    if (!(prisma as any).concept || !(prisma as any).example || !(prisma as any).rAGContent) {
      console.log('\n⚠️ تنبيه: بعض النماذج غير متاحة!');
      console.log('لتفعيل جميع الميزات:');
      console.log('1. تأكد من تحديث prisma/schema.prisma');
      console.log('2. شغل: npx prisma migrate dev');
      console.log('3. شغل: npx prisma generate');
      console.log('4. أعد تشغيل هذا السكريبت');
    }
    
    console.log('\n✨ يمكنك الآن:');
    console.log('1. فتح Prisma Studio: npx prisma studio');
    console.log('2. اختبار البحث في المنهج');
    console.log('3. توليد أسئلة ديناميكية');
    
  } catch (error) {
    console.error('❌ خطأ في إدخال البيانات:', error);
    throw error;
  }
}

// دالة لحذف البيانات القديمة (اختيارية)
async function cleanDatabase() {
  console.log('🧹 حذف البيانات القديمة...');
  
  // حذف بالترتيب الصحيح (من الأطفال للآباء)
  await prisma.question.deleteMany();
  
  // حذف النماذج الجديدة إذا كانت موجودة
  if ((prisma as any).rAGContent) {
    await (prisma as any).rAGContent.deleteMany();
  }
  if ((prisma as any).formula) {
    await (prisma as any).formula.deleteMany();
  }
  if ((prisma as any).example) {
    await (prisma as any).example.deleteMany();
  }
  if ((prisma as any).concept) {
    await (prisma as any).concept.deleteMany();
  }
  
  await prisma.content.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.subject.deleteMany();
  
  console.log('✅ تم حذف البيانات القديمة');
}

// تنفيذ السكريبت
async function main() {
  console.log('🔄 بدء عملية إدخال البيانات...\n');
  
  // اسأل إذا كان يريد حذف البيانات القديمة
  const args = process.argv.slice(2);
  if (args.includes('--clean')) {
    await cleanDatabase();
  }
  
  await seedMathCurriculum();
}

// تشغيل السكريبت
main()
  .then(() => {
    console.log('\n🎉 اكتمل بنجاح!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 فشل:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });