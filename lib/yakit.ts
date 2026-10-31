/**
 * Yakıt tüketimi — depo-depo yöntemi. Her dolumda göstergedeki km ve litre
 * yazılır; ilk dolumdan sonraki litreler ÷ aradaki km = lt/100 km.
 * Seferlerden hesaplanmaz: her sefer kaydedilmediği için km eksik kalıyor
 * (Ağustos: 195 bin TL yakıt, 0 sefer).
 */
import { prisma } from "@/lib/prisma";

/** Ortalamadan bu oranda fazla tüketim → uyarı */
export const FAZLA_TUKETIM = 1.15;
const SON_DOLUM = 8;

type Dolum = { id: number; tarih: Date; km: number; litre: number | null; tl: number };

export type YakitVerimi = {
  /** Göstergesi yazılmış dolum sayısı (en az 2 gerekir) */
  dolum: number;
  lt100: number | null;
  tlKm: number | null;
  /** Son iki dolum arası */
  sonLt100: number | null;
  sonDolumId: number | null;
  /** Litresi tutardan tahmin edilen dolum var mı */
  tahminli: boolean;
  fazla: boolean;
};

function aralik(liste: Dolum[], litreFiyati: number | null) {
  const ilk = liste[0];
  const son = liste[liste.length - 1];
  const km = son.km - ilk.km;
  if (km <= 0) return null;
  let litre = 0;
  let tl = 0;
  let tahminli = false;
  for (const d of liste.slice(1)) {
    tl += d.tl;
    if (d.litre) litre += d.litre;
    else if (litreFiyati) {
      litre += d.tl / litreFiyati;
      tahminli = true;
    } else return null;
  }
  return { lt100: (litre / km) * 100, tlKm: tl / km, tahminli };
}

export async function yakitVerimi(): Promise<YakitVerimi> {
  const ham = await prisma.gider.findMany({
    where: { kategori: "YAKIT", km: { not: null } },
    orderBy: [{ km: "desc" }],
    take: SON_DOLUM,
    select: { id: true, tarih: true, km: true, litre: true, toplamTutar: true },
  });
  const dolumlar: Dolum[] = ham
    .map((g) => ({ id: g.id, tarih: g.tarih, km: g.km!, litre: g.litre, tl: g.toplamTutar / 100 }))
    .reverse();

  // Litresi olmayan dolum için: litresi yazılmış son dolumların TL/lt ortalaması
  const fiyatli = await prisma.gider.findMany({
    where: { kategori: "YAKIT", litre: { gt: 0 } },
    orderBy: { tarih: "desc" },
    take: 5,
    select: { litre: true, toplamTutar: true },
  });
  const litreFiyati = fiyatli.length
    ? fiyatli.reduce((t, g) => t + g.toplamTutar / 100 / g.litre!, 0) / fiyatli.length
    : null;

  const bos: YakitVerimi = {
    dolum: dolumlar.length,
    lt100: null,
    tlKm: null,
    sonLt100: null,
    sonDolumId: null,
    tahminli: false,
    fazla: false,
  };
  if (dolumlar.length < 2) return bos;
  const genel = aralik(dolumlar, litreFiyati);
  const sonIki = aralik(dolumlar.slice(-2), litreFiyati);
  if (!genel) return bos;
  const yuvarla = (n: number) => Math.round(n * 10) / 10;
  return {
    dolum: dolumlar.length,
    lt100: yuvarla(genel.lt100),
    tlKm: yuvarla(genel.tlKm),
    sonLt100: sonIki ? yuvarla(sonIki.lt100) : null,
    sonDolumId: dolumlar[dolumlar.length - 1].id,
    tahminli: genel.tahminli,
    // Ortalama en az 3 dolumdan çıkmalı; yoksa son aralık ortalamanın kendisi
    fazla: dolumlar.length >= 3 && sonIki !== null && sonIki.lt100 > genel.lt100 * FAZLA_TUKETIM,
  };
}

/**
 * Yakıt fişindeki gösterge km'si araç kaydını günceller (bakım takibi).
 * Daha yeni bir gösterge girişi varsa dokunmaz.
 */
export async function yakittanGostergeYaz(km: number, tarih: Date): Promise<void> {
  const arac = await prisma.arac.findFirst({ orderBy: { id: "asc" } });
  if (!arac) {
    await prisma.arac.create({ data: { kmSayac: km, kmTarih: tarih } });
    return;
  }
  if (arac.kmTarih && arac.kmTarih > tarih) return;
  if (arac.kmSayac != null && km < arac.kmSayac) return;
  await prisma.arac.update({ where: { id: arac.id }, data: { kmSayac: km, kmTarih: tarih } });
}
