import { NextRequest, NextResponse } from "next/server";
import { checkAuthCode } from "@/lib/auth-store";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const result = checkAuthCode(code);
  return NextResponse.json(result);
}
