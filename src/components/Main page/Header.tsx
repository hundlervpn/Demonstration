import Link from "next/link";

export function Header() {
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
        </div>
      </div>
    </header>
  );
}
