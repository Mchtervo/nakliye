"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { tlKurusaCevir } from "@/lib/para";
import { TAKSIT_ACIKLAMA_ONEK, esitPlan } from "@/lib/kredi";
import { aktifArac } from "@/lib/aktifArac";

export type KrediSonuc = { hata: string | null; tamam: boolean };

const GUN_MS = 24 * 60 * 60 * 1000;

function yenile() {
  revalidatePath("/krediler");
  revalidatePath("/");
  revalidatePath("/giderler");
}

/** Yeni kredi: anapara, taksit sayısı ve tutarı, ilk vade → aylık plan. */
export async function krediEkle(_o: KrediSonuc, f: FormData): Promise<KrediSonuc> {
  const ad = String(f.get("ad") || "").trim().slice(0, 60);
  const kurum = String(f.get("kurum") || "").trim().slice(0, 60) || null;
  const anapara = tlKurusaCevir(String(f.get("anapara") || ""));
  const taksitTutari = tlKurusaCevir(String(f.get("taksitTutari") || ""));
  const adet = Number(f.get("adet"));
  const ilk = String(f.get("ilkVade") || "");
  if (!ad) return { hata: "Krediye bir ad ver (ör. Çekici kredisi).", tamam: false };
  if (!anapara || anapara <= 0) return { hata: "Çekilen tutarı (anapara) yaz.", tamam: false };
  if (!taksitTutari || taksitTutari <= 0) return { hata: "Aylık taksit tutarını yaz.", tamam: false };
  if (!Number.isInteger(adet) || adet < 1 || adet > 240) return { hata: "Taksit sayısı 1–240 arası olmalı.", tamam: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ilk)) return { hata: "İlk taksit tarihini seç.", tamam: false };
  if (taksitTutari * adet < anapara) return { hata: "Taksitlerin toplamı anaparadan az olamaz; tutarları kontrol et.", tamam: false };
  const [y, a, g] = ilk.split("-").map(Number);
  const ilkVade = new Date(y, a - 1, g, 12);

  // Çift dokunma: aynı ad ve anaparayla az önce açılan kredi tekrar yazılmaz
  if (await prisma.kredi.findFirst({ where: { ad, anapara, createdAt: { gte: new Date(Date.now() - 20_000) } } })) {
    yenile();
    return { hata: null, tamam: true };
  }
  await prisma.kredi.create({
    data: { ad, kurum, anapara, baslangic: ilkVade, taksitler: { create: esitPlan(anapara, taksitTutari, adet, ilkVade) } },
  });
  yenile();
  return { hata: null, tamam: true };
}

/**
 * Taksit ödendi: aynı tutarda elle girilmiş, başka taksite bağlı olmayan bir
 * "Kredi ödemesi" gideri varsa ona bağlanır; yoksa bir gider yazılır. İkinci
 * kez basılırsa hiçbir şey olmaz.
 */
export async function taksitOde(id: number): Promise<KrediSonuc> {
  const t = await prisma.krediTaksit.findUnique({ where: { id }, include: { kredi: true } });
  if (!t) return { hata: "Taksit bulunamadı.", tamam: false };
  if (t.odendi) return { hata: null, tamam: true };
  const simdi = new Date();
  const bagliIdler = (await prisma.krediTaksit.findMany({ where: { giderId: { not: null } }, select: { giderId: true } })).map((x) => x.giderId as number);
  const mevcut = await prisma.gider.findFirst({
    where: {
      kategori: "KREDI_ODEME",
      toplamTutar: t.tutar,
      tarih: { gte: new Date(Math.min(simdi.getTime(), t.vade.getTime()) - 7 * GUN_MS), lte: new Date(Math.max(simdi.getTime(), t.vade.getTime()) + 7 * GUN_MS) },
      ...(bagliIdler.length ? { id: { notIn: bagliIdler } } : {}),
    },
    orderBy: { tarih: "desc" },
  });
  // Yalnız hâlâ ödenmemişse işaretlenir (eşzamanlı ikinci istek hiçbir şey yazmaz).
  // Üye defterinde işlem bloğu üyenin istemcisine yönlenmediği için sıralı yapılır.
  const kilit = await prisma.krediTaksit.updateMany({ where: { id, odendi: null }, data: { odendi: simdi } });
  if (kilit.count === 1) {
    const giderId =
      mevcut?.id ??
      (
        await prisma.gider.create({
          data: {
            tarih: simdi,
            kategori: "KREDI_ODEME",
            aciklama: `${TAKSIT_ACIKLAMA_ONEK}${t.kredi.ad} ${t.sira}. taksit`,
            kdvli: false,
            kdvDahilMi: true,
            netTutar: t.tutar,
            kdvTutar: 0,
            toplamTutar: t.tutar,
            aracId: (await aktifArac())?.id ?? null,
          },
        })
      ).id;
    await prisma.krediTaksit.update({ where: { id }, data: { giderId } });
  }
  yenile();
  return { hata: null, tamam: true };
}

/** Ödemeyi geri al: bu ekranın yazdığı gider silinir, elle girilmiş gider yerinde kalır. */
export async function taksitGeriAl(id: number): Promise<KrediSonuc> {
  const t = await prisma.krediTaksit.findUnique({ where: { id } });
  if (!t?.odendi) return { hata: null, tamam: true };
  const n = await prisma.krediTaksit.updateMany({ where: { id, odendi: { not: null } }, data: { odendi: null, giderId: null } });
  if (n.count === 1 && t.giderId) await prisma.gider.deleteMany({ where: { id: t.giderId, aciklama: { startsWith: TAKSIT_ACIKLAMA_ONEK } } });
  yenile();
  return { hata: null, tamam: true };
}

/** Bankanın planına göre taksit tutarını ve anapara payını düzelt (ödenmemiş taksit). */
export async function taksitDuzenle(_o: KrediSonuc, f: FormData): Promise<KrediSonuc> {
  const id = Number(f.get("taksitId"));
  const tutar = tlKurusaCevir(String(f.get("tutar") || ""));
  const anaparaPay = tlKurusaCevir(String(f.get("anaparaPay") || ""));
  if (!tutar || tutar <= 0 || anaparaPay === null || anaparaPay < 0 || anaparaPay > tutar) {
    return { hata: "Anapara payı 0 ile taksit tutarı arasında olmalı.", tamam: false };
  }
  const n = await prisma.krediTaksit.updateMany({ where: { id, odendi: null }, data: { tutar, anaparaPay, faizPay: tutar - anaparaPay } });
  if (n.count === 0) return { hata: "Ödenmiş taksit düzenlenemez.", tamam: false };
  yenile();
  return { hata: null, tamam: true };
}

/** Krediyi sil (ödenmiş taksitlerin giderleri gerçek ödeme olduğu için kalır). */
export async function krediSil(id: number): Promise<void> {
  await prisma.kredi.deleteMany({ where: { id } });
  yenile();
}
