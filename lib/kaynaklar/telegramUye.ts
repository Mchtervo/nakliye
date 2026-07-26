import { prisma } from "@/lib/prisma";
import {
  ilanlariCozumle,
  mesajlariCozumle,
  type CozulmusIlan,
  type MesajIlani,
} from "@/lib/ai/ilanCozumle";
import { butceMusaitMi } from "@/lib/ai/butce";
import { aiKapaliMi, aiKullanilabilir } from "@/lib/ai/istemci";
import { AI_MAX_DENEME } from "@/lib/ai/modeller";
import {
  AYAR_ANAHTARLARI,
  aiTercihleriOku,
  ayarOku,
  ayarYaz,
} from "@/lib/ayarlar";
import {
  aramaSorgulariUret,
  genisIlKumesi,
  grubuDegerlendir,
  ilinBolgesi,
} from "@/lib/bolgeler";
import { yukIlanlariniBildir } from "@/lib/bildirim/gonder";
import { ilBul } from "@/lib/iller";
import { aiGeceMi, elemeArtir } from "@/lib/kaynaklar/elemeSayac";
import { ilgilileriSuz } from "@/lib/kaynaklar/filtre";
import { grupOkumaArtir, grupOkumaToplu } from "@/lib/kaynaklar/grupOkumaSayac";
import {
  elemeSebebi,
  metinHashUret,
  rotaHashleri,
  yeniSatirlariSec,
} from "@/lib/kaynaklar/onFiltre";
import { guvenliKirp } from "@/lib/metin";
import { ilanlariKaydet, type KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

export const TELEGRAM_UYE = "TELEGRAM_UYE";

/** Bir keşif turunda denenecek arama sorgusu sayısı. */
const TUR_BASINA_SORGU = 3;
/** İki grup araması arasındaki en kısa süre. */
const KESIF_ARALIGI_MS = 6 * 60 * 60 * 1000;
/** İlk kez okunan grupta geriye dönük alınacak mesaj sayısı. */
export const ILK_OKUMA_ADEDI = 20;
/** İkili bölme / çözümleme için ayrılan süre (tek çağrı timeout 60s). */
const COZUM_BUTCE_MS = 90_000;

/** Telegram hesabı bağlanmış mı (my.telegram.org anahtarları + oturum). */
export function telegramUyeKullanilabilir(): boolean {
  return Boolean(
    process.env.TELEGRAM_API_ID &&
      process.env.TELEGRAM_API_HASH &&
      process.env.TELEGRAM_SESSION
  );
}

// --- Okuma --------------------------------------------------------------

export type OkumaGorevi = {
  aktif: boolean;
  ilkOkumaAdedi: number;
  gruplar: { id: number; chatId: string; sonMesajId: number | null }[];
};

export async function okumaGoreviUret(limit = 5): Promise<OkumaGorevi> {
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramUyeAcik) {
    return { aktif: false, ilkOkumaAdedi: ILK_OKUMA_ADEDI, gruplar: [] };
  }

  const kaynaklar = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE, aktif: true, durum: "AKTIF" },
    orderBy: [{ sonTarama: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    take: Math.max(1, Math.min(limit, 15)),
    select: { id: true, hedef: true, sonMesajId: true },
  });

  return {
    aktif: true,
    ilkOkumaAdedi: ILK_OKUMA_ADEDI,
    gruplar: kaynaklar.map((k) => ({
      id: k.id,
      chatId: k.hedef,
      sonMesajId: k.sonMesajId,
    })),
  };
}

export type GelenGrup = {
  id: number;
  sonMesajId?: number | null;
  mesajlar: { mesajId?: number | null; metin: string }[];
  hata?: string | null;
};

export type YutmaRaporu = {
  alinan: number;
  kuyruga: number;
  grup: number;
  /** AI'a hiç gönderilmeyenler; sebebiyle birlikte. */
  elenen: Record<string, number>;
  /** Satır hash ile atlanan rota satırı adedi. */
  satirAtlanan: number;
};

/**
 * Gruplardan gelen ham mesajları kuyruğa yazar; AI çalıştırmaz.
 * Tekrar, reklam ve bölge dışı mesajlar burada elenir — asıl maliyet
 * tasarrufu bu adımda yapılır, çünkü elenen mesaj hiç token harcamaz.
 *
 * Yakın tekrar: zaman penceresi değil SATIR HASH. Aynı listenin 8 kez
 * atılması yeni satır yoksa hiç AI çağrısı üretmez; yeni eklenen rota
 * satırı tek başına geçer.
 */
export async function mesajlariKuyrugaAl(
  gruplar: GelenGrup[]
): Promise<YutmaRaporu> {
  const rapor: YutmaRaporu = {
    alinan: 0,
    kuyruga: 0,
    grup: 0,
    elenen: {},
    satirAtlanan: 0,
  };
  const ele = (sebep: string, n = 1) => {
    rapor.elenen[sebep] = (rapor.elenen[sebep] ?? 0) + n;
  };

  const tercih = await aiTercihleriOku();
  const hedefIller = new Set(genisIlKumesi(tercih.bolgeler));

  // Bu turda görülen satır hash'leri (oturum içi). DB sorgusu mesaj bazında.
  const turIci = new Set<string>();
  const yeniHashler: string[] = [];

  for (const grup of gruplar) {
    const kaynak = await prisma.ilanKaynagi.findUnique({
      where: { id: grup.id },
      select: { id: true, tur: true },
    });
    if (!kaynak || kaynak.tur !== TELEGRAM_UYE) continue;

    rapor.grup += 1;
    rapor.alinan += grup.mesajlar.length;

    const grupElenen: Record<string, number> = {};
    const eleGrup = (sebep: string, n = 1) => {
      ele(sebep, n);
      grupElenen[sebep] = (grupElenen[sebep] ?? 0) + n;
    };

    const adaylar: { mesajId: number | null; metin: string; hash: string }[] =
      [];

    for (const m of grup.mesajlar.slice(0, 200)) {
      const sebep = elemeSebebi(m.metin, hedefIller);
      if (sebep) {
        eleGrup(sebep);
        continue;
      }

      // Aday satır hash'lerini DB'den toplu sor.
      const adayHashler = rotaHashleri(m.metin).filter((h) => !turIci.has(h));
      if (adayHashler.length > 0) {
        const dbde = await prisma.satirHash.findMany({
          where: { hash: { in: adayHashler } },
          select: { hash: true },
        });
        for (const h of dbde) turIci.add(h.hash);
      }

      const secim = yeniSatirlariSec(m.metin, turIci);
      rapor.satirAtlanan += secim.atlanan;

      if (!secim.metin) {
        eleGrup("SATIR_TEKRAR");
        continue;
      }

      const hash = metinHashUret(secim.metin);
      if (adaylar.some((a) => a.hash === hash)) {
        eleGrup("TEKRAR");
        continue;
      }

      adaylar.push({
        mesajId: m.mesajId ?? null,
        metin: guvenliKirp(secim.metin, 2000),
        hash,
      });

      for (const h of secim.yeniHashler) {
        if (!turIci.has(h)) {
          turIci.add(h);
          yeniHashler.push(h);
        }
      }
    }

    let kuyrukEklenen = 0;
    if (adaylar.length > 0) {
      const sonuc = await prisma.hamMesaj.createMany({
        data: adaylar.map((a) => ({
          kaynakId: kaynak.id,
          mesajId: a.mesajId,
          metin: a.metin,
          metinHash: a.hash,
        })),
        skipDuplicates: true,
      });
      kuyrukEklenen = sonuc.count;
      rapor.kuyruga += sonuc.count;
    }

    // Grup bazlı teşhis: çekilen vs elenen ayrımı.
    if (grup.mesajlar.length > 0 || Object.keys(grupElenen).length > 0) {
      await grupOkumaArtir(kaynak.id, {
        cekilen: grup.mesajlar.length,
        kuyruk: kuyrukEklenen,
        elenen: grupElenen,
      });
    }

    // Okunamayan grupta da sonTarama ilerletilir; aksi hâlde sıranın
    // başında takılıp diğer grupların okunmasını engeller.
    await prisma.ilanKaynagi.update({
      where: { id: kaynak.id },
      data: {
        sonTarama: new Date(),
        sonHata: grup.hata ? grup.hata.slice(0, 300) : null,
        ...(typeof grup.sonMesajId === "number" && grup.sonMesajId > 0
          ? { sonMesajId: grup.sonMesajId }
          : {}),
      },
    });
  }

  if (yeniHashler.length > 0) {
    await prisma.satirHash.createMany({
      data: yeniHashler.map((hash) => ({ hash })),
      skipDuplicates: true,
    });
  }

  // Günlük rapora yaz.
  const sayac: Record<string, number> = { ...rapor.elenen };
  if (rapor.satirAtlanan > 0) sayac.SATIR_ATLANAN = rapor.satirAtlanan;
  if (rapor.kuyruga > 0) sayac.KUYRUK_ALINAN = rapor.kuyruga;
  await elemeArtir(sayac);

  return rapor;
}

// --- Kuyruk çözümleme ---------------------------------------------------

export type KuyrukRaporu = {
  islenen: number;
  yeniIlan: number;
  bildirilen: number;
  kalan: number;
  hata: string | null;
  /** Gece penceresinde AI ertelendi. */
  geceErtelendi?: boolean;
  bolgeElenen?: number;
  cagriSayisi?: number;
};

type PartiMesaj = { id: number; metin: string };

/**
 * Tek mesaj — en son çare. Parti ikiye bölüne bölüne buraya iner.
 */
async function tekMesajCozumle(
  mesaj: PartiMesaj,
  kapsam: string[]
): Promise<{
  sonuc: MesajIlani[];
  basarili: number[];
  basarisiz: number[];
  cagri: number;
}> {
  try {
    const ilanlar = await ilanlariCozumle(mesaj.metin, kapsam);
    return {
      sonuc: ilanlar.map((ilan) => ({ anahtar: mesaj.id, ilan })),
      basarili: [mesaj.id],
      basarisiz: [],
      cagri: 1,
    };
  } catch (hata) {
    const metin = hata instanceof Error ? hata.message : "Çözümlenemedi";
    await prisma.hamMesaj.update({
      where: { id: mesaj.id },
      data: { hata: metin.slice(0, 300) },
    });
    return { sonuc: [], basarili: [], basarisiz: [mesaj.id], cagri: 1 };
  }
}

/**
 * Parti başarısız olunca ikiye böl. Tek tek deneme en son çare:
 * 8 mesajlık parti → 4+4 → 2+2 → 1+1. Böylece iyi mesajlar pahalı
 * tekil çağrıya düşmeden kurtulur.
 */
async function bolerekCozumle(
  parti: PartiMesaj[],
  kapsam: string[],
  bitis: number
): Promise<{
  sonuc: MesajIlani[];
  basarili: number[];
  basarisiz: number[];
  bolgeElenen: number;
  cagri: number;
}> {
  if (parti.length === 0) {
    return { sonuc: [], basarili: [], basarisiz: [], bolgeElenen: 0, cagri: 0 };
  }
  if (Date.now() > bitis) {
    return { sonuc: [], basarili: [], basarisiz: [], bolgeElenen: 0, cagri: 0 };
  }

  if (parti.length === 1) {
    const tek = await tekMesajCozumle(parti[0], kapsam);
    return { ...tek, bolgeElenen: 0 };
  }

  try {
    const rapor = await mesajlariCozumle(
      parti.map((m) => ({ anahtar: m.id, metin: m.metin })),
      kapsam
    );
    return {
      sonuc: rapor.ilanlar,
      basarili: parti.map((m) => m.id),
      basarisiz: [],
      bolgeElenen: rapor.bolgeElenen,
      cagri: 1,
    };
  } catch {
    const orta = Math.ceil(parti.length / 2);
    const sol = await bolerekCozumle(parti.slice(0, orta), kapsam, bitis);
    const sag = await bolerekCozumle(parti.slice(orta), kapsam, bitis);
    return {
      sonuc: [...sol.sonuc, ...sag.sonuc],
      basarili: [...sol.basarili, ...sag.basarili],
      basarisiz: [...sol.basarisiz, ...sag.basarisiz],
      bolgeElenen: sol.bolgeElenen + sag.bolgeElenen,
      cagri: sol.cagri + sag.cagri,
    };
  }
}

/**
 * Kuyruktan işlenecek mesajları seçer.
 *
 * Düz FIFO'da tek bir yoğun grup partinin tamamını doldurup diğer
 * grupları aç bırakıyordu: panelde "6 grupta 0 ilan" görünmesinin
 * sebeplerinden biri buydu. Sıra gruplar arasında dönüşümlü dağıtılır.
 */
async function partiSec(limit: number): Promise<
  { id: number; metin: string; kaynakId: number | null; denemeSayisi: number }[]
> {
  const havuz = await prisma.hamMesaj.findMany({
    // denemeSayisi >= AI_MAX_DENEME → daha deneme yok.
    where: { islendi: false, denemeSayisi: { lt: AI_MAX_DENEME } },
    orderBy: { createdAt: "asc" },
    take: limit * 5,
    select: { id: true, metin: true, kaynakId: true, denemeSayisi: true },
  });
  if (havuz.length <= limit) return havuz;

  const kuyruklar = new Map<number | null, typeof havuz>();
  for (const mesaj of havuz) {
    const liste = kuyruklar.get(mesaj.kaynakId) ?? [];
    liste.push(mesaj);
    kuyruklar.set(mesaj.kaynakId, liste);
  }

  const secilen: typeof havuz = [];
  let sira = 0;
  while (secilen.length < limit) {
    let eklendi = false;
    for (const liste of kuyruklar.values()) {
      if (sira >= liste.length) continue;
      secilen.push(liste[sira]);
      eklendi = true;
      if (secilen.length === limit) break;
    }
    if (!eklendi) break;
    sira += 1;
  }
  return secilen;
}

export type KuyrukSecenek = {
  /**
   * Test modu: AI_KAPALI ve gece ertelemeyi yok sayar, tek tur 10 mesaj.
   * Cron'lar hâlâ kill switch'e bağlı kalır.
   */
  testModu?: boolean;
};

/**
 * Kuyruktaki ham mesajları AI ile çözümler.
 *
 * Gece (23:00–06:00 TR) AI çalışmaz: mesajlar HamMesaj'da birikir.
 * Sabah aynı kelimeler 8 kez atılmışsa satır hash sayesinde tek seferde
 * elenir — gece erteleme bu yüzden ekstra tasarruf sağlar.
 * Telegram okuması gece de devam eder (bedava).
 */
export async function kuyrugunuCoz(
  limit = 10,
  secenek: KuyrukSecenek = {}
): Promise<KuyrukRaporu> {
  const rapor: KuyrukRaporu = {
    islenen: 0,
    yeniIlan: 0,
    bildirilen: 0,
    kalan: 0,
    hata: null,
    bolgeElenen: 0,
    cagriSayisi: 0,
  };
  const testModu = Boolean(secenek.testModu);

  if (!testModu && aiKapaliMi()) {
    rapor.hata = "AI_KAPALI=true — kuyruk işlenmiyor.";
    rapor.kalan = await prisma.hamMesaj.count({ where: { islendi: false } });
    return rapor;
  }

  if (!testModu && aiGeceMi()) {
    rapor.geceErtelendi = true;
    rapor.kalan = await prisma.hamMesaj.count({ where: { islendi: false } });
    await elemeArtir({ GECE_ERTELEME: 1 });
    return rapor;
  }

  if (!process.env.OPENAI_API_KEY) {
    rapor.hata = "OPENAI_API_KEY tanımlı değil.";
    return rapor;
  }

  if (!(await butceMusaitMi())) {
    rapor.hata = "Günlük AI bütçesi doldu — otomatik kesildi.";
    rapor.kalan = await prisma.hamMesaj.count({ where: { islendi: false } });
    return rapor;
  }

  // Kill switch test modunda bypass; yine de API key şart.
  if (!testModu && !aiKullanilabilir()) {
    rapor.hata = "OPENAI_API_KEY tanımlı değil veya AI kapalı.";
    return rapor;
  }

  const secilen = await partiSec(Math.max(1, Math.min(limit, 25)));
  if (secilen.length === 0) return rapor;

  // Her denemede artır; 2'yi geçince kalıcı HATA, AI'ya gönderme.
  const parti: typeof secilen = [];
  for (const m of secilen) {
    const guncel = await prisma.hamMesaj.update({
      where: { id: m.id },
      data: { denemeSayisi: { increment: 1 } },
      select: { id: true, denemeSayisi: true },
    });
    if (guncel.denemeSayisi > AI_MAX_DENEME) {
      await prisma.hamMesaj.update({
        where: { id: m.id },
        data: {
          islendi: true,
          hata: `Max deneme (${AI_MAX_DENEME}) aşıldı — kalıcı HATA.`,
        },
      });
      continue;
    }
    parti.push(m);
  }
  if (parti.length === 0) {
    rapor.kalan = await prisma.hamMesaj.count({ where: { islendi: false } });
    return rapor;
  }

  const tercih = await aiTercihleriOku();
  const kapsam = genisIlKumesi(tercih.bolgeler);
  const bitis = Date.now() + COZUM_BUTCE_MS;

  const cozum = await bolerekCozumle(
    parti.map((m) => ({ id: m.id, metin: m.metin })),
    kapsam,
    bitis
  );

  const cozulenler = cozum.sonuc;
  rapor.islenen = cozum.basarili.length + cozum.basarisiz.length;
  rapor.bolgeElenen = cozum.bolgeElenen;
  rapor.cagriSayisi = cozum.cagri;

  if (cozum.bolgeElenen > 0) {
    await elemeArtir({ BOLGE_ROTA: cozum.bolgeElenen });
  }
  if (cozum.cagri > 0) {
    await elemeArtir({ AI_CAGRI: cozum.cagri });
  }

  const metinler = new Map(parti.map((m) => [m.id, m.metin]));
  const kaynaklar = new Map(parti.map((m) => [m.id, m.kaynakId]));

  // Aynı kaynağa ait ilanlar birlikte kaydedilir.
  const kaynagaGore = new Map<
    number | null,
    { ilan: CozulmusIlan; hamMetin: string }[]
  >();

  for (const { anahtar, ilan } of cozulenler) {
    const kaynakId = kaynaklar.get(anahtar) ?? null;
    const hamMetin = metinler.get(anahtar) ?? "";
    const liste = kaynagaGore.get(kaynakId) ?? [];
    liste.push({ ilan, hamMetin });
    kaynagaGore.set(kaynakId, liste);
  }

  const yeniler: KaydedilenIlan[] = [];
  for (const [kaynakId, bulunanlar] of kaynagaGore) {
    const kaydedilen = await ilanlariKaydet(kaynakId, bulunanlar);
    yeniler.push(...kaydedilen);

    if (kaynakId && kaydedilen.length > 0) {
      await prisma.ilanKaynagi.update({
        where: { id: kaynakId },
        data: { bulunanAdet: { increment: kaydedilen.length } },
      });
    }
  }

  // Başarılılar işlendi. Başarısızlar deneme hakkı varsa kuyrukta kalır;
  // denemeSayisi > MAX olanlar yukarıda kalıcı HATA yazıldı.
  if (cozum.basarili.length > 0) {
    await prisma.hamMesaj.updateMany({
      where: { id: { in: cozum.basarili } },
      data: { islendi: true, hata: null },
    });
  }

  // Max denemeye ulaşmış başarısızlar: kalıcı HATA, bir daha kuyruk yok.
  if (cozum.basarisiz.length > 0) {
    const tukenen = await prisma.hamMesaj.findMany({
      where: {
        id: { in: cozum.basarisiz },
        denemeSayisi: { gte: AI_MAX_DENEME },
      },
      select: { id: true },
    });
    if (tukenen.length > 0) {
      await prisma.hamMesaj.updateMany({
        where: { id: { in: tukenen.map((t) => t.id) } },
        data: {
          islendi: true,
          hata: `Max deneme (${AI_MAX_DENEME}) aşıldı — kalıcı HATA.`,
        },
      });
    }
  }

  rapor.yeniIlan = yeniler.length;

  if (yeniler.length > 0 && !testModu) {
    const bildirilecek = ilgilileriSuz(yeniler, tercih);
    if (bildirilecek.length > 0) {
      await yukIlanlariniBildir(bildirilecek);
      rapor.bildirilen = bildirilecek.length;
    }
  }

  rapor.kalan = await prisma.hamMesaj.count({ where: { islendi: false } });
  return rapor;
}

export type GrupDurumu = {
  id: number;
  ad: string;
  kullaniciAdi: string | null;
  uyeSayisi: number | null;
  durum: string;
  aktif: boolean;
  sonTarama: Date | null;
  sonHata: string | null;
  sonMesajId: number | null;
  ilkOkumaYapildi: boolean;
  /** Son 24 saatte kuyruğa alınan mesaj. */
  mesaj24s: number;
  /** Bugün Telegram'dan çekilen (ön filtre öncesi). */
  cekilenBugun: number;
  /** Bugün ön filtreyle elenen (sebep → adet). */
  elenenBugun: Record<string, number>;
  /** Kuyrukta bekleyen (henüz AI görmemiş) mesaj. */
  bekleyen: number;
  /** Gerçek ilan sayısı — sayaç değil, tablodan sayılır. */
  ilanAdedi: number;
  /** Tek cümlelik teşhis. */
  teshis: string;
};

function grupTeshisi(g: {
  durum: string;
  aktif: boolean;
  sonHata: string | null;
  sonMesajId: number | null;
  cekilenBugun: number;
  mesaj24s: number;
  bekleyen: number;
  ilanAdedi: number;
  elenenBugun: Record<string, number>;
}): string {
  if (g.durum === "ADAY") return "Aday — üye olunca / Takibe al";
  if (!g.aktif) return "Pasif";
  if (g.sonHata) return `Okuma hatası: ${g.sonHata.slice(0, 80)}`;
  if (!g.sonMesajId) return "İlk okuma hiç yapılmadı";

  const elenenToplam = Object.values(g.elenenBugun).reduce((a, b) => a + b, 0);
  const elenenOzet = Object.entries(g.elenenBugun)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k}:${v}`)
    .join(" ");

  if (g.cekilenBugun === 0 && g.mesaj24s === 0) {
    return "Çekilen 0 — grup sessiz veya sonMesajId yeni mesaj bırakmıyor";
  }
  if (g.cekilenBugun > 0 && elenenToplam > 0 && g.mesaj24s === 0) {
    return `Çekilen ${g.cekilenBugun}, hepsi ön filtrede (${elenenOzet})`;
  }
  if (g.bekleyen > 0) {
    return aiKapaliMi()
      ? `Çekilen var, ${g.bekleyen} kuyrukta — AI_KAPALI, ilan üretilmiyor`
      : `Çekilen var, ${g.bekleyen} kuyrukta AI bekliyor`;
  }
  if (g.ilanAdedi === 0 && (g.mesaj24s > 0 || g.cekilenBugun > 0)) {
    return elenenOzet
      ? `Çekildi, ilan 0 — eleme: ${elenenOzet}`
      : "Çekildi/işlendi, ilan çıkmadı";
  }
  if (g.ilanAdedi > 0) return "OK";
  return "Veri yok";
}

/**
 * Grupların gerçekten okunup okunmadığını gösterir. "0 ilan" tek başına
 * bir şey söylemiyor: grup sessiz de olabilir, mesajları kuyrukta sırasını
 * bekliyor da olabilir. Ayrım panelde görünsün diye ayrı ayrı sayılır.
 */
export async function grupDurumlari(): Promise<GrupDurumu[]> {
  const gruplar = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE },
    orderBy: [{ durum: "asc" }, { ad: "asc" }],
  });
  if (gruplar.length === 0) return [];

  const dun = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ids = gruplar.map((g) => g.id);
  const [sonGun, bekleyen, ilanlar, okumaMap] = await Promise.all([
    prisma.hamMesaj.groupBy({
      by: ["kaynakId"],
      where: { createdAt: { gte: dun } },
      _count: { _all: true },
    }),
    prisma.hamMesaj.groupBy({
      by: ["kaynakId"],
      where: { islendi: false },
      _count: { _all: true },
    }),
    prisma.yukIlani.groupBy({
      by: ["kaynakId"],
      _count: { _all: true },
    }),
    grupOkumaToplu(ids),
  ]);

  const say = (
    liste: { kaynakId: number | null; _count: { _all: number } }[],
    id: number
  ) => liste.find((x) => x.kaynakId === id)?._count._all ?? 0;

  return gruplar.map((g) => {
    const okuma = okumaMap.get(g.id);
    const mesaj24s = say(sonGun, g.id);
    const bek = say(bekleyen, g.id);
    const ilanAdedi = say(ilanlar, g.id);
    const cekilenBugun = okuma?.cekilen ?? 0;
    const elenenBugun = okuma?.elenen ?? {};
    const baz = {
      durum: g.durum,
      aktif: g.aktif,
      sonHata: g.sonHata,
      sonMesajId: g.sonMesajId,
      cekilenBugun,
      mesaj24s,
      bekleyen: bek,
      ilanAdedi,
      elenenBugun,
    };
    return {
      id: g.id,
      ad: g.ad,
      kullaniciAdi: g.kullaniciAdi,
      uyeSayisi: g.uyeSayisi,
      durum: g.durum,
      aktif: g.aktif,
      sonTarama: g.sonTarama,
      sonHata: g.sonHata,
      sonMesajId: g.sonMesajId,
      ilkOkumaYapildi: g.sonMesajId !== null,
      mesaj24s,
      cekilenBugun,
      elenenBugun,
      bekleyen: bek,
      ilanAdedi,
      teshis: grupTeshisi(baz),
    };
  });
}

/** İşlenmiş kuyruk kayıtlarını ve eski satır hash'lerini temizler. */
export async function kuyrugaBakim(gunSayisi = 3): Promise<number> {
  const sinir = new Date(Date.now() - gunSayisi * 24 * 60 * 60 * 1000);
  const sonuc = await prisma.hamMesaj.deleteMany({
    where: { islendi: true, createdAt: { lt: sinir } },
  });
  // 7 günden eski satır hash'leri: aynı listenin uzak tekrarı yeniden
  // değerlendirilsin ama tablo şişmesin.
  const hashSinir = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.satirHash.deleteMany({ where: { createdAt: { lt: hashSinir } } });
  return sonuc.count;
}

// --- Grup keşfi ---------------------------------------------------------
//
// Gruba katılma işi bilinçli olarak buraya ait değil: katılımı kullanıcı
// kendi kontrolünde yapar. Burada sadece uygun gruplar aday olarak
// kaydedilir, üye olunanlar takibe alınır.

export type KesifGorevi = {
  aktif: boolean;
  sorgular: string[];
  /** Dialog kesilirse ADAY üyeliklerini username ile yeniden doğrula. */
  adayKontrol: { chatId: string; kullaniciAdi: string; baslik: string }[];
};

async function adayKontrolListesi(): Promise<KesifGorevi["adayKontrol"]> {
  const adaylar = await prisma.ilanKaynagi.findMany({
    where: {
      tur: TELEGRAM_UYE,
      durum: "ADAY",
      kullaniciAdi: { not: null },
    },
    orderBy: { uyeSayisi: "desc" },
    take: 40,
    select: { hedef: true, kullaniciAdi: true, ad: true },
  });
  return adaylar
    .filter((a) => a.kullaniciAdi)
    .map((a) => ({
      chatId: a.hedef,
      kullaniciAdi: a.kullaniciAdi as string,
      baslik: a.ad,
    }));
}

/**
 * Her turda sorgu listesinden sıradaki birkaç tanesi denenir.
 * Arama seyrek yapılır: sık global arama hesabı riske atar.
 * Sorgu dönmemesi keşfin kapalı olduğu anlamına gelmez; üyelik
 * senkronu her koşuda çalışır.
 */
export async function kesifGoreviUret(): Promise<KesifGorevi> {
  const tercih = await aiTercihleriOku();
  const adayKontrol = await adayKontrolListesi();
  if (!tercih.telegramUyeAcik) {
    return { aktif: false, sorgular: [], adayKontrol: [] };
  }

  const sonKesif = Date.parse(
    (await ayarOku(AYAR_ANAHTARLARI.telegramKesifZaman)) || ""
  );
  if (Number.isFinite(sonKesif) && Date.now() - sonKesif < KESIF_ARALIGI_MS) {
    // Arama kapalı; üyelik senkronu + ADAY doğrulama devam.
    return { aktif: true, sorgular: [], adayKontrol };
  }
  await ayarYaz(AYAR_ANAHTARLARI.telegramKesifZaman, new Date().toISOString());

  const tumSorgular = aramaSorgulariUret(tercih.bolgeler);
  const siraHam = Number(await ayarOku(AYAR_ANAHTARLARI.telegramSorguSira));
  const sira = Number.isFinite(siraHam) && siraHam > 0 ? siraHam : 0;

  const sorgular: string[] = [];
  for (let i = 0; i < Math.min(TUR_BASINA_SORGU, tumSorgular.length); i++) {
    sorgular.push(tumSorgular[(sira + i) % tumSorgular.length]);
  }

  await ayarYaz(
    AYAR_ANAHTARLARI.telegramSorguSira,
    String((sira + sorgular.length) % tumSorgular.length)
  );

  return { aktif: true, sorgular, adayKontrol };
}

export type BulunanGrup = {
  chatId: string;
  baslik: string;
  kullaniciAdi?: string | null;
  uyeSayisi?: number | null;
  /** Hesap bu gruba üye mi. Üyeyse doğrudan takibe alınır. */
  uye?: boolean;
};

export type DegerlendirmeRaporu = {
  /** Üye olunmayan, katılmaya değer yeni gruplar. */
  yeniAday: number;
  /** Zaten üye olunduğu için doğrudan takibe alınanlar. */
  hazirUyelik: number;
  /** Elle katılınmış, aday listesinden takibe geçenler. */
  terfi: number;
  elenen: number;
};

/**
 * Bulunan grupları değerlendirir:
 * - Üye olunan uygun gruplar takibe alınır.
 * - Daha önce aday kaydedilmiş bir gruba elle katılındıysa takibe geçirilir.
 * - Üye olunmayanlar aday olarak kaydedilir; katılma kararı kullanıcınındır.
 */
export async function adaylariDegerlendir(
  bulunanlar: BulunanGrup[]
): Promise<DegerlendirmeRaporu> {
  const rapor: DegerlendirmeRaporu = {
    yeniAday: 0,
    hazirUyelik: 0,
    terfi: 0,
    elenen: 0,
  };
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramUyeAcik) return rapor;

  const gorulen = new Set<string>();

  // Tek sorguda mevcut kayıtlar: aday listesi yüzlerce satır olabiliyor.
  const tumKayitlar = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE },
    select: { id: true, hedef: true, durum: true, kullaniciAdi: true },
  });
  const kayitli = new Map(tumKayitlar.map((k) => [k.hedef, k]));
  const kayitliKullanici = new Map(
    tumKayitlar
      .filter((k) => k.kullaniciAdi)
      .map((k) => [k.kullaniciAdi!.toLowerCase(), k])
  );

  for (const grup of bulunanlar) {
    const chatId = String(grup.chatId || "").trim();
    const baslik = (grup.baslik || "").trim();
    if (!chatId || !baslik || gorulen.has(chatId)) continue;
    gorulen.add(chatId);

    const uye = grup.uye === true;
    const ku = (grup.kullaniciAdi || "").trim().toLowerCase();
    // chatId veya @username ile eşle (dialog/entity id farkı olmasın).
    const mevcut = kayitli.get(chatId) ?? (ku ? kayitliKullanici.get(ku) : undefined);

    if (mevcut) {
      // Aday listesindeki bir gruba elle katılınmış: takibe al.
      if (uye && mevcut.durum === "ADAY") {
        await prisma.ilanKaynagi.update({
          where: { id: mevcut.id },
          data: {
            aktif: true,
            durum: "AKTIF",
            sonHata: null,
            hedef: chatId,
            ad: baslik.slice(0, 120),
            kullaniciAdi: grup.kullaniciAdi || undefined,
          },
        });
        rapor.terfi += 1;
      }
      continue;
    }

    // Üye olunan grupta başlık filtresi çalıştırılmaz: kullanıcı zaten
    // bilerek katılmış. Başlığa bakıp elemek ("Grupaj Kargo" içinde
    // nakliye kelimesi yok diye) gruplarının yarısını görünmez yapıyordu.
    // Süzme ilan seviyesinde yapılır, grup seviyesinde değil.
    const karar = uye
      ? { uygun: true, bolge: ilinBolgesi(ilBul(baslik)) }
      : grubuDegerlendir(baslik, tercih.bolgeler);

    if (!karar.uygun) {
      rapor.elenen += 1;
      continue;
    }

    await prisma.ilanKaynagi.create({
      data: {
        tur: TELEGRAM_UYE,
        hedef: chatId,
        ad: baslik.slice(0, 120),
        aktif: uye,
        durum: uye ? "AKTIF" : "ADAY",
        bolge: karar.bolge,
        kullaniciAdi: grup.kullaniciAdi || null,
        uyeSayisi:
          typeof grup.uyeSayisi === "number" && grup.uyeSayisi > 0
            ? grup.uyeSayisi
            : null,
      },
    });

    if (uye) rapor.hazirUyelik += 1;
    else rapor.yeniAday += 1;
  }

  return rapor;
}
