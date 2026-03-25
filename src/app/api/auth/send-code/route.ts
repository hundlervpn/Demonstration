import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateOTP, storeOTP } from "@/lib/auth-store";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email обязателен" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Неверный формат email" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === "re_xxxxxxxxx") {
      return NextResponse.json(
        {
          error:
            "Не настроен RESEND_API_KEY. Замените re_xxxxxxxxx на реальный ключ в переменных окружения.",
        },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const normalizedEmail = email.toLowerCase().trim();

    const code = generateOTP();

    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: normalizedEmail,
      subject: "Умный дом — код авторизации",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">Умный дом</h2>
          <p style="color: #666; margin-bottom: 24px;">Ваш код для входа:</p>
          <div style="background: #f4f4f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
          </div>
          <p style="color: #999; font-size: 14px;">Код действителен 5 минут. Если вы не запрашивали код, проигнорируйте это письмо.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Ошибка отправки письма" }, { status: 500 });
    }

    storeOTP(normalizedEmail, code);

    return NextResponse.json({ success: true, message: "Код отправлен" });
  } catch (err) {
    console.error("Send code error:", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
