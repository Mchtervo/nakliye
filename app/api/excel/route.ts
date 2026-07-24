import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { ayAraligi } from "@/lib/tarih";
import { kategoriAdi, odemeDurumuAdi } from "@/lib/sabitler";

export const runtime = "nodejs";

function tl(kurus: number): number {
  return kurus / 100;
}

export async function GET(req: Request) {
  // Middleware zaten cookie kontrolü yapıyor; ek güvenlik:
  // (API aynı domain cookie ile gelir)
  const { searchParams } = new URL(req.url);
  const ayHam = searchParams.get("ay");
  const simdi = new Date();
  let yil = simdi.getFullYear();
  let ay = simdi.getMonth() + 1;

  if (ayHam && /^\d{4}-\d{2}$/.test(ayHam)) {
    const [y, a] = ayHam.split("-").map(Number);
    if (a >= 1 && a <= 12) {
      yil = y;
      ay = a;
    }
  }

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

  const oz = wb.addWorksheet("Özet");
  const gelir = yukler.reduce((t, y) => t + y.toplamTutar, 0);
  const gelirNet = yukler.reduce((t, y) => t + y.netTutar, 0);
  const toplananKdv = yukler.reduce((t, y) => t + y.kdvTutar, 0);
  const isletme = giderler.filter((g) => g.kategori !== "DEMIRBAS");
  const demirbas = giderler.filter((g) => g.kategori === "DEMIRBAS");
  const gider = isletme.reduce((t, g) => t + g.toplamTutar, 0);
  const giderNet = isletme.reduce((t, g) => t + g.netTutar, 0);
  const odenenKdv = giderler.reduce((t, g) => t + g.kdvTutar, 0);
  const demirbasToplam = demirbas.reduce((t, g) => t + g.toplamTutar, 0);
  const demirbasKdv = demirbas.reduce((t, g) => t + g.kdvTutar, 0);

  oz.addRows([
    ["Dönem", etiket],
    [],
    ["Gelir (toplam)", tl(gelir)],
    ["Gelir (net)", tl(gelirNet)],
    ["Toplanan KDV", tl(toplananKdv)],
    [],
    ["İşletme gideri (toplam)", tl(gider)],
    ["İşletme gideri (net)", tl(giderNet)],
    ["Demirbaş (gider sayılmaz)", tl(demirbasToplam)],
    ["Demirbaş KDV", tl(demirbasKdv)],
    ["İndirilecek KDV (tümü)", tl(odenenKdv)],
    [],
    ["Net kâr (KDV hariç)", tl(gelirNet - giderNet)],
    ["KDV farkı", tl(toplananKdv - odenenKdv)],
    ["Yük sayısı", yukler.length],
    ["İşletme gider sayısı", isletme.length],
    ["Demirbaş sayısı", demirbas.length],
  ]);
  oz.getColumn(1).width = 32;
  oz.getColumn(2).width = 16;

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nakliye-${etiket}.xlsx"`,
    },
  });
}
