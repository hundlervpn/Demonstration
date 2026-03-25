import { NextRequest, NextResponse } from "next/server";
import { verifyOTP, createSession } from "@/lib/auth-store";

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (
      !email ||
      !code ||
      typeof email !== "string" ||
      typeof code !== "string"
    ) {
      return NextResponse.json({ error: "Email и код обязательны" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json({ error: "Код должен состоять из 6 цифр" }, { status: 400 });
    }

    const result = verifyOTP(normalizedEmail, normalizedCode);

    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const token = createSession(normalizedEmail, false);

    const response = NextResponse.json({ success: true });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err) {
    console.error("Verify code error:", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
