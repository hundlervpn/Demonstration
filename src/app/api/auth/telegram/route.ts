import { NextResponse } from "next/server";
import { createTelegramLogin } from "@/lib/auth-store";

export async function POST() {
  try {
    const { code } = createTelegramLogin();
    return NextResponse.json({ code });
  } catch (err) {
    console.error("Telegram login error:", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
