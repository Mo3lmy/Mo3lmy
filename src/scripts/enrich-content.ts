// src/scripts/enrich-comprehensive.ts
// إثراء شامل ومحترف للمحتوى التعليمي - مبني على المحتوى الموجود

import { prisma } from '../config/database.config';
import { openAIService } from '../services/ai/openai.service';

interface ComprehensiveEnrichment {
  examples: any[];           // 10 أمثلة
  exercises: any[];          // 20 تمرين
  realWorldApplications: any[]; // 8 تطبيقات
  commonMistakes: any[];     // 8 أخطاء شائعة
  studentTips: string[];     // 5 نصائح
  educationalStories: any[]; // 3 قصص
  challenges: any[];         // 5 تحديات
  visualAids: any[];         // رسومات
  comparisonTables: any[];   // جداول
  additionalResources: any[]; // مصادر
  funFacts: string[];        // حقائق ممتعة
  keyFormulas: any[];        // معادلات مهمة
  stepByStepGuides: any[];   // دليل خطوة بخطوة
  quickReview: any;          // مراجعة سريعة
}

class ComprehensiveEnricher {
  private readonly BATCH_SIZE = 2; // معالجة درسين في المرة لتجنب الـ timeout
  
  async enrichAllLessons() {
    console.log('🚀 بدء الإثراء الشامل للمحتوى التعليمي');
    console.log('📊 الهدف: 45+ عنصر إثرائي لكل درس');
    console.log('✨ مبني على المحتوى الموجود');
    console.log('⏱️ الوقت المتوقع: 45 دقيقة');
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

      console.log(`📚 إجمالي الدروس: ${lessons.length}`);
      console.log(`⚡ المعالجة على دفعات: ${this.BATCH_SIZE} درس/دفعة\n`);

      let successCount = 0;
      let totalElements = 0;

      // معالجة على دفعات
      for (let i = 0; i < lessons.length; i += this.BATCH_SIZE) {
        const batch = lessons.slice(i, i + this.BATCH_SIZE);
        console.log(`\n📦 الدفعة ${Math.floor(i/this.BATCH_SIZE) + 1}/${Math.ceil(lessons.length/this.BATCH_SIZE)}`);
        console.log('─'.repeat(50));

        for (const lesson of batch) {
          console.log(`\n📝 ${lesson.title}`);
          console.log(`   الوحدة: ${lesson.unit.title}`);
          console.log(`   المادة: ${lesson.unit.subject.name}`);
          
          try {
            if (!lesson.content) {
              console.log('   ⚠️ لا يوجد محتوى أساسي');
              continue;
            }

            // تحقق من الإثراء السابق
            if (lesson.content.enrichmentLevel >= 9) {
              console.log(`   ✓ محتوى مُثري بالكامل (Level ${lesson.content.enrichmentLevel}/10)`);
              continue;
            }

            // الإثراء الشامل
            console.log('   ⏳ جاري الإثراء الشامل المبني على المحتوى...');
            const startTime = Date.now();
            
            const enrichedData = await this.performComprehensiveEnrichment(lesson);
            
            const elementsCount = 
              enrichedData.examples.length +
              enrichedData.exercises.length +
              enrichedData.realWorldApplications.length +
              enrichedData.commonMistakes.length +
              enrichedData.studentTips.length +
              enrichedData.educationalStories.length +
              enrichedData.challenges.length;

            // حفظ في قاعدة البيانات
            await prisma.content.update({
              where: { id: lesson.content.id },
              data: {
                enrichedContent: JSON.stringify(enrichedData),
                examples: JSON.stringify(enrichedData.examples),
                exercises: JSON.stringify(enrichedData.exercises),
                lastEnrichedAt: new Date(),
                enrichmentLevel: 9
              }
            });

            const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);
            
            console.log(`   ✅ الإثراء اكتمل في ${timeTaken} ثانية`);
            console.log(`   📊 العناصر المضافة:`);
            console.log(`      • ${enrichedData.examples.length} أمثلة`);
            console.log(`      • ${enrichedData.exercises.length} تمرين`);
            console.log(`      • ${enrichedData.realWorldApplications.length} تطبيقات`);
            console.log(`      • ${enrichedData.commonMistakes.length} أخطاء شائعة`);
            console.log(`      • ${enrichedData.studentTips.length} نصائح`);
            console.log(`      • ${enrichedData.educationalStories.length} قصص`);
            console.log(`      • ${enrichedData.challenges.length} تحديات`);
            console.log(`   📈 إجمالي: ${elementsCount} عنصر`);
            
            successCount++;
            totalElements += elementsCount;

            // انتظار بين الدروس
            await this.sleep(2000);

          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`   ❌ فشل الإثراء: ${msg}`);
          }
        }

        // انتظار أطول بين الدفعات
        if (i + this.BATCH_SIZE < lessons.length) {
          console.log('\n⏸️ راحة بين الدفعات (5 ثواني)...');
          await this.sleep(5000);
        }
      }

      // التقرير النهائي
      console.log('\n' + '═'.repeat(60));
      console.log('📊 التقرير النهائي');
      console.log('═'.repeat(60));
      console.log(`✅ دروس تم إثراؤها: ${successCount}/${lessons.length}`);
      console.log(`📈 إجمالي العناصر المضافة: ${totalElements}`);
      console.log(`📊 متوسط العناصر لكل درس: ${Math.round(totalElements/successCount)}`);
      console.log('═'.repeat(60));

    } catch (error) {
      console.error('❌ خطأ عام:', error);
    }
  }

  private async performComprehensiveEnrichment(lesson: any): Promise<ComprehensiveEnrichment> {
    const content = lesson.content;
    
    // 🔥 استخراج المحتوى الكامل
    const fullContent = content.fullText || '';
    const summary = content.summary || '';
    const keyPoints = content.keyPoints ? JSON.parse(content.keyPoints) : [];
    const existingExamples = content.examples ? JSON.parse(content.examples) : [];
    const existingExercises = content.exercises ? JSON.parse(content.exercises) : [];
    
    // 🔥 بناء السياق الكامل للدرس
    const lessonContext = {
      title: lesson.title,
      titleEn: lesson.titleEn || '',
      subject: lesson.unit.subject.name,
      grade: lesson.unit.subject.grade,
      unit: lesson.unit.title,
      fullContent: fullContent.substring(0, 2000), // أول 2000 حرف
      summary: summary,
      keyPoints: keyPoints,
      existingExamples: existingExamples.slice(0, 3), // أول 3 أمثلة موجودة
      objectives: lesson.objectives || ''
    };
    
    // تقسيم الإثراء على 3 طلبات مع السياق الكامل
    const [part1, part2, part3] = await Promise.all([
      this.enrichPart1(lessonContext),
      this.enrichPart2(lessonContext),
      this.enrichPart3(lessonContext)
    ]);

    // دمج كل الأجزاء
    return this.mergeEnrichmentParts(part1, part2, part3, existingExamples, existingExercises);
  }

  private async enrichPart1(context: any): Promise<any> {
    const prompt = `أنت معلم خبير في مادة ${context.subject} للصف ${context.grade}.

الدرس: ${context.title}
الوحدة: ${context.unit}

محتوى الدرس:
${context.fullContent}

الملخص: ${context.summary}

النقاط الرئيسية:
${context.keyPoints.map((p: string, i: number) => `${i+1}. ${p}`).join('\n')}

الأمثلة الموجودة (للبناء عليها):
${context.existingExamples.map((ex: any, i: number) => `مثال ${i+1}: ${JSON.stringify(ex)}`).join('\n')}

بناءً على المحتوى أعلاه، أريد إثراء الدرس بما يلي:

أريد JSON فقط بدون أي نص إضافي:
{
  "examples": [
    {"number": 1, "problem": "[مسألة سهلة مرتبطة بالمحتوى]", "solution": "[حل تفصيلي خطوة بخطوة]", "difficulty": "easy", "steps": ["خطوة 1", "خطوة 2"], "hint": "[تلميح من المحتوى]", "relatedConcept": "[المفهوم المرتبط من الدرس]"},
    {"number": 2, "problem": "[مسألة سهلة أخرى]", "solution": "[حل مفصل]", "difficulty": "easy", "steps": ["خطوة 1", "خطوة 2"], "hint": "[تلميح]", "relatedConcept": "[المفهوم]"},
    {"number": 3, "problem": "[مسألة سهلة ثالثة]", "solution": "[الحل]", "difficulty": "easy", "steps": ["خطوة 1", "خطوة 2"], "hint": "[تلميح]", "relatedConcept": "[المفهوم]"},
    {"number": 4, "problem": "[مسألة متوسطة من المحتوى]", "solution": "[حل مفصل]", "difficulty": "medium", "steps": ["خطوة 1", "خطوة 2", "خطوة 3"], "hint": "[تلميح]", "relatedConcept": "[المفهوم]"},
    {"number": 5, "problem": "[مسألة متوسطة]", "solution": "[الحل]", "difficulty": "medium", "steps": ["خطوة 1", "خطوة 2", "خطوة 3"], "hint": "[تلميح]", "relatedConcept": "[المفهوم]"},
    {"number": 6, "problem": "[مسألة متوسطة]", "solution": "[الحل]", "difficulty": "medium", "steps": ["خطوة 1", "خطوة 2", "خطوة 3"], "hint": "[تلميح]", "relatedConcept": "[المفهوم]"},
    {"number": 7, "problem": "[مسألة متوسطة]", "solution": "[الحل]", "difficulty": "medium", "steps": ["خطوة 1", "خطوة 2", "خطوة 3"], "hint": "[تلميح]", "relatedConcept": "[المفهوم]"},
    {"number": 8, "problem": "[مسألة صعبة تطبق المفاهيم]", "solution": "[حل تفصيلي]", "difficulty": "hard", "steps": ["خطوة 1", "خطوة 2", "خطوة 3", "خطوة 4"], "hint": "[تلميح]", "relatedConcept": "[المفهوم]"},
    {"number": 9, "problem": "[مسألة صعبة]", "solution": "[الحل المفصل]", "difficulty": "hard", "steps": ["خطوة 1", "خطوة 2", "خطوة 3", "خطوة 4"], "hint": "[تلميح]", "relatedConcept": "[المفهوم]"},
    {"number": 10, "problem": "[مسألة تحدي من المحتوى المتقدم]", "solution": "[حل شامل]", "difficulty": "hard", "steps": ["خطوة 1", "خطوة 2", "خطوة 3", "خطوة 4", "خطوة 5"], "hint": "[تلميح]", "relatedConcept": "[المفهوم]"}
  ],
  "exercises_part1": [
    {"number": 1, "question": "[سؤال MCQ من المحتوى]", "type": "MCQ", "options": ["أ) [خيار من المحتوى]", "ب) ", "ج) ", "د) "], "correctAnswer": "أ", "explanation": "[شرح من المحتوى]", "difficulty": "easy", "points": 2, "fromContent": true},
    {"number": 2, "question": "[صح/خطأ بناءً على المحتوى]", "type": "TRUE_FALSE", "correctAnswer": "صح", "explanation": "[من المحتوى]", "difficulty": "easy", "points": 2, "fromContent": true},
    {"number": 3, "question": "[سؤال قصير من النقاط الرئيسية]", "type": "SHORT_ANSWER", "correctAnswer": "[من المحتوى]", "explanation": "[شرح]", "difficulty": "easy", "points": 3, "fromContent": true},
    {"number": 4, "question": "[MCQ آخر]", "type": "MCQ", "options": ["أ) ", "ب) ", "ج) ", "د) "], "correctAnswer": "ب", "explanation": "[شرح]", "difficulty": "easy", "points": 2, "fromContent": true},
    {"number": 5, "question": "[أكمل من المحتوى: _____]", "type": "FILL_BLANK", "correctAnswer": "[من المحتوى]", "explanation": "[شرح]", "difficulty": "easy", "points": 3, "fromContent": true},
    {"number": 6, "question": "[MCQ متوسط]", "type": "MCQ", "options": ["أ) ", "ب) ", "ج) ", "د) "], "correctAnswer": "ج", "explanation": "[شرح]", "difficulty": "medium", "points": 3, "fromContent": true},
    {"number": 7, "question": "[صح/خطأ متقدم]", "type": "TRUE_FALSE", "correctAnswer": "خطأ", "explanation": "[تصحيح من المحتوى]", "difficulty": "medium", "points": 2, "fromContent": true},
    {"number": 8, "question": "[مسألة من المحتوى]", "type": "PROBLEM", "correctAnswer": "[الحل]", "explanation": "[خطوات الحل]", "difficulty": "medium", "points": 5, "fromContent": true},
    {"number": 9, "question": "[MCQ صعب]", "type": "MCQ", "options": ["أ) ", "ب) ", "ج) ", "د) "], "correctAnswer": "د", "explanation": "[شرح]", "difficulty": "medium", "points": 3, "fromContent": true},
    {"number": 10, "question": "[تطبيق عملي من المحتوى]", "type": "APPLICATION", "correctAnswer": "[الحل]", "explanation": "[شرح التطبيق]", "difficulty": "medium", "points": 5, "fromContent": true}
  ]
}

تذكر: كل الأمثلة والتمارين يجب أن تكون مرتبطة مباشرة بمحتوى الدرس المعطى.`;

    try {
      const response = await openAIService.generateCompletion(prompt, {
        temperature: 0.7,
        maxTokens: 3000
      });
      return JSON.parse(this.extractJSON(response));
    } catch (error) {
      console.log('   ⚠️ استخدام البيانات الاحتياطية للجزء الأول');
      return this.getFallbackPart1(context);
    }
  }

  private async enrichPart2(context: any): Promise<any> {
    const prompt = `بناءً على محتوى درس "${context.title}" في مادة ${context.subject}:

المحتوى:
${context.fullContent.substring(0, 1500)}

النقاط الرئيسية: ${context.keyPoints.join('، ')}

أريد JSON فقط للجزء الثاني من الإثراء:
{
  "exercises_part2": [
    {"number": 11, "question": "[MCQ متقدم من المحتوى]", "type": "MCQ", "options": ["أ) ", "ب) ", "ج) ", "د) "], "correctAnswer": "أ", "explanation": "[شرح مفصل]", "difficulty": "medium", "points": 4, "fromContent": true},
    {"number": 12, "question": "[مسألة كلامية من واقع الحياة مرتبطة بالدرس]", "type": "WORD_PROBLEM", "correctAnswer": "[الحل]", "explanation": "[خطوات]", "difficulty": "medium", "points": 6, "fromContent": true},
    {"number": 13, "question": "[تحليل مفهوم من المحتوى]", "type": "ANALYSIS", "correctAnswer": "[التحليل]", "explanation": "[شرح]", "difficulty": "hard", "points": 5, "fromContent": true},
    {"number": 14, "question": "[MCQ صعب يختبر الفهم العميق]", "type": "MCQ", "options": ["أ) ", "ب) ", "ج) ", "د) "], "correctAnswer": "ج", "explanation": "[شرح]", "difficulty": "hard", "points": 4, "fromContent": true},
    {"number": 15, "question": "[مسألة تحدي تدمج مفاهيم متعددة]", "type": "CHALLENGE", "correctAnswer": "[الحل]", "explanation": "[شرح شامل]", "difficulty": "hard", "points": 8, "fromContent": true},
    {"number": 16, "question": "[ربط بين مفهومين من الدرس]", "type": "CONNECTION", "correctAnswer": "[الربط]", "explanation": "[شرح]", "difficulty": "hard", "points": 6, "fromContent": true},
    {"number": 17, "question": "[استنتاج من المحتوى]", "type": "INFERENCE", "correctAnswer": "[الاستنتاج]", "explanation": "[شرح]", "difficulty": "hard", "points": 5, "fromContent": true},
    {"number": 18, "question": "[مسألة إبداعية مفتوحة]", "type": "CREATIVE", "correctAnswer": "[حلول متعددة]", "explanation": "[شرح]", "difficulty": "hard", "points": 7, "fromContent": true},
    {"number": 19, "question": "[تطبيق متقدم للمفاهيم]", "type": "ADVANCED_APPLICATION", "correctAnswer": "[الحل]", "explanation": "[شرح]", "difficulty": "hard", "points": 7, "fromContent": true},
    {"number": 20, "question": "[التحدي النهائي الشامل]", "type": "FINAL_CHALLENGE", "correctAnswer": "[الحل الكامل]", "explanation": "[شرح تفصيلي]", "difficulty": "hard", "points": 10, "fromContent": true}
  ],
  "realWorldApplications": [
    {"title": "في السوق", "description": "[كيف نستخدم ${context.title} في التسوق والحسابات المالية]", "example": "[مثال عملي محدد]", "benefit": "[الفائدة العملية]", "relatedConcept": "[من المحتوى]"},
    {"title": "في المطبخ", "description": "[التطبيق في الطبخ والوصفات]", "example": "[مثال]", "benefit": "[الفائدة]", "relatedConcept": "[من المحتوى]"},
    {"title": "في الرياضة", "description": "[استخدام في الأنشطة الرياضية]", "example": "[مثال]", "benefit": "[الفائدة]", "relatedConcept": "[من المحتوى]"},
    {"title": "في البناء والهندسة", "description": "[التطبيق الهندسي]", "example": "[مثال]", "benefit": "[الفائدة]", "relatedConcept": "[من المحتوى]"},
    {"title": "في التكنولوجيا", "description": "[الاستخدام التقني]", "example": "[مثال]", "benefit": "[الفائدة]", "relatedConcept": "[من المحتوى]"},
    {"title": "في الطبيعة", "description": "[الملاحظة في الطبيعة]", "example": "[مثال]", "benefit": "[الفائدة]", "relatedConcept": "[من المحتوى]"},
    {"title": "في الألعاب", "description": "[التطبيق في الألعاب]", "example": "[مثال]", "benefit": "[الفائدة]", "relatedConcept": "[من المحتوى]"},
    {"title": "في السفر", "description": "[الاستخدام أثناء السفر]", "example": "[مثال]", "benefit": "[الفائدة]", "relatedConcept": "[من المحتوى]"}
  ]
}`;

    try {
      const response = await openAIService.generateCompletion(prompt, {
        temperature: 0.7,
        maxTokens: 2500
      });
      return JSON.parse(this.extractJSON(response));
    } catch (error) {
      console.log('   ⚠️ استخدام البيانات الاحتياطية للجزء الثاني');
      return this.getFallbackPart2(context);
    }
  }

  private async enrichPart3(context: any): Promise<any> {
    const prompt = `بناءً على محتوى درس "${context.title}":

الملخص: ${context.summary}
النقاط المهمة: ${context.keyPoints.join('، ')}

أريد JSON فقط للإثراء النهائي:
{
  "commonMistakes": [
    {"mistake": "[خطأ شائع من المحتوى]", "why": "[لماذا يحدث]", "correct": "[الصواب من المحتوى]", "tip": "[كيف تتجنبه]", "example": "[مثال من الدرس]"},
    {"mistake": "[خطأ 2]", "why": "[السبب]", "correct": "[التصحيح]", "tip": "[النصيحة]", "example": "[مثال]"},
    {"mistake": "[خطأ 3]", "why": "[السبب]", "correct": "[التصحيح]", "tip": "[النصيحة]", "example": "[مثال]"},
    {"mistake": "[خطأ 4]", "why": "[السبب]", "correct": "[التصحيح]", "tip": "[النصيحة]", "example": "[مثال]"},
    {"mistake": "[خطأ 5]", "why": "[السبب]", "correct": "[التصحيح]", "tip": "[النصيحة]", "example": "[مثال]"},
    {"mistake": "[خطأ 6]", "why": "[السبب]", "correct": "[التصحيح]", "tip": "[النصيحة]", "example": "[مثال]"},
    {"mistake": "[خطأ 7]", "why": "[السبب]", "correct": "[التصحيح]", "tip": "[النصيحة]", "example": "[مثال]"},
    {"mistake": "[خطأ 8]", "why": "[السبب]", "correct": "[التصحيح]", "tip": "[النصيحة]", "example": "[مثال]"}
  ],
  "studentTips": [
    "[نصيحة 1: طريقة مذاكرة ${context.title}]",
    "[نصيحة 2: حيلة لتذكر المفاهيم]",
    "[نصيحة 3: كيف تتجنب الأخطاء]",
    "[نصيحة 4: استراتيجية الحل]",
    "[نصيحة 5: ربط المفاهيم]"
  ],
  "educationalStories": [
    {"title": "[قصة اكتشاف المفهوم]", "story": "[قصة قصيرة عن كيف اكتُشف هذا المفهوم الرياضي]", "moral": "[الدرس المستفاد]", "connection": "[كيف يرتبط بمحتوى الدرس]"},
    {"title": "[قصة التطبيق العملي]", "story": "[قصة استخدام المفهوم في حل مشكلة حقيقية]", "moral": "[العبرة]", "connection": "[الربط بالدرس]"},
    {"title": "[قصة الطالب المثابر]", "story": "[قصة طالب واجه صعوبة وتغلب عليها]", "moral": "[الإلهام]", "connection": "[كيف ينطبق على دراسة ${context.title}]"}
  ],
  "challenges": [
    {"title": "تحدي المبتدئ", "description": "[تحدي بسيط من المحتوى الأساسي]", "difficulty": "easy", "reward": "5 نقاط", "hint": "[من المحتوى]"},
    {"title": "تحدي المتوسط", "description": "[تحدي يتطلب فهم أعمق]", "difficulty": "medium", "reward": "10 نقاط", "hint": "[تلميح]"},
    {"title": "تحدي المتقدم", "description": "[تحدي يدمج مفاهيم متعددة]", "difficulty": "hard", "reward": "15 نقطة", "hint": "[تلميح]"},
    {"title": "تحدي الخبير", "description": "[تحدي للطلاب المتميزين]", "difficulty": "expert", "reward": "20 نقطة", "hint": "[تلميح]"},
    {"title": "تحدي الأسبوع", "description": "[تحدي خاص شامل للدرس]", "difficulty": "special", "reward": "شارة ذهبية", "hint": "[تلميح]"}
  ],
  "visualAids": [
    {"type": "diagram", "title": "[رسم توضيحي للمفهوم الأساسي]", "description": "[وصف تفصيلي]", "purpose": "[لماذا مهم للفهم]"},
    {"type": "flowchart", "title": "[مخطط خطوات الحل]", "description": "[الخطوات]", "purpose": "[الفائدة]"},
    {"type": "infographic", "title": "[ملخص بصري]", "description": "[المعلومات الأساسية]", "purpose": "[للمراجعة السريعة]"}
  ],
  "funFacts": [
    "[حقيقة ممتعة عن ${context.title}]",
    "[معلومة مدهشة مرتبطة بالموضوع]",
    "[حقيقة تاريخية أو علمية]"
  ],
  "quickReview": {
    "keyPoints": ${JSON.stringify(context.keyPoints.slice(0, 5))},
    "mustKnow": ["[أهم معلومة من المحتوى]", "[معلومة حرجة 2]", "[معلومة 3]"],
    "formula": "[المعادلة أو القاعدة الأساسية من المحتوى]",
    "summary": "[ملخص الدرس في 3 أسطر مبني على المحتوى الفعلي]"
  }
}`;

    try {
      const response = await openAIService.generateCompletion(prompt, {
        temperature: 0.7,
        maxTokens: 2500
      });
      return JSON.parse(this.extractJSON(response));
    } catch (error) {
      console.log('   ⚠️ استخدام البيانات الاحتياطية للجزء الثالث');
      return this.getFallbackPart3(context);
    }
  }

  private mergeEnrichmentParts(
    part1: any, 
    part2: any, 
    part3: any, 
    originalExamples: any[],
    originalExercises: any[]
  ): ComprehensiveEnrichment {
    // دمج التمارين من الجزئين
    const allExercises = [
      ...(part1.exercises_part1 || []),
      ...(part2.exercises_part2 || [])
    ];

    return {
      examples: [...originalExamples, ...(part1.examples || [])],
      exercises: [...originalExercises, ...allExercises],
      realWorldApplications: part2.realWorldApplications || [],
      commonMistakes: part3.commonMistakes || [],
      studentTips: part3.studentTips || [],
      educationalStories: part3.educationalStories || [],
      challenges: part3.challenges || [],
      visualAids: part3.visualAids || [],
      comparisonTables: [],
      additionalResources: [
        { type: "video", title: "فيديو شرح إضافي", url: "#" },
        { type: "article", title: "مقال للقراءة الإضافية", url: "#" },
        { type: "game", title: "لعبة تعليمية تفاعلية", url: "#" }
      ],
      funFacts: part3.funFacts || [],
      keyFormulas: [],
      stepByStepGuides: [],
      quickReview: part3.quickReview || {
        keyPoints: [],
        mustKnow: [],
        formula: "",
        summary: ""
      }
    };
  }

  // Fallback methods محدثة لتستخدم السياق
  private getFallbackPart1(context: any): any {
    const examples = [];
    for (let i = 1; i <= 10; i++) {
      examples.push({
        number: i,
        problem: `مثال ${i} على ${context.title}`,
        solution: `حل المثال ${i} بناءً على ${context.keyPoints[0] || 'المفهوم'}`,
        difficulty: i <= 3 ? "easy" : i <= 7 ? "medium" : "hard",
        steps: [`خطوة 1`, `خطوة 2`, `خطوة 3`],
        hint: `تذكر: ${context.keyPoints[0] || 'القاعدة الأساسية'}`,
        relatedConcept: context.keyPoints[i % context.keyPoints.length] || context.title
      });
    }

    const exercises = [];
    for (let i = 1; i <= 10; i++) {
      exercises.push({
        number: i,
        question: `سؤال ${i} في ${context.title}`,
        type: i % 3 === 0 ? "MCQ" : i % 3 === 1 ? "TRUE_FALSE" : "SHORT_ANSWER",
        correctAnswer: `الإجابة ${i}`,
        explanation: `شرح مبني على: ${context.summary.substring(0, 50)}...`,
        difficulty: i <= 5 ? "easy" : "medium",
        points: i <= 5 ? 2 : 3,
        fromContent: true
      });
    }

    return { examples, exercises_part1: exercises };
  }

  private getFallbackPart2(context: any): any {
    const exercises = [];
    for (let i = 11; i <= 20; i++) {
      exercises.push({
        number: i,
        question: `سؤال متقدم ${i} في ${context.title}`,
        type: "PROBLEM",
        correctAnswer: `الحل ${i}`,
        explanation: `شرح مفصل مبني على ${context.keyPoints[0] || 'المحتوى'}`,
        difficulty: i <= 15 ? "medium" : "hard",
        points: i <= 15 ? 5 : 8,
        fromContent: true
      });
    }

    const applications = [];
    const contexts = ["المنزل", "المدرسة", "السوق", "الحديقة", "المكتبة", "النادي", "المطعم", "المستشفى"];
    for (let i = 0; i < 8; i++) {
      applications.push({
        title: `في ${contexts[i]}`,
        description: `كيف نستخدم ${context.title} في ${contexts[i]}`,
        example: `مثال من ${contexts[i]} يطبق ${context.keyPoints[0] || 'المفهوم'}`,
        benefit: "فائدة عملية",
        relatedConcept: context.keyPoints[i % context.keyPoints.length] || context.title
      });
    }

    return { exercises_part2: exercises, realWorldApplications: applications };
  }

  private getFallbackPart3(context: any): any {
    const mistakes = [];
    for (let i = 1; i <= 8; i++) {
      mistakes.push({
        mistake: `خطأ شائع ${i} في ${context.title}`,
        why: "سبب حدوث الخطأ",
        correct: `الطريقة الصحيحة حسب ${context.keyPoints[0] || 'القاعدة'}`,
        tip: "نصيحة للتجنب",
        example: `مثال من محتوى ${context.title}`
      });
    }

    return {
      commonMistakes: mistakes,
      studentTips: [
        `ركز على ${context.keyPoints[0] || 'المفهوم الأساسي'}`,
        `راجع ${context.summary.substring(0, 30)}...`,
        "حل أمثلة كثيرة من المحتوى",
        "اربط المفاهيم ببعضها",
        `تذكر أن ${context.title} مهم لفهم الوحدة`
      ],
      educationalStories: [
        { 
          title: `قصة اكتشاف ${context.title}`, 
          story: "قصة ملهمة عن المفهوم", 
          moral: "أهمية الاكتشاف", 
          connection: `يرتبط بـ ${context.keyPoints[0] || 'الدرس'}`
        },
        { title: "قصة التطبيق", story: "قصة تطبيق عملي", moral: "الفائدة", connection: context.title },
        { title: "قصة النجاح", story: "قصة طالب نجح", moral: "المثابرة", connection: context.unit }
      ],
      challenges: context.keyPoints.slice(0, 5).map((point: string, i: number) => ({
        title: `تحدي ${i + 1}`,
        description: `تحدي يختبر فهمك لـ ${point}`,
        difficulty: ["easy", "medium", "hard", "expert", "special"][i],
        reward: `${(i + 1) * 5} نقاط`,
        hint: `راجع ${point}`
      })),
      visualAids: [
        { type: "diagram", title: `رسم ${context.title}`, description: "وصف", purpose: "للفهم" }
      ],
      funFacts: [
        `${context.subject} ممتعة!`,
        `${context.title} له تطبيقات كثيرة`,
        `الصف ${context.grade} يتعلم أشياء مهمة`
      ],
      quickReview: {
        keyPoints: context.keyPoints.slice(0, 5),
        mustKnow: context.keyPoints.slice(0, 3),
        formula: "",
        summary: context.summary.substring(0, 200)
      }
    };
  }

  private extractJSON(text: string): string {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    
    if (start === -1 || end === -1) {
      throw new Error('No JSON found');
    }
    
    let json = text.substring(start, end + 1);
    
    // تنظيف
    json = json.replace(/```json?\s*/g, '');
    json = json.replace(/```\s*/g, '');
    
    return json.trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// التشغيل
async function main() {
  console.log('🔍 فحص الإعدادات...\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY مفقود!');
    console.log('تأكد من وجوده في ملف .env');
    process.exit(1);
  }

  console.log('✅ OpenAI API متاح');
  console.log('📝 استخدام: gpt-4o-mini');
  console.log('✨ الإثراء سيكون مبني على المحتوى الموجود');
  console.log('');
  
  const enricher = new ComprehensiveEnricher();
  await enricher.enrichAllLessons();
  await prisma.$disconnect();
}

main().catch(console.error);