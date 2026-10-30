/** Sunucudaki uygulama sürümü. Açık sekme kendi sürümüyle karşılaştırır. */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { surum: process.env.UYGULAMA_SURUM ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
