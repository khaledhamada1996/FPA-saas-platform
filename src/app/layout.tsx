import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FP&A Platform",
  description: "Financial Planning & Analysis platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
