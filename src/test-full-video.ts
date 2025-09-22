// cSpell:disable
require('dotenv').config();

import('./core/video/video.service').then(async ({ videoService }) => {
  const { prisma } = await import('./config/database.config');
  
  console.log('🎬 Testing Full Video Generation with Egyptian Voice\n');
  
  try {
    // احصل على درس من قاعدة البيانات
    let lesson = await prisma.lesson.findFirst({
      where: { isPublished: true },
      include: {
        content: true,
        unit: { include: { subject: true } }
      }
    });
    
    if (!lesson) {
      console.log('❌ No published lesson found');
      
      // First, we need to create or find a unit
      let unit = await prisma.unit.findFirst();
      
      if (!unit) {
        // Create a subject first
        const subject = await prisma.subject.create({
          data: {
            name: 'الرياضيات',
            nameEn: 'Mathematics',
            code: 'MATH',
            grade: 6,
            term: 1,
            description: 'منهج الرياضيات للصف السادس',
            totalLessons: 20,
            iconUrl: '📐'
          }
        });
        
        // Create a unit
        unit = await prisma.unit.create({
          data: {
            title: 'الأعداد العشرية',
            titleEn: 'Decimal Numbers',
            orderIndex: 1,
            description: 'وحدة الأعداد العشرية',
            subjectId: subject.id
          }
        });
      }
      
      // Create test lesson
      console.log('📝 Creating test lesson...');
      lesson = await prisma.lesson.create({
        data: {
          title: 'الكسور العشرية',
          titleEn: 'Decimal Fractions',
          description: 'تعلم الكسور العشرية بطريقة سهلة',
          orderIndex: 1,
          isPublished: true,
          unitId: unit.id,
          content: {
            create: {
              fullText: 'الكسور العشرية هي طريقة لكتابة الأعداد التي تحتوي على أجزاء. مثلاً العدد 2.5 يعني اثنين ونصف.',
              summary: 'درس مبسط عن الكسور العشرية',
              keyPoints: JSON.stringify(['فهم الكسور', 'التحويل', 'العمليات']),
            }
          }
        },
        include: {
          content: true,
          unit: { include: { subject: true } }
        }
      });
    }
    
    console.log(`📚 Using lesson: ${lesson.title}`);
    console.log(`   Subject: ${lesson.unit?.subject?.name || 'Test'}`);
    console.log(`   Grade: ${lesson.unit?.subject?.grade || 6}\n`);
    
    // توليد الفيديو
    console.log('🎥 Starting video generation...\n');
    const videoPath = await videoService.generateVideo(lesson.id);
    
    console.log('\n✅ Video generation complete!');
    console.log(`📁 Video saved at: ${videoPath}`);
    
    // تحقق من الملف
    const fs = await import('fs/promises');
    const stats = await fs.stat(videoPath);
    
    if (stats.size < 1000) {
      // ملف صغير جداً = mock
      const content = await fs.readFile(videoPath, 'utf-8');
      if (content.includes('mock')) {
        console.log('⚠️ Generated mock video (check logs for issues)');
      }
    } else {
      console.log(`✅ Real video file: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
});
// cSpell:enable