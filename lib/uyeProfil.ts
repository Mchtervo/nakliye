import { cache } from "react";
import { OTURUM_COOKIE, oturumCoz } from "@/lib/auth";
import { anaPrisma, uyeIstemcisi } from "@/lib/prismaAna";
import { uyeSemasiHazirMi, uyeSemasiHazirla } from "@/lib/uyeSema";
import { smsHazirMi } from "@/lib/sms";

/** Gerçek yönetici oturumu mu (üye görünümünde olsa bile). */
export async function yoneticiMi(): Promise<boolean> {
  // next/headers yalnız Next içinde yüklenir (betik yükleyicisi çözemiyor)
  if (!process.env.NEXT_RUNTIME) return false;
  const jar = await (await import("next/headers")).cookies();
  return (await oturumCoz(jar.get(OTURUM_COOKIE)?.value))?.rol === "admin";
}

export type UyeDurumu = {
  id: number;
  kullaniciAdi: string;
  ad: string | null;
  telefon: string | null;
  sehir: string | null;
  fotograf: string | null;
  aktif: boolean;
  sonGiris: Date | null;
  createdAt: Date;
  arac: { ad: string; plaka: string | null } | null;
  kurulumBitti: Date | null;
  telefonDogrulandi: Date | null;
  /** Doldurulması gereken bilgiler (boşsa tamam) */
  eksikler: string[];
  /** Üyenin defteri (şeması) hazır mı */
  hazir: boolean;
  seferSayisi: number;
  giderSayisi: number;
};

/** Üyenin hesap + kendi şemasındaki araç/kayıt özeti (yalnız o üyenin verisi). */
export const uyeDurumu = cache(uyeDurumuHesapla);

// Aynı istekte üst şerit + sayfa birlikte sorar: istek başına bir kez hesaplanır (cache).
async function uyeDurumuHesapla(uyeId: number): Promise<UyeDurumu | null> {
  const db = uyeIstemcisi(uyeId);
  const ozet = () =>
    Promise.all([
      db.arac.findFirst({ orderBy: [{ aktif: "desc" }, { id: "asc" }], select: { ad: true, plaka: true } }),
      db.yuk.count(),
      db.gider.count(),
    ]);
  // Defter bu süreçte hazırsa hesap ve özet tek turda (paralel) okunur
  const hazirdi = uyeSemasiHazirMi(uyeId);
  const [uye, onOzet] = await Promise.all([anaPrisma.uye.findUnique({ where: { id: uyeId } }), hazirdi ? ozet().catch(() => null) : null]);
  if (!uye) return null;
  let bitti = hazirdi;
  if (!hazirdi) {
    // Defter kuruluyorsa yönetim paneli beklemesin: "hazırlanıyor" döner
    const hazirlik = uyeSemasiHazirla(uyeId);
    bitti = await Promise.race([hazirlik.then(() => true), new Promise<boolean>((ok) => setTimeout(() => ok(false), 4000))]);
    hazirlik.catch(() => null);
  }
  const [arac, seferSayisi, giderSayisi] = onOzet ?? (bitti ? await ozet() : [null, 0, 0]);
  const eksikler: string[] = [];
  // Plaka isteğe bağlı; zorunlu olan kurulum (araç tipi, şehir, kasa)
  if (!uye.kurulumBitti) eksikler.push("Araç kurulumu");
  if (!uye.ad) eksikler.push("Ad soyad");
  if (!uye.telefon) eksikler.push("Telefon");
  else if (!uye.telefonDogrulandi && smsHazirMi()) eksikler.push("Telefon doğrulama");
  return {
    id: uye.id,
    kullaniciAdi: uye.kullaniciAdi,
    ad: uye.ad,
    telefon: uye.telefon,
    sehir: uye.sehir,
    fotograf: uye.fotograf,
    aktif: uye.aktif,
    sonGiris: uye.sonGiris,
    createdAt: uye.createdAt,
    arac,
    kurulumBitti: uye.kurulumBitti,
    telefonDogrulandi: uye.telefonDogrulandi,
    eksikler,
    hazir: bitti,
    seferSayisi,
    giderSayisi,
  };
}
