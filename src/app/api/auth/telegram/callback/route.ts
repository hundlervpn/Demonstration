import { NextRequest, NextResponse } from "next/server";
import { verifyAuthCode } from "@/lib/auth-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, telegram_user, telegram_id } = body;

    // Verify bot secret from Authorization header
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.TELEGRAM_BOT_SECRET;

    if (expectedSecret && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== expectedSecret) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!code) {
      return NextResponse.json({ success: false, error: "Code is required" }, { status: 400 });
    }

    const username = telegram_user || `tg_${telegram_id}` || "telegram_user";
    const verified = verifyAuthCode(code, username);

    if (!verified) {
      return NextResponse.json({ success: false, error: "Invalid or expired code" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
}
