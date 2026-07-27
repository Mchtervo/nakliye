import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { ISTENMEYEN_TERIMLER, yukBasligiMi } from "@/lib/bolgeler";
import { koridorIlKumesi } from "@/lib/koridor";
import { illeriBul, sadelestir } from "@/lib/iller";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";
import { telegramGonder, htmlKacis } from "@/lib/bildirim/telegram";
import { bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";

export const GRUP_CIKIS_ONAY_ANAHTAR = "grup_cikis_onay";
export const GRUP_CIKIS_KUYRUK_ANAHTAR = "grup_cikis_kuyruk";
export const GRUP_CIKIS_GUNLUK_ANAHTAR = "grup_cikis_gunluk";
export const GRUP_CIKIS_SON_ANAHTAR = "grup_cikis_son";

export const CIKIS_GUNLUK_LIMIT = 3;
export const CIKIS_ARA_MS = 30 * 60 * 1000;

const GUN_MS = 24 * 60 * 60 * 1000;

export type CikisAdayi = {
  id: number;
  ad: string;
  kullaniciAdi: string | null;
  hedef: string;
  sebep: string;
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
  // Sadece dış iller geçiyorsa alakasız
  return dis.length > 0 && ic.length === 0;
}

/** AKTİF gruplardan çıkış adaylarını üretir. */
export async function cikisAdaylariniBul(): Promise<CikisAdayi[]> {
  const tercih = await aiTercihleriOku();
  const koridor = new Set(koridorIlKumesi(tercih.koridorIller));
  const simdi = Date.now();
  const yediGun = new Date(simdi - 7 * GUN_MS);
  const onDortGun = new Date(simdi - 14 * GUN_MS);

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

  const adaylar: CikisAdayi[] = [];

  for (const g of gruplar) {
    // 1) Konu dışı — hemen aday
    if (istenmeyenBaslikMi(g.ad)) {
      adaylar.push({
        id: g.id,
        ad: g.ad,
        kullaniciAdi: g.kullaniciAdi,
        hedef: g.hedef,
        sebep: "konu dışı / nakliye değil",
      });
      continue;
    }

    const [sonHam, ham7, ham14, ilanToplam, sonIlan] = await Promise.all([
      prisma.hamMesaj.findFirst({
        where: { kaynakId: g.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.hamMesaj.count({
        where: { kaynakId: g.id, createdAt: { gte: yediGun } },
      }),
      prisma.hamMesaj.count({
        where: { kaynakId: g.id, createdAt: { gte: onDortGun } },
      }),
      prisma.yukIlani.count({ where: { kaynakId: g.id } }),
      prisma.yukIlani.findFirst({
        where: { kaynakId: g.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const grupYasGun =
      (simdi - g.createdAt.getTime()) / GUN_MS;
    const sonAktivite = Math.max(
      g.sonTarama?.getTime() ?? 0,
      sonHam?.createdAt.getTime() ?? 0,
      g.createdAt.getTime()
    );
    const sessizGun = (simdi - sonAktivite) / GUN_MS;

    // 2) 7 gün 0 mesaj
    if (grupYasGun >= 7 && ham7 === 0 && sessizGun >= 7) {
      adaylar.push({
        id: g.id,
        ad: g.ad,
        kullaniciAdi: g.kullaniciAdi,
        hedef: g.hedef,
        sebep: "7 gün 0 mesaj",
      });
      continue;
    }

    // 3) 14 gün mesaj var, 0 ilan
    if (grupYasGun >= 14 && ham14 > 0 && ilanToplam === 0) {
      adaylar.push({
        id: g.id,
        ad: g.ad,
        kullaniciAdi: g.kullaniciAdi,
        hedef: g.hedef,
        sebep: `14 gün mesaj var (${ham14}), 0 ilan`,
      });
      continue;
    }

    // 4) Koridor dışı başlık + 7 gün 0 ilan
    if (
      koridorDisiBaslikMi(g.ad, koridor) &&
      grupYasGun >= 7 &&
      ilanToplam === 0
    ) {
      adaylar.push({
        id: g.id,
        ad: g.ad,
        kullaniciAdi: g.kullaniciAdi,
        hedef: g.hedef,
        sebep: "koridor dışı başlık, 7g 0 ilan",
      });
      continue;
    }

    void sonIlan;
  }

  // Tekilleştir
  const gorulen = new Set<number>();
  return adaylar.filter((a) => {
    if (gorulen.has(a.id)) return false;
    gorulen.add(a.id);
    return true;
  });
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
    await prisma.ayar.delete({ where: { anahtar: GRUP_CIKIS_ONAY_ANAHTAR } }).catch(
      () => null
    );
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
    await prisma.ayar
      .delete({ where: { anahtar: GRUP_CIKIS_KUYRUK_ANAHTAR } })
      .catch(() => null);
    return;
  }
  await prisma.ayar.upsert({
    where: { anahtar: GRUP_CIKIS_KUYRUK_ANAHTAR },
    create: { anahtar: GRUP_CIKIS_KUYRUK_ANAHTAR, deger: JSON.stringify(d) },
    update: { deger: JSON.stringify(d) },
  });
}

/**
 * Aday bul → Telegram'da onay iste.
 * Zaten bekleyen onay varsa tekrar gönderme.
 */
export async function cikisOnayiIste(): Promise<{
  aday: number;
  gonderildi: boolean;
}> {
  const mevcut = await cikisOnayOku();
  if (mevcut.tur === "bekliyor" && mevcut.adaylar.length > 0) {
    return { aday: mevcut.adaylar.length, gonderildi: false };
  }

  const kuyruk = await cikisKuyrukOku();
  const adaylar = (await cikisAdaylariniBul()).filter(
    (a) => !kuyruk.idler.includes(a.id)
  );
  if (adaylar.length === 0) return { aday: 0, gonderildi: false };

  // Telegram mesajına en fazla 5 aday
  const dilim = adaylar.slice(0, 5);
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

  const liste = dilim
    .map(
      (a, i) =>
        `${i + 1}) ${htmlKacis(a.ad)}${a.kullaniciAdi ? ` (@${htmlKacis(a.kullaniciAdi)})` : ""}\n   → ${htmlKacis(a.sebep)}`
    )
    .join("\n");

  await telegramGonder(
    tercih.telegramChatId,
    `<b>Grup çıkış onayı</b>\nŞu ${dilim.length} gruptan çıkılacak:\n\n${liste}\n\nOnaylıyor musun?`,
    [
      { metin: "Evet, çık", callback: "gcik:evet" },
      { metin: "Hayır", callback: "gcik:hayir" },
    ]
  );

  return { aday: dilim.length, gonderildi: true };
}

/** Callback: Evet → kuyruğa al; Hayır → iptal. */
export async function cikisOnayiniIsle(
  evet: boolean
): Promise<{ ok: boolean; mesaj: string }> {
  const mevcut = await cikisOnayOku();
  if (mevcut.tur !== "bekliyor" || mevcut.adaylar.length === 0) {
    return { ok: false, mesaj: "Bekleyen onay yok." };
  }

  if (!evet) {
    await onayYaz(null);
    return { ok: true, mesaj: "İptal — gruplardan çıkılmayacak." };
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
