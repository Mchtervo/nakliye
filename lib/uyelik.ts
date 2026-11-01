import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { secret } from "@/lib/auth";
import { anaPrisma } from "@/lib/prismaAna";
import { smsGonder, smsHazirMi } from "@/lib/sms";

/** "0532 123 45 67" / "+90 532…" → "5321234567"; geçersizse null. */
export function telefonNormal(ham: string | null | undefined): string | null {
  let d = String(ham || "").replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return /^5\d{9}$/.test(d) ? d : null;
}

export function telefonMaskeli(normal: string): string {
  return `0${normal.slice(0, 3)} ••• •• ${normal.slice(8)}`;
}

// --- Giriş deneme sınırı (süreç belleğinde; yeniden başlatmada sıfırlanır) ---
const DENEME_PENCERE_MS = 15 * 60 * 1000;
const DENEME_SINIR = 8;
const denemeler = new Map<string, number[]>();

export function girisKilitliMi(anahtar: string): boolean {
  const simdi = Date.now();
  const l = (denemeler.get(anahtar) ?? []).filter((t) => simdi - t < DENEME_PENCERE_MS);
  denemeler.set(anahtar, l);
  return l.length >= DENEME_SINIR;
}

export function girisHatasiYaz(anahtar: string): void {
  const l = denemeler.get(anahtar) ?? [];
  l.push(Date.now());
  denemeler.set(anahtar, l);
}

export function girisBasarili(anahtar: string): void {
  denemeler.delete(anahtar);
}

// --- SMS kodları: 6 hane, 10 dk geçerli, 5 deneme, 60 sn bekleme, saatte 5 kod ---
export type KodAmaci = "DOGRULAMA" | "SIFRE";
const KOD_SURE_MS = 10 * 60 * 1000;
const KOD_BEKLEME_MS = 60 * 1000;
const SAATLIK_KOD = 5;
const KOD_DENEME = 5;

function kodOzeti(uyeId: number, amac: KodAmaci, kod: string): string {
  return createHmac("sha256", secret()).update(`${uyeId}:${amac}:${kod}`).digest("hex");
}

export type KodGonderSonuc = { tamam: true } | { tamam: false; hata: string; smsYok?: boolean };

export async function kodGonder(uyeId: number, telefon: string, amac: KodAmaci): Promise<KodGonderSonuc> {
  if (!smsHazirMi()) return { tamam: false, smsYok: true, hata: "SMS hizmeti henüz kurulu değil; kod gönderilemiyor." };
  const simdi = Date.now();
  const son = await anaPrisma.telefonKodu.findMany({
    where: { uyeId, amac, createdAt: { gte: new Date(simdi - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (son[0] && simdi - son[0].createdAt.getTime() < KOD_BEKLEME_MS) {
    const kalan = Math.ceil((KOD_BEKLEME_MS - (simdi - son[0].createdAt.getTime())) / 1000);
    return { tamam: false, hata: `Yeni kod için ${kalan} sn bekle.` };
  }
  if (son.length >= SAATLIK_KOD) return { tamam: false, hata: "Çok fazla kod istendi. Bir saat sonra tekrar dene." };

  const kod = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Önceki açık kodlar geçersiz: yalnız son kod çalışır
  await anaPrisma.telefonKodu.updateMany({ where: { uyeId, amac, kullanildi: null }, data: { kullanildi: new Date() } });
  await anaPrisma.telefonKodu.create({
    data: { uyeId, amac, kodHash: kodOzeti(uyeId, amac, kod), sonKullanma: new Date(simdi + KOD_SURE_MS) },
  });
  const sms = await smsGonder(telefon, `Nakliye Defteri kodun: ${kod}. 10 dakika geçerli. Kimseyle paylaşma.`);
  if (!sms.gonderildi) return { tamam: false, hata: sms.neden };
  return { tamam: true };
}

export type KodDogrulaSonuc = { tamam: true } | { tamam: false; hata: string };

export async function kodDogrula(uyeId: number, amac: KodAmaci, kod: string): Promise<KodDogrulaSonuc> {
  const temiz = kod.replace(/\D/g, "");
  if (temiz.length !== 6) return { tamam: false, hata: "Kod 6 haneli olmalı." };
  const k = await anaPrisma.telefonKodu.findFirst({
    where: { uyeId, amac, kullanildi: null },
    orderBy: { createdAt: "desc" },
  });
  if (!k || k.sonKullanma.getTime() < Date.now()) return { tamam: false, hata: "Kodun süresi doldu. Yeni kod iste." };
  if (k.deneme >= KOD_DENEME) return { tamam: false, hata: "Çok fazla hatalı deneme. Yeni kod iste." };
  const beklenen = Buffer.from(k.kodHash);
  const gelen = Buffer.from(kodOzeti(uyeId, amac, temiz));
  if (beklenen.length !== gelen.length || !timingSafeEqual(beklenen, gelen)) {
    await anaPrisma.telefonKodu.update({ where: { id: k.id }, data: { deneme: { increment: 1 } } });
    return { tamam: false, hata: "Kod hatalı." };
  }
  // Aynı kod ikinci kez kullanılamaz (yarış durumunda yalnız biri geçer)
  const r = await anaPrisma.telefonKodu.updateMany({ where: { id: k.id, kullanildi: null }, data: { kullanildi: new Date() } });
  if (r.count !== 1) return { tamam: false, hata: "Kod zaten kullanıldı." };
  return { tamam: true };
}

/** Yönetici işlem kaydı (yalnız ana şemaya; üyelere gösterilmez). Hata işlemi durdurmaz. */
export async function yonetimKaydiYaz(islem: string, uyeId: number | null, ayrinti?: string): Promise<void> {
  await anaPrisma.yonetimKaydi
    .create({ data: { islem, uyeId, ayrinti: ayrinti?.slice(0, 500) ?? null } })
    .catch((e) => console.error("[yonetimKaydi]", e));
}
