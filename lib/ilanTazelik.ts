/**
 * İlan tazelik / arşiv kuralları.
 * 30 dk üstü → soluk; 2 saat üstü → ARSIV.
 */

import { prisma } from "@/lib/prisma";

export const SOLUK_DK = 30;
/** 2 saat çok agresifti — panel boşalıyordu. 8 saatte arşiv. */
export const ARSIV_DK = 8 * 60;

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

/** 2 saatten eski YENİ ilanları ARSIV'e al. */
export async function eskiIlanlariArsivle(): Promise<number> {
  const sinir = new Date(Date.now() - ARSIV_DK * 60 * 1000);
  const r = await prisma.yukIlani.updateMany({
    where: { durum: "YENI", createdAt: { lt: sinir } },
    data: { durum: "ARSIV" },
  });
  return r.count;
}

/**
 * Yanlışlıkla arşivlenen taze ilanları geri getir (son 36 saat, skor ≥ 40).
 * Bir kerelik / sayfa açılışında güvenli.
 */
export async function arsivdenCanlandir(): Promise<number> {
  const sinir = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const r = await prisma.yukIlani.updateMany({
    where: {
      durum: "ARSIV",
      createdAt: { gte: sinir },
      guvenSkoru: { gte: 40 },
    },
    data: { durum: "YENI" },
  });
  return r.count;
}
