"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ARAC_SINIFLARI, PLAKA_DESENI, aracEtiketi, uygunKasaTipleri } from "@/lib/aracTip";

export type AracIslemSonuc = { hata: string | null; tamam: boolean };

function metin(f: FormData, ad: string, uz = 40): string {
  return String(f.get(ad) || "").trim().slice(0, uz);
}

function sayi(f: FormData, ad: string, en: number, enCok: number): number | null | "hata" {
  const ham = metin(f, ad, 10).replace(",", ".");
  if (!ham) return null;
  const n = Number(ham);
  return Number.isFinite(n) && n >= en && n <= enCok ? Math.round(n * 100) / 100 : "hata";
}

/** Formdaki araç bilgileri (sınıf ve gövde ayrı; ölçüler isteğe bağlı). */
function aracVerisi(f: FormData) {
  const sinif = metin(f, "sinif", 20);
  const kasaTipi = metin(f, "kasaTipi", 20) || null;
  if (!ARAC_SINIFLARI.some((s) => s.kod === sinif)) return { hata: "Araç tipini seç." } as const;
  if (kasaTipi && !uygunKasaTipleri(sinif).some((k) => k.kod === kasaTipi)) return { hata: "Bu araca uygun kasa tipini seç." } as const;
  const plaka = metin(f, "plaka", 15).toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
  if (plaka && !PLAKA_DESENI.test(plaka)) return { hata: "Plakayı 06 ABC 123 gibi yaz." } as const;
  const kapasiteTon = sayi(f, "kapasiteTon", 0.3, 60);
  const kasaUzunlukM = sayi(f, "kasaUzunlukM", 1, 20);
  if (kapasiteTon === "hata") return { hata: "Kapasite 0,3–60 ton arası olmalı." } as const;
  if (kasaUzunlukM === "hata") return { hata: "Kasa uzunluğu 1–20 m arası olmalı." } as const;
  const sofor = metin(f, "sofor", 60).replace(/\s+/g, " ");
  return {
    veri: {
      ad: aracEtiketi({ ad: "Araç", sinif, kasaTipi }),
      sinif,
      kasaTipi,
      plaka: plaka || null,
      sofor: sofor || null,
      kapasiteTon,
      kasaUzunlukM,
    },
  } as const;
}

function yenile() {
  revalidatePath("/");
  revalidatePath("/arac");
}

/** Yeni araç (kullanıcının kendi defterine). İlk araçsa seçili olur. */
export async function aracEkle(_o: AracIslemSonuc, f: FormData): Promise<AracIslemSonuc> {
  const r = aracVerisi(f);
  if ("hata" in r) return { hata: r.hata ?? null, tamam: false };
  if (r.veri.plaka && (await prisma.arac.findFirst({ where: { plaka: r.veri.plaka } }))) {
    return { hata: "Bu plaka zaten kayıtlı.", tamam: false };
  }
  // Çift dokunma: aynı bilgilerle az önce eklenen araç tekrar yazılmaz
  const yakin = await prisma.arac.findFirst({
    where: { sinif: r.veri.sinif, kasaTipi: r.veri.kasaTipi, plaka: r.veri.plaka, createdAt: { gte: new Date(Date.now() - 20_000) } },
  });
  if (!yakin) {
    const varMi = await prisma.arac.count();
    await prisma.arac.create({ data: { ...r.veri, aktif: varMi === 0 } });
  }
  yenile();
  return { hata: null, tamam: true };
}

export async function aracBilgiKaydet(_o: AracIslemSonuc, f: FormData): Promise<AracIslemSonuc> {
  const id = Number(f.get("aracId"));
  if (!Number.isInteger(id) || id <= 0) return { hata: "Araç bulunamadı.", tamam: false };
  const r = aracVerisi(f);
  if ("hata" in r) return { hata: r.hata ?? null, tamam: false };
  if (r.veri.plaka && (await prisma.arac.findFirst({ where: { plaka: r.veri.plaka, id: { not: id } } }))) {
    return { hata: "Bu plaka başka araçta kayıtlı.", tamam: false };
  }
  // Kullanıcının defterinde yoksa (başka kullanıcının numarası) hiçbir şey olmaz
  const n = await prisma.arac.updateMany({ where: { id }, data: r.veri });
  if (n.count === 0) return { hata: "Araç bulunamadı.", tamam: false };
  yenile();
  return { hata: null, tamam: true };
}

/** Seçili aracı değiştir: yeni sefer/gider ve km/bakım bu araca bağlanır. */
export async function aktifAracSec(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  if (!(await prisma.arac.findUnique({ where: { id }, select: { id: true } }))) return;
  await prisma.$transaction([
    prisma.arac.updateMany({ where: { aktif: true, id: { not: id } }, data: { aktif: false } }),
    prisma.arac.update({ where: { id }, data: { aktif: true } }),
  ]);
  yenile();
}

/** Sefer ya da gider bağlı değilse ve seçili değilse silinir (kayıtlar boşta kalmasın). */
export async function aracSil(id: number): Promise<AracIslemSonuc> {
  if (!Number.isInteger(id) || id <= 0) return { hata: "Araç bulunamadı.", tamam: false };
  const a = await prisma.arac.findUnique({ where: { id } });
  if (!a) return { hata: "Araç bulunamadı.", tamam: false };
  if (a.aktif) return { hata: "Seçili araç silinemez; önce başka aracı seç.", tamam: false };
  const ilk = await prisma.arac.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  const [sefer, gider] = await Promise.all([prisma.yuk.count({ where: { aracId: id } }), prisma.gider.count({ where: { aracId: id } })]);
  if (ilk?.id === id || sefer + gider > 0) return { hata: "Bu araca bağlı kayıtlar var; silinemez.", tamam: false };
  await prisma.arac.delete({ where: { id } });
  yenile();
  return { hata: null, tamam: true };
}
