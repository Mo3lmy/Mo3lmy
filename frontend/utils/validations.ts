import { z } from "zod";

// Common validation schemas
export const emailSchema = z
  .string()
  .email("البريد الإلكتروني غير صحيح")
  .min(1, "البريد الإلكتروني مطلوب");

export const passwordSchema = z
  .string()
  .min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
  .max(50, "كلمة المرور طويلة جداً");

export const nameSchema = z
  .string()
  .min(2, "الاسم يجب أن يكون حرفين على الأقل")
  .max(50, "الاسم طويل جداً");

export const gradeSchema = z
  .number()
  .min(1, "الصف يجب أن يكون بين 1 و 12")
  .max(12, "الصف يجب أن يكون بين 1 و 12")
  .optional();

export const phoneSchema = z
  .string()
  .regex(/^[0-9]{10,15}$/, "رقم الهاتف غير صحيح")
  .optional();

// Form schemas
export const loginFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerFormSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    grade: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمات المرور غير متطابقة",
    path: ["confirmPassword"],
  });

export const profileUpdateSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phoneNumber: phoneSchema,
  bio: z.string().max(500, "النبذة طويلة جداً").optional(),
});

// Type exports
export type LoginFormData = z.infer<typeof loginFormSchema>;
export type RegisterFormData = z.infer<typeof registerFormSchema>;
export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;