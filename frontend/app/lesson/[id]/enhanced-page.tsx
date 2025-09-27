"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Trophy,
  Brain,
  Play,
  BookOpen,
  Target,
  Zap,
  ChevronLeft,
  Bookmark,
  Share2,
  Download,
  CheckCircle,
  Lock,
  BarChart,
  Sparkles,
  Award,
  Heart,
  Activity
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardContent } from "@/components/ui/Card";

// Import AI components
import TeachingAssistant from "@/components/ai/TeachingAssistant";
import EmotionalIndicator from "@/components/ai/EmotionalIndicator";
import SupportMessage from "@/components/ai/SupportMessage";
import BreakReminder from "@/components/ai/BreakReminder";
import LiveIndicator from "@/components/shared/LiveIndicator";
import NotificationToast, { useNotifications } from "@/components/shared/NotificationToast";

// Import AI hooks
import { useTeachingAssistant } from "@/hooks/useTeachingAssistant";
import { useEmotionalIntelligence } from "@/hooks/useEmotionalIntelligence";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import useAuthStore from "@/stores/useAuthStore";

export default function EnhancedLessonPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;
  const { user } = useAuthStore();
  const userId = user?.id || "";

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [currentSlide, setCurrentSlide] = useState<Record<string, unknown> | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(true);

  // AI Hooks
  const teachingAssistant = useTeachingAssistant(lessonId);
  const emotionalIntelligence = useEmotionalIntelligence(userId);
  const webSocket = useWebSocket(lessonId);
  const studentProfile = useStudentProfile(userId);
  const notifications = useNotifications();

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!webSocket.isConnected) return;

    // Teaching events
    const unsubTeaching = webSocket.onTeachingUpdate((data) => {
      console.log("Teaching update:", data);
      notifications.info("تحديث تعليمي", data.message);
    });

    // Emotional events
    const unsubEmotional = webSocket.onEmotionalStateChange((data) => {
      console.log("Emotional state change:", data);
      if (data.needsSupport) {
        notifications.support("دعم عاطفي", "يبدو أنك تحتاج إلى مساعدة. كيف يمكنني مساعدتك؟");
      }
    });

    // Achievement events
    const unsubAchievement = webSocket.onAchievementUnlocked((data) => {
      console.log("Achievement unlocked:", data);
      notifications.achievement("إنجاز جديد!", data.achievement.name);
    });

    // Slide events
    const unsubSlide = webSocket.onSlideReady((data) => {
      console.log("Slide ready:", data);
      setCurrentSlide(data.slide);
    });

    return () => {
      unsubTeaching();
      unsubEmotional();
      unsubAchievement();
      unsubSlide();
    };
  }, [webSocket, notifications]);

  // Track user activity
  useEffect(() => {
    const activityInterval = setInterval(() => {
      emotionalIntelligence.trackActivity("page_view", true);
      webSocket.trackUserActivity("lesson_engagement", { lessonId });
    }, 30000); // Every 30 seconds

    return () => clearInterval(activityInterval);
  }, [emotionalIntelligence, webSocket, lessonId]);

  // Handle emotional state changes
  useEffect(() => {
    if (emotionalIntelligence.emotionalData.needsBreak) {
      notifications.info("وقت الاستراحة", "لقد كنت تدرس لفترة طويلة. خذ استراحة قصيرة!");
    }

    if (emotionalIntelligence.emotionalData.needsSupport) {
      setShowAIAssistant(true);
    }
  }, [emotionalIntelligence.emotionalData, notifications]);

  // Placeholder lesson data (will be replaced with real API call)
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

  const handleStartLesson = () => {
    // Track activity
    emotionalIntelligence.trackActivity("lesson_start", true);
    webSocket.trackUserActivity("lesson_started", { lessonId });

    // Generate initial teaching script
    teachingAssistant.generateScript({
      type: "introduction",
      title: lesson.title,
      content: lesson.description
    });

    // Show notification
    notifications.success("بداية رائعة!", "هيا نبدأ رحلة التعلم!");
  };

  const handleEmotionalClick = () => {
    emotionalIntelligence.clearSuggestions();
    emotionalIntelligence.getSuggestions();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 py-8">
      {/* Notification Toast */}
      <NotificationToast
        notifications={notifications.notifications}
        onDismiss={notifications.removeNotification}
        position="top-right"
      />

      {/* Break Reminder */}
      <BreakReminder
        sessionDuration={emotionalIntelligence.emotionalData.sessionDuration}
        onBreakStart={() => {
          emotionalIntelligence.trackActivity("break_started", true);
          webSocket.trackUserActivity("break_taken");
        }}
        onBreakEnd={() => {
          emotionalIntelligence.trackActivity("break_ended", true);
          notifications.motivation("عودة موفقة!", "هيا نكمل التعلم بنشاط!");
        }}
      />

      <div className="container-custom">
        {/* Top Bar with Live Status and Emotional Indicator */}
        <div className="flex items-center justify-between mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            {/* Breadcrumb */}
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

            {/* Live Indicator */}
            <LiveIndicator
              isConnected={webSocket.isConnected}
              reconnectAttempt={webSocket.reconnectAttempt}
            />
          </motion.div>

          {/* Emotional Indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-72"
          >
            <EmotionalIndicator
              mood={emotionalIntelligence.emotionalData.mood}
              confidence={emotionalIntelligence.emotionalData.confidence}
              engagement={emotionalIntelligence.emotionalData.engagement}
              onMoodClick={handleEmotionalClick}
            />
          </motion.div>
        </div>

        {/* Support Messages */}
        {emotionalIntelligence.suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <SupportMessage
              suggestions={emotionalIntelligence.suggestions}
              onDismiss={(index) => {
                const newSuggestions = [...emotionalIntelligence.suggestions];
                newSuggestions.splice(index, 1);
                emotionalIntelligence.clearSuggestions();
              }}
            />
          </motion.div>
        )}

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
                      <span>{studentProfile.profile?.points || 0} نقطة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      <span>مستوى {studentProfile.profile?.level || 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-300" />
                      <span>{studentProfile.profile?.streak || 0} يوم متتالي</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 w-full md:w-auto">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full md:w-auto bg-white text-primary-600 hover:bg-gray-100"
                    onClick={handleStartLesson}
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
            {/* AI Teaching Assistant */}
            <AnimatePresence>
              {showAIAssistant && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <TeachingAssistant
                    lessonId={lessonId}
                    slideContent={currentSlide || undefined}
                    className="mb-6"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toggle AI Assistant Button */}
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAIAssistant(!showAIAssistant)}
                className="flex items-center gap-2"
              >
                <Brain className="h-4 w-4" />
                {showAIAssistant ? "إخفاء المساعد الذكي" : "إظهار المساعد الذكي"}
              </Button>
            </div>

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
                        onClick={() => {
                          if (objective.completed) {
                            emotionalIntelligence.trackActivity("objective_reviewed", true);
                          }
                        }}
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

            {/* Lesson Sections with AI Integration */}
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
                        onClick={() => {
                          emotionalIntelligence.trackActivity(`section_${index}_clicked`, true);
                          webSocket.trackUserActivity("section_opened", { sectionIndex: index });

                          // Generate teaching script for this section
                          teachingAssistant.generateScript({
                            type: "section",
                            title: section.title,
                            content: `Starting section: ${section.title}`
                          });
                        }}
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
          </div>

          {/* Sidebar with Student Profile Info */}
          <div className="space-y-6">
            {/* Student Progress Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card variant="elevated">
                <CardHeader>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <BarChart className="h-5 w-5 text-primary-600" />
                    تقدمك الشخصي
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">المستوى</span>
                        <span className="font-semibold">
                          {studentProfile.profile?.level || 1}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary-400 to-primary-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${studentProfile.getLevelProgress()}%` }}
                          transition={{ duration: 1 }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <Trophy className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                        <p className="text-xs text-gray-600">النقاط</p>
                        <p className="font-bold text-primary-600">
                          {studentProfile.profile?.points || 0}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <Zap className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                        <p className="text-xs text-gray-600">السلسلة</p>
                        <p className="font-bold text-primary-600">
                          {studentProfile.profile?.streak || 0} يوم
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 mb-1">نمط التعلم المفضل</p>
                      <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                        {studentProfile.profile?.learningStyle === "visual" && "بصري"}
                        {studentProfile.profile?.learningStyle === "auditory" && "سمعي"}
                        {studentProfile.profile?.learningStyle === "kinesthetic" && "حركي"}
                        {studentProfile.profile?.learningStyle === "reading" && "قرائي"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* AI Features */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card variant="elevated">
                <CardHeader>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-motivation-600" />
                    مميزات الذكاء الاصطناعي
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Brain className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">مساعد تعليمي ذكي</h4>
                        <p className="text-xs text-gray-600">12 نوع تفاعل مختلف</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Heart className="h-5 w-5 text-success-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">ذكاء عاطفي</h4>
                        <p className="text-xs text-gray-600">مراقبة ودعم مستمر</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-motivation-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Activity className="h-5 w-5 text-motivation-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">تتبع فوري</h4>
                        <p className="text-xs text-gray-600">WebSocket مباشر</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Award className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">نظام إنجازات</h4>
                        <p className="text-xs text-gray-600">شارات ومكافآت</p>
                      </div>
                    </div>
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