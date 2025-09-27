const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRealContent() {
  try {
    // Get first lesson with content
    const lesson = await prisma.lesson.findFirst({
      include: {
        content: true
      }
    });

    if (lesson && lesson.content) {
      console.log('\n=== LESSON CONTENT FIELDS ===');
      console.log('Lesson:', lesson.title);
      console.log('\n1. Full Text:', lesson.content.fullText?.substring(0, 200));
      console.log('\n2. Summary:', lesson.content.summary);
      console.log('\n3. Key Points:', lesson.content.keyPoints);
      console.log('\n4. Examples:', lesson.content.examples?.substring(0, 200));
      console.log('\n5. Exercises:', lesson.content.exercises?.substring(0, 200));

      // Most important - check enrichedContent field
      console.log('\n6. Enriched Content Type:', typeof lesson.content.enrichedContent);
      if (lesson.content.enrichedContent) {
        const enriched = typeof lesson.content.enrichedContent === 'string'
          ? JSON.parse(lesson.content.enrichedContent)
          : lesson.content.enrichedContent;

        console.log('   Enriched Content Keys:', Object.keys(enriched));
        console.log('   Enriched Preview:', JSON.stringify(enriched).substring(0, 500));

        // Check if it has slides
        if (enriched.slides) {
          console.log('\n=== ENRICHED SLIDES ===');
          console.log('Number of slides:', enriched.slides.length);
          enriched.slides.slice(0, 3).forEach((slide, i) => {
            console.log(`\nSlide ${i + 1}:`);
            console.log('  Type:', slide.type);
            console.log('  Title:', slide.title);
            if (slide.content) console.log('  Content:', slide.content.substring(0, 100));
            if (slide.bullets) console.log('  Bullets:', slide.bullets.slice(0, 2));
          });
        }
      }

      // Check adaptive content
      console.log('\n7. Adaptive Content:', lesson.content.adaptiveContent?.substring(0, 200));

      // Check emotional support
      console.log('\n8. Emotional Support:', lesson.content.emotionalSupport?.substring(0, 200));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRealContent();