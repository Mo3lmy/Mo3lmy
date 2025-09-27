"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Clock,
  Trophy,
  Brain,
  Play,
  BookOpen,
  Target,
  Star,
  Zap,
  ChevronLeft,
  Bookmark,
  Share2,
  Download,
  CheckCircle,
  Lock,
  Users,
  BarChart,
  MessageCircle,
  Sparkles,
  FileText,
  Video,
  Headphones,
  PenTool,
  Lightbulb,
  Award,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardContent } from "@/components/ui/Card";

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Placeholder data - will be replaced with real API calls
  const lesson = {
    id: lessonId,
    title: "المعادلات الخطية",
    titleAr: "المعادلات الخطية",
    description: "تعلم كيفية حل المعادلات الخطية خطوة بخطوة مع أمثلة تفاعلية",
    duration: 45,
    difficulty: "MEDIUM",
    subject: "الرياضيات",
    grade: 9,
    completionRate: 65,
    totalStudents: 234,
    rating: 4.7,
    keyPoints: [
      "فهم مفهوم المعادلة الخطية",
      "تعلم خطوات حل المعادلة",
      "التطبيق على أمثلة عملية",
      "حل تمارين متنوعة",
    ],
    objectives: [
      { text: "فهم المعادلات الخطية", completed: true },
      { text: "حل معادلات بسيطة", completed: true },
      { text: "حل معادلات معقدة", completed: false },
      { text: "التطبيق العملي", completed: false },
    ],
    sections: [
      { title: "المقدمة", duration: 5, completed: true },
      { title: "الشرح النظري", duration: 15, completed: true },
      { title: "الأمثلة التطبيقية", duration: 15, completed: false },
      { title: "التمارين", duration: 10, completed: false },
    ],
  };

  const relatedLessons = [
    { id: "2", title: "المعادلات التربيعية", difficulty: "HARD", duration: 60 },
    { id: "3", title: "أنظمة المعادلات", difficulty: "MEDIUM", duration: 50 },
    { id: "4", title: "المتباينات الخطية", difficulty: "EASY", duration: 40 },
  ];

  const getDifficultyDetails = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return {
          label: "سهل",
          color: "text-success-600 bg-success-100",
          icon: <Zap className="h-4 w-4" />,
        };
      case "MEDIUM":
        return {
          label: "متوسط",
          color: "text-motivation-600 bg-motivation-100",
          icon: <Brain className="h-4 w-4" />,
        };
      case "HARD":
        return {
          label: "صعب",
          color: "text-red-600 bg-red-100",
          icon: <Target className="h-4 w-4" />,
        };
      default:
        return {
          label: difficulty,
          color: "text-gray-600 bg-gray-100",
          icon: null,
        };
    }
  };

  const difficultyDetails = getDifficultyDetails(lesson.difficulty);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 py-8">
      <div className="container-custom">
        {/* Breadcrumb Navigation */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <button
              onClick={() => router.push("/dashboard")}
              className="hover:text-primary-600 transition-colors"
            >
              الرئيسية
            </button>
            <ChevronLeft className="h-4 w-4 text-gray-400" />
            <button
              onClick={() => router.push("/lessons")}
              className="hover:text-primary-600 transition-colors"
            >
              الدروس
            </button>
            <ChevronLeft className="h-4 w-4 text-gray-400" />
            <span className="text-gray-900 font-medium">{lesson.subject}</span>
          </nav>
        </motion.div>

        {/* Lesson Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <Card variant="elevated" className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-white">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-sm font-medium">
                      {lesson.subject}
                    </span>
                    <span className="px-3 py-1 bg-white/10 backdrop-blur rounded-full text-sm">
                      الصف {lesson.grade}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${difficultyDetails.color}`}
                    >
                      {difficultyDetails.icon}
                      {difficultyDetails.label}
                    </span>
                  </div>
                  <h1 className="text-4xl font-bold font-amiri mb-3">
                    {lesson.titleAr}
                  </h1>
                  <p className="text-white/90 leading-relaxed mb-4 text-lg">
                    {lesson.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      <span>{lesson.duration} دقيقة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-300" />
                      <span>100 نقطة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      <span>{lesson.totalStudents} طالب</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-5 w-5 text-yellow-300 fill-current" />
                      <span className="font-semibold">{lesson.rating}</span>
                      <span className="text-white/70">(42 تقييم)</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 w-full md:w-auto">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full md:w-auto bg-white text-primary-600 hover:bg-gray-100"
                    onClick={() => {
                      // Navigate to lesson viewer/slides
                      console.log("Start lesson:", lessonId);
                    }}
                  >
                    <Play className="ml-2 h-5 w-5" />
                    ابدأ الدرس
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="md"
                      className="bg-white/10 text-white hover:bg-white/20"
                      onClick={() => setIsBookmarked(!isBookmarked)}
                    >
                      <Bookmark
                        className={`h-5 w-5 ${isBookmarked ? "fill-current" : ""}`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      className="bg-white/10 text-white hover:bg-white/20"
                    >
                      <Share2 className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      className="bg-white/10 text-white hover:bg-white/20"
                    >
                      <Download className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">التقدم في الدرس</span>
                <span className="text-sm font-bold text-primary-600">{lesson.completionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${lesson.completionRate}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-full bg-gradient-to-r from-primary-400 to-primary-600"
                />
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Learning Objectives */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card variant="bordered">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Target className="h-6 w-6 text-primary-600" />
                    أهداف التعلم
                  </h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {lesson.objectives.map((objective, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + index * 0.1 }}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                          objective.completed
                            ? "bg-success-50 border border-success-200"
                            : "bg-gray-50 border border-gray-200"
                        }`}
                      >
                        {objective.completed ? (
                          <CheckCircle className="h-5 w-5 text-success-600" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-gray-400 rounded-full" />
                        )}
                        <span
                          className={`${
                            objective.completed ? "text-success-800" : "text-gray-700"
                          }`}
                        >
                          {objective.text}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Lesson Sections */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card variant="bordered">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <BookOpen className="h-6 w-6 text-primary-600" />
                    محتوى الدرس
                  </h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {lesson.sections.map((section, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.1 }}
                        className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                          section.completed
                            ? "bg-white border-success-200 hover:border-success-300"
                            : "bg-gray-50 border-gray-200 hover:border-primary-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                                section.completed
                                  ? "bg-success-500 text-white"
                                  : "bg-gray-200 text-gray-600"
                              }`}
                            >
                              {section.completed ? (
                                <CheckCircle className="h-5 w-5" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {section.title}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {section.duration} دقائق
                              </p>
                            </div>
                          </div>
                          {!section.completed && index > 1 && (
                            <Lock className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Key Points */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card variant="bordered">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Lightbulb className="h-6 w-6 text-motivation-600" />
                    النقاط الرئيسية
                  </h2>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {lesson.keyPoints.map((point, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 + index * 0.1 }}
                        whileHover={{ scale: 1.05 }}
                        className="flex items-start gap-3 p-4 bg-gradient-to-br from-primary-50 to-white rounded-lg border border-primary-200"
                      >
                        <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                          {index + 1}
                        </div>
                        <p className="text-gray-700">{point}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Features */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card variant="elevated">
                <CardHeader>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-motivation-600" />
                    مميزات الدرس
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Brain className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">مساعد AI ذكي</h4>
                        <p className="text-xs text-gray-600">احصل على مساعدة فورية</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <PenTool className="h-5 w-5 text-success-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">تمارين تفاعلية</h4>
                        <p className="text-xs text-gray-600">حل وتقييم فوري</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-motivation-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Video className="h-5 w-5 text-motivation-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">شرح بالفيديو</h4>
                        <p className="text-xs text-gray-600">فيديوهات عالية الجودة</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Headphones className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">شرح صوتي</h4>
                        <p className="text-xs text-gray-600">استمع للدرس</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card variant="bordered">
                <CardHeader>
                  <h3 className="text-lg font-semibold text-gray-900">
                    إجراءات سريعة
                  </h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <MessageCircle className="ml-2 h-4 w-4" />
                    اسأل المعلم
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="ml-2 h-4 w-4" />
                    تحميل الملخص
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <BarChart className="ml-2 h-4 w-4" />
                    عرض التقدم
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Related Lessons */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Card variant="bordered">
                <CardHeader>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary-600" />
                    دروس مشابهة
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {relatedLessons.map((relatedLesson, index) => (
                      <motion.div
                        key={relatedLesson.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 + index * 0.1 }}
                        whileHover={{ x: -5 }}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
                        onClick={() => router.push(`/lesson/${relatedLesson.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {relatedLesson.title}
                            </h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-600">
                                {relatedLesson.duration} دقيقة
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  getDifficultyDetails(relatedLesson.difficulty).color
                                }`}
                              >
                                {getDifficultyDetails(relatedLesson.difficulty).label}
                              </span>
                            </div>
                          </div>
                          <ChevronLeft className="h-4 w-4 text-gray-400" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Achievement Preview */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <Card variant="elevated" className="bg-gradient-to-br from-motivation-500 to-motivation-600 text-white">
                <CardContent className="text-center py-6">
                  <Award className="h-12 w-12 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">أكمل الدرس</h3>
                  <p className="text-sm opacity-90 mb-3">
                    واحصل على شارة &quot;خبير المعادلات&quot;
                  </p>
                  <div className="flex justify-center gap-1">
                    {[...Array(3)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-current text-yellow-300" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}