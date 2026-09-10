import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "منصة القائد للتخطيط والتحليل المالي",
  description: "منصة FP&A لإدارة الميزانيات والتوقعات والسيولة والسيناريوهات وتحويل البيانات المالية إلى قرارات واضحة.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
