import { ragService } from './core/rag/rag.service';
import { documentProcessor } from './core/rag/document.processor';
import { vectorSearch } from './core/rag/vector.search';
import { prisma } from './config/database.config';

async function testRAG() {
  console.log('🧪 Testing RAG System...\n');
  
  try {
    // Get first lesson
    const lesson = await prisma.lesson.findFirst({
      where: { isPublished: true },
      include: { content: true },
    });
    
    if (!lesson || !lesson.content) {
      console.log('❌ No published lesson with content found');
      return;
    }
    
    console.log(`📚 Using lesson: ${lesson.title}\n`);
    
    // Test 1: Process content and create embeddings
    console.log('1️⃣ Processing lesson content...');
    await documentProcessor.processLessonContent(lesson.id);
    console.log('✅ Content processed and embeddings created\n');
    
    // Test 2: Search for similar content
    console.log('2️⃣ Testing vector search...');
    const searchResults = await vectorSearch.searchSimilar('الأعداد الطبيعية', 3);
    console.log(`✅ Found ${searchResults.length} similar chunks`);
    if (searchResults.length > 0) {
      console.log(`   Top match: ${searchResults[0].chunk.text.substring(0, 50)}...`);
      console.log(`   Similarity: ${(searchResults[0].score * 100).toFixed(1)}%\n`);
    }
    
    // Test 3: Answer a question
    console.log('3️⃣ Testing question answering...');
    const question = 'ما هي الأعداد الطبيعية؟';
    console.log(`   Question: ${question}`);
    
    const answer = await ragService.answerQuestion(question, lesson.id);
    console.log(`   Answer: ${answer.answer.substring(0, 200)}...`);
    console.log(`   Confidence: ${answer.confidence}%`);
    console.log(`   Sources: ${answer.sources.length} chunks used\n`);
    
    // Test 4: Generate quiz questions
    console.log('4️⃣ Testing quiz generation...');
    const quizQuestions = await ragService.generateQuizQuestions(lesson.id, 2);
    console.log(`✅ Generated ${quizQuestions.length} quiz questions`);
    
    if (quizQuestions.length > 0) {
      console.log(`   Sample question: ${quizQuestions[0].question}`);
    }
    
    // Test 5: Explain concept
    console.log('\n5️⃣ Testing concept explanation...');
    const explanation = await ragService.explainConcept('الضرب', 6);
    console.log(`   Explanation: ${explanation.substring(0, 200)}...`);
    
    console.log('\n🎉 RAG system tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testRAG().catch(console.error);