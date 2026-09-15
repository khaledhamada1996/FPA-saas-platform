import type { Metadata } from "next";
import "./globals.css";
import { LatinDigits } from "@/components/latin-digits";

export const metadata: Metadata = {
  title: "FP&A Platform",
  description: "Financial Planning & Analysis platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <LatinDigits />
        {children}
      </body>
    </html>
  );
}
