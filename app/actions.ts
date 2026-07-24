"use server";

import { prisma } from "@/lib/prisma";
import { kdvHesapla, tlKurusaCevir, tlYaz } from "@/lib/para";
import { GIDER_KATEGORILERI } from "@/lib/sabitler";
import { fisKaydet, fisSil } from "@/lib/fis";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FormSonuc = { hata: string } | null;

function tarihOku(deger: FormDataEntryValue | null): Date | null {
  if (typeof deger !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(deger)) {
    return null;
  }
  const t = new Date(deger + "T00:00:00");
  return Number.isNaN(t.getTime()) ? null : t;
}

function metinOku(deger: FormDataEntryValue | null): string {
  return typeof deger === "string" ? deger.trim() : "";
}

async function firmaBulVeyaOlustur(
  firmaIdHam: string,
  yeniFirmaAdi: string
): Promise<{ id: number } | { hata: string }> {
  if (firmaIdHam === "yeni") {
    if (!yeniFirmaAdi) return { hata: "Yeni firma adı boş olamaz." };
    const mevcut = await prisma.firma.findUnique({ where: { ad: yeniFirmaAdi } });
    if (mevcut) return { id: mevcut.id };
    const firma = await prisma.firma.create({ data: { ad: yeniFirmaAdi } });
    return { id: firma.id };
  }
  const id = Number(firmaIdHam);
  if (!Number.isInteger(id) || id <= 0) return { hata: "Lütfen bir firma seçin." };
  const firma = await prisma.firma.findUnique({ where: { id } });
  if (!firma) return { hata: "Seçilen firma bulunamadı." };
  return { id: firma.id };
}

export async function yukEkle(
  _oncekiDurum: FormSonuc,
  formData: FormData
): Promise<FormSonuc> {
  const tarih = tarihOku(formData.get("tarih"));
  if (!tarih) return { hata: "Geçerli bir tarih seçin." };

  const nereden = metinOku(formData.get("nereden"));
  const nereye = metinOku(formData.get("nereye"));
  if (!nereden || !nereye) return { hata: "Nereden ve nereye alanları boş olamaz." };

  const tutarKurus = tlKurusaCevir(metinOku(formData.get("tutar")));
  if (tutarKurus === null || tutarKurus <= 0) {
    return { hata: "Geçerli bir tutar girin (örnek: 12.000 veya 12.000,50)." };
  }

  const kdvli = formData.get("kdvli") === "1";
  const kdvDahilMi = formData.get("kdvDahilMi") === "1";

  const firmaSonuc = await firmaBulVeyaOlustur(
    metinOku(formData.get("firmaId")),
    metinOku(formData.get("yeniFirmaAdi"))
  );
  if ("hata" in firmaSonuc) return firmaSonuc;

  const { netTutar, kdvTutar, toplamTutar } = kdvHesapla(tutarKurus, kdvli, kdvDahilMi);
  const odendiMi = formData.get("odendiMi") === "1";

  await prisma.yuk.create({
    data: {
      tarih,
      firmaId: firmaSonuc.id,
      nereden,
      nereye,
      aciklama: metinOku(formData.get("aciklama")) || null,
      kdvli,
      kdvDahilMi,
      netTutar,
      kdvTutar,
      toplamTutar,
      odemeDurumu: odendiMi ? "ODENDI" : "BEKLIYOR",
      odemeler: odendiMi
        ? { create: { tarih, tutar: toplamTutar, not: "Kayıt sırasında ödendi" } }
        : undefined,
    },
  });

  revalidatePath("/");
  revalidatePath("/yukler");
  revalidatePath("/firmalar");
  revalidatePath("/raporlar");
  redirect("/yukler");
}

export async function yukSil(id: number): Promise<void> {
  const yuk = await prisma.yuk.findUnique({ where: { id } });
  if (!yuk) return;
  await prisma.yuk.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/yukler");
  revalidatePath("/firmalar");
  revalidatePath(`/firmalar/${yuk.firmaId}`);
  revalidatePath("/raporlar");
}

/** Yükün kalan tutarının tamamını ödenmiş olarak işaretler. */
export async function yukOdendiIsaretle(id: number): Promise<void> {
  const yuk = await prisma.yuk.findUnique({
    where: { id },
    include: { odemeler: true },
  });
  if (!yuk) return;
  const odenen = yuk.odemeler.reduce((t, o) => t + o.tutar, 0);
  const kalan = yuk.toplamTutar - odenen;
  if (kalan > 0) {
    await prisma.odeme.create({
      data: { yukId: id, tarih: new Date(), tutar: kalan },
    });
  }
  await prisma.yuk.update({ where: { id }, data: { odemeDurumu: "ODENDI" } });
  revalidatePath("/");
  revalidatePath("/yukler");
  revalidatePath("/firmalar");
  revalidatePath(`/firmalar/${yuk.firmaId}`);
  revalidatePath("/raporlar");
}

/** Yüke kısmi (veya kalan) ödeme ekler. */
export async function yukOdemeEkle(
  _oncekiDurum: FormSonuc,
  formData: FormData
): Promise<FormSonuc> {
  const yukId = Number(metinOku(formData.get("yukId")));
  if (!Number.isInteger(yukId) || yukId <= 0) return { hata: "Geçersiz yük." };

  const tarih = tarihOku(formData.get("tarih")) || new Date();
  const tutarKurus = tlKurusaCevir(metinOku(formData.get("tutar")));
  if (tutarKurus === null || tutarKurus <= 0) {
    return { hata: "Geçerli bir ödeme tutarı girin." };
  }

  const yuk = await prisma.yuk.findUnique({
    where: { id: yukId },
    include: { odemeler: true },
  });
  if (!yuk) return { hata: "Yük bulunamadı." };

  const odenen = yuk.odemeler.reduce((t, o) => t + o.tutar, 0);
  const kalan = yuk.toplamTutar - odenen;
  if (kalan <= 0) return { hata: "Bu yükün ödemesi zaten tamamlanmış." };
  if (tutarKurus > kalan) {
    return {
      hata: `Kalan alacak ${tlYaz(kalan)}. Daha fazla giremezsin.`,
    };
  }

  await prisma.odeme.create({
    data: {
      yukId,
      tarih,
      tutar: tutarKurus,
      not: metinOku(formData.get("not")) || null,
    },
  });

  const yeniOdenen = odenen + tutarKurus;
  const durum =
    yeniOdenen >= yuk.toplamTutar ? "ODENDI" : yeniOdenen > 0 ? "KISMI" : "BEKLIYOR";

  await prisma.yuk.update({ where: { id: yukId }, data: { odemeDurumu: durum } });

  revalidatePath("/");
  revalidatePath("/yukler");
  revalidatePath("/firmalar");
  revalidatePath(`/firmalar/${yuk.firmaId}`);
  revalidatePath("/raporlar");
  return null;
}

export async function giderEkle(
  _oncekiDurum: FormSonuc,
  formData: FormData
): Promise<FormSonuc> {
  const tarih = tarihOku(formData.get("tarih"));
  if (!tarih) return { hata: "Geçerli bir tarih seçin." };

  const kategori = metinOku(formData.get("kategori"));
  if (!GIDER_KATEGORILERI.some((k) => k.kod === kategori)) {
    return { hata: "Geçerli bir kategori seçin." };
  }

  const tutarKurus = tlKurusaCevir(metinOku(formData.get("tutar")));
  if (tutarKurus === null || tutarKurus <= 0) {
    return { hata: "Geçerli bir tutar girin (örnek: 4.500 veya 4.500,75)." };
  }

  const kdvli = formData.get("kdvli") === "1";
  const kdvDahilMi = formData.get("kdvDahilMi") === "1";
  const { netTutar, kdvTutar, toplamTutar } = kdvHesapla(tutarKurus, kdvli, kdvDahilMi);

  const litreHam = metinOku(formData.get("litre"));
  const litre = litreHam ? Number(litreHam.replace(",", ".")) : null;
  if (litre !== null && (!Number.isFinite(litre) || litre <= 0)) {
    return { hata: "Litre değeri geçersiz." };
  }

  const kmHam = metinOku(formData.get("km"));
  const km = kmHam ? Number(kmHam) : null;
  if (km !== null && (!Number.isInteger(km) || km <= 0)) {
    return { hata: "Km değeri geçersiz (tam sayı olmalı)." };
  }

  const fisHam = formData.get("fisResmi");
  const fisDosya = fisHam instanceof File ? fisHam : null;
  const fisSonuc = await fisKaydet(fisDosya);
  if (fisSonuc && "hata" in fisSonuc) return fisSonuc;

  await prisma.gider.create({
    data: {
      tarih,
      kategori,
      aciklama: metinOku(formData.get("aciklama")) || null,
      kdvli,
      kdvDahilMi,
      netTutar,
      kdvTutar,
      toplamTutar,
      litre,
      km,
      fisResmi: fisSonuc?.yol ?? null,
    },
  });

  revalidatePath("/");
  revalidatePath("/giderler");
  revalidatePath("/muhasebeci");
  revalidatePath("/raporlar");
  redirect("/giderler");
}

export async function giderSil(id: number): Promise<void> {
  const gider = await prisma.gider.findUnique({ where: { id } });
  if (gider) {
    await fisSil(gider.fisResmi);
    await prisma.gider.delete({ where: { id } });
  }
  revalidatePath("/");
  revalidatePath("/giderler");
  revalidatePath("/muhasebeci");
  revalidatePath("/raporlar");
}

export async function muhasebeciNumaraKaydet(
  _oncekiDurum: FormSonuc,
  formData: FormData
): Promise<FormSonuc> {
  let telefon = metinOku(formData.get("telefon")).replace(/[\s\-()]/g, "");
  if (telefon.startsWith("00")) telefon = "+" + telefon.slice(2);
  if (telefon.startsWith("0")) telefon = "+90" + telefon.slice(1);
  if (!telefon.startsWith("+") && /^90\d{10}$/.test(telefon)) {
    telefon = "+" + telefon;
  }
  if (!telefon.startsWith("+") && /^5\d{9}$/.test(telefon)) {
    telefon = "+90" + telefon;
  }

  if (!/^\+\d{10,15}$/.test(telefon)) {
    return {
      hata: "Geçerli bir telefon girin. Örnek: 05XX XXX XX XX veya +90 5XX XXX XX XX",
    };
  }

  await prisma.ayar.upsert({
    where: { anahtar: "muhasebeci_telefon" },
    create: { anahtar: "muhasebeci_telefon", deger: telefon },
    update: { deger: telefon },
  });

  revalidatePath("/muhasebeci");
  return null;
}

export async function fisleriGonderildiIsaretle(idler: number[]): Promise<void> {
  if (idler.length === 0) return;
  await prisma.gider.updateMany({
    where: { id: { in: idler } },
    data: { gonderildi: true, gonderimTarihi: new Date() },
  });
  revalidatePath("/giderler");
  revalidatePath("/muhasebeci");
}
