import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth-store";

export async function POST() {
  try {
    const token = createSession("guest@demo", true);

    const response = NextResponse.json({ success: true });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2, // 2 hours for guest
    });

    return response;
  } catch (err) {
    console.error("Guest auth error:", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
