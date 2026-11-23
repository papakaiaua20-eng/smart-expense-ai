import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { themeInitScript } from "@/components/app/theme";

export const metadata: Metadata = {
  title: { default: "Smart Expense AI · จดรายจ่ายง่าย ๆ แค่สแกนสลิป", template: "%s · Smart Expense AI" },
  description: "เว็บจัดการรายรับ–รายจ่าย อ่านสลิปโอนเงินอัตโนมัติ สรุปรายงานและงบประมาณ",
  applicationName: "Smart Expense AI",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2563EB" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Prompt:wght@500;600&display=swap"
        />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton theme="system" />
      </body>
    </html>
  );
}
