/**
 * Grup başına son N ham mesaj (ön filtre öncesi).
 * Budama "konu dışı" kuralı HamMesaj'a yazılmayan çöpü de görsün.
 */
import { prisma } from "@/lib/prisma";

const ONEK = "grup_son_mesaj:";
const KAPASITE = 20;

function anahtar(kaynakId: number): string {
  return `${ONEK}${kaynakId}`;
}

export async function grupSonMesajOku(kaynakId: number): Promise<string[]> {
  const k = await prisma.ayar.findUnique({
    where: { anahtar: anahtar(kaynakId) },
  });
  if (!k?.deger) return [];
  try {
    const j = JSON.parse(k.deger) as unknown;
    if (!Array.isArray(j)) return [];
    return j.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/** Son mesajları halka tampona ekler (en fazla KAPASITE). */
export async function grupSonMesajEkle(
  kaynakId: number,
  metinler: string[]
): Promise<void> {
  const temiz = metinler
    .map((m) => m.replace(/\s+/g, " ").trim().slice(0, 240))
    .filter(Boolean);
  if (temiz.length === 0) return;

  const mevcut = await grupSonMesajOku(kaynakId);
  const birlesik = [...mevcut, ...temiz].slice(-KAPASITE);
  await prisma.ayar.upsert({
    where: { anahtar: anahtar(kaynakId) },
    create: {
      anahtar: anahtar(kaynakId),
      deger: JSON.stringify(birlesik),
    },
    update: { deger: JSON.stringify(birlesik) },
  });
}

export async function grupSonMesajToplu(
  kaynakIds: number[]
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (kaynakIds.length === 0) return map;
  const kayitlar = await prisma.ayar.findMany({
    where: {
      anahtar: { in: kaynakIds.map(anahtar) },
    },
  });
  for (const k of kayitlar) {
    const idHam = k.anahtar.slice(ONEK.length);
    const id = Number(idHam);
    if (!Number.isFinite(id)) continue;
    try {
      const j = JSON.parse(k.deger) as unknown;
      if (Array.isArray(j)) {
        map.set(
          id,
          j.filter((x): x is string => typeof x === "string")
        );
      }
    } catch {
      /* yoksay */
    }
  }
  return map;
}
