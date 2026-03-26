import { NextRequest, NextResponse } from "next/server";
import { verifyAuthCode } from "@/lib/auth-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, secret, username } = body;

    // Verify bot secret
    const expectedSecret = process.env.TELEGRAM_BOT_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const verified = verifyAuthCode(code, username);
    if (!verified) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
