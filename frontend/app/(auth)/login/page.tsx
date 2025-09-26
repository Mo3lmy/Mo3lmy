'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, Lock, Sparkles, Brain } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      await login(data.email, data.password)
      console.log('Login successful, navigating to dashboard...')
      router.push('/dashboard')
    } catch (error: any) {
      console.error('Login failed:', error)
      const message = error.message || 'حدث خطأ أثناء تسجيل الدخول'
      setError('root', {
        message: message === 'Invalid email or password' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-primary-50 to-secondary-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-primary mb-4"
            >
              <Brain className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold gradient-text mb-2">مرحباً بعودتك!</h1>
            <p className="text-gray-600">سجل دخولك لمتابعة رحلتك التعليمية</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="example@email.com"
                  className={cn(
                    'w-full pl-4 pr-12 py-3 rounded-xl border transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500',
                    errors.email ? 'border-danger' : 'border-gray-200'
                  )}
                  dir="ltr"
                />
              </div>
              {errors.email && (
                <p className="text-danger text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('password')}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={cn(
                    'w-full pl-4 pr-12 py-3 rounded-xl border transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500',
                    errors.password ? 'border-danger' : 'border-gray-200'
                  )}
                />
              </div>
              {errors.password && (
                <p className="text-danger text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span className="text-sm text-gray-600">تذكرني</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-primary-600 hover:underline">
                نسيت كلمة المرور؟
              </Link>
            </div>

            {errors.root && (
              <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">
                {errors.root.message}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full py-3 rounded-xl font-semibold transition-all',
                'bg-gradient-primary text-white',
                'hover:scale-[1.02] active:scale-[0.98]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  تسجيل الدخول
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-gray-600">ليس لديك حساب؟</span>{' '}
            <Link href="/register" className="text-primary-600 font-semibold hover:underline">
              سجل الآن
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Right side - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {/* Math symbols background */}
          <div className="absolute top-10 left-10 text-8xl text-white/20 animate-float">∑</div>
          <div className="absolute top-1/4 right-20 text-6xl text-white/20 animate-float" style={{ animationDelay: '1s' }}>π</div>
          <div className="absolute bottom-20 left-1/4 text-7xl text-white/20 animate-float" style={{ animationDelay: '2s' }}>∫</div>
          <div className="absolute top-1/2 right-1/3 text-9xl text-white/20 animate-float" style={{ animationDelay: '0.5s' }}>√</div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-white z-10 px-8"
        >
          <h2 className="text-4xl font-bold mb-4">تعلم بطريقة ذكية</h2>
          <p className="text-xl opacity-90">
            انضم لآلاف الطلاب الذين يستخدمون الذكاء الاصطناعي
            <br />
            لتحسين تجربة التعلم
          </p>
        </motion.div>
      </div>
    </div>
  )
}