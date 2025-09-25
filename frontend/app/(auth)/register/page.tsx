'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, Lock, User, GraduationCap, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

const registerSchema = z.object({
  firstName: z.string().min(2, 'الاسم الأول يجب أن يكون حرفين على الأقل'),
  lastName: z.string().min(2, 'اسم العائلة يجب أن يكون حرفين على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
  grade: z.string().min(1, 'اختر الصف الدراسي'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
})

type RegisterFormData = z.infer<typeof registerSchema>

const grades = [
  { value: '1', label: 'الصف الأول' },
  { value: '2', label: 'الصف الثاني' },
  { value: '3', label: 'الصف الثالث' },
  { value: '4', label: 'الصف الرابع' },
  { value: '5', label: 'الصف الخامس' },
  { value: '6', label: 'الصف السادس' },
  { value: '7', label: 'الصف السابع' },
  { value: '8', label: 'الصف الثامن' },
  { value: '9', label: 'الصف التاسع' },
  { value: '10', label: 'الصف العاشر' },
  { value: '11', label: 'الصف الحادي عشر' },
  { value: '12', label: 'الصف الثاني عشر' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(1)
  const { register: registerUser } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    try {
      await registerUser({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        grade: parseInt(data.grade),
      })
      router.push('/dashboard')
    } catch (error: any) {
      const message = error.message || 'حدث خطأ أثناء إنشاء الحساب'
      if (message.includes('already exists') || message.includes('Conflict')) {
        setError('email', {
          message: 'هذا البريد الإلكتروني مسجل بالفعل',
        })
      } else {
        setError('root', { message })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const nextStep = () => {
    const firstName = watch('firstName')
    const lastName = watch('lastName')
    const grade = watch('grade')

    if (firstName && lastName && grade) {
      setStep(2)
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
              <GraduationCap className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold gradient-text mb-2">إنشاء حساب جديد</h1>
            <p className="text-gray-600">ابدأ رحلتك التعليمية معنا</p>
          </div>

          {/* Progress bar */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className={cn(
              'h-2 w-20 rounded-full transition-colors',
              step >= 1 ? 'bg-primary-500' : 'bg-gray-200'
            )} />
            <div className={cn(
              'h-2 w-20 rounded-full transition-colors',
              step >= 2 ? 'bg-primary-500' : 'bg-gray-200'
            )} />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {step === 1 ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الاسم الأول
                    </label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        {...register('firstName')}
                        type="text"
                        placeholder="أحمد"
                        className={cn(
                          'w-full pl-4 pr-12 py-3 rounded-xl border transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-primary-500',
                          errors.firstName ? 'border-danger' : 'border-gray-200'
                        )}
                      />
                    </div>
                    {errors.firstName && (
                      <p className="text-danger text-sm mt-1">{errors.firstName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      اسم العائلة
                    </label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        {...register('lastName')}
                        type="text"
                        placeholder="محمد"
                        className={cn(
                          'w-full pl-4 pr-12 py-3 rounded-xl border transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-primary-500',
                          errors.lastName ? 'border-danger' : 'border-gray-200'
                        )}
                      />
                    </div>
                    {errors.lastName && (
                      <p className="text-danger text-sm mt-1">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الصف الدراسي
                  </label>
                  <select
                    {...register('grade')}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500',
                      errors.grade ? 'border-danger' : 'border-gray-200'
                    )}
                  >
                    <option value="">اختر الصف</option>
                    {grades.map((grade) => (
                      <option key={grade.value} value={grade.value}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                  {errors.grade && (
                    <p className="text-danger text-sm mt-1">{errors.grade.message}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={nextStep}
                  className={cn(
                    'w-full py-3 rounded-xl font-semibold transition-all',
                    'bg-gradient-primary text-white',
                    'hover:scale-[1.02] active:scale-[0.98]'
                  )}
                >
                  التالي
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
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
                      autoComplete="new-password"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تأكيد كلمة المرور
                  </label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      {...register('confirmPassword')}
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className={cn(
                        'w-full pl-4 pr-12 py-3 rounded-xl border transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500',
                        errors.confirmPassword ? 'border-danger' : 'border-gray-200'
                      )}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-danger text-sm mt-1">{errors.confirmPassword.message}</p>
                  )}
                </div>

                {errors.root && (
                  <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">
                    {errors.root.message}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={cn(
                      'flex-1 py-3 rounded-xl font-semibold transition-all',
                      'border border-gray-300 text-gray-700',
                      'hover:bg-gray-50'
                    )}
                  >
                    رجوع
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={cn(
                      'flex-1 py-3 rounded-xl font-semibold transition-all',
                      'bg-gradient-primary text-white',
                      'hover:scale-[1.02] active:scale-[0.98]',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-center justify-center gap-2'
                    )}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        جاري إنشاء الحساب...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        إنشاء حساب
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </form>

          <div className="mt-6 text-center">
            <span className="text-gray-600">لديك حساب بالفعل؟</span>{' '}
            <Link href="/login" className="text-primary-600 font-semibold hover:underline">
              سجل دخولك
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Right side - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-secondary-500 to-primary-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {/* Math symbols background */}
          <div className="absolute top-10 left-10 text-8xl text-white/20 animate-float">∞</div>
          <div className="absolute top-1/4 right-20 text-6xl text-white/20 animate-float" style={{ animationDelay: '1s' }}>Δ</div>
          <div className="absolute bottom-20 left-1/4 text-7xl text-white/20 animate-float" style={{ animationDelay: '2s' }}>θ</div>
          <div className="absolute top-1/2 right-1/3 text-9xl text-white/20 animate-float" style={{ animationDelay: '0.5s' }}>λ</div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-white z-10 px-8"
        >
          <h2 className="text-4xl font-bold mb-4">مستقبل التعليم</h2>
          <p className="text-xl opacity-90">
            تعلم بطريقة تفاعلية مع الذكاء الاصطناعي
            <br />
            واحصل على تجربة تعليمية مخصصة لك
          </p>
        </motion.div>
      </div>
    </div>
  )
}