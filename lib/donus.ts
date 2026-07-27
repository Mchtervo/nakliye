import { prisma } from "@/lib/prisma";
import { ilBul } from "@/lib/iller";
import type { KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

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
export async function donusEslesmeleriniTara(): Promise<KaydedilenIlan[]> {
  const talepler = await prisma.donusTalebi.findMany({
    where: { aktif: true },
    select: { id: true, cikisIl: true, varisIl: true },
  });
  if (talepler.length === 0) return [];

  const birHaftaOnce = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const eslesenler: KaydedilenIlan[] = [];

  for (const talep of talepler) {
    let ilanlar = await prisma.yukIlani.findMany({
      where: {
        donusTalebiId: null,
        durum: "YENI",
        cikisIl: talep.cikisIl,
        varisIl: talep.varisIl,
        createdAt: { gte: birHaftaOnce },
      },
      take: 10,
    });

    // Tam rota yoksa: varıştan çıkan herhangi bir YENİ yük (boş dönme)
    if (ilanlar.length === 0) {
      ilanlar = await prisma.yukIlani.findMany({
        where: {
          donusTalebiId: null,
          durum: "YENI",
          cikisIl: talep.cikisIl,
          createdAt: { gte: birHaftaOnce },
        },
        orderBy: [{ guvenSkoru: "desc" }, { createdAt: "desc" }],
        take: 5,
      });
    }

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
