import { ragService } from './src/core/rag/rag.service';

async function testRAG() {
  const questions = [
    "ما هي قواعد القابلية للقسمة؟",
    "اشرح لي الأعداد النسبية",
    "كيف أحل معادلة جبرية؟",
    "ما الفرق بين المتغير المستقل والتابع؟"
  ];
  
  for (const q of questions) {
    console.log(`\n❓ ${q}`);
    const result = await ragService.answerQuestion(q);
    console.log(`✅ ${result.answer.substring(0, 200)}...`);
  }
}

testRAG();