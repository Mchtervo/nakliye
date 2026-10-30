import { gelenKutusu, okunduYap } from "@/lib/bildirim/gelenKutusu";

export const dynamic = "force-dynamic";

/** Üst bardaki zil: son bildirimler + okunmamış sayısı. */
export async function GET() {
  const { liste, okunmamis } = await gelenKutusu();
  return Response.json(
    {
      okunmamis,
      liste: liste.map((b) => ({
        id: b.id,
        baslik: b.baslik,
        metin: b.metin,
        url: b.url,
        butonlar: Array.isArray(b.butonlar) ? b.butonlar : [],
        okundu: b.okundu !== null,
        zaman: b.createdAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Gövde { id } → o bildirim; boş → hepsi okundu. */
export async function POST(request: Request) {
  const govde = (await request.json().catch(() => ({}))) as { id?: number };
  const id = Number(govde.id);
  await okunduYap(Number.isInteger(id) && id > 0 ? id : undefined);
  return Response.json({ ok: true });
}
