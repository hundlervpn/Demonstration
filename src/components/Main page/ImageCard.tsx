export function ImageCard() {
  return (
    <section className="relative overflow-hidden rounded-3xl">
      <div className="h-44 md:h-72 bg-gradient-to-br from-zinc-700 to-zinc-900" />
      <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/70 to-transparent p-4 md:p-6">
        <h2 className="text-xl md:text-3xl font-semibold">Улица</h2>
        <p className="text-sm md:text-base text-gray-300">
          Последнее распознавание: Администратор
        </p>
      </div>
    </section>
  );
}
