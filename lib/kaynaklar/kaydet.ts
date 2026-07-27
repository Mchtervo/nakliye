import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CozulmusIlan } from "@/lib/ai/ilanCozumle";
import { ilBul, sadelestir } from "@/lib/iller";
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
  gonderenUserId?: string | null;
  kaynakMesajId?: number | null;
};

/** İlçe→il sonrası normalize (Temelli→Ankara, Gebze→Kocaeli). */
export function ilaniRotaNormalize(ilan: CozulmusIlan): CozulmusIlan {
  const cikisIl =
    ilBul(ilan.cikisIl) || ilBul(ilan.nereden) || ilan.cikisIl;
  const varisIl =
    ilBul(ilan.varisIl) || ilBul(ilan.nereye) || ilan.varisIl;
  return { ...ilan, cikisIl, varisIl };
}

/**
 * Rota bazlı dedup — ham yer adı YOK, sadece normalize il.
 * Anahtar: telefon | çıkış_il | varış_il | fiyat
 */
export function dedupHashUret(ilan: CozulmusIlan, _hamMetin?: string): string {
  const n = ilaniRotaNormalize(ilan);
  const fiyat = n.ucret ?? n.fiyatTon ?? 0;
  const cekirdek = [
    n.telefon ?? "",
    sadelestir(n.cikisIl ?? ""),
    sadelestir(n.varisIl ?? ""),
    String(fiyat),
  ].join("|");

  return createHash("sha256").update(cekirdek).digest("hex").slice(0, 40);
}

/** 48 saat içinde aynı tel+rota (fiyat fark etmez; ilçe→il sonrası). */
async function mevcutRota48s(
  ilan: CozulmusIlan
): Promise<{ id: number } | null> {
  const n = ilaniRotaNormalize(ilan);
  if (!n.cikisIl || !n.varisIl) return null;
  const sinir = new Date(Date.now() - DEDUP_PENCERE_MS);
  const rota = {
    cikisIl: n.cikisIl,
    varisIl: n.varisIl,
    sonGorulme: { gte: sinir },
  };

  if (n.telefon) {
    const ayniTel = await prisma.yukIlani.findFirst({
      where: { ...rota, telefon: n.telefon },
      orderBy: { sonGorulme: "desc" },
      select: { id: true },
    });
    if (ayniTel) return ayniTel;
    // Daha önce telefonsuz kaydedilmiş aynı rota
    return prisma.yukIlani.findFirst({
      where: { ...rota, telefon: null },
      orderBy: { sonGorulme: "desc" },
      select: { id: true },
    });
  }

  return prisma.yukIlani.findFirst({
    where: rota,
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
  const n = ilaniRotaNormalize(ilan);
  await prisma.yukIlani.update({
    where: { id },
    data: {
      sonGorulme: new Date(),
      hamMetin: guvenliKirp(hamMetin, 4000),
      firmaAdi: n.firmaAdi ?? undefined,
      ilgiliKisi: n.ilgiliKisi ?? undefined,
      telefon: n.telefon ?? undefined,
      nereden: n.nereden ?? undefined,
      nereye: n.nereye ?? undefined,
      cikisIl: n.cikisIl ?? undefined,
      varisIl: n.varisIl ?? undefined,
      ucret: n.ucret,
      fiyatTon: n.fiyatTon,
      fiyatBelirsiz: n.fiyatBelirsiz,
      tonaj: n.tonaj ?? undefined,
      aracTipi: n.aracTipi ?? undefined,
      aracTipiKod: n.aracTipiKod ?? undefined,
      yukTipi: n.yukTipi ?? undefined,
      guvenSkoru: n.guvenSkoru,
      yuklemeTarihi: n.yuklemeTarihi,
      ...(kaynakId ? { kaynakId } : {}),
    },
  });
}

/** Aktif dönüş taleplerinden bu ilana uyanı bulur. */
async function donusTalebiEslestir(
  ilan: CozulmusIlan
): Promise<number | null> {
  const n = ilaniRotaNormalize(ilan);
  if (!n.cikisIl || !n.varisIl) return null;

  const talep = await prisma.donusTalebi.findFirst({
    where: { aktif: true, cikisIl: n.cikisIl, varisIl: n.varisIl },
    orderBy: { createdAt: "desc" },
  });
  return talep?.id ?? null;
}

/**
 * İlanları kaydeder; yeni eklenenleri döndürür.
 * Dedup: ilçe→il normalize SONRA (Temelli=Ankara, Gebze=Kocaeli).
 */
export async function ilanlariKaydet(
  kaynakId: number | null,
  bulunanlar: {
    ilan: CozulmusIlan;
    hamMetin: string;
    gonderenUserId?: string | null;
    kaynakMesajId?: number | null;
  }[]
): Promise<KaydedilenIlan[]> {
  const yeniler: KaydedilenIlan[] = [];
  /** Batch içi: aynı normalize rota (+tel) tek kart. */
  const batchRota = new Set<string>();

  for (const {
    ilan: hamIlan,
    hamMetin,
    gonderenUserId,
    kaynakMesajId,
  } of bulunanlar) {
    const ilan = ilaniRotaNormalize(hamIlan);
    if (!ilan.cikisIl || !ilan.varisIl) continue;

    const rotaKey = `${ilan.telefon || ""}|${ilan.cikisIl}|${ilan.varisIl}`;
    if (batchRota.has(rotaKey)) continue;
    // Aynı normalize rota: Temelli→Gebze ile Ankara→Kocaeli birleşsin
    const rotaSonek = `|${ilan.cikisIl}|${ilan.varisIl}`;
    if ([...batchRota].some((k) => k.endsWith(rotaSonek))) continue;
    batchRota.add(rotaKey);

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
          gonderenUserId: gonderenUserId || null,
          kaynakMesajId: kaynakMesajId ?? null,
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
        gonderenUserId: kayit.gonderenUserId,
        kaynakMesajId: kayit.kaynakMesajId,
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
