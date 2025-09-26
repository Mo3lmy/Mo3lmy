// check-json.js
const fs = require('fs');

try {
  const data = fs.readFileSync('data/curriculum-data.json', 'utf-8');
  const json = JSON.parse(data);
  
  console.log('✅ JSON صحيح!');
  console.log(`📊 عدد الوحدات: ${json.units?.length || 0}`);
  
  json.units?.forEach((unit, i) => {
    console.log(`   الوحدة ${i+1}: ${unit.title} (${unit.lessons?.length || 0} دروس)`);
  });
  
} catch (error) {
  console.error('❌ خطأ في JSON:', error.message);
  
  // محاولة تحديد مكان الخطأ
  const match = error.message.match(/position (\d+)/);
  if (match) {
    const position = parseInt(match[1]);
    const data = fs.readFileSync('data/curriculum-data.json', 'utf-8');
    const start = Math.max(0, position - 100);
    const end = Math.min(data.length, position + 100);
    
    console.log('\n📍 المنطقة حول الخطأ:');
    console.log(data.substring(start, end));
    console.log(' '.repeat(position - start) + '^--- هنا المشكلة');
  }
}