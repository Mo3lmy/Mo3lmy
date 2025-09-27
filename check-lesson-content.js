const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkContent() {
  try {
    // Check lessons
    const lessons = await prisma.lesson.findMany({
      take: 5,
      include: {
        content: true,
        ragContent: true
      }
    });

    console.log('\n=== LESSONS IN DATABASE ===');
    for (const lesson of lessons) {
      console.log(`\nLesson: ${lesson.title} (ID: ${lesson.id})`);
      console.log(`  Grade: ${lesson.gradeLevel}`);
      console.log(`  Content exists: ${lesson.content ? 'Yes' : 'No'}`);
      console.log(`  RAG Content: ${lesson.ragContent.length}`);

      if (lesson.content) {
        console.log('  Content Details:');
        console.log(`    - Type: ${lesson.content.type || 'undefined'}`);
        const contentData = lesson.content.content
          ? (typeof lesson.content.content === 'string'
            ? lesson.content.content
            : JSON.stringify(lesson.content.content))
          : 'No content data';
        if (contentData !== 'No content data' && contentData.length > 0) {
          console.log(`    - Content Preview: ${contentData.substring(0, 200)}...`);
        } else {
          console.log(`    - Content: ${contentData}`);
        }
      }

      if (lesson.ragContent.length > 0) {
        console.log('  RAG Content Sample:');
        const rag = lesson.ragContent[0];
        console.log(`    - Section: ${rag.sectionTitle || 'N/A'}`);
        console.log(`    - Content Preview: ${rag.content.substring(0, 100)}...`);
      }
    }

    // Check a specific lesson with more detail
    const specificLesson = await prisma.lesson.findFirst({
      where: {
        gradeLevel: 10,
        subject: 'mathematics'
      },
      include: {
        content: true,
        ragContent: true
      }
    });

    if (specificLesson) {
      console.log('\n=== DETAILED LESSON CONTENT ===');
      console.log(`Lesson: ${specificLesson.title}`);

      if (specificLesson.content) {
        console.log('\nContent Object:');
        console.log(`  ID: ${specificLesson.content.id}`);
        console.log(`  Type: ${specificLesson.content.type}`);
        const fullContent = typeof specificLesson.content.content === 'string'
          ? JSON.parse(specificLesson.content.content)
          : specificLesson.content.content;
        console.log(`  Structure Keys: ${Object.keys(fullContent).join(', ')}`);

        if (fullContent.slides) {
          console.log(`\n  Slides in Content: ${fullContent.slides.length}`);
          fullContent.slides.slice(0, 3).forEach((slide, i) => {
            console.log(`    Slide ${i + 1}:`, slide.title || slide.type);
          });
        }
      }

      console.log(`\nRAG Content Pieces: ${specificLesson.ragContent.length}`);
      specificLesson.ragContent.slice(0, 3).forEach((rag, index) => {
        console.log(`  RAG ${index + 1}: ${rag.sectionTitle || 'Section'}`);
      });
    }

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkContent();