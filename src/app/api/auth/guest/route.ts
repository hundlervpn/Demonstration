import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("auth_token", "guest", {
    path: "/",
    maxAge: 86400,
    sameSite: "lax",
    httpOnly: false,
  });
  return response;
}
