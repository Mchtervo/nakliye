/**
 * OpenAI kredisi bitince kuyruk durur, mesajlar beklemede kalır.
 * Kredi gelince kesinti boyunca kalıcı hataya düşen mesajlar yeniden sıraya alınır.
 */
import { prisma } from "@/lib/prisma";
import { gelenKutusunaEkle } from "@/lib/bildirim/gelenKutusu";

const ANAHTAR = "ai_kredi_bitti";
/** Kredi bittiyken kaç dakikada bir yeniden denenir. */
const YOKLAMA_DK = 15;
/** Kesinti fark edilmeden önce yanan mesajlar için geriye bakış. */
const GERI_SAAT = 3;

type Durum = { bas: string; son: string };

async function oku(): Promise<Durum | null> {
  const k = await prisma.ayar.findUnique({ where: { anahtar: ANAHTAR } });
  try {
    return k?.deger ? (JSON.parse(k.deger) as Durum) : null;
  } catch {
    return null;
  }
}

async function yaz(d: Durum): Promise<void> {
  const deger = JSON.stringify(d);
  await prisma.ayar.upsert({ where: { anahtar: ANAHTAR }, create: { anahtar: ANAHTAR, deger }, update: { deger } });
}

/** Kredi bitti ve son deneme yakın zamanda mı yapıldı (bu tur atlansın)? */
export async function krediBekleniyorMu(simdi = new Date()): Promise<boolean> {
  const d = await oku();
  return Boolean(d && simdi.getTime() - new Date(d.son).getTime() < YOKLAMA_DK * 60_000);
}

export async function krediBittiIsaretle(simdi = new Date()): Promise<void> {
  const d = await oku();
  await yaz({ bas: d?.bas ?? simdi.toISOString(), son: simdi.toISOString() });
  // Bu turda deneme sayacı artan mesajlar hak kaybetmesin
  await prisma.hamMesaj.updateMany({ where: { islendi: false, denemeSayisi: { gt: 0 } }, data: { denemeSayisi: 0 } });
  if (!d) {
    await gelenKutusunaEkle({
      baslik: "OpenAI kredisi bitti — ilan gelmiyor",
      metin:
        "Mesajlar okunuyor ama AI çözemediği için ilan çıkmıyor. Mesajlar kaybolmuyor, beklemede.\n" +
        "Kredi yükleyince 15 dakika içinde kendiliğinden devam eder.",
      url: "https://platform.openai.com/settings/organization/billing/",
    });
  }
}

/** Başarılı AI çağrısından sonra: kesinti bittiyse yanan mesajları geri al. */
export async function krediGeriGeldi(): Promise<number> {
  const d = await oku();
  if (!d) return 0;
  const bas = new Date(new Date(d.bas).getTime() - GERI_SAAT * 3_600_000);
  const r = await prisma.hamMesaj.updateMany({
    where: {
      createdAt: { gte: bas },
      islendi: true,
      OR: [{ hata: { startsWith: "Max deneme" } }, { hata: { contains: "(429)" } }, { hata: { contains: "kredisi bitti" } }],
    },
    data: { islendi: false, denemeSayisi: 0, hata: null },
  });
  await prisma.ayar.delete({ where: { anahtar: ANAHTAR } }).catch(() => null);
  await gelenKutusunaEkle({
    baslik: "AI yeniden çalışıyor",
    metin: `OpenAI kredisi geldi. Kesinti sırasında bekleyen ${r.count} mesaj yeniden sıraya alındı.`,
  });
  return r.count;
}
