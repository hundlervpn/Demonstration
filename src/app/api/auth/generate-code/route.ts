import { NextResponse } from "next/server";
import { generateAuthCode } from "@/lib/auth-store";

export async function POST() {
  const code = generateAuthCode();
  return NextResponse.json({ code });
}
