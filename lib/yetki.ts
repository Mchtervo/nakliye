import { aktifBaglam } from "@/lib/baglam";

/**
 * Yalnız yöneticinin kendi görünümünde çalışan işlemler (kaynaklar, AI
 * ayarları ve maliyetli AI çağrıları, sistem ayarları). Üye ve üye
 * görünümündeki yönetici reddedilir; menüde gizli olması yetmez.
 */
export async function yoneticiIslemi(): Promise<void> {
  const b = await aktifBaglam();
  if (b.rol !== "admin") throw new Error("Bu işlem yalnız yönetici içindir.");
}

/** Sayfalar için: yönetici değilse ana sayfaya. */
export async function yoneticiSayfasi(): Promise<void> {
  const b = await aktifBaglam();
  if (b.rol !== "admin") {
    const { redirect } = await import("next/navigation");
    redirect("/");
  }
}
