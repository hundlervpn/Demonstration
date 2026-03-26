import Link from "next/link";

export function EventLogPreview() {
  const events = [
    {
      time: "17:24",
      message: "Активирован режим «Фокус»",
      room: "Кабинет",
      type: "info",
    },
    {
      time: "16:15",
      message: "Распознан пользователь: Администратор",
      room: "Камера на улице",
      type: "info",
    },
    {
      time: "15:32",
      message: "Датчик движения активирован",
      room: "Прихожая",
      type: "warning",
    },
  ];

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "alert":
        return "bg-red-500/20 text-red-400";
      case "warning":
        return "bg-yellow-500/20 text-yellow-400";
      default:
        return "bg-purple-500/20 text-purple-400";
    }
  };

  const getBadgeText = (type: string) => {
    switch (type) {
      case "alert":
        return "Тревога";
      case "warning":
        return "Предупреждение";
      default:
        return "Инфо";
    }
  };

  return (
    <section className="flex flex-col rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Последние события</h3>
        <Link
          href="/events"
          className="text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
        >
          Все события
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="space-y-3">
        {events.map((event, index) => (
          <div key={index} className="flex items-start gap-3 p-3 bg-black/40 border border-white/5 rounded-xl">
            <div className="text-xs text-gray-500 w-16 flex-shrink-0">{event.time}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white mb-1 truncate">{event.message}</div>
              <div className="text-xs text-gray-500">{event.room}</div>
            </div>
            <div className={`px-2 py-1 ${getBadgeColor(event.type)} text-xs rounded-lg flex-shrink-0`}>
              {getBadgeText(event.type)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
