/**
 * Sefer kilometresi ve araç km takibi.
 * Mesafe il merkezleri arası tahmindir (kuş uçuşu × 1.3, lib/ilMesafe):
 * aynı il içindeki sefer 0 sayılır; sefer formunda km elle düzeltilebilir.
 * Toplam km = yüklü km + boş km (önceki seferin bittiği il → bu seferin çıkışı).
 */
import { prisma } from "@/lib/prisma";
import { yaklasikKarayoluKm } from "@/lib/ilMesafe";
import { seferIl, seferKmTahmini } from "@/lib/seferYer";

export { seferIl, seferKmTahmini };

export type SeferKm = {
  id: number;
  tarih: Date;
  yukluKm: number | null;
  bosKm: number;
  elle: boolean;
};

/** Tüm seferler tarih sırasıyla: yüklü km (elle ya da tahmin) + öncesindeki boş km. */
export async function seferKmleri(anaUs: string | null = "Ankara"): Promise<SeferKm[]> {
  const seferler = await prisma.yuk.findMany({
    orderBy: [{ tarih: "asc" }, { id: "asc" }],
    select: { id: true, tarih: true, nereden: true, nereye: true, km: true },
  });
  let oncekiVaris: string | null = null;
  return seferler.map((s) => {
    const cikis = seferIl(s.nereden, anaUs);
    const bosKm =
      oncekiVaris && cikis && oncekiVaris !== cikis ? yaklasikKarayoluKm(oncekiVaris, cikis) ?? 0 : 0;
    oncekiVaris = seferIl(s.nereye, anaUs) ?? oncekiVaris;
    return {
      id: s.id,
      tarih: s.tarih,
      yukluKm: s.km ?? seferKmTahmini(s.nereden, s.nereye, anaUs),
      bosKm,
      elle: s.km !== null,
    };
  });
}

function topla(liste: SeferKm[]) {
  const yuklu = liste.reduce((t, s) => t + (s.yukluKm ?? 0), 0);
  const bos = liste.reduce((t, s) => t + s.bosKm, 0);
  return { yuklu, bos, toplam: yuklu + bos };
}

export type KmOzeti = {
  buAy: { yuklu: number; bos: number; toplam: number };
  hepsi: { yuklu: number; bos: number; toplam: number };
  bilinmeyenSefer: number;
  arac: {
    id: number;
    kmSayac: number | null;
    kmTarih: Date | null;
    bakimAralikKm: number | null;
    sonBakimKm: number | null;
    bakimUyari: number;
  } | null;
  /** Gösterge + sayaç girildikten SONRAKİ günlerin seferleri */
  tahminiSayac: number | null;
  sonrakiBakimKm: number | null;
  bakimaKalan: number | null;
};

export async function kmOzeti(simdi = new Date(), anaUs: string | null = "Ankara"): Promise<KmOzeti> {
  const [liste, arac] = await Promise.all([seferKmleri(anaUs), prisma.arac.findFirst({ orderBy: { id: "asc" } })]);
  const ayBasi = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
  const buAy = topla(liste.filter((s) => s.tarih >= ayBasi));
  const hepsi = topla(liste);

  let tahminiSayac: number | null = null;
  if (arac?.kmSayac != null) {
    // Sayacın girildiği gün ve öncesi göstergeye dahil sayılır
    const gunSonu = arac.kmTarih ? new Date(arac.kmTarih) : simdi;
    gunSonu.setHours(23, 59, 59, 999);
    tahminiSayac = arac.kmSayac + topla(liste.filter((s) => s.tarih > gunSonu)).toplam;
  }
  const sonrakiBakimKm =
    arac?.sonBakimKm != null && arac.bakimAralikKm ? arac.sonBakimKm + arac.bakimAralikKm : null;
  const bakimaKalan =
    sonrakiBakimKm != null && tahminiSayac != null ? sonrakiBakimKm - tahminiSayac : null;

  return {
    buAy,
    hepsi,
    bilinmeyenSefer: liste.filter((s) => s.yukluKm === null).length,
    arac,
    tahminiSayac,
    sonrakiBakimKm,
    bakimaKalan,
  };
}
