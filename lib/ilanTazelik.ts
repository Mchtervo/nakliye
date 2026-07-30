/**
 * İlan tazelik / arşiv kuralları.
 * 30 dk üstü → soluk; 48 saat üstü → ARSIV (silme yok).
 */

import { prisma } from "@/lib/prisma";

export const SOLUK_DK = 30;
/** Panel tazeliği + arşiv eşiği (48 saat). */
export const ARSIV_DK = 48 * 60;
export const PANEL_TAZELIK_MS = ARSIV_DK * 60 * 1000;

export function beklemeDakika(tarih: Date | string): number {
  const t = typeof tarih === "string" ? new Date(tarih) : tarih;
  return Math.max(0, Math.floor((Date.now() - t.getTime()) / 60_000));
}

/** Kartta büyük gösterilen süre: "12 dk", "1 sa 20 dk", "3 sa" */
export function beklemeBuyuk(tarih: Date | string): string {
  const dk = beklemeDakika(tarih);
  if (dk < 1) return "şimdi";
  if (dk < 60) return `${dk} dk`;
  const sa = Math.floor(dk / 60);
  const kalan = dk % 60;
  if (sa < 24) {
    return kalan > 0 ? `${sa} sa ${kalan} dk` : `${sa} sa`;
  }
  const gun = Math.floor(sa / 24);
  return `${gun} gün`;
}

export function solukMu(tarih: Date | string): boolean {
  return beklemeDakika(tarih) >= SOLUK_DK;
}

export function arsivlikMi(tarih: Date | string): boolean {
  return beklemeDakika(tarih) >= ARSIV_DK;
}

export function panelTazeSinir(tarih = new Date()): Date {
  return new Date(tarih.getTime() - PANEL_TAZELIK_MS);
}

/**
 * Panel / plan varsayılan: son 48 saat + arşiv/elenmiş değil.
 * sonGorulme VEYA createdAt taze.
 */
export function panelTazeKosulu() {
  const sinir = panelTazeSinir();
  return {
    AND: [
      {
        OR: [{ createdAt: { gte: sinir } }, { sonGorulme: { gte: sinir } }],
      },
      { durum: { notIn: ["ARSIV", "ELENDI"] } },
    ],
  };
}

/**
 * 48 saatten eski ilanları ARSIV'e al — SİLME YOK.
 * Eşik: sonGorulme (createdAt değil) — taze tekrarlar arşive düşmez.
 * Müşteri havuzu frekansı için kayıtlar kalır.
 */
export async function eskiIlanlariArsivle(): Promise<number> {
  const sinir = new Date(Date.now() - ARSIV_DK * 60 * 1000);
  const r = await prisma.yukIlani.updateMany({
    where: {
      durum: {
        in: [
          "YENI",
          "ILGILENIYOR",
          "ILETISIME_GECILDI",
          "PAZARLIKTA",
          "CEVAP_YOK",
        ],
      },
      sonGorulme: { lt: sinir },
    },
    data: { durum: "ARSIV" },
  });
  return r.count;
}

/**
 * Yanlışlıkla arşivlenen taze ilanları geri getir.
 * sonGorulme son 36 saat + skor ≥ 40.
 */
export async function arsivdenCanlandir(): Promise<number> {
  const sinir = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const r = await prisma.yukIlani.updateMany({
    where: {
      durum: "ARSIV",
      sonGorulme: { gte: sinir },
      guvenSkoru: { gte: 40 },
    },
    data: { durum: "YENI", sonGorulme: new Date() },
  });
  return r.count;
}
