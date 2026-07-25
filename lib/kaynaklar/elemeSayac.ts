import { prisma } from "@/lib/prisma";

export type ElemeSayaclari = Record<string, number>;

const ONEK = "ai_eleme_sayac:";

/** TR günü (UTC+3) için anahtar. */
export function bugunAnahtar(tarih = new Date()): string {
  const tr = new Date(tarih.getTime() + 3 * 60 * 60 * 1000);
  return tr.toISOString().slice(0, 10);
}

function anahtar(gun: string): string {
  return `${ONEK}${gun}`;
}

export async function elemeSayaclariOku(
  gun = bugunAnahtar()
): Promise<ElemeSayaclari> {
  const kayit = await prisma.ayar.findUnique({ where: { anahtar: anahtar(gun) } });
  if (!kayit?.deger) return {};
  try {
    const j = JSON.parse(kayit.deger) as ElemeSayaclari;
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

/** Sayaçları artırır; günlük raporda gösterilir. */
export async function elemeArtir(
  ekler: ElemeSayaclari,
  gun = bugunAnahtar()
): Promise<ElemeSayaclari> {
  const mevcut = await elemeSayaclariOku(gun);
  let degisti = false;
  for (const [k, v] of Object.entries(ekler)) {
    if (!v) continue;
    mevcut[k] = (mevcut[k] ?? 0) + v;
    degisti = true;
  }
  if (!degisti) return mevcut;

  const a = anahtar(gun);
  await prisma.ayar.upsert({
    where: { anahtar: a },
    create: { anahtar: a, deger: JSON.stringify(mevcut) },
    update: { deger: JSON.stringify(mevcut) },
  });
  return mevcut;
}

/**
 * Türkiye saatiyle 23:00–06:00 arası mı?
 * Bu pencerede Telegram okuması devam eder, AI işlemesi ertelenir.
 */
export function aiGeceMi(tarih = new Date()): boolean {
  const saat = new Date(tarih.getTime() + 3 * 60 * 60 * 1000).getUTCHours();
  return saat >= 23 || saat < 6;
}
