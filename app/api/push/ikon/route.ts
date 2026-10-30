import { aboneIkonuEskiMi } from "@/lib/bildirim/ikonGuncelleme";

export const dynamic = "force-dynamic";

/** Bu cihazın ana ekran simgesi eski mi? (gövde: { endpoint }) */
export async function POST(request: Request) {
  const govde = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (!govde.endpoint) return Response.json({ eski: false });
  return Response.json({ eski: await aboneIkonuEskiMi(govde.endpoint) });
}
