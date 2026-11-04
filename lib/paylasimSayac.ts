/**
 * Kişi (telefon) başına kalıcı paylaşım sayacı. İlanlar 6 saatte silinir; "bu kişi
 * bugüne kadar kaç yük paylaştı" bilgisi buradan gelir. Yalnız listede görünen
 * (ELENDI olmayan) yeni ilanlar sayılır; aynı rota tekrar paylaşılınca dedup zaten
 * yeni kayıt açmaz, yani sayaç tekrar eden ilanı şişirmez.
 */
import { anaPrisma } from "@/lib/prismaAna";
import { ilBul } from "@/lib/iller";

/** TR takvim günü (YYYY-MM-DD). */
export function trGun(zaman: number = Date.now()): string {
  return new Date(zaman + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function telefon10(tel: string | null | undefined): string | null {
  const r = (tel || "").replace(/\D/g, "");
  return r.length >= 10 ? r.slice(-10) : null;
}

export async function paylasimSay(
  i: { telefon: string | null; cikisIl: string | null; varisIl: string | null; firmaAdi: string | null },
  gun: string = trGun(),
  adet = 1
): Promise<void> {
  const telefon = telefon10(i.telefon);
  if (!telefon) return;
  const cikisIl = ilBul(i.cikisIl) || i.cikisIl || "";
  const varisIl = ilBul(i.varisIl) || i.varisIl || "";
  const firmaAdi = i.firmaAdi?.trim().slice(0, 80) || null;
  await anaPrisma.paylasimGun.upsert({
    where: { telefon_gun_cikisIl_varisIl: { telefon, gun, cikisIl, varisIl } },
    create: { telefon, gun, cikisIl, varisIl, adet, firmaAdi },
    update: { adet: { increment: adet }, ...(firmaAdi ? { firmaAdi } : {}) },
  });
}

export type PaylasimOzet = {
  telefon: string;
  firmaAdi: string | null;
  toplam: number;
  bugun: number;
  hafta: number;
  /** Sayaçta ilk görüldüğü günden bu yana geçen gün (en az 1) */
  takipGun: number;
  sonGun: string;
  cikislar: Map<string, number>;
  rotalar: Map<string, number>;
};

/** Son `gun` günün sayaçları, telefon bazında. */
export async function paylasimOzetleri(gun = 60): Promise<Map<string, PaylasimOzet>> {
  const bugun = trGun();
  const haftaSinir = trGun(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const satirlar = await anaPrisma.paylasimGun.findMany({
    where: { gun: { gte: trGun(Date.now() - (gun - 1) * 24 * 60 * 60 * 1000) } },
    select: { telefon: true, gun: true, cikisIl: true, varisIl: true, adet: true, firmaAdi: true },
    orderBy: { gun: "asc" },
  });
  const harita = new Map<string, PaylasimOzet>();
  const ilkGun = new Map<string, string>();
  for (const s of satirlar) {
    let o = harita.get(s.telefon);
    if (!o) {
      o = { telefon: s.telefon, firmaAdi: null, toplam: 0, bugun: 0, hafta: 0, takipGun: 1, sonGun: s.gun, cikislar: new Map(), rotalar: new Map() };
      harita.set(s.telefon, o);
      ilkGun.set(s.telefon, s.gun);
    }
    o.toplam += s.adet;
    if (s.gun === bugun) o.bugun += s.adet;
    if (s.gun >= haftaSinir) o.hafta += s.adet;
    if (s.gun > o.sonGun) o.sonGun = s.gun;
    if (s.firmaAdi) o.firmaAdi = s.firmaAdi; // gün sırasıyla: en yenisi kalır
    if (s.cikisIl) o.cikislar.set(s.cikisIl, (o.cikislar.get(s.cikisIl) || 0) + s.adet);
    if (s.cikisIl && s.varisIl) {
      const r = `${s.cikisIl}|${s.varisIl}`;
      o.rotalar.set(r, (o.rotalar.get(r) || 0) + s.adet);
    }
  }
  const t0 = Date.parse(`${bugun}T12:00:00Z`);
  for (const [tel, o] of harita) {
    const ilk = Date.parse(`${ilkGun.get(tel)}T12:00:00Z`);
    o.takipGun = Math.max(1, Math.round((t0 - ilk) / 86_400_000) + 1);
  }
  return harita;
}
