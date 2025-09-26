/* cspell:disable */
// prisma/seeds/seed-curriculum.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
// إضافة import لـ OpenAI service
import { openAIService } from '../../src/services/ai/openai.service';

const prisma = new PrismaClient();

// توليد embedding حقيقي مع OpenAI أو محلي كـ fallback
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // محاولة استخدام OpenAI API
    const { embedding } = await openAIService.generateEmbedding(text);
    return embedding;
  } catch (error) {
    // في حالة الفشل، استخدم embedding محلي
    console.log('      ⚠️ استخدام embedding محلي (OpenAI غير متاح)');
    
    const hash = createHash('sha256').update(text).digest();
    const embedding: number[] = [];
    
    // OpenAI يستخدم 1536 dimensions
    for (let i = 0; i < 1536; i++) {
      const byte = hash[i % hash.length];
      embedding.push((byte / 255) * 2 - 1); // تطبيع بين -1 و 1
    }
    
    return embedding;
  }
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

async function seedMathCurriculum() {
  console.log('🚀 بدء إدخال منهج الرياضيات...');
  console.log('⚠️ ملاحظة: تأكد من تشغيل "npx prisma generate" بعد تحديث Schema');
  
  // تحقق من OpenAI API
  if (process.env.OPENAI_API_KEY) {
    console.log('✅ OpenAI API متاح - سيتم إنشاء embeddings حقيقية');
  } else {
    console.log('⚠️ OpenAI API غير متاح - سيتم استخدام embeddings محلية');
  }
  
  try {
    // قراءة البيانات من الملف
    const dataPath = path.join(__dirname, '../../data/curriculum-data.json');
    
    // إذا لم يجد الملف، جرب مسار آخر
    let curriculumData: any;
    
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
    
    console.log(`📚 تم قراءة ${curriculumData.units?.length || 0} وحدات`);
    
    // 1. إنشاء المادة الدراسية - flexible لأي شكل data
    const subjectName = curriculumData.subject?.name || curriculumData.subject?.nameAr || 'الرياضيات';
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
    
    console.log(`✅ تم إنشاء المادة: ${subject.name} (${subject.nameEn})`);
    
    let totalLessons = 0;
    let totalConcepts = 0;
    let totalExamples = 0;
    let totalQuestions = 0;
    let totalEmbeddings = 0;
    
    // 2. إدخال الوحدات والدروس - بمرونة كاملة
    const units = curriculumData.units || [];
    
    for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
      const unitData = units[unitIndex];
      
      // استخراج بيانات الوحدة بمرونة
      const unitTitle = unitData.title || unitData.titleAr || unitData.titleEn || `الوحدة ${unitIndex + 1}`;
      const unitTitleEn = unitData.titleEn || unitData.title || `Unit ${unitIndex + 1}`;
      const unitOrder = unitData.unitNumber || unitData.order || unitIndex + 1;
      
      console.log(`\n📂 معالجة الوحدة ${unitOrder}: ${unitTitle}`);
      
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
      
      // إدخال الدروس
      const lessons = unitData.lessons || [];
      
      for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex++) {
        const lessonData = lessons[lessonIndex];
        
        // استخراج بيانات الدرس بمرونة
        const lessonTitle = lessonData.title || lessonData.titleAr || lessonData.titleEn || `الدرس ${lessonIndex + 1}`;
        const lessonTitleEn = lessonData.titleEn || lessonData.title || `Lesson ${lessonIndex + 1}`;
        const lessonOrder = lessonData.lessonNumber || lessonData.order || lessonIndex + 1;
        const lessonDuration = parseInt(lessonData.duration) || 45;
        
        console.log(`  📝 إضافة الدرس ${lessonOrder}: ${lessonTitle}`);
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
            duration: lessonDuration,
            isPublished: true,
            publishedAt: new Date(),
            description: lessonData.objectives?.[0] || lessonData.content?.introduction || lessonTitle,
            summary: lessonData.content?.introduction?.substring(0, 500) || lessonData.content?.summary || '',
            keyPoints: JSON.stringify(lessonData.objectives || [])
          }
        });
        
        // معالجة المحتوى بمرونة كاملة
        let fullText = '';
        let summary = '';
        let keyPoints: string[] = [];
        let examples: any[] = [];
        let concepts: string[] = [];
        
        if (lessonData.content) {
          // جمع النص من كل الحقول المتاحة
          const textParts: string[] = [];
          
          // جمع كل النصوص الموجودة
          if (lessonData.content.introduction) textParts.push(lessonData.content.introduction);
          if (lessonData.content.fullText) textParts.push(lessonData.content.fullText);
          if (lessonData.content.summary) textParts.push(lessonData.content.summary);
          if (lessonData.content.mainContent) textParts.push(lessonData.content.mainContent);
          if (lessonData.content.text) textParts.push(lessonData.content.text);
          if (lessonData.content.description) textParts.push(lessonData.content.description);
          
          // إضافة نصوص من حقول أخرى
          for (const [key, value] of Object.entries(lessonData.content)) {
            if (typeof value === 'string' && value.length > 50 && !textParts.includes(value)) {
              textParts.push(value);
            } else if (typeof value === 'object' && value && !Array.isArray(value)) {
              const extracted = extractText(value);
              if (extracted && extracted.length > 50) {
                textParts.push(extracted);
              }
            }
          }
          
          fullText = textParts.filter(Boolean).join('\n\n');
          
          // إذا لم نجد نص، نبني واحد من المتاح
          if (!fullText) {
            const allText: string[] = [lessonTitle];
            if (lessonData.objectives) allText.push(...lessonData.objectives);
            if (lessonData.content.keyPoints) allText.push(...lessonData.content.keyPoints);
            if (lessonData.content.concepts) allText.push(...lessonData.content.concepts);
            fullText = allText.join('\n');
          }
          
          // الملخص
          summary = lessonData.content.summary || 
                   lessonData.content.introduction?.substring(0, 500) ||
                   fullText.substring(0, 500) ||
                   `ملخص ${lessonTitle}`;
          
          // النقاط الرئيسية
          keyPoints = lessonData.objectives || 
                     lessonData.content.keyPoints || 
                     lessonData.content.mainPoints ||
                     lessonData.content.bulletPoints ||
                     [`النقطة الرئيسية في ${lessonTitle}`];
                     
          // تأكد أن keyPoints array
          if (!Array.isArray(keyPoints)) {
            keyPoints = typeof keyPoints === 'string' ? [keyPoints] : [];
          }
          
          // الأمثلة - من أي مصدر ممكن
          if (lessonData.content.examples && Array.isArray(lessonData.content.examples)) {
            examples = lessonData.content.examples.map((ex: any, idx: number) => {
              if (typeof ex === 'object' && (ex.problem || ex.question)) {
                return {
                  problem: ex.problem || ex.question || `مثال ${idx + 1}`,
                  solution: ex.solution || ex.answer || 'الحل'
                };
              } else if (typeof ex === 'string') {
                return { problem: ex, solution: 'الحل' };
              } else {
                return { problem: `مثال ${idx + 1}`, solution: 'الحل' };
              }
            });
          } else if (lessonData.content.practiceProblems) {
            const problems = Array.isArray(lessonData.content.practiceProblems) 
              ? lessonData.content.practiceProblems 
              : [lessonData.content.practiceProblems];
              
            examples = problems.map((p: any, i: number) => {
              if (typeof p === 'string') {
                return { problem: p, solution: 'الحل' };
              } else if (p.problems && Array.isArray(p.problems)) {
                return p.problems.map((prob: string, j: number) => ({
                  problem: prob,
                  solution: p.answers?.[j] || p.solutions?.[j] || 'الحل'
                }));
              } else {
                return {
                  problem: p.problem || p.question || p.text || `مثال ${i + 1}`,
                  solution: p.solution || p.answer || p.answers?.[0] || 'الحل'
                };
              }
            }).flat();
          } else {
            // إذا مافيش أمثلة، نعمل واحد افتراضي
            examples = [{ 
              problem: `مثال على ${lessonTitle}`, 
              solution: `حل المثال` 
            }];
          }
          
          // المفاهيم
          concepts = lessonData.content.concepts || 
                    lessonData.content.mainConcepts ||
                    lessonData.content.topics ||
                    lessonData.content.keywords ||
                    [lessonTitle];
                    
          // تأكد أن concepts array
          if (!Array.isArray(concepts)) {
            concepts = typeof concepts === 'string' ? [concepts] : [lessonTitle];
          }
        } else {
          // إذا مافيش content object خالص
          fullText = lessonData.text || lessonData.description || `محتوى ${lessonTitle}`;
          summary = fullText.substring(0, 500);
          keyPoints = lessonData.objectives || [`نقطة رئيسية في ${lessonTitle}`];
          examples = [{ problem: `مثال على ${lessonTitle}`, solution: 'الحل' }];
          concepts = [lessonTitle];
        }
        
        // تأكد من وجود محتوى على الأقل
        if (!fullText || fullText.trim().length === 0) {
          fullText = `${lessonTitle} - ${unitTitle}\n${keyPoints.join('\n')}`;
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
        
        // إنشاء ContentEmbedding للبحث
        try {
          console.log('    🤖 إنشاء embeddings للمحتوى...');
          
          const contentForEmbedding = `
            ${lessonTitle} ${lessonTitleEn}
            ${summary}
            ${keyPoints.join(' ')}
            ${concepts.join(' ')}
            ${examples.map((e: any) => `${e.problem} ${e.solution}`).join(' ')}
          `.trim().substring(0, 2000);
          
          // توليد embedding حقيقي
          const embedding = await generateEmbedding(contentForEmbedding);
          
          // حفظ في جدول ContentEmbedding
          await prisma.contentEmbedding.create({
            data: {
              id: generateUniqueId('EMBED'),
              contentId: content.id,
              chunkIndex: 0,
              chunkText: contentForEmbedding.substring(0, 1000),
              embedding: JSON.stringify(embedding),
              metadata: JSON.stringify({
                lessonTitle: lessonTitle,
                lessonTitleEn: lessonTitleEn,
                unitTitle: unitTitle,
                unitTitleEn: unitTitleEn,
                subject: subject.name,
                grade: subjectGrade,
                concepts: concepts,
                keyPoints: keyPoints
              })
            }
          });
          
          totalEmbeddings++;
          console.log('    ✅ تم إنشاء embedding');
          
        } catch (error: any) {
          console.log('    ⚠️ فشل إنشاء embedding:', error.message);
        }
        
        // إضافة المفاهيم (إذا كان النموذج متاحاً)
        if ((prisma as any).concept) {
          try {
            for (const concept of concepts) {
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
          } catch (error) {
            // Concept model doesn't exist, skip
          }
        }
        
        // إضافة الأمثلة (إذا كان النموذج متاحاً)
        if ((prisma as any).example) {
          try {
            let exampleOrder = 1;
            for (const example of examples) {
              await (prisma as any).example.create({
                data: {
                  id: generateUniqueId('EXAMPLE'),
                  problem: example.problem || `مثال ${exampleOrder}`,
                  solution: example.solution || 'الحل',
                  lessonId: lesson.id,
                  order: exampleOrder++
                }
              });
              totalExamples++;
            }
          } catch (error) {
            // Example model doesn't exist, skip
          }
        }
        
        // إضافة الصيغ الرياضية (إذا كانت موجودة)
        if ((prisma as any).formula && lessonData.content?.formulas) {
          try {
            const formulas = Array.isArray(lessonData.content.formulas) 
              ? lessonData.content.formulas 
              : [];
              
            for (const formula of formulas) {
              await (prisma as any).formula.create({
                data: {
                  id: generateUniqueId('FORMULA'),
                  expression: formula,
                  description: `صيغة رياضية`,
                  lessonId: lesson.id
                }
              });
            }
          } catch (error) {
            // Formula model doesn't exist, skip
          }
        }
        
        // إضافة بعض الأسئلة النموذجية
        const sampleQuestions = [
          {
            type: 'MCQ',
            text: `ما هو موضوع درس "${lessonTitle}"؟`,
            options: [
              summary.substring(0, 50),
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
            text: `صح أم خطأ: ${keyPoints[0] || lessonTitle + ' مهم'}؟`,
            correctAnswer: 'true',
            difficulty: 'MEDIUM',
            points: 2
          },
          {
            type: 'FILL_BLANK',
            text: `أكمل: ${lessonTitle} هو درس يتحدث عن _____.`,
            correctAnswer: concepts[0] || 'المفهوم الأساسي',
            difficulty: 'EASY',
            points: 1
          }
        ];
        
        for (const q of sampleQuestions) {
          try {
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
            
            await prisma.question.create({
              data: questionData
            });
            totalQuestions++;
          } catch (error) {
            console.log('    ⚠️ فشل إنشاء سؤال:', error);
          }
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
      content: await prisma.content.count(),
      contentEmbeddings: await prisma.contentEmbedding.count()
    };
    
    console.log('\n📊 الإحصائيات النهائية:');
    console.log('------------------------');
    console.log(`📚 المواد: ${stats.subjects}`);
    console.log(`📂 الوحدات: ${stats.units}`);
    console.log(`📝 الدروس: ${stats.lessons}`);
    console.log(`📄 المحتوى: ${stats.content}`);
    console.log(`🧠 Embeddings: ${stats.contentEmbeddings}`);
    console.log(`❓ الأسئلة: ${stats.questions}`);
    console.log('------------------------');
    
    // تحقق من حالة Embeddings
    if (stats.contentEmbeddings > 0) {
      console.log('\n✅ النظام جاهز للعمل مع RAG!');
      console.log(`   تم إنشاء ${stats.contentEmbeddings} embeddings`);
      if (process.env.OPENAI_API_KEY) {
        console.log('   ✨ باستخدام OpenAI embeddings حقيقية');
      } else {
        console.log('   ⚠️ باستخدام embeddings محلية (Mock)');
      }
    } else {
      console.log('\n⚠️ لم يتم إنشاء embeddings!');
      console.log('   تحقق من:');
      console.log('   1. وجود جدول ContentEmbedding');
      console.log('   2. تشغيل migrations');
    }
    
    console.log('\n✨ يمكنك الآن:');
    console.log('1. فتح Prisma Studio: npx prisma studio');
    console.log('2. اختبار البحث في المنهج');
    console.log('3. طرح الأسئلة والحصول على إجابات من المحتوى');
    console.log('4. توليد أسئلة ديناميكية');
    
  } catch (error) {
    console.error('❌ خطأ في إدخال البيانات:', error);
    throw error;
  }
}

// دالة لحذف البيانات القديمة
async function cleanDatabase() {
  console.log('🧹 حذف البيانات القديمة...');
  
  try {
    await prisma.question.deleteMany();
    await prisma.contentEmbedding.deleteMany();
    
    // حذف الجداول الاختيارية إن وجدت
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
  } catch (error) {
    console.log('⚠️ بعض الجداول غير موجودة، تجاهل...');
  }
}

// دالة معالجة المحتوى الإضافية
async function processAdditionalContent() {
  console.log('\n🤖 معالجة محتوى إضافي لـ RAG...');
  
  try {
    const documentProcessorModule = await import('../../src/core/rag/document.processor');
    const { documentProcessor } = documentProcessorModule;
    
    await documentProcessor.processAllContent();
    console.log('✅ اكتملت معالجة المحتوى الإضافية!');
    return true;
  } catch (error: any) {
    console.log('⚠️ لم تتم معالجة إضافية:', error.message);
    console.log('   يمكن تشغيلها لاحقاً: npm run content:process');
    return false;
  }
}

// الدالة الرئيسية
async function main() {
  console.log('🔄 بدء عملية إدخال البيانات...\n');
  
  const args = process.argv.slice(2);
  
  if (args.includes('--clean')) {
    await cleanDatabase();
  }
  
  // إدخال البيانات الأساسية
  await seedMathCurriculum();
  
  // معالجة إضافية (اختيارية)
  if (args.includes('--process')) {
    await processAdditionalContent();
  } else {
    console.log('\n💡 نصيحة: لمعالجة محتوى إضافي، شغل:');
    console.log('   npm run content:process');
  }
}

// تشغيل البرنامج
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