import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth-store";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;

  if (token) {
    destroySession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
