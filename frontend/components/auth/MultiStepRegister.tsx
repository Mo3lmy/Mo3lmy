"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  GraduationCap,
  User,
  Mail,
  Phone,
  Calendar,
  School,
  MapPin,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Users,
  BookOpen,
  Award,
  CheckCircle,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { motion, AnimatePresence } from "framer-motion";
import { RegisterFormData } from "@/types/auth";

const egyptianGovernorates = [
  "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية",
  "القليوبية", "كفر الشيخ", "الغربية", "المنوفية", "البحيرة",
  "الإسماعيلية", "السويس", "بورسعيد", "شمال سيناء", "جنوب سيناء",
  "بني سويف", "الفيوم", "المنيا", "أسيوط", "سوهاج",
  "قنا", "أسوان", "الأقصر", "البحر الأحمر", "الوادي الجديد", "مطروح"
];

const registerSchema = z.object({
  // Basic info
  firstName: z.string().min(2, "الاسم الأول يجب أن يكون حرفين على الأقل"),
  lastName: z.string().min(2, "الاسم الأخير يجب أن يكون حرفين على الأقل"),
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  phone: z.string().min(10, "رقم الهاتف غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  confirmPassword: z.string(),

  // Account type
  accountType: z.enum(["STUDENT", "PARENT"]),

  // Student fields
  birthDate: z.date().optional(),
  educationLevel: z.enum(["PRIMARY", "MIDDLE", "HIGH"]).optional(),
  grade: z.number().min(1).max(12).optional(),
  school: z.string().optional(),
  governorate: z.string().optional(),
  educationDistrict: z.string().optional(),
  parentEmail: z.string().email("البريد الإلكتروني غير صحيح").optional().or(z.literal("")),

  // Parent fields
  occupation: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

interface MultiStepRegisterProps {
  onSubmit: (data: RegisterFormData) => Promise<void>;
  error?: string;
}

export default function MultiStepRegister({ onSubmit, error }: MultiStepRegisterProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      accountType: "STUDENT",
    },
  });

  const accountType = watch("accountType");
  const educationLevel = watch("educationLevel");
  const grade = watch("grade");

  const getGradeOptions = (level: string) => {
    switch (level) {
      case "PRIMARY":
        return [1, 2, 3, 4, 5, 6];
      case "MIDDLE":
        return [1, 2, 3];
      case "HIGH":
        return [1, 2, 3];
      default:
        return [];
    }
  };

  const requiresParent = (level?: string, grade?: number) => {
    if (!level || !grade) return false;
    return level === "PRIMARY" || (level === "MIDDLE" && grade <= 3);
  };

  const totalSteps = accountType === "STUDENT" ? 3 : 2;

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const stepVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  return (
    <Card className="w-full max-w-2xl mx-auto" variant="elevated" padding="lg">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {[...Array(totalSteps)].map((_, index) => (
            <div key={index} className="flex-1 flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                  currentStep > index + 1
                    ? "bg-success-500 text-white"
                    : currentStep === index + 1
                    ? "bg-primary-500 text-white shadow-lg scale-110"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {currentStep > index + 1 ? (
                  <CheckCircle className="h-6 w-6" />
                ) : (
                  index + 1
                )}
              </div>
              {index < totalSteps - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded transition-all duration-500 ${
                    currentStep > index + 1 ? "bg-success-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-between text-sm">
          <span className={currentStep === 1 ? "text-primary-600 font-semibold" : "text-gray-500"}>
            معلومات أساسية
          </span>
          {accountType === "STUDENT" && (
            <span className={currentStep === 2 ? "text-primary-600 font-semibold" : "text-gray-500"}>
              بيانات تعليمية
            </span>
          )}
          <span className={currentStep === totalSteps ? "text-primary-600 font-semibold" : "text-gray-500"}>
            تأكيد المعلومات
          </span>
        </div>
      </div>

      {/* Form Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full shadow-lg">
            <GraduationCap className="h-10 w-10 text-primary-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 font-amiri mb-2">
          إنشاء حساب جديد
        </h1>
        <p className="text-gray-600">
          انضم إلى رحلة التعلم الممتعة
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6"
        >
          {error}
        </motion.div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <AnimatePresence mode="wait">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* Account Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  نوع الحساب
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="relative cursor-pointer">
                    <input
                      type="radio"
                      value="STUDENT"
                      {...register("accountType")}
                      className="sr-only peer"
                    />
                    <div className="p-4 border-2 rounded-xl transition-all peer-checked:border-primary-500 peer-checked:bg-primary-50 hover:border-primary-300 hover:shadow-md">
                      <div className="flex items-center justify-center mb-2">
                        <BookOpen className="h-8 w-8 text-primary-600" />
                      </div>
                      <p className="text-center font-semibold text-gray-900">طالب</p>
                      <p className="text-center text-xs text-gray-600 mt-1">
                        للطلاب من كل المراحل
                      </p>
                    </div>
                  </label>

                  <label className="relative cursor-pointer">
                    <input
                      type="radio"
                      value="PARENT"
                      {...register("accountType")}
                      className="sr-only peer"
                    />
                    <div className="p-4 border-2 rounded-xl transition-all peer-checked:border-primary-500 peer-checked:bg-primary-50 hover:border-primary-300 hover:shadow-md">
                      <div className="flex items-center justify-center mb-2">
                        <Users className="h-8 w-8 text-primary-600" />
                      </div>
                      <p className="text-center font-semibold text-gray-900">ولي أمر</p>
                      <p className="text-center text-xs text-gray-600 mt-1">
                        لمتابعة تقدم أبنائك
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="الاسم الأول"
                  placeholder="محمد"
                  error={errors.firstName?.message}
                  icon={<User className="h-5 w-5 text-gray-400" />}
                  {...register("firstName")}
                />
                <Input
                  label="الاسم الأخير"
                  placeholder="أحمد"
                  error={errors.lastName?.message}
                  icon={<User className="h-5 w-5 text-gray-400" />}
                  {...register("lastName")}
                />
              </div>

              <Input
                label="البريد الإلكتروني"
                type="email"
                placeholder="example@email.com"
                error={errors.email?.message}
                icon={<Mail className="h-5 w-5 text-gray-400" />}
                {...register("email")}
              />

              <Input
                label="رقم الهاتف"
                type="tel"
                placeholder="01234567890"
                error={errors.phone?.message}
                icon={<Phone className="h-5 w-5 text-gray-400" />}
                {...register("phone")}
              />

              {accountType === "PARENT" && (
                <Input
                  label="المهنة (اختياري)"
                  placeholder="مهندس، طبيب، معلم..."
                  error={errors.occupation?.message}
                  {...register("occupation")}
                />
              )}

              <Input
                label="كلمة المرور"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                error={errors.password?.message}
                icon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                }
                {...register("password")}
              />

              <Input
                label="تأكيد كلمة المرور"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                error={errors.confirmPassword?.message}
                icon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="focus:outline-none"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                }
                {...register("confirmPassword")}
              />
            </motion.div>
          )}

          {/* Step 2: Educational Info (Students Only) */}
          {currentStep === 2 && accountType === "STUDENT" && (
            <motion.div
              key="step2"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* Birth Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  تاريخ الميلاد
                </label>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    {...register("birthDate", { valueAsDate: true })}
                  />
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                {errors.birthDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.birthDate.message}</p>
                )}
              </div>

              {/* Education Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  المرحلة الدراسية
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  {...register("educationLevel")}
                >
                  <option value="">اختر المرحلة</option>
                  <option value="PRIMARY">ابتدائي</option>
                  <option value="MIDDLE">إعدادي</option>
                  <option value="HIGH">ثانوي</option>
                </select>
                {errors.educationLevel && (
                  <p className="mt-1 text-sm text-red-600">{errors.educationLevel.message}</p>
                )}
              </div>

              {/* Grade */}
              {educationLevel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3 }}
                >
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الصف الدراسي
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    {...register("grade", { valueAsNumber: true })}
                  >
                    <option value="">اختر الصف</option>
                    {getGradeOptions(educationLevel).map((g) => (
                      <option key={g} value={g}>
                        الصف {g}
                      </option>
                    ))}
                  </select>
                  {errors.grade && (
                    <p className="mt-1 text-sm text-red-600">{errors.grade.message}</p>
                  )}
                </motion.div>
              )}

              {/* School */}
              <Input
                label="اسم المدرسة"
                placeholder="مدرسة النور الخاصة"
                error={errors.school?.message}
                icon={<School className="h-5 w-5 text-gray-400" />}
                {...register("school")}
              />

              {/* Location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    المحافظة
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    {...register("governorate")}
                  >
                    <option value="">اختر المحافظة</option>
                    {egyptianGovernorates.map((gov) => (
                      <option key={gov} value={gov}>
                        {gov}
                      </option>
                    ))}
                  </select>
                  {errors.governorate && (
                    <p className="mt-1 text-sm text-red-600">{errors.governorate.message}</p>
                  )}
                </div>

                <Input
                  label="الإدارة التعليمية"
                  placeholder="إدارة شرق"
                  error={errors.educationDistrict?.message}
                  icon={<MapPin className="h-5 w-5 text-gray-400" />}
                  {...register("educationDistrict")}
                />
              </div>

              {/* Parent Email (if required) */}
              {requiresParent(educationLevel, grade) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3 }}
                  className="p-4 bg-amber-50 border border-amber-200 rounded-lg"
                >
                  <p className="text-sm text-amber-800 mb-3">
                    يجب إضافة بريد ولي الأمر للطلاب في هذه المرحلة
                  </p>
                  <Input
                    label="بريد ولي الأمر الإلكتروني"
                    type="email"
                    placeholder="parent@email.com"
                    error={errors.parentEmail?.message}
                    icon={<Mail className="h-5 w-5 text-gray-400" />}
                    {...register("parentEmail")}
                  />
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 3: Review & Confirm */}
          {currentStep === totalSteps && (
            <motion.div
              key="step3"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Award className="h-6 w-6 text-primary-600 ml-2" />
                  مراجعة البيانات
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-primary-200">
                    <span className="text-gray-600">نوع الحساب:</span>
                    <span className="font-semibold text-gray-900">
                      {accountType === "STUDENT" ? "طالب" : "ولي أمر"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-primary-200">
                    <span className="text-gray-600">الاسم:</span>
                    <span className="font-semibold text-gray-900">
                      {watch("firstName")} {watch("lastName")}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-primary-200">
                    <span className="text-gray-600">البريد الإلكتروني:</span>
                    <span className="font-semibold text-gray-900">{watch("email")}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-primary-200">
                    <span className="text-gray-600">رقم الهاتف:</span>
                    <span className="font-semibold text-gray-900">{watch("phone")}</span>
                  </div>

                  {accountType === "STUDENT" && educationLevel && (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-primary-200">
                        <span className="text-gray-600">المرحلة:</span>
                        <span className="font-semibold text-gray-900">
                          {educationLevel === "PRIMARY" && "ابتدائي"}
                          {educationLevel === "MIDDLE" && "إعدادي"}
                          {educationLevel === "HIGH" && "ثانوي"}
                        </span>
                      </div>

                      {grade && (
                        <div className="flex justify-between items-center py-2 border-b border-primary-200">
                          <span className="text-gray-600">الصف:</span>
                          <span className="font-semibold text-gray-900">الصف {grade}</span>
                        </div>
                      )}

                      {watch("school") && (
                        <div className="flex justify-between items-center py-2 border-b border-primary-200">
                          <span className="text-gray-600">المدرسة:</span>
                          <span className="font-semibold text-gray-900">{watch("school")}</span>
                        </div>
                      )}
                    </>
                  )}

                  {accountType === "PARENT" && watch("occupation") && (
                    <div className="flex justify-between items-center py-2 border-b border-primary-200">
                      <span className="text-gray-600">المهنة:</span>
                      <span className="font-semibold text-gray-900">{watch("occupation")}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
                <p className="text-sm text-success-800">
                  بإنشاء الحساب، أنت توافق على شروط الاستخدام وسياسة الخصوصية
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className={currentStep === 1 ? "invisible" : ""}
          >
            <ChevronRight className="ml-2 h-4 w-4" />
            السابق
          </Button>

          {currentStep < totalSteps ? (
            <Button type="button" variant="primary" onClick={nextStep}>
              التالي
              <ChevronLeft className="mr-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" variant="primary" loading={isSubmitting}>
              <UserPlus className="ml-2 h-4 w-4" />
              إنشاء الحساب
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}