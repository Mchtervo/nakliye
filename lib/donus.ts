import { prisma } from "@/lib/prisma";
import { ilBul } from "@/lib/iller";
import type { KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

/**
 * Yük kaydedildiğinde ters yönde dönüş yükü araması açar.
 * Aynı rota için açık talep varsa yenisini oluşturmaz.
 */
export async function donusTalebiOlustur(
  yukId: number,
  nereden: string,
  nereye: string
): Promise<void> {
  const cikisIl = ilBul(nereye); // dönüş, yükün bittiği yerden başlar
  const varisIl = ilBul(nereden);
  if (!cikisIl || !varisIl || cikisIl === varisIl) return;

  const acikTalep = await prisma.donusTalebi.findFirst({
    where: { aktif: true, cikisIl, varisIl },
    select: { id: true },
  });
  if (acikTalep) return;

  await prisma.donusTalebi.create({
    data: { yukId, cikis: nereye, varis: nereden, cikisIl, varisIl },
  });
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
    const ilanlar = await prisma.yukIlani.findMany({
      where: {
        donusTalebiId: null,
        durum: "YENI",
        cikisIl: talep.cikisIl,
        varisIl: talep.varisIl,
        createdAt: { gte: birHaftaOnce },
      },
      take: 10,
    });

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
        telefon: i.telefon,
        nereden: i.nereden,
        nereye: i.nereye,
        cikisIl: i.cikisIl,
        varisIl: i.varisIl,
        ucret: i.ucret,
        hamMetin: i.hamMetin,
        donusTalebiId: talep.id,
      });
    }
  }

  return eslesenler;
}
