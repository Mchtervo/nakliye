"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { aktifBaglam } from "@/lib/baglam";
import { prisma } from "@/lib/prisma";
import { anaPrisma } from "@/lib/prismaAna";
import { ilBul } from "@/lib/iller";
import { ARAC_SINIFLARI, PLAKA_DESENI, aracEtiketi, uygunKasaTipleri } from "@/lib/aracTip";
import { uyeSemasiHazirla } from "@/lib/uyeSema";

export type KurulumTaslak = {
  sinif?: string;
  anaUs?: string;
  konumIl?: string;
  kasaTipi?: string;
  kapasiteTon?: number | null;
  kasaUzunlukM?: number | null;
  kasaGenislikM?: number | null;
  kasaYukseklikM?: number | null;
  plaka?: string | null;
};

export type KurulumSonuc = { hata: string | null; bekliyor?: boolean };

async function uye() {
  const b = await aktifBaglam();
  if (b.uyeId === null) throw new Error("Kurulum üye hesabı içindir.");
  const u = await anaPrisma.uye.findUnique({ where: { id: b.uyeId } });
  if (!u) throw new Error("Hesap bulunamadı.");
  return u;
}

function taslakOku(j: Prisma.JsonValue | null): KurulumTaslak {
  return j && typeof j === "object" && !Array.isArray(j) ? (j as KurulumTaslak) : {};
}

async function taslakYaz(uyeId: number, ek: KurulumTaslak, adim: number, eskiAdim: number, eski: KurulumTaslak) {
  await anaPrisma.uye.update({
    where: { id: uyeId },
    data: { kurulumTaslak: { ...eski, ...ek } as Prisma.InputJsonValue, kurulumAdim: Math.max(adim, eskiAdim) },
  });
}

/** "12,5" / "12.5" → 12.5; boş → null; aralık dışı → hata. */
function sayiOku(f: FormData, ad: string, en: number, enCok: number, adi: string): number | null | string {
  const ham = String(f.get(ad) || "").trim().replace(",", ".");
  if (!ham) return null;
  const n = Number(ham);
  if (!Number.isFinite(n) || n < en || n > enCok) return `${adi} ${en}–${enCok} arası olmalı.`;
  return Math.round(n * 100) / 100;
}

/** Adım 1: araç sınıfı */
export async function kurulumSinif(_o: KurulumSonuc, f: FormData): Promise<KurulumSonuc> {
  const u = await uye();
  const sinif = String(f.get("sinif") || "");
  if (!ARAC_SINIFLARI.some((s) => s.kod === sinif)) return { hata: "Araç tipini seç." };
  const eski = taslakOku(u.kurulumTaslak);
  // Sınıf değişince uymayan kasa tipi düşer
  const kasaTipi = eski.kasaTipi && uygunKasaTipleri(sinif).some((k) => k.kod === eski.kasaTipi) ? eski.kasaTipi : undefined;
  await taslakYaz(u.id, { sinif, kasaTipi }, 1, u.kurulumAdim, eski);
  redirect("/kurulum?adim=2");
}

/** Adım 2: yaşadığı şehir (ana üs) + aracın bulunduğu şehir */
export async function kurulumKonum(_o: KurulumSonuc, f: FormData): Promise<KurulumSonuc> {
  const u = await uye();
  const anaUs = ilBul(String(f.get("anaUs") || ""));
  const konumIl = ilBul(String(f.get("konumIl") || ""));
  if (!anaUs) return { hata: "Yaşadığın şehri seç." };
  if (!konumIl) return { hata: "Aracının bulunduğu şehri seç." };
  await taslakYaz(u.id, { anaUs, konumIl }, 2, u.kurulumAdim, taslakOku(u.kurulumTaslak));
  await anaPrisma.uye.update({ where: { id: u.id }, data: { sehir: anaUs } });
  redirect("/kurulum?adim=3");
}

// Aynı üyenin "Tamamla" isteği üst üste gelirse araç bir kez yazılır
const kilit = new Map<number, Promise<unknown>>();

/** Adım 3: kasa, taşıma bilgileri, plaka → defter hazırsa araca yazılır, kurulum biter. */
export async function kurulumArac(_o: KurulumSonuc, f: FormData): Promise<KurulumSonuc> {
  const u = await uye();
  const eski = taslakOku(u.kurulumTaslak);
  if (!eski.sinif) redirect("/kurulum?adim=1");
  if (!eski.anaUs || !eski.konumIl) redirect("/kurulum?adim=2");

  const kasaTipi = String(f.get("kasaTipi") || "");
  if (!uygunKasaTipleri(eski.sinif).some((k) => k.kod === kasaTipi)) return { hata: "Kasa tipini seç." };
  const kapasiteTon = sayiOku(f, "kapasiteTon", 0.3, 60, "Kapasite (ton)");
  const kasaUzunlukM = sayiOku(f, "kasaUzunlukM", 1, 20, "Kasa uzunluğu (m)");
  const kasaGenislikM = sayiOku(f, "kasaGenislikM", 1, 3.5, "Kasa genişliği (m)");
  const kasaYukseklikM = sayiOku(f, "kasaYukseklikM", 0.5, 4.5, "Kasa yüksekliği (m)");
  for (const d of [kapasiteTon, kasaUzunlukM, kasaGenislikM, kasaYukseklikM]) if (typeof d === "string") return { hata: d };
  const plaka = String(f.get("plaka") || "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
  if (plaka && !PLAKA_DESENI.test(plaka)) return { hata: "Plakayı 06 ABC 123 gibi yaz." };

  const taslak: KurulumTaslak = {
    ...eski,
    kasaTipi,
    kapasiteTon: kapasiteTon as number | null,
    kasaUzunlukM: kasaUzunlukM as number | null,
    kasaGenislikM: kasaGenislikM as number | null,
    kasaYukseklikM: kasaYukseklikM as number | null,
    plaka: plaka || null,
  };
  // Cevaplar önce hesaba yazılır: defter hazır değilse bile kaybolmaz
  await anaPrisma.uye.update({ where: { id: u.id }, data: { kurulumTaslak: taslak as Prisma.InputJsonValue } });

  // Yeni üyenin defteri ilk kez kuruluyorsa biraz bekle; olmazsa ekran tekrar dener
  const hazir = await Promise.race([
    uyeSemasiHazirla(u.id).then(() => true),
    new Promise<boolean>((ok) => setTimeout(() => ok(false), 8000)),
  ]).catch(() => false);
  if (!hazir) return { hata: null, bekliyor: true };

  const onceki = kilit.get(u.id);
  if (onceki) await onceki.catch(() => null);
  const is = taslakUygula(u.id, taslak);
  kilit.set(u.id, is);
  try {
    await is;
  } finally {
    kilit.delete(u.id);
  }
  revalidatePath("/", "layout");
  redirect("/kurulum?adim=4");
}

async function taslakUygula(uyeId: number, t: KurulumTaslak) {
  const veri = {
    ad: aracEtiketi({ ad: "Araç", sinif: t.sinif, kasaTipi: t.kasaTipi }),
    sinif: t.sinif ?? null,
    kasaTipi: t.kasaTipi ?? null,
    kapasiteTon: t.kapasiteTon ?? null,
    kasaUzunlukM: t.kasaUzunlukM ?? null,
    kasaGenislikM: t.kasaGenislikM ?? null,
    kasaYukseklikM: t.kasaYukseklikM ?? null,
    plaka: t.plaka ?? null,
    konumIl: t.konumIl ?? null,
  };
  // Kurulum ilk aracı yazar; tekrar gelirse aynı aracı günceller (çift araç olmaz)
  const mevcut = await prisma.arac.findFirst({ where: { aktif: true }, orderBy: { id: "asc" } }) ?? (await prisma.arac.findFirst({ orderBy: { id: "asc" } }));
  if (mevcut) await prisma.arac.update({ where: { id: mevcut.id }, data: { ...veri, aktif: true } });
  else await prisma.arac.create({ data: { ...veri, aktif: true } });

  // Yük Bul ve hatırlatmalar üyenin kendi ayarlarını kullanır (ana üs, aracın konumu)
  for (const [anahtar, deger] of [
    ["ai_ana_us", t.anaUs],
    ["arac_konum", t.konumIl],
  ] as const) {
    if (!deger) continue;
    await prisma.ayar.upsert({ where: { anahtar }, update: { deger }, create: { anahtar, deger } });
  }
  await anaPrisma.uye.update({ where: { id: uyeId }, data: { kurulumAdim: 3, kurulumBitti: new Date() } });
}
