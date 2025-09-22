// src/scripts/process-content.ts
import { documentProcessor } from '../core/rag/document.processor';
import { vectorSearch } from '../core/rag/vector.search';
import { prisma } from '../config/database.config';

async function main() {
  console.log('🚀 Content Processing Script\n');
  
  try {
    // Check current status
    const lessonCount = await prisma.lesson.count();
    const contentCount = await prisma.content.count();
    const embeddingCount = await prisma.contentEmbedding.count();
    
    console.log('📊 Current Database Status:');
    console.log(`   Lessons: ${lessonCount}`);
    console.log(`   Content: ${contentCount}`);
    console.log(`   Embeddings: ${embeddingCount}\n`);
    
    if (lessonCount === 0) {
      console.log('❌ No lessons found!');
      console.log('   Run: npm run db:seed');
      process.exit(1);
    }
    
    if (contentCount === 0) {
      console.log('❌ No content found!');
      console.log('   Run: npm run db:seed');
      process.exit(1);
    }
    
    // Process all content
    await documentProcessor.processAllContent();
    
    // Verify embeddings
    await documentProcessor.verifyEmbeddings();
    
    // Initialize vector search
    await vectorSearch.initialize();
    
    console.log('\n✅ Content processing complete!');
    console.log('🎉 RAG system is ready to use!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();