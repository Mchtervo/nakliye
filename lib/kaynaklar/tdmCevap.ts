/**
 * DM cevabından fiyat/tonaj/tarih/adres — AI (nano) + regex yedek.
 */
import { aiJson } from "@/lib/ai/istemci";
import { MODEL_HIZLI } from "@/lib/ai/modeller";
import { guvenliKirp } from "@/lib/metin";

const CEVAP_SEMASI: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "tonaj",
    "ucretTl",
    "ucretTuru",
    "yuklemeTarihi",
    "yuklemeSaati",
    "adres",
    "ozet",
  ],
  properties: {
    tonaj: {
      type: ["number", "null"],
      description: "Ton cinsinden yük ağırlığı. Yoksa null.",
    },
    ucretTl: {
      type: ["number", "null"],
      description: "Navlun TL (sade sayı). Yoksa null.",
    },
    ucretTuru: {
      type: "string",
      enum: ["TON_BASI", "KOMPLE", "BELIRSIZ"],
    },
    yuklemeTarihi: {
      type: ["string", "null"],
      description: "YYYY-MM-DD. 'yarın' → hesapla. Yoksa null.",
    },
    yuklemeSaati: {
      type: ["string", "null"],
      description: "HH:MM veya 'sabah'. Yoksa null.",
    },
    adres: {
      type: ["string", "null"],
      description: "Yükleme/boşaltma adresi kısa. Yoksa null.",
    },
    ozet: {
      type: "string",
      description: "Tek satır özet: ton · fiyat · zaman",
    },
  },
};

export type CevapCozum = {
  tonaj: number | null;
  ucretKurush: number | null;
  fiyatTonKurush: number | null;
  yuklemeTarihi: Date | null;
  yuklemeSaati: string | null;
  adres: string | null;
  ozet: string;
};

function tarihCevir(ham: string | null): Date | null {
  if (!ham || !/^\d{4}-\d{2}-\d{2}$/.test(ham)) return null;
  const t = new Date(`${ham}T00:00:00`);
  return Number.isNaN(t.getTime()) ? null : t;
}

/** Regex yedek (AI kapalı / hata). */
export function cevapParseRegex(metin: string): CevapCozum {
  const sade = metin.toLocaleLowerCase("tr-TR");
  let tonaj: number | null = null;
  const tonM = sade.match(/(\d{1,2})\s*ton/);
  if (tonM) {
    const t = Number(tonM[1]);
    if (t >= 1 && t <= 50) tonaj = t;
  }

  let ucretKurush: number | null = null;
  let fiyatTonKurush: number | null = null;
  const fiyatM = sade.match(
    /(\d{1,3}(?:[.\s]\d{3})+|\d{4,6}|\d{1,2}\s*bin)\s*(?:tl|₺|lira)?/
  );
  if (fiyatM) {
    let ham = fiyatM[1].replace(/\s/g, "");
    if (/bin$/.test(ham)) {
      ham = String(Number(ham.replace(/bin$/, "")) * 1000);
    } else {
      ham = ham.replace(/\./g, "");
    }
    const tl = Number(ham);
    if (Number.isFinite(tl) && tl >= 500 && tl <= 5_000_000) {
      if (/ton|\/ton|kdv/.test(sade) && tl < 8000) {
        fiyatTonKurush = Math.round(tl * 100);
      } else {
        ucretKurush = Math.round(tl * 100);
      }
    }
  }

  let yuklemeTarihi: Date | null = null;
  if (/yarın|yarin/.test(sade)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    yuklemeTarihi = d;
  } else if (/bugün|bugun/.test(sade)) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    yuklemeTarihi = d;
  }

  const saatM = sade.match(/\b(\d{1,2})[:.](\d{2})\b/);
  const yuklemeSaati = saatM
    ? `${saatM[1].padStart(2, "0")}:${saatM[2]}`
    : /sabah/.test(sade)
      ? "sabah"
      : null;

  const parcalar = [
    tonaj ? `${tonaj} ton` : null,
    ucretKurush
      ? `₺${(ucretKurush / 100).toLocaleString("tr-TR")}`
      : fiyatTonKurush
        ? `₺${(fiyatTonKurush / 100).toLocaleString("tr-TR")}/ton`
        : null,
    yuklemeTarihi
      ? yuklemeTarihi.toLocaleDateString("tr-TR")
      : null,
    yuklemeSaati,
  ].filter(Boolean);

  return {
    tonaj,
    ucretKurush,
    fiyatTonKurush,
    yuklemeTarihi,
    yuklemeSaati,
    adres: null,
    ozet: parcalar.length > 0 ? parcalar.join(" · ") : metin.slice(0, 80),
  };
}

export async function cevapAiCozumle(
  metin: string,
  baglam: { rota: string; bugun: string }
): Promise<CevapCozum> {
  try {
    const cikti = await aiJson<{
      tonaj: number | null;
      ucretTl: number | null;
      ucretTuru: "TON_BASI" | "KOMPLE" | "BELIRSIZ";
      yuklemeTarihi: string | null;
      yuklemeSaati: string | null;
      adres: string | null;
      ozet: string;
    }>({
      model: MODEL_HIZLI,
      sistem: `Nakliyeci cevabından tonaj, navlun, yükleme tarihi/saati ve adres çıkar.
Uydurma. Yoksa null. Bugün: ${baglam.bugun}. Rota: ${baglam.rota}.
"yarın" → yarının tarihi. Sadece JSON.`,
      metin: guvenliKirp(metin, 2000),
      semaAdi: "dm_cevap",
      sema: CEVAP_SEMASI,
      caba: "none",
      maxCikti: 400,
      kaynak: "tdm.cevap",
    });

    const tl = cikti.ucretTl;
    let ucretKurush: number | null = null;
    let fiyatTonKurush: number | null = null;
    if (tl !== null && Number.isFinite(tl) && tl > 0) {
      const kurus = Math.round(tl * 100);
      if (cikti.ucretTuru === "TON_BASI") fiyatTonKurush = kurus;
      else if (cikti.ucretTuru === "KOMPLE") ucretKurush = kurus;
      else if (tl < 8000) fiyatTonKurush = kurus;
      else ucretKurush = kurus;
    }

    const tonaj =
      cikti.tonaj !== null &&
      Number.isFinite(cikti.tonaj) &&
      cikti.tonaj >= 1 &&
      cikti.tonaj <= 50
        ? Math.round(cikti.tonaj)
        : null;

    return {
      tonaj,
      ucretKurush,
      fiyatTonKurush,
      yuklemeTarihi: tarihCevir(cikti.yuklemeTarihi),
      yuklemeSaati: cikti.yuklemeSaati?.trim() || null,
      adres: cikti.adres?.trim() || null,
      ozet: (cikti.ozet || "").trim() || cevapParseRegex(metin).ozet,
    };
  } catch {
    return cevapParseRegex(metin);
  }
}

/** Net beklenen kuruş (komple veya ton×tonaj). */
export function netBeklenenKurush(ilan: {
  ucret: number | null;
  fiyatTon: number | null;
  tonaj: number | null;
}): number | null {
  if (ilan.ucret && ilan.ucret > 0) return ilan.ucret;
  if (ilan.fiyatTon && ilan.tonaj && ilan.fiyatTon > 0 && ilan.tonaj > 0) {
    return ilan.fiyatTon * ilan.tonaj;
  }
  return null;
}
