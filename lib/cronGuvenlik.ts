/**
 * Cron ve webhook uçları oturum çerezi kullanamaz; paylaşılan
 * gizli anahtarla doğrulanır.
 */
export function cronAnahtariGecerliMi(request: Request): boolean {
  const beklenen = process.env.AI_CRON_SECRET;
  if (!beklenen) return false;

  const baslik = request.headers.get("authorization");
  if (baslik === `Bearer ${beklenen}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("anahtar") === beklenen;
}

export function cronAnahtariVarMi(): boolean {
  return Boolean(process.env.AI_CRON_SECRET);
}

/** Uygun değilse hazır yanıt, uygunsa null döner. */
export function cronKontrol(request: Request): Response | null {
  if (!cronAnahtariVarMi()) {
    return Response.json(
      { hata: "AI_CRON_SECRET tanımlı değil." },
      { status: 503 }
    );
  }
  if (!cronAnahtariGecerliMi(request)) {
    return Response.json({ hata: "Yetkisiz." }, { status: 401 });
  }
  return null;
}
