import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { ayAraligi } from "@/lib/tarih";
import { demirbasMi, kategoriAdi, odemeDurumuAdi } from "@/lib/sabitler";

function tl(kurus: number): number {
  return kurus / 100;
}

export type AylikOzet = {
  etiket: string;
  gelir: number;
  gelirNet: number;
  hesaplananKdv: number;
  gider: number;
  giderNet: number;
  indirilecekKdv: number;
  demirbasToplam: number;
  demirbasKdv: number;
  netKar: number;
  odenecekKdv: number;
  devredenKdv: number;
  yukSayisi: number;
  giderSayisi: number;
  demirbasSayisi: number;
  kategoriler: { ad: string; toplam: number; kdv: number; adet: number }[];
};

export type AylikRapor = {
  dosya: Uint8Array<ArrayBuffer>;
  ozet: AylikOzet;
};

/** Aylık yük + gider + özet çalışma kitabını üretir. */
export async function aylikExcelUret(
  yil: number,
  ay: number
): Promise<AylikRapor> {
  const { bas, son } = ayAraligi(yil, ay);
  const etiket = `${yil}-${String(ay).padStart(2, "0")}`;

  const [yukler, giderler] = await Promise.all([
    prisma.yuk.findMany({
      where: { tarih: { gte: bas, lt: son } },
      include: { firma: true, odemeler: true },
      orderBy: { tarih: "asc" },
    }),
    prisma.gider.findMany({
      where: { tarih: { gte: bas, lt: son } },
      orderBy: { tarih: "asc" },
    }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Nakliye Defteri";
  wb.created = new Date();

  const ys = wb.addWorksheet("Yükler");
  ys.columns = [
    { header: "Tarih", key: "tarih", width: 12 },
    { header: "Firma", key: "firma", width: 22 },
    { header: "Nereden", key: "nereden", width: 14 },
    { header: "Nereye", key: "nereye", width: 14 },
    { header: "Açıklama", key: "aciklama", width: 24 },
    { header: "Net", key: "net", width: 12 },
    { header: "KDV", key: "kdv", width: 12 },
    { header: "Toplam", key: "toplam", width: 12 },
    { header: "Ödeme", key: "odeme", width: 14 },
  ];
  ys.getRow(1).font = { bold: true };

  for (const y of yukler) {
    ys.addRow({
      tarih: y.tarih.toLocaleDateString("tr-TR"),
      firma: y.firma.ad,
      nereden: y.nereden,
      nereye: y.nereye,
      aciklama: y.aciklama || "",
      net: tl(y.netTutar),
      kdv: tl(y.kdvTutar),
      toplam: tl(y.toplamTutar),
      odeme: odemeDurumuAdi(y.odemeDurumu),
    });
  }

  const gs = wb.addWorksheet("Giderler");
  gs.columns = [
    { header: "Tarih", key: "tarih", width: 12 },
    { header: "Kategori", key: "kategori", width: 18 },
    { header: "Açıklama", key: "aciklama", width: 24 },
    { header: "Net", key: "net", width: 12 },
    { header: "KDV", key: "kdv", width: 12 },
    { header: "Toplam", key: "toplam", width: 12 },
    { header: "Litre", key: "litre", width: 10 },
    { header: "Km", key: "km", width: 10 },
    { header: "Fiş", key: "fis", width: 10 },
  ];
  gs.getRow(1).font = { bold: true };

  for (const g of giderler) {
    gs.addRow({
      tarih: g.tarih.toLocaleDateString("tr-TR"),
      kategori: kategoriAdi(g.kategori),
      aciklama: g.aciklama || "",
      net: tl(g.netTutar),
      kdv: tl(g.kdvTutar),
      toplam: tl(g.toplamTutar),
      litre: g.litre ?? "",
      km: g.km ?? "",
      fis: g.fisResmi ? "Var" : "Yok",
    });
  }

  const isletme = giderler.filter((g) => !demirbasMi(g.kategori));
  const demirbas = giderler.filter((g) => demirbasMi(g.kategori));

  const hesaplananKdv = yukler.reduce((t, y) => t + y.kdvTutar, 0);
  const indirilecekKdv = giderler.reduce((t, g) => t + g.kdvTutar, 0);
  const gelirNet = yukler.reduce((t, y) => t + y.netTutar, 0);
  const giderNet = isletme.reduce((t, g) => t + g.netTutar, 0);
  const kdvFarki = hesaplananKdv - indirilecekKdv;

  const katMap = new Map<string, { toplam: number; kdv: number; adet: number }>();
  for (const g of giderler) {
    const ad = kategoriAdi(g.kategori);
    const mevcut = katMap.get(ad) || { toplam: 0, kdv: 0, adet: 0 };
    mevcut.toplam += g.toplamTutar;
    mevcut.kdv += g.kdvTutar;
    mevcut.adet += 1;
    katMap.set(ad, mevcut);
  }

  const ozet: AylikOzet = {
    etiket,
    gelir: yukler.reduce((t, y) => t + y.toplamTutar, 0),
    gelirNet,
    hesaplananKdv,
    gider: isletme.reduce((t, g) => t + g.toplamTutar, 0),
    giderNet,
    indirilecekKdv,
    demirbasToplam: demirbas.reduce((t, g) => t + g.toplamTutar, 0),
    demirbasKdv: demirbas.reduce((t, g) => t + g.kdvTutar, 0),
    netKar: gelirNet - giderNet,
    odenecekKdv: Math.max(0, kdvFarki),
    devredenKdv: Math.max(0, -kdvFarki),
    yukSayisi: yukler.length,
    giderSayisi: isletme.length,
    demirbasSayisi: demirbas.length,
    kategoriler: [...katMap.entries()]
      .map(([ad, v]) => ({ ad, ...v }))
      .sort((a, b) => b.toplam - a.toplam),
  };

  const oz = wb.addWorksheet("Özet");
  oz.addRows([
    ["Dönem", etiket],
    [],
    ["Gelir (toplam)", tl(ozet.gelir)],
    ["Gelir (net)", tl(ozet.gelirNet)],
    ["Hesaplanan KDV (yükler)", tl(ozet.hesaplananKdv)],
    [],
    ["İşletme gideri (toplam)", tl(ozet.gider)],
    ["İşletme gideri (net)", tl(ozet.giderNet)],
    ["Demirbaş (gider sayılmaz)", tl(ozet.demirbasToplam)],
    ["Demirbaş KDV", tl(ozet.demirbasKdv)],
    ["İndirilecek KDV (tüm giderler)", tl(ozet.indirilecekKdv)],
    [],
    ["Net kâr (KDV hariç)", tl(ozet.netKar)],
    ["Ödenecek KDV (hesaplanan − indirilecek)", tl(ozet.odenecekKdv)],
    ["Sonraki aya devreden KDV", tl(ozet.devredenKdv)],
    ["Yük sayısı", ozet.yukSayisi],
    ["İşletme gider sayısı", ozet.giderSayisi],
    ["Demirbaş sayısı", ozet.demirbasSayisi],
  ]);
  oz.getColumn(1).width = 34;
  oz.getColumn(2).width = 16;

  const buffer = await wb.xlsx.writeBuffer();
  return { dosya: new Uint8Array(buffer as ArrayBuffer), ozet };
}
