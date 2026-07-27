import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CozulmusIlan } from "@/lib/ai/ilanCozumle";
import { sadelestir } from "@/lib/iller";
import { guvenliKirp } from "@/lib/metin";

/** Aynı rota tekrarında yeni kayıt açmama penceresi. */
export const DEDUP_PENCERE_MS = 48 * 60 * 60 * 1000;

export type KaydedilenIlan = {
  id: number;
  firmaAdi: string | null;
  ilgiliKisi: string | null;
  telefon: string | null;
  nereden: string | null;
  nereye: string | null;
  cikisIl: string | null;
  varisIl: string | null;
  ucret: number | null;
  fiyatTon: number | null;
  tonaj: number | null;
  aracTipi: string | null;
  aracTipiKod: string | null;
  guvenSkoru: number;
  hamMetin: string;
  donusTalebiId: number | null;
  createdAt: Date;
  kaynakAd?: string | null;
};

/**
 * Rota bazlı dedup — mesaj metni YOK.
 * Anahtar: telefon | çıkış_il | varış_il | fiyat
 * Aynı firma listeyi her saat yeniden atsın, tek ilan kalsın.
 */
export function dedupHashUret(ilan: CozulmusIlan, _hamMetin?: string): string {
  const fiyat = ilan.ucret ?? ilan.fiyatTon ?? 0;
  const cekirdek = [
    ilan.telefon ?? "",
    sadelestir(ilan.cikisIl ?? ""),
    sadelestir(ilan.varisIl ?? ""),
    String(fiyat),
  ].join("|");

  return createHash("sha256").update(cekirdek).digest("hex").slice(0, 40);
}

/** 48 saat içinde aynı tel+rota (fiyat fark etmez) var mı? */
async function mevcutRota48s(
  ilan: CozulmusIlan
): Promise<{ id: number } | null> {
  if (!ilan.cikisIl || !ilan.varisIl) return null;
  const sinir = new Date(Date.now() - DEDUP_PENCERE_MS);
  return prisma.yukIlani.findFirst({
    where: {
      telefon: ilan.telefon,
      cikisIl: ilan.cikisIl,
      varisIl: ilan.varisIl,
      sonGorulme: { gte: sinir },
    },
    orderBy: { sonGorulme: "desc" },
    select: { id: true },
  });
}

async function rotayiYenile(
  id: number,
  ilan: CozulmusIlan,
  hamMetin: string,
  kaynakId: number | null
): Promise<void> {
  await prisma.yukIlani.update({
    where: { id },
    data: {
      sonGorulme: new Date(),
      hamMetin: guvenliKirp(hamMetin, 4000),
      firmaAdi: ilan.firmaAdi ?? undefined,
      ilgiliKisi: ilan.ilgiliKisi ?? undefined,
      nereden: ilan.nereden ?? undefined,
      nereye: ilan.nereye ?? undefined,
      ucret: ilan.ucret,
      fiyatTon: ilan.fiyatTon,
      fiyatBelirsiz: ilan.fiyatBelirsiz,
      tonaj: ilan.tonaj ?? undefined,
      aracTipi: ilan.aracTipi ?? undefined,
      aracTipiKod: ilan.aracTipiKod ?? undefined,
      yukTipi: ilan.yukTipi ?? undefined,
      guvenSkoru: ilan.guvenSkoru,
      yuklemeTarihi: ilan.yuklemeTarihi,
      ...(kaynakId ? { kaynakId } : {}),
    },
  });
}

/** Aktif dönüş taleplerinden bu ilana uyanı bulur. */
async function donusTalebiEslestir(
  ilan: CozulmusIlan
): Promise<number | null> {
  if (!ilan.cikisIl || !ilan.varisIl) return null;

  const talep = await prisma.donusTalebi.findFirst({
    where: { aktif: true, cikisIl: ilan.cikisIl, varisIl: ilan.varisIl },
    orderBy: { createdAt: "desc" },
  });
  return talep?.id ?? null;
}

/**
 * İlanları kaydeder; yeni eklenenleri döndürür.
 * 48s içindeki aynı rota → yeni kayıt yok, sonGorulme güncellenir.
 */
export async function ilanlariKaydet(
  kaynakId: number | null,
  bulunanlar: { ilan: CozulmusIlan; hamMetin: string }[]
): Promise<KaydedilenIlan[]> {
  const yeniler: KaydedilenIlan[] = [];

  for (const { ilan, hamMetin } of bulunanlar) {
    const dedupHash = dedupHashUret(ilan);

    const ayniHash = await prisma.yukIlani.findUnique({
      where: { dedupHash },
      select: { id: true, sonGorulme: true },
    });
    if (ayniHash) {
      const sinir = Date.now() - DEDUP_PENCERE_MS;
      if (ayniHash.sonGorulme.getTime() >= sinir) {
        await rotayiYenile(ayniHash.id, ilan, hamMetin, kaynakId);
        continue;
      }
    }

    const yakin = await mevcutRota48s(ilan);
    if (yakin) {
      await rotayiYenile(yakin.id, ilan, hamMetin, kaynakId);
      continue;
    }

    const donusTalebiId = await donusTalebiEslestir(ilan);
    const simdi = new Date();

    try {
      const kayit = await prisma.yukIlani.create({
        data: {
          kaynakId,
          hamMetin: guvenliKirp(hamMetin, 4000),
          firmaAdi: ilan.firmaAdi,
          ilgiliKisi: ilan.ilgiliKisi,
          telefon: ilan.telefon,
          nereden: ilan.nereden,
          nereye: ilan.nereye,
          cikisIl: ilan.cikisIl,
          varisIl: ilan.varisIl,
          yuklemeTarihi: ilan.yuklemeTarihi,
          ucret: ilan.ucret,
          fiyatTon: ilan.fiyatTon,
          fiyatBelirsiz: ilan.fiyatBelirsiz,
          tonaj: ilan.tonaj,
          aracTipi: ilan.aracTipi,
          aracTipiKod: ilan.aracTipiKod,
          yukTipi: ilan.yukTipi,
          guvenSkoru: ilan.guvenSkoru,
          dedupHash,
          donusTalebiId,
          sonGorulme: simdi,
        },
      });

      if (donusTalebiId) {
        await prisma.donusTalebi.update({
          where: { id: donusTalebiId },
          data: { eslesmeAdet: { increment: 1 }, sonKontrol: new Date() },
        });
      }

      yeniler.push({
        id: kayit.id,
        firmaAdi: kayit.firmaAdi,
        ilgiliKisi: kayit.ilgiliKisi,
        telefon: kayit.telefon,
        nereden: kayit.nereden,
        nereye: kayit.nereye,
        cikisIl: kayit.cikisIl,
        varisIl: kayit.varisIl,
        ucret: kayit.ucret,
        fiyatTon: kayit.fiyatTon,
        tonaj: kayit.tonaj,
        aracTipi: kayit.aracTipi,
        aracTipiKod: kayit.aracTipiKod,
        guvenSkoru: kayit.guvenSkoru,
        hamMetin: kayit.hamMetin,
        donusTalebiId: kayit.donusTalebiId,
        createdAt: kayit.createdAt,
      });
    } catch {
      // Eşzamanlı taramada aynı hash — varsa yenile.
      const yarisan = await prisma.yukIlani.findUnique({
        where: { dedupHash },
        select: { id: true },
      });
      if (yarisan) {
        await rotayiYenile(yarisan.id, ilan, hamMetin, kaynakId);
      }
    }
  }

  return yeniler;
}
