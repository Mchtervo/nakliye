import { cronKontrol } from "@/lib/cronGuvenlik";
import { mesajlariKuyrugaAl, type GelenGrup } from "@/lib/kaynaklar/telegramUye";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Govde = { gruplar?: unknown };

function gruplariAyikla(govde: Govde): GelenGrup[] {
  if (!Array.isArray(govde.gruplar)) return [];

  const gruplar: GelenGrup[] = [];
  for (const ham of govde.gruplar) {
    if (!ham || typeof ham !== "object") continue;
    const kayit = ham as Record<string, unknown>;
    const id = Number(kayit.id);
    if (!Number.isInteger(id) || id <= 0) continue;

    const mesajlar = Array.isArray(kayit.mesajlar) ? kayit.mesajlar : [];
    gruplar.push({
      id,
      sonMesajId: Number.isFinite(Number(kayit.sonMesajId))
        ? Number(kayit.sonMesajId)
        : null,
      hata: typeof kayit.hata === "string" ? kayit.hata : null,
      mesajlar: mesajlar
        .map((m) => {
          const mesaj = (m ?? {}) as Record<string, unknown>;
          const metin = typeof mesaj.metin === "string" ? mesaj.metin : "";
          const mesajId = Number(mesaj.mesajId);
          return {
            metin,
            mesajId: Number.isInteger(mesajId) ? mesajId : null,
          };
        })
        .filter((m) => m.metin.trim().length > 0),
    });
  }
  return gruplar;
}

/** Gruplardan okunan ham mesajları kuyruğa yazar. AI burada çalışmaz. */
export async function POST(request: Request) {
  const engel = cronKontrol(request);
  if (engel) return engel;

  let govde: Govde;
  try {
    govde = (await request.json()) as Govde;
  } catch {
    return Response.json({ hata: "Geçersiz gövde." }, { status: 400 });
  }

  try {
    const rapor = await mesajlariKuyrugaAl(gruplariAyikla(govde));
    return Response.json(rapor);
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Mesajlar alınamadı.";
    console.error("[telegram-uye-mesajlar]", mesaj);
    return Response.json({ hata: mesaj }, { status: 500 });
  }
}
