import { aiJson } from "@/lib/ai/istemci";
import { MODEL_HIZLI } from "@/lib/ai/modeller";
import { ILAN_LISTESI_SEMASI, type IlanCikti } from "@/lib/ai/semalar";
import { ilBul } from "@/lib/iller";

const SISTEM = `Sen Türkiye'deki nakliye/yük ilanlarını okuyan bir asistansın.
Verilen metinde kaç tane yük ilanı varsa hepsini çıkar.

Kurallar:
- Sadece GERÇEK yük ilanlarını al. Sohbet, selam, "araç arıyorum", reklam,
  ödeme şikayeti gibi mesajlar ilan değildir; onları listeye ekleme.
- "Ankara > Bolu", "Ankara-Bolu", "Ankaradan Boluya" gibi yazımların hepsi
  çıkış ve varış demektir.
- Şehir isimlerini 81 ilden birine normalize et (ör. "İst" -> "İstanbul",
  "Gebze" -> "Kocaeli"). İlçe yazılıysa bağlı olduğu ili yaz.
- Ücret "8500", "8.500 TL", "8500tl" gibi yazılabilir; sadece sayıyı ver.
  Ücret yazmıyorsa null bırak.
- Telefonu sadece rakam olarak ver (05321234567).
- Uydurma bilgi ekleme; yoksa null bırak.
- guvenSkoru: metin net bir yük ilanıysa 80-100, şüpheliyse 40-70, zayıfsa 0-39.`;

export type CozulmusIlan = {
  firmaAdi: string | null;
  telefon: string | null;
  nereden: string | null;
  nereye: string | null;
  cikisIl: string | null;
  varisIl: string | null;
  yuklemeTarihi: Date | null;
  ucret: number | null; // kuruş
  aracTipi: string | null;
  yukTipi: string | null;
  guvenSkoru: number;
};

function telefonTemizle(ham: string | null): string | null {
  if (!ham) return null;
  const rakam = ham.replace(/\D/g, "");
  if (rakam.length < 10) return null;
  if (rakam.length === 10) return `0${rakam}`;
  if (rakam.length === 12 && rakam.startsWith("90")) return `0${rakam.slice(2)}`;
  if (rakam.length === 13 && rakam.startsWith("090")) return `0${rakam.slice(3)}`;
  return rakam.slice(0, 11);
}

function tarihCevir(ham: string | null): Date | null {
  if (!ham || !/^\d{4}-\d{2}-\d{2}$/.test(ham)) return null;
  const t = new Date(`${ham}T00:00:00`);
  if (Number.isNaN(t.getTime())) return null;

  // Geçmiş yıla ya da çok uzağa düşen tarihleri kabul etme.
  const bugun = new Date();
  const altSinir = new Date(bugun.getFullYear(), bugun.getMonth() - 1, 1);
  const ustSinir = new Date(bugun.getFullYear() + 1, bugun.getMonth(), 1);
  if (t < altSinir || t > ustSinir) return null;
  return t;
}

function ucretKurusaCevir(tl: number | null): number | null {
  if (tl === null || !Number.isFinite(tl) || tl <= 0) return null;
  // Anlamsız uçları ele (1 TL altı / 5 milyon TL üstü).
  if (tl < 1 || tl > 5_000_000) return null;
  return Math.round(tl * 100);
}

/** Serbest metinden yük ilanlarını çıkarır. */
export async function ilanlariCozumle(
  hamMetin: string
): Promise<CozulmusIlan[]> {
  const metin = hamMetin.trim();
  if (metin.length < 12) return [];

  const cikti = await aiJson<IlanCikti>({
    model: MODEL_HIZLI,
    sistem: SISTEM,
    metin: `Bugünün tarihi: ${new Date().toISOString().slice(0, 10)}\n\nMETİN:\n${metin.slice(0, 12000)}`,
    semaAdi: "yuk_ilanlari",
    sema: ILAN_LISTESI_SEMASI,
    caba: "low",
    maxCikti: 4000,
  });

  return (cikti.ilanlar || [])
    .map((i) => ({
      firmaAdi: i.firmaAdi?.trim() || null,
      telefon: telefonTemizle(i.telefon),
      nereden: i.nereden?.trim() || null,
      nereye: i.nereye?.trim() || null,
      cikisIl: ilBul(i.cikisIl) || ilBul(i.nereden),
      varisIl: ilBul(i.varisIl) || ilBul(i.nereye),
      yuklemeTarihi: tarihCevir(i.yuklemeTarihi),
      ucret: ucretKurusaCevir(i.ucretTl),
      aracTipi: i.aracTipi?.trim() || null,
      yukTipi: i.yukTipi?.trim() || null,
      guvenSkoru: Math.max(0, Math.min(100, Math.round(i.guvenSkoru ?? 0))),
    }))
    .filter((i) => i.guvenSkoru >= 40 && (i.cikisIl || i.varisIl));
}
