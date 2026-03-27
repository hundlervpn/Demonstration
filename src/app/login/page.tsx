"use client";
import { useState, useEffect, useCallback } from "react";
import { Send, UserCircle, Loader2, CheckCircle2, Copy, ExternalLink } from "lucide-react";

type AuthStep = "choose" | "telegram-pending" | "success";

export default function LoginPage() {
  const [step, setStep] = useState<AuthStep>("choose");
  const [code, setCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string>("");

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT || "vasilekdemobot";

  // Redirect if already logged in
  useEffect(() => {
    const hasAuth = document.cookie.split(";").some(c => c.trim().startsWith("auth_token="));
    if (hasAuth) window.location.href = "/";
  }, []);

  const handleTelegramAuth = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/auth/generate-code", { method: "POST" });
      const data = await res.json();
      setCode(data.code);
      setStep("telegram-pending");
      setPolling(true);
    } catch {
      setError("Не удалось сгенерировать код. Попробуйте снова.");
    }
  }, []);

  const handleGuestEntry = useCallback(async () => {
    await fetch("/api/auth/guest", { method: "POST" });
    window.location.href = "/";
  }, []);

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  // Poll for verification
  useEffect(() => {
    if (!polling || !code) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/check?code=${code}`);
        const data = await res.json();
        if (data.verified) {
          setPolling(false);
          // Cookie is set server-side by /api/auth/check response
          setStep("success");
          setTimeout(() => { window.location.href = "/"; }, 1500);
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      setPolling(false);
      setError("Время ожидания истекло. Попробуйте снова.");
      setStep("choose");
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [polling, code]);

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Василёчек</h1>
        </div>

        {/* Choose method */}
        {step === "choose" && (
          <div className="space-y-3">
            <button
              onClick={handleTelegramAuth}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[#2AABEE]/10 border border-[#2AABEE]/30 hover:bg-[#2AABEE]/20 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-[#2AABEE]/20 flex items-center justify-center">
                <Send className="w-6 h-6 text-[#2AABEE]" />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-white">Войти через Telegram</div>
                <div className="text-xs text-gray-400">Авторизация через бота</div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={handleGuestEntry}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <UserCircle className="w-6 h-6 text-gray-400" />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-white">Гостевой вход</div>
                <div className="text-xs text-gray-400">Просмотр без управления</div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}
          </div>
        )}

        {/* Telegram pending */}
        {step === "telegram-pending" && (
          <div className="space-y-5">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center space-y-4">
              <div className="text-sm text-gray-400">Отправьте этот код боту</div>

              <div className="flex items-center justify-center gap-3">
                <div className="text-3xl font-mono font-bold tracking-widest text-white bg-black/40 px-6 py-3 rounded-xl border border-white/10">
                  {code}
                </div>
                <button
                  onClick={copyCode}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  title="Скопировать"
                >
                  {copied ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>

              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2AABEE] hover:bg-[#2AABEE]/80 text-white font-medium transition-all"
              >
                <Send className="w-4 h-4" />
                Открыть @{botUsername}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Ожидание подтверждения...</span>
            </div>

            <button
              onClick={() => {
                setPolling(false);
                setStep("choose");
                setCode("");
                setError("");
              }}
              className="w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm text-gray-400"
            >
              Назад
            </button>
          </div>
        )}

        {/* Success */}
        {step === "success" && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div className="text-lg font-medium text-green-400">Авторизация успешна!</div>
            <p className="text-sm text-gray-400">Перенаправление...</p>
          </div>
        )}
      </div>
    </div>
  );
}
