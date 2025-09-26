// Script to check enriched content in database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEnrichedContent() {
  console.log('🔍 Checking Enriched Content in Database\n');
  console.log('='.repeat(60));

  try {
    // 1. Check if Content table has any records
    const contentCount = await prisma.content.count();
    console.log(`\n📊 Total LessonContent records: ${contentCount}`);

    if (contentCount === 0) {
      console.log('❌ No content records found!');
      return;
    }

    // 2. Check enrichment levels
    const enrichedContent = await prisma.content.findMany({
      where: {
        enrichmentLevel: { gt: 0 }
      },
      select: {
        id: true,
        lessonId: true,
        enrichmentLevel: true
      }
    });

    console.log(`✅ Enriched content records: ${enrichedContent.length}`);

    // 3. Get a sample of enriched content
    const sample = await prisma.content.findFirst({
      where: {
        enrichmentLevel: { gt: 0 }
      },
      include: {
        lesson: {
          select: {
            title: true,
            titleAr: true
          }
        }
      }
    });

    if (sample) {
      console.log('\n📝 Sample Enriched Content:');
      console.log('='.repeat(60));
      console.log(`Lesson: ${sample.lesson.titleAr || sample.lesson.title}`);
      console.log(`Enrichment Level: ${sample.enrichmentLevel}`);

      // Check what fields have content
      const fields = {
        'fullText': sample.fullText ? sample.fullText.length : 0,
        'summary': sample.summary ? sample.summary.length : 0,
        'keyPoints': sample.keyPoints ? sample.keyPoints.length : 0,
        'examples': sample.examples ? sample.examples.length : 0,
        'exercises': sample.exercises ? sample.exercises.length : 0,
        'realWorldApplications': sample.realWorldApplications ? sample.realWorldApplications.length : 0,
        'commonMistakes': sample.commonMistakes ? sample.commonMistakes.length : 0,
        'tips': sample.tips ? sample.tips.length : 0,
        'enrichedContent': sample.enrichedContent ? JSON.stringify(sample.enrichedContent).length : 0
      };

      console.log('\n📊 Field Sizes (characters):');
      for (const [field, size] of Object.entries(fields)) {
        const status = size > 0 ? '✅' : '❌';
        console.log(`  ${status} ${field}: ${size} chars`);
      }

      // Parse and check structured content
      if (sample.examples) {
        try {
          let examples = typeof sample.examples === 'string'
            ? JSON.parse(sample.examples)
            : sample.examples;
          console.log(`\n📚 Examples: ${Array.isArray(examples) ? examples.length : 0} items`);
          if (Array.isArray(examples) && examples.length > 0) {
            console.log('  First example:', examples[0]);
          }
        } catch (e) {
          console.log('  ⚠️ Could not parse examples');
        }
      }

      if (sample.exercises) {
        try {
          let exercises = typeof sample.exercises === 'string'
            ? JSON.parse(sample.exercises)
            : sample.exercises;
          console.log(`\n💪 Exercises: ${Array.isArray(exercises) ? exercises.length : 0} items`);
          if (Array.isArray(exercises) && exercises.length > 0) {
            console.log('  First exercise:', exercises[0]);
          }
        } catch (e) {
          console.log('  ⚠️ Could not parse exercises');
        }
      }

      if (sample.enrichedContent) {
        try {
          let enriched = typeof sample.enrichedContent === 'string'
            ? JSON.parse(sample.enrichedContent)
            : sample.enrichedContent;
          console.log('\n🎯 Enriched Content Structure:');
          if (enriched) {
            for (const key of Object.keys(enriched)) {
              const value = enriched[key];
              if (Array.isArray(value)) {
                console.log(`  • ${key}: ${value.length} items`);
              } else if (typeof value === 'object' && value !== null) {
                console.log(`  • ${key}: object with ${Object.keys(value).length} keys`);
              } else {
                console.log(`  • ${key}: ${typeof value}`);
              }
            }
          }
        } catch (e) {
          console.log('  ⚠️ Could not parse enrichedContent');
        }
      }

      // Check if content is linked properly
      console.log('\n🔗 Content Linking:');
      console.log(`  Lesson ID: ${sample.lessonId}`);
      console.log(`  Content ID: ${sample.id}`);

      // Check sections
      if (sample.sections) {
        console.log(`\n📑 Sections: ${sample.sections.length || 0}`);
      }

    } else {
      console.log('❌ No enriched content sample found');
    }

    // 4. Check all lessons that have content
    const lessonsWithContent = await prisma.lesson.count({
      where: {
        content: { isNot: null }
      }
    });

    console.log('\n='.repeat(60));
    console.log('📈 Summary:');
    console.log(`  Total lessons with content: ${lessonsWithContent}`);
    console.log(`  Total enriched content: ${enrichedContent.length}`);
    console.log(`  Enrichment percentage: ${Math.round((enrichedContent.length / contentCount) * 100)}%`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEnrichedContent();