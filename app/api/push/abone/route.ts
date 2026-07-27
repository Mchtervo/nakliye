import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, ayarYaz } from "@/lib/ayarlar";
import { pushAcikAnahtar } from "@/lib/bildirim/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const aboneSayisi = await prisma.pushAbone.count();
  return Response.json({
    acikAnahtar: pushAcikAnahtar(),
    aboneSayisi,
  });
}

type AbonelikGovdesi = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  cihaz?: string;
};

export async function POST(request: Request) {
  let govde: AbonelikGovdesi;
  try {
    govde = (await request.json()) as AbonelikGovdesi;
  } catch {
    return Response.json({ hata: "Geçersiz istek." }, { status: 400 });
  }

  const { endpoint, keys } = govde;
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    return Response.json({ hata: "Abonelik bilgisi eksik." }, { status: 400 });
  }

  await prisma.pushAbone.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      cihaz: govde.cihaz?.slice(0, 120) || null,
    },
    update: { p256dh: keys.p256dh, auth: keys.auth },
  });

  // Cihaz abone olunca tercih de açık olsun — aksi halde gönderim atlanır.
  await ayarYaz(AYAR_ANAHTARLARI.bildirimPush, "1");

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) {
    return Response.json({ hata: "endpoint gerekli." }, { status: 400 });
  }
  await prisma.pushAbone.deleteMany({ where: { endpoint } });
  return Response.json({ ok: true });
}
