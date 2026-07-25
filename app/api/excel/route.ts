import { NextResponse } from "next/server";
import { aylikExcelUret } from "@/lib/excelRapor";

export const runtime = "nodejs";

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

  const { dosya, ozet } = await aylikExcelUret(yil, ay);

  return new NextResponse(dosya, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nakliye-${ozet.etiket}.xlsx"`,
    },
  });
}
