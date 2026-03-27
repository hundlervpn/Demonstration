import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const telegramId = request.nextUrl.searchParams.get("tg_id");
  const username = request.cookies.get("auth_token")?.value;

  if (!username) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const isGuest = username === "guest";

  const profile: {
    username: string;
    isGuest: boolean;
    photoUrl: string | null;
    telegramId: number | null;
  } = {
    username: isGuest ? "Гость" : decodeURIComponent(username),
    isGuest,
    photoUrl: null,
    telegramId: telegramId ? Number(telegramId) : null,
  };

  // Fetch Telegram profile photo if we have bot token and telegram ID
  if (!isGuest && telegramId) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      try {
        const photosRes = await fetch(
          `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${telegramId}&limit=1`,
          { next: { revalidate: 3600 } }
        );
        const photosData = await photosRes.json();

        if (photosData.ok && photosData.result.total_count > 0) {
          const fileId = photosData.result.photos[0][0].file_id;
          const fileRes = await fetch(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
          );
          const fileData = await fileRes.json();

          if (fileData.ok) {
            profile.photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
          }
        }
      } catch (e) {
        console.error("[Auth] Failed to fetch Telegram photo:", e);
      }
    }
  }

  return NextResponse.json(profile);
}
