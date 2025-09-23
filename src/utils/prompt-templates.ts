// src/utils/prompt-templates.ts
// وظيفة: قوالب الـ prompts للذكاء الاصطناعي للسياقات المختلفة

export interface PromptContext {
  lessonTitle: string;
  subject: string;
  grade: number;
  currentSection?: string;
  currentSlide?: number;
  comprehensionLevel?: number;
  userMessage?: string;
  conversationHistory?: string[];
  isMathLesson?: boolean;
}


export type PromptType = 
  | 'welcome'
  | 'explain'
  | 'simplify'
  | 'example'
  | 'quiz'
  | 'complete'
  | 'analyze'
  | 'chat'
  | 'slide'
  | 'math_problem'
  | 'start_quiz';
export class PromptTemplates {
  
  /**
   * قالب الشرح التفصيلي (للمعلم الشارح)
   */
  static getExplanationPrompt(context: PromptContext): string {
    return `أنت معلم خبير في مادة ${context.subject} للصف ${context.grade}.
نحن الآن في درس: "${context.lessonTitle}"
${context.currentSection ? `القسم الحالي: ${context.currentSection}` : ''}

مهمتك:
1. اشرح المفهوم بطريقة واضحة ومبسطة تناسب طالب في الصف ${context.grade}
2. استخدم أمثلة من الحياة اليومية
3. اربط المعلومة بما سبق دراسته
4. تحدث بلغة عربية فصحى سهلة
5. اجعل الشرح تفاعلي وشيق

${context.userMessage ? `الطالب يسأل: ${context.userMessage}` : 'ابدأ بشرح النقطة الحالية'}

قدم الشرح بأسلوب ودود ومشجع.`;
  }

  /**
   * قالب المثال العملي
   */
  static getExamplePrompt(context: PromptContext): string {
    return `قدم مثال عملي واضح عن: "${context.currentSection || context.lessonTitle}"

المتطلبات:
- مثال من الحياة اليومية يفهمه طالب الصف ${context.grade}
- شرح خطوة بخطوة
- ${context.isMathLesson ? 'استخدم أرقام بسيطة ووضح الحل' : 'اجعل المثال قصة قصيرة'}
- اختتم بسؤال للتأكد من الفهم

${context.userMessage ? `بناءً على طلب الطالب: ${context.userMessage}` : ''}`;
  }

  /**
   * قالب التبسيط
   */
  static getSimplificationPrompt(context: PromptContext): string {
    return `الطالب يواجه صعوبة في فهم: "${context.currentSection || context.lessonTitle}"
مستوى الفهم الحالي: ${context.comprehensionLevel || 50}%

أعد شرح المفهوم بطريقة:
1. أبسط بكثير
2. استخدم كلمات أسهل
3. قسّم المعلومة لأجزاء صغيرة
4. استخدم تشبيهات مألوفة
5. تجنب المصطلحات المعقدة

${context.userMessage ? `الطالب يقول: ${context.userMessage}` : ''}

كن صبوراً ومشجعاً.`;
  }

  /**
   * قالب سؤال الفهم
   */
  static getQuizPrompt(context: PromptContext): string {
    return `اطرح سؤال تفاعلي للتأكد من فهم: "${context.currentSection || context.lessonTitle}"

المتطلبات:
- سؤال واحد واضح ومحدد
- مناسب للصف ${context.grade}
- ${context.isMathLesson ? 'مسألة رياضية بسيطة' : 'سؤال فهم أو تطبيق'}
- قدم 4 خيارات (واحد صحيح)
- أضف تلميح صغير

شكل الإجابة:
{
  "question": "السؤال",
  "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
  "correct": 0,
  "hint": "تلميح مساعد",
  "explanation": "شرح الإجابة الصحيحة"
}`;
  }

  /**
   * قالب المحادثة الذكية
   */
  static getChatResponsePrompt(context: PromptContext): string {
    const history = context.conversationHistory?.slice(-5).join('\n') || '';
    
    return `أنت مدرس ذكي ودود تساعد في درس: "${context.lessonTitle}"
مادة: ${context.subject} - الصف ${context.grade}
${context.currentSection ? `نحن في: ${context.currentSection}` : ''}

المحادثة السابقة:
${history}

الطالب: ${context.userMessage}

قواعد الرد:
1. كن ودوداً ومشجعاً
2. أجب بشكل مباشر ومختصر
3. استخدم لغة مناسبة للعمر
4. إذا كان السؤال خارج الدرس، اربطه بالموضوع أو وجه الطالب برفق
5. شجع على طرح المزيد من الأسئلة
6. ${context.isMathLesson ? 'استخدم LaTeX للمعادلات: $معادلة$' : ''}

قدم إجابة تفاعلية ومفيدة.`;
  }

  /**
   * قالب توليد الشريحة
   */
  static getSlideGenerationPrompt(context: PromptContext, slideType: string): string {
    return `قم بإنشاء محتوى شريحة تعليمية من نوع "${slideType}" 
للدرس: "${context.lessonTitle}"
الصف: ${context.grade}

أنواع الشرائح:
- title: عنوان رئيسي وعنوان فرعي
- bullet: نقاط رئيسية (3-5 نقاط)
- content: فقرة شرح
- quiz: سؤال تفاعلي
- summary: ملخص

أرجع النتيجة بصيغة JSON:
{
  "type": "${slideType}",
  "title": "عنوان الشريحة",
  "content": "المحتوى حسب النوع",
  "visual": "وصف العنصر المرئي المقترح",
  "notes": "ملاحظات للمعلم"
}

${context.userMessage ? `طلب خاص: ${context.userMessage}` : ''}`;
  }

  /**
   * قالب المسألة الرياضية
   */
  static getMathProblemPrompt(context: PromptContext): string {
    return `أنشئ مسألة رياضية للصف ${context.grade}
موضوع الدرس: "${context.lessonTitle}"

المتطلبات:
1. مسألة واقعية من الحياة اليومية
2. أرقام بسيطة ومناسبة للعمر
3. خطوات حل واضحة
4. استخدم LaTeX للمعادلات

الشكل المطلوب:
{
  "problem": "نص المسألة",
  "equation": "المعادلة بصيغة LaTeX",
  "steps": [
    {"step": 1, "action": "الخطوة", "latex": "المعادلة"},
    {"step": 2, "action": "الخطوة", "latex": "المعادلة"}
  ],
  "answer": "الجواب النهائي",
  "explanation": "شرح الحل"
}`;
  }

  /**
   * قالب تحليل مستوى الفهم
   */
  static getComprehensionAnalysisPrompt(
    userMessages: string[], 
    context: PromptContext
  ): string {
    return `حلل مستوى فهم الطالب بناءً على رسائله:

الدرس: "${context.lessonTitle}"
الرسائل:
${userMessages.join('\n')}

قيّم:
1. مستوى الفهم (0-100)
2. النقاط المفهومة
3. النقاط التي تحتاج توضيح
4. نوع المساعدة المطلوبة

أرجع تقييم JSON:
{
  "comprehensionLevel": 0-100,
  "understoodConcepts": [],
  "needsClarification": [],
  "recommendedAction": "explain|example|simplify|quiz",
  "feedback": "ملاحظة تشجيعية"
}`;
  }

  /**
   * قالب الترحيب بالدرس
   */
  static getLessonWelcomePrompt(context: PromptContext): string {
    return `رحب بالطالب في درس: "${context.lessonTitle}"
مادة ${context.subject} للصف ${context.grade}

اكتب رسالة ترحيب:
1. ودودة ومحفزة (2-3 جمل)
2. اذكر هدف واحد سنتعلمه
3. اسأل إن كان مستعداً للبدء
4. استخدم emoji واحد مناسب

كن متحمساً ومشجعاً!`;
  }

  /**
   * قالب ختام الدرس
   */
  static getLessonCompletionPrompt(context: PromptContext): string {
    return `الطالب أكمل درس: "${context.lessonTitle}"

اكتب رسالة ختامية:
1. هنئ الطالب على الإنجاز
2. اذكر أهم 2-3 نقاط تعلمها
3. شجعه على المراجعة
4. استخدم عبارات تحفيزية
5. أضف emoji احتفالي

اجعل الرسالة قصيرة ومؤثرة.`;
  }

  /**
   * دالة مساعدة لاختيار القالب المناسب
   */
  static getPromptForAction(
    action: string, 
    context: PromptContext
  ): string {
    const actionMap: Record<string, (ctx: PromptContext) => string> = {
      'explain_more': this.getExplanationPrompt,
      'show_example': this.getExamplePrompt,
      'simplify': this.getSimplificationPrompt,
      'start_quiz': this.getQuizPrompt,
      'generate_slide': (ctx) => this.getSlideGenerationPrompt(ctx, 'content'),
      'chat': this.getChatResponsePrompt,
      'welcome': this.getLessonWelcomePrompt,
      'complete': this.getLessonCompletionPrompt,
      'math_problem': this.getMathProblemPrompt,
      'analyze': (ctx) => this.getComprehensionAnalysisPrompt([], ctx)
    };

    const promptFunction = actionMap[action] || this.getChatResponsePrompt;
    return promptFunction(context);
  }

  /**
   * إضافة تعليمات خاصة حسب الموضوع
   */
  static addSubjectSpecificInstructions(
    prompt: string, 
    subject: string
  ): string {
    const additions: Record<string, string> = {
      'رياضيات': '\n\nتذكر: استخدم LaTeX للمعادلات، اشرح كل خطوة، استخدم أمثلة عددية.',
      'علوم': '\n\nتذكر: استخدم تجارب بسيطة، اربط بالطبيعة، اشرح السبب والنتيجة.',
      'لغة عربية': '\n\nتذكر: أعط أمثلة من النصوص، اشرح القواعد ببساطة، استخدم جمل قصيرة.',
      'تاريخ': '\n\nتذكر: اربط بالحاضر، استخدم قصص مشوقة، اذكر التواريخ المهمة.',
      'جغرافيا': '\n\nتذكر: استخدم الخرائط الذهنية، اربط بالواقع المحلي، اشرح بالأمثلة المكانية.'
    };

    const addition = additions[subject] || '';
    return prompt + addition;
  }
}

// Export helper function for easy access
export function getPrompt(
  action: string, 
  context: PromptContext
): string {
  let prompt = PromptTemplates.getPromptForAction(action, context);
  
  if (context.subject) {
    prompt = PromptTemplates.addSubjectSpecificInstructions(prompt, context.subject);
  }
  
  return prompt;
}

// Export specific prompt functions for direct use
export const {
  getExplanationPrompt,
  getExamplePrompt,
  getSimplificationPrompt,
  getQuizPrompt,
  getChatResponsePrompt,
  getSlideGenerationPrompt,
  getMathProblemPrompt,
  getLessonWelcomePrompt,
  getLessonCompletionPrompt
} = PromptTemplates;