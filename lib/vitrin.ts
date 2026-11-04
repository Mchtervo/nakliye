/**
 * Herkese açık vitrin (/ilanlar): üye olmayan ziyaretçiye birkaç ilan gösterilir.
 *
 * GİZLİLİK: telefon, firma/kişi adı, mesaj metni, kaynak ve kimlik HİÇ seçilmez;
 * istemciye (sayfa kaynağına) yalnız aşağıdaki alanlar gider. Yeni alan eklerken
 * "bu bilgi üyelik değeri mi?" diye sor.
 *
 * Ziyaretçi ilanı VITRIN_GECIKME_DK dakika gecikmeyle görür; taze ilan üyeye aittir.
 */
import { anaPrisma } from "@/lib/prismaAna";
import { fiyatGorunumu } from "@/lib/ilanGorunum";
import { aracTipiAdi } from "@/lib/arac";
import { LISTE_GUVEN } from "@/lib/kaynaklar/filtre";

export const VITRIN_ADET = 6;
export const VITRIN_GECIKME_DK = 30;
/** Vitrinde en fazla bu kadar eski ilan (üye listesiyle aynı 6 saat içinde, ama daha taze olanlar). */
const VITRIN_EN_ESKI_SA = 3;
const ONBELLEK_MS = 60_000;

export type VitrinIlani = {
  cikis: string;
  varis: string;
  /** "Tenteli tır" gibi; yoksa null */
  arac: string | null;
  /** "24 ton"; yoksa null */
  tonaj: string | null;
  /** "₺38.000 komple" / "₺900/ton"; yoksa null */
  fiyat: string | null;
  /** İlanın oluştuğu an (ms). Süre sayfada hesaplanır. */
  zaman: number;
};

export type VitrinVeri = { ilanlar: VitrinIlani[]; canliSayi: number };

let onbellek: { zaman: number; veri: VitrinVeri } | null = null;

export async function vitrinOku(simdi = Date.now()): Promise<VitrinVeri> {
  if (onbellek && simdi - onbellek.zaman < ONBELLEK_MS) return onbellek.veri;

  const gecikmeSiniri = new Date(simdi - VITRIN_GECIKME_DK * 60_000);
  const enEski = new Date(simdi - VITRIN_EN_ESKI_SA * 3_600_000);
  const aday = await anaPrisma.yukIlani.findMany({
    where: {
      createdAt: { gte: enEski, lte: gecikmeSiniri },
      durum: { notIn: ["ARSIV", "ELENDI"] },
      guvenSkoru: { gte: Math.max(60, LISTE_GUVEN) },
      cikisIl: { not: null },
      varisIl: { not: null },
      telefon: { not: null },
      NOT: { kaynak: { tur: "WEB" } },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    // Yalnız gösterilecek alanlar — telefon / ad / metin seçilmez.
    select: { cikisIl: true, varisIl: true, aracTipi: true, tonaj: true, ucret: true, fiyatTon: true, fiyatBelirsiz: true, createdAt: true },
  });

  // Farklı rotalar: aynı rota tekrar tekrar gelmesin
  const gorulen = new Set<string>();
  const ilanlar: VitrinIlani[] = [];
  for (const i of aday) {
    if (!i.cikisIl || !i.varisIl || i.cikisIl === i.varisIl) continue;
    const anahtar = `${i.cikisIl}|${i.varisIl}`;
    if (gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    const f = fiyatGorunumu({ ucret: i.ucret, fiyatTon: i.fiyatTon, fiyatBelirsiz: i.fiyatBelirsiz, tonaj: i.tonaj });
    ilanlar.push({
      cikis: i.cikisIl,
      varis: i.varisIl,
      arac: i.aracTipi ? (aracTipiAdi(i.aracTipi) ?? i.aracTipi) : null,
      tonaj: i.tonaj ? `${String(i.tonaj).replace(".", ",")} ton` : null,
      fiyat: f.ana,
      zaman: i.createdAt.getTime(),
    });
    if (ilanlar.length >= VITRIN_ADET) break;
  }

  // Merak uyandıran toplam: üyenin gördüğü canlı liste (6 saat)
  const canliSayi = await anaPrisma.yukIlani.count({
    where: {
      createdAt: { gte: new Date(simdi - 6 * 3_600_000) },
      durum: { notIn: ["ARSIV", "ELENDI"] },
      guvenSkoru: { gte: LISTE_GUVEN },
    },
  });

  const veri = { ilanlar, canliSayi };
  onbellek = { zaman: simdi, veri };
  return veri;
}

export type VitrinKart = Omit<VitrinIlani, "zaman"> & { dk: number };

/** Sayfa için: önbellekteki ilanlar + her istekte yeniden hesaplanan "kaç dk önce". */
export async function vitrinKartlari(): Promise<{ kartlar: VitrinKart[]; canliSayi: number }> {
  const { ilanlar, canliSayi } = await vitrinOku();
  const simdi = Date.now();
  return {
    canliSayi,
    kartlar: ilanlar.map(({ zaman, ...kalan }) => ({ ...kalan, dk: Math.max(0, Math.floor((simdi - zaman) / 60_000)) })),
  };
}
