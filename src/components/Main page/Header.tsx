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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 shrink">
          <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">Умный дом</h1>
          <p className="text-sm text-gray-400 mt-0.5">Панель управления</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link href="/events" className="rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 transition-colors">
            Журнал
          </Link>
          <Link href="/settings" className="rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 transition-colors">
            Настройки
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? "..." : "Выйти"}
          </button>
        </div>
      </div>
    </header>
  );
}
