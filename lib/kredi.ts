/**
 * Kredi planı: her taksit anapara + faiz/masraf olarak ayrı tutulur.
 * Ödenen taksit tek bir "Kredi ödemesi" giderine bağlanır (çift sayım yok).
 * Kayıtlar o anki kullanıcının kendi defterinden okunur.
 */
import { prisma } from "@/lib/prisma";

const GUN_MS = 24 * 60 * 60 * 1000;

export function gunKaldi(vade: Date, simdi = new Date()): number {
  const a = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
  const b = new Date(vade.getFullYear(), vade.getMonth(), vade.getDate()).getTime();
  return Math.round((b - a) / GUN_MS);
}

export type KrediDurumu = {
  id: number;
  ad: string;
  kurum: string | null;
  anapara: number;
  toplamGeriOdeme: number;
  odenen: number;
  kalan: number;
  kalanAnapara: number;
  toplamFaiz: number;
  taksitSayisi: number;
  odenenTaksit: number;
  sonraki: { id: number; sira: number; vade: Date; tutar: number; kalanGun: number } | null;
  taksitler: { id: number; sira: number; vade: Date; tutar: number; anaparaPay: number; faizPay: number; odendi: Date | null; giderId: number | null }[];
};

export async function krediDurumlari(simdi = new Date()): Promise<KrediDurumu[]> {
  const krediler = await prisma.kredi.findMany({ orderBy: { createdAt: "asc" }, include: { taksitler: { orderBy: { sira: "asc" } } } });
  return krediler.map((k) => {
    const odenmis = k.taksitler.filter((t) => t.odendi);
    const acik = k.taksitler.filter((t) => !t.odendi);
    const s = acik[0];
    return {
      id: k.id,
      ad: k.ad,
      kurum: k.kurum,
      anapara: k.anapara,
      toplamGeriOdeme: k.taksitler.reduce((x, t) => x + t.tutar, 0),
      odenen: odenmis.reduce((x, t) => x + t.tutar, 0),
      kalan: acik.reduce((x, t) => x + t.tutar, 0),
      kalanAnapara: acik.reduce((x, t) => x + t.anaparaPay, 0),
      toplamFaiz: k.taksitler.reduce((x, t) => x + t.faizPay, 0),
      taksitSayisi: k.taksitler.length,
      odenenTaksit: odenmis.length,
      sonraki: s ? { id: s.id, sira: s.sira, vade: s.vade, tutar: s.tutar, kalanGun: gunKaldi(s.vade, simdi) } : null,
      taksitler: k.taksitler.map((t) => ({ id: t.id, sira: t.sira, vade: t.vade, tutar: t.tutar, anaparaPay: t.anaparaPay, faizPay: t.faizPay, odendi: t.odendi, giderId: t.giderId })),
    };
  });
}

/** Önümüzdeki n gün içindeki ve gecikmiş ödenmemiş taksitler. */
export async function yaklasanTaksitler(gun = 7, simdi = new Date()) {
  const t = await prisma.krediTaksit.findMany({
    where: { odendi: null, vade: { lte: new Date(simdi.getTime() + gun * GUN_MS) } },
    orderBy: { vade: "asc" },
    include: { kredi: { select: { ad: true } } },
  });
  return t.map((x) => ({ id: x.id, krediAd: x.kredi.ad, sira: x.sira, vade: x.vade, tutar: x.tutar, uyari: x.uyari, kalanGun: gunKaldi(x.vade, simdi) }));
}

/** Eşit taksit planı: anapara taksitlere eşit bölünür, kalan faiz/masraftır (tahmin; düzenlenebilir). */
export function esitPlan(anapara: number, taksitTutari: number, adet: number, ilkVade: Date) {
  const pay = Math.floor(anapara / adet);
  return Array.from({ length: adet }, (_, i) => {
    const anaparaPay = i === adet - 1 ? anapara - pay * (adet - 1) : pay;
    const vade = new Date(ilkVade.getFullYear(), ilkVade.getMonth() + i, 1);
    // Kısa ayda ayın son günü
    const sonGun = new Date(vade.getFullYear(), vade.getMonth() + 1, 0).getDate();
    vade.setDate(Math.min(ilkVade.getDate(), sonGun));
    return { sira: i + 1, vade, tutar: taksitTutari, anaparaPay, faizPay: taksitTutari - anaparaPay };
  });
}

export const TAKSIT_ACIKLAMA_ONEK = "Kredi taksidi · ";
