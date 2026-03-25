import Link from "next/link";
import { ChevronLeft, Settings } from "lucide-react";

export function TopBar({ title, showSettings = false }: { title: string, showSettings?: boolean }) {
  return (
    <div className="flex items-center justify-between p-5 pb-2">
      <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
        <ChevronLeft className="w-6 h-6 text-gray-400" />
      </Link>
      <h1 className="text-xl font-medium">{title}</h1>
      {showSettings ? (
        <Link href="/settings" className="p-2 -mr-2 rounded-full hover:bg-white/10 transition-colors group">
          <Settings className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
        </Link>
      ) : (
        <div className="w-10" />
      )}
    </div>
  );
}
