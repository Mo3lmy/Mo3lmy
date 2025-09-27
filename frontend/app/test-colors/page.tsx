"use client";

export default function TestColorsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Title Section */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-blue-600 mb-4 font-amiri">
            مُعلمي - منصة التعليم الذكية
          </h1>
          <p className="text-xl text-gray-700">
            اختبار الألوان والتصميم - يجب أن تظهر الألوان بوضوح
          </p>
        </div>

        {/* Colored Buttons */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">أزرار ملونة:</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors">
              زر أزرق - ابدأ التعلم
            </button>
            <button className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors">
              زر أخضر - تسجيل دخول
            </button>
            <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors">
              زر برتقالي - إنشاء حساب
            </button>
            <button className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors">
              زر بنفسجي - الإنجازات
            </button>
            <button className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors">
              زر أحمر - خروج
            </button>
            <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors">
              زر أصفر - المساعدة
            </button>
          </div>
        </div>

        {/* Color Boxes */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">صناديق ملونة:</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-32 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              أزرق
            </div>
            <div className="h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center text-white font-bold">
              أخضر
            </div>
            <div className="h-32 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold">
              برتقالي
            </div>
            <div className="h-32 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
              بنفسجي
            </div>
          </div>
        </div>

        {/* Text Colors */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">نصوص ملونة:</h2>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-blue-600">نص أزرق كبير</p>
            <p className="text-2xl font-semibold text-green-600">نص أخضر متوسط</p>
            <p className="text-xl text-orange-600">نص برتقالي عادي</p>
            <p className="text-lg text-purple-600">نص بنفسجي صغير</p>
            <p className="text-base text-red-600">نص أحمر</p>
          </div>
        </div>

        {/* Background Test */}
        <div className="space-y-4">
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-blue-800">خلفية زرقاء فاتحة مع نص أزرق غامق</p>
          </div>
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-green-800">خلفية خضراء فاتحة مع نص أخضر غامق</p>
          </div>
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-orange-800">خلفية برتقالية فاتحة مع نص برتقالي غامق</p>
          </div>
        </div>

        {/* Status Message */}
        <div className="bg-green-500 text-white p-6 rounded-lg text-center">
          <p className="text-2xl font-bold">
            ✅ إذا كنت ترى كل هذه الألوان، فإن Tailwind CSS يعمل بشكل صحيح!
          </p>
        </div>
      </div>
    </div>
  );
}