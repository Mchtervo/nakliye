import { prisma } from "@/lib/prisma";
import { mesajlariCozumle } from "@/lib/ai/ilanCozumle";
import { aiKullanilabilir } from "@/lib/ai/istemci";
import {
  AYAR_ANAHTARLARI,
  aiTercihleriOku,
  ayarOku,
  ayarYaz,
} from "@/lib/ayarlar";
import { aramaSorgulariUret, grubuDegerlendir } from "@/lib/bolgeler";
import { yukIlanlariniBildir } from "@/lib/bildirim/gonder";
import { ilBul } from "@/lib/iller";
import { ilgilileriSuz } from "@/lib/kaynaklar/filtre";
import { ilanlariKaydet, type KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

export const TELEGRAM_UYE = "TELEGRAM_UYE";

/** Hesabın şüpheli görünmemesi için günlük katılım sayısı sınırlı. */
const GUNLUK_KATILIM_SINIRI = 4;
/** Bir keşif turunda denenecek arama sorgusu sayısı. */
const TUR_BASINA_SORGU = 3;
/** İki grup keşfi arasındaki en kısa süre. */
const KESIF_ARALIGI_MS = 6 * 60 * 60 * 1000;
/** İlk kez okunan grupta geriye dönük alınacak mesaj sayısı. */
export const ILK_OKUMA_ADEDI = 20;

function bugunAnahtari(): string {
  return new Date().toISOString().slice(0, 10);
}

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

/**
 * Yük ilanı olma ihtimali olmayan mesajları AI'ye hiç göndermemek için
 * ucuz bir ön eleme. En az bir il adı geçmeyen mesaj ilan sayılmaz.
 */
function ilanAdayiMi(metin: string): boolean {
  const sade = metin.trim();
  if (sade.length < 15 || sade.length > 3000) return false;
  return ilBul(sade) !== null;
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
};

/** Gruplardan gelen ham mesajları kuyruğa yazar; AI çalıştırmaz. */
export async function mesajlariKuyrugaAl(
  gruplar: GelenGrup[]
): Promise<YutmaRaporu> {
  const rapor: YutmaRaporu = { alinan: 0, kuyruga: 0, grup: 0 };

  for (const grup of gruplar) {
    const kaynak = await prisma.ilanKaynagi.findUnique({
      where: { id: grup.id },
      select: { id: true, tur: true },
    });
    if (!kaynak || kaynak.tur !== TELEGRAM_UYE) continue;

    rapor.grup += 1;
    rapor.alinan += grup.mesajlar.length;

    const adaylar = grup.mesajlar
      .filter((m) => ilanAdayiMi(m.metin))
      .slice(0, 200);

    if (adaylar.length > 0) {
      const sonuc = await prisma.hamMesaj.createMany({
        data: adaylar.map((m) => ({
          kaynakId: kaynak.id,
          mesajId: m.mesajId ?? null,
          metin: m.metin.trim().slice(0, 2000),
        })),
        skipDuplicates: true,
      });
      rapor.kuyruga += sonuc.count;
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

  return rapor;
}

// --- Kuyruk çözümleme ---------------------------------------------------

export type KuyrukRaporu = {
  islenen: number;
  yeniIlan: number;
  bildirilen: number;
  kalan: number;
  hata: string | null;
};

/**
 * Kuyruktaki ham mesajları tek AI çağrısında çözümler.
 * Netlify'ın kısa fonksiyon süresine sığması için parti küçük tutulur.
 */
export async function kuyrugunuCoz(limit = 10): Promise<KuyrukRaporu> {
  const rapor: KuyrukRaporu = {
    islenen: 0,
    yeniIlan: 0,
    bildirilen: 0,
    kalan: 0,
    hata: null,
  };

  if (!aiKullanilabilir()) {
    rapor.hata = "OPENAI_API_KEY tanımlı değil.";
    return rapor;
  }

  const parti = await prisma.hamMesaj.findMany({
    where: { islendi: false },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 25)),
  });

  if (parti.length === 0) return rapor;

  rapor.islenen = parti.length;
  const kimlikler = parti.map((m) => m.id);

  let cozulenler;
  try {
    cozulenler = await mesajlariCozumle(
      parti.map((m) => ({ anahtar: m.id, metin: m.metin }))
    );
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Çözümleme hatası";
    rapor.hata = mesaj;
    // Aynı parti sonsuza kadar denenmesin.
    await prisma.hamMesaj.updateMany({
      where: { id: { in: kimlikler } },
      data: { islendi: true, hata: mesaj.slice(0, 300) },
    });
    rapor.kalan = await prisma.hamMesaj.count({ where: { islendi: false } });
    return rapor;
  }

  const metinler = new Map(parti.map((m) => [m.id, m.metin]));
  const kaynaklar = new Map(parti.map((m) => [m.id, m.kaynakId]));

  // Aynı kaynağa ait ilanlar birlikte kaydedilir.
  const kaynagaGore = new Map<
    number | null,
    { ilan: (typeof cozulenler)[number]["ilan"]; hamMetin: string }[]
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

  await prisma.hamMesaj.updateMany({
    where: { id: { in: kimlikler } },
    data: { islendi: true },
  });

  rapor.yeniIlan = yeniler.length;

  if (yeniler.length > 0) {
    const tercih = await aiTercihleriOku();
    const bildirilecek = ilgilileriSuz(yeniler, tercih);
    if (bildirilecek.length > 0) {
      await yukIlanlariniBildir(bildirilecek);
      rapor.bildirilen = bildirilecek.length;
    }
  }

  rapor.kalan = await prisma.hamMesaj.count({ where: { islendi: false } });
  return rapor;
}

/** İşlenmiş kuyruk kayıtlarını temizler. */
export async function kuyrugaBakim(gunSayisi = 3): Promise<number> {
  const sinir = new Date(Date.now() - gunSayisi * 24 * 60 * 60 * 1000);
  const sonuc = await prisma.hamMesaj.deleteMany({
    where: { islendi: true, createdAt: { lt: sinir } },
  });
  return sonuc.count;
}

// --- Grup keşfi ---------------------------------------------------------

async function kalanKatilimHakki(): Promise<number> {
  const gun = await ayarOku(AYAR_ANAHTARLARI.telegramKatilimGun);
  if (gun !== bugunAnahtari()) return GUNLUK_KATILIM_SINIRI;

  const adet = Number(await ayarOku(AYAR_ANAHTARLARI.telegramKatilimAdet));
  const kullanilan = Number.isFinite(adet) ? adet : 0;
  return Math.max(0, GUNLUK_KATILIM_SINIRI - kullanilan);
}

async function katilimiIsaretle(adet: number): Promise<void> {
  if (adet <= 0) return;
  const bugun = bugunAnahtari();
  const gun = await ayarOku(AYAR_ANAHTARLARI.telegramKatilimGun);
  const oncekiHam = Number(await ayarOku(AYAR_ANAHTARLARI.telegramKatilimAdet));
  const onceki = gun === bugun && Number.isFinite(oncekiHam) ? oncekiHam : 0;

  await ayarYaz(AYAR_ANAHTARLARI.telegramKatilimGun, bugun);
  await ayarYaz(AYAR_ANAHTARLARI.telegramKatilimAdet, String(onceki + adet));
}

export type KesifGorevi = {
  aktif: boolean;
  sorgular: string[];
  kalanKatilim: number;
};

/**
 * Her turda sorgu listesinden sıradaki birkaç tanesi denenir.
 * Keşif seyrek çalışır: sık arama yapmak hesabı riske atar.
 */
export async function kesifGoreviUret(): Promise<KesifGorevi> {
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramUyeAcik) {
    return { aktif: false, sorgular: [], kalanKatilim: 0 };
  }

  const sonKesif = Date.parse(
    (await ayarOku(AYAR_ANAHTARLARI.telegramKesifZaman)) || ""
  );
  if (
    Number.isFinite(sonKesif) &&
    Date.now() - sonKesif < KESIF_ARALIGI_MS
  ) {
    return { aktif: true, sorgular: [], kalanKatilim: 0 };
  }
  await ayarYaz(
    AYAR_ANAHTARLARI.telegramKesifZaman,
    new Date().toISOString()
  );

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

  return {
    aktif: true,
    sorgular,
    kalanKatilim: await kalanKatilimHakki(),
  };
}

export type BulunanGrup = {
  chatId: string;
  baslik: string;
  kullaniciAdi?: string | null;
  uyeSayisi?: number | null;
  /** Hesap bu gruba zaten üye: katılmaya gerek yok, doğrudan takibe alınır. */
  uye?: boolean;
};

export type KatilmaEmri = {
  chatId: string;
  kullaniciAdi: string | null;
  baslik: string;
};

export type DegerlendirmeRaporu = {
  yeniAday: number;
  hazirUyelik: number;
  elenen: number;
  katil: KatilmaEmri[];
};

/**
 * Bulunan grupları değerlendirir.
 * Hesabın zaten üye olduğu uygun gruplar doğrudan takibe alınır;
 * üye olunmayanlar aday olarak kaydedilir ve kotanın izin verdiği kadarı
 * katılım listesine konur.
 */
export async function adaylariDegerlendir(
  bulunanlar: BulunanGrup[]
): Promise<DegerlendirmeRaporu> {
  const rapor: DegerlendirmeRaporu = {
    yeniAday: 0,
    hazirUyelik: 0,
    elenen: 0,
    katil: [],
  };
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramUyeAcik) return rapor;

  let kalan = await kalanKatilimHakki();
  const gorulen = new Set<string>();

  // Tek sorguda mevcut kayıtlar: aday listesi yüzlerce satır olabiliyor.
  const kayitli = new Set(
    (
      await prisma.ilanKaynagi.findMany({
        where: { tur: TELEGRAM_UYE },
        select: { hedef: true },
      })
    ).map((k) => k.hedef)
  );

  for (const grup of bulunanlar) {
    const chatId = String(grup.chatId || "").trim();
    const baslik = (grup.baslik || "").trim();
    if (!chatId || !baslik || gorulen.has(chatId)) continue;
    gorulen.add(chatId);
    if (kayitli.has(chatId)) continue;

    const karar = grubuDegerlendir(baslik, tercih.bolgeler);
    if (!karar.uygun) {
      rapor.elenen += 1;
      continue;
    }

    const uye = grup.uye === true;

    await prisma.ilanKaynagi.create({
      data: {
        tur: TELEGRAM_UYE,
        hedef: chatId,
        ad: baslik.slice(0, 120),
        aktif: uye,
        durum: uye ? "AKTIF" : "ADAY",
        bolge: karar.bolge,
      },
    });

    if (uye) {
      rapor.hazirUyelik += 1;
      continue;
    }

    rapor.yeniAday += 1;
    if (kalan > 0) {
      rapor.katil.push({
        chatId,
        kullaniciAdi: grup.kullaniciAdi ?? null,
        baslik,
      });
      kalan -= 1;
    }
  }

  return rapor;
}

export type KatilmaSonucu = {
  chatId: string;
  katildi: boolean;
  hata?: string | null;
};

export type KatilmaRaporu = { katilan: number; basarisiz: number };

/** Katılım denemelerinin sonucunu kaynak kayıtlarına işler. */
export async function katilimSonuclariniIsle(
  sonuclar: KatilmaSonucu[]
): Promise<KatilmaRaporu> {
  const rapor: KatilmaRaporu = { katilan: 0, basarisiz: 0 };

  for (const sonuc of sonuclar) {
    const chatId = String(sonuc.chatId || "").trim();
    if (!chatId) continue;

    const kaynak = await prisma.ilanKaynagi.findUnique({
      where: { tur_hedef: { tur: TELEGRAM_UYE, hedef: chatId } },
      select: { id: true },
    });
    if (!kaynak) continue;

    if (sonuc.katildi) {
      await prisma.ilanKaynagi.update({
        where: { id: kaynak.id },
        data: { aktif: true, durum: "AKTIF", sonHata: null },
      });
      rapor.katilan += 1;
    } else {
      await prisma.ilanKaynagi.update({
        where: { id: kaynak.id },
        data: {
          durum: "ADAY",
          sonHata: (sonuc.hata || "Katılınamadı").slice(0, 300),
        },
      });
      rapor.basarisiz += 1;
    }
  }

  await katilimiIsaretle(rapor.katilan);
  return rapor;
}
