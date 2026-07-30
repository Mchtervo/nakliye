import { prisma } from "@/lib/prisma";
import {
  BOS_BOLGE_KIRILIM,
  bolgeKirilimTopla,
  ilanlariCozumle,
  mesajlariCozumle,
  type BolgeEleKirilim,
  type CozumFiltre,
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
  type AiTercihleri,
} from "@/lib/ayarlar";
import {
  aramaSorgulariUret,
  grubuDegerlendir,
  ilinBolgesi,
  koridorBaslikOnceligi,
  yukBasligiMi,
  type BolgeKodu,
} from "@/lib/bolgeler";
import { koridorIlKumesi } from "@/lib/koridor";
import { yukIlanlariniBildir } from "@/lib/bildirim/gonder";
import { yaklasikKarayoluKm, VARIS_UZA_KM } from "@/lib/ilMesafe";
import { ilBul } from "@/lib/iller";
import { aiGeceMi, elemeArtir } from "@/lib/kaynaklar/elemeSayac";
import { araciUyuyorMu, ilgilileriSuz } from "@/lib/kaynaklar/filtre";
import { grupOkumaArtir, grupOkumaToplu } from "@/lib/kaynaklar/grupOkumaSayac";
import { grupIstatistikleri } from "@/lib/kaynaklar/grupTemizlik";
import {
  elemeSebebi,
  metinHashUret,
  rotaHashleri,
  yeniSatirlariSec,
} from "@/lib/kaynaklar/onFiltre";
import {
  aiOncesiHazirla,
  sonGorulmeleriYenile,
} from "@/lib/kaynaklar/onDedup";
import { guvenliKirp } from "@/lib/metin";
import { ilanlariKaydet, type KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

export const TELEGRAM_UYE = "TELEGRAM_UYE";

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
  gruplar: {
    id: number;
    chatId: string;
    kullaniciAdi: string | null;
    sonMesajId: number | null;
  }[];
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
    select: { id: true, hedef: true, kullaniciAdi: true, sonMesajId: true },
  });

  return {
    aktif: true,
    ilkOkumaAdedi: ILK_OKUMA_ADEDI,
    gruplar: kaynaklar.map((k) => ({
      id: k.id,
      chatId: k.hedef,
      kullaniciAdi: k.kullaniciAdi,
      sonMesajId: k.sonMesajId,
    })),
  };
}

export type GelenGrup = {
  id: number;
  sonMesajId?: number | null;
  mesajlar: {
    mesajId?: number | null;
    metin: string;
    gonderenUserId?: string | null;
  }[];
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
  /** Daemon log: sayı yetmez, metnin ilk 100 karakteri. */
  const elemeOrnekLogla = (sebep: string, metin: string) => {
    const ornek = metin.replace(/\s+/g, " ").trim().slice(0, 100);
    console.log(`elenen ${sebep}: ${JSON.stringify(ornek)}`);
  };

  const tercih = await aiTercihleriOku();
  const hedefIller = new Set(koridorIlKumesi(tercih.koridorIller));

  // Bu turda görülen satır hash'leri (oturum içi). DB sorgusu mesaj bazında.
  const turIci = new Set<string>();
  const yeniHashler: string[] = [];

  for (const grup of gruplar) {
    const kaynak = await prisma.ilanKaynagi.findUnique({
      where: { id: grup.id },
      select: { id: true, tur: true, sonMesajId: true },
    });
    if (!kaynak || kaynak.tur !== TELEGRAM_UYE) continue;

    rapor.grup += 1;
    rapor.alinan += grup.mesajlar.length;

    // Ön filtre öncesi tampon — budama konu dışı için
    if (grup.mesajlar.length > 0) {
      const { grupSonMesajEkle } = await import("@/lib/kaynaklar/grupSonMesaj");
      await grupSonMesajEkle(
        kaynak.id,
        grup.mesajlar.map((m) => m.metin)
      ).catch(() => null);
    }

    const grupElenen: Record<string, number> = {};
    const eleGrup = (sebep: string, metin: string, n = 1) => {
      ele(sebep, n);
      grupElenen[sebep] = (grupElenen[sebep] ?? 0) + n;
      elemeOrnekLogla(sebep, metin);
    };

    const adaylar: {
      mesajId: number | null;
      metin: string;
      hash: string;
      gonderenUserId: string | null;
    }[] = [];

    for (const m of grup.mesajlar.slice(0, 200)) {
      const sebep = elemeSebebi(m.metin, hedefIller);
      if (sebep) {
        eleGrup(sebep, m.metin);
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
        eleGrup("SATIR_TEKRAR", m.metin);
        continue;
      }

      // AI öncesi: telefon+rota 48s içinde tamamen kayıtlıysa kuyruğa alma.
      const onDedup = await aiOncesiHazirla(secim.metin);
      if (onDedup.tur === "atla") {
        await sonGorulmeleriYenile(onDedup.yenilenen);
        eleGrup("ROTA_DEDUP", m.metin, onDedup.rotaSayisi || 1);
        continue;
      }
      if (onDedup.yenilenen.length > 0) {
        await sonGorulmeleriYenile(onDedup.yenilenen);
      }

      const kuyrukMetin = onDedup.metin;
      const hash = metinHashUret(kuyrukMetin);
      if (adaylar.some((a) => a.hash === hash)) {
        eleGrup("TEKRAR", m.metin);
        continue;
      }

      adaylar.push({
        mesajId: m.mesajId ?? null,
        metin: guvenliKirp(kuyrukMetin, 2000),
        hash,
        gonderenUserId: m.gonderenUserId || null,
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
          gonderenUserId: a.gonderenUserId,
        })),
        skipDuplicates: true,
      });
      kuyrukEklenen = sonuc.count;
      rapor.kuyruga += sonuc.count;

      // skipDuplicates eski satırı atlar — userId sonradan geldiyse doldur
      for (const a of adaylar) {
        if (!a.gonderenUserId || a.mesajId == null) continue;
        await prisma.hamMesaj.updateMany({
          where: {
            kaynakId: kaynak.id,
            mesajId: a.mesajId,
            gonderenUserId: null,
          },
          data: { gonderenUserId: a.gonderenUserId },
        });
      }
    }

    // Grup bazlı teşhis: çekilen vs elenen ayrımı.
    if (grup.mesajlar.length > 0 || Object.keys(grupElenen).length > 0) {
      await grupOkumaArtir(kaynak.id, {
        cekilen: grup.mesajlar.length,
        kuyruk: kuyrukEklenen,
        elenen: grupElenen,
      });
    }

    // Entity bulunamayan / gruptan çıkılmış → PASIF (silme).
    const entityYok =
      Boolean(grup.hata) &&
      (/could not find the input entity/i.test(grup.hata || "") ||
        /PEER_ID_INVALID/i.test(grup.hata || "") ||
        /CHANNEL_PRIVATE/i.test(grup.hata || "") ||
        /gruptan ayrıl/i.test(grup.hata || ""));

    await prisma.ilanKaynagi.update({
      where: { id: kaynak.id },
      data: {
        sonTarama: new Date(),
        sonHata: grup.hata
          ? (entityYok
              ? "Takip edilmiyor — Telegram erişimi yok (gruptan çıkılmış veya entity çözülemedi)."
              : grup.hata
            ).slice(0, 300)
          : null,
        ...(entityYok ? { aktif: false, durum: "PASIF" } : {}),
        ...(typeof grup.sonMesajId === "number" &&
        grup.sonMesajId > 0 &&
        !entityYok
          ? {
              // Canlı olay + catch-up yarışı: asla geri alma
              sonMesajId: Math.max(kaynak.sonMesajId ?? 0, grup.sonMesajId),
            }
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
  /** Kaydet: aynı rota 48s içinde yenilendi, yeni satır yok. */
  dedupAtlanan: number;
  bildirilen: number;
  kalan: number;
  hata: string | null;
  /** Gece penceresinde AI ertelendi. */
  geceErtelendi?: boolean;
  bolgeElenen?: number;
  cagriSayisi?: number;
  /** Bu turda seçilen ham mesaj id'leri (test tekrarı için). */
  mesajIdler?: number[];
};

type PartiMesaj = { id: number; metin: string };

/**
 * Kayıt öncesi: araç tipi + koridor (iki uç).
 * Araç belirsiz (kod/metin yok) → geçir; sadece açık uyumsuz elenir.
 */
function ilanKaydaUygunMu(
  ilan: CozulmusIlan,
  tercih: AiTercihleri,
  anaUs: string | null,
  koridorSet: Set<string>,
  hamMetin?: string
): boolean {
  if (!araciUyuyorMu(ilan, tercih, hamMetin)) return false;
  if (!ilan.cikisIl || !ilan.varisIl) return false;

  // HEM çıkış HEM varış koridorda.
  if (!koridorSet.has(ilan.cikisIl) || !koridorSet.has(ilan.varisIl)) {
    return false;
  }

  if (anaUs) {
    const km = yaklasikKarayoluKm(anaUs, ilan.varisIl);
    if (km !== null && km > VARIS_UZA_KM) return false;
  }
  return true;
}

/**
 * Tek mesaj — en son çare. Parti ikiye bölüne bölüne buraya iner.
 */
async function tekMesajCozumle(
  mesaj: PartiMesaj,
  kapsam: string[],
  filtre: CozumFiltre
): Promise<{
  sonuc: MesajIlani[];
  basarili: number[];
  basarisiz: number[];
  cagri: number;
}> {
  try {
    const ilanlar = await ilanlariCozumle(mesaj.metin, kapsam, filtre);
    return {
      sonuc: ilanlar.map((ilan) => ({ anahtar: mesaj.id, ilan })),
      basarili: [mesaj.id],
      basarisiz: [],
      cagri: 1,
    };
  } catch (hata) {
    const { aiSertDurdurma } = await import("@/lib/ai/istemci");
    if (aiSertDurdurma(hata)) throw hata;

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
  bitis: number,
  filtre: CozumFiltre
): Promise<{
  sonuc: MesajIlani[];
  basarili: number[];
  basarisiz: number[];
  bolgeElenen: number;
  bolgeKirilim: BolgeEleKirilim;
  cagri: number;
}> {
  if (parti.length === 0) {
    return {
      sonuc: [],
      basarili: [],
      basarisiz: [],
      bolgeElenen: 0,
      bolgeKirilim: { ...BOS_BOLGE_KIRILIM },
      cagri: 0,
    };
  }
  if (Date.now() > bitis) {
    return {
      sonuc: [],
      basarili: [],
      basarisiz: [],
      bolgeElenen: 0,
      bolgeKirilim: { ...BOS_BOLGE_KIRILIM },
      cagri: 0,
    };
  }

  if (parti.length === 1) {
    const tek = await tekMesajCozumle(parti[0], kapsam, filtre);
    return { ...tek, bolgeElenen: 0, bolgeKirilim: { ...BOS_BOLGE_KIRILIM } };
  }

  try {
    const rapor = await mesajlariCozumle(
      parti.map((m) => ({ anahtar: m.id, metin: m.metin })),
      kapsam,
      filtre
    );
    return {
      sonuc: rapor.ilanlar,
      basarili: parti.map((m) => m.id),
      basarisiz: [],
      bolgeElenen: rapor.bolgeElenen,
      bolgeKirilim: rapor.bolgeKirilim,
      cagri: 1,
    };
  } catch (hata) {
    const { aiSertDurdurma } = await import("@/lib/ai/istemci");
    // Tavan / günlük bütçe: yarıya bölüp yeniden deneme = daha çok çağrı.
    if (aiSertDurdurma(hata)) throw hata;

    const orta = Math.ceil(parti.length / 2);
    const sol = await bolerekCozumle(
      parti.slice(0, orta),
      kapsam,
      bitis,
      filtre
    );
    const sag = await bolerekCozumle(
      parti.slice(orta),
      kapsam,
      bitis,
      filtre
    );
    return {
      sonuc: [...sol.sonuc, ...sag.sonuc],
      basarili: [...sol.basarili, ...sag.basarili],
      basarisiz: [...sol.basarisiz, ...sag.basarisiz],
      bolgeElenen: sol.bolgeElenen + sag.bolgeElenen,
      bolgeKirilim: bolgeKirilimTopla(sol.bolgeKirilim, sag.bolgeKirilim),
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
  {
    id: number;
    metin: string;
    kaynakId: number | null;
    denemeSayisi: number;
    gonderenUserId: string | null;
    mesajId: number | null;
  }[]
> {
  const havuz = await prisma.hamMesaj.findMany({
    // denemeSayisi >= AI_MAX_DENEME → daha deneme yok.
    where: { islendi: false, denemeSayisi: { lt: AI_MAX_DENEME } },
    orderBy: { createdAt: "asc" },
    take: limit * 5,
    select: {
      id: true,
      metin: true,
      kaynakId: true,
      denemeSayisi: true,
      gonderenUserId: true,
      mesajId: true,
    },
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
  /** Verilirse partiSec atlanır — aynı 10 mesajı yeniden ölçmek için. */
  mesajIdler?: number[];
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
    dedupAtlanan: 0,
    bildirilen: 0,
    kalan: 0,
    hata: null,
    bolgeElenen: 0,
    cagriSayisi: 0,
    mesajIdler: [],
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

  const hedefLimit = Math.max(1, Math.min(limit, 25));
  const secilen =
    secenek.mesajIdler && secenek.mesajIdler.length > 0
      ? await prisma.hamMesaj.findMany({
          where: {
            id: { in: secenek.mesajIdler },
            islendi: false,
            denemeSayisi: { lt: AI_MAX_DENEME },
          },
          select: {
            id: true,
            metin: true,
            kaynakId: true,
            denemeSayisi: true,
            gonderenUserId: true,
            mesajId: true,
          },
        })
      : await partiSec(hedefLimit);
  if (secilen.length === 0) return rapor;
  rapor.mesajIdler = secilen.map((m) => m.id);

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

  // AI öncesi rota dedup — spam listeler OpenAI'ye gitmesin.
  const aiParti: {
    id: number;
    metin: string;
    kaynakId: number | null;
    gonderenUserId: string | null;
    mesajId: number | null;
  }[] = [];
  let onDedupAtlanan = 0;
  for (const m of parti) {
    const on = await aiOncesiHazirla(m.metin);
    if (on.yenilenen.length > 0) {
      await sonGorulmeleriYenile(on.yenilenen);
    }
    if (on.tur === "atla") {
      await prisma.hamMesaj.update({
        where: { id: m.id },
        data: {
          islendi: true,
          hata: null,
          denemeSayisi: { decrement: 1 }, // AI denemedi — sayacı geri al
        },
      });
      onDedupAtlanan += 1;
      continue;
    }
    aiParti.push({
      id: m.id,
      metin: on.metin,
      kaynakId: m.kaynakId,
      gonderenUserId:
        "gonderenUserId" in m ? (m.gonderenUserId as string | null) : null,
      mesajId: "mesajId" in m ? (m.mesajId as number | null) : null,
    });
  }
  if (onDedupAtlanan > 0) {
    await elemeArtir({ ROTA_DEDUP: onDedupAtlanan });
    rapor.islenen += onDedupAtlanan;
  }
  if (aiParti.length === 0) {
    rapor.kalan = await prisma.hamMesaj.count({ where: { islendi: false } });
    return rapor;
  }

  const tercih = await aiTercihleriOku();
  const kapsam = koridorIlKumesi(tercih.koridorIller);
  const anaUs = tercih.anaUs || ilBul(tercih.sehir);
  // Prompt ve sunucu filtresi AYNI koridor listesi (iki uç zorunlu).
  const filtre: CozumFiltre = { filtreIlleri: kapsam, anaUs };
  const bitis = Date.now() + COZUM_BUTCE_MS;

  const cozum = await bolerekCozumle(
    aiParti.map((m) => ({ id: m.id, metin: m.metin })),
    kapsam,
    bitis,
    filtre
  );

  const cozulenler = cozum.sonuc;
  rapor.islenen += cozum.basarili.length + cozum.basarisiz.length;
  rapor.bolgeElenen = cozum.bolgeElenen;
  rapor.cagriSayisi = cozum.cagri;

  if (cozum.bolgeElenen > 0) {
    await elemeArtir({
      BOLGE_ROTA: cozum.bolgeElenen,
      BOLGE_ROTA_CIKIS_DISI: cozum.bolgeKirilim.cikisDisi,
      BOLGE_ROTA_VARIS_DISI: cozum.bolgeKirilim.varisDisi,
      BOLGE_ROTA_IKISI_DISI: cozum.bolgeKirilim.ikisiDisi,
    });
  }
  if (cozum.cagri > 0) {
    await elemeArtir({ AI_CAGRI: cozum.cagri });
  }

  const metinler = new Map(aiParti.map((m) => [m.id, m.metin]));
  const kaynaklar = new Map(aiParti.map((m) => [m.id, m.kaynakId]));
  const gonderenler = new Map(aiParti.map((m) => [m.id, m.gonderenUserId]));
  const kaynakMesajlar = new Map(aiParti.map((m) => [m.id, m.mesajId]));
  // Orijinal ham metin kaydı için (kısmi metin yerine tam)
  const hamTam = new Map(parti.map((m) => [m.id, m.metin]));

  // Aynı kaynağa ait ilanlar birlikte kaydedilir.
  const kaynagaGore = new Map<
    number | null,
    {
      ilan: CozulmusIlan;
      hamMetin: string;
      gonderenUserId?: string | null;
      kaynakMesajId?: number | null;
      hamMesajId?: number | null;
    }[]
  >();

  const koridorSet = new Set(kapsam);
  let aracElenen = 0;
  let uzakElenen = 0;
  let tonajElenen = 0;
  const istiap = tercih.maliyet.tonaj;
  for (const { anahtar, ilan } of cozulenler) {
    const hamMetin = hamTam.get(anahtar) ?? metinler.get(anahtar) ?? "";
    // Tonaj aşımı → kaydet ama ELENDI (sebep hamMetin öneki + durum)
    if (
      ilan.tonaj != null &&
      ilan.tonaj > istiap &&
      ilan.cikisIl &&
      ilan.varisIl
    ) {
      const kaynakId = kaynaklar.get(anahtar) ?? null;
      await ilanlariKaydet(
        kaynakId,
        [
          {
            ilan,
            hamMetin,
            gonderenUserId: gonderenler.get(anahtar) ?? null,
            kaynakMesajId: kaynakMesajlar.get(anahtar) ?? null,
            hamMesajId: anahtar,
          },
        ],
        { durum: "ELENDI" }
      );
      tonajElenen += 1;
      continue;
    }
    if (!ilanKaydaUygunMu(ilan, tercih, anaUs, koridorSet, hamMetin)) {
      if (!araciUyuyorMu(ilan, tercih, hamMetin)) aracElenen += 1;
      else uzakElenen += 1;
      continue;
    }
    const kaynakId = kaynaklar.get(anahtar) ?? null;
    const uid = gonderenler.get(anahtar) ?? null;
    const tgMsg = kaynakMesajlar.get(anahtar) ?? null;
    if (!uid) {
      console.warn(
        `[kuyruk] uid YOK hamMesaj=#${anahtar} tgMsg=${tgMsg ?? "-"} ` +
          `${ilan.cikisIl || "?"}→${ilan.varisIl || "?"}`
      );
    }
    const liste = kaynagaGore.get(kaynakId) ?? [];
    liste.push({
      ilan,
      hamMetin,
      gonderenUserId: uid,
      kaynakMesajId: tgMsg,
      hamMesajId: anahtar, // HamMesaj.id — kalıcı bağ
    });
    kaynagaGore.set(kaynakId, liste);
  }
  if (aracElenen > 0) await elemeArtir({ ARAC_TIP: aracElenen });
  if (uzakElenen > 0) await elemeArtir({ BOLGE_ROTA: uzakElenen });
  if (tonajElenen > 0) await elemeArtir({ TONAJ_ASIMI: tonajElenen });

  const yeniler: KaydedilenIlan[] = [];
  for (const [kaynakId, bulunanlar] of kaynagaGore) {
    const kayit = await ilanlariKaydet(kaynakId, bulunanlar);
    yeniler.push(...kayit.yeniler);
    rapor.dedupAtlanan += kayit.dedupAtlanan;

    if (kaynakId && kayit.yeniler.length > 0) {
      await prisma.ilanKaynagi.update({
        where: { id: kaynakId },
        data: { bulunanAdet: { increment: kayit.yeniler.length } },
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
  /** Bugün kuyruğa giren. */
  kuyrukBugun: number;
  /** Son 7 günde kuyruğa giren. */
  mesajHafta: number;
  /** Son 7 günde üretilen ilan. */
  ilanHafta: number;
  /** Bugün ön filtreyle elenen (sebep → adet). */
  elenenBugun: Record<string, number>;
  /** Kuyrukta bekleyen (henüz AI görmemiş) mesaj. */
  bekleyen: number;
  /** Gerçek ilan sayısı — sayaç değil, tablodan sayılır. */
  ilanAdedi: number;
  /** Takipte kaç gün. */
  takipGun: number;
  /** Toplam çekilen ham mesaj. */
  mesajToplam: number;
  /** Son ilan zamanı. */
  sonIlan: Date | null;
  /**
   * Koridor isabet % — 7g satır-rotalarında ≥1 uç koridorda.
   * null = ölçülecek rota yok.
   */
  koridorIsabet: number | null;
  hasatKaynak: string | null;
  oncelik: number;
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
  if (g.durum === "PASIF" || !g.aktif) {
    return g.sonHata?.startsWith("Takip edilmiyor")
      ? g.sonHata
      : g.sonHata
        ? `Takip edilmiyor: ${g.sonHata.slice(0, 80)}`
        : "Takip edilmiyor";
  }
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

  const tercih = await aiTercihleriOku();
  const koridor = new Set(koridorIlKumesi(tercih.koridorIller));
  const { sayacBaslangicGaranti, sayacBaslangicDate } = await import(
    "@/lib/ayarlar"
  );
  const sayacGun = await sayacBaslangicGaranti();
  const sayacBas = sayacBaslangicDate(sayacGun);

  const dun = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yediGunHam = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // İsabet/ilan: sayaçtan eski veri yok say
  const yediGun = new Date(Math.max(yediGunHam.getTime(), sayacBas.getTime()));
  const ids = gruplar.map((g) => g.id);
  const [
    sonGun,
    haftaMesaj,
    haftaIlan,
    bekleyen,
    ilanlar,
    okumaMap,
    istatMap,
    hamHafta,
  ] = await Promise.all([
    prisma.hamMesaj.groupBy({
      by: ["kaynakId"],
      where: { createdAt: { gte: dun } },
      _count: { _all: true },
    }),
    prisma.hamMesaj.groupBy({
      by: ["kaynakId"],
      where: { createdAt: { gte: yediGun } },
      _count: { _all: true },
    }),
    prisma.yukIlani.groupBy({
      by: ["kaynakId"],
      where: { createdAt: { gte: yediGun } },
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
    grupIstatistikleri(ids),
    prisma.hamMesaj.findMany({
      where: {
        kaynakId: { in: ids },
        createdAt: { gte: yediGun },
      },
      select: { kaynakId: true, metin: true },
      take: 3000,
    }),
  ]);

  const say = (
    liste: { kaynakId: number | null; _count: { _all: number } }[],
    id: number
  ) => liste.find((x) => x.kaynakId === id)?._count._all ?? 0;

  // Koridor isabet: satırda ≥2 il → en az biri koridorda mı?
  const isabetMap = new Map<number, { hit: number; toplam: number }>();
  const { illeriBul } = await import("@/lib/iller");
  const { satirlaraBol, rotaSatiriMi } = await import(
    "@/lib/kaynaklar/onFiltre"
  );
  for (const h of hamHafta) {
    if (!h.kaynakId) continue;
    let slot = isabetMap.get(h.kaynakId);
    if (!slot) {
      slot = { hit: 0, toplam: 0 };
      isabetMap.set(h.kaynakId, slot);
    }
    for (const satir of satirlaraBol(h.metin)) {
      if (!rotaSatiriMi(satir) && illeriBul(satir).length < 2) continue;
      const iller = illeriBul(satir);
      if (iller.length < 2) continue;
      slot.toplam += 1;
      if (iller.some((il) => koridor.has(il))) slot.hit += 1;
    }
  }

  return gruplar.map((g) => {
    const okuma = okumaMap.get(g.id);
    const istat = istatMap.get(g.id);
    const mesaj24s = say(sonGun, g.id);
    const mesajHafta = say(haftaMesaj, g.id);
    const ilanHafta = say(haftaIlan, g.id);
    const bek = say(bekleyen, g.id);
    const ilanAdedi = say(ilanlar, g.id);
    const cekilenBugun = okuma?.cekilen ?? 0;
    const kuyrukBugun = okuma?.kuyruk ?? 0;
    const elenenBugun = okuma?.elenen ?? {};
    const isb = isabetMap.get(g.id);
    const koridorIsabet =
      isb && isb.toplam > 0
        ? Math.round((100 * isb.hit) / isb.toplam)
        : null;
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
      kuyrukBugun,
      mesajHafta,
      ilanHafta,
      elenenBugun,
      bekleyen: bek,
      ilanAdedi,
      takipGun: istat?.takipGun ?? 0,
      mesajToplam: istat?.mesajToplam ?? 0,
      sonIlan: istat?.sonIlan ?? null,
      koridorIsabet,
      hasatKaynak: g.hasatKaynak ?? null,
      oncelik: g.oncelik ?? 0,
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

  const tumSorgular = aramaSorgulariUret(
    tercih.bolgeler,
    tercih.koridorIller
  );
  const siraHam = Number(await ayarOku(AYAR_ANAHTARLARI.telegramSorguSira));
  const sira = Number.isFinite(siraHam) && siraHam >= 0 ? siraHam : 0;
  const { kesifSorguDilimi } = await import("@/lib/bolgeler");
  // Panel/API kısa tur: 5 sorgu (cron 20 kullanır)
  const dilim = kesifSorguDilimi(tumSorgular, sira, 5);
  await ayarYaz(
    AYAR_ANAHTARLARI.telegramSorguSira,
    String(dilim.sonrakiSira)
  );

  return { aktif: true, sorgular: dilim.sorgular, adayKontrol };
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

    // Kullanıcı peer id pozitif; kanal/süpergrup negatif (−100…).
    // Kişi hesabı keşif sonucu olarak gelirse ele.
    const chatIdSayi = Number(chatId);
    if (Number.isFinite(chatIdSayi) && chatIdSayi > 0) {
      rapor.elenen += 1;
      continue;
    }
    if (baslik.startsWith("@") && !baslik.slice(1).includes(" ")) {
      // Ham @username başlık — tip doğrulanmamış kişi kalıntısı
      rapor.elenen += 1;
      continue;
    }

    const uye = grup.uye === true;
    const ku = (grup.kullaniciAdi || "").trim().toLowerCase();
    // chatId veya @username ile eşle (dialog/entity id farkı olmasın).
    const mevcut = kayitli.get(chatId) ?? (ku ? kayitliKullanici.get(ku) : undefined);

    if (mevcut) {
      // Elle katılınmış ADAY: başlık uygunsa AKTİF, değilse PASIF (silme).
      if (uye && mevcut.durum === "ADAY") {
        const uygun = yukBasligiMi(baslik);
        await prisma.ilanKaynagi.update({
          where: { id: mevcut.id },
          data: {
            aktif: uygun,
            durum: uygun ? "AKTIF" : "PASIF",
            sonHata: uygun
              ? null
              : "Takip edilmiyor — başlıkta nakliye terimi yok (elle Takibe al).",
            hedef: chatId,
            ad: baslik.slice(0, 120),
            kullaniciAdi: grup.kullaniciAdi || undefined,
          },
        });
        if (uygun) rapor.terfi += 1;
      }
      continue;
    }

    // Üye + yük başlığı → AKTİF. Üye ama alakasız → PASIF (listede kalsın).
    // Üye değil → keşif filtresiyle ADAY veya ele.
    if (uye) {
      const uygun = yukBasligiMi(baslik);
      await prisma.ilanKaynagi.create({
        data: {
          tur: TELEGRAM_UYE,
          hedef: chatId,
          ad: baslik.slice(0, 120),
          aktif: uygun,
          durum: uygun ? "AKTIF" : "PASIF",
          bolge: ilinBolgesi(ilBul(baslik)),
          kullaniciAdi: grup.kullaniciAdi || null,
          uyeSayisi:
            typeof grup.uyeSayisi === "number" && grup.uyeSayisi > 0
              ? grup.uyeSayisi
              : null,
          sonHata: uygun
            ? null
            : "Takip edilmiyor — başlıkta nakliye terimi yok (elle Takibe al).",
        },
      });
      if (uygun) rapor.hazirUyelik += 1;
      continue;
    }

    const karar = grubuDegerlendir(baslik, tercih.bolgeler);
    if (!karar.uygun) {
      rapor.elenen += 1;
      continue;
    }

    const koridorPuan = koridorBaslikOnceligi(baslik);
    await prisma.ilanKaynagi.create({
      data: {
        tur: TELEGRAM_UYE,
        hedef: chatId,
        ad: baslik.slice(0, 120),
        // aktif=true → otomatik katılım kuyruğu (cron-katil)
        aktif: Boolean(grup.kullaniciAdi),
        durum: "ADAY",
        bolge: karar.bolge,
        kullaniciAdi: grup.kullaniciAdi || null,
        uyeSayisi:
          typeof grup.uyeSayisi === "number" && grup.uyeSayisi > 0
            ? grup.uyeSayisi
            : null,
        oncelik: koridorPuan > 0 ? 10 + koridorPuan : 0,
        hasatKaynak: "arama",
      },
    });
    rapor.yeniAday += 1;
  }

  return rapor;
}
