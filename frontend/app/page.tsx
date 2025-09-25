'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Brain, Sparkles, Target, Users, Award, BookOpen, Rocket } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const mathSymbols = ['∑', '∫', '√', 'π', '∞', 'Δ', 'θ', 'λ', '∂', 'φ']

const features = [
  {
    icon: Brain,
    title: 'الذكاء العاطفي',
    description: 'نظام يفهم مشاعرك ويتكيف مع حالتك النفسية',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Target,
    title: 'التعلم التكيفي',
    description: 'محتوى يتغير حسب مستواك وسرعة تعلمك',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Award,
    title: 'نظام المكافآت',
    description: 'احصل على نقاط وإنجازات مع كل تقدم',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Users,
    title: 'تواصل الوالدين',
    description: 'تقارير مفصلة عن تقدم الطالب للأهل',
    color: 'from-orange-500 to-red-500',
  },
]

const stats = [
  { label: 'طالب نشط', value: 10000, suffix: '+' },
  { label: 'درس متاح', value: 500, suffix: '' },
  { label: 'معدل النجاح', value: 95, suffix: '%' },
  { label: 'إنجاز محقق', value: 5000, suffix: '+' },
]

function FloatingSymbol({ symbol, index }: { symbol: string; index: number }) {
  return (
    <motion.div
      className="absolute text-4xl font-bold text-primary-200/20 pointer-events-none"
      initial={{
        x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
        y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
      }}
      animate={{
        x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
        y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
        rotate: 360,
      }}
      transition={{
        duration: 20 + index * 2,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'linear',
      }}
    >
      {symbol}
    </motion.div>
  )
}

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev < value) {
          return Math.min(prev + Math.ceil(value / 50), value)
        }
        return prev
      })
    }, 50)

    return () => clearInterval(timer)
  }, [value])

  return (
    <span>
      {count.toLocaleString('ar-SA')}
      {suffix}
    </span>
  )
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary-100 via-secondary-100 to-primary-50 animate-ken-burns" />

      {/* Floating math symbols */}
      {mounted && (
        <div className="fixed inset-0 overflow-hidden">
          {mathSymbols.map((symbol, i) => (
            <FloatingSymbol key={i} symbol={symbol} index={i} />
          ))}
        </div>
      )}

      {/* Glassmorphism navigation */}
      <nav className="relative z-10 glass sticky top-0">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <Rocket className="w-8 h-8 text-primary-500" />
              <span className="text-2xl font-bold gradient-text">Smart Education</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-4"
            >
              <Link
                href="/login"
                className="px-6 py-2 rounded-lg glass hover:bg-white/20 transition-all"
              >
                تسجيل الدخول
              </Link>
              <Link
                href="/register"
                className="px-6 py-2 rounded-lg bg-gradient-primary text-white btn-hover"
              >
                إنشاء حساب
              </Link>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="gradient-text">تعلم بذكاء</span>
            <br />
            <span className="text-gray-800">مع الذكاء الاصطناعي</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8">
            منصة تعليمية متطورة تفهم مشاعرك وتتكيف مع احتياجاتك
          </p>

          <div className="flex gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-4 rounded-xl bg-gradient-primary text-white text-lg font-semibold btn-hover flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              ابدأ رحلتك التعليمية
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 rounded-xl glass border border-primary-200 text-primary-600 text-lg font-semibold btn-hover"
            >
              اكتشف المزايا
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 container mx-auto px-6 py-20">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-4xl font-bold text-center mb-12 gradient-text"
        >
          مزايا المنصة
        </motion.h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl p-6 card-hover group"
            >
              <div
                className={cn(
                  'w-16 h-16 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4',
                  feature.color
                )}
              >
                <feature.icon className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-xl font-bold mb-2 group-hover:text-primary-600 transition-colors">
                {feature.title}
              </h3>

              <p className="text-gray-600">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 container mx-auto px-6 py-20">
        <div className="glass rounded-3xl p-12">
          <div className="grid md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl font-bold gradient-text mb-2">
                  {mounted && <AnimatedCounter value={stat.value} suffix={stat.suffix} />}
                </div>
                <div className="text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="relative z-10 container mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold mb-8">موثوق من قبل</h2>

          <div className="flex flex-wrap justify-center gap-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-32 h-32 rounded-xl glass flex items-center justify-center"
              >
                <BookOpen className="w-12 h-12 text-primary-400" />
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 container mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-3xl p-12 text-center"
        >
          <h2 className="text-4xl font-bold mb-4 gradient-text">
            جاهز لتحويل رحلتك التعليمية؟
          </h2>

          <p className="text-xl text-gray-600 mb-8">
            انضم لآلاف الطلاب الذين يتعلمون بطريقة أذكى وأكثر متعة
          </p>

          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-primary text-white text-lg font-semibold btn-hover"
          >
            ابدأ مجاناً
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 glass mt-20">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center text-gray-600">
            <p>© 2024 Smart Education Platform. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
