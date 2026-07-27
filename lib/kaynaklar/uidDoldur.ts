/**
 * gonderenUserId geriye dönük doldurma (cron / manuel).
 *
 * 1) HamMesaj(uid) → YukIlani (mesajId / metin)
 * 2) Telefon yayılımı: uid'li ilanın telefonu → aynı tel, uid'siz ilanlar
 *
 * Firma tek başına kullanılmaz (yanlış DM riski). Telefon güvenilir bağ.
 */
import { prisma } from "@/lib/prisma";

const PENCERE_GUN = 14;

function telefonAnahtar(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let r = tel.replace(/\D/g, "");
  if (r.startsWith("90") && r.length >= 12) r = `0${r.slice(2)}`;
  if (r.length === 10) r = `0${r}`;
  return r.length >= 11 ? r.slice(0, 11) : null;
}

function metinEslesir(ilanMetin: string, hamMetin: string): boolean {
  const a = ilanMetin.trim();
  const b = hamMetin.trim();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  const kisa = a.slice(0, 120);
  return kisa.length >= 40 && b.includes(kisa);
}

export type UidDoldurSonuc = {
  hamEslesti: number;
  telefonYayildi: number;
  uidLiHam: number;
  uidLiIlanOnce: number;
  uidLiIlanSonra: number;
};

export async function uidGeriyeDonukDoldur(secenek: {
  yaz: boolean;
  pencereGun?: number;
}): Promise<UidDoldurSonuc> {
  const yaz = secenek.yaz;
  const gun = secenek.pencereGun ?? PENCERE_GUN;
  const sinir = new Date(Date.now() - gun * 24 * 60 * 60 * 1000);

  const uidLiHam = await prisma.hamMesaj.count({
    where: { gonderenUserId: { not: null } },
  });
  const uidLiIlanOnce = await prisma.yukIlani.count({
    where: { gonderenUserId: { not: null } },
  });

  const hamlar = await prisma.hamMesaj.findMany({
    where: { gonderenUserId: { not: null } },
    select: {
      id: true,
      kaynakId: true,
      mesajId: true,
      metin: true,
      gonderenUserId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20_000,
  });

  const byMesaj = new Map<string, { uid: string; hamId: number }>();
  const byKaynak = new Map<
    number,
    { id: number; metin: string; gonderenUserId: string; mesajId: number | null }[]
  >();
  for (const h of hamlar) {
    if (!h.gonderenUserId) continue;
    if (h.kaynakId != null && h.mesajId != null) {
      byMesaj.set(`${h.kaynakId}:${h.mesajId}`, {
        uid: h.gonderenUserId,
        hamId: h.id,
      });
    }
    if (h.kaynakId != null) {
      const liste = byKaynak.get(h.kaynakId) ?? [];
      liste.push({
        id: h.id,
        metin: h.metin,
        gonderenUserId: h.gonderenUserId,
        mesajId: h.mesajId,
      });
      byKaynak.set(h.kaynakId, liste);
    }
  }

  const eksik = await prisma.yukIlani.findMany({
    where: {
      gonderenUserId: null,
      createdAt: { gte: sinir },
    },
    select: {
      id: true,
      kaynakId: true,
      kaynakMesajId: true,
      hamMesajId: true,
      hamMetin: true,
      telefon: true,
    },
    take: 5_000,
  });

  let hamEslesti = 0;
  for (const ilan of eksik) {
    let uid: string | null = null;
    let hamId: number | null = ilan.hamMesajId;
    let tgMsg: number | null = ilan.kaynakMesajId;

    if (ilan.kaynakId != null && ilan.kaynakMesajId != null) {
      const hit = byMesaj.get(`${ilan.kaynakId}:${ilan.kaynakMesajId}`);
      if (hit) {
        uid = hit.uid;
        hamId = hit.hamId;
      }
    }

    if (!uid && ilan.hamMesajId) {
      const ham = hamlar.find((h) => h.id === ilan.hamMesajId);
      if (ham?.gonderenUserId) {
        uid = ham.gonderenUserId;
        tgMsg = ham.mesajId ?? tgMsg;
      }
    }

    if (!uid && ilan.hamMetin && ilan.kaynakId != null) {
      for (const h of byKaynak.get(ilan.kaynakId) ?? []) {
        if (metinEslesir(ilan.hamMetin, h.metin)) {
          uid = h.gonderenUserId;
          hamId = h.id;
          tgMsg = h.mesajId ?? tgMsg;
          break;
        }
      }
    }

    if (!uid) continue;
    hamEslesti += 1;
    if (yaz) {
      await prisma.yukIlani.update({
        where: { id: ilan.id },
        data: {
          gonderenUserId: uid,
          ...(hamId != null && !ilan.hamMesajId ? { hamMesajId: hamId } : {}),
          ...(tgMsg != null && ilan.kaynakMesajId == null
            ? { kaynakMesajId: tgMsg }
            : {}),
        },
      });
    }
  }

  // Telefon yayılımı: aynı normalize tel → uid kopyala
  const uidLiIlanlar = await prisma.yukIlani.findMany({
    where: {
      gonderenUserId: { not: null },
      telefon: { not: null },
      createdAt: { gte: sinir },
    },
    select: { telefon: true, gonderenUserId: true },
    take: 5_000,
  });

  const telUid = new Map<string, string>();
  for (const i of uidLiIlanlar) {
    const k = telefonAnahtar(i.telefon);
    if (k && i.gonderenUserId && !telUid.has(k)) {
      telUid.set(k, i.gonderenUserId);
    }
  }

  const telEksik = await prisma.yukIlani.findMany({
    where: {
      gonderenUserId: null,
      telefon: { not: null },
      createdAt: { gte: sinir },
    },
    select: { id: true, telefon: true },
    take: 5_000,
  });

  let telefonYayildi = 0;
  for (const ilan of telEksik) {
    const k = telefonAnahtar(ilan.telefon);
    if (!k) continue;
    const uid = telUid.get(k);
    if (!uid) continue;
    telefonYayildi += 1;
    if (yaz) {
      await prisma.yukIlani.update({
        where: { id: ilan.id },
        data: { gonderenUserId: uid },
      });
    }
  }

  const uidLiIlanSonra = yaz
    ? await prisma.yukIlani.count({ where: { gonderenUserId: { not: null } } })
    : uidLiIlanOnce + hamEslesti + telefonYayildi;

  return {
    hamEslesti,
    telefonYayildi,
    uidLiHam,
    uidLiIlanOnce,
    uidLiIlanSonra,
  };
}
