// src/scripts/verify-content.ts
import { prisma } from '../config/database.config';
import { ragService } from '../core/rag/rag.service';

async function verifyContent() {
  console.log('🔍 Verifying RAG Content System\n');
  
  try {
    // Database stats
    const stats = {
      subjects: await prisma.subject.count(),
      units: await prisma.unit.count(),
      lessons: await prisma.lesson.count(),
      content: await prisma.content.count(),
      embeddings: await prisma.contentEmbedding.count(),
      questions: await prisma.question.count(),
    };
    
    console.log('📊 Database Statistics:');
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
    // Test questions
    const testQuestions = [
      'ما هي قابلية القسمة؟',
      'اشرح الضرب',
      'ما هي الأعداد الأولية؟',
      'كيف أحسب المضاعف المشترك الأصغر؟'
    ];
    
    console.log('\n🧪 Testing RAG Responses:\n');
    
    for (const question of testQuestions) {
      console.log(`Q: ${question}`);
      const response = await ragService.answerQuestion(question);
      const preview = response.answer.substring(0, 100);
      console.log(`A: ${preview}...`);
      console.log(`   Confidence: ${response.confidence}%\n`);
    }
    
    console.log('✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyContent();