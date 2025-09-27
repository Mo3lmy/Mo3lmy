"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  Trophy,
  Sparkles,
  ChevronLeft,
  Brain,
  Users,
  Target
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function HomePage() {
  const features = [
    {
      icon: <Brain className="h-8 w-8" />,
      title: "ذكاء اصطناعي متقدم",
      description: "مساعد تعليمي ذكي يتكيف مع أسلوب تعلمك ويقدم شرح مخصص",
      color: "text-primary-500",
      bg: "bg-primary-50",
    },
    {
      icon: <Sparkles className="h-8 w-8" />,
      title: "تجربة تفاعلية",
      description: "دروس تفاعلية مع شرائح متحركة وتمارين ذكية",
      color: "text-motivation-500",
      bg: "bg-motivation-50",
    },
    {
      icon: <Trophy className="h-8 w-8" />,
      title: "نظام مكافآت",
      description: "اكسب نقاط وإنجازات مع كل تقدم تحرزه",
      color: "text-success-500",
      bg: "bg-success-50",
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "دعم عاطفي",
      description: "نظام ذكي يراقب حالتك النفسية ويقدم الدعم المناسب",
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
  ];

  const stats = [
    { label: "طالب نشط", value: "10,000+", icon: <Users className="h-5 w-5" /> },
    { label: "درس تفاعلي", value: "500+", icon: <BookOpen className="h-5 w-5" /> },
    { label: "معدل الرضا", value: "4.9/5", icon: <Trophy className="h-5 w-5" /> },
    { label: "ساعة تعلم", value: "50,000+", icon: <Target className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-50 via-white to-primary-50 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container-custom py-20 md:py-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 font-amiri mb-6">
                تعلم بذكاء،
                <span className="text-primary-600"> انجح بثقة</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                منصة تعليمية مدعومة بالذكاء الاصطناعي تفهم احتياجاتك وتساعدك على التفوق الدراسي بطريقة ممتعة وفعالة
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth/register">
                  <Button size="lg" variant="primary" className="w-full sm:w-auto">
                    ابدأ رحلتك المجانية
                    <ChevronLeft className="mr-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    تسجيل الدخول
                  </Button>
                </Link>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-600 rounded-3xl transform rotate-3 scale-105 opacity-20"></div>
                <div className="relative bg-white p-8 rounded-3xl shadow-xl">
                  <div className="flex items-center justify-center">
                    <div className="p-6 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full">
                      <GraduationCap className="h-32 w-32 text-white" />
                    </div>
                  </div>
                  <div className="mt-6 text-center">
                    <p className="text-2xl font-bold text-gray-900">منصة التعليم الذكية</p>
                    <p className="text-gray-600 mt-2">رفيقك في رحلة التعلم</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="flex justify-center mb-2 text-primary-500">
                  {stat.icon}
                </div>
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container-custom">
          <div className="text-center mb-12">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-bold text-gray-900 font-amiri mb-4"
            >
              مزايا تجعل التعلم أسهل
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xl text-gray-600"
            >
              كل ما تحتاجه للتفوق الدراسي في مكان واحد
            </motion.p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card variant="elevated" className="h-full hover:shadow-xl transition-shadow">
                  <div className={`p-4 rounded-xl ${feature.bg} w-fit mb-4`}>
                    <div className={feature.color}>{feature.icon}</div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-500 to-primary-600">
        <div className="container-custom text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-white font-amiri mb-6"
          >
            جاهز لبدء رحلة التعلم؟
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xl text-white/90 mb-8"
          >
            انضم لآلاف الطلاب الذين يحققون أحلامهم معنا
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link href="/auth/register">
              <Button size="lg" className="bg-white text-primary-600 hover:bg-gray-100">
                ابدأ الآن مجاناً
                <ChevronLeft className="mr-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}