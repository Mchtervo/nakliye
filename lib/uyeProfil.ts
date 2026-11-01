import { cookies } from "next/headers";
import { OTURUM_COOKIE, oturumCoz } from "@/lib/auth";
import { anaPrisma, uyeIstemcisi } from "@/lib/prismaAna";
import { uyeSemasiHazirla } from "@/lib/uyeSema";

/** Gerçek yönetici oturumu mu (üye görünümünde olsa bile). */
export async function yoneticiMi(): Promise<boolean> {
  const jar = await cookies();
  return (await oturumCoz(jar.get(OTURUM_COOKIE)?.value))?.rol === "admin";
}

export type UyeDurumu = {
  id: number;
  kullaniciAdi: string;
  ad: string | null;
  telefon: string | null;
  sehir: string | null;
  aktif: boolean;
  sonGiris: Date | null;
  createdAt: Date;
  arac: { ad: string; plaka: string | null } | null;
  /** Doldurulması gereken bilgiler (boşsa tamam) */
  eksikler: string[];
  seferSayisi: number;
  giderSayisi: number;
};

/** Üyenin hesap + kendi şemasındaki araç/kayıt özeti (yalnız o üyenin verisi). */
export async function uyeDurumu(uyeId: number): Promise<UyeDurumu | null> {
  const uye = await anaPrisma.uye.findUnique({ where: { id: uyeId } });
  if (!uye) return null;
  await uyeSemasiHazirla(uyeId);
  const db = uyeIstemcisi(uyeId);
  const [arac, seferSayisi, giderSayisi] = await Promise.all([
    db.arac.findFirst({ orderBy: { id: "asc" }, select: { ad: true, plaka: true } }),
    db.yuk.count(),
    db.gider.count(),
  ]);
  const eksikler: string[] = [];
  if (!arac?.plaka) eksikler.push("Araç ve plaka");
  if (!uye.ad) eksikler.push("Ad soyad");
  if (!uye.telefon) eksikler.push("Telefon");
  return {
    id: uye.id,
    kullaniciAdi: uye.kullaniciAdi,
    ad: uye.ad,
    telefon: uye.telefon,
    sehir: uye.sehir,
    aktif: uye.aktif,
    sonGiris: uye.sonGiris,
    createdAt: uye.createdAt,
    arac,
    eksikler,
    seferSayisi,
    giderSayisi,
  };
}
