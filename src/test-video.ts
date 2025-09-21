import { videoService } from './core/video/video.service';
import { prisma } from './config/database.config';

async function testVideoGeneration() {
  console.log('🧪 Testing Video Generation System...\n');
  console.log('📌 Note: Running in MOCK MODE (no API keys needed)\n');
  
  try {
    // Get first published lesson
    const lesson = await prisma.lesson.findFirst({
      where: { 
        isPublished: true,
        content: {
          isNot: null,
        },
      },
    });
    
    if (!lesson) {
      console.log('❌ No published lesson found');
      return;
    }
    
    console.log(`📚 Using lesson: ${lesson.title}`);
    console.log(`🆔 Lesson ID: ${lesson.id}\n`);
    
    // Start video generation
    console.log('🎬 Starting video generation process...\n');
    const videoPath = await videoService.generateVideo(lesson.id);
    
    console.log('\n✅ Video generation test completed!');
    console.log(`📁 Video path: ${videoPath}`);
    
    // Get video status
    const status = await videoService.getVideoStatus(lesson.id);
    console.log('\n📊 Video Status:');
    console.log(`   Status: ${status.status}`);
    console.log(`   Progress: ${status.progress}%`);
    console.log(`   Duration: ${status.duration || 'N/A'} seconds`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testVideoGeneration().catch(console.error);