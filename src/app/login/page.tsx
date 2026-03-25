"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { User, Loader2, Copy, Check } from "lucide-react";

type View = "main" | "telegram";

export default function LoginPage() {
  const [view, setView] = useState<View>("main");
  const [telegramCode, setTelegramCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      setNextPath(next);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback(
    (code: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/auth/telegram/check?code=${code}`);
          const data = await res.json();

          if (data.expired) {
            if (pollRef.current) clearInterval(pollRef.current);
            setError("Код истёк. Попробуйте снова.");
            setView("main");
            return;
          }

          if (data.verified) {
            if (pollRef.current) clearInterval(pollRef.current);
            window.location.href = nextPath;
          }
        } catch {
          // silent retry
        }
      }, 2000);
    },
    [nextPath]
  );

  async function handleTelegramLogin() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/telegram", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка");
        return;
      }

      setTelegramCode(data.code);
      setView("telegram");
      startPolling(data.code);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuestLogin() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка");
        return;
      }

      window.location.href = nextPath;
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT || "vasilekdemobot";

  function handleCopy() {
    navigator.clipboard.writeText(telegramCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Умный дом</h1>
        <p className="text-sm text-gray-500 mt-1">Вход в панель управления</p>
      </div>

      <div className="w-full max-w-xs">
        {view === "main" && (
          <div className="space-y-3">
            <button
              onClick={handleTelegramLogin}
              disabled={loading}
              className="w-full py-3 bg-[#2AABEE] hover:bg-[#229ED9] text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  Войти через Telegram
                </>
              )}
            </button>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-gray-600">или</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <User className="w-4 h-4" />
              Гостевой вход
            </button>
          </div>
        )}

        {view === "telegram" && (
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-4">
              Отправьте этот код боту{" "}
              <a
                href={`https://t.me/${botName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2AABEE] hover:underline"
              >
                @{botName}
              </a>
            </p>

            <button
              onClick={handleCopy}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-4 px-6 mb-4 flex items-center justify-center gap-3 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <span className="text-3xl font-mono font-bold text-white tracking-[0.3em]">
                {telegramCode}
              </span>
              {copied ? (
                <Check className="w-5 h-5 text-green-400 shrink-0" />
              ) : (
                <Copy className="w-5 h-5 text-gray-500 shrink-0" />
              )}
            </button>

            <p className="text-xs text-gray-600 mb-4">
              {copied ? "Скопировано" : "Нажмите чтобы скопировать"}
            </p>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-5">
              <Loader2 className="w-4 h-4 animate-spin" />
              Ожидание подтверждения...
            </div>

            <button
              onClick={() => {
                if (pollRef.current) clearInterval(pollRef.current);
                setView("main");
                setError("");
              }}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Назад
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
