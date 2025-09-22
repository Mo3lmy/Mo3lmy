// cSpell:disable
require('dotenv').config();

import('./core/video/video.service').then(async ({ videoService }) => {
  const { prisma } = await import('./config/database.config');
  
  console.log('🎬 Testing Full Video Generation with Egyptian Voice\n');
  
  try {
    // Get existing lesson or create test data
    let lesson = await prisma.lesson.findFirst({
      where: { isPublished: true },
      include: {
        content: true,
        unit: { include: { subject: true } }
      }
    });
    
    if (!lesson) {
      console.log('📝 No published lesson found. Creating test data...\n');
      
      // Find or create a subject
      let subject = await prisma.subject.findFirst();
      
      if (!subject) {
        subject = await prisma.subject.create({
          data: {
            name: 'الرياضيات',
            nameEn: 'Mathematics',
            nameAr: 'الرياضيات',
            grade: 6,
            description: 'منهج الرياضيات للصف السادس',
            icon: '📐',
            order: 1,
            isActive: true
          }
        });
        console.log('✅ Created subject:', subject.name);
      }
      
      // Find or create a unit
      let unit = await prisma.unit.findFirst({
        where: { subjectId: subject.id }
      });
      
      if (!unit) {
        unit = await prisma.unit.create({
          data: {
            title: 'الأعداد العشرية',
            titleEn: 'Decimal Numbers',
            titleAr: 'الأعداد العشرية',
            order: 1,
            description: 'وحدة الأعداد العشرية والكسور',
            subjectId: subject.id
          }
        });
        console.log('✅ Created unit:', unit.title);
      }
      
      // Create test lesson
      const lessonData = await prisma.lesson.create({
        data: {
          title: 'مقدمة في الكسور العشرية',
          titleEn: 'Introduction to Decimal Fractions',
          titleAr: 'مقدمة في الكسور العشرية',
          description: 'درس تعليمي عن أساسيات الكسور العشرية',
          order: 1,
          difficulty: 'EASY',
          duration: 15,
          isPublished: true,
          unitId: unit.id,
          content: {
            create: {
              fullText: `الكسور العشرية هي طريقة لكتابة الأعداد التي تحتوي على أجزاء.
              
              مثال: العدد 2.5 يعني اثنين ونصف
              - الرقم 2 يمثل العدد الصحيح
              - الرقم 5 بعد الفاصلة يمثل النصف (5 من 10)
              
              أمثلة أخرى:
              - 1.25 = واحد وربع
              - 3.75 = ثلاثة وثلاثة أرباع
              - 0.5 = نصف`,
              
              summary: 'الكسور العشرية تمكننا من كتابة الأعداد غير الصحيحة بطريقة سهلة باستخدام الفاصلة العشرية.',
              
              keyPoints: JSON.stringify([
                'الفاصلة العشرية تفصل بين الجزء الصحيح والجزء العشري',
                'الرقم الأول بعد الفاصلة يمثل الأعشار',
                'الرقم الثاني يمثل الأجزاء من المئة',
                'يمكن تحويل الكسور العادية إلى عشرية'
              ])
            }
          }
        },
        include: {
          content: true,
          unit: { include: { subject: true } }
        }
      });
      
      lesson = lessonData;
      console.log('✅ Created test lesson:', lesson.title);
    }
    
    // Ensure lesson is not null
    if (!lesson) {
      throw new Error('Failed to create or find lesson');
    }
    
    console.log('\n📚 Using lesson:', lesson.title);
    console.log('   Subject:', lesson.unit?.subject?.name || 'Unknown');
    console.log('   Grade:', lesson.unit?.subject?.grade || 'Unknown');
    console.log('   Unit:', lesson.unit?.title || 'Unknown');
    console.log('');
    
    // Generate video
    console.log('🎥 Starting video generation...\n');
    console.log('   Step 1: Generating script...');
    console.log('   Step 2: Creating slides...');
    console.log('   Step 3: Generating Egyptian voice...');
    console.log('   Step 4: Composing video...\n');
    
    const videoPath = await videoService.generateVideo(lesson.id);
    
    console.log('\n✅ Video generation complete!');
    console.log(`📁 Video saved at: ${videoPath}`);
    
    // Verify the output
    const fs = await import('fs/promises');
    
    try {
      const stats = await fs.stat(videoPath);
      
      if (stats.size < 1000) {
        // Very small file = probably mock
        try {
          const content = await fs.readFile(videoPath, 'utf-8');
          if (content.includes('mock') || content.includes('{')) {
            console.log('\n⚠️ Generated mock video file (not real video)');
            console.log('   This means video composition may not be fully configured');
          }
        } catch {
          // Binary file, even if small
          console.log(`\n✅ Generated video file: ${(stats.size / 1024).toFixed(2)} KB`);
        }
      } else {
        console.log(`\n✅ Generated real video file!`);
        console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Format: ${videoPath.endsWith('.mp4') ? 'MP4' : 'Unknown'}`);
      }
    } catch (error) {
      console.log('\n⚠️ Video file not found. Check if video service is properly configured.');
    }
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    
    // Provide helpful debugging info
    if (error.message.includes('videoService')) {
      console.error('\n💡 Hint: Make sure video.service.ts exists and exports videoService');
    } else if (error.message.includes('prisma')) {
      console.error('\n💡 Hint: Make sure database is initialized: npm run db:migrate');
    } else if (error.message.includes('Cannot find module')) {
      console.error('\n💡 Hint: Missing module. Run: npm install');
    }
    
    console.error('\nFull error:', error);
  } finally {
    await prisma.$disconnect();
  }
});
// cSpell:enable