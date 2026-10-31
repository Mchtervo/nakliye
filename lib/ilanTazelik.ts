/**
 * İlan tazelik.
 * 30 dk üstü → soluk; 6 saat üstü → listeden silinir.
 */

import { prisma } from "@/lib/prisma";

export const SOLUK_DK = 30;
/** Panelde kalma süresi. 6 saati geçen ilan silinir. */
export const ARSIV_DK = 6 * 60;
export const PANEL_TAZELIK_MS = ARSIV_DK * 60 * 1000;
/**
 * "Yeni" ilan sayılma sınırı: 2 saatten eski paylaşımın işi çoğu zaman
 * verilmiş oluyor (arayınca "iş verildi"). Kuyruk, Yeni sekmesi ve bildirim.
 */
export const YENI_ILAN_MS = 2 * 60 * 60 * 1000;

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

/** "Yeni" sayılan en eski paylaşım anı (şimdi − 2 saat). */
export function yeniIlanSinir(tarih = new Date()): Date {
  return new Date(tarih.getTime() - YENI_ILAN_MS);
}

export function panelTazeSinir(tarih = new Date()): Date {
  return new Date(tarih.getTime() - PANEL_TAZELIK_MS);
}

/**
 * Panel / plan varsayılan: son 6 saat + arşiv/elenmiş değil.
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
 * 6 saattir görülmeyen ilanları siler.
 * Eşik sonGorulme: aynı yük tekrar düşerse süre yenilenir.
 * Yüke dönmüş ve alınmış kayıtlar kalır.
 */
export async function eskiIlanlariArsivle(): Promise<number> {
  const sinir = new Date(Date.now() - ARSIV_DK * 60 * 1000);
  const r = await prisma.yukIlani.deleteMany({
    where: {
      durum: { notIn: ["YUKE_DONDU", "ALINDI"] },
      sonGorulme: { lt: sinir },
    },
  });
  const telsiz = await prisma.yukIlani.deleteMany({
    where: {
      durum: { notIn: ["YUKE_DONDU", "ALINDI"] },
      OR: [{ telefon: null }, { telefon: "" }],
    },
  });
  return r.count + telsiz.count;
}

/** 6 saat kuralında eski ilan geri getirilmez. */
export async function arsivdenCanlandir(): Promise<number> {
  return 0;
}
