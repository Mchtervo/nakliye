import { prisma } from "@/lib/prisma";
import { butceKesildiMi, bugunHarcamaMikro, trGunBaslangici } from "@/lib/ai/butce";
import { gunlukButceUsd, mikrodolarYaz } from "@/lib/ai/maliyet";
import { aiKapaliMi } from "@/lib/ai/istemci";
import { AI_MAX_CIKTI, AI_ZAMAN_ASIMI_MS } from "@/lib/ai/modeller";

export type MaliyetDilimi = {
  etiket: string;
  cagri: number;
  basarili: number;
  girdiToken: number;
  ciktiToken: number;
  reasoningToken: number;
  maliyetMikro: number;
  maliyetYazi: string;
};

export type SonCagriOzet = {
  zamanYazi: string;
  kaynak: string;
  model: string;
  girdiToken: number;
  ciktiToken: number;
  reasoningToken: number;
  maliyetYazi: string;
  basarili: boolean;
  kesildi: boolean;
};

export type AiMaliyetOzeti = {
  killSwitch: boolean;
  butceKesildi: boolean;
  limitUsd: number;
  limitYazi: string;
  bugunMikro: number;
  bugunYazi: string;
  kalanYazi: string;
  maxCikti: number;
  zamanAsimiMs: number;
  /** Bugün max_output_tokens / length kesilmesi */
  kesilmeSayisi: number;
  saatlik: MaliyetDilimi[];
  gunluk: MaliyetDilimi;
  sonCagrilar: SonCagriOzet[];
};

function dilimBos(etiket: string): MaliyetDilimi {
  return {
    etiket,
    cagri: 0,
    basarili: 0,
    girdiToken: 0,
    ciktiToken: 0,
    reasoningToken: 0,
    maliyetMikro: 0,
    maliyetYazi: "$0.00",
  };
}

function trSaatAnahtar(tarih: Date): string {
  // Europe/Istanbul yuvarlanmış saat etiketi: "25.07 14:00"
  const parca = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(tarih);
  const al = (tip: string) => parca.find((p) => p.type === tip)?.value || "00";
  return `${al("day")}.${al("month")} ${al("hour")}:00`;
}

/** Ayarlar paneli ve test modu için maliyet özeti. */
export async function aiMaliyetOzeti(): Promise<AiMaliyetOzeti> {
  const gunBas = trGunBaslangici();
  const saatBas = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [bugunMikro, butceKesildi, cagrilar, sonHam, kesilmeSayisi] =
    await Promise.all([
      bugunHarcamaMikro(),
      butceKesildiMi(),
      prisma.aiCagri.findMany({
        where: { zaman: { gte: saatBas } },
        select: {
          zaman: true,
          girdiToken: true,
          ciktiToken: true,
          reasoningToken: true,
          maliyetMikro: true,
          basarili: true,
        },
        orderBy: { zaman: "asc" },
      }),
      prisma.aiCagri.findMany({
        orderBy: { zaman: "desc" },
        take: 8,
        select: {
          zaman: true,
          kaynak: true,
          model: true,
          girdiToken: true,
          ciktiToken: true,
          reasoningToken: true,
          maliyetMikro: true,
          basarili: true,
          hata: true,
        },
      }),
      prisma.aiCagri.count({
        where: { zaman: { gte: gunBas }, hata: { startsWith: "KESILDI" } },
      }),
    ]);

  const limitUsd = gunlukButceUsd();
  const limitMikro = Math.round(limitUsd * 1_000_000);
  const kalanMikro = Math.max(0, limitMikro - bugunMikro);

  const gunluk = dilimBos("Bugün");
  const saatMap = new Map<string, MaliyetDilimi>();

  for (const c of cagrilar) {
    const gunIci = c.zaman >= gunBas;
    if (gunIci) {
      gunluk.cagri += 1;
      if (c.basarili) gunluk.basarili += 1;
      gunluk.girdiToken += c.girdiToken;
      gunluk.ciktiToken += c.ciktiToken;
      gunluk.reasoningToken += c.reasoningToken;
      gunluk.maliyetMikro += c.maliyetMikro;
    }

    const anahtar = trSaatAnahtar(c.zaman);
    const dilim = saatMap.get(anahtar) ?? dilimBos(anahtar);
    dilim.cagri += 1;
    if (c.basarili) dilim.basarili += 1;
    dilim.girdiToken += c.girdiToken;
    dilim.ciktiToken += c.ciktiToken;
    dilim.reasoningToken += c.reasoningToken;
    dilim.maliyetMikro += c.maliyetMikro;
    saatMap.set(anahtar, dilim);
  }

  gunluk.maliyetYazi = mikrodolarYaz(gunluk.maliyetMikro);
  const saatlik = [...saatMap.values()]
    .map((d) => ({ ...d, maliyetYazi: mikrodolarYaz(d.maliyetMikro) }))
    .slice(-12);

  const zamanFmt = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const sonCagrilar: SonCagriOzet[] = sonHam.map((c) => ({
    zamanYazi: zamanFmt.format(c.zaman),
    kaynak: c.kaynak,
    model: c.model,
    girdiToken: c.girdiToken,
    ciktiToken: c.ciktiToken,
    reasoningToken: c.reasoningToken,
    maliyetYazi: mikrodolarYaz(c.maliyetMikro),
    basarili: c.basarili,
    kesildi: (c.hata || "").startsWith("KESILDI"),
  }));

  return {
    killSwitch: aiKapaliMi(),
    butceKesildi,
    limitUsd,
    limitYazi: `$${limitUsd.toFixed(2)}`,
    bugunMikro,
    bugunYazi: mikrodolarYaz(bugunMikro),
    kalanYazi: mikrodolarYaz(kalanMikro),
    maxCikti: AI_MAX_CIKTI,
    zamanAsimiMs: AI_ZAMAN_ASIMI_MS,
    kesilmeSayisi,
    saatlik,
    gunluk,
    sonCagrilar,
  };
}
