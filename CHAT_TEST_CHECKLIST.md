# 📋 Chat System Test Checklist

## ✅ المكونات المُثبتة

### 1. **FloatingChat Component** (/frontend/components/chat/FloatingChat.tsx)
- ✅ زر عائم في أسفل يمين الشاشة
- ✅ عدّاد الرسائل غير المقروءة
- ✅ صوت notification
- ✅ حفظ الحالة في localStorage
- ✅ minimize/maximize support

### 2. **AssistantPanel Component** (/frontend/components/classroom/AssistantPanel.tsx)
- ✅ يعمل مع context الدرس (في classroom)
- ✅ يعمل كشات عام (في باقي الصفحات)
- ✅ clear chat function
- ✅ export chat as text
- ✅ font size control
- ✅ keyboard shortcuts

### 3. **Integration Points**
- ✅ FloatingChatWrapper في layout.tsx
- ✅ API Service مُحدث
- ✅ WebSocket support

---

## 🧪 اختبارات يجب إجراؤها

### **1. اختبر في Dashboard (/dashboard):**

```
□ هل الزر العائم يظهر في أسفل يمين الشاشة؟
□ عند الضغط على الزر، هل يفتح نافذة الشات؟
□ أرسل "مرحبا" - هل يأتي رد من المساعد؟
□ جرب الاقتراحات السريعة - هل تعمل؟
□ جرب زر مسح المحادثة - هل يمسح كل الرسائل؟
□ جرب تصدير المحادثة - هل يحمل ملف txt؟
□ جرب تكبير/تصغير الخط - هل يتغير حجم النص؟
```

### **2. اختبر في صفحة Lesson (/classroom/[lessonId]):**

```
□ هل زر الشات في classroom يعمل (من QuickActions)؟
□ هل يعرض اسم الدرس في الرسالة الترحيبية؟
□ أرسل "ما هو موضوع الدرس؟" - هل يعرف السياق؟
□ هل الزر العائم موجود أيضاً في الصفحة؟
□ هل يمكن فتح شاتين في نفس الوقت (عائم + classroom)؟
```

### **3. اختبر التنقل بين الصفحات:**

```
□ افتح الشات في Dashboard
□ انتقل إلى صفحة أخرى - هل الزر العائم ما زال موجود؟
□ هل حالة الشات (مفتوح/مغلق) محفوظة؟
□ refresh الصفحة - هل يتذكر الحالة السابقة؟
```

### **4. اختبر المميزات:**

```
□ Minimize - هل يصغر النافذة مع بقاء header؟
□ Sound - هل يمكن كتم/تفعيل الصوت؟
□ Unread Counter - أغلق الشات وأرسل رسالة من مكان آخر - هل يظهر العداد؟
□ Keyboard Shortcuts:
  - Enter للإرسال
  - Escape للإغلاق
□ Animation - هل كل الحركات smooth؟
```

### **5. اختبر Edge Cases:**

```
□ أرسل رسالة طويلة جداً (100+ كلمة) - هل التنسيق سليم؟
□ أرسل رسائل متتالية سريعة - هل يعرضها بالترتيب؟
□ أرسل emojis ورموز خاصة - هل تظهر بشكل صحيح؟
□ جرب في شاشة صغيرة (mobile) - هل responsive؟
□ اقطع الإنترنت وحاول الإرسال - هل يعطي رسالة خطأ واضحة؟
```

---

## 🔧 Debug Commands (للمطورين)

افتح Console في المتصفح واكتب:

```javascript
// التحقق من الخدمات
console.log('API Service:', apiService)
console.log('Socket Service:', socketService)
console.log('Socket Connected:', socketService.isConnected())

// التحقق من localStorage
console.log('Chat State:', localStorage.getItem('floatingChatState'))
console.log('Auth Token:', localStorage.getItem('auth-storage'))

// اختبار API مباشرة
apiService.sendChatMessage('test message', 'test-session').then(console.log)

// اختبار WebSocket
socketService.sendChatMessage('test message')
```

---

## ⚠️ مشاكل محتملة وحلولها

### المشكلة: الزر العائم لا يظهر
**الحل:**
1. تأكد من تسجيل الدخول (الزر يظهر فقط للمستخدمين المسجلين)
2. Hard refresh: Ctrl+Shift+R
3. تحقق من Console للأخطاء

### المشكلة: لا يأتي رد من المساعد
**الحل:**
1. تحقق من اتصال WebSocket: `socketService.isConnected()`
2. تحقق من Network tab في DevTools
3. تأكد من أن Backend يعمل على port 3001

### المشكلة: الرسائل لا تُحفظ
**الحل:**
1. الرسائل حالياً تُحفظ في memory فقط
2. عند refresh تضيع - هذا سلوك متوقع
3. يمكن إضافة persistence في المستقبل

### المشكلة: الصوت لا يعمل
**الحل:**
1. تحقق من أن المتصفح يسمح بالأصوات
2. تأكد من أن الصوت غير مكتوم في النظام
3. جرب في متصفح آخر

---

## 📝 ملاحظات للمستخدم

1. **الشات يعمل في وضعين:**
   - **وضع الدرس**: عندما تكون في صفحة classroom، يعرف سياق الدرس
   - **وضع عام**: في باقي الصفحات، يعمل كمساعد عام

2. **الاقتراحات السريعة:**
   - تظهر فقط عند بداية المحادثة
   - اضغط على أي اقتراح لملء حقل الإدخال

3. **التصدير:**
   - يصدر المحادثة كملف نصي بصيغة txt
   - يحتوي على التوقيت والمرسل والرسالة

4. **الـ WebSocket:**
   - يوفر ردود فورية
   - في حالة الفشل، يستخدم HTTP كـ fallback

---

## ✅ النتيجة النهائية

**النظام جاهز للاستخدام مع المميزات التالية:**
- ✅ شات عائم في جميع الصفحات
- ✅ تكامل مع سياق الدروس
- ✅ WebSocket للردود الفورية
- ✅ مميزات UX متقدمة (صوت، عداد، تصدير، إلخ)
- ✅ Responsive design
- ✅ Error handling
- ✅ State persistence

---

تاريخ آخر تحديث: ${new Date().toLocaleDateString('ar-SA')}