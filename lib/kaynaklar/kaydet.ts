import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CozulmusIlan } from "@/lib/ai/ilanCozumle";
import { sadelestir } from "@/lib/iller";
import { guvenliKirp } from "@/lib/metin";

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
};

/**
 * Aynı ilanın tekrar kaydını engeller.
 *
 * Eski hash tonaj/tarih/fiyat dalgalanmasına açıktı → aynı mesaj yeniden
 * işlenince Balıkesir→Muğla 6 kopya oluyordu. Yeni çekirdek:
 * - ham metin izi (aynı mesaj = aynı iz)
 * - telefon
 * - il düzeyinde rota (cikisIl/varisIl; yoksa yer adı)
 * - fiyat (yoksa sabit "0") — tonaj/tarih YOK
 */
export function dedupHashUret(ilan: CozulmusIlan, hamMetin: string): string {
  const hamIz = createHash("sha256")
    .update(sadelestir(hamMetin).slice(0, 2500))
    .digest("hex")
    .slice(0, 16);
  const fiyat = ilan.ucret ?? ilan.fiyatTon ?? 0;
  const cekirdek = [
    hamIz,
    ilan.telefon ?? "",
    sadelestir(ilan.cikisIl ?? ilan.nereden ?? ""),
    sadelestir(ilan.varisIl ?? ilan.nereye ?? ""),
    String(fiyat),
  ].join("|");

  return createHash("sha256").update(cekirdek).digest("hex").slice(0, 40);
}

/** Hash kaçsa bile aynı ham+rota son 14 günde varsa atla. */
async function yumusakKopyaVarMi(
  ilan: CozulmusIlan,
  hamMetin: string
): Promise<boolean> {
  const cikis = ilan.cikisIl;
  const varis = ilan.varisIl;
  if (!cikis || !varis) return false;

  const kirpik = guvenliKirp(hamMetin, 4000);
  const sinir = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const mevcut = await prisma.yukIlani.findFirst({
    where: {
      createdAt: { gte: sinir },
      cikisIl: cikis,
      varisIl: varis,
      hamMetin: kirpik,
    },
    select: { id: true },
  });
  return Boolean(mevcut);
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
 * Tekrar eden ilanlar sessizce atlanır.
 */
export async function ilanlariKaydet(
  kaynakId: number | null,
  bulunanlar: { ilan: CozulmusIlan; hamMetin: string }[]
): Promise<KaydedilenIlan[]> {
  const yeniler: KaydedilenIlan[] = [];

  for (const { ilan, hamMetin } of bulunanlar) {
    const dedupHash = dedupHashUret(ilan, hamMetin);

    const mevcut = await prisma.yukIlani.findUnique({
      where: { dedupHash },
      select: { id: true },
    });
    if (mevcut) continue;
    if (await yumusakKopyaVarMi(ilan, hamMetin)) continue;

    const donusTalebiId = await donusTalebiEslestir(ilan);

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
      });
    } catch {
      // Eşzamanlı taramada aynı hash oluşabilir; yoksay.
      continue;
    }
  }

  return yeniler;
}
