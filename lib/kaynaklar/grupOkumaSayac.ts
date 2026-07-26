import { prisma } from "@/lib/prisma";
import { bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";

export type GrupEleme = Record<string, number>;

export type GrupOkumaGunluk = {
  gun: string;
  /** Telegram'dan çekilen ham mesaj (ön filtre öncesi). */
  cekilen: number;
  /** Kuyruğa giren. */
  kuyruk: number;
  elenen: GrupEleme;
};

const ONEK = "grup_okuma:";

function anahtar(kaynakId: number): string {
  return `${ONEK}${kaynakId}`;
}

export async function grupOkumaOku(
  kaynakId: number
): Promise<GrupOkumaGunluk | null> {
  const kayit = await prisma.ayar.findUnique({
    where: { anahtar: anahtar(kaynakId) },
  });
  if (!kayit?.deger) return null;
  try {
    const j = JSON.parse(kayit.deger) as GrupOkumaGunluk;
    if (!j || j.gun !== bugunAnahtar()) return null;
    return j;
  } catch {
    return null;
  }
}

export async function grupOkumaArtir(
  kaynakId: number,
  ek: { cekilen?: number; kuyruk?: number; elenen?: GrupEleme }
): Promise<void> {
  const gun = bugunAnahtar();
  const mevcut = (await grupOkumaOku(kaynakId)) ?? {
    gun,
    cekilen: 0,
    kuyruk: 0,
    elenen: {},
  };
  if (mevcut.gun !== gun) {
    mevcut.gun = gun;
    mevcut.cekilen = 0;
    mevcut.kuyruk = 0;
    mevcut.elenen = {};
  }
  mevcut.cekilen += ek.cekilen ?? 0;
  mevcut.kuyruk += ek.kuyruk ?? 0;
  for (const [k, v] of Object.entries(ek.elenen ?? {})) {
    if (!v) continue;
    mevcut.elenen[k] = (mevcut.elenen[k] ?? 0) + v;
  }

  const a = anahtar(kaynakId);
  await prisma.ayar.upsert({
    where: { anahtar: a },
    create: { anahtar: a, deger: JSON.stringify(mevcut) },
    update: { deger: JSON.stringify(mevcut) },
  });
}

/** Birden fazla kaynak için bugünkü okuma özetleri. */
export async function grupOkumaToplu(
  kaynakIds: number[]
): Promise<Map<number, GrupOkumaGunluk>> {
  if (kaynakIds.length === 0) return new Map();
  const kayitlar = await prisma.ayar.findMany({
    where: { anahtar: { in: kaynakIds.map(anahtar) } },
  });
  const gun = bugunAnahtar();
  const map = new Map<number, GrupOkumaGunluk>();
  for (const k of kayitlar) {
    const id = Number(k.anahtar.slice(ONEK.length));
    if (!Number.isFinite(id)) continue;
    try {
      const j = JSON.parse(k.deger) as GrupOkumaGunluk;
      if (j?.gun === gun) map.set(id, j);
    } catch {
      /* yok say */
    }
  }
  return map;
}
