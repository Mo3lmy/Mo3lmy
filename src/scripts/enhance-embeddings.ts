// src/scripts/enhance-embeddings.ts
// تحسين الـ embeddings بـ chunks أصغر و metadata أكثر

import { prisma } from '../config/database.config';
import { openAIService } from '../services/ai/openai.service';

interface ChunkMetadata {
  lessonId: string;
  lessonTitle: string;
  unitTitle: string;
  subjectName: string;
  grade: number;
  chunkType: 'concept' | 'example' | 'exercise' | 'definition' | 'summary' | 'application';
  difficulty: string;
  keywords: string[];
  relatedConcepts: string[];
  searchTerms: string[];
  isEnriched: boolean;
  enrichmentLevel: number;
  sectionIndex: number;
  totalSections: number;
}

class EmbeddingEnhancer {
  private readonly CHUNK_SIZE = 400; // أصغر من 800 الأصلية
  private readonly CHUNK_OVERLAP = 50; // تداخل للحفاظ على السياق

  /**
   * تحسين embeddings لكل الدروس
   */
  async enhanceAllEmbeddings() {
    console.log('🚀 بدء تحسين الـ Embeddings');
    console.log('=====================================\n');

    try {
      // حذف الـ embeddings القديمة
      console.log('🗑️ حذف الـ embeddings القديمة...');
      await prisma.contentEmbedding.deleteMany();
      console.log('✅ تم الحذف\n');

      // جلب كل الدروس
      const lessons = await prisma.lesson.findMany({
        where: { isPublished: true },
        include: {
          content: true,
          unit: {
            include: {
              subject: true
            }
          }
        }
      });

      console.log(`📚 عدد الدروس: ${lessons.length}\n`);

      let totalChunks = 0;
      let totalEmbeddings = 0;

      // معالجة كل درس
      for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        console.log(`\n📝 [${i + 1}/${lessons.length}] ${lesson.title}`);

        if (!lesson.content) {
          console.log('   ⚠️ لا يوجد محتوى');
          continue;
        }

        try {
          // إنشاء chunks محسنة
          const chunks = await this.createEnhancedChunks(lesson);
          console.log(`   📄 عدد الـ chunks: ${chunks.length}`);

          // توليد embeddings لكل chunk
          for (let j = 0; j < chunks.length; j++) {
            const chunk = chunks[j];
            
            try {
              // توليد embedding
              const { embedding } = await openAIService.generateEmbedding(chunk.text);
              
              // حفظ في قاعدة البيانات
              await prisma.contentEmbedding.create({
                data: {
                  contentId: lesson.content.id,
                  chunkIndex: j,
                  chunkText: chunk.text,
                  embedding: JSON.stringify(embedding),
                  metadata: JSON.stringify(chunk.metadata)
                }
              });

              totalEmbeddings++;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`      ❌ فشل chunk ${j + 1}: ${errorMessage}`);
            }
          }

          totalChunks += chunks.length;
          console.log(`   ✅ تم إنشاء ${chunks.length} embeddings`);

          // انتظار لتجنب rate limits
          await this.sleep(1000);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`   ❌ فشل الدرس: ${errorMessage}`);
        }
      }

      // الإحصائيات النهائية
      console.log('\n=====================================');
      console.log('📊 الإحصائيات النهائية:');
      console.log(`📄 إجمالي الـ chunks: ${totalChunks}`);
      console.log(`🧠 إجمالي الـ embeddings: ${totalEmbeddings}`);
      console.log(`📈 متوسط chunks لكل درس: ${(totalChunks / lessons.length).toFixed(1)}`);

    } catch (error) {
      console.error('❌ خطأ عام:', error);
    }
  }

  /**
   * إنشاء chunks محسنة مع metadata غنية
   */
  private async createEnhancedChunks(lesson: any): Promise<{ text: string; metadata: ChunkMetadata }[]> {
    const chunks: { text: string; metadata: ChunkMetadata }[] = [];
    const content = lesson.content;

    // 1. معالجة المحتوى الأساسي
    const mainContent = content.fullText || '';
    const mainChunks = this.splitIntoChunks(mainContent);
    
    mainChunks.forEach((chunk, index) => {
      chunks.push({
        text: this.enrichChunkText(chunk, lesson.title, lesson.unit.title),
        metadata: this.createMetadata(lesson, 'concept', index, mainChunks.length)
      });
    });

    // 2. معالجة النقاط الرئيسية
    if (content.keyPoints) {
      const keyPoints = JSON.parse(content.keyPoints);
      const keyPointsText = `النقاط الرئيسية لدرس ${lesson.title}:\n` + 
        keyPoints.map((point: string, i: number) => `${i + 1}. ${point}`).join('\n');
      
      chunks.push({
        text: keyPointsText,
        metadata: this.createMetadata(lesson, 'summary', 0, 1)
      });
    }

    // 3. معالجة الأمثلة
    if (content.examples) {
      const examples = JSON.parse(content.examples);
      examples.forEach((example: any, index: number) => {
        const exampleText = `مثال ${index + 1} من درس ${lesson.title}:\n` +
          `المسألة: ${example.problem || example.question || ''}\n` +
          `الحل: ${example.solution || example.answer || ''}`;
        
        chunks.push({
          text: exampleText,
          metadata: this.createMetadata(lesson, 'example', index, examples.length)
        });
      });
    }

    // 4. معالجة التمارين
    if (content.exercises) {
      const exercises = JSON.parse(content.exercises);
      const exerciseChunks = this.splitIntoChunks(
        `تمارين درس ${lesson.title}:\n` + JSON.stringify(exercises)
      );
      
      exerciseChunks.forEach((chunk, index) => {
        chunks.push({
          text: chunk,
          metadata: this.createMetadata(lesson, 'exercise', index, exerciseChunks.length)
        });
      });
    }

    // 5. معالجة المحتوى المُثري (إن وجد)
    if (content.enrichedContent) {
      try {
        const enriched = JSON.parse(content.enrichedContent);
        
        // التطبيقات الواقعية
        if (enriched.realWorldApplications) {
          enriched.realWorldApplications.forEach((app: any, index: number) => {
            const appText = `تطبيق واقعي: ${app.title}\n${app.description}`;
            chunks.push({
              text: appText,
              metadata: this.createMetadata(lesson, 'application', index, enriched.realWorldApplications.length)
            });
          });
        }

        // الأخطاء الشائعة
        if (enriched.commonMistakes) {
          const mistakesText = `الأخطاء الشائعة في درس ${lesson.title}:\n` +
            enriched.commonMistakes.map((m: any) => 
              `- الخطأ: ${m.mistake}\n  الصواب: ${m.correct}`
            ).join('\n');
          
          chunks.push({
            text: mistakesText,
            metadata: this.createMetadata(lesson, 'concept', 0, 1)
          });
        }
      } catch (error) {
        console.warn('Failed to parse enriched content');
      }
    }

    return chunks;
  }

  /**
   * تقسيم النص إلى chunks
   */
  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!؟]\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > this.CHUNK_SIZE && currentChunk) {
        chunks.push(currentChunk.trim());
        // إضافة overlap
        currentChunk = currentChunk.slice(-this.CHUNK_OVERLAP) + sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * إثراء نص الـ chunk بمعلومات إضافية
   */
  private enrichChunkText(text: string, lessonTitle: string, unitTitle: string): string {
    return `[الدرس: ${lessonTitle}] [الوحدة: ${unitTitle}]\n${text}`;
  }

  /**
   * إنشاء metadata غنية للـ chunk
   */
  private createMetadata(lesson: any, chunkType: ChunkMetadata['chunkType'], index: number, total: number): ChunkMetadata {
    // استخراج الكلمات المفتاحية من العنوان
    const keywords = this.extractKeywords(lesson.title);
    
    // إنشاء مصطلحات بحث متنوعة
    const searchTerms = this.generateSearchTerms(lesson.title, lesson.unit.title);

    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      unitTitle: lesson.unit.title,
      subjectName: lesson.unit.subject.name,
      grade: lesson.unit.subject.grade,
      chunkType,
      difficulty: lesson.difficulty || 'MEDIUM',
      keywords,
      relatedConcepts: [], // يمكن إضافتها لاحقاً
      searchTerms,
      isEnriched: !!lesson.content.enrichedContent,
      enrichmentLevel: lesson.content.enrichmentLevel || 0,
      sectionIndex: index,
      totalSections: total
    };
  }

  /**
   * استخراج الكلمات المفتاحية
   */
  private extractKeywords(title: string): string[] {
    const keywords = title.split(/[\s،,و]+/)
      .filter(word => word.length > 2)
      .map(word => word.trim());
    
    return [...new Set(keywords)]; // إزالة المكرر
  }

  /**
   * توليد مصطلحات بحث متنوعة
   */
  private generateSearchTerms(lessonTitle: string, unitTitle: string): string[] {
    const terms = [
      lessonTitle,
      unitTitle,
      `درس ${lessonTitle}`,
      `شرح ${lessonTitle}`,
      `أمثلة ${lessonTitle}`,
      `تمارين ${lessonTitle}`,
      `${lessonTitle} للصف السادس`,
    ];

    // إضافة أشكال مختلفة من الكلمات
    const words = lessonTitle.split(/\s+/);
    if (words.length > 1) {
      terms.push(words[0]); // الكلمة الأولى
      terms.push(words[words.length - 1]); // الكلمة الأخيرة
    }

    return [...new Set(terms)];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// تشغيل التحسين
async function main() {
  const enhancer = new EmbeddingEnhancer();
  await enhancer.enhanceAllEmbeddings();
  await prisma.$disconnect();
}

main().catch(console.error);