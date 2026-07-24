import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";
import { kategoriAdi } from "@/lib/sabitler";
import { tarihYaz } from "@/lib/para";
import { fisBaytOku } from "@/lib/fis";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let ids: number[] = [];
  try {
    const govde = await req.json();
    if (!Array.isArray(govde?.ids)) {
      return NextResponse.json({ hata: "Geçersiz istek." }, { status: 400 });
    }
    ids = govde.ids
      .map((x: unknown) => Number(x))
      .filter((x: number) => Number.isInteger(x) && x > 0);
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

  for (const g of giderler) {
    if (!g.fisResmi) continue;
    const okunan = await fisBaytOku(g.fisResmi);
    if (!okunan) continue;
    const ad = `${tarihYaz(g.tarih).replace(/\./g, "-")}_${kategoriAdi(g.kategori)}_${g.id}${okunan.uzanti}`;
    zip.file(ad, okunan.veri);
  }

  const icerik = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  if (icerik.length === 0) {
    return NextResponse.json({ hata: "ZIP'e eklenecek dosya bulunamadı." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(icerik), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="fisler.zip"`,
    },
  });
}
