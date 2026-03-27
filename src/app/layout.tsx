import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthGuard } from "@/components/AuthGuard";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Умный дом",
  description: "Панель управления умным домом",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${inter.variable} font-sans antialiased bg-[#0a0a0a] text-white min-h-screen flex justify-center relative overflow-x-hidden`}
      >
        {/* Анимированные фоновые градиенты (оптимизировано: без blur на анимированных элементах) */}
        <div className="fixed top-[-20%] left-[-10%] w-[120vw] md:w-[50vw] h-[140%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/20 via-purple-600/5 to-transparent -z-20 animate-wave-left pointer-events-none" />
        <div className="fixed top-[-20%] right-[-10%] w-[120vw] md:w-[50vw] h-[140%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-600/20 via-cyan-600/5 to-transparent -z-20 animate-wave-right pointer-events-none" />
        
        <div className="w-full max-w-md md:max-w-4xl lg:max-w-6xl min-h-screen bg-black/60 md:border-x border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative transition-all duration-300 z-0">
          <AuthGuard>{children}</AuthGuard>
        </div>
      </body>
    </html>
  );
}