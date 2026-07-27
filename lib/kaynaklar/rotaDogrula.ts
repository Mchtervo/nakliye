/**
 * Rota doğrulama: çıkış + varış aynı satırda olmalı.
 * Farklı satırlardan "Kırıkkale + Bolu" birleştirmeyi keser.
 */
import { ilBul, illeriBul, sadelestir } from "@/lib/iller";
import { rotaSatiriMi, satirlaraBol } from "@/lib/kaynaklar/onFiltre";

const KACIS = /[.*+?^${}()|[\]\\]/g;

function yerSatirda(yer: string, satir: string): boolean {
  const sadeYer = sadelestir(yer);
  const sadeSatir = sadelestir(satir);
  if (!sadeYer || !sadeSatir) return false;
  if (new RegExp(`(^|\\s)${sadeYer.replace(KACIS, "\\$&")}`).test(sadeSatir)) {
    return true;
  }
  const il = ilBul(yer);
  return il !== null && illeriBul(satir).includes(il);
}

/**
 * Çıkış ve varış aynı satırda geçiyor mu?
 * Ortak çıkış listeleri ("ANKARA'DAN:" + "BOLU 900") için istisna:
 * varış satırında tek il vardır, çıkış yalnızca bağlam satırındadır.
 */
export function rotaAyniSatirdaMi(
  nereden: string | null,
  nereye: string | null,
  hamMetin: string
): boolean {
  if (!nereden || !nereye) return false;

  const satirlar = satirlaraBol(hamMetin);
  if (satirlar.length === 0) {
    return yerSatirda(nereden, hamMetin) && yerSatirda(nereye, hamMetin);
  }

  for (const satir of satirlar) {
    if (yerSatirda(nereden, satir) && yerSatirda(nereye, satir)) {
      return true;
    }
  }

  // Ortak çıkış: bağlamda çıkış, rota satırında yalnızca varış (başka çıkış ili yok)
  const baglam = satirlar.filter((s) => !rotaSatiriMi(s)).join("\n");
  const cIl = ilBul(nereden);
  const vIl = ilBul(nereye);
  if (!cIl || !vIl || cIl === vIl) return false;
  if (!yerSatirda(nereden, baglam) && !illeriBul(baglam).includes(cIl)) {
    return false;
  }

  for (const satir of satirlar) {
    if (!rotaSatiriMi(satir)) continue;
    if (!yerSatirda(nereye, satir) && !illeriBul(satir).includes(vIl)) {
      continue;
    }
    if (yerSatirda(nereden, satir) || illeriBul(satir).includes(cIl)) {
      return true;
    }
    const baska = illeriBul(satir).filter((il) => il !== vIl && il !== cIl);
    if (baska.length === 0) return true;
  }

  return false;
}

/** Rota satırını bul (fiyat / araç kontrolü için). */
export function rotaSatiriniBul(
  nereden: string | null,
  nereye: string | null,
  hamMetin: string
): string | null {
  if (!nereden || !nereye) return null;
  const satirlar = satirlaraBol(hamMetin);
  for (const satir of satirlar) {
    if (yerSatirda(nereden, satir) && yerSatirda(nereye, satir)) return satir;
  }
  const vIl = ilBul(nereye);
  for (const satir of satirlar) {
    if (!rotaSatiriMi(satir)) continue;
    if (
      (vIl && illeriBul(satir).includes(vIl)) ||
      yerSatirda(nereye, satir)
    ) {
      return satir;
    }
  }
  return null;
}
