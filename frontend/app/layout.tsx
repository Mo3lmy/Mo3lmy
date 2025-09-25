import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "Smart Education Platform",
  description: "AI-powered learning platform with emotional intelligence",
  keywords: "education, learning, AI, emotional intelligence, adaptive learning",
  authors: [{ name: "Smart Education Team" }],
  openGraph: {
    title: "Smart Education Platform",
    description: "Learn with AI and emotional intelligence",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth">
      <body
        className={`${inter.variable} ${cairo.variable} antialiased bg-gradient-to-br from-primary-50 via-white to-secondary-50`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
