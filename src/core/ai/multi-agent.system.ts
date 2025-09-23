// 📍 المكان: src/core/ai/multi-agent.system.ts
// الوظيفة: نظام متعدد الوكلاء الذكي لتحسين المحتوى التعليمي
// النسخة: 2.0 - محسّنة للمحتوى الطويل والتفصيلي

import { openAIService } from '../../services/ai/openai.service';
import { prisma } from '../../config/database.config';
import type { Lesson, Content } from '@prisma/client';

// ============= TYPES =============

export interface EnrichedContent {
  originalContent: string;
  enrichedText: string;
  
  // محتوى محسّن
  detailedExplanation: string;
  realWorldExamples: Example[];
  practiceProblems: Problem[];
  visualElements: VisualElement[];
  
  // معلومات تعليمية
  keyConceptsExplained: ConceptExplanation[];
  commonMisconceptions: Misconception[];
  prerequisiteKnowledge: string[];
  learningObjectives: string[];
  
  // محتوى تفاعلي
  interactiveComponents: InteractiveComponent[];
  animations: Animation[];
  
  // تقييمات
  assessmentQuestions: AssessmentQuestion[];
  selfCheckPoints: string[];
  
  metadata: {
    grade: number;
    subject: string;
    difficulty: 'easy' | 'medium' | 'hard';
    estimatedLearningTime: number; // minutes
    enrichmentLevel: number; // 1-10
  };
}

export interface Example {
  id: string;
  type: 'real-world' | 'mathematical' | 'scientific' | 'historical';
  title: string;
  description: string;
  visualAid?: string;
  relatedConcept: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

export interface Problem {
  id: string;
  type: 'exercise' | 'word-problem' | 'challenge' | 'group-activity';
  question: string;
  solution: string;
  stepByStepSolution?: string[];
  hints: string[];
  difficulty: number; // 1-5
  estimatedTime: number; // minutes
  skills: string[];
}

export interface VisualElement {
  id: string;
  type: 'diagram' | 'chart' | 'infographic' | 'mindmap' | '3d-model' | 'animation';
  title: string;
  description: string;
  specifications: {
    width?: number;
    height?: number;
    colors?: string[];
    labels?: string[];
    data?: any;
  };
  alternativeText: string; // for accessibility
}

export interface ConceptExplanation {
  concept: string;
  simpleExplanation: string;
  detailedExplanation: string;
  analogies: string[];
  visualRepresentation?: string;
}

export interface Misconception {
  commonMistake: string;
  whyItHappens: string;
  correctUnderstanding: string;
  howToAvoid: string;
}

export interface InteractiveComponent {
  id: string;
  type: 'calculator' | 'simulator' | 'quiz' | 'drag-drop' | 'timeline' | 'map';
  title: string;
  instructions: string;
  config: any;
}

export interface Animation {
  id: string;
  concept: string;
  steps: AnimationStep[];
  duration: number; // seconds
}

export interface AnimationStep {
  description: string;
  visualChanges: string;
  narration?: string;
  duration: number;
}

export interface AssessmentQuestion {
  id: string;
  type: 'mcq' | 'true-false' | 'fill-blank' | 'short-answer' | 'matching';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: number;
  learningObjective: string;
}

export interface AgentResponse {
  agentName: string;
  contribution: any;
  confidence: number;
  processingTime: number;
}

// ============= MAIN MULTI-AGENT SYSTEM =============

export class MultiAgentSystem {
  private agents: {
    contentExpert: ContentExpertAgent;
    exampleGenerator: ExampleGeneratorAgent;
    visualDesigner: VisualDesignerAgent;
    pedagogyExpert: PedagogyExpertAgent;
  };
  
  constructor() {
    this.agents = {
      contentExpert: new ContentExpertAgent(),
      exampleGenerator: new ExampleGeneratorAgent(),
      visualDesigner: new VisualDesignerAgent(),
      pedagogyExpert: new PedagogyExpertAgent(),
    };
  }
  
  /**
   * معالجة محتوى الدرس بالكامل عبر كل الوكلاء
   */
  async enrichLessonContent(
    lesson: any,
    options: {
      targetDepth?: 'basic' | 'intermediate' | 'advanced';
      includeVisuals?: boolean;
      includeInteractive?: boolean;
      maxExamples?: number;
      maxProblems?: number;
    } = {}
  ): Promise<EnrichedContent> {
    console.log('🤖 Starting Multi-Agent Content Enrichment');
    console.log(`📚 Lesson: ${lesson.title}`);
    console.log(`📊 Grade: ${lesson.unit.subject.grade}`);
    console.log(`🎯 Subject: ${lesson.unit.subject.name}`);
    
    const startTime = Date.now();
    
    // المرحلة 1: تحليل المحتوى الأساسي
    console.log('\n🧠 Phase 1: Content Analysis by Expert Agent');
    const expertAnalysis = await this.agents.contentExpert.analyzeContent(lesson);
    
    // المرحلة 2: توليد الأمثلة
    console.log('\n💡 Phase 2: Example Generation');
    const examples = await this.agents.exampleGenerator.generateExamples(
      lesson,
      expertAnalysis,
      options.maxExamples || 5
    );
    
    // المرحلة 3: تصميم العناصر المرئية
    console.log('\n🎨 Phase 3: Visual Design');
    const visuals = await this.agents.visualDesigner.designVisuals(
      lesson,
      expertAnalysis,
      options.includeVisuals !== false
    );
    
    // المرحلة 4: المراجعة التربوية
    console.log('\n👩‍🏫 Phase 4: Pedagogical Review');
    const pedagogicalContent = await this.agents.pedagogyExpert.reviewAndEnhance(
      lesson,
      {
        expertAnalysis,
        examples,
        visuals,
      }
    );
    
    // دمج كل المساهمات
    const enrichedContent = this.mergeAgentContributions(
      lesson,
      expertAnalysis,
      examples,
      visuals,
      pedagogicalContent
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`\n✅ Multi-Agent Processing Complete in ${processingTime}ms`);
    console.log(`📈 Enrichment Level: ${enrichedContent.metadata.enrichmentLevel}/10`);
    console.log(`📝 Enriched content length: ${enrichedContent.enrichedText.length} chars`);
    
    return enrichedContent;
  }
  
  /**
   * دمج مساهمات كل الوكلاء في محتوى موحد
   */
  private mergeAgentContributions(
    lesson: any,
    expertAnalysis: any,
    examples: any,
    visuals: any,
    pedagogicalContent: any
  ): EnrichedContent {
    // بناء المحتوى المُحسن الكامل
    const enrichedText = this.buildEnrichedText(
      lesson,
      expertAnalysis,
      examples,
      pedagogicalContent
    );
    
    return {
      originalContent: lesson.content?.fullText || '',
      enrichedText: enrichedText,
      
      detailedExplanation: expertAnalysis?.detailedExplanation || lesson.content?.fullText || '',
      realWorldExamples: examples?.examples || [],
      practiceProblems: pedagogicalContent?.problems || [],
      visualElements: visuals?.elements || [],
      
      keyConceptsExplained: expertAnalysis?.concepts || [],
      commonMisconceptions: expertAnalysis?.misconceptions || [],
      prerequisiteKnowledge: expertAnalysis?.prerequisites || [],
      learningObjectives: pedagogicalContent?.objectives || [],
      
      interactiveComponents: visuals?.interactiveComponents || [],
      animations: visuals?.animations || [],
      
      assessmentQuestions: pedagogicalContent?.assessmentQuestions || [],
      selfCheckPoints: pedagogicalContent?.checkPoints || [],
      
      metadata: {
        grade: lesson.unit.subject.grade,
        subject: lesson.unit.subject.name,
        difficulty: lesson.difficulty || 'medium',
        estimatedLearningTime: Math.ceil(
          enrichedText.length / 200 // تحديث بناءً على المحتوى المُحسن
        ),
        enrichmentLevel: this.calculateEnrichmentLevel(
          expertAnalysis,
          examples,
          visuals,
          pedagogicalContent
        ),
      },
    };
  }
  
  /**
   * بناء نص محسن كامل من كل المساهمات
   */
  private buildEnrichedText(
    lesson: any,
    expertAnalysis: any,
    examples: any,
    pedagogicalContent: any
  ): string {
    const parts: string[] = [];
    
    // العنوان والمقدمة
    parts.push(`# ${lesson.title}\n`);
    parts.push(`## الصف: ${lesson.unit.subject.grade} - ${lesson.unit.subject.name}\n`);
    
    // الشرح التفصيلي
    if (expertAnalysis?.detailedExplanation) {
      parts.push('\n## الشرح التفصيلي:\n');
      parts.push(expertAnalysis.detailedExplanation);
    }
    
    // المفاهيم الأساسية
    if (expertAnalysis?.concepts?.length > 0) {
      parts.push('\n\n## المفاهيم الأساسية:\n');
      expertAnalysis.concepts.forEach((concept: any, index: number) => {
        parts.push(`\n### ${index + 1}. ${concept.concept}\n`);
        parts.push(`**الشرح البسيط:** ${concept.simpleExplanation}\n`);
        parts.push(`**الشرح التفصيلي:** ${concept.detailedExplanation}\n`);
        if (concept.analogies?.length > 0) {
          parts.push(`**تشبيهات:** ${concept.analogies.join('، ')}\n`);
        }
      });
    }
    
    // الأمثلة من الواقع
    if (examples?.examples?.length > 0) {
      parts.push('\n\n## أمثلة من الحياة الواقعية:\n');
      examples.examples.forEach((example: any, index: number) => {
        parts.push(`\n### مثال ${index + 1}: ${example.title}\n`);
        parts.push(example.description);
        parts.push('\n');
      });
    }
    
    // المفاهيم الخاطئة الشائعة
    if (expertAnalysis?.misconceptions?.length > 0) {
      parts.push('\n\n## تصحيح المفاهيم الخاطئة:\n');
      expertAnalysis.misconceptions.forEach((misc: any) => {
        parts.push(`\n**❌ الخطأ الشائع:** ${misc.commonMistake}\n`);
        parts.push(`**✅ الفهم الصحيح:** ${misc.correctUnderstanding}\n`);
        parts.push(`**💡 كيفية التجنب:** ${misc.howToAvoid}\n`);
      });
    }
    
    // التمارين والأنشطة
    if (pedagogicalContent?.problems?.length > 0) {
      parts.push('\n\n## التمارين التطبيقية:\n');
      pedagogicalContent.problems.forEach((problem: any, index: number) => {
        parts.push(`\n### تمرين ${index + 1}:\n`);
        parts.push(`**السؤال:** ${problem.question}\n`);
        if (problem.hints?.length > 0) {
          parts.push(`**تلميحات:** ${problem.hints.join('، ')}\n`);
        }
        parts.push(`**الحل:** ${problem.solution}\n`);
      });
    }
    
    // الأهداف التعليمية
    if (pedagogicalContent?.objectives?.length > 0) {
      parts.push('\n\n## الأهداف التعليمية:\n');
      pedagogicalContent.objectives.forEach((objective: string) => {
        parts.push(`• ${objective}\n`);
      });
    }
    
    // نقاط التحقق الذاتي
    if (pedagogicalContent?.checkPoints?.length > 0) {
      parts.push('\n\n## نقاط التحقق الذاتي:\n');
      pedagogicalContent.checkPoints.forEach((point: string) => {
        parts.push(`✓ ${point}\n`);
      });
    }
    
    return parts.join('');
  }
  
  /**
   * حساب مستوى التحسين
   */
  private calculateEnrichmentLevel(...contributions: any[]): number {
    let score = 0;
    contributions.forEach(contrib => {
      if (contrib && Object.keys(contrib).length > 0) {
        score += 2.5;
      }
    });
    return Math.min(10, Math.round(score));
  }
}

// ============= AGENT 1: CONTENT EXPERT =============

class ContentExpertAgent {
  /**
   * تحليل عميق للمحتوى وإضافة شروحات متقدمة
   */
  async analyzeContent(lesson: any): Promise<any> {
    console.log('   🔍 Content Expert analyzing...');
    
    const prompt = `أنت خبير تعليمي متخصص في المناهج المصرية للصف ${lesson.unit.subject.grade}.
مهمتك: تحليل وتحسين محتوى الدرس التالي بشكل شامل ومفصل.

📚 معلومات الدرس:
- العنوان: ${lesson.title}
- الصف: ${lesson.unit.subject.grade}
- المادة: ${lesson.unit.subject.name}
- المحتوى الأصلي: ${lesson.content.fullText}

📋 المطلوب منك:
1. كتابة شرح تفصيلي شامل للدرس (على الأقل 1500 حرف) يغطي كل جوانب الموضوع
2. تحديد وشرح 3-5 مفاهيم أساسية بالتفصيل
3. تحديد 2-3 مفاهيم خاطئة شائعة مع التصحيح المفصل
4. تحديد المتطلبات السابقة للفهم
5. ربط المفاهيم بدروس أخرى

⚠️ مهم جداً:
- اكتب شرح طويل ومفصل (لا يقل عن 1500 حرف)
- اشرح كل مفهوم بالتفصيل (لا يقل عن 200 حرف لكل مفهوم)
- استخدم أمثلة توضيحية في الشرح
- اكتب بلغة عربية فصحى مبسطة مناسبة للطلاب

قدم الإجابة بصيغة JSON بالشكل التالي:
{
  "detailedExplanation": "شرح تفصيلي شامل للدرس (1500+ حرف)",
  "concepts": [
    {
      "concept": "اسم المفهوم الأول",
      "simpleExplanation": "شرح بسيط للمفهوم (100+ حرف)",
      "detailedExplanation": "شرح تفصيلي عميق للمفهوم (200+ حرف)",
      "analogies": ["تشبيه أول من الحياة", "تشبيه ثاني"],
      "visualRepresentation": "وصف لكيفية تمثيل المفهوم بصرياً"
    }
  ],
  "misconceptions": [
    {
      "commonMistake": "الخطأ الشائع الأول",
      "whyItHappens": "سبب حدوث هذا الخطأ",
      "correctUnderstanding": "الفهم الصحيح المفصل",
      "howToAvoid": "خطوات تجنب الخطأ"
    }
  ],
  "prerequisites": ["متطلب سابق 1", "متطلب سابق 2", "متطلب سابق 3"],
  "connections": ["ربط بدرس آخر", "ربط بموضوع مرتبط"]
}`;
    
    try {
      const response = await openAIService.chatJSON([
        { 
          role: 'system', 
          content: 'You are an expert Egyptian curriculum educator. Always provide detailed, comprehensive explanations in Arabic. Your responses must be thorough and educational.' 
        },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.7,
        maxTokens: 4000, // زيادة كبيرة للحصول على محتوى أطول
      });
      
      console.log('   ✅ Content Expert completed');
      
      // التحقق من طول المحتوى
      if (response.detailedExplanation && response.detailedExplanation.length < 1000) {
        console.log('   ⚠️ Content is short, requesting expansion...');
        // طلب توسيع إضافي إذا كان المحتوى قصيراً
        response.detailedExplanation = await this.expandContent(response.detailedExplanation, lesson);
      }
      
      return response;
    } catch (error) {
      console.error('   ❌ Content Expert failed:', error);
      return this.getFallbackAnalysis(lesson);
    }
  }
  
  /**
   * توسيع المحتوى إذا كان قصيراً
   */
  private async expandContent(currentContent: string, lesson: any): Promise<string> {
    const expansionPrompt = `المحتوى الحالي:
${currentContent}

هذا المحتوى قصير جداً. قم بتوسيعه وإضافة:
1. المزيد من التفاصيل والشروحات
2. أمثلة إضافية توضيحية
3. ربط بالحياة اليومية للطلاب
4. نصائح للفهم والحفظ

اكتب على الأقل 1500 حرف. كن مفصلاً وشاملاً.`;
    
    try {
      const expanded = await openAIService.chat([
        { role: 'user', content: expansionPrompt }
      ], {
        temperature: 0.7,
        maxTokens: 3000,
      });
      
      return currentContent + '\n\n' + expanded;
    } catch (error) {
      console.error('Failed to expand content:', error);
      return currentContent;
    }
  }
  
  private getFallbackAnalysis(lesson: any): any {
    return {
      detailedExplanation: lesson.content?.fullText || 'محتوى الدرس',
      concepts: [],
      misconceptions: [],
      prerequisites: [],
      connections: [],
    };
  }
}

// ============= AGENT 2: EXAMPLE GENERATOR =============

class ExampleGeneratorAgent {
  /**
   * توليد أمثلة واقعية ومتنوعة
   */
  async generateExamples(
    lesson: any,
    expertAnalysis: any,
    count: number = 5
  ): Promise<any> {
    console.log(`   💡 Generating ${count} real-world examples...`);
    
    const prompt = `أنت خبير في إنشاء الأمثلة التعليمية الواقعية للطلاب المصريين.

📚 معلومات الدرس:
- العنوان: ${lesson.title}
- الصف: ${lesson.unit.subject.grade}
- المادة: ${lesson.unit.subject.name}
- المفاهيم الأساسية: ${expertAnalysis.concepts?.map((c: any) => c.concept).join(', ') || 'المفاهيم الأساسية للدرس'}

📋 المطلوب: إنشاء ${count} أمثلة متنوعة وشاملة من الحياة الواقعية

⚠️ شروط كل مثال:
- من الحياة اليومية للطلاب المصريين (البيت، المدرسة، الشارع، السوق)
- شرح تفصيلي لا يقل عن 150 حرف
- مناسب للعمر والثقافة المصرية
- تدرج في الصعوبة من البسيط للمعقد
- يحتوي على تفاصيل بصرية يمكن رسمها أو تخيلها

قدم الإجابة بصيغة JSON:
{
  "examples": [
    {
      "id": "ex1",
      "type": "real-world",
      "title": "عنوان المثال الواضح والجذاب",
      "description": "شرح تفصيلي للمثال يوضح كيف يرتبط بالمفهوم (150+ حرف)",
      "visualAid": "وصف دقيق للصورة أو الرسم التوضيحي المطلوب",
      "relatedConcept": "المفهوم المرتبط من الدرس",
      "difficulty": "basic"
    }
  ]
}`;
    
    try {
      const response = await openAIService.chatJSON([
        { 
          role: 'system', 
          content: 'You are an expert in creating detailed educational examples for Egyptian students. Make examples relatable to Egyptian daily life and culture.' 
        },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.8,
        maxTokens: 3000, // زيادة للحصول على أمثلة مفصلة
      });
      
      console.log(`   ✅ Generated ${response.examples?.length || 0} examples`);
      return response;
    } catch (error) {
      console.error('   ❌ Example generation failed:', error);
      return { examples: [] };
    }
  }
}

// ============= AGENT 3: VISUAL DESIGNER =============

class VisualDesignerAgent {
  /**
   * تصميم العناصر المرئية والتفاعلية
   */
  async designVisuals(
    lesson: any,
    expertAnalysis: any,
    includeVisuals: boolean = true
  ): Promise<any> {
    if (!includeVisuals) {
      return { elements: [], interactiveComponents: [], animations: [] };
    }
    
    console.log('   🎨 Designing visual elements...');
    
    const subject = lesson.unit.subject.name;
    const isMath = subject.includes('رياضيات') || subject.includes('Math');
    const isScience = subject.includes('علوم') || subject.includes('Science');
    const isHistory = subject.includes('تاريخ') || subject.includes('History');
    const isLanguage = subject.includes('لغة') || subject.includes('Language');
    
    const prompt = `أنت مصمم تعليمي متخصص في العناصر المرئية والتفاعلية.

📚 معلومات الدرس:
- العنوان: ${lesson.title}
- المادة: ${subject}
- الصف: ${lesson.unit.subject.grade}
- المفاهيم: ${expertAnalysis.concepts?.map((c: any) => c.concept).join(', ') || 'المفاهيم الأساسية'}

📋 المطلوب تصميم عناصر مرئية وتفاعلية مناسبة:

${isMath ? `
للرياضيات:
- معادلات رياضية تفاعلية مع خطوات الحل
- رسوم بيانية ديناميكية
- أشكال هندسية تفاعلية
- آلة حاسبة علمية
- محاكي للعمليات الحسابية
` : ''}

${isScience ? `
للعلوم:
- رسوم توضيحية علمية مفصلة
- تجارب تفاعلية افتراضية
- نماذج 3D للجزيئات والأعضاء
- محاكيات للظواهر الطبيعية
- مخططات تشريحية
` : ''}

${isHistory ? `
للتاريخ:
- خرائط تفاعلية تاريخية
- خطوط زمنية مفصلة
- صور تاريخية مع شروحات
- مقارنات بين الحضارات
- رسوم توضيحية للأحداث
` : ''}

${isLanguage ? `
للغة:
- مخططات نحوية تفاعلية
- بطاقات المفردات
- تمارين تفاعلية
- ألعاب لغوية تعليمية
` : ''}

⚠️ مواصفات مطلوبة:
- وصف تفصيلي لكل عنصر (100+ حرف)
- مواصفات تقنية واضحة
- تعليمات الاستخدام
- إمكانية الوصول

قدم الإجابة بصيغة JSON:
{
  "elements": [
    {
      "id": "vis1",
      "type": "diagram",
      "title": "عنوان العنصر المرئي",
      "description": "وصف تفصيلي للعنصر ووظيفته التعليمية (100+ حرف)",
      "specifications": {
        "width": 800,
        "height": 600,
        "colors": ["#لون1", "#لون2"],
        "labels": ["تسمية 1", "تسمية 2"],
        "data": {}
      },
      "alternativeText": "وصف نصي بديل للإتاحة"
    }
  ],
  "interactiveComponents": [
    {
      "id": "int1",
      "type": "calculator",
      "title": "اسم المكون التفاعلي",
      "instructions": "تعليمات الاستخدام التفصيلية",
      "config": {
        "features": ["ميزة 1", "ميزة 2"],
        "settings": {}
      }
    }
  ],
  "animations": [
    {
      "id": "anim1",
      "concept": "المفهوم الذي توضحه الحركة",
      "steps": [
        {
          "description": "وصف الخطوة الأولى",
          "visualChanges": "التغييرات البصرية",
          "narration": "النص المصاحب",
          "duration": 3
        }
      ],
      "duration": 10
    }
  ]
}`;
    
    try {
      const response = await openAIService.chatJSON([
        { 
          role: 'system', 
          content: 'You are an educational visual designer specializing in interactive learning materials. Create detailed, educationally valuable visual elements.' 
        },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.8,
        maxTokens: 3500, // زيادة للحصول على تصاميم مفصلة
      });
      
      console.log(`   ✅ Designed ${response.elements?.length || 0} visuals`);
      return response;
    } catch (error) {
      console.error('   ❌ Visual design failed:', error);
      return { elements: [], interactiveComponents: [], animations: [] };
    }
  }
}

// ============= AGENT 4: PEDAGOGY EXPERT =============

class PedagogyExpertAgent {
  /**
   * المراجعة التربوية وإضافة عناصر التقييم
   */
  async reviewAndEnhance(
    lesson: any,
    agentContributions: any
  ): Promise<any> {
    console.log('   👩‍🏫 Pedagogical review and enhancement...');
    
    const prompt = `أنت خبير تربوي متخصص في التصميم التعليمي للمناهج المصرية.

📚 معلومات الدرس:
- العنوان: ${lesson.title}
- الصف: ${lesson.unit.subject.grade}
- المادة: ${lesson.unit.subject.name}
- المحتوى المحسن: ${agentContributions.expertAnalysis?.detailedExplanation?.substring(0, 500) || 'محتوى الدرس'}...

📋 المطلوب بالتفصيل:

1. **الأهداف التعليمية** (5-7 أهداف):
   - أهداف معرفية (يتعرف، يفهم، يحلل)
   - أهداف مهارية (يطبق، يحل، يستخدم)
   - أهداف وجدانية (يقدر، يهتم، يشارك)

2. **التمارين المتدرجة** (8-10 تمارين):
   - تمارين أساسية للفهم
   - تمارين تطبيقية
   - تمارين تحدي للمتميزين
   - مسائل كلامية من الواقع

3. **أسئلة التقييم** (6-8 أسئلة):
   - اختيار من متعدد
   - صح وخطأ مع التصحيح
   - أسئلة مقالية قصيرة
   - أسئلة تحليلية

4. **نقاط التحقق الذاتي** (5-6 نقاط):
   - معايير واضحة للتقييم الذاتي
   - أسئلة للمراجعة الذاتية

5. **الأنشطة الجماعية** (2-3 أنشطة):
   - أنشطة تعاونية
   - مشاريع صغيرة
   - ألعاب تعليمية

⚠️ مهم جداً:
- كل تمرين يجب أن يحتوي على حل تفصيلي
- كل سؤال يجب أن يحتوي على شرح للإجابة
- التدرج في الصعوبة واضح

قدم الإجابة بصيغة JSON:
{
  "objectives": [
    "هدف تعليمي واضح وقابل للقياس",
    "هدف آخر محدد"
  ],
  "problems": [
    {
      "id": "prob1",
      "type": "exercise",
      "question": "نص السؤال التفصيلي",
      "solution": "الحل الكامل المفصل",
      "stepByStepSolution": ["خطوة 1 بالتفصيل", "خطوة 2", "خطوة 3"],
      "hints": ["تلميح مساعد 1", "تلميح 2"],
      "difficulty": 1,
      "estimatedTime": 5,
      "skills": ["مهارة مطلوبة 1", "مهارة 2"]
    }
  ],
  "assessmentQuestions": [
    {
      "id": "q1",
      "type": "mcq",
      "question": "نص السؤال الواضح",
      "options": ["خيار أ", "خيار ب", "خيار ج", "خيار د"],
      "correctAnswer": "خيار أ",
      "explanation": "شرح تفصيلي للإجابة الصحيحة ولماذا الخيارات الأخرى خاطئة",
      "difficulty": 1,
      "learningObjective": "الهدف التعليمي المرتبط"
    }
  ],
  "checkPoints": [
    "نقطة تحقق 1: هل تستطيع شرح...؟",
    "نقطة تحقق 2: هل يمكنك حل...؟"
  ],
  "groupActivities": [
    {
      "title": "اسم النشاط الجماعي",
      "description": "وصف تفصيلي للنشاط وخطوات تنفيذه",
      "duration": 15,
      "materials": ["الأدوات المطلوبة"],
      "groupSize": 4,
      "objectives": ["هدف النشاط"]
    }
  ]
}`;
    
    try {
      const response = await openAIService.chatJSON([
        { 
          role: 'system', 
          content: 'You are an expert educational pedagogue specializing in Egyptian curriculum. Create comprehensive, detailed educational assessments and activities.' 
        },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.7,
        maxTokens: 4000, // زيادة للحصول على تمارين وأسئلة مفصلة
      });
      
      console.log('   ✅ Pedagogical enhancement complete');
      return response;
    } catch (error) {
      console.error('   ❌ Pedagogical review failed:', error);
      return {
        objectives: [],
        problems: [],
        assessmentQuestions: [],
        checkPoints: [],
        groupActivities: []
      };
    }
  }
}

// ============= EXPORT SINGLETON =============
export const multiAgentSystem = new MultiAgentSystem();