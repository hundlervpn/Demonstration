"use client";

import Link from "next/link";
import { useState } from "react";

export function Header() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <header>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Умный дом</h1>
          <p className="text-sm text-gray-400">Главная панель управления</p>
        </div>

        <div className="flex gap-2">
          <Link href="/events" className="rounded-full bg-white/10 backdrop-blur-xl border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors">
            Журнал
          </Link>
          <Link href="/settings" className="rounded-full bg-white/10 backdrop-blur-xl border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors">
            Настройки
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-full bg-red-500/15 backdrop-blur-xl border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? "Выход..." : "Выйти"}
          </button>
        </div>
      </div>
    </header>
  );
}
