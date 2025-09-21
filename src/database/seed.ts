import { prisma } from '../config/database.config';
import { contentService } from '../core/content/content.service';

async function clearDatabase() {
  console.log('🗑️  Clearing existing data...');
  
  // Delete in correct order (respecting foreign keys)
  await prisma.quizAttemptAnswer.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.contentEmbedding.deleteMany();
  await prisma.content.deleteMany();
  await prisma.video.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.progress.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  
  console.log('✅ Database cleared\n');
}

async function seed() {
  console.log('🌱 Starting database seeding...\n');
  
  try {
    // Clear existing data first
    await clearDatabase();
    
    // Create subjects
    console.log('📚 Creating subjects...');
    
    const mathSubject = await contentService.createSubject({
      name: 'الرياضيات',
      nameEn: 'Mathematics',
      grade: 6,
      description: 'منهج الرياضيات للصف السادس الابتدائي',
      icon: '🔢',
    });
    
    const scienceSubject = await contentService.createSubject({
      name: 'العلوم',
      nameEn: 'Science',
      grade: 9,
      description: 'منهج العلوم للصف الثالث الإعدادي',
      icon: '🔬',
    });
    
    const historySubject = await contentService.createSubject({
      name: 'التاريخ',
      nameEn: 'History',
      grade: 12,
      description: 'منهج التاريخ للصف الثالث الثانوي',
      icon: '📜',
    });
    
    console.log('✅ Subjects created\n');
    
    // Create units for Math
    console.log('📖 Creating units...');
    
    const mathUnit1 = await contentService.createUnit({
      subjectId: mathSubject.id,
      title: 'الأعداد والعمليات',
      titleEn: 'Numbers and Operations',
      description: 'دراسة الأعداد الطبيعية والعمليات الحسابية',
    });
    
    const mathUnit2 = await contentService.createUnit({
      subjectId: mathSubject.id,
      title: 'الهندسة',
      titleEn: 'Geometry',
      description: 'المفاهيم الأساسية في الهندسة',
    });
    
    // Create units for Science
    const scienceUnit1 = await contentService.createUnit({
      subjectId: scienceSubject.id,
      title: 'الكائنات الحية',
      titleEn: 'Living Organisms',
      description: 'دراسة الكائنات الحية وخصائصها',
    });
    
    // Create units for History
    const historyUnit1 = await contentService.createUnit({
      subjectId: historySubject.id,
      title: 'التاريخ القديم',
      titleEn: 'Ancient History',
      description: 'دراسة الحضارات القديمة',
    });
    
    console.log('✅ Units created\n');
    
    // Create lessons
    console.log('📝 Creating lessons...');
    
    const lesson1 = await contentService.createLesson({
      unitId: mathUnit1.id,
      title: 'الأعداد الطبيعية',
      titleEn: 'Natural Numbers',
      description: 'مقدمة في الأعداد الطبيعية وخصائصها',
      duration: 45,
      difficulty: 'EASY',
    });
    
    const lesson2 = await contentService.createLesson({
      unitId: mathUnit1.id,
      title: 'العمليات الحسابية',
      titleEn: 'Arithmetic Operations',
      description: 'الجمع والطرح والضرب والقسمة',
      duration: 60,
      difficulty: 'MEDIUM',
    });
    
    const lesson3 = await contentService.createLesson({
      unitId: mathUnit2.id,
      title: 'الأشكال الهندسية',
      titleEn: 'Geometric Shapes',
      description: 'التعرف على الأشكال الهندسية الأساسية',
      duration: 50,
      difficulty: 'EASY',
    });
    
    console.log('✅ Lessons created\n');
    
    // Add content to lesson 1
    console.log('📄 Adding lesson content...');
    
    await contentService.upsertLessonContent(lesson1.id, {
      fullText: `
# الأعداد الطبيعية

## تعريف الأعداد الطبيعية
الأعداد الطبيعية هي الأعداد التي نستخدمها في العد: 1، 2، 3، 4، 5، ...

## خصائص الأعداد الطبيعية
1. **الترتيب**: كل عدد طبيعي له عدد يليه
2. **الجمع**: مجموع عددين طبيعيين هو عدد طبيعي
3. **الضرب**: حاصل ضرب عددين طبيعيين هو عدد طبيعي

## أمثلة
- الأعداد: 1، 2، 3، 4، 5 هي أعداد طبيعية
- العدد 0 يعتبر أحياناً من الأعداد الطبيعية
- الأعداد السالبة ليست أعداداً طبيعية

## التطبيقات في الحياة اليومية
نستخدم الأعداد الطبيعية في:
- عد الأشياء (عدد التلاميذ في الفصل)
- ترقيم الصفحات في الكتب
- أرقام المنازل في الشوارع
      `,
      summary: 'الأعداد الطبيعية هي الأعداد الموجبة التي نستخدمها في العد، وتبدأ من 1 وتستمر إلى ما لا نهاية.',
      keyPoints: [
        'الأعداد الطبيعية تبدأ من 1',
        'كل عدد طبيعي له عدد يليه',
        'مجموع وحاصل ضرب عددين طبيعيين هو عدد طبيعي',
        'تُستخدم في العد والترقيم',
      ],
      examples: [
        {
          id: '1',
          title: 'مثال على الأعداد الطبيعية',
          description: 'الأعداد 1، 2، 3، 4، 5 كلها أعداد طبيعية',
        },
        {
          id: '2',
          title: 'العد باستخدام الأعداد الطبيعية',
          description: 'نستخدم الأعداد الطبيعية لعد الأشياء: 1 تفاحة، 2 برتقالة، 3 موزات',
        },
      ],
      exercises: [
        {
          id: '1',
          question: 'هل العدد 7 عدد طبيعي؟',
          hint: 'تذكر أن الأعداد الطبيعية هي الأعداد الموجبة',
          solution: 'نعم، العدد 7 عدد طبيعي لأنه عدد موجب يُستخدم في العد',
          difficulty: 'EASY',
        },
        {
          id: '2',
          question: 'ما هو العدد الطبيعي التالي للعدد 99؟',
          hint: 'أضف 1 للعدد',
          solution: 'العدد التالي هو 100',
          difficulty: 'EASY',
        },
        {
          id: '3',
          question: 'هل العدد -3 عدد طبيعي؟',
          hint: 'انظر إلى إشارة العدد',
          solution: 'لا، العدد -3 ليس عدداً طبيعياً لأنه سالب',
          difficulty: 'EASY',
        },
      ],
    });
    
    // Add content to lesson 2
    await contentService.upsertLessonContent(lesson2.id, {
      fullText: `
# العمليات الحسابية

## الجمع والطرح
الجمع والطرح هما أساس العمليات الحسابية.

### الجمع
- رمز الجمع: +
- مثال: 5 + 3 = 8
- خاصية الإبدال: 3 + 5 = 5 + 3

### الطرح
- رمز الطرح: -
- مثال: 8 - 3 = 5
- الطرح ليس إبدالياً: 8 - 3 ≠ 3 - 8

## الضرب والقسمة

### الضرب
- رمز الضرب: × أو *
- مثال: 4 × 3 = 12
- الضرب هو جمع متكرر: 4 × 3 = 4 + 4 + 4

### القسمة
- رمز القسمة: ÷ أو /
- مثال: 12 ÷ 3 = 4
- القسمة هي عكس الضرب
      `,
      summary: 'العمليات الحسابية الأربع الأساسية هي الجمع والطرح والضرب والقسمة، وهي أساس كل الرياضيات.',
      keyPoints: [
        'الجمع والضرب عمليات إبدالية',
        'الطرح والقسمة ليستا إبداليتين',
        'الضرب هو جمع متكرر',
        'القسمة هي عكس الضرب',
      ],
      examples: [
        {
          id: '1',
          title: 'مثال على الجمع',
          description: '15 + 27 = 42',
        },
        {
          id: '2',
          title: 'مثال على الضرب',
          description: '6 × 7 = 42',
        },
      ],
      exercises: [
        {
          id: '1',
          question: 'احسب: 25 + 38',
          hint: 'اجمع الآحاد ثم العشرات',
          solution: '25 + 38 = 63',
          difficulty: 'EASY',
        },
        {
          id: '2',
          question: 'احسب: 9 × 8',
          hint: 'تذكر جدول الضرب',
          solution: '9 × 8 = 72',
          difficulty: 'MEDIUM',
        },
      ],
    });
    
    // Add content to lesson 3
    await contentService.upsertLessonContent(lesson3.id, {
      fullText: `
# الأشكال الهندسية

## الأشكال ثنائية الأبعاد

### المربع
- له 4 أضلاع متساوية
- له 4 زوايا قائمة (90 درجة)
- محيط المربع = 4 × طول الضلع
- مساحة المربع = طول الضلع × طول الضلع

### المستطيل
- له 4 أضلاع (كل ضلعين متقابلين متساويين)
- له 4 زوايا قائمة
- محيط المستطيل = 2 × (الطول + العرض)
- مساحة المستطيل = الطول × العرض

### المثلث
- له 3 أضلاع و 3 زوايا
- مجموع زوايا المثلث = 180 درجة
- أنواع المثلثات:
  - متساوي الأضلاع
  - متساوي الساقين
  - مختلف الأضلاع

### الدائرة
- جميع النقاط على محيطها على نفس البعد من المركز
- نصف القطر: المسافة من المركز لأي نقطة على المحيط
- القطر = 2 × نصف القطر
      `,
      summary: 'الأشكال الهندسية الأساسية تشمل المربع والمستطيل والمثلث والدائرة، ولكل شكل خصائصه المميزة.',
      keyPoints: [
        'المربع له 4 أضلاع متساوية',
        'المستطيل له ضلعان طويلان وضلعان قصيران',
        'المثلث له 3 أضلاع ومجموع زواياه 180 درجة',
        'الدائرة لها نصف قطر وقطر',
      ],
      examples: [
        {
          id: '1',
          title: 'مثال على المربع',
          description: 'مربع طول ضلعه 5 سم، محيطه = 4 × 5 = 20 سم',
        },
        {
          id: '2',
          title: 'مثال على المستطيل',
          description: 'مستطيل طوله 6 سم وعرضه 4 سم، مساحته = 6 × 4 = 24 سم²',
        },
      ],
      exercises: [
        {
          id: '1',
          question: 'احسب محيط مربع طول ضلعه 8 سم',
          hint: 'استخدم قانون محيط المربع',
          solution: 'المحيط = 4 × 8 = 32 سم',
          difficulty: 'EASY',
        },
        {
          id: '2',
          question: 'احسب مساحة مستطيل طوله 10 سم وعرضه 5 سم',
          hint: 'المساحة = الطول × العرض',
          solution: 'المساحة = 10 × 5 = 50 سم²',
          difficulty: 'EASY',
        },
      ],
    });
    
    // Publish lessons
    await contentService.publishLesson(lesson1.id);
    await contentService.publishLesson(lesson2.id);
    await contentService.publishLesson(lesson3.id);
    
    console.log('✅ Content added and lessons published\n');
    
    // Create some questions
    console.log('❓ Creating quiz questions...');
    
    await prisma.question.createMany({
      data: [
        {
          lessonId: lesson1.id,
          type: 'MCQ',
          question: 'ما هو أصغر عدد طبيعي؟',
          options: JSON.stringify(['0', '1', '2', '-1']),
          correctAnswer: '1',
          explanation: 'العدد 1 هو أصغر عدد طبيعي حسب التعريف الأكثر شيوعاً',
          points: 1,
          difficulty: 'EASY',
          order: 1,
        },
        {
          lessonId: lesson1.id,
          type: 'TRUE_FALSE',
          question: 'العدد -5 هو عدد طبيعي',
          correctAnswer: 'false',
          explanation: 'الأعداد الطبيعية هي أعداد موجبة فقط',
          points: 1,
          difficulty: 'EASY',
          order: 2,
        },
        {
          lessonId: lesson1.id,
          type: 'FILL_BLANK',
          question: 'العدد الطبيعي الذي يلي العدد 9 هو ____',
          correctAnswer: '10',
          explanation: 'نضيف 1 للحصول على العدد التالي',
          points: 1,
          difficulty: 'EASY',
          order: 3,
        },
        {
          lessonId: lesson2.id,
          type: 'MCQ',
          question: 'ما هو ناتج 7 + 5؟',
          options: JSON.stringify(['10', '11', '12', '13']),
          correctAnswer: '12',
          explanation: '7 + 5 = 12',
          points: 1,
          difficulty: 'EASY',
          order: 1,
        },
        {
          lessonId: lesson2.id,
          type: 'MCQ',
          question: 'ما هو ناتج 8 × 3؟',
          options: JSON.stringify(['21', '24', '25', '27']),
          correctAnswer: '24',
          explanation: '8 × 3 = 24',
          points: 1,
          difficulty: 'MEDIUM',
          order: 2,
        },
        {
          lessonId: lesson3.id,
          type: 'MCQ',
          question: 'كم عدد أضلاع المربع؟',
          options: JSON.stringify(['3', '4', '5', '6']),
          correctAnswer: '4',
          explanation: 'المربع له 4 أضلاع متساوية',
          points: 1,
          difficulty: 'EASY',
          order: 1,
        },
        {
          lessonId: lesson3.id,
          type: 'TRUE_FALSE',
          question: 'مجموع زوايا المثلث يساوي 180 درجة',
          correctAnswer: 'true',
          explanation: 'هذه قاعدة أساسية في الهندسة',
          points: 1,
          difficulty: 'EASY',
          order: 2,
        },
      ],
    });
    
    console.log('✅ Questions created\n');
    
    // Create test users
    console.log('👤 Creating test users...');
    
    const { authService } = await import('../core/auth/auth.service');
    
    const teacher = await authService.register({
      email: 'teacher@demo.com',
      password: 'Demo@1234',
      firstName: 'محمد',
      lastName: 'أحمد',
      role: 'TEACHER',
    });
    
    const student = await authService.register({
      email: 'student@demo.com',
      password: 'Demo@1234',
      firstName: 'فاطمة',
      lastName: 'علي',
      role: 'STUDENT',
      grade: 6,
    });
    
    const admin = await authService.register({
      email: 'admin@demo.com',
      password: 'Admin@1234',
      firstName: 'أحمد',
      lastName: 'سالم',
      role: 'ADMIN',
    });
    
    console.log('✅ Test users created\n');
    
    console.log('🎉 Database seeding completed successfully!\n');
    
    // Show summary
    const stats = await prisma.$transaction([
      prisma.subject.count(),
      prisma.unit.count(),
      prisma.lesson.count(),
      prisma.question.count(),
      prisma.user.count(),
    ]);
    
    console.log('📊 Database Statistics:');
    console.log(`   - Subjects: ${stats[0]}`);
    console.log(`   - Units: ${stats[1]}`);
    console.log(`   - Lessons: ${stats[2]}`);
    console.log(`   - Questions: ${stats[3]}`);
    console.log(`   - Users: ${stats[4]}`);
    
    console.log('\n📧 Test Accounts:');
    console.log('   Teacher: teacher@demo.com / Demo@1234');
    console.log('   Student: student@demo.com / Demo@1234');
    console.log('   Admin: admin@demo.com / Admin@1234');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed
seed().catch((error) => {
  console.error(error);
  process.exit(1);
});