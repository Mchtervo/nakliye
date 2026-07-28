import { prisma } from "@/lib/prisma";
import { ilBul } from "@/lib/iller";
import { yaklasikKarayoluKm } from "@/lib/ilMesafe";
import { SUPHE_SINIRI } from "@/lib/kaynaklar/filtre";

const BOS_MAX_KM = 100;
const YUKLU_MALIYET_KURUS_KM = 800; // ~8 TL/km
const BOS_MALIYET_KURUS_KM = 1200; // ~12 TL/km
const ADAY_LIMIT = 100;
const BEAM = 40;

export type PlanAdayIlan = {
  id: number;
  nereden: string | null;
  nereye: string | null;
  cikisIl: string;
  varisIl: string;
  ucret: number | null;
  fiyatTon: number | null;
  tonaj: number | null;
  firmaAdi: string | null;
  telefon: string | null;
  gonderenUserId: string | null;
  guvenSkoru: number;
  yuklemeTarihi: Date | null;
  createdAt: Date;
};

export type PlanAyak = {
  ilan: PlanAdayIlan;
  bosKm: number;
  yukluKm: number;
  gun: number; // 1-based
};

export type SeferPlani = {
  ayaklar: PlanAyak[];
  toplamUcret: number; // kuruş
  toplamKm: number;
  bosKm: number;
  netTahmini: number; // kuruş
};

function gunBaslangici(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function bugunTr(): Date {
  const simdi = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(simdi.getUTCFullYear(), simdi.getUTCMonth(), simdi.getUTCDate())
  );
}

function baglantiKm(oncekiVaris: string, sonrakiCikis: string): number | null {
  const km = yaklasikKarayoluKm(oncekiVaris, sonrakiCikis);
  if (km === null) return null;
  if (km > BOS_MAX_KM) return null;
  return km;
}

function ilanKm(ilan: PlanAdayIlan): number {
  return yaklasikKarayoluKm(ilan.cikisIl, ilan.varisIl) ?? 0;
}

function gelirKurus(ilan: PlanAdayIlan): number {
  if (ilan.ucret && ilan.ucret > 0) return ilan.ucret;
  if (ilan.fiyatTon && ilan.tonaj && ilan.fiyatTon > 0 && ilan.tonaj > 0) {
    return ilan.fiyatTon * ilan.tonaj;
  }
  return 0;
}

function planOzet(ayaklar: PlanAyak[]): SeferPlani {
  let toplamUcret = 0;
  let bosKm = 0;
  let yukluKm = 0;
  for (const a of ayaklar) {
    toplamUcret += gelirKurus(a.ilan);
    bosKm += a.bosKm;
    yukluKm += a.yukluKm;
  }
  const maliyet =
    yukluKm * YUKLU_MALIYET_KURUS_KM + bosKm * BOS_MALIYET_KURUS_KM;
  return {
    ayaklar,
    toplamUcret,
    toplamKm: yukluKm + bosKm,
    bosKm,
    netTahmini: toplamUcret - maliyet,
  };
}

/** DB'den plan adaylarını çek. */
export async function planAdaylariniGetir(): Promise<PlanAdayIlan[]> {
  const sinir = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const satirlar = await prisma.yukIlani.findMany({
    where: {
      durum: {
        in: ["YENI", "ILGILENIYOR", "ILETISIME_GECILDI", "PAZARLIKTA", "ARSIV"],
      },
      guvenSkoru: { gte: 40 },
      cikisIl: { not: null },
      varisIl: { not: null },
      OR: [
        { createdAt: { gte: sinir } },
        { sonGorulme: { gte: sinir } },
      ],
    },
    orderBy: [{ guvenSkoru: "desc" }, { sonGorulme: "desc" }],
    take: ADAY_LIMIT,
    select: {
      id: true,
      nereden: true,
      nereye: true,
      cikisIl: true,
      varisIl: true,
      ucret: true,
      fiyatTon: true,
      tonaj: true,
      firmaAdi: true,
      telefon: true,
      gonderenUserId: true,
      guvenSkoru: true,
      yuklemeTarihi: true,
      createdAt: true,
    },
  });

  return satirlar
    .filter((s) => s.cikisIl && s.varisIl && s.cikisIl !== s.varisIl)
    .map((s) => ({
      id: s.id,
      nereden: s.nereden,
      nereye: s.nereye,
      cikisIl: s.cikisIl!,
      varisIl: s.varisIl!,
      ucret: s.ucret,
      fiyatTon: s.fiyatTon,
      tonaj: s.tonaj,
      firmaAdi: s.firmaAdi,
      telefon: s.telefon,
      gonderenUserId: s.gonderenUserId,
      guvenSkoru: s.guvenSkoru,
      yuklemeTarihi: s.yuklemeTarihi,
      createdAt: s.createdAt,
    }));
}

/**
 * Başlangıç ilden 2–4 ayaklı tur planları.
 * Varış → sonraki çıkış aynı il veya ≤100 km; tarihler çakışmasın.
 */
export function seferPlanlariUret(
  baslangicIlHam: string,
  gunSayisi: number,
  adaylar: PlanAdayIlan[]
): SeferPlani[] {
  const baslangic = ilBul(baslangicIlHam);
  if (!baslangic) return [];

  const gun = Math.min(7, Math.max(2, Math.round(gunSayisi) || 3));
  const maxAyak = Math.min(4, gun);
  const minAyak = 2;
  const baslangicGun = gunBaslangici(bugunTr());

  type Dugum = {
    ayaklar: PlanAyak[];
    konum: string;
    gunMs: number;
    kullanilan: Set<number>;
  };

  const baslangicAdaylari = adaylar.filter((a) => {
    const bos = baglantiKm(baslangic, a.cikisIl);
    if (bos === null) return false;
    if (a.yuklemeTarihi) {
      const y = gunBaslangici(a.yuklemeTarihi);
      if (y < baslangicGun) return false;
      if (y > baslangicGun + (gun - 1) * 86_400_000) return false;
    }
    return true;
  });

  let beam: Dugum[] = baslangicAdaylari.map((ilan) => {
    const bos = baglantiKm(baslangic, ilan.cikisIl) ?? 0;
    const gunMs = ilan.yuklemeTarihi
      ? gunBaslangici(ilan.yuklemeTarihi)
      : baslangicGun;
    return {
      ayaklar: [
        {
          ilan,
          bosKm: bos,
          yukluKm: ilanKm(ilan),
          gun: 1,
        },
      ],
      konum: ilan.varisIl,
      gunMs,
      kullanilan: new Set([ilan.id]),
    };
  });

  const tamamlanan: SeferPlani[] = [];

  for (let derinlik = 1; derinlik < maxAyak; derinlik++) {
    const sonraki: Dugum[] = [];
    for (const dugum of beam) {
      if (dugum.ayaklar.length >= minAyak) {
        tamamlanan.push(planOzet(dugum.ayaklar));
      }
      for (const ilan of adaylar) {
        if (dugum.kullanilan.has(ilan.id)) continue;
        const bos = baglantiKm(dugum.konum, ilan.cikisIl);
        if (bos === null) continue;

        let sonrakiGunMs = dugum.gunMs + 86_400_000;
        if (ilan.yuklemeTarihi) {
          const y = gunBaslangici(ilan.yuklemeTarihi);
          if (y < dugum.gunMs + 86_400_000) continue; // aynı/önceki gün çakışma
          if (y > baslangicGun + (gun - 1) * 86_400_000) continue;
          sonrakiGunMs = y;
        }
        const gunNo = Math.floor((sonrakiGunMs - baslangicGun) / 86_400_000) + 1;
        if (gunNo > gun) continue;

        const kullanilan = new Set(dugum.kullanilan);
        kullanilan.add(ilan.id);
        sonraki.push({
          ayaklar: [
            ...dugum.ayaklar,
            {
              ilan,
              bosKm: bos,
              yukluKm: ilanKm(ilan),
              gun: Math.max(dugum.ayaklar.length + 1, gunNo),
            },
          ],
          konum: ilan.varisIl,
          gunMs: sonrakiGunMs,
          kullanilan,
        });
      }
    }

    sonraki.sort(
      (a, b) => planOzet(b.ayaklar).netTahmini - planOzet(a.ayaklar).netTahmini
    );
    beam = sonraki.slice(0, BEAM);
    if (beam.length === 0) break;
  }

  for (const dugum of beam) {
    if (dugum.ayaklar.length >= minAyak) {
      tamamlanan.push(planOzet(dugum.ayaklar));
    }
  }

  // Tekilleştir (ilan id zinciri) + kâra göre sırala
  const gorulen = new Set<string>();
  const benzersiz: SeferPlani[] = [];
  for (const p of tamamlanan.sort((a, b) => b.netTahmini - a.netTahmini)) {
    const anahtar = p.ayaklar.map((a) => a.ilan.id).join("-");
    if (gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    benzersiz.push(p);
    if (benzersiz.length >= 3) break;
  }
  return benzersiz;
}

/** Bu yükü alırsan dönüşte (varış→çıkış) adaylar. */
export async function donusOnerileriBul(
  varisIl: string | null | undefined,
  cikisIl: string | null | undefined,
  haricId?: number,
  limit = 3
): Promise<PlanAdayIlan[]> {
  const v = ilBul(varisIl);
  if (!v) return [];
  const hedef = cikisIl ? ilBul(cikisIl) : null;

  const sinir = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const adaylar = await prisma.yukIlani.findMany({
    where: {
      durum: { in: ["YENI", "ILGILENIYOR"] },
      guvenSkoru: { gte: SUPHE_SINIRI },
      cikisIl: v,
      ...(haricId ? { id: { not: haricId } } : {}),
      createdAt: { gte: sinir },
      varisIl: { not: null },
    },
    orderBy: [{ guvenSkoru: "desc" }, { ucret: "desc" }],
    take: 15,
    select: {
      id: true,
      nereden: true,
      nereye: true,
      cikisIl: true,
      varisIl: true,
      ucret: true,
      fiyatTon: true,
      tonaj: true,
      firmaAdi: true,
      telefon: true,
      gonderenUserId: true,
      guvenSkoru: true,
      yuklemeTarihi: true,
      createdAt: true,
    },
  });

  const sonuc: PlanAdayIlan[] = [];
  for (const s of adaylar) {
    if (!s.cikisIl || !s.varisIl) continue;
    if (hedef) {
      const bos = baglantiKm(s.varisIl, hedef);
      // Dönüş tercihen ana üsse yakın varış; yoksa aynı koridor
      if (bos === null && s.varisIl !== hedef) continue;
    }
    sonuc.push({
      id: s.id,
      nereden: s.nereden,
      nereye: s.nereye,
      cikisIl: s.cikisIl,
      varisIl: s.varisIl,
      ucret: s.ucret,
      fiyatTon: s.fiyatTon,
      tonaj: s.tonaj,
      firmaAdi: s.firmaAdi,
      telefon: s.telefon,
      gonderenUserId: s.gonderenUserId,
      guvenSkoru: s.guvenSkoru,
      yuklemeTarihi: s.yuklemeTarihi,
      createdAt: s.createdAt,
    });
    if (sonuc.length >= limit) break;
  }
  return sonuc;
}
