/**
 * Numara engelleme.
 *
 * - Genel kara liste (yönetici, ana şema Ayar "yanlis_numaralar"): o numaralı
 *   ilanlar elenir, yenileri hiç kaydedilmez — herkes için.
 * - Kişisel liste (üye, kendi defterinde Ayar "engelli_numaralar"): yalnız o
 *   üyenin listesinden ve bildirimlerinden düşer.
 * - Topluluk: TOPLULUK_ESIK kadar farklı üye aynı numarayı engellerse numara
 *   genel kara listeye girer (sahte / reklam hesapları herkesten düşsün).
 *
 * Anahtar: son 10 hane (0/90 öneki fark etmesin).
 */
import { prisma } from "@/lib/prisma";
import { anaPrisma } from "@/lib/prismaAna";

const ANAHTAR = "yanlis_numaralar";
const KISISEL_ANAHTAR = "engelli_numaralar";
const TOPLULUK_ONEK = "numara_engel_";
export const TOPLULUK_ESIK = 2;
const TAVAN = 2000;

export function numaraAnahtari(tel: string | null | undefined): string {
  return (tel || "").replace(/\D/g, "").slice(-10);
}

function listeCoz(deger: string | null | undefined): string[] {
  if (!deger) return [];
  try {
    const j = JSON.parse(deger) as unknown;
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Genel kara liste (herkes için). */
export async function yanlisNumaralar(): Promise<Set<string>> {
  const k = await anaPrisma.ayar.findUnique({ where: { anahtar: ANAHTAR } });
  return new Set(listeCoz(k?.deger));
}

async function genelListeYaz(liste: Set<string>) {
  const deger = JSON.stringify([...liste].slice(-TAVAN));
  await anaPrisma.ayar.upsert({ where: { anahtar: ANAHTAR }, update: { deger }, create: { anahtar: ANAHTAR, deger } });
}

/** Numarayı genel listeye ekler, o numaralı açık ilanları eler. Dönüş: elenen ilan. */
export async function yanlisNumaraIsaretle(tel: string): Promise<number> {
  const n = numaraAnahtari(tel);
  if (n.length !== 10) return 0;
  const liste = await yanlisNumaralar();
  liste.add(n);
  await genelListeYaz(liste);
  const r = await anaPrisma.yukIlani.updateMany({
    where: {
      telefon: { endsWith: n },
      durum: { notIn: ["ALINDI", "YUKE_DONDU", "ELENDI"] },
    },
    data: { durum: "ELENDI" },
  });
  return r.count;
}

/** Genel listeden çıkarır (elenmiş eski ilanlar geri gelmez; yeni ilanlar yine kaydedilir). */
export async function yanlisNumaraKaldir(n: string): Promise<void> {
  const liste = await yanlisNumaralar();
  if (!liste.delete(numaraAnahtari(n))) return;
  await genelListeYaz(liste);
}

/** Üyenin kendi engellediği numaralar (yalnız üye bağlamında anlamlı). */
export async function kisiselEngelliler(): Promise<Set<string>> {
  const k = await prisma.ayar.findUnique({ where: { anahtar: KISISEL_ANAHTAR } });
  return new Set(listeCoz(k?.deger));
}

async function kisiselYaz(liste: Set<string>) {
  const deger = JSON.stringify([...liste].slice(-TAVAN));
  await prisma.ayar.upsert({ where: { anahtar: KISISEL_ANAHTAR }, update: { deger }, create: { anahtar: KISISEL_ANAHTAR, deger } });
}

/**
 * Üye numarayı engeller: kendi listesine yazılır, topluluk sayacı artar;
 * eşik dolarsa numara herkes için kara listeye girer. Dönüş: genele geçti mi.
 */
export async function uyeNumaraEngelle(uyeId: number, tel: string): Promise<{ genele: boolean }> {
  const n = numaraAnahtari(tel);
  if (n.length !== 10) return { genele: false };
  const liste = await kisiselEngelliler();
  liste.add(n);
  await kisiselYaz(liste);

  const anahtar = `${TOPLULUK_ONEK}${n}`;
  const k = await anaPrisma.ayar.findUnique({ where: { anahtar } });
  const uyeler = new Set(listeCoz(k?.deger));
  uyeler.add(String(uyeId));
  const deger = JSON.stringify([...uyeler]);
  await anaPrisma.ayar.upsert({ where: { anahtar }, update: { deger }, create: { anahtar, deger } });
  if (uyeler.size >= TOPLULUK_ESIK && !(await yanlisNumaralar()).has(n)) {
    await yanlisNumaraIsaretle(n);
    return { genele: true };
  }
  return { genele: false };
}

/** Üye engeli kaldırır (topluluk sayacından da düşer). */
export async function uyeNumaraEngelKaldir(uyeId: number, n: string): Promise<void> {
  const anahtarN = numaraAnahtari(n);
  const liste = await kisiselEngelliler();
  if (liste.delete(anahtarN)) await kisiselYaz(liste);
  const anahtar = `${TOPLULUK_ONEK}${anahtarN}`;
  const k = await anaPrisma.ayar.findUnique({ where: { anahtar } });
  if (!k) return;
  const uyeler = new Set(listeCoz(k.deger));
  uyeler.delete(String(uyeId));
  if (uyeler.size === 0) await anaPrisma.ayar.delete({ where: { anahtar } }).catch(() => null);
  else await anaPrisma.ayar.update({ where: { anahtar }, data: { deger: JSON.stringify([...uyeler]) } });
}

/** Ekranda: 0XXX XXX XX XX */
export function numaraGoster(n: string): string {
  const t = numaraAnahtari(n);
  return t.length === 10 ? `0${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6, 8)} ${t.slice(8)}` : n;
}
