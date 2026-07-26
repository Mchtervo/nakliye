import { prisma } from "@/lib/prisma";

const HAFIZA_ANAHTAR = "bot_sohbet_hafiza";
const GUNLUK_ANAHTAR = "bot_gunluk_mesaj";
const MAX_MESAJ = 10;

export type SohbetMesaji = {
  rol: "user" | "assistant";
  metin: string;
};

async function ayarOkuHam(anahtar: string): Promise<string | null> {
  const kayit = await prisma.ayar.findUnique({ where: { anahtar } });
  return kayit?.deger ?? null;
}

async function ayarYazHam(anahtar: string, deger: string): Promise<void> {
  await prisma.ayar.upsert({
    where: { anahtar },
    create: { anahtar, deger },
    update: { deger },
  });
}

/** Son 10 mesaj (FAZ 6). */
export async function sohbetHafizasiOku(): Promise<SohbetMesaji[]> {
  const ham = await ayarOkuHam(HAFIZA_ANAHTAR);
  if (!ham) return [];
  try {
    const dizi = JSON.parse(ham) as SohbetMesaji[];
    if (!Array.isArray(dizi)) return [];
    return dizi
      .filter(
        (m) =>
          m &&
          (m.rol === "user" || m.rol === "assistant") &&
          typeof m.metin === "string"
      )
      .slice(-MAX_MESAJ);
  } catch {
    return [];
  }
}

export async function sohbetHafizasinaEkle(
  kullanici: string,
  asistan: string
): Promise<void> {
  const onceki = await sohbetHafizasiOku();
  const sonraki = [
    ...onceki,
    { rol: "user" as const, metin: kullanici.slice(0, 1500) },
    { rol: "assistant" as const, metin: asistan.slice(0, 2500) },
  ].slice(-MAX_MESAJ);
  await ayarYazHam(HAFIZA_ANAHTAR, JSON.stringify(sonraki));
}

function bugunTr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Günlük bot mesaj kotası. true = gönderilebilir. */
export async function botGunlukLimitMusaitMi(): Promise<{
  musait: boolean;
  adet: number;
  limit: number;
}> {
  const limitHam = Number(process.env.BOT_GUNLUK_MESAJ_LIMIT || "50");
  const limit =
    Number.isFinite(limitHam) && limitHam > 0 ? Math.floor(limitHam) : 50;
  const bugun = bugunTr();
  const ham = await ayarOkuHam(GUNLUK_ANAHTAR);
  let adet = 0;
  if (ham) {
    const [gun, sayi] = ham.split(":");
    if (gun === bugun) adet = Number(sayi) || 0;
  }
  return { musait: adet < limit, adet, limit };
}

export async function botGunlukLimitArtir(): Promise<void> {
  const { adet } = await botGunlukLimitMusaitMi();
  const bugun = bugunTr();
  await ayarYazHam(GUNLUK_ANAHTAR, `${bugun}:${adet + 1}`);
}
