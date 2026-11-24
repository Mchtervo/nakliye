/**
 * Nöbetçi: yük boru hattını 10 dakikada bir denetler, sorun görürse telefona bildirir.
 *
 * 22–24.11.2026'da üç ayrı arıza (WhatsApp kuyruğu tıkandı, satır tekrarı 7 gün,
 * AI kuyruğu yetişmedi) günlükte hata bırakmadan "yük gelmiyor"a yol açtı; hiçbiri
 * kendiliğinden fark edilmedi. Bu betik aynı belirtileri sayılarla yakalar.
 *
 * Aynı uyarı 3 saatte bir kez gönderilir. Yapay zekâ çağrısı yapmaz (ücretsiz).
 */
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { tercihKosulu } from "@/lib/kaynaklar/filtre";
import { bilgiBildir } from "@/lib/bildirim/gonder";
import { claudeBugunHarcamaMikro, claudeGunlukLimitUsd } from "@/lib/ai/butce";

const TEKRAR_MS = 3 * 60 * 60 * 1000;
const dk = (n: number) => new Date(Date.now() - n * 60_000);

type Sorun = { kod: string; baslik: string; metin: string };

async function main() {
  const trSaat = new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCHours();
  const gunduz = trSaat >= 8 && trSaat < 21;
  const sorunlar: Sorun[] = [];

  // 1) Okuyucular bağlı mı?
  const nabizlar = await prisma.ayar.findMany({ where: { anahtar: { startsWith: "daemon_nabiz_" } } });
  for (const n of nabizlar) {
    try {
      const j = JSON.parse(n.deger) as { durum?: string; zaman?: string; not?: string };
      const ad = n.anahtar.replace("daemon_nabiz_", "");
      const yas = j.zaman ? (Date.now() - new Date(j.zaman).getTime()) / 60_000 : 999;
      if (ad === "whatsapp" && (yas > 10 || j.durum !== "BAGLI")) {
        sorunlar.push({
          kod: "wa_bagli_degil",
          baslik: "WhatsApp okuyucu bağlı değil",
          metin: `Durum: ${j.durum ?? "?"} (${Math.round(yas)} dk önce). ${j.not ?? ""}`,
        });
      }
    } catch {
      /* bozuk nabız kaydı: atla */
    }
  }

  // 2) Mesaj geliyor mu? (gündüz 30 dk hiç ham mesaj yoksa akış durmuştur)
  const ham30 = await prisma.hamMesaj.count({ where: { createdAt: { gte: dk(30) } } });
  if (gunduz && ham30 === 0) {
    sorunlar.push({
      kod: "akis_durdu",
      baslik: "Gruplardan mesaj gelmiyor",
      metin: "Son 30 dakikada hiç mesaj kuyruğa girmedi. WhatsApp bağlantısı ya da kuyruk takılmış olabilir.",
    });
  }

  // 3) Kuyruk yetişiyor mu?
  const bekleyen = await prisma.hamMesaj.count({ where: { islendi: false } });
  const enEski = await prisma.hamMesaj.findFirst({
    where: { islendi: false },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  const enEskiDk = enEski ? (Date.now() - enEski.createdAt.getTime()) / 60_000 : 0;
  if (gunduz && (bekleyen > 200 || enEskiDk > 40)) {
    sorunlar.push({
      kod: "kuyruk_birikti",
      baslik: "İlan çözümleme geride kaldı",
      metin: `${bekleyen} mesaj bekliyor, en eskisi ${Math.round(enEskiDk)} dakikalık. İlanlar gecikmeli düşüyor.`,
    });
  }

  // 4) Mesaj geliyor ama ilan çıkmıyor mu?
  const ham120 = await prisma.hamMesaj.count({ where: { createdAt: { gte: dk(120) } } });
  const ilan120 = await prisma.yukIlani.count({ where: { createdAt: { gte: dk(120) }, durum: { not: "ELENDI" } } });
  if (gunduz && ham120 >= 150 && ilan120 < 10) {
    sorunlar.push({
      kod: "ilan_cikmiyor",
      baslik: "Mesaj geliyor ama ilan çıkmıyor",
      metin: `Son 2 saatte ${ham120} mesaj işlendi, yalnız ${ilan120} ilan kaydedildi. Bir süzgeç fazla eliyor olabilir.`,
    });
  }

  // 5) Panel boş mu?
  const tercih = await aiTercihleriOku();
  const panel = await prisma.yukIlani.count({
    where: {
      AND: [
        { durum: "YENI" },
        { OR: [{ createdAt: { gte: dk(120) } }, { sonGorulme: { gte: dk(120) } }] },
        { telefon: { not: null } },
        tercihKosulu(tercih, { webDahil: true }),
      ],
    },
  });
  if (gunduz && trSaat >= 9 && trSaat < 19 && panel < 25) {
    sorunlar.push({
      kod: "panel_az",
      baslik: "Panelde yük az",
      metin: `Şu an panelde yalnız ${panel} yük var (hafta içi gündüz 80+ beklenir).`,
    });
  }

  // 6) Yapay zekâ: hata oranı ve günlük tavan
  const [aiToplam, aiHata] = await Promise.all([
    prisma.aiCagri.count({ where: { zaman: { gte: dk(60) } } }),
    prisma.aiCagri.count({ where: { zaman: { gte: dk(60) }, basarili: false } }),
  ]);
  if (aiToplam >= 10 && aiHata / aiToplam > 0.3) {
    const ornek = await prisma.aiCagri.findFirst({
      where: { zaman: { gte: dk(60) }, basarili: false },
      orderBy: { id: "desc" },
      select: { model: true, hata: true },
    });
    sorunlar.push({
      kod: "ai_hata",
      baslik: "Yapay zekâ çağrıları hata veriyor",
      metin: `Son 1 saatte ${aiToplam} çağrının ${aiHata}'i hatalı. Örnek (${ornek?.model}): ${(ornek?.hata || "").slice(0, 140)}`,
    });
  }
  const harcama = (await claudeBugunHarcamaMikro()) / 1e6;
  const tavan = claudeGunlukLimitUsd();
  if (harcama >= tavan) {
    sorunlar.push({
      kod: "ai_tavan",
      baslik: "Claude günlük tavanı doldu",
      metin: `Bugün ${harcama.toFixed(2)} $ harcandı (tavan ${tavan} $). Gün sonuna kadar ücretsiz yapay zekâ ile devam ediliyor.`,
    });
  }

  const ozet = { trSaat, ham30, ham120, ilan120, bekleyen, enEskiDk: Math.round(enEskiDk), panel, aiToplam, aiHata, harcamaUsd: Number(harcama.toFixed(2)) };

  // Aynı uyarıyı 3 saatte bir kez gönder
  const gonderilen: string[] = [];
  for (const s of sorunlar) {
    const anahtar = `nobetci_son:${s.kod}`;
    const son = await prisma.ayar.findUnique({ where: { anahtar } });
    if (son && Date.now() - new Date(son.deger).getTime() < TEKRAR_MS) continue;
    await bilgiBildir(`Nöbetçi: ${s.baslik}`, s.metin, "/ai/yukler").catch((e) =>
      console.warn("[nobetci] bildirim", e instanceof Error ? e.message : e)
    );
    const deger = new Date().toISOString();
    await prisma.ayar.upsert({ where: { anahtar }, create: { anahtar, deger }, update: { deger } });
    gonderilen.push(s.kod);
  }
  // Saatlik iz için son durum saklanır (panel/ayarlar ekranı okuyabilir)
  const durum = JSON.stringify({ zaman: new Date().toISOString(), ...ozet, sorunlar: sorunlar.map((s) => s.kod) });
  await prisma.ayar.upsert({
    where: { anahtar: "nobetci_durum" },
    create: { anahtar: "nobetci_durum", deger: durum },
    update: { deger: durum },
  });
  console.log(JSON.stringify({ ...ozet, sorunlar: sorunlar.map((s) => s.kod), gonderilen }));
}

main()
  .catch((e) => {
    console.error("[nobetci]", e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
