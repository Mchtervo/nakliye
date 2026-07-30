import { prisma } from "@/lib/prisma";
import { aiKullanilabilir } from "@/lib/ai/istemci";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { yukIlanlariniBildir } from "@/lib/bildirim/gonder";
import { donusEslesmeleriniTara } from "@/lib/donus";
import { aiAramaAdaptoru } from "@/lib/kaynaklar/aiArama";
import { ilgilileriSuz } from "@/lib/kaynaklar/filtre";
import { ilanlariKaydet, type KaydedilenIlan } from "@/lib/kaynaklar/kaydet";
import type { KaynakAdaptoru } from "@/lib/kaynaklar/tip";
import { webAdaptoru } from "@/lib/kaynaklar/web";

/** Telegram push ile gelir; cron sadece çekilebilir kaynakları tarar. */
const ADAPTORLER: Record<string, KaynakAdaptoru> = {
  WEB: webAdaptoru,
  AI_ARAMA: aiAramaAdaptoru,
};

export type TaramaRaporu = {
  taranan: number;
  yeniIlan: number;
  bildirilen: number;
  hatalar: string[];
  sureMs: number;
};

/**
 * Netlify'ın kısa fonksiyon süresine sığmak için her koşuda
 * en uzun süredir taranmamış birkaç kaynak işlenir (rotasyon).
 */
export async function kaynaklariTara(limit = 2): Promise<TaramaRaporu> {
  const basla = Date.now();
  const rapor: TaramaRaporu = {
    taranan: 0,
    yeniIlan: 0,
    bildirilen: 0,
    hatalar: [],
    sureMs: 0,
  };

  if (!aiKullanilabilir()) {
    rapor.hatalar.push(
      process.env.AI_KAPALI
        ? "AI_KAPALI=true — tarama AI çağrısı yok."
        : "OPENAI_API_KEY tanımlı değil."
    );
    rapor.sureMs = Date.now() - basla;
    return rapor;
  }

  const kaynaklar = await prisma.ilanKaynagi.findMany({
    where: {
      aktif: true,
      tur: { in: Object.keys(ADAPTORLER) },
      // yuklegel ayrı cron ile firma havuzuna gider — genel taramada yok
      NOT: { hedef: { contains: "yuklegel" } },
    },
    orderBy: [{ sonTarama: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    take: Math.max(1, Math.min(limit, 10)),
  });

  const yeniler: KaydedilenIlan[] = [];

  for (const kaynak of kaynaklar) {
    const adaptor = ADAPTORLER[kaynak.tur];
    if (!adaptor) continue;

    rapor.taranan += 1;
    const sonuc = await adaptor.tara({
      id: kaynak.id,
      tur: kaynak.tur,
      ad: kaynak.ad,
      hedef: kaynak.hedef,
    });

    const kaydedilen = sonuc.hata
      ? { yeniler: [] as Awaited<ReturnType<typeof ilanlariKaydet>>["yeniler"], dedupAtlanan: 0 }
      : await ilanlariKaydet(kaynak.id, sonuc.bulunanlar);
    yeniler.push(...kaydedilen.yeniler);

    if (sonuc.hata) rapor.hatalar.push(`${kaynak.ad}: ${sonuc.hata}`);

    await prisma.ilanKaynagi.update({
      where: { id: kaynak.id },
      data: {
        sonTarama: new Date(),
        sonHata: sonuc.hata,
        bulunanAdet: { increment: kaydedilen.yeniler.length },
      },
    });
  }

  // Talep sonradan açılmış olabilir; eski ilanları da eşleştir.
  const { eskiIlanlariArsivle } = await import("@/lib/ilanTazelik");
  await eskiIlanlariArsivle().catch(() => 0);
  const gecEslesenler = await donusEslesmeleriniTara();

  const hepsi = [...yeniler];
  for (const ilan of gecEslesenler) {
    if (!hepsi.some((i) => i.id === ilan.id)) hepsi.push(ilan);
  }
  rapor.yeniIlan = yeniler.length;

  if (hepsi.length > 0) {
    const tercih = await aiTercihleriOku();
    const bildirilecek = ilgilileriSuz(hepsi, tercih);
    if (bildirilecek.length > 0) {
      const bildirim = await yukIlanlariniBildir(bildirilecek);
      rapor.bildirilen = bildirilecek.length;
      rapor.hatalar.push(...bildirim.hatalar);
    }
  }

  rapor.sureMs = Date.now() - basla;
  return rapor;
}
