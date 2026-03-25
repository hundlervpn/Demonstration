import { NextRequest, NextResponse } from "next/server";
import { checkTelegramCode, createSession } from "@/lib/auth-store";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Код обязателен" }, { status: 400 });
  }

  const result = checkTelegramCode(code);

  if (result.expired) {
    return NextResponse.json({ verified: false, expired: true });
  }

  if (!result.verified) {
    return NextResponse.json({ verified: false });
  }

  const token = createSession(result.telegramUser || "telegram", false);

  const response = NextResponse.json({ verified: true, user: result.telegramUser });
  response.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
