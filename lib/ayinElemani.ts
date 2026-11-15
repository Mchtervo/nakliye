/**
 * Ayın elemanı: biten ayda en çok kâr eden şoför (eşitlikte cirosu yüksek olan).
 * En az iki tır olmalı ve kazananın o ay en az bir seferi olmalı.
 * Sonuç hesabın kendi defterinde (Ayar) saklanır; ayın ilk günü telefona bildirilir,
 * uygulamaya giren her telefonda bir kez kutlama oynar, ilk 7 gün rozet görünür.
 */
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { gelenKutusunaEkle } from "@/lib/bildirim/gelenKutusu";
import { pushGonder, pushKullanilabilir } from "@/lib/bildirim/push";
import { ayAraligi } from "@/lib/tarih";
import { tirHesabi } from "@/lib/tirHesap";
import { tirBazliOzet } from "@/lib/tirOzet";

const ANAHTAR = "ayin_elemani";
const BILDIRIM_ANAHTAR = "ayin_elemani_bildirim";
export const ROZET_GUN = 7;

export type AyinElemani = {
  /** Kazanılan ay: "2026-10" */
  ay: string;
  /** "Ekim" */
  ayAdi: string;
  aracId: number;
  ad: string;
  plaka: string | null;
  foto: string | null;
  kar: number;
  ciro: number;
  sefer: number;
  /** Ayın ilk 7 günü: şoförün satırında rozet */
  rozet: boolean;
};

type Kayit = { ay: string; aracId: number | null; kar: number; ciro: number; sefer: number };

function trBugun(): { yil: number; ay: number; gun: number; saat: number } {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return { yil: tr.getUTCFullYear(), ay: tr.getUTCMonth() + 1, gun: tr.getUTCDate(), saat: tr.getUTCHours() };
}

function oncekiAy(): { yil: number; ay: number; anahtar: string } {
  const b = trBugun();
  const yil = b.ay === 1 ? b.yil - 1 : b.yil;
  const ay = b.ay === 1 ? 12 : b.ay - 1;
  return { yil, ay, anahtar: `${yil}-${String(ay).padStart(2, "0")}` };
}

async function hesapla(yil: number, ay: number, anahtar: string): Promise<Kayit> {
  const { bas, son } = ayAraligi(yil, ay);
  const tirlar = await tirBazliOzet(bas, son);
  const bos: Kayit = { ay: anahtar, aracId: null, kar: 0, ciro: 0, sefer: 0 };
  if (tirlar.length < 2) return bos;
  const sirali = tirlar
    .filter((t) => t.sefer > 0)
    .map((t) => ({ t, kar: tirHesabi(t).kar }))
    .sort((a, b) => b.kar - a.kar || b.t.gelir - a.t.gelir);
  const ilk = sirali[0];
  if (!ilk || ilk.kar <= 0) return bos;
  return { ay: anahtar, aracId: ilk.t.id, kar: ilk.kar, ciro: ilk.t.gelir, sefer: ilk.t.sefer };
}

/** Biten ayın kazananı (ilk çağrıda hesaplanıp saklanır). Kazanan yoksa null. */
export async function ayinElemaniOku(): Promise<AyinElemani | null> {
  const { yil, ay, anahtar } = oncekiAy();
  const satir = await prisma.ayar.findUnique({ where: { anahtar: ANAHTAR } });
  let kayit: Kayit | null = null;
  try {
    const j = satir?.deger ? (JSON.parse(satir.deger) as Kayit) : null;
    if (j?.ay === anahtar) kayit = j;
  } catch {
    kayit = null;
  }
  if (!kayit) {
    kayit = await hesapla(yil, ay, anahtar);
    const deger = JSON.stringify(kayit);
    await prisma.ayar.upsert({ where: { anahtar: ANAHTAR }, update: { deger }, create: { anahtar: ANAHTAR, deger } });
  }
  if (kayit.aracId === null) return null;
  // Ad ve fotoğraf güncel hâliyle (sonradan fotoğraf eklenmiş olabilir)
  const arac = await prisma.arac.findUnique({ where: { id: kayit.aracId }, select: { ad: true, plaka: true, sofor: true, soforFoto: true } });
  if (!arac) return null;
  return {
    ay: anahtar,
    ayAdi: new Intl.DateTimeFormat("tr-TR", { month: "long" }).format(new Date(yil, ay - 1, 1)),
    aracId: kayit.aracId,
    ad: arac.sofor || arac.plaka || arac.ad,
    plaka: arac.sofor ? arac.plaka : null,
    foto: arac.soforFoto,
    kar: kayit.kar,
    ciro: kayit.ciro,
    sefer: kayit.sefer,
    rozet: trBugun().gun <= ROZET_GUN,
  };
}

/** Zamanlanmış görev: ayın ilk 3 günü, 09:00'dan sonra bir kez "Ayın elemanı belli oldu" bildirimi. */
export async function ayinElemaniBildir(): Promise<boolean> {
  const b = trBugun();
  if (b.gun > 3 || b.saat < 9 || b.saat >= 22) return false;
  const { anahtar } = oncekiAy();
  const son = await prisma.ayar.findUnique({ where: { anahtar: BILDIRIM_ANAHTAR } });
  if (son?.deger === anahtar) return false;
  await prisma.ayar.upsert({ where: { anahtar: BILDIRIM_ANAHTAR }, update: { deger: anahtar }, create: { anahtar: BILDIRIM_ANAHTAR, deger: anahtar } });
  const k = await ayinElemaniOku();
  if (!k) return false;
  const baslik = `🏆 ${k.ayAdi} ayının elemanı belli oldu!`;
  const metin = "Kim kazandı? Görmek için dokun 🎉";
  const url = "/?kutlama=1";
  const tercih = await aiTercihleriOku();
  if (tercih.pushAcik && pushKullanilabilir()) await pushGonder({ baslik, metin, url });
  else await gelenKutusunaEkle({ baslik, metin, url });
  return true;
}
