"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, ayarYaz } from "@/lib/ayarlar";
import { bolgeCozumle } from "@/lib/bolgeler";
import { ilBul } from "@/lib/iller";
import { tlKurusaCevir } from "@/lib/para";
import { kaynaklariTara } from "@/lib/kaynaklar/tarama";
import { adayFirmalariBul } from "@/lib/ai/firmaBul";
import { gunlukAnaliziUret } from "@/lib/ai/gunlukAnaliz";
import type { KaynakTuru } from "@/lib/kaynaklar/tip";

export type AiSonuc = { hata: string } | { bilgi: string } | null;

function metinOku(deger: FormDataEntryValue | null): string {
  return typeof deger === "string" ? deger.trim() : "";
}

const ILAN_DURUMLARI = ["YENI", "ILGILENIYOR", "ELENDI", "YUKE_DONDU"];

export async function ilanDurumGuncelle(
  id: number,
  durum: string
): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  if (!ILAN_DURUMLARI.includes(durum)) return;

  await prisma.yukIlani.update({ where: { id }, data: { durum } }).catch(() => null);
  revalidatePath("/ai/yukler");
  revalidatePath("/ai/donus");
}

export async function ilanSil(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  await prisma.yukIlani.delete({ where: { id } }).catch(() => null);
  revalidatePath("/ai/yukler");
  revalidatePath("/ai/donus");
}

export async function eskiIlanlariTemizle(): Promise<void> {
  const sinir = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  await prisma.yukIlani.deleteMany({
    where: { createdAt: { lt: sinir }, durum: { in: ["YENI", "ELENDI"] } },
  });
  revalidatePath("/ai/yukler");
}

export async function simdiTara(): Promise<void> {
  await kaynaklariTara(4);
  revalidatePath("/ai/yukler");
  revalidatePath("/ai/donus");
  revalidatePath("/");
}

export async function kaynakEkle(
  _oncekiDurum: AiSonuc,
  formData: FormData
): Promise<AiSonuc> {
  const tur = metinOku(formData.get("tur")) as KaynakTuru;
  if (tur !== "WEB" && tur !== "AI_ARAMA") {
    return { hata: "Kaynak türü geçersiz." };
  }

  const hedef = metinOku(formData.get("hedef"));
  if (!hedef) return { hata: "Adres veya arama sorgusu gir." };

  if (tur === "WEB") {
    try {
      const url = new URL(hedef);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { hata: "Adres http veya https ile başlamalı." };
      }
    } catch {
      return { hata: "Geçerli bir adres gir (https://... şeklinde)." };
    }
  }

  const ad = metinOku(formData.get("ad")) || hedef.slice(0, 60);

  const mevcut = await prisma.ilanKaynagi.findUnique({
    where: { tur_hedef: { tur, hedef } },
  });
  if (mevcut) return { hata: "Bu kaynak zaten ekli." };

  await prisma.ilanKaynagi.create({ data: { tur, ad, hedef } });
  revalidatePath("/ayarlar");
  return { bilgi: "Kaynak eklendi. İlk tarama en geç 15 dakika içinde." };
}

export async function kaynakDurumDegistir(id: number): Promise<void> {
  const kaynak = await prisma.ilanKaynagi.findUnique({ where: { id } });
  if (!kaynak) return;

  const acik = !kaynak.aktif;
  await prisma.ilanKaynagi.update({
    where: { id },
    data: { aktif: acik, durum: acik ? "AKTIF" : "PASIF" },
  });
  revalidatePath("/ayarlar");
}

export async function kaynakSil(id: number): Promise<void> {
  await prisma.ilanKaynagi.delete({ where: { id } }).catch(() => null);
  revalidatePath("/ayarlar");
}

export async function aiTercihKaydet(
  _oncekiDurum: AiSonuc,
  formData: FormData
): Promise<AiSonuc> {
  const sehirHam = metinOku(formData.get("sehir"));
  const sehir = sehirHam ? ilBul(sehirHam) : null;
  if (sehirHam && !sehir) {
    return { hata: "Şehri tanıyamadım. Örnek: Ankara" };
  }

  const rotalar = metinOku(formData.get("rotalar"))
    .split(/[,\n]/)
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, 20)
    .join(",");

  const minUcretHam = metinOku(formData.get("minUcret"));
  const minUcret = minUcretHam ? tlKurusaCevir(minUcretHam) : 0;
  if (minUcretHam && minUcret === null) {
    return { hata: "Alt ücret sınırı geçersiz." };
  }

  const bolgeler = bolgeCozumle(
    formData.getAll("bolgeler").map(String).join(",")
  ).join(",");

  await ayarYaz(AYAR_ANAHTARLARI.aiSehir, sehir || "");
  await ayarYaz(AYAR_ANAHTARLARI.aiRotalar, rotalar);
  await ayarYaz(AYAR_ANAHTARLARI.aiMinUcret, String(minUcret ?? 0));
  await ayarYaz(AYAR_ANAHTARLARI.aiBolgeler, bolgeler);
  await ayarYaz(
    AYAR_ANAHTARLARI.bildirimTelegram,
    formData.get("bildirimTelegram") === "1" ? "1" : "0"
  );
  await ayarYaz(
    AYAR_ANAHTARLARI.bildirimPush,
    formData.get("bildirimPush") === "1" ? "1" : "0"
  );
  await ayarYaz(
    AYAR_ANAHTARLARI.telegramUyeAktif,
    formData.get("telegramUye") === "1" ? "1" : "0"
  );

  revalidatePath("/ayarlar");
  revalidatePath("/ai/yukler");
  return { bilgi: "AI tercihleri kaydedildi." };
}

export async function adayFirmaAra(
  _oncekiDurum: AiSonuc,
  formData: FormData
): Promise<AiSonuc> {
  const sehirHam = metinOku(formData.get("sehir"));
  const sehir = ilBul(sehirHam);
  if (!sehir) return { hata: "Geçerli bir şehir gir. Örnek: Ankara" };

  const sektor = metinOku(formData.get("sektor"));

  try {
    const eklenen = await adayFirmalariBul(sehir, sektor || null);
    revalidatePath("/ai/firmalar");
    return {
      bilgi:
        eklenen > 0
          ? `${eklenen} yeni aday firma bulundu.`
          : "Yeni firma bulunamadı; farklı bir sektör veya şehir dene.",
    };
  } catch (hata) {
    return {
      hata: hata instanceof Error ? hata.message : "Firma araması başarısız.",
    };
  }
}

const ADAY_DURUMLARI = ["YENI", "ARANDI", "MUSTERI", "ELENDI"];

export async function adayFirmaDurumGuncelle(
  id: number,
  durum: string
): Promise<void> {
  if (!ADAY_DURUMLARI.includes(durum)) return;
  await prisma.adayFirma.update({ where: { id }, data: { durum } }).catch(() => null);
  revalidatePath("/ai/firmalar");
}

export async function adayFirmaSil(id: number): Promise<void> {
  await prisma.adayFirma.delete({ where: { id } }).catch(() => null);
  revalidatePath("/ai/firmalar");
}

/** Aday firmayı gerçek cari listesine taşır. */
export async function adayFirmayiCariyeEkle(id: number): Promise<void> {
  const aday = await prisma.adayFirma.findUnique({ where: { id } });
  if (!aday) return;

  const mevcut = await prisma.firma.findUnique({ where: { ad: aday.ad } });
  if (!mevcut) {
    await prisma.firma.create({
      data: { ad: aday.ad, telefon: aday.telefon },
    });
  }

  await prisma.adayFirma.update({
    where: { id },
    data: { durum: "MUSTERI" },
  });

  revalidatePath("/ai/firmalar");
  revalidatePath("/firmalar");
}

export async function analiziYenile(): Promise<void> {
  await gunlukAnaliziUret(false);
  revalidatePath("/ai/analiz");
}

export async function donusTalebiKapat(id: number): Promise<void> {
  await prisma.donusTalebi
    .update({ where: { id }, data: { aktif: false } })
    .catch(() => null);
  revalidatePath("/ai/donus");
}
