/**
 * "Yanlış numara" kara listesi. Kullanıcı arayıp yanlış çıkan numarayı
 * işaretler; o numaralı ilanlar elenir, yenileri hiç kaydedilmez.
 * Anahtar: son 10 hane (0/90 öneki fark etmesin).
 */
import { prisma } from "@/lib/prisma";

const ANAHTAR = "yanlis_numaralar";
const TAVAN = 2000;

export function numaraAnahtari(tel: string | null | undefined): string {
  return (tel || "").replace(/\D/g, "").slice(-10);
}

export async function yanlisNumaralar(): Promise<Set<string>> {
  const k = await prisma.ayar.findUnique({ where: { anahtar: ANAHTAR } });
  if (!k?.deger) return new Set();
  try {
    const j = JSON.parse(k.deger) as unknown;
    return new Set(Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** Numarayı listeye ekler, o numaralı açık ilanları eler. Dönüş: elenen ilan. */
export async function yanlisNumaraIsaretle(tel: string): Promise<number> {
  const n = numaraAnahtari(tel);
  if (n.length !== 10) return 0;
  const liste = await yanlisNumaralar();
  liste.add(n);
  const deger = JSON.stringify([...liste].slice(-TAVAN));
  await prisma.ayar.upsert({
    where: { anahtar: ANAHTAR },
    update: { deger },
    create: { anahtar: ANAHTAR, deger },
  });
  const r = await prisma.yukIlani.updateMany({
    where: {
      telefon: { endsWith: n },
      durum: { notIn: ["ALINDI", "YUKE_DONDU", "ELENDI"] },
    },
    data: { durum: "ELENDI" },
  });
  return r.count;
}
