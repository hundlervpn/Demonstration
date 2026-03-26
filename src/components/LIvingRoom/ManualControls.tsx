import { RippleContainer } from "@/components/RippleContainer";

export function ManualControls() {
  return (
    <section className="h-full flex flex-col justify-center rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl">
      <h3 className="text-lg font-semibold">Ручное управление</h3>

      <div className="mt-4 grid grid-cols-2 gap-4 flex-1">
        {/* Окно */}
        <RippleContainer className="flex flex-col justify-center rounded-2xl border border-white/10 bg-black/40 p-5 text-center cursor-pointer hover:bg-white/10 transition-colors">
          <svg className="mx-auto h-7 w-7 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v18m16.5-18v18M3.75 3h16.5M3.75 21h16.5M12 3v18" />
          </svg>
          <h4 className="mt-3 text-base font-medium">Окно</h4>
          <p className="mt-1 text-sm text-gray-500">Закрыто</p>
        </RippleContainer>

        {/* Увлажнитель */}
        <RippleContainer className="flex flex-col justify-center rounded-2xl border border-white/10 bg-black/40 p-5 text-center cursor-pointer hover:bg-white/10 transition-colors">
          <svg className="mx-auto h-7 w-7 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          </svg>
          <h4 className="mt-3 text-base font-medium">Увлажнитель</h4>
          <p className="mt-1 text-sm text-gray-500">Выключен</p>
        </RippleContainer>
      </div>
    </section>
  );
}
