import { NextResponse, type NextRequest } from "next/server";
import { GORUNUM_COOKIE, OTURUM_COOKIE, etkinOturum } from "@/lib/auth";

/** Üyeye (ve üye görünümündeki yöneticiye) kapalı yönetici sayfaları / uçları. */
function uyeyeKapali(yol: string, yoneticiGoruyor: boolean): boolean {
  if (yol === "/ai/yukler") return false;
  // Yönetim yalnız yöneticinin kendi görünümünde; üye görünümünden "Yönetime dön" ile çıkılır
  if (yol === "/yonetim" || yol.startsWith("/yonetim/")) return !yoneticiGoruyor;
  return [
    "/ai",
    "/ayarlar",
    "/ana-onizleme",
    "/api/yedek",
    "/api/telegram",
    "/api/ai/tara",
    "/api/ai/kuyruk",
    "/api/ai/gunluk-analiz",
    "/api/ai/test-on",
  ].some((k) => yol === k || yol.startsWith(k + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/giris") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    // Netlify'ın kendi uçları: zamanlanmış fonksiyonlar buradan çağrılır,
    // araya girilirse cron çalışmaz.
    pathname.startsWith("/.netlify") ||
    // Makine uçları: kendi gizli anahtarlarıyla doğrulanır, oturum aramaz.
    pathname.startsWith("/api/telegram/webhook") ||
    pathname.startsWith("/api/telegram/uye") ||
    pathname.startsWith("/api/ai/tara") ||
    pathname.startsWith("/api/ai/kuyruk") ||
    pathname.startsWith("/api/ai/gunluk-analiz") ||
    // Sadece commit kodu döner; giriş ekranında da güncelleme fark edilsin.
    pathname === "/api/surum" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const oturum = await etkinOturum(req.cookies.get(OTURUM_COOKIE)?.value, req.cookies.get(GORUNUM_COOKIE)?.value);
  if (oturum) {
    if (oturum.rol === "uye" && uyeyeKapali(pathname, Boolean(oturum.yoneticiGoruyor))) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ hata: "Yetki yok." }, { status: 403 });
      const ana = req.nextUrl.clone();
      ana.pathname = "/";
      ana.search = "";
      return NextResponse.redirect(ana);
    }
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/giris";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!\\.netlify|_next/static|_next/image|favicon.ico|icon\\.svg|icon-.*\\.png|apple-touch-icon\\.png|manifest\\.webmanifest|sw\\.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
