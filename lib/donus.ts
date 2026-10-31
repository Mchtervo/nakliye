import { prisma } from "@/lib/prisma";
import { ILLER, ilBul } from "@/lib/iller";
import { ilMesafesiKm } from "@/lib/ilMesafe";
import type { KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

/** Boşaltılan ile bu kadar (il merkezi, kuş uçuşu) yakın çıkışlar da sayılır. */
export const YAKIN_KM = 65;

/**
 * İl merkezi mesafesi yanıltan bitişik çiftler: İstanbul merkezi Avrupa
 * yakasında; Gebze (Kocaeli) Tuzla'nın yanı. Avrupa yakası kayıtta zaten elenir.
 */
const BITISIK: Record<string, string[]> = {
  İstanbul: ["Kocaeli"],
  Kocaeli: ["İstanbul"],
};
/** Yolculuk / dönüş araması bu süre sonra kendiliğinden kapanır. */
const TALEP_OMUR_MS = 4 * 24 * 60 * 60 * 1000;

/** İl + 65 km içindeki iller (Düzce → Bolu, Sakarya; İstanbul → Kocaeli). */
export function yakinIller(il: string): string[] {
  const yakin = ILLER.filter((x) => x !== il)
    .map((x) => ({ x, km: ilMesafesiKm(il, x) }))
    .filter((y): y is { x: (typeof ILLER)[number]; km: number } => y.km !== null && y.km <= YAKIN_KM)
    .sort((a, b) => a.km - b.km)
    .map((y) => y.x as string);
  const bitisik = (BITISIK[il] ?? []).filter((x) => !yakin.includes(x));
  return [il, ...bitisik, ...yakin];
}

/** "Düzce'de", "Bolu'da", "Kocaeli'nde" değil "Kocaeli'de" — bulunma eki. */
export function ilde(il: string): string {
  const unluler = il.toLocaleLowerCase("tr-TR").match(/[aıoueiöü]/g) || [];
  const son = unluler[unluler.length - 1] || "e";
  const kalin = "aıou".includes(son);
  const sert = /[fstkçşhp]$/i.test(il);
  return `${il}'${sert ? "t" : "d"}${kalin ? "a" : "e"}`;
}

/** Bildirim başlığı: "Düzce'de yük bulundu" / "Düzce'ye 40 km: Bolu'da yük". */
export function donusBasligi(hedefIl: string, ilanCikisIl: string | null): string {
  if (!ilanCikisIl || ilanCikisIl === hedefIl) return `${ilde(hedefIl)} yük bulundu`;
  const km = ilMesafesiKm(hedefIl, ilanCikisIl);
  return `${hedefIl} yakını${km ? ` (${km} km)` : ""}: ${ilde(ilanCikisIl)} yük`;
}

/** Yükleme → boşaltma yolculuğu: boşaltma ve çevresinden yük aranır. */
export async function yolculukBaslat(
  yukleme: string,
  bosaltma: string
): Promise<number | null> {
  return donusTalebiOlustur(null, yukleme, bosaltma);
}

/**
 * Yük / ilan alındığında ters yönde dönüş yükü araması açar.
 * Aynı rota için açık talep varsa yenisini oluşturmaz.
 */
export async function donusTalebiOlustur(
  yukId: number | null,
  nereden: string,
  nereye: string
): Promise<number | null> {
  const cikisIl = ilBul(nereye); // dönüş, yükün bittiği yerden başlar
  const varisIl = ilBul(nereden);
  if (!cikisIl || !varisIl || cikisIl === varisIl) return null;

  const acikTalep = await prisma.donusTalebi.findFirst({
    where: { aktif: true, cikisIl, varisIl },
    select: { id: true },
  });
  if (acikTalep) return acikTalep.id;

  const talep = await prisma.donusTalebi.create({
    data: {
      yukId: yukId && yukId > 0 ? yukId : null,
      cikis: nereye,
      varis: nereden,
      cikisIl,
      varisIl,
    },
  });
  return talep.id;
}

/**
 * İlan ALINDI → varış ilinden çıkışlı dönüş araması + mevcut eşleşmeleri bağla.
 * Eşleşen (henüz bildirilmemiş) ilanları döner.
 */
export async function donusTalebiIlanAlindi(ilanId: number): Promise<{
  talepId: number | null;
  eslesen: KaydedilenIlan[];
}> {
  const ilan = await prisma.yukIlani.findUnique({
    where: { id: ilanId },
    select: {
      id: true,
      nereden: true,
      nereye: true,
      cikisIl: true,
      varisIl: true,
    },
  });
  if (!ilan) return { talepId: null, eslesen: [] };

  const nereden = ilan.cikisIl || ilan.nereden || "";
  const nereye = ilan.varisIl || ilan.nereye || "";
  const talepId = await donusTalebiOlustur(null, nereden, nereye);
  if (!talepId) return { talepId: null, eslesen: [] };

  const eslesen = await donusEslesmeleriniTara();
  return { talepId, eslesen };
}

/**
 * Talep açılmadan önce kaydedilmiş ilanları da eşleştirir.
 * Yeni eşleşen ilanları döndürür (bildirim için).
 */
async function eskiTalepleriKapat(): Promise<void> {
  // Eski sefer aramaları sonsuza açık kalıp her ilanı "dönüş" yapıyordu.
  await prisma.donusTalebi.updateMany({
    where: { aktif: true, createdAt: { lt: new Date(Date.now() - TALEP_OMUR_MS) } },
    data: { aktif: false },
  });
}

/** Ana sayfa "Yolculuğum": açık yolculuklar + eşleşen yükler (yenisi önce). */
export async function aktifYolculuklar() {
  await eskiTalepleriKapat();
  return prisma.donusTalebi.findMany({
    where: { aktif: true },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: {
      ilanlar: {
        where: { durum: { in: ["YENI", "ILGILENIYOR"] } },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, nereden: true, nereye: true, cikisIl: true, ucret: true, fiyatTon: true, createdAt: true },
      },
    },
  });
}

export async function donusEslesmeleriniTara(): Promise<KaydedilenIlan[]> {
  await eskiTalepleriKapat();

  const talepler = await prisma.donusTalebi.findMany({
    where: { aktif: true },
    select: { id: true, cikisIl: true, varisIl: true },
  });
  if (talepler.length === 0) return [];

  const birGunOnce = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const eslesenler: KaydedilenIlan[] = [];

  for (const talep of talepler) {
    const cevre = yakinIller(talep.cikisIl);
    const adaylar = await prisma.yukIlani.findMany({
      where: {
        donusTalebiId: null,
        durum: "YENI",
        cikisIl: { in: cevre },
        createdAt: { gte: birGunOnce },
      },
      orderBy: [{ guvenSkoru: "desc" }, { createdAt: "desc" }],
      take: 30,
    });
    // Önce boşaltılan ilin kendisi, sonra eve (yükleme iline) dönen, sonra yakınlık
    const puan = (i: (typeof adaylar)[number]) =>
      (i.cikisIl === talep.cikisIl ? 0 : 10 + cevre.indexOf(i.cikisIl || "")) -
      (i.varisIl === talep.varisIl ? 5 : 0);
    const ilanlar = adaylar.sort((a, b) => puan(a) - puan(b)).slice(0, 10);

    if (ilanlar.length === 0) continue;

    await prisma.yukIlani.updateMany({
      where: { id: { in: ilanlar.map((i) => i.id) } },
      data: { donusTalebiId: talep.id },
    });
    await prisma.donusTalebi.update({
      where: { id: talep.id },
      data: {
        eslesmeAdet: { increment: ilanlar.length },
        sonKontrol: new Date(),
      },
    });

    for (const i of ilanlar) {
      if (i.bildirildi) continue;
      eslesenler.push({
        id: i.id,
        firmaAdi: i.firmaAdi,
        ilgiliKisi: i.ilgiliKisi,
        telefon: i.telefon,
        nereden: i.nereden,
        nereye: i.nereye,
        cikisIl: i.cikisIl,
        varisIl: i.varisIl,
        ucret: i.ucret,
        fiyatTon: i.fiyatTon,
        tonaj: i.tonaj,
        aracTipi: i.aracTipi,
        aracTipiKod: i.aracTipiKod,
        guvenSkoru: i.guvenSkoru,
        hamMetin: i.hamMetin,
        donusTalebiId: talep.id,
        createdAt: i.createdAt,
      });
    }
  }

  return eslesenler;
}
