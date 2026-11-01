import { AsyncLocalStorage } from "node:async_hooks";
import type { cookies } from "next/headers";
import { GORUNUM_COOKIE, OTURUM_COOKIE, etkinOturum } from "@/lib/auth";
import { anaPrisma } from "@/lib/prismaAna";

export type Baglam =
  /** Yönetici veya istek dışı sistem işi (cron, daemon, script): ana şema */
  | { rol: "admin" | "sistem"; uyeId: null; yoneticiGoruyor: false }
  /** Üye (veya üye görünümündeki yönetici): yalnız üyenin şeması */
  | { rol: "uye"; uyeId: number; yoneticiGoruyor: boolean };

const ADMIN: Baglam = { rol: "admin", uyeId: null, yoneticiGoruyor: false };
const SISTEM: Baglam = { rol: "sistem", uyeId: null, yoneticiGoruyor: false };

type Kavanoz = Awaited<ReturnType<typeof cookies>>;

/**
 * Çerez artık geçerli değil (hesap kapatıldı, şifre değişti, tüm cihazlardan
 * çıkıldı): çerezleri silen uca yönlendirilir, oradan giriş ekranına.
 */
async function oturumKapandi(): Promise<never> {
  const { redirect } = await import("next/navigation");
  redirect("/oturum-kapandi");
  throw new Error("yönlendirme");
}

// İstek başına bir kez: çerez nesnesi istek boyunca aynıdır
const istekBasina = new WeakMap<Kavanoz, Promise<Baglam>>();

export const YONETICI_SURUM_ANAHTAR = "yonetici_oturum_surum";

export async function yoneticiOturumSurumu(): Promise<number> {
  const a = await anaPrisma.ayar.findUnique({ where: { anahtar: YONETICI_SURUM_ANAHTAR } });
  return Number(a?.deger) || 0;
}

async function hesapla(jar: Kavanoz): Promise<Baglam> {
  const o = await etkinOturum(jar.get(OTURUM_COOKIE)?.value, jar.get(GORUNUM_COOKIE)?.value);
  if (!o) return ADMIN; // oturumsuz: yalnız middleware'in açık bıraktığı uçlar (giriş, makine uçları)
  if (o.rol === "admin") {
    // "Tüm cihazlardan çık" / şifre değişimi sonrası eski yönetici çerezleri geçmez
    if (o.surum !== (await yoneticiOturumSurumu())) return oturumKapandi();
    return ADMIN;
  }
  // Silinmiş / kapatılmış üyenin eski çerezi geçmesin
  const uye = await anaPrisma.uye.findUnique({ where: { id: o.uyeId }, select: { aktif: true, oturumSurum: true } });
  if (!uye?.aktif) return oturumKapandi();
  // Üye görünümünde sürüm yöneticinin kendi oturumuna aittir
  const beklenen = o.yoneticiGoruyor ? await yoneticiOturumSurumu() : uye.oturumSurum;
  if (o.surum !== beklenen) return oturumKapandi();
  return { rol: "uye", uyeId: o.uyeId, yoneticiGoruyor: Boolean(o.yoneticiGoruyor) };
}

// Zamanlanmış görevler (hatırlatma) bir üyenin defterinde onun adına çalışır
const gorevBaglami = new AsyncLocalStorage<Baglam>();

/** Yalnız sunucu görevleri: fn içindeki tüm veritabanı işleri o üyenin şemasında. */
export function uyeAdinaCalistir<T>(uyeId: number, fn: () => Promise<T>): Promise<T> {
  if (!Number.isInteger(uyeId) || uyeId <= 0) return Promise.reject(new Error("Geçersiz üye."));
  return gorevBaglami.run({ rol: "uye", uyeId, yoneticiGoruyor: false }, fn);
}

/** Bu istek kim adına (istek başına bir kez hesaplanır). */
export async function aktifBaglam(): Promise<Baglam> {
  const gorev = gorevBaglami.getStore();
  if (gorev) return gorev;
  // Next dışı (Telegram/WhatsApp servisi, cron betikleri): next/headers yüklenmez,
  // o ortamda çözülemiyor ve servisi düşürüyordu. Bu işler yönetici verisiyle çalışır.
  if (!process.env.NEXT_RUNTIME) return SISTEM;
  let jar: Kavanoz;
  try {
    jar = await (await import("next/headers")).cookies();
  } catch (e) {
    // Next isteği dışında (cron/script/daemon) yönetici verisiyle çalışılır.
    // Başka bir hata (ör. önbellek içinde çağrı) yutulmaz: yanlış şemaya düşmesin.
    if (e instanceof Error && e.message.includes("outside a request scope")) return SISTEM;
    throw e;
  }
  let p = istekBasina.get(jar);
  if (!p) {
    p = hesapla(jar);
    istekBasina.set(jar, p);
  }
  return p;
}
