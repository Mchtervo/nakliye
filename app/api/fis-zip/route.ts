import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";
import { kategoriAdi } from "@/lib/sabitler";
import { tarihYaz } from "@/lib/para";
import { fisBaytOku } from "@/lib/fis";
import { aylikExcelUret } from "@/lib/excelRapor";
import { ozetSayfasiUret } from "@/lib/ozetSayfasi";

export const runtime = "nodejs";

function ayAdiYaz(yil: number, ay: number): string {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date(yil, ay - 1, 1));
}

export async function POST(req: Request) {
  let ids: number[] = [];
  let ayHam: string | null = null;

  try {
    const govde = await req.json();
    if (!Array.isArray(govde?.ids)) {
      return NextResponse.json({ hata: "Geçersiz istek." }, { status: 400 });
    }
    ids = govde.ids
      .map((x: unknown) => Number(x))
      .filter((x: number) => Number.isInteger(x) && x > 0);
    if (typeof govde.ay === "string" && /^\d{4}-\d{2}$/.test(govde.ay)) {
      ayHam = govde.ay;
    }
  } catch {
    return NextResponse.json({ hata: "Geçersiz istek." }, { status: 400 });
  }

  if (ids.length === 0) {
    return NextResponse.json({ hata: "Fiş seçilmedi." }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json({ hata: "En fazla 100 fiş seçilebilir." }, { status: 400 });
  }

  const giderler = await prisma.gider.findMany({
    where: { id: { in: ids }, fisResmi: { not: null } },
  });

  if (giderler.length === 0) {
    return NextResponse.json({ hata: "Seçilen fişler bulunamadı." }, { status: 404 });
  }

  const zip = new JSZip();
  const fisKlasoru = zip.folder("fisler") ?? zip;
  let eklenenFis = 0;

  for (const g of giderler) {
    if (!g.fisResmi) continue;
    const okunan = await fisBaytOku(g.fisResmi);
    if (!okunan) continue;
    const ad = `${tarihYaz(g.tarih).replace(/\./g, "-")}_${kategoriAdi(g.kategori)}_${g.id}${okunan.uzanti}`;
    fisKlasoru.file(ad, okunan.veri);
    eklenenFis += 1;
  }

  // Ay bilgisi verilmişse muhasebeci için tam paket hazırlanır.
  if (ayHam) {
    const [yil, ay] = ayHam.split("-").map(Number);
    try {
      const { dosya, ozet } = await aylikExcelUret(yil, ay);
      zip.file("giderler.xlsx", dosya);
      zip.file("ozet.html", ozetSayfasiUret(ozet, ayAdiYaz(yil, ay)));
    } catch (hata) {
      // Excel üretilemese bile fişler gitsin.
      console.error("[fis-zip] rapor eklenemedi", hata);
    }
  }

  if (eklenenFis === 0 && !ayHam) {
    return NextResponse.json({ hata: "ZIP'e eklenecek dosya bulunamadı." }, { status: 404 });
  }

  const icerik = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });

  return new NextResponse(Buffer.from(icerik), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${ayHam ? `muhasebe-${ayHam}` : "fisler"}.zip"`,
    },
  });
}
