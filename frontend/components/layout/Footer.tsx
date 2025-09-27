"use client";

import React from "react";
import Link from "next/link";
import { GraduationCap, Heart } from "lucide-react";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: "المزايا", href: "/features" },
      { name: "الأسعار", href: "/pricing" },
      { name: "الدروس", href: "/lessons" },
    ],
    company: [
      { name: "من نحن", href: "/about" },
      { name: "تواصل معنا", href: "/contact" },
      { name: "الوظائف", href: "/careers" },
    ],
    legal: [
      { name: "الخصوصية", href: "/privacy" },
      { name: "الشروط", href: "/terms" },
      { name: "الأمان", href: "/security" },
    ],
  };

  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="container-custom py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="h-8 w-8 text-primary-500" />
              <span className="text-xl font-bold text-gray-900 font-amiri">
                مُعلمي
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              نساعد الطلاب على التعلم بطريقة ذكية وممتعة مع أحدث تقنيات الذكاء الاصطناعي
            </p>
          </div>

          {/* Links */}
          <div className="col-span-3 grid grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">المنتج</h3>
              <ul className="space-y-2">
                {footerLinks.product.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">الشركة</h3>
              <ul className="space-y-2">
                {footerLinks.company.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">قانوني</h3>
              <ul className="space-y-2">
                {footerLinks.legal.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              © {currentYear} مُعلمي. جميع الحقوق محفوظة.
            </p>
            <p className="flex items-center gap-1 text-sm text-gray-600">
              صُنع بـ <Heart className="h-4 w-4 text-red-500 fill-current" /> في مصر
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;