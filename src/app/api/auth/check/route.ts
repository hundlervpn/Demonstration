import { NextRequest, NextResponse } from "next/server";
import { checkAuthCode } from "@/lib/auth-store";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const result = checkAuthCode(code);

  const response = NextResponse.json(result);

  // Set auth cookie server-side when verified
  if (result.verified) {
    const username = result.telegramUsername || "telegram_user";
    response.cookies.set("auth_token", username, {
      path: "/",
      maxAge: 604800,
      sameSite: "lax",
      httpOnly: false,
    });
    if (result.telegramId) {
      response.cookies.set("tg_id", String(result.telegramId), {
        path: "/",
        maxAge: 604800,
        sameSite: "lax",
        httpOnly: false,
      });
    }
  }

  return response;
}
