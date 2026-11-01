import { cookies } from "next/headers";
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
// İstek başına bir kez: çerez nesnesi istek boyunca aynıdır
const istekBasina = new WeakMap<Kavanoz, Promise<Baglam>>();

async function hesapla(jar: Kavanoz): Promise<Baglam> {
  const o = await etkinOturum(jar.get(OTURUM_COOKIE)?.value, jar.get(GORUNUM_COOKIE)?.value);
  if (!o) return ADMIN; // oturumsuz: yalnız middleware'in açık bıraktığı uçlar (giriş, makine uçları)
  if (o.rol === "admin") return ADMIN;
  // Silinmiş / kapatılmış üyenin eski çerezi geçmesin
  const uye = await anaPrisma.uye.findUnique({ where: { id: o.uyeId }, select: { aktif: true } });
  if (!uye?.aktif) throw new Error("Üye hesabı kapalı. Yeniden giriş yap.");
  return { rol: "uye", uyeId: o.uyeId, yoneticiGoruyor: Boolean(o.yoneticiGoruyor) };
}

/** Bu istek kim adına (istek başına bir kez hesaplanır). */
export async function aktifBaglam(): Promise<Baglam> {
  let jar: Kavanoz;
  try {
    jar = await cookies();
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
