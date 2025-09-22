import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testNewData() {
  console.log('🔍 اختبار البيانات الجديدة...\n');
  
  // عرض المواد
  const subjects = await prisma.subject.findMany();
  console.log('📚 المواد الدراسية:');
  subjects.forEach(s => {
    console.log(`   - ${s.name} (الصف ${s.grade})`);
  });
  
  // عرض وحدات الرياضيات
  const mathSubject = await prisma.subject.findFirst({
    where: { name: 'رياضيات', grade: 6 },
    include: {
      units: {
        include: {
          lessons: true
        }
      }
    }
  });
  
  if (mathSubject) {
    console.log('\n📐 منهج الرياضيات:');
    mathSubject.units.forEach(unit => {
      console.log(`\n   📂 ${unit.title}`);
      unit.lessons.forEach(lesson => {
        console.log(`      📝 ${lesson.title}`);
      });
    });
  }
  
  // عد البيانات
  const counts = {
    subjects: await prisma.subject.count(),
    units: await prisma.unit.count(),
    lessons: await prisma.lesson.count(),
    questions: await prisma.question.count(),
    content: await prisma.content.count(),
  };
  
  console.log('\n📊 إحصائيات:');
  console.log(`   - المواد: ${counts.subjects}`);
  console.log(`   - الوحدات: ${counts.units}`);
  console.log(`   - الدروس: ${counts.lessons}`);
  console.log(`   - الأسئلة: ${counts.questions}`);
  console.log(`   - المحتوى: ${counts.content}`);
}

testNewData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());