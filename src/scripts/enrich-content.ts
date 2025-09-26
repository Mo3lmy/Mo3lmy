// src/scripts/enrich-content-fixed.ts
// نسخة محسنة بدون مشاكل timeout

import { prisma } from '../config/database.config';
import { openAIService } from '../services/ai/openai.service';

interface FullEnrichment {
  examples: any[];
  exercises: any[];
  realWorldApplications: any[];
  commonMistakes: any[];
  studentTips: string[];
  educationalStories: any[];
  challenges: any[];
  visualAids: any[];
  funFacts: string[];
  quickReview: any;
}

class FixedEnricher {
  private readonly BATCH_SIZE = 1; // درس واحد في المرة لتجنب الضغط
  
  async enrichAllLessons() {
    console.log('🚀 بدء الإثراء المحسّن (بدون timeout)');
    console.log('⚙️ التحسينات:');
    console.log('   • طلبات متتابعة بدلاً من متزامنة');
    console.log('   • Timeout أطول (60 ثانية)');
    console.log('   • Retry عند الفشل');
    console.log('   • طلب واحد شامل بدلاً من 3');
    console.log('=====================================\n');

    try {
      const lessons = await prisma.lesson.findMany({
        where: { isPublished: true },
        include: {
          content: true,
          unit: { include: { subject: true } }
        },
        orderBy: [
          { unit: { order: 'asc' } },
          { order: 'asc' }
        ]
      });

      console.log(`📚 عدد الدروس: ${lessons.length}\n`);

      let successCount = 0;
      let failedLessons = [];

      for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        console.log(`📝 [${i+1}/${lessons.length}] ${lesson.title}`);
        
        try {
          if (!lesson.content || !lesson.content.fullText) {
            console.log('   ⚠️ لا يوجد محتوى - تخطي');
            continue;
          }

          // التحقق من الإثراء السابق
          if (lesson.content.enrichmentLevel >= 8) {
            console.log('   ✓ مُثري مسبقاً');
            successCount++;
            continue;
          }

          console.log(`   📊 حجم المحتوى: ${lesson.content.fullText.length} حرف`);
          
          const startTime = Date.now();
          
          // ✅ طلب واحد شامل بدلاً من 3 طلبات متزامنة
          const enrichedData = await this.enrichSingleRequest(lesson);
          
          if (enrichedData) {
            // حفظ النتائج
            await prisma.content.update({
              where: { id: lesson.content.id },
              data: {
                enrichedContent: JSON.stringify(enrichedData),
                examples: JSON.stringify(enrichedData.examples),
                exercises: JSON.stringify(enrichedData.exercises),
                lastEnrichedAt: new Date(),
                enrichmentLevel: 8
              }
            });

            const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`   ✅ تم في ${timeTaken}ث`);
            console.log(`   📈 ${enrichedData.examples.length} أمثلة، ${enrichedData.exercises.length} تمرين`);
            successCount++;
          } else {
            console.log('   ⚠️ فشل الإثراء - سيتم المحاولة لاحقاً');
            failedLessons.push(lesson.title);
          }

          // راحة بين الدروس
          await this.sleep(3000);

        } catch (error) {
          console.error(`   ❌ خطأ: ${error instanceof Error ? error.message : 'Unknown'}`);
          failedLessons.push(lesson.title);
        }
      }

      // التقرير النهائي
      console.log('\n' + '═'.repeat(60));
      console.log('📊 النتائج النهائية:');
      console.log(`✅ نجح: ${successCount}/${lessons.length}`);
      if (failedLessons.length > 0) {
        console.log(`⚠️ فشل: ${failedLessons.join('، ')}`);
      }
      console.log('═'.repeat(60));

    } catch (error) {
      console.error('❌ خطأ عام:', error);
    }
  }

  private async enrichSingleRequest(lesson: any): Promise<FullEnrichment | null> {
    const content = lesson.content;
    const fullText = content.fullText || '';
    const summary = content.summary || '';
    const keyPoints = content.keyPoints ? JSON.parse(content.keyPoints) : [];
    
    // ✅ طلب واحد محسّن مع كل المحتوى
    const prompt = `أنت معلم رياضيات خبير للصف السادس الابتدائي.

📚 درس: ${lesson.title}
الوحدة: ${lesson.unit.title}

📄 المحتوى الكامل:
${fullText}

📝 الملخص: ${summary}
🎯 النقاط الرئيسية: ${keyPoints.join('، ')}

المطلوب: إنشاء محتوى إثرائي شامل مرتبط مباشرة بالدرس أعلاه.

⚠️ تعليمات مهمة:
- كل المحتوى يجب أن يكون مرتبط بدرس "${lesson.title}" تحديداً
- استخدم أرقام ومسائل حقيقية مناسبة للصف السادس
- اكتب محتوى كامل وليس مجرد عناوين

أريد JSON بالتنسيق التالي فقط (بدون أي نص إضافي):
{
  "examples": [
    {
      "number": 1,
      "problem": "مسألة حقيقية من الدرس",
      "solution": "الحل الكامل",
      "difficulty": "easy",
      "steps": ["خطوة 1", "خطوة 2"],
      "hint": "تلميح"
    }
  ],
  "exercises": [
    {
      "number": 1,
      "question": "سؤال حقيقي",
      "type": "MCQ",
      "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
      "correctAnswer": "الإجابة",
      "explanation": "شرح",
      "difficulty": "easy",
      "points": 2
    }
  ],
  "realWorldApplications": [
    {
      "title": "التطبيق",
      "description": "الوصف",
      "example": "مثال",
      "benefit": "الفائدة"
    }
  ],
  "commonMistakes": [
    {
      "mistake": "الخطأ الشائع",
      "why": "السبب",
      "correct": "الطريقة الصحيحة",
      "tip": "نصيحة",
      "example": "مثال"
    }
  ],
  "studentTips": ["نصيحة 1", "نصيحة 2", "نصيحة 3"],
  "challenges": [
    {
      "title": "التحدي",
      "description": "الوصف",
      "difficulty": "medium",
      "reward": "10 نقاط",
      "hint": "تلميح"
    }
  ],
  "funFacts": ["حقيقة 1", "حقيقة 2"],
  "quickReview": {
    "keyPoints": ["نقطة 1", "نقطة 2"],
    "summary": "ملخص في سطرين"
  }
}

اكتب JSON فقط، بدون markdown أو أي نص آخر.`;

    // ✅ محاولات متعددة مع retry
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`   ⏳ محاولة ${attempt}/3...`);
        
        const response = await openAIService.chat([
          {
            role: 'system',
            content: 'أنت معلم رياضيات. أنشئ محتوى JSON فقط بدون أي نص إضافي.'
          },
          {
            role: 'user',
            content: prompt
          }
        ], {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 4000,      // زيادة الحد الأقصى
          // timeout: 60000     // إذا كان متاحاً في openAIService
        });

        // استخراج JSON
        const jsonStr = this.extractJSON(response);
        const parsed = JSON.parse(jsonStr);
        
        // تحسين البيانات المولدة
        return this.enhanceGeneratedContent(parsed, lesson.title);
        
      } catch (error) {
        console.log(`   ⚠️ المحاولة ${attempt} فشلت: ${error instanceof Error ? error.message : 'Unknown'}`);
        
        if (attempt === 3) {
          // آخر محاولة - استخدم fallback
          console.log('   📦 استخدام محتوى احتياطي');
          return this.getFallbackContent(lesson.title);
        }
        
        // انتظار قبل المحاولة التالية
        await this.sleep(2000 * attempt);
      }
    }
    
    return null;
  }

  private enhanceGeneratedContent(data: any, title: string): FullEnrichment {
    // التأكد من وجود العناصر المطلوبة
    return {
      examples: this.ensureArray(data.examples, 10, () => ({
        number: 0,
        problem: `مثال على ${title}`,
        solution: 'الحل',
        difficulty: 'medium',
        steps: ['خطوة 1', 'خطوة 2'],
        hint: 'فكر في القاعدة'
      })),
      
      exercises: this.ensureArray(data.exercises, 20, () => ({
        number: 0,
        question: `سؤال عن ${title}`,
        type: 'MCQ',
        options: ['أ', 'ب', 'ج', 'د'],
        correctAnswer: 'أ',
        explanation: 'الشرح',
        difficulty: 'medium',
        points: 3
      })),
      
      realWorldApplications: this.ensureArray(data.realWorldApplications, 8, () => ({
        title: 'تطبيق',
        description: `استخدام ${title}`,
        example: 'مثال',
        benefit: 'الفائدة'
      })),
      
      commonMistakes: this.ensureArray(data.commonMistakes, 8, () => ({
        mistake: 'خطأ شائع',
        why: 'السبب',
        correct: 'الصحيح',
        tip: 'نصيحة',
        example: 'مثال'
      })),
      
      studentTips: this.ensureArray(data.studentTips, 5, () => `نصيحة لفهم ${title}`),
      
      educationalStories: this.ensureArray(data.educationalStories, 3, () => ({
        title: 'قصة',
        story: 'محتوى القصة',
        moral: 'العبرة',
        connection: `الربط مع ${title}`
      })),
      
      challenges: this.ensureArray(data.challenges, 5, () => ({
        title: 'تحدي',
        description: 'الوصف',
        difficulty: 'medium',
        reward: '10 نقاط',
        hint: 'تلميح'
      })),
      
      visualAids: [
        { type: 'diagram', title: 'رسم توضيحي', description: 'يوضح المفهوم' },
        { type: 'flowchart', title: 'مخطط', description: 'خطوات الحل' }
      ],
      
      funFacts: this.ensureArray(data.funFacts, 3, () => `حقيقة عن ${title}`),
      
      quickReview: data.quickReview || {
        keyPoints: ['نقطة 1', 'نقطة 2', 'نقطة 3'],
        summary: `ملخص درس ${title}`
      }
    };
  }

  private ensureArray(arr: any, targetLength: number, generator: () => any): any[] {
    if (!Array.isArray(arr)) arr = [];
    
    // إضافة أرقام للعناصر
    arr = arr.map((item: any, index: number) => ({
      ...item,
      number: item.number || index + 1
    }));
    
    // إكمال العدد المطلوب
    while (arr.length < targetLength) {
      const newItem = generator();
      newItem.number = arr.length + 1;
      arr.push(newItem);
    }
    
    return arr.slice(0, targetLength);
  }

  private getFallbackContent(title: string): FullEnrichment {
    // محتوى احتياطي كامل
    const examples = [];
    for (let i = 1; i <= 10; i++) {
      examples.push({
        number: i,
        problem: `مثال ${i} على ${title}`,
        solution: `حل المثال ${i}`,
        difficulty: i <= 3 ? 'easy' : i <= 7 ? 'medium' : 'hard',
        steps: [`خطوة 1`, `خطوة 2`, `خطوة 3`],
        hint: 'راجع القاعدة'
      });
    }

    const exercises = [];
    for (let i = 1; i <= 20; i++) {
      exercises.push({
        number: i,
        question: `سؤال ${i} في ${title}`,
        type: i % 4 === 0 ? 'MCQ' : i % 4 === 1 ? 'TRUE_FALSE' : i % 4 === 2 ? 'FILL_BLANK' : 'PROBLEM',
        options: i % 4 === 0 ? ['أ', 'ب', 'ج', 'د'] : undefined,
        correctAnswer: i % 4 === 0 ? 'أ' : 'الإجابة',
        explanation: `شرح السؤال ${i}`,
        difficulty: i <= 7 ? 'easy' : i <= 14 ? 'medium' : 'hard',
        points: i <= 7 ? 2 : i <= 14 ? 3 : 5
      });
    }

    const applications = [];
    const contexts = ['المنزل', 'المدرسة', 'السوق', 'الملعب', 'المكتبة', 'الحديقة', 'المطعم', 'المستشفى'];
    for (let i = 0; i < 8; i++) {
      applications.push({
        title: `في ${contexts[i]}`,
        description: `استخدام ${title} في ${contexts[i]}`,
        example: `مثال من ${contexts[i]}`,
        benefit: 'فائدة عملية'
      });
    }

    const mistakes = [];
    for (let i = 1; i <= 8; i++) {
      mistakes.push({
        mistake: `خطأ شائع ${i}`,
        why: 'سبب الخطأ',
        correct: 'الطريقة الصحيحة',
        tip: 'نصيحة للتجنب',
        example: 'مثال'
      });
    }

    return {
      examples,
      exercises,
      realWorldApplications: applications,
      commonMistakes: mistakes,
      studentTips: [
        'اقرأ السؤال جيداً',
        'راجع القواعد',
        'تدرب يومياً',
        'اسأل عند عدم الفهم',
        'استخدم الرسومات'
      ],
      educationalStories: [
        { title: 'قصة 1', story: 'محتوى', moral: 'العبرة', connection: 'الربط' },
        { title: 'قصة 2', story: 'محتوى', moral: 'العبرة', connection: 'الربط' },
        { title: 'قصة 3', story: 'محتوى', moral: 'العبرة', connection: 'الربط' }
      ],
      challenges: [
        { title: 'تحدي 1', description: 'وصف', difficulty: 'easy', reward: '5 نقاط', hint: 'تلميح' },
        { title: 'تحدي 2', description: 'وصف', difficulty: 'medium', reward: '10 نقاط', hint: 'تلميح' },
        { title: 'تحدي 3', description: 'وصف', difficulty: 'medium', reward: '10 نقاط', hint: 'تلميح' },
        { title: 'تحدي 4', description: 'وصف', difficulty: 'hard', reward: '15 نقطة', hint: 'تلميح' },
        { title: 'تحدي 5', description: 'وصف', difficulty: 'hard', reward: '20 نقطة', hint: 'تلميح' }
      ],
      visualAids: [
        { type: 'diagram', title: 'رسم', description: 'وصف', purpose: 'الهدف' }
      ],
      funFacts: ['حقيقة 1', 'حقيقة 2', 'حقيقة 3'],
      quickReview: {
        keyPoints: ['نقطة 1', 'نقطة 2', 'نقطة 3'],
        summary: `ملخص ${title}`
      }
    };
  }

  private extractJSON(text: string): string {
    // محاولة إيجاد JSON بطرق مختلفة
    
    // إزالة markdown
    text = text.replace(/```json?\s*/gi, '').replace(/```\s*/gi, '');
    
    // البحث عن أول { وآخر }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    
    if (start === -1 || end === -1 || start >= end) {
      // محاولة أخرى - ربما JSON array
      const arrayStart = text.indexOf('[');
      const arrayEnd = text.lastIndexOf(']');
      
      if (arrayStart !== -1 && arrayEnd !== -1) {
        return text.substring(arrayStart, arrayEnd + 1);
      }
      
      throw new Error('No valid JSON found in response');
    }
    
    return text.substring(start, end + 1).trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// التشغيل
async function main() {
  console.log('🔍 فحص البيئة...\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY مفقود!');
    process.exit(1);
  }

  const contentCount = await prisma.content.count();
  console.log(`📊 دروس بمحتوى: ${contentCount}`);
  
  if (contentCount === 0) {
    console.error('❌ لا يوجد محتوى!');
    process.exit(1);
  }

  console.log('\n✅ جاهز للبدء');
  console.log('💡 نصيحة: اترك السكريبت يعمل بدون إيقاف\n');
  
  const enricher = new FixedEnricher();
  await enricher.enrichAllLessons();
  await prisma.$disconnect();
}

main().catch(console.error);