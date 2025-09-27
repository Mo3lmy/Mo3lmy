"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen,
  Trophy,
  Target,
  TrendingUp,
  Clock,
  ChevronRight,
  Brain,
  Flame,
  Star,
  Zap,
  GraduationCap,
  Medal,
  Calendar,
  Activity,
  Users,
  BookMarked,
  PenTool,
  Lightbulb,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardContent } from "@/components/ui/Card";
import Loading from "@/components/ui/Loading";
import useAuthStore from "@/stores/useAuthStore";
import { lessonAPI } from "@/services/api";

interface Lesson {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  duration: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  unit: {
    title: string;
    subject: {
      name: string;
      nameAr: string;
    };
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [streakDays] = useState(7); // Mock data for demo

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const data = await lessonAPI.getAllLessons();
        setLessons(data.lessons || []);
      } catch (error) {
        console.error("Failed to fetch lessons:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchLessons();
    }
  }, [isAuthenticated]);

  if (authLoading || isLoading) {
    return <Loading fullScreen text="جاري التحميل..." />;
  }

  const stats = [
    {
      icon: <BookOpen className="h-6 w-6" />,
      label: "الدروس المكتملة",
      value: "12",
      total: "50",
      progress: 24,
      color: "text-primary-600",
      bg: "bg-gradient-to-br from-primary-50 to-primary-100",
      iconBg: "bg-primary-500",
    },
    {
      icon: <Trophy className="h-6 w-6 text-white" />,
      label: "النقاط المكتسبة",
      value: "1,250",
      trend: "+125",
      color: "text-motivation-600",
      bg: "bg-gradient-to-br from-motivation-50 to-motivation-100",
      iconBg: "bg-motivation-500",
    },
    {
      icon: <Target className="h-6 w-6 text-white" />,
      label: "معدل الدقة",
      value: "85%",
      trend: "+5%",
      color: "text-success-600",
      bg: "bg-gradient-to-br from-success-50 to-success-100",
      iconBg: "bg-success-500",
    },
    {
      icon: <Clock className="h-6 w-6 text-white" />,
      label: "ساعات التعلم",
      value: "24",
      total: "100",
      progress: 24,
      color: "text-purple-600",
      bg: "bg-gradient-to-br from-purple-50 to-purple-100",
      iconBg: "bg-purple-500",
    },
  ];

  const recentAchievements = [
    { name: "البداية القوية", icon: "🚀", date: "اليوم", points: 50 },
    { name: "متعلم نشط", icon: "⚡", date: "أمس", points: 30 },
    { name: "خبير الرياضيات", icon: "🧮", date: "منذ 3 أيام", points: 100 },
    { name: "القارئ السريع", icon: "📚", date: "منذ 5 أيام", points: 75 },
  ];

  const quickActions = [
    {
      icon: <PenTool className="h-5 w-5" />,
      label: "اختبار سريع",
      color: "bg-gradient-to-br from-blue-500 to-blue-600",
      onClick: () => router.push("/quiz/quick")
    },
    {
      icon: <BookMarked className="h-5 w-5" />,
      label: "المفضلة",
      color: "bg-gradient-to-br from-purple-500 to-purple-600",
      onClick: () => router.push("/favorites")
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "لوحة الشرف",
      color: "bg-gradient-to-br from-motivation-500 to-motivation-600",
      onClick: () => router.push("/leaderboard")
    },
    {
      icon: <Lightbulb className="h-5 w-5" />,
      label: "نصائح اليوم",
      color: "bg-gradient-to-br from-success-500 to-success-600",
      onClick: () => router.push("/tips")
    },
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return "text-success-600 bg-success-100";
      case "MEDIUM":
        return "text-motivation-600 bg-motivation-100";
      case "HARD":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return "سهل";
      case "MEDIUM":
        return "متوسط";
      case "HARD":
        return "صعب";
      default:
        return difficulty;
    }
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return <Zap className="h-4 w-4" />;
      case "MEDIUM":
        return <Brain className="h-4 w-4" />;
      case "HARD":
        return <Flame className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 py-8">
      <div className="container-custom">
        {/* Welcome Section with Streak */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 font-amiri mb-2">
                مرحباً {user?.firstName} <span className="text-3xl">👋</span>
              </h1>
              <p className="text-gray-600 text-lg">
                استمر في التقدم! أنت تبلي بلاءً حسناً
              </p>
            </div>

            {/* Streak Counter */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="mt-4 md:mt-0 flex items-center gap-3 bg-gradient-to-r from-motivation-500 to-motivation-600 text-white px-6 py-3 rounded-xl shadow-lg"
            >
              <Flame className="h-8 w-8" />
              <div>
                <p className="text-sm opacity-90">السلسلة اليومية</p>
                <p className="text-2xl font-bold">{streakDays} أيام</p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {quickActions.map((action, index) => (
            <motion.button
              key={index}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={action.onClick}
              className={`${action.color} text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all`}
            >
              <div className="flex flex-col items-center gap-2">
                {action.icon}
                <span className="text-sm font-medium">{action.label}</span>
              </div>
            </motion.button>
          ))}
        </motion.div>

        {/* Stats Grid with Progress Rings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              whileHover={{ y: -5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Card variant="bordered" className="overflow-hidden h-full">
                <div className={`h-2 ${stat.iconBg}`} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-2">{stat.label}</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-3xl font-bold text-gray-900">
                          {stat.value}
                        </p>
                        {stat.total && (
                          <span className="text-sm font-normal text-gray-500">
                            /{stat.total}
                          </span>
                        )}
                      </div>
                      {stat.trend && (
                        <span className="text-xs text-success-600 font-medium flex items-center mt-1">
                          <TrendingUp className="h-3 w-3 ml-1" />
                          {stat.trend}
                        </span>
                      )}
                    </div>
                    <div className={`${stat.iconBg} p-3 rounded-lg shadow-md`}>
                      {stat.icon}
                    </div>
                  </div>

                  {stat.progress && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${stat.progress}%` }}
                          transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                          className={`${stat.iconBg} h-2 rounded-full`}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Lessons with Enhanced Cards */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card variant="elevated" className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-6 w-6" />
                    <h2 className="text-xl font-semibold">
                      الدروس المتاحة
                    </h2>
                  </div>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    عرض الكل
                    <ChevronRight className="mr-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {lessons.slice(0, 5).map((lesson, index) => (
                    <motion.div
                      key={lesson.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className="p-4 hover:bg-gradient-to-r hover:from-primary-50 hover:to-transparent transition-all cursor-pointer group"
                      onClick={() => router.push(`/lesson/${lesson.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors mb-2">
                            {lesson.titleAr || lesson.title}
                          </h3>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <BookOpen className="h-4 w-4 text-gray-400" />
                              {lesson.unit.subject.nameAr || lesson.unit.subject.name}
                            </span>
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <Clock className="h-4 w-4 text-gray-400" />
                              {lesson.duration || 45} دقيقة
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getDifficultyColor(
                                lesson.difficulty
                              )}`}
                            >
                              {getDifficultyIcon(lesson.difficulty)}
                              {getDifficultyLabel(lesson.difficulty)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-[-4px] transition-all" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Achievements & Progress */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-6"
          >
            {/* Daily Goal Progress */}
            <Card variant="elevated" className="overflow-hidden">
              <div className="bg-gradient-to-br from-success-500 to-success-600 p-5 text-white">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">الهدف اليومي</h2>
                  <Activity className="h-6 w-6" />
                </div>

                {/* Circular Progress */}
                <div className="flex justify-center my-6">
                  <div className="relative w-32 h-32">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="12"
                        fill="none"
                      />
                      <motion.circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="white"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 56}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 56 * 0.25 }}
                        transition={{ duration: 1, delay: 0.5 }}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">75%</span>
                      <span className="text-xs opacity-90">مكتمل</span>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm opacity-90 mb-1">3 من 4 دروس</p>
                  <p className="text-xs opacity-75">استمر! درس واحد متبقي</p>
                </div>
              </div>
            </Card>

            {/* Recent Achievements with Points */}
            <Card variant="elevated" className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-motivation-500 to-motivation-600 text-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    آخر الإنجازات
                  </h2>
                  <Medal className="h-6 w-6" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {recentAchievements.map((achievement, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      whileHover={{ x: 5 }}
                      className="p-4 hover:bg-gradient-to-r hover:from-motivation-50 hover:to-transparent transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{achievement.icon}</span>
                          <div>
                            <p className="font-medium text-gray-900">
                              {achievement.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {achievement.date}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-motivation-600">
                          <span className="font-bold">+{achievement.points}</span>
                          <Star className="h-4 w-4 fill-current" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Events */}
            <Card variant="bordered">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary-600" />
                    الأحداث القادمة
                  </h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-2 h-12 bg-blue-500 rounded-full" />
                  <div>
                    <p className="font-medium text-sm">اختبار الرياضيات</p>
                    <p className="text-xs text-gray-600">غداً 2:00 م</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <div className="w-2 h-12 bg-purple-500 rounded-full" />
                  <div>
                    <p className="font-medium text-sm">مسابقة العلوم</p>
                    <p className="text-xs text-gray-600">الأحد 10:00 ص</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}