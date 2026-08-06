import { prisma } from "@/lib/prisma";
import {
  aiTercihleriOku,
  SAYAC_MIN_VERI_GUN,
  sayacBaslangicDate,
  sayacBaslangicGaranti,
} from "@/lib/ayarlar";
import { ISTENMEYEN_TERIMLER, yukBasligiMi } from "@/lib/bolgeler";
import { koridorIlKumesi } from "@/lib/koridor";
import { illeriBul, sadelestir } from "@/lib/iller";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";
import { telegramGonder, htmlKacis } from "@/lib/bildirim/telegram";
import { bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";
import { grupSonMesajToplu } from "@/lib/kaynaklar/grupSonMesaj";
import { grupOkumaToplu } from "@/lib/kaynaklar/grupOkumaSayac";
import { ilanSinyaliVarMi } from "@/lib/kaynaklar/onFiltre";

/** Bugün çekilen ≥100 ve SPAM+IL_YOK > %80 → 5g kuralını atla. */
const COP_MIN_CEKILEN = 100;
const COP_ORAN_ESIK = 0.8;

export const GRUP_CIKIS_ONAY_ANAHTAR = "grup_cikis_onay";
export const GRUP_CIKIS_KUYRUK_ANAHTAR = "grup_cikis_kuyruk";
export const GRUP_CIKIS_GUNLUK_ANAHTAR = "grup_cikis_gunluk";
export const GRUP_CIKIS_SON_ANAHTAR = "grup_cikis_son";
/** id → ISO bitiş: "3 gün daha bekle" */
export const GRUP_CIKIS_ERTELEME_ANAHTAR = "grup_cikis_erteleme";

/** Günde max çıkış — boş havuzu hızlı temizle (FloodWait’e dikkat). */
export const CIKIS_GUNLUK_LIMIT = 8;
export const CIKIS_ARA_MS = 30 * 60 * 1000;
const ERTELEME_GUN = 3;

const GUN_MS = 24 * 60 * 60 * 1000;

export type CikisAdayi = {
  id: number;
  ad: string;
  kullaniciAdi: string | null;
  hedef: string;
  sebep: string;
  /** İstatistik (Telegram mesajı) */
  pencereGun: number;
  mesajSayisi: number;
  ilanSayisi: number;
  isabetYuzde: number | null;
};

export type CikisOnayKayit =
  | { tur: "bos" }
  | {
      tur: "bekliyor";
      adaylar: CikisAdayi[];
      zaman: string;
    };

export type CikisKuyrukKayit = {
  idler: number[];
  sebepler: Record<string, string>;
};

function istenmeyenBaslikMi(baslik: string): boolean {
  const sade = sadelestir(baslik);
  if (!sade) return true;
  if (!yukBasligiMi(baslik)) return true;
  return ISTENMEYEN_TERIMLER.some((t) => sade.includes(sadelestir(t)));
}

/** Başlıkta koridor dışı il baskın mı? (Adana, İzmir, Van…) */
function koridorDisiBaslikMi(baslik: string, koridor: Set<string>): boolean {
  const iller = illeriBul(baslik);
  if (iller.length === 0) return false;
  const dis = iller.filter((il) => !koridor.has(il));
  const ic = iller.filter((il) => koridor.has(il));
  return dis.length > 0 && ic.length === 0;
}

async function ertelemeOku(): Promise<Record<string, string>> {
  const k = await prisma.ayar.findUnique({
    where: { anahtar: GRUP_CIKIS_ERTELEME_ANAHTAR },
  });
  if (!k?.deger) return {};
  try {
    const j = JSON.parse(k.deger) as Record<string, string>;
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

async function ertelemeYaz(map: Record<string, string>): Promise<void> {
  const simdi = Date.now();
  const temiz: Record<string, string> = {};
  for (const [id, iso] of Object.entries(map)) {
    const t = Date.parse(iso);
    if (Number.isFinite(t) && t > simdi) temiz[id] = iso;
  }
  if (Object.keys(temiz).length === 0) {
    await prisma.ayar.deleteMany({
      where: { anahtar: GRUP_CIKIS_ERTELEME_ANAHTAR },
    });
    return;
  }
  await prisma.ayar.upsert({
    where: { anahtar: GRUP_CIKIS_ERTELEME_ANAHTAR },
    create: {
      anahtar: GRUP_CIKIS_ERTELEME_ANAHTAR,
      deger: JSON.stringify(temiz),
    },
    update: { deger: JSON.stringify(temiz) },
  });
}

/** AKTİF gruplardan çıkış adaylarını üretir. */
export async function cikisAdaylariniBul(): Promise<CikisAdayi[]> {
  const tercih = await aiTercihleriOku();
  const koridor = new Set(koridorIlKumesi(tercih.koridorIller));
  const {
    sessizGun,
    sifirIlanGun,
    isabetGun,
    korumaGun,
  } = tercih.budama;
  const simdi = Date.now();
  const sayacGun = await sayacBaslangicGaranti();
  const sayacBas = sayacBaslangicDate(sayacGun);
  const veriGun = (simdi - sayacBas.getTime()) / GUN_MS;
  /** Sayaç tabanlı kurallar (0 ilan / isabet) — 5 gün birikim şart */
  const sayacHazir = veriGun >= SAYAC_MIN_VERI_GUN;

  const sessizSinir = new Date(
    Math.max(simdi - sessizGun * GUN_MS, sayacBas.getTime())
  );
  const sifirSinir = new Date(
    Math.max(simdi - sifirIlanGun * GUN_MS, sayacBas.getTime())
  );
  const isabetSinir = new Date(
    Math.max(simdi - isabetGun * GUN_MS, sayacBas.getTime())
  );

  const ertelenen = await ertelemeOku();
  // Süresi dolanları temizle
  await ertelemeYaz(ertelenen);

  const gruplar = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
    select: {
      id: true,
      ad: true,
      kullaniciAdi: true,
      hedef: true,
      createdAt: true,
      sonTarama: true,
      bulunanAdet: true,
    },
  });

  const grupIds = gruplar.map((g) => g.id);
  const [sonMesajMap, okumaMap] = await Promise.all([
    grupSonMesajToplu(grupIds),
    grupOkumaToplu(grupIds),
  ]);
  const adaylar: CikisAdayi[] = [];

  for (const g of gruplar) {
    const ertIso = ertelenen[String(g.id)];
    if (ertIso && Date.parse(ertIso) > simdi) continue;

    const grupYasGun = (simdi - g.createdAt.getTime()) / GUN_MS;
    // Yeni grup koruması — katılımından korumaGun geçmeden aday olamaz
    if (grupYasGun < korumaGun) continue;

    const [sonHam, hamSessiz, hamSifir, ilanPencere, ilanSayactan] =
      await Promise.all([
        prisma.hamMesaj.findFirst({
          where: { kaynakId: g.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.hamMesaj.count({
          where: { kaynakId: g.id, createdAt: { gte: sessizSinir } },
        }),
        prisma.hamMesaj.count({
          where: { kaynakId: g.id, createdAt: { gte: sifirSinir } },
        }),
        prisma.yukIlani.count({
          where: { kaynakId: g.id, createdAt: { gte: sifirSinir } },
        }),
        // Lifetime yerine sayaç başlangıcından — bozuk boru hattı verisi yok
        prisma.yukIlani.count({
          where: { kaynakId: g.id, createdAt: { gte: sayacBas } },
        }),
      ]);

    const sonAktivite = Math.max(
      g.sonTarama?.getTime() ?? 0,
      sonHam?.createdAt.getTime() ?? 0,
      g.createdAt.getTime()
    );
    const sessizGunGecen = (simdi - sonAktivite) / GUN_MS;

    const base = {
      id: g.id,
      ad: g.ad,
      kullaniciAdi: g.kullaniciAdi,
      hedef: g.hedef,
      pencereGun: sessizGun,
      mesajSayisi: hamSessiz,
      ilanSayisi: ilanSayactan,
      isabetYuzde: null as number | null,
    };

    // 0) Konu dışı içerik — son tamponda ilan sinyali yok (HamMesaj'a yazılmasa da)
    // Sayaç beklemez: çöp grup hemen aday.
    const sonMetinler = sonMesajMap.get(g.id) ?? [];
    if (sonMetinler.length >= 10) {
      const sinyalAdet = sonMetinler.filter((m) => ilanSinyaliVarMi(m)).length;
      if (sinyalAdet === 0) {
        adaylar.push({
          ...base,
          sebep: `konu dışı: son ${sonMetinler.length} mesajda ilan sinyali 0`,
          pencereGun: 0,
          mesajSayisi: sonMetinler.length,
          ilanSayisi: ilanSayactan,
        });
        continue;
      }
    }

    // 1) Konu dışı başlık
    if (istenmeyenBaslikMi(g.ad)) {
      adaylar.push({
        ...base,
        sebep: "konu dışı / nakliye değil",
        pencereGun: 0,
        mesajSayisi: hamSessiz,
      });
      continue;
    }

    // 2) sessizGun boyunca HİÇ mesaj (HamMesaj) — sayaç beklemez
    if (hamSessiz === 0 && sessizGunGecen >= sessizGun) {
      adaylar.push({
        ...base,
        sebep: `${sessizGun} gün 0 mesaj`,
        pencereGun: sessizGun,
        mesajSayisi: 0,
        ilanSayisi: ilanSayactan,
      });
      continue;
    }

    // 2b) Çöp oran istisnası — SPAM+IL_YOK > %80 (çekilen ≥100) → 5g ATLA
    const okuma = okumaMap.get(g.id);
    if (okuma && okuma.cekilen >= COP_MIN_CEKILEN) {
      const cop =
        (okuma.elenen.SPAM ?? 0) + (okuma.elenen.IL_YOK ?? 0);
      const oran = cop / okuma.cekilen;
      if (oran > COP_ORAN_ESIK) {
        adaylar.push({
          ...base,
          sebep:
            `çöp %${Math.round(oran * 100)} ` +
            `(SPAM+IL_YOK=${cop}/${okuma.cekilen}) — 5g atlandı`,
          pencereGun: 0,
          mesajSayisi: okuma.cekilen,
          ilanSayisi: ilanSayactan,
        });
        continue;
      }
    }

    // Sayaç tabanlı kurallar: 5 gün veri birikmeden aday yok
    // (çöp / isabet%0 istisnaları yukarıda ve aşağıda)
    if (!sayacHazir) continue;

    // 3) sifirIlanGun mesaj var, 0 ilan (sayaçtan beri)
    if (hamSifir > 0 && ilanPencere === 0 && ilanSayactan === 0) {
      adaylar.push({
        ...base,
        sebep: `${sifirIlanGun} gün mesaj var (${hamSifir}), 0 ilan (sayac ${sayacGun})`,
        pencereGun: sifirIlanGun,
        mesajSayisi: hamSifir,
        ilanSayisi: 0,
      });
      continue;
    }

    // 4) Koridor dışı başlık + sayaçtan beri 0 ilan
    if (koridorDisiBaslikMi(g.ad, koridor) && ilanSayactan === 0) {
      adaylar.push({
        ...base,
        sebep: `koridor dışı başlık, sayaçtan beri 0 ilan`,
        pencereGun: sifirIlanGun,
        mesajSayisi: hamSifir,
        ilanSayisi: 0,
      });
      continue;
    }
  }

  // 5) Düşük koridor isabet
  // - sayaç hazır: isabet <%20
  // - sayaç değil: sadece isabet %0 + pencerede 0 ilan (5g atla)
  {
    const isabetAday = await dusukIsabetCikisAdaylari(
      gruplar
        .filter((g) => (simdi - g.createdAt.getTime()) / GUN_MS >= korumaGun)
        .filter((g) => {
          const ert = ertelenen[String(g.id)];
          return !(ert && Date.parse(ert) > simdi);
        })
        .filter((g) => !adaylar.some((a) => a.id === g.id))
        .map((g) => g.id),
      koridor,
      isabetSinir,
      isabetGun,
      { sadeceSifirIsabet: !sayacHazir }
    );
    for (const a of isabetAday) {
      if (!adaylar.some((x) => x.id === a.id)) {
        if (!sayacHazir) {
          adaylar.push({
            ...a,
            sebep: `isabet %0 + ${isabetGun}g 0 ilan — 5g atlandı`,
          });
        } else {
          adaylar.push(a);
        }
      }
    }
  }

  const gorulen = new Set<number>();
  const tekil = adaylar.filter((a) => {
    if (gorulen.has(a.id)) return false;
    gorulen.add(a.id);
    return true;
  });

  // En kötü önce: konu dışı / 0 ilan / düşük isabet → önce çık
  tekil.sort((a, b) => cikisBudamaSkoru(b) - cikisBudamaSkoru(a));
  return tekil;
}

/** Yüksek skor = önce çıkılacak. */
function cikisBudamaSkoru(a: CikisAdayi): number {
  let s = 0;
  const sebep = a.sebep.toLocaleLowerCase("tr-TR");
  if (/konu d[ıi][sş][ıi]|nakliye de[gğ]il|avrupa|k[oö]pr[uü]/i.test(sebep)) {
    s += 1000;
  }
  if (/[cç][oö]p\s*%/.test(sebep)) s += 800;
  if (/0 mesaj/.test(sebep)) s += 600;
  if (/0 ilan/.test(sebep)) s += 500;
  if (a.ilanSayisi === 0) s += 200;
  if (a.isabetYuzde !== null) s += Math.max(0, 50 - a.isabetYuzde) * 4;
  s -= Math.min(a.ilanSayisi, 40) * 15;
  return s;
}

/**
 * AKTİF grup oncelik = son 7g koridor ilan (TAM/CIKIS/VARIS).
 * Yüksek skorlu gruplar panel + koruma; 0 ilanlılar budamada öne çıkar.
 */
export async function aktifGrupOncelikGuncelle(): Promise<{
  guncellenen: number;
}> {
  const hafta = new Date(Date.now() - 7 * GUN_MS);
  const aktifler = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
    select: { id: true, oncelik: true },
  });
  if (aktifler.length === 0) return { guncellenen: 0 };

  const sayilar = await prisma.yukIlani.groupBy({
    by: ["kaynakId"],
    where: {
      kaynakId: { in: aktifler.map((g) => g.id) },
      createdAt: { gte: hafta },
      koridorTipi: { in: ["TAM", "CIKIS", "VARIS"] },
    },
    _count: { _all: true },
  });
  const map = new Map(
    sayilar
      .filter((s) => s.kaynakId != null)
      .map((s) => [s.kaynakId!, s._count._all])
  );

  let guncellenen = 0;
  for (const g of aktifler) {
    const n = map.get(g.id) ?? 0;
    // 0 → 0; 1–2 → 10+; bol ilan → max 80 (ADAY hasat 10–30 ile çakışmasın)
    const hedef = n === 0 ? 0 : Math.min(80, 10 + n * 5);
    if ((g.oncelik ?? 0) === hedef) continue;
    await prisma.ilanKaynagi.update({
      where: { id: g.id },
      data: { oncelik: hedef },
    });
    guncellenen += 1;
  }
  return { guncellenen };
}

/** İsabet düşük + pencerede yeterli mesaj → çıkış adayı. */
async function dusukIsabetCikisAdaylari(
  kaynakIds: number[],
  koridor: Set<string>,
  pencereBas: Date,
  pencereGun: number,
  secenek: { sadeceSifirIsabet?: boolean } = {}
): Promise<CikisAdayi[]> {
  if (kaynakIds.length === 0) return [];

  const [hamHafta, gruplar, ilanSay] = await Promise.all([
    prisma.hamMesaj.findMany({
      where: { kaynakId: { in: kaynakIds }, createdAt: { gte: pencereBas } },
      select: { kaynakId: true, metin: true },
      take: 4000,
    }),
    prisma.ilanKaynagi.findMany({
      where: { id: { in: kaynakIds } },
      select: {
        id: true,
        ad: true,
        kullaniciAdi: true,
        hedef: true,
      },
    }),
    prisma.yukIlani.groupBy({
      by: ["kaynakId"],
      where: {
        kaynakId: { in: kaynakIds },
        createdAt: { gte: pencereBas },
      },
      _count: { _all: true },
    }),
  ]);

  const ilanMap = new Map(ilanSay.map((m) => [m.kaynakId!, m._count._all]));
  const { satirlaraBol, rotaSatiriMi } = await import(
    "@/lib/kaynaklar/onFiltre"
  );
  const isabetMap = new Map<
    number,
    { hit: number; toplam: number; mesaj: number }
  >();
  for (const h of hamHafta) {
    if (!h.kaynakId) continue;
    let slot = isabetMap.get(h.kaynakId);
    if (!slot) {
      slot = { hit: 0, toplam: 0, mesaj: 0 };
      isabetMap.set(h.kaynakId, slot);
    }
    slot.mesaj += 1;
    for (const satir of satirlaraBol(h.metin)) {
      if (!rotaSatiriMi(satir) && illeriBul(satir).length < 2) continue;
      const iller = illeriBul(satir);
      if (iller.length < 2) continue;
      slot.toplam += 1;
      if (iller.some((il) => koridor.has(il))) slot.hit += 1;
    }
  }

  const sonuc: CikisAdayi[] = [];
  const grupMap = new Map(gruplar.map((g) => [g.id, g]));
  for (const [id, slot] of isabetMap) {
    if (slot.mesaj < 20 || slot.toplam < 5) continue;
    const yuzde = Math.round((100 * slot.hit) / slot.toplam);
    const ilanAdet = ilanMap.get(id) ?? 0;
    if (secenek.sadeceSifirIsabet) {
      // 5g atlama: yalnızca %0 isabet + pencerede 0 ilan
      if (yuzde !== 0 || ilanAdet > 0) continue;
    } else if (yuzde >= 20) {
      continue;
    }
    const g = grupMap.get(id);
    if (!g) continue;
    sonuc.push({
      id: g.id,
      ad: g.ad,
      kullaniciAdi: g.kullaniciAdi,
      hedef: g.hedef,
      sebep: `isabet %${yuzde} (${pencereGun}g ${slot.mesaj} mesaj)`,
      pencereGun,
      mesajSayisi: slot.mesaj,
      ilanSayisi: ilanAdet,
      isabetYuzde: yuzde,
    });
  }
  return sonuc;
}

export async function cikisOnayOku(): Promise<CikisOnayKayit> {
  const k = await prisma.ayar.findUnique({
    where: { anahtar: GRUP_CIKIS_ONAY_ANAHTAR },
  });
  if (!k?.deger) return { tur: "bos" };
  try {
    return JSON.parse(k.deger) as CikisOnayKayit;
  } catch {
    return { tur: "bos" };
  }
}

async function onayYaz(d: CikisOnayKayit | null): Promise<void> {
  if (!d || d.tur === "bos") {
    await prisma.ayar.deleteMany({
      where: { anahtar: GRUP_CIKIS_ONAY_ANAHTAR },
    });
    return;
  }
  await prisma.ayar.upsert({
    where: { anahtar: GRUP_CIKIS_ONAY_ANAHTAR },
    create: { anahtar: GRUP_CIKIS_ONAY_ANAHTAR, deger: JSON.stringify(d) },
    update: { deger: JSON.stringify(d) },
  });
}

export async function cikisKuyrukOku(): Promise<CikisKuyrukKayit> {
  const k = await prisma.ayar.findUnique({
    where: { anahtar: GRUP_CIKIS_KUYRUK_ANAHTAR },
  });
  if (!k?.deger) return { idler: [], sebepler: {} };
  try {
    return JSON.parse(k.deger) as CikisKuyrukKayit;
  } catch {
    return { idler: [], sebepler: {} };
  }
}

async function kuyrukYaz(d: CikisKuyrukKayit): Promise<void> {
  if (d.idler.length === 0) {
    await prisma.ayar.deleteMany({
      where: { anahtar: GRUP_CIKIS_KUYRUK_ANAHTAR },
    });
    return;
  }
  await prisma.ayar.upsert({
    where: { anahtar: GRUP_CIKIS_KUYRUK_ANAHTAR },
    create: { anahtar: GRUP_CIKIS_KUYRUK_ANAHTAR, deger: JSON.stringify(d) },
    update: { deger: JSON.stringify(d) },
  });
}

/**
 * Tek grup için Telegram onay iste (rakamlı + 3 buton).
 * Zaten bekleyen onay varsa tekrar gönderme.
 */
/** Cevapsız kalan onay — bu süre sonra otomatik «Evet» (çıkış kuyruğu). */
const ONAY_ZAMAN_ASIMI_MS = 36 * 60 * 60 * 1000;

export async function cikisOnayiIste(): Promise<{
  aday: number;
  gonderildi: boolean;
}> {
  const mevcut = await cikisOnayOku();
  if (mevcut.tur === "bekliyor" && mevcut.adaylar.length > 0) {
    const yas = Date.now() - Date.parse(mevcut.zaman);
    if (Number.isFinite(yas) && yas >= ONAY_ZAMAN_ASIMI_MS) {
      console.warn(
        `[grup-temizlik] çıkış onayı ${Math.round(yas / 3600e3)}s cevapsız → otomatik evet (${mevcut.adaylar.length} grup)`
      );
      await cikisOnayiniIsle("evet");
    } else {
      return { aday: mevcut.adaylar.length, gonderildi: false };
    }
  }

  const kuyruk = await cikisKuyrukOku();
  const adaylar = (await cikisAdaylariniBul()).filter(
    (a) => !kuyruk.idler.includes(a.id)
  );
  if (adaylar.length === 0) return { aday: 0, gonderildi: false };

  // Tüm adaylar tek onayda (max 12 — Telegram mesaj boyutu)
  const dilim = adaylar.slice(0, 12);
  await onayYaz({
    tur: "bekliyor",
    adaylar: dilim,
    zaman: new Date().toISOString(),
  });

  const tercih = await aiTercihleriOku();
  if (!tercih.telegramChatId) {
    console.warn("[grup-temizlik] telegram_chat_id yok — onay bekliyor DB'de");
    return { aday: dilim.length, gonderildi: false };
  }

  const satirlar = dilim.map((a, i) => {
    const isabetYazi =
      a.isabetYuzde !== null ? `isabet %${a.isabetYuzde}` : "isabet —";
    const gunYazi = a.pencereGun > 0 ? `${a.pencereGun}g` : "şimdi";
    return (
      `${i + 1}) #${a.id} ${htmlKacis(a.ad)}` +
      `${a.kullaniciAdi ? ` (@${htmlKacis(a.kullaniciAdi)})` : ""}\n` +
      `   ${gunYazi} ${a.mesajSayisi} msg, ${a.ilanSayisi} ilan, ${isabetYazi}\n` +
      `   → ${htmlKacis(a.sebep)}`
    );
  });

  const metin =
    `<b>Grup çıkış onayı</b> (${dilim.length} aday)\n\n` +
    satirlar.join("\n\n") +
    `\n\nHepsi için çıkalım mı?`;

  await telegramGonder(tercih.telegramChatId, metin, [
    { metin: "Evet (hepsi)", callback: "gcik:evet" },
    { metin: "Hayır", callback: "gcik:hayir" },
    { metin: "3 gün daha bekle", callback: "gcik:bekle" },
  ]);

  return { aday: dilim.length, gonderildi: true };
}

/**
 * Callback: evet → kuyruk; hayır → iptal; bekle → 3 gün ertele.
 */
export async function cikisOnayiniIsle(
  karar: "evet" | "hayir" | "bekle"
): Promise<{ ok: boolean; mesaj: string }> {
  const mevcut = await cikisOnayOku();
  if (mevcut.tur !== "bekliyor" || mevcut.adaylar.length === 0) {
    return { ok: false, mesaj: "Bekleyen onay yok." };
  }

  if (karar === "hayir") {
    await onayYaz(null);
    return { ok: true, mesaj: "İptal — gruplardan çıkılmayacak." };
  }

  if (karar === "bekle") {
    const map = await ertelemeOku();
    const bitis = new Date(
      Date.now() + ERTELEME_GUN * GUN_MS
    ).toISOString();
    for (const a of mevcut.adaylar) {
      map[String(a.id)] = bitis;
    }
    await ertelemeYaz(map);
    await onayYaz(null);
    return {
      ok: true,
      mesaj: `${mevcut.adaylar.length} grup — ${ERTELEME_GUN} gün ertelendi, tekrar sorulmayacak.`,
    };
  }

  const kuyruk = await cikisKuyrukOku();
  for (const a of mevcut.adaylar) {
    if (!kuyruk.idler.includes(a.id)) kuyruk.idler.push(a.id);
    kuyruk.sebepler[String(a.id)] = a.sebep;
  }
  await kuyrukYaz(kuyruk);
  await onayYaz(null);
  return {
    ok: true,
    mesaj: `${mevcut.adaylar.length} grup çıkış kuyruğuna alındı (günde max ${CIKIS_GUNLUK_LIMIT}, 30 dk ara).`,
  };
}


export function cikisGunlukOku(ham: string | null): {
  gun: string;
  adet: number;
} {
  const bugun = bugunAnahtar();
  if (!ham) return { gun: bugun, adet: 0 };
  const [gun, adetHam] = ham.split(":");
  if (gun !== bugun) return { gun: bugun, adet: 0 };
  const adet = Number(adetHam);
  return { gun: bugun, adet: Number.isFinite(adet) ? adet : 0 };
}

/** Grubu PASIF yap (LeaveChannel sonrası veya sadece takip bırak). */
export async function grubuPasifYap(
  id: number,
  sebep: string
): Promise<void> {
  await prisma.ilanKaynagi.update({
    where: { id },
    data: {
      aktif: false,
      durum: "PASIF",
      sonHata: `Otomatik çıkış: ${sebep}`.slice(0, 300),
    },
  });
}

/** Panel için grup istatistikleri. */
export async function grupIstatistikleri(
  kaynakIds: number[]
): Promise<
  Map<
    number,
    {
      takipGun: number;
      mesajToplam: number;
      ilanAdedi: number;
      sonIlan: Date | null;
    }
  >
> {
  const map = new Map<
    number,
    {
      takipGun: number;
      mesajToplam: number;
      ilanAdedi: number;
      sonIlan: Date | null;
    }
  >();
  if (kaynakIds.length === 0) return map;

  const gruplar = await prisma.ilanKaynagi.findMany({
    where: { id: { in: kaynakIds } },
    select: { id: true, createdAt: true },
  });
  const [mesajlar, ilanlar, sonIlanlar] = await Promise.all([
    prisma.hamMesaj.groupBy({
      by: ["kaynakId"],
      where: { kaynakId: { in: kaynakIds } },
      _count: { _all: true },
    }),
    prisma.yukIlani.groupBy({
      by: ["kaynakId"],
      where: { kaynakId: { in: kaynakIds } },
      _count: { _all: true },
    }),
    prisma.yukIlani.groupBy({
      by: ["kaynakId"],
      where: { kaynakId: { in: kaynakIds } },
      _max: { createdAt: true },
    }),
  ]);

  const mesajMap = new Map(
    mesajlar.map((m) => [m.kaynakId!, m._count._all])
  );
  const ilanMap = new Map(ilanlar.map((m) => [m.kaynakId!, m._count._all]));
  const sonMap = new Map(
    sonIlanlar.map((m) => [m.kaynakId!, m._max.createdAt])
  );
  const simdi = Date.now();

  for (const g of gruplar) {
    map.set(g.id, {
      takipGun: Math.max(
        0,
        Math.floor((simdi - g.createdAt.getTime()) / GUN_MS)
      ),
      mesajToplam: mesajMap.get(g.id) ?? 0,
      ilanAdedi: ilanMap.get(g.id) ?? 0,
      sonIlan: sonMap.get(g.id) ?? null,
    });
  }
  return map;
}
