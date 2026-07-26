import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CozulmusIlan } from "@/lib/ai/ilanCozumle";
import { sadelestir } from "@/lib/iller";
import { guvenliKirp } from "@/lib/metin";

export type KaydedilenIlan = {
  id: number;
  firmaAdi: string | null;
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
 * Aynı ilanın farklı kaynaklardan / tekrar tekrar kaydedilmesini önler.
 *
 * Rota her zaman hash'te: telefondan bağımsız. Aksi hâlde aynı mesajdaki
 * 20 güzergah (telefon yok) tek satıra çöküyordu — ham metin hash'i
 * hepsinde aynıydı.
 *
 * Yer adı il değil ham adla anahtarlanır: "Çan→Kızıltepe" ile
 * "Çan→Mardin" aynı ile düşse bile ayrı ilandır.
 */
export function dedupHashUret(ilan: CozulmusIlan, _hamMetin: string): string {
  const cekirdek = [
    ilan.telefon ?? "",
    sadelestir(ilan.nereden ?? ilan.cikisIl ?? ""),
    sadelestir(ilan.nereye ?? ilan.varisIl ?? ""),
    ilan.ucret ?? ilan.fiyatTon ?? "",
    ilan.tonaj ?? "",
    ilan.yuklemeTarihi?.toISOString().slice(0, 10) ?? "",
  ].join("|");

  return createHash("sha256").update(cekirdek).digest("hex").slice(0, 40);
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

    const donusTalebiId = await donusTalebiEslestir(ilan);

    try {
      const kayit = await prisma.yukIlani.create({
        data: {
          kaynakId,
          hamMetin: guvenliKirp(hamMetin, 4000),
          firmaAdi: ilan.firmaAdi,
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
