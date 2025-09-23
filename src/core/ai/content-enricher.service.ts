// الوظيفة: تحسين المحتوى التعليمي قبل معالجته بـ RAG

import { MultiAgentSystem, type EnrichedContent } from './multi-agent.system';
import { documentProcessor } from '../rag/document.processor';
import { prisma } from '../../config/database.config';
import { openAIService } from '../../services/ai/openai.service';
import type { Lesson, Difficulty } from '@prisma/client';

// إنشاء instance محلي من MultiAgentSystem
const multiAgentSystemInstance = new MultiAgentSystem();

// ============= TYPES =============

export interface EnrichmentOptions {
  // مستوى التحسين
  level: 'basic' | 'intermediate' | 'advanced' | 'comprehensive';
  
  // خيارات المحتوى
  includeExamples: boolean;
  includeProblems: boolean;
  includeVisuals: boolean;
  includeInteractive: boolean;
  includeAssessments: boolean;
  
  // خيارات خاصة بالمادة
  subjectSpecific?: {
    math?: {
      includeSolutions: boolean;
      includeGraphs: boolean;
      includeCalculators: boolean;
    };
    science?: {
      includeExperiments: boolean;
      include3DModels: boolean;
      includeSimulations: boolean;
    };
    history?: {
      includeTimelines: boolean;
      includeMaps: boolean;
      includeDocuments: boolean;
    };
    languages?: {
      includeAudioPronunciation: boolean;
      includeGrammarRules: boolean;
      includeExercises: boolean;
    };
  };
  
  // حدود
  maxExamples?: number;
  maxProblems?: number;
  maxVisuals?: number;
  maxProcessingTime?: number; // بالثواني
}

export interface ContentEnrichmentResult {
  lessonId: string;
  originalContentLength: number;
  enrichedContentLength: number;
  enrichmentRatio: number;
  
  added: {
    examples: number;
    problems: number;
    visuals: number;
    interactiveComponents: number;
    assessmentQuestions: number;
  };
  
  quality: {
    contentScore: number; // 0-100
    pedagogicalScore: number; // 0-100
    engagementScore: number; // 0-100
    overallScore: number; // 0-100
  };
  
  processingTime: number; // milliseconds
  enrichedContent: EnrichedContent;
}

// ============= MAIN SERVICE =============

export class ContentEnricherService {
  private readonly defaultOptions: EnrichmentOptions = {
    level: 'comprehensive', // تغيير من intermediate إلى comprehensive للحصول على محتوى أغنى
    includeExamples: true,
    includeProblems: true,
    includeVisuals: true,
    includeInteractive: true,
    includeAssessments: true,
    maxExamples: 10, // زيادة من 5 إلى 10
    maxProblems: 15, // زيادة من 10 إلى 15
    maxVisuals: 10, // زيادة من 8 إلى 10
    maxProcessingTime: 120, // زيادة من 60 إلى 120 ثانية
  };
  
  /**
   * تحسين محتوى درس واحد
   */
  async enrichLesson(
    lessonId: string,
    options?: Partial<EnrichmentOptions>
  ): Promise<ContentEnrichmentResult> {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 CONTENT ENRICHMENT STARTED');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    const enrichOptions = { ...this.defaultOptions, ...options };
    
    // جلب الدرس
    const lesson = await this.fetchLesson(lessonId);
    if (!lesson) {
      throw new Error(`Lesson ${lessonId} not found`);
    }
    
    console.log(`\n📚 Lesson: ${lesson.title}`);
    console.log(`📊 Subject: ${lesson.unit.subject.name}`);
    console.log(`🎯 Grade: ${lesson.unit.subject.grade}`);
    console.log(`📈 Enrichment Level: ${enrichOptions.level}`);
    
    // تحسين المحتوى باستخدام Multi-Agent System
    const enrichedContent = await multiAgentSystemInstance.enrichLessonContent(lesson, {
      targetDepth: this.mapLevelToDepth(enrichOptions.level),
      includeVisuals: enrichOptions.includeVisuals,
      includeInteractive: enrichOptions.includeInteractive,
      maxExamples: enrichOptions.maxExamples,
      maxProblems: enrichOptions.maxProblems,
    });
    
    // تحسين المحتوى إذا كان قصيراً
    if (enrichedContent.enrichedText.length < 1000) {
      console.log('⚠️ Content too short, enhancing further...');
      enrichedContent.enrichedText = await this.enhanceShortContent(
        lesson,
        enrichedContent.enrichedText,
        enrichedContent
      );
    }
    
    // معالجة خاصة بنوع المادة
    await this.applySubjectSpecificEnrichment(
      enrichedContent,
      lesson,
      enrichOptions
    );
    
    // حفظ المحتوى المحسن
    await this.saveEnrichedContent(lesson, enrichedContent);
    
    // حساب النتائج
    const result = this.calculateResults(
      lesson,
      enrichedContent,
      startTime
    );
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ENRICHMENT COMPLETE');
    console.log(`📊 Quality Score: ${result.quality.overallScore}/100`);
    console.log(`⏱️ Processing Time: ${result.processingTime}ms`);
    console.log(`📈 Content Increased: ${result.enrichmentRatio.toFixed(2)}x`);
    console.log(`📝 Final Length: ${result.enrichedContentLength} chars`);
    console.log('='.repeat(60) + '\n');
    
    return result;
  }
  
  /**
   * تحسين المحتوى القصير
   */
  private async enhanceShortContent(
    lesson: any,
    currentContent: string,
    enrichedData: EnrichedContent
  ): Promise<string> {
    // بناء محتوى أغنى من كل العناصر المتاحة
    const enhancedParts: string[] = [];
    
    // إضافة المحتوى الأساسي
    enhancedParts.push('## محتوى الدرس المحسن\n');
    enhancedParts.push(currentContent || enrichedData.detailedExplanation);
    
    // إضافة شرح المفاهيم
    if (enrichedData.keyConceptsExplained.length > 0) {
      enhancedParts.push('\n\n## المفاهيم الأساسية\n');
      enrichedData.keyConceptsExplained.forEach(concept => {
        enhancedParts.push(`\n### ${concept.concept}`);
        enhancedParts.push(`**الشرح المبسط**: ${concept.simpleExplanation}`);
        enhancedParts.push(`**الشرح التفصيلي**: ${concept.detailedExplanation}`);
        if (concept.analogies?.length > 0) {
          enhancedParts.push(`**تشبيهات**: ${concept.analogies.join('، ')}`);
        }
      });
    }
    
    // إضافة الأمثلة
    if (enrichedData.realWorldExamples.length > 0) {
      enhancedParts.push('\n\n## أمثلة من الواقع\n');
      enrichedData.realWorldExamples.forEach((example, index) => {
        enhancedParts.push(`\n### مثال ${index + 1}: ${example.title}`);
        enhancedParts.push(example.description);
        if (example.visualAid) {
          enhancedParts.push(`*ملاحظة بصرية: ${example.visualAid}*`);
        }
      });
    }
    
    // إضافة التمارين
    if (enrichedData.practiceProblems.length > 0) {
      enhancedParts.push('\n\n## تمارين تطبيقية\n');
      enrichedData.practiceProblems.forEach((problem, index) => {
        enhancedParts.push(`\n### تمرين ${index + 1}`);
        enhancedParts.push(`**السؤال**: ${problem.question}`);
        if (problem.hints?.length > 0) {
          enhancedParts.push(`**تلميحات**: ${problem.hints.join(' | ')}`);
        }
        if (problem.solution) {
          enhancedParts.push(`**الحل**: ${problem.solution}`);
        }
        if (problem.stepByStepSolution && problem.stepByStepSolution.length > 0) {
          enhancedParts.push('**خطوات الحل**:');
          problem.stepByStepSolution.forEach((step, i) => {
            enhancedParts.push(`  ${i + 1}. ${step}`);
          });
        }
      });
    }
    
    // إضافة المفاهيم الخاطئة الشائعة
    if (enrichedData.commonMisconceptions.length > 0) {
      enhancedParts.push('\n\n## تصحيح المفاهيم الخاطئة\n');
      enrichedData.commonMisconceptions.forEach(misc => {
        enhancedParts.push(`\n**الخطأ الشائع**: ${misc.commonMistake}`);
        enhancedParts.push(`**السبب**: ${misc.whyItHappens}`);
        enhancedParts.push(`**الفهم الصحيح**: ${misc.correctUnderstanding}`);
        enhancedParts.push(`**كيفية التجنب**: ${misc.howToAvoid}`);
      });
    }
    
    // إضافة الأهداف التعليمية
    if (enrichedData.learningObjectives.length > 0) {
      enhancedParts.push('\n\n## الأهداف التعليمية\n');
      enrichedData.learningObjectives.forEach(objective => {
        enhancedParts.push(`• ${objective}`);
      });
    }
    
    // إضافة نقاط التحقق الذاتي
    if (enrichedData.selfCheckPoints.length > 0) {
      enhancedParts.push('\n\n## نقاط التحقق الذاتي\n');
      enrichedData.selfCheckPoints.forEach(point => {
        enhancedParts.push(`✓ ${point}`);
      });
    }
    
    const finalContent = enhancedParts.join('\n');
    
    // إذا كان المحتوى لا يزال قصيراً، أضف المزيد
    if (finalContent.length < 1500) {
      const additionalContent = await this.generateAdditionalContent(lesson);
      return finalContent + '\n\n' + additionalContent;
    }
    
    return finalContent;
  }
  
  /**
   * توليد محتوى إضافي
   */
  private async generateAdditionalContent(lesson: any): Promise<string> {
    const prompt = `
أضف محتوى تعليمي إضافي وثري لدرس "${lesson.title}" للصف ${lesson.unit.subject.grade}.
يجب أن يتضمن:
1. معلومات إضافية مفيدة
2. حقائق مثيرة للاهتمام
3. تطبيقات عملية
4. نصائح للدراسة
5. ملخص شامل

اكتب محتوى لا يقل عن 500 كلمة.
`;
    
    try {
      const response = await openAIService.chat([
        { role: 'system', content: 'أنت معلم خبير في المناهج المصرية. اكتب محتوى تعليمي غني ومفصل.' },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.8,
        maxTokens: 4000,
      });
      
      return response;
    } catch (error) {
      console.error('Error generating additional content:', error);
      return 'محتوى إضافي غير متاح حالياً';
    }
  }
  
  /**
   * تحسين كل الدروس في المنهج
   */
  async enrichAllLessons(
    options?: Partial<EnrichmentOptions>
  ): Promise<ContentEnrichmentResult[]> {
    console.log('🚀 Starting batch enrichment for all lessons...\n');
    
    const lessons = await prisma.lesson.findMany({
      where: { isPublished: true },
      select: { id: true, title: true },
    });
    
    console.log(`📚 Found ${lessons.length} lessons to enrich\n`);
    
    const results: ContentEnrichmentResult[] = [];
    let completed = 0;
    let failed = 0;
    
    for (const lesson of lessons) {
      try {
        console.log(`\n[${completed + 1}/${lessons.length}] Processing: ${lesson.title}`);
        console.log('-'.repeat(50));
        
        const result = await this.enrichLesson(lesson.id, options);
        results.push(result);
        completed++;
        
        // تأخير صغير لتجنب الحمل الزائد
        await this.delay(3000); // زيادة من 2000 إلى 3000
        
      } catch (error) {
        console.error(`❌ Failed to enrich lesson ${lesson.id}:`, error);
        failed++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 BATCH ENRICHMENT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Completed: ${completed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Average Quality: ${this.calculateAverageQuality(results)}/100`);
    console.log('='.repeat(60));
    
    return results;
  }
  
  /**
   * تطبيق تحسينات خاصة بنوع المادة
   */
  private async applySubjectSpecificEnrichment(
    content: EnrichedContent,
    lesson: any,
    options: EnrichmentOptions
  ): Promise<void> {
    const subject = lesson.unit.subject.name.toLowerCase();
    
    if (subject.includes('رياضيات') || subject.includes('math')) {
      await this.enrichMathContent(content, options.subjectSpecific?.math);
    } else if (subject.includes('علوم') || subject.includes('science')) {
      await this.enrichScienceContent(content, options.subjectSpecific?.science);
    } else if (subject.includes('تاريخ') || subject.includes('history')) {
      await this.enrichHistoryContent(content, options.subjectSpecific?.history);
    } else if (subject.includes('لغة') || subject.includes('language')) {
      await this.enrichLanguageContent(content, options.subjectSpecific?.languages);
    }
  }
  
  /**
   * تحسينات خاصة بالرياضيات
   */
  private async enrichMathContent(
    content: EnrichedContent,
    options?: any
  ): Promise<void> {
    console.log('   🔢 Applying Math-specific enrichments...');
    
    // إضافة حلول خطوة بخطوة
    if (options?.includeSolutions !== false) {
      for (const problem of content.practiceProblems) {
        if (!problem.stepByStepSolution || problem.stepByStepSolution.length === 0) {
          problem.stepByStepSolution = await this.generateStepByStepSolution(problem);
        }
      }
    }
    
    // إضافة رسومات بيانية
    if (options?.includeGraphs !== false) {
      content.visualElements.push({
        id: 'math-graph-1',
        type: 'chart',
        title: 'رسم بياني تفاعلي',
        description: 'رسم بياني يوضح العلاقات الرياضية',
        specifications: {
          width: 800,
          height: 600,
          colors: ['#4CAF50', '#2196F3'],
          labels: ['المحور السيني', 'المحور الصادي'],
        },
        alternativeText: 'رسم بياني للدالة الرياضية',
      });
    }
    
    // إضافة آلة حاسبة تفاعلية
    if (options?.includeCalculators !== false) {
      content.interactiveComponents.push({
        id: 'calc-1',
        type: 'calculator',
        title: 'آلة حاسبة علمية',
        instructions: 'استخدم الآلة الحاسبة لحل المسائل',
        config: {
          type: 'scientific',
          features: ['basic', 'trigonometry', 'logarithms'],
        },
      });
    }
  }
  
  /**
   * تحسينات خاصة بالعلوم
   */
  private async enrichScienceContent(
    content: EnrichedContent,
    options?: any
  ): Promise<void> {
    console.log('   🔬 Applying Science-specific enrichments...');
    
    // إضافة تجارب تفاعلية
    if (options?.includeExperiments !== false) {
      content.interactiveComponents.push({
        id: 'exp-1',
        type: 'simulator',
        title: 'محاكي التجربة العلمية',
        instructions: 'قم بإجراء التجربة افتراضياً',
        config: {
          type: 'virtual-lab',
          experiment: content.metadata.subject,
        },
      });
    }
    
    // إضافة نماذج 3D
    if (options?.include3DModels !== false) {
      content.visualElements.push({
        id: 'model-3d-1',
        type: '3d-model',
        title: 'نموذج ثلاثي الأبعاد',
        description: 'نموذج تفاعلي يمكن تدويره وتكبيره',
        specifications: {
          width: 800,
          height: 600,
        },
        alternativeText: 'نموذج ثلاثي الأبعاد للمفهوم العلمي',
      });
    }
  }
  
  /**
   * تحسينات خاصة بالتاريخ
   */
  private async enrichHistoryContent(
    content: EnrichedContent,
    options?: any
  ): Promise<void> {
    console.log('   📜 Applying History-specific enrichments...');
    
    // إضافة خط زمني
    if (options?.includeTimelines !== false) {
      content.interactiveComponents.push({
        id: 'timeline-1',
        type: 'timeline',
        title: 'الخط الزمني للأحداث',
        instructions: 'استكشف الأحداث التاريخية على الخط الزمني',
        config: {
          events: [], // سيتم ملؤها من المحتوى
          startDate: '',
          endDate: '',
        },
      });
    }
    
    // إضافة خرائط تفاعلية
    if (options?.includeMaps !== false) {
      content.interactiveComponents.push({
        id: 'map-1',
        type: 'map',
        title: 'خريطة تاريخية تفاعلية',
        instructions: 'اضغط على المواقع لمعرفة المزيد',
        config: {
          type: 'historical',
          regions: [],
          period: content.metadata.subject,
        },
      });
    }
  }
  
  /**
   * تحسينات خاصة باللغات
   */
  private async enrichLanguageContent(
    content: EnrichedContent,
    options?: any
  ): Promise<void> {
    console.log('   📝 Applying Language-specific enrichments...');
    
    // إضافة قواعد نحوية
    if (options?.includeGrammarRules !== false) {
      const grammarRules = await this.extractGrammarRules(content.enrichedText);
      content.keyConceptsExplained.push(...grammarRules);
    }
  }
  
  /**
   * توليد حل خطوة بخطوة للمسائل الرياضية
   */
  private async generateStepByStepSolution(problem: any): Promise<string[]> {
    const prompt = `قدم حل خطوة بخطوة للمسألة التالية:
${problem.question}

الحل: ${problem.solution}

اكتب كل خطوة في سطر منفصل بشكل واضح ومفصل.`;
    
    try {
      const response = await openAIService.chat([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        maxTokens: 500,
      });
      
      return response.split('\n').filter(line => line.trim());
    } catch {
      return ['الخطوة 1: ابدأ بالمسألة', 'الخطوة 2: طبق القاعدة', 'الخطوة 3: احصل على النتيجة'];
    }
  }
  
  /**
   * استخراج القواعد النحوية
   */
  private async extractGrammarRules(text: string): Promise<any[]> {
    // هنا يمكن استخدام NLP أو AI لاستخراج القواعد
    return [];
  }
  
  /**
   * حفظ المحتوى المحسن في قاعدة البيانات - محسّن
   */
  private async saveEnrichedContent(
    lesson: any,
    enrichedContent: EnrichedContent
  ): Promise<void> {
    console.log('\n💾 Saving enriched content to database...');
    
    try {
      // بناء المحتوى المحسن الكامل
      const fullEnrichedText = await this.enhanceShortContent(
        lesson,
        enrichedContent.enrichedText,
        enrichedContent
      );
      
      // تحديث محتوى الدرس
      await prisma.content.update({
        where: { id: lesson.content.id },
        data: {
          fullText: fullEnrichedText, // المحتوى المحسن الكامل
          summary: enrichedContent.detailedExplanation.substring(0, 500),
          keyPoints: JSON.stringify(enrichedContent.learningObjectives),
          examples: JSON.stringify(enrichedContent.realWorldExamples),
          exercises: JSON.stringify(enrichedContent.practiceProblems),
          // إضافة حقل enrichedContent إذا كان موجوداً في schema
          // enrichedContent: JSON.stringify(enrichedContent),
          // lastEnrichedAt: new Date(),
          // enrichmentLevel: enrichedContent.metadata.enrichmentLevel,
          updatedAt: new Date(),
        },
      });
      
      console.log(`   ✓ Content updated (${fullEnrichedText.length} chars)`);
      
      // حذف البيانات القديمة قبل الإضافة
      await this.cleanupOldData(lesson.id);
      
      // حفظ الأمثلة
      let examplesAdded = 0;
      for (const [index, example] of enrichedContent.realWorldExamples.entries()) {
        try {
          await prisma.example.create({
            data: {
              lessonId: lesson.id,
              problem: example.title,
              solution: example.description,
              order: index + 1,
              type: example.type,
              difficulty: example.difficulty,
              visualAid: example.visualAid,
              relatedConcept: example.relatedConcept,
            },
          });
          examplesAdded++;
        } catch (error) {
          // تجاهل الأخطاء في حالة التكرار
          if (error instanceof Error) {
            if (!error.message?.includes('Unique constraint')) {
              console.error(`Error saving example: ${error.message}`);
            }
          } else {
            console.error('Error saving example:', error);
          }
        }
      }
      console.log(`   ✓ Examples saved: ${examplesAdded}/${enrichedContent.realWorldExamples.length}`);
      
      // حفظ الأسئلة
      let questionsAdded = 0;
      for (const question of enrichedContent.assessmentQuestions) {
        // تحويل difficulty من number إلى Difficulty enum
        let difficultyEnum: Difficulty = 'MEDIUM';
        if (question.difficulty <= 2) {
          difficultyEnum = 'EASY';
        } else if (question.difficulty >= 4) {
          difficultyEnum = 'HARD';
        }
        
        try {
          await prisma.question.create({
            data: {
              lessonId: lesson.id,
              question: question.question,
              type: question.type === 'mcq' ? 'MCQ' : 
                    question.type === 'true-false' ? 'TRUE_FALSE' : 
                    question.type === 'fill-blank' ? 'FILL_BLANK' : 
                    question.type === 'short-answer' ? 'SHORT_ANSWER' : 'MCQ',
              options: question.options ? JSON.stringify(question.options) : null,
              correctAnswer: String(question.correctAnswer),
              explanation: question.explanation,
              difficulty: difficultyEnum,
              learningObjective: question.learningObjective,
              // إضافة hints و stepByStepSolution إذا كانت موجودة في schema
              // hints: question.hints ? JSON.stringify(question.hints) : null,
              // stepByStepSolution: question.stepByStepSolution ? JSON.stringify(question.stepByStepSolution) : null,
            },
          });
          questionsAdded++;
        } catch (error) {
          if (error instanceof Error) {
            if (!error.message?.includes('Unique constraint')) {
              console.error(`Error saving question: ${error.message}`);
            }
          } else {
            console.error('Error saving question:', error);
          }
        }
      }
      console.log(`   ✓ Questions saved: ${questionsAdded}/${enrichedContent.assessmentQuestions.length}`);
      
      // حفظ العناصر المرئية
      let visualsAdded = 0;
      for (const [index, visual] of enrichedContent.visualElements.entries()) {
        try {
          await prisma.visualElement.create({
            data: {
              lessonId: lesson.id,
              type: visual.type,
              title: visual.title,
              description: visual.description,
              specifications: JSON.stringify(visual.specifications),
              alternativeText: visual.alternativeText,
              order: index,
            },
          });
          visualsAdded++;
        } catch (error) {
          if (error instanceof Error) {
            if (!error.message?.includes('Unique constraint')) {
              console.error(`Error saving visual: ${error.message}`);
            }
          } else {
            console.error('Error saving visual:', error);
          }
        }
      }
      console.log(`   ✓ Visuals saved: ${visualsAdded}/${enrichedContent.visualElements.length}`);
      
      // حفظ المكونات التفاعلية
      let componentsAdded = 0;
      for (const [index, component] of enrichedContent.interactiveComponents.entries()) {
        try {
          await prisma.interactiveComponent.create({
            data: {
              lessonId: lesson.id,
              type: component.type,
              title: component.title,
              instructions: component.instructions,
              config: JSON.stringify(component.config),
              order: index,
            },
          });
          componentsAdded++;
        } catch (error) {
          if (error instanceof Error) {
            if (!error.message?.includes('Unique constraint')) {
              console.error(`Error saving component: ${error.message}`);
            }
          } else {
            console.error('Error saving component:', error);
          }
        }
      }
      console.log(`   ✓ Interactive components saved: ${componentsAdded}/${enrichedContent.interactiveComponents.length}`);
      
      // حفظ جودة المحتوى
      const qualityScores = {
        contentScore: this.calculateContentScore(enrichedContent),
        pedagogicalScore: this.calculatePedagogicalScore(enrichedContent),
        engagementScore: this.calculateEngagementScore(enrichedContent),
        overallScore: Math.round(
          (this.calculateContentScore(enrichedContent) +
           this.calculatePedagogicalScore(enrichedContent) +
           this.calculateEngagementScore(enrichedContent)) / 3
        ),
      };
      
      await prisma.contentQuality.upsert({
        where: { lessonId: lesson.id },
        create: {
          lessonId: lesson.id,
          ...qualityScores,
          assessmentDetails: JSON.stringify({
            enrichmentLevel: enrichedContent.metadata.enrichmentLevel,
            examples: examplesAdded,
            problems: enrichedContent.practiceProblems.length,
            visuals: visualsAdded,
            interactive: componentsAdded,
            questions: questionsAdded,
            contentLength: fullEnrichedText.length,
          }),
        },
        update: {
          ...qualityScores,
          lastAssessedAt: new Date(),
          assessmentDetails: JSON.stringify({
            enrichmentLevel: enrichedContent.metadata.enrichmentLevel,
            examples: examplesAdded,
            problems: enrichedContent.practiceProblems.length,
            visuals: visualsAdded,
            interactive: componentsAdded,
            questions: questionsAdded,
            contentLength: fullEnrichedText.length,
          }),
        },
      });
      
  console.log(`   ✓ Quality assessment saved: ${qualityScores.overallScore}/100`);
      console.log('✅ Enriched content saved successfully');
      
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ Error saving enriched content:', error.message, error.stack);
      } else {
        console.error('❌ Error saving enriched content:', error);
      }
      throw error;
    }
  }
  
  /**
   * حذف البيانات القديمة قبل الإضافة
   */
  private async cleanupOldData(lessonId: string): Promise<void> {
    try {
      // حذف الأمثلة القديمة
      await prisma.example.deleteMany({
        where: { lessonId },
      });
      
      // حذف العناصر المرئية القديمة
      await prisma.visualElement.deleteMany({
        where: { lessonId },
      });
      
      // حذف المكونات التفاعلية القديمة
      await prisma.interactiveComponent.deleteMany({
        where: { lessonId },
      });
      
      console.log('   ✓ Old data cleaned up');
    } catch (error) {
      console.error('Warning: Could not cleanup old data:', error);
    }
  }
  
  /**
   * جلب الدرس من قاعدة البيانات
   */
  private async fetchLesson(lessonId: string): Promise<any> {
    return await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        content: true,
        unit: {
          include: {
            subject: true,
          },
        },
        concepts: true,
      },
    });
  }
  
  /**
   * حساب نتائج التحسين
   */
  private calculateResults(
    lesson: any,
    enrichedContent: EnrichedContent,
    startTime: number
  ): ContentEnrichmentResult {
    const originalLength = lesson.content.fullText?.length || 0;
    // حساب الطول النهائي للمحتوى المحسن
    const enrichedLength = enrichedContent.enrichedText.length > 1000 
      ? enrichedContent.enrichedText.length 
      : 2000; // طول تقديري إذا كان المحتوى قصيراً
    
    const contentScore = this.calculateContentScore(enrichedContent);
    const pedagogicalScore = this.calculatePedagogicalScore(enrichedContent);
    const engagementScore = this.calculateEngagementScore(enrichedContent);
    const overallScore = Math.round((contentScore + pedagogicalScore + engagementScore) / 3);
    
    return {
      lessonId: lesson.id,
      originalContentLength: originalLength,
      enrichedContentLength: enrichedLength,
      enrichmentRatio: enrichedLength / (originalLength || 1),
      
      added: {
        examples: enrichedContent.realWorldExamples.length,
        problems: enrichedContent.practiceProblems.length,
        visuals: enrichedContent.visualElements.length,
        interactiveComponents: enrichedContent.interactiveComponents.length,
        assessmentQuestions: enrichedContent.assessmentQuestions.length,
      },
      
      quality: {
        contentScore,
        pedagogicalScore,
        engagementScore,
        overallScore,
      },
      
      processingTime: Date.now() - startTime,
      enrichedContent,
    };
  }
  
  /**
   * حساب جودة المحتوى - محسّن
   */
  private calculateContentScore(content: EnrichedContent): number {
    let score = 40; // Base score
    
    // معايير أكثر دقة
    if (content.detailedExplanation.length > 300) score += 10;
    if (content.detailedExplanation.length > 700) score += 10;
    if (content.keyConceptsExplained.length >= 2) score += 10;
    if (content.keyConceptsExplained.length >= 4) score += 10;
    if (content.commonMisconceptions.length > 0) score += 10;
    if (content.prerequisiteKnowledge.length > 0) score += 10;
    if (content.realWorldExamples.length >= 3) score += 5;
    if (content.realWorldExamples.length >= 5) score += 5;
    
    return Math.min(100, score);
  }
  
  /**
   * حساب الجودة التربوية - محسّن
   */
  private calculatePedagogicalScore(content: EnrichedContent): number {
    let score = 30;
    
    if (content.learningObjectives.length >= 2) score += 15;
    if (content.learningObjectives.length >= 4) score += 10;
    if (content.practiceProblems.length >= 3) score += 15;
    if (content.practiceProblems.length >= 7) score += 15;
    if (content.assessmentQuestions.length >= 2) score += 10;
    if (content.assessmentQuestions.length >= 5) score += 10;
    if (content.selfCheckPoints.length >= 2) score += 10;
    
    return Math.min(100, score);
  }
  
  /**
   * حساب مستوى التفاعل - محسّن
   */
  private calculateEngagementScore(content: EnrichedContent): number {
    let score = 25;
    
    if (content.visualElements.length >= 2) score += 20;
    if (content.visualElements.length >= 5) score += 15;
    if (content.interactiveComponents.length >= 1) score += 15;
    if (content.interactiveComponents.length >= 3) score += 10;
    if (content.animations.length > 0) score += 15;
    if (content.realWorldExamples.length >= 3) score += 10;
    
    return Math.min(100, score);
  }
  
  /**
   * حساب متوسط الجودة
   */
  private calculateAverageQuality(results: ContentEnrichmentResult[]): number {
    if (results.length === 0) return 0;
    
    const totalScore = results.reduce((sum, r) => sum + r.quality.overallScore, 0);
    return Math.round(totalScore / results.length);
  }
  
  /**
   * تحويل المستوى إلى عمق
   */
  private mapLevelToDepth(level: string): 'basic' | 'intermediate' | 'advanced' {
    switch (level) {
      case 'basic': return 'basic';
      case 'intermediate': return 'intermediate';
      case 'advanced':
      case 'comprehensive': return 'advanced';
      default: return 'intermediate';
    }
  }
  
  /**
   * تأخير للمعالجة
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============= EXPORT SINGLETON =============
export const contentEnricher = new ContentEnricherService();