import { prisma } from "@/lib/prisma";
import { aiMetin } from "@/lib/ai/istemci";
import { MODEL_ANALIZ } from "@/lib/ai/modeller";
import { kdvDonemiHesapla } from "@/lib/kdv";
import { tlYaz } from "@/lib/para";
import { isletmeGideriMi, kategoriAdi } from "@/lib/sabitler";

const SISTEM = `Sen bir Türk nakliyecinin muhasebe ve işletme danışmanısın.
Sana verilen rakamlara bakarak kısa, net ve uygulanabilir bir günlük değerlendirme yaz.

Kurallar:
- Sade Türkçe kullan, muhasebe jargonu kullanma. Karşındaki kişi tır sahibi bir esnaf.
- En fazla 6 madde yaz. Her madde tek cümle olsun.
- Rakamları yorumla; sadece tekrar etme.
- Somut öneri ver: "şu firmayı ara", "şu rota daha kârlı", "şu gider yüksek" gibi.
- Uydurma rakam ekleme, sadece verilenleri kullan.
- Başlık, madde işareti dışında biçimlendirme (markdown, yıldız) kullanma.
- Her maddeye "- " ile başla.`;

export type AnalizMetrikleri = {
  donemAdi: string;
  gelirToplam: number;
  giderToplam: number;
  netKar: number;
  bekleyenAlacak: number;
  kasaBakiye: number;
  odenecekKdv: number;
  yakitGideri: number;
  yakitOran: number;
  enKarliRotalar: { rota: string; ciro: number; sefer: number }[];
  enCokCalisilanFirmalar: { ad: string; ciro: number; sefer: number }[];
  enBuyukGiderler: { ad: string; tutar: number }[];
  geciktiAlacaklar: { firma: string; kalan: number; gun: number }[];
  yeniIlanSayisi: number;
};

export async function metrikleriTopla(): Promise<AnalizMetrikleri> {
  const simdi = new Date();
  const ayBasi = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
  const sonrakiAyBasi = new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1);
  const birGunOnce = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [yukler, giderler, acikYukler, kasa, kdv, yeniIlanSayisi] =
    await Promise.all([
      prisma.yuk.findMany({
        where: { tarih: { gte: ayBasi, lt: sonrakiAyBasi } },
        include: { firma: true },
      }),
      prisma.gider.findMany({
        where: { tarih: { gte: ayBasi, lt: sonrakiAyBasi } },
      }),
      prisma.yuk.findMany({
        where: { odemeDurumu: { not: "ODENDI" } },
        include: { firma: true, odemeler: true },
      }),
      prisma.kasaHareket.findMany({ select: { tip: true, tutar: true } }),
      kdvDonemiHesapla(simdi.getFullYear(), simdi.getMonth() + 1),
      prisma.yukIlani.count({ where: { createdAt: { gte: birGunOnce } } }),
    ]);

  const isletmeGiderleri = giderler.filter((g) => isletmeGideriMi(g.kategori));
  const gelirToplam = yukler.reduce((t, y) => t + y.toplamTutar, 0);
  const giderToplam = isletmeGiderleri.reduce((t, g) => t + g.toplamTutar, 0);

  const rotaMap = new Map<string, { ciro: number; sefer: number }>();
  for (const y of yukler) {
    const anahtar = `${y.nereden} → ${y.nereye}`;
    const mevcut = rotaMap.get(anahtar) || { ciro: 0, sefer: 0 };
    mevcut.ciro += y.netTutar;
    mevcut.sefer += 1;
    rotaMap.set(anahtar, mevcut);
  }

  const firmaMap = new Map<string, { ciro: number; sefer: number }>();
  for (const y of yukler) {
    const mevcut = firmaMap.get(y.firma.ad) || { ciro: 0, sefer: 0 };
    mevcut.ciro += y.toplamTutar;
    mevcut.sefer += 1;
    firmaMap.set(y.firma.ad, mevcut);
  }

  const katMap = new Map<string, number>();
  for (const g of isletmeGiderleri) {
    katMap.set(g.kategori, (katMap.get(g.kategori) || 0) + g.toplamTutar);
  }

  const yakitGideri = katMap.get("YAKIT") || 0;

  const geciktiAlacaklar = acikYukler
    .map((y) => {
      const odenen = y.odemeler.reduce((t, o) => t + o.tutar, 0);
      const kalan = Math.max(0, y.toplamTutar - odenen);
      const gun = Math.floor(
        (Date.now() - y.tarih.getTime()) / (24 * 60 * 60 * 1000)
      );
      return { firma: y.firma.ad, kalan, gun };
    })
    .filter((a) => a.kalan > 0 && a.gun >= 30)
    .sort((a, b) => b.gun - a.gun)
    .slice(0, 5);

  return {
    donemAdi: new Intl.DateTimeFormat("tr-TR", {
      month: "long",
      year: "numeric",
    }).format(simdi),
    gelirToplam,
    giderToplam,
    netKar:
      yukler.reduce((t, y) => t + y.netTutar, 0) -
      isletmeGiderleri.reduce((t, g) => t + g.netTutar, 0),
    bekleyenAlacak: acikYukler.reduce((t, y) => {
      const odenen = y.odemeler.reduce((o, p) => o + p.tutar, 0);
      return t + Math.max(0, y.toplamTutar - odenen);
    }, 0),
    kasaBakiye: kasa.reduce(
      (t, h) => (h.tip === "GIRIS" ? t + h.tutar : t - h.tutar),
      0
    ),
    odenecekKdv: kdv.odenecekKdv,
    yakitGideri,
    yakitOran: gelirToplam > 0 ? Math.round((yakitGideri / gelirToplam) * 100) : 0,
    enKarliRotalar: [...rotaMap.entries()]
      .map(([rota, v]) => ({ rota, ...v }))
      .sort((a, b) => b.ciro - a.ciro)
      .slice(0, 5),
    enCokCalisilanFirmalar: [...firmaMap.entries()]
      .map(([ad, v]) => ({ ad, ...v }))
      .sort((a, b) => b.ciro - a.ciro)
      .slice(0, 5),
    enBuyukGiderler: [...katMap.entries()]
      .map(([kod, tutar]) => ({ ad: kategoriAdi(kod), tutar }))
      .sort((a, b) => b.tutar - a.tutar)
      .slice(0, 5),
    geciktiAlacaklar,
    yeniIlanSayisi,
  };
}

function metrikOzeti(m: AnalizMetrikleri): string {
  const satirlar = [
    `Dönem: ${m.donemAdi}`,
    `Gelir: ${tlYaz(m.gelirToplam)}`,
    `İşletme gideri: ${tlYaz(m.giderToplam)}`,
    `Net kâr (KDV hariç): ${tlYaz(m.netKar)}`,
    `Kasa: ${tlYaz(m.kasaBakiye)}`,
    `Bekleyen alacak: ${tlYaz(m.bekleyenAlacak)}`,
    `Ödenecek KDV: ${tlYaz(m.odenecekKdv)}`,
    `Yakıt gideri: ${tlYaz(m.yakitGideri)} (cironun %${m.yakitOran}'i)`,
    `Son 24 saatte bulunan yük ilanı: ${m.yeniIlanSayisi}`,
    "",
    "En çok ciro yapan rotalar:",
    ...m.enKarliRotalar.map(
      (r) => `- ${r.rota}: ${tlYaz(r.ciro)} (${r.sefer} sefer)`
    ),
    "",
    "En çok çalışılan firmalar:",
    ...m.enCokCalisilanFirmalar.map(
      (f) => `- ${f.ad}: ${tlYaz(f.ciro)} (${f.sefer} sefer)`
    ),
    "",
    "En büyük gider kalemleri:",
    ...m.enBuyukGiderler.map((g) => `- ${g.ad}: ${tlYaz(g.tutar)}`),
  ];

  if (m.geciktiAlacaklar.length > 0) {
    satirlar.push("", "30 günü geçen alacaklar:");
    for (const a of m.geciktiAlacaklar) {
      satirlar.push(`- ${a.firma}: ${tlYaz(a.kalan)} (${a.gun} gün)`);
    }
  }

  return satirlar.join("\n");
}

function gunBasi(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export type AnalizSonucu = {
  yeniMi: boolean;
  baslik: string;
  metin: string;
  metrikler: AnalizMetrikleri;
};

/**
 * Günlük analizi üretir ve kaydeder.
 * @param varsaAtla Aynı gün için analiz varsa yeniden üretme.
 */
export async function gunlukAnaliziUret(
  varsaAtla = true
): Promise<AnalizSonucu> {
  const tarih = gunBasi();
  const metrikler = await metrikleriTopla();

  if (varsaAtla) {
    const mevcut = await prisma.aiAnaliz.findUnique({
      where: { tarih_tur: { tarih, tur: "GUNLUK" } },
    });
    if (mevcut) {
      return {
        yeniMi: false,
        baslik: mevcut.baslik,
        metin: mevcut.metin,
        metrikler,
      };
    }
  }

  const ozet = metrikOzeti(metrikler);
  const metin = await aiMetin({
    model: MODEL_ANALIZ,
    sistem: SISTEM,
    metin: `İşletmenin güncel rakamları:\n\n${ozet}\n\nBugünün değerlendirmesini yaz.`,
    caba: "medium",
    maxCikti: 1200,
  });

  const baslik = `${new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
  }).format(tarih)} değerlendirmesi`;

  await prisma.aiAnaliz.upsert({
    where: { tarih_tur: { tarih, tur: "GUNLUK" } },
    create: {
      tarih,
      tur: "GUNLUK",
      baslik,
      metin,
      veriJson: JSON.stringify(metrikler),
    },
    update: { baslik, metin, veriJson: JSON.stringify(metrikler) },
  });

  return { yeniMi: true, baslik, metin, metrikler };
}
