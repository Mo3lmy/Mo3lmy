"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MultiStepRegister from "@/components/auth/MultiStepRegister";
import useAuthStore from "@/stores/useAuthStore";
import { RegisterFormData } from "@/types/auth";

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const [error, setError] = useState("");

  const handleRegister = async (data: RegisterFormData) => {
    setError("");
    try {
      await register({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        accountType: data.accountType,

        // Student specific fields
        birthDate: data.birthDate,
        educationLevel: data.educationLevel,
        grade: data.grade,
        school: data.school,
        governorate: data.governorate,
        educationDistrict: data.educationDistrict,
        parentEmail: data.parentEmail,

        // Parent specific fields
        occupation: data.occupation,
      });
      router.push("/dashboard");
    } catch (err) {
      const error = err as Error;
      setError(error.message || "حدث خطأ في إنشاء الحساب");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-success-50 px-4 py-8">
      <div className="w-full max-w-2xl">
        <MultiStepRegister onSubmit={handleRegister} error={error} />

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            لديك حساب بالفعل؟{" "}
            <Link
              href="/auth/login"
              className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
            >
              سجل دخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}