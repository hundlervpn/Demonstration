import Link from "next/link";

export function EventsCard() {
  return (
    <Link href="/events" className="block h-full">
      <section className="h-full flex flex-col rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl hover:scale-[1.02]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Последние события</h3>
          <span className="text-sm text-[#ffb300] font-medium flex items-center gap-1">Все события <span className="text-lg">›</span></span>
        </div>

        <div className="flex-1 flex flex-col justify-between space-y-3">
          {/* Event Item 1 */}
          <div className="flex items-center gap-3 rounded-xl bg-black/40 border border-white/5 p-3">
            <div className="text-xs text-gray-500">18:32</div>
            <div className="flex-1">
              <div className="text-sm font-medium">Движение в прихожей</div>
              <div className="text-xs text-gray-500">Прихожая</div>
            </div>
            <button className="rounded-full bg-blue-500/20 px-3 py-1 text-xs text-blue-400">
              Инфо
            </button>
          </div>

          {/* Event Item 2 */}
          <div className="flex items-center gap-3 rounded-xl bg-black/40 border border-white/5 p-3">
            <div className="text-xs text-gray-500">17:15</div>
            <div className="flex-1">
              <div className="text-sm font-medium">Температура в норме</div>
              <div className="text-xs text-gray-500">Кабинет</div>
            </div>
            <button className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-400">
              Инфо
            </button>
          </div>

          {/* Event Item 3 */}
          <div className="flex items-center gap-3 rounded-xl bg-black/40 border border-white/5 p-3">
            <div className="text-xs text-gray-500">16:48</div>
            <div className="flex-1">
              <div className="text-sm font-medium">Свет включен</div>
              <div className="text-xs text-gray-500">Кухня</div>
            </div>
            <button className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-400">
              Инфо
            </button>
          </div>
        </div>
      </section>
    </Link>
  );
}
