const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDetailedContent() {
  try {
    // Get first lesson with all details
    const lesson = await prisma.lesson.findFirst({
      include: {
        content: true,
        ragContent: true,
        unit: true
      }
    });

    if (lesson) {
      console.log('\n=== LESSON DETAILS ===');
      console.log('ID:', lesson.id);
      console.log('Title:', lesson.title);
      console.log('Title (AR):', lesson.titleAr);
      console.log('Description:', lesson.description);
      console.log('Difficulty:', lesson.difficulty);
      console.log('Unit:', lesson.unit?.title);

      if (lesson.content) {
        console.log('\n=== CONTENT OBJECT ===');
        console.log('Content ID:', lesson.content.id);
        console.log('Content Type:', lesson.content.type);
        console.log('Content Data:', lesson.content.content);
        console.log('Content Keys:', Object.keys(lesson.content));
      }

      // Check RAG content
      console.log('\n=== RAG CONTENT ===');
      console.log('Total RAG pieces:', lesson.ragContent.length);

      // Check if there's any enriched JSON data in the lesson itself
      console.log('\n=== LESSON JSON FIELDS ===');
      console.log('Key Points:', lesson.keyPoints);
      console.log('Summary:', lesson.summary);
    }

    // Check the Content table directly
    console.log('\n=== CONTENT TABLE CHECK ===');
    const contents = await prisma.content.findMany({
      take: 3
    });

    contents.forEach((content, i) => {
      console.log(`\nContent ${i + 1}:`);
      console.log('  ID:', content.id);
      console.log('  Type:', content.type);
      console.log('  Content field:', content.content);
      console.log('  All keys:', Object.keys(content));
    });

    // Check RAGContent table
    console.log('\n=== RAG CONTENT TABLE CHECK ===');
    const ragContents = await prisma.rAGContent.findMany({
      take: 3
    });

    if (ragContents.length > 0) {
      ragContents.forEach((rag, i) => {
        console.log(`\nRAG ${i + 1}:`);
        console.log('  Lesson ID:', rag.lessonId);
        console.log('  Section:', rag.sectionTitle);
        console.log('  Content preview:', rag.content?.substring(0, 100));
      });
    } else {
      console.log('No RAG content found in database');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDetailedContent();