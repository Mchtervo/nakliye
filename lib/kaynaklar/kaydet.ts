import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CozulmusIlan } from "@/lib/ai/ilanCozumle";
import { ilBul, sadelestir } from "@/lib/iller";
import { guvenliKirp } from "@/lib/metin";

/** Aynı rota tekrarında yeni kayıt açmama / hash kova penceresi. */
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
  aracUzunluk?: number | null;
  koridorTipi?: string | null;
  guvenSkoru: number;
  hamMetin: string;
  donusTalebiId: number | null;
  createdAt: Date;
  kaynakAd?: string | null;
  gonderenUserId?: string | null;
  kaynakMesajId?: number | null;
  hamMesajId?: number | null;
};

export type KaydetRaporu = {
  yeniler: KaydedilenIlan[];
  /** Aynı hash/rota 48s içinde → yenileme, yeni satır yok. */
  dedupAtlanan: number;
  /** create öncesi cikis/varis yok. */
  rotaYok: number;
  /** create catch / unique race dışı hata. */
  kayitHatasi: number;
};

/** İlçe→il sonrası normalize (Temelli→Ankara, Gebze→Kocaeli). */
export function ilaniRotaNormalize(ilan: CozulmusIlan): CozulmusIlan {
  const cikisIl =
    ilBul(ilan.cikisIl) || ilBul(ilan.nereden) || ilan.cikisIl;
  const varisIl =
    ilBul(ilan.varisIl) || ilBul(ilan.nereye) || ilan.varisIl;
  return { ...ilan, cikisIl, varisIl };
}

/** Mutlak 48s kova — süre dolunca aynı rota yeni dedupHash alır (@unique kırılmaz). */
export function dedupKova(tarih = new Date()): number {
  return Math.floor(tarih.getTime() / DEDUP_PENCERE_MS);
}

/**
 * Rota bazlı dedup — ham yer adı YOK, sadece normalize il + 48s kova.
 * Anahtar: telefon | çıkış_il | varış_il | fiyat | b{kova}
 */
export function dedupHashUret(ilan: CozulmusIlan, _hamMetin?: string): string {
  const n = ilaniRotaNormalize(ilan);
  const fiyat = n.ucret ?? n.fiyatTon ?? 0;
  const cekirdek = [
    n.telefon ?? "",
    sadelestir(n.cikisIl ?? ""),
    sadelestir(n.varisIl ?? ""),
    String(fiyat),
    `b${dedupKova()}`,
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
  kaynakId: number | null,
  kimlik?: {
    gonderenUserId?: string | null;
    kaynakMesajId?: number | null;
    hamMesajId?: number | null;
  }
): Promise<{ revived: boolean }> {
  const n = ilaniRotaNormalize(ilan);
  const mevcut = await prisma.yukIlani.findUnique({
    where: { id },
    select: { durum: true },
  });
  // ARSIV/ELENDI tekrar görünce YENİ'ye çek — yoksa panel boş kalır.
  const revived =
    mevcut?.durum === "ARSIV" || mevcut?.durum === "ELENDI";

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
      aracUzunluk: n.aracUzunluk ?? undefined,
      koridorTipi: n.koridorTipi ?? undefined,
      yukTipi: n.yukTipi ?? undefined,
      guvenSkoru: n.guvenSkoru,
      yuklemeTarihi: n.yuklemeTarihi,
      ...(revived
        ? {
            durum: "YENI",
            bildirildi: false,
            bildirimDeneme: 0,
            bildirimPush: false,
          }
        : {}),
      ...(kaynakId ? { kaynakId } : {}),
      ...(kimlik?.gonderenUserId
        ? { gonderenUserId: kimlik.gonderenUserId }
        : {}),
      ...(kimlik?.kaynakMesajId != null
        ? { kaynakMesajId: kimlik.kaynakMesajId }
        : {}),
      ...(kimlik?.hamMesajId != null ? { hamMesajId: kimlik.hamMesajId } : {}),
    },
  });
  if (kimlik?.gonderenUserId || kimlik?.hamMesajId != null || revived) {
    console.log(
      `[kaydet] yenile #${id}${revived ? " ARSIV→YENI" : ""} uid=${kimlik?.gonderenUserId || "-"} ` +
        `hamMesajId=${kimlik?.hamMesajId ?? "-"} tgMsg=${kimlik?.kaynakMesajId ?? "-"}`
    );
  }
  return { revived };
}

async function yenileVeBelkiBildir(
  id: number,
  ilan: CozulmusIlan,
  hamMetin: string,
  kaynakId: number | null,
  kimlik: {
    gonderenUserId?: string | null;
    kaynakMesajId?: number | null;
    hamMesajId?: number | null;
  },
  yeniler: KaydedilenIlan[]
): Promise<void> {
  const onceki = await prisma.yukIlani.findUnique({
    where: { id },
    select: { bildirildi: true, durum: true },
  });
  const { revived } = await rotayiYenile(id, ilan, hamMetin, kaynakId, kimlik);
  // ARSIV canlanması VEYA daha önce bildirim tamamlanmamış (TG fail + push OK) → tekrar dene
  if (!revived && onceki?.bildirildi !== false) return;
  const kayit = await prisma.yukIlani.findUnique({ where: { id } });
  if (!kayit) return;
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
    aracUzunluk: kayit.aracUzunluk,
    koridorTipi: kayit.koridorTipi,
    guvenSkoru: kayit.guvenSkoru,
    hamMetin: kayit.hamMetin,
    donusTalebiId: kayit.donusTalebiId,
    createdAt: kayit.createdAt,
    gonderenUserId: kayit.gonderenUserId,
    kaynakMesajId: kayit.kaynakMesajId,
    hamMesajId: kayit.hamMesajId,
  });
}

/** Aktif dönüş taleplerinden bu ilana uyanı bulur. */
async function donusTalebiEslestir(
  ilan: CozulmusIlan
): Promise<number | null> {
  const n = ilaniRotaNormalize(ilan);
  if (!n.cikisIl || !n.varisIl) return null;

  const tam = await prisma.donusTalebi.findFirst({
    where: { aktif: true, cikisIl: n.cikisIl, varisIl: n.varisIl },
    orderBy: { createdAt: "desc" },
  });
  if (tam) return tam.id;

  // Soft: varıştan çıkan her yük → açık talebe bağla
  const soft = await prisma.donusTalebi.findFirst({
    where: { aktif: true, cikisIl: n.cikisIl },
    orderBy: { createdAt: "desc" },
  });
  return soft?.id ?? null;
}

/**
 * İlanları kaydeder; yeni eklenenleri + dedup sayacını döndürür.
 * 48s kova hash: süre dolunca aynı rota yeni YukIlani satırı üretir.
 */

export async function ilanlariKaydet(
  kaynakId: number | null,
  bulunanlar: {
    ilan: CozulmusIlan;
    hamMetin: string;
    gonderenUserId?: string | null;
    kaynakMesajId?: number | null;
    hamMesajId?: number | null;
  }[],
  opts?: {
    /** Varsayılan YENI. Tonaj aşımı vb. için ELENDI. */
    durum?: string;
  }
): Promise<KaydetRaporu> {
  const yeniler: KaydedilenIlan[] = [];
  let dedupAtlanan = 0;
  let rotaYok = 0;
  let kayitHatasi = 0;
  const batchRota = new Set<string>();
  const hedefDurum = opts?.durum || "YENI";
  const elendiMi = hedefDurum === "ELENDI";

  for (const {
    ilan: hamIlan,
    hamMetin,
    gonderenUserId,
    kaynakMesajId,
    hamMesajId,
  } of bulunanlar) {
    const ilan = ilaniRotaNormalize(hamIlan);
    if (!ilan.cikisIl || !ilan.varisIl) {
      rotaYok += 1;
      console.log(
        `[kaydet] rotaYok hamMesaj=#${hamMesajId ?? "-"} ` +
          `${ilan.nereden || "?"}→${ilan.nereye || "?"}`
      );
      continue;
    }

    const rotaKey = `${ilan.telefon || ""}|${ilan.cikisIl}|${ilan.varisIl}`;
    if (batchRota.has(rotaKey)) {
      dedupAtlanan += 1;
      continue;
    }
    const rotaSonek = `|${ilan.cikisIl}|${ilan.varisIl}`;
    if ([...batchRota].some((k) => k.endsWith(rotaSonek))) {
      dedupAtlanan += 1;
      continue;
    }
    batchRota.add(rotaKey);

    const dedupHash = dedupHashUret(ilan);
    const kimlik = { gonderenUserId, kaynakMesajId, hamMesajId };

    const ayniHash = await prisma.yukIlani.findUnique({
      where: { dedupHash },
      select: { id: true },
    });
    if (ayniHash) {
      if (elendiMi) {
        await prisma.yukIlani.update({
          where: { id: ayniHash.id },
          data: {
            durum: "ELENDI",
            bildirildi: true,
            sonGorulme: new Date(),
            tonaj: ilan.tonaj ?? undefined,
            hamMetin: guvenliKirp(
              `[tonaj aşımı] ${hamMetin}`.slice(0, 4000),
              4000
            ),
          },
        });
      } else {
        await yenileVeBelkiBildir(
          ayniHash.id,
          ilan,
          hamMetin,
          kaynakId,
          kimlik,
          yeniler
        );
      }
      dedupAtlanan += 1;
      continue;
    }

    const yakin = await mevcutRota48s(ilan);
    if (yakin) {
      if (elendiMi) {
        await prisma.yukIlani.update({
          where: { id: yakin.id },
          data: {
            durum: "ELENDI",
            bildirildi: true,
            sonGorulme: new Date(),
            tonaj: ilan.tonaj ?? undefined,
            hamMetin: guvenliKirp(
              `[tonaj aşımı] ${hamMetin}`.slice(0, 4000),
              4000
            ),
          },
        });
      } else {
        await yenileVeBelkiBildir(
          yakin.id,
          ilan,
          hamMetin,
          kaynakId,
          kimlik,
          yeniler
        );
      }
      dedupAtlanan += 1;
      continue;
    }

    const donusTalebiId = elendiMi ? null : await donusTalebiEslestir(ilan);
    const simdi = new Date();

    try {
      const kayit = await prisma.yukIlani.create({
        data: {
          kaynakId,
          hamMetin: guvenliKirp(
            elendiMi ? `[tonaj aşımı] ${hamMetin}` : hamMetin,
            4000
          ),
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
          aracUzunluk: ilan.aracUzunluk,
          koridorTipi: ilan.koridorTipi,
          yukTipi: ilan.yukTipi,
          guvenSkoru: ilan.guvenSkoru,
          durum: hedefDurum,
          bildirildi: elendiMi,
          dedupHash,
          donusTalebiId,
          sonGorulme: simdi,
          gonderenUserId: gonderenUserId || null,
          kaynakMesajId: kaynakMesajId ?? null,
          hamMesajId: hamMesajId ?? null,
        },
      });

      console.log(
        `[kaydet] ${hedefDurum} #${kayit.id} ${kayit.cikisIl}→${kayit.varisIl} ` +
          `uid=${kayit.gonderenUserId || "-"} hamMesajId=${kayit.hamMesajId ?? "-"} ` +
          `tgMsg=${kayit.kaynakMesajId ?? "-"}` +
          (elendiMi ? " sebep=tonaj aşımı" : "")
      );

      if (donusTalebiId) {
        await prisma.donusTalebi.update({
          where: { id: donusTalebiId },
          data: { eslesmeAdet: { increment: 1 }, sonKontrol: new Date() },
        });
      }

      if (elendiMi) continue;

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
        aracUzunluk: kayit.aracUzunluk,
        koridorTipi: kayit.koridorTipi,
        guvenSkoru: kayit.guvenSkoru,
        hamMetin: kayit.hamMetin,
        donusTalebiId: kayit.donusTalebiId,
        createdAt: kayit.createdAt,
        gonderenUserId: kayit.gonderenUserId,
        kaynakMesajId: kayit.kaynakMesajId,
        hamMesajId: kayit.hamMesajId,
      });
    } catch (e) {
      const yarisan = await prisma.yukIlani.findUnique({
        where: { dedupHash },
        select: { id: true },
      });
      if (yarisan) {
        dedupAtlanan += 1;
        if (elendiMi) {
          await prisma.yukIlani.update({
            where: { id: yarisan.id },
            data: {
              durum: "ELENDI",
              bildirildi: true,
              sonGorulme: new Date(),
            },
          });
        } else {
          await yenileVeBelkiBildir(
            yarisan.id,
            ilan,
            hamMetin,
            kaynakId,
            kimlik,
            yeniler
          );
        }
      } else {
        kayitHatasi += 1;
        console.error(
          `[kaydet] kayitHatasi hamMesaj=#${hamMesajId ?? "-"} ` +
            `${ilan.cikisIl}→${ilan.varisIl}: ` +
            (e instanceof Error ? e.message : e)
        );
      }
    }
  }

  return { yeniler, dedupAtlanan, rotaYok, kayitHatasi };
}

