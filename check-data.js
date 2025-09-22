// check-data.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  console.log('🔍 فحص قاعدة البيانات...\n');
  
  // 1. عد البيانات
  const counts = {
    lessons: await prisma.lesson.count(),
    content: await prisma.content.count(),
    embeddings: await prisma.contentEmbedding.count()
  };
  
  console.log('📊 الإحصائيات:');
  console.log(`   دروس: ${counts.lessons}`);
  console.log(`   محتوى: ${counts.content}`);
  console.log(`   Embeddings: ${counts.embeddings}`);
  
  // 2. فحص محتوى عينة
  const sampleContent = await prisma.content.findFirst({
    include: { lesson: true }
  });
  
  if (sampleContent) {
    console.log('\n📝 عينة من المحتوى:');
    console.log(`   الدرس: ${sampleContent.lesson.title}`);
    console.log(`   النص: ${sampleContent.fullText?.substring(0, 200)}...`);
    
    // هل يحتوي على كلمات مفتاحية؟
    const keywords = ['ضرب', 'جمع', 'كسور', 'قسمة', 'أعداد'];
    const foundKeywords = keywords.filter(k => 
      sampleContent.fullText?.includes(k) || 
      sampleContent.summary?.includes(k)
    );
    console.log(`   كلمات مفتاحية: ${foundKeywords.join(', ') || 'لا يوجد'}`);
  }
  
  // 3. فحص Embeddings
  const sampleEmbedding = await prisma.contentEmbedding.findFirst();
  if (sampleEmbedding) {
    console.log('\n🧠 عينة Embedding:');
    console.log(`   النص: ${sampleEmbedding.chunkText?.substring(0, 100)}...`);
    const embedding = JSON.parse(sampleEmbedding.embedding);
    console.log(`   الأبعاد: ${embedding.length}`);
    console.log(`   قيم حقيقية: ${embedding.slice(0, 3).every(v => v !== 0) ? 'نعم' : 'لا'}`);
  }
  
  await prisma.$disconnect();
}

checkData();