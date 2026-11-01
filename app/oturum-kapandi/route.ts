import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GORUNUM_COOKIE, OTURUM_COOKIE } from "@/lib/auth";

/** Geçersiz kalan oturum çerezlerini siler ve giriş ekranına gönderir. */
export async function GET(req: Request) {
  const jar = await cookies();
  jar.delete(OTURUM_COOKIE);
  jar.delete(GORUNUM_COOKIE);
  return NextResponse.redirect(new URL("/giris?kapandi=1", req.url));
}
