// script بسيط لتعديل curriculum-data.json
// احفظه في: fix-curriculum-data.js
// تشغيل: node fix-curriculum-data.js

const fs = require('fs');
const path = require('path');

// قراءة الملف الحالي
const filePath = path.join(__dirname, 'data/curriculum-data.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// إضافة الحقول الناقصة فقط (بدون تغيير الموجود)
if (!data.subject.nameAr) {
  data.subject.nameAr = data.subject.name || 'الرياضيات';
}

// إضافة order للوحدات
data.units.forEach((unit, index) => {
  if (!unit.order) {
    unit.order = index + 1;
  }
  if (!unit.titleAr) {
    unit.titleAr = unit.title;
  }
  
  // إضافة order للدروس
  unit.lessons.forEach((lesson, lessonIndex) => {
    if (!lesson.order) {
      lesson.order = lessonIndex + 1;
    }
    if (!lesson.titleAr) {
      lesson.titleAr = lesson.title;
    }
    
    // التأكد من وجود المحتوى الأساسي
    if (!lesson.content) {
      lesson.content = {};
    }
    
    // إضافة fullText إذا مش موجود
    if (!lesson.content.fullText) {
      lesson.content.fullText = lesson.content.introduction || 
                                 lesson.content.summary || 
                                 `درس ${lesson.title}`;
    }
    
    // إضافة summary إذا مش موجود
    if (!lesson.content.summary) {
      lesson.content.summary = lesson.content.introduction?.substring(0, 200) || 
                               `ملخص درس ${lesson.title}`;
    }
    
    // إضافة keyPoints إذا مش موجود
    if (!lesson.content.keyPoints) {
      lesson.content.keyPoints = lesson.objectives || 
                                 [`نقطة رئيسية 1`, `نقطة رئيسية 2`, `نقطة رئيسية 3`];
    }
    
    // إضافة concepts إذا مش موجود
    if (!lesson.content.concepts) {
      lesson.content.concepts = [`مفهوم أساسي في ${lesson.title}`];
    }
    
    // إضافة examples إذا مش موجود
    if (!lesson.content.examples || lesson.content.examples.length === 0) {
      lesson.content.examples = [
        {
          problem: `مثال على ${lesson.title}`,
          solution: `حل المثال`
        }
      ];
    }
  });
});

// حفظ الملف المُعدل
const outputPath = filePath.replace('.json', '-fixed.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

console.log('✅ تم إصلاح الملف!');
console.log(`📁 الملف الجديد: ${outputPath}`);
console.log('\n🚀 الآن يمكنك تشغيل:');
console.log('   npm run setup:complete');