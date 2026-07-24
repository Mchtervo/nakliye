import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { kisaId } from "@/lib/sifre";
import { fisBaytOku } from "@/lib/fis";

export const runtime = "nodejs";

export async function GET() {
  const zip = new JSZip();

  const [firmalar, yukler, odemeler, giderler, ayarlar] = await Promise.all([
    prisma.firma.findMany(),
    prisma.yuk.findMany(),
    prisma.odeme.findMany(),
    prisma.gider.findMany(),
    prisma.ayar.findMany(),
  ]);

  zip.file(
    "veri.json",
    JSON.stringify(
      { firmalar, yukler, odemeler, giderler, ayarlar, tarih: new Date().toISOString() },
      null,
      2
    )
  );

  for (const g of giderler) {
    if (!g.fisResmi) continue;
    const okunan = await fisBaytOku(g.fisResmi);
    if (!okunan) continue;
    const ad = `fisler/${g.id}${okunan.uzanti}`;
    zip.file(ad, okunan.veri);
  }

  zip.file(
    "OKU.txt",
    `Nakliye Defteri yedeği (Supabase/Postgres)\nTarih: ${new Date().toLocaleString("tr-TR")}\n\nİçerik:\n- veri.json (tüm kayıtlar)\n- fisler/ (fiş fotoğrafları)\n`
  );

  const icerik = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const ad = `nakliye-yedek-${new Date().toISOString().slice(0, 10)}-${kisaId()}.zip`;

  return new NextResponse(Buffer.from(icerik), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${ad}"`,
    },
  });
}
