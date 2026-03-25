import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramCode } from "@/lib/auth-store";

export async function POST(request: NextRequest) {
  try {
    const botSecret = process.env.TELEGRAM_BOT_SECRET;
    
    const authHeader = request.headers.get("authorization");
    if (botSecret && authHeader !== `Bearer ${botSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, telegram_user, telegram_id } = await request.json();

    if (!code || !telegram_user || !telegram_id) {
      return NextResponse.json(
        { error: "code, telegram_user, telegram_id required" },
        { status: 400 }
      );
    }

    const ok = verifyTelegramCode(code, telegram_user, telegram_id);

    if (!ok) {
      return NextResponse.json({ success: false, error: "Invalid or expired code" });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Telegram callback error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
