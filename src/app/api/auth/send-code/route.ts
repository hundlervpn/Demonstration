import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Email auth disabled. Use Telegram." }, { status: 410 });
}
