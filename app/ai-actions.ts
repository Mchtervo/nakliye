"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, ayarYaz } from "@/lib/ayarlar";
import { aracKodlariCozumle } from "@/lib/arac";
import { bolgeCozumle } from "@/lib/bolgeler";
import { ilBul } from "@/lib/iller";
import { tlKurusaCevir } from "@/lib/para";
import { kaynaklariTara } from "@/lib/kaynaklar/tarama";
import { butceKesiminiAc } from "@/lib/ai/butce";
import { adayFirmalariBul } from "@/lib/ai/firmaBul";
import { gunlukAnaliziUret } from "@/lib/ai/gunlukAnaliz";
import { aiTestBypassIle } from "@/lib/ai/istemci";
import { mikrodolarYaz } from "@/lib/ai/maliyet";
import { kuyrugunuCoz } from "@/lib/kaynaklar/telegramUye";
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

/** ADAY grubu elle takibe al (üyelik senkronu kaçırdıysa). */
export async function kaynakTakibeAl(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  await prisma.ilanKaynagi
    .update({
      where: { id },
      data: { aktif: true, durum: "AKTIF", sonHata: null },
    })
    .catch(() => null);
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

  const aracTipleri = aracKodlariCozumle(
    formData.getAll("aracTipleri").map(String).join(",")
  ).join(",");

  const tonajHam = metinOku(formData.get("maxTonaj"));
  const maxTonaj = tonajHam ? Number(tonajHam.replace(/\D/g, "")) : 0;
  if (tonajHam && (!Number.isFinite(maxTonaj) || maxTonaj <= 0 || maxTonaj > 50)) {
    return { hata: "Max tonaj 1-50 arası olmalı." };
  }

  const anaUsHam = metinOku(formData.get("anaUs"));
  const anaUs = anaUsHam ? ilBul(anaUsHam) : null;
  if (anaUsHam && !anaUs) {
    return { hata: "Ana üs şehrini tanıyamadım. Örnek: Ankara" };
  }

  await ayarYaz(AYAR_ANAHTARLARI.aiSehir, sehir || "");
  await ayarYaz(AYAR_ANAHTARLARI.aiRotalar, rotalar);
  await ayarYaz(AYAR_ANAHTARLARI.aiMinUcret, String(minUcret ?? 0));
  await ayarYaz(AYAR_ANAHTARLARI.aiBolgeler, bolgeler);
  await ayarYaz(AYAR_ANAHTARLARI.aiAracTipleri, aracTipleri);
  await ayarYaz(AYAR_ANAHTARLARI.aiMaxTonaj, String(maxTonaj || 0));
  await ayarYaz(AYAR_ANAHTARLARI.aiAnaUs, anaUs || "");
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

/**
 * Test modu: tam 10 mesaj işle ve dur.
 * AI_KAPALI=true iken bile çalışır (cron'lar kapalı kalır).
 * Yeni key ile önce bunu çalıştırıp maliyeti ölç.
 */
export async function aiTestOnMesaj(): Promise<AiSonuc> {
  if (!process.env.OPENAI_API_KEY) {
    return { hata: "OPENAI_API_KEY yok — önce Netlify'a yeni key ekle." };
  }

  const baslangic = new Date();
  try {
    const rapor = await aiTestBypassIle(() =>
      kuyrugunuCoz(10, { testModu: true })
    );

    const cagrilar = await prisma.aiCagri.findMany({
      where: { zaman: { gte: baslangic } },
      orderBy: { zaman: "asc" },
      select: {
        kaynak: true,
        model: true,
        maliyetMikro: true,
        girdiToken: true,
        ciktiToken: true,
        reasoningToken: true,
        basarili: true,
      },
    });
    const maliyet = cagrilar.reduce((t, c) => t + c.maliyetMikro, 0);
    const girdi = cagrilar.reduce((t, c) => t + c.girdiToken, 0);
    const cikti = cagrilar.reduce((t, c) => t + c.ciktiToken, 0);
    const reasoning = cagrilar.reduce((t, c) => t + c.reasoningToken, 0);
    const yuksekCikti = cagrilar.filter((c) => c.ciktiToken >= 500).length;

    const satirlar = cagrilar
      .map(
        (c, i) =>
          `${i + 1}) ${c.kaynak} · ${c.model} · in ${c.girdiToken} / out ${c.ciktiToken}` +
          (c.reasoningToken > 0 ? ` / reason ${c.reasoningToken}` : "") +
          ` · ${mikrodolarYaz(c.maliyetMikro)}` +
          (c.basarili ? "" : " · HATA")
      )
      .join("\n");

    revalidatePath("/ayarlar");
    revalidatePath("/ai/yukler");

    const ozet =
      `İşlenen: ${rapor.islenen}, yeni ilan: ${rapor.yeniIlan}, çağrı: ${cagrilar.length}\n` +
      `Toplam in ${girdi} / out ${cikti} / reason ${reasoning} · ${mikrodolarYaz(maliyet)}\n` +
      (yuksekCikti > 0
        ? `⚠ ${yuksekCikti} çağrıda çıktı ≥500 token (hedef: altı).\n`
        : `✓ Tüm çağrılarda çıktı <500 token.\n`) +
      (satirlar ? `Çağrılar:\n${satirlar}\n` : "Çağrı yok.\n") +
      "Cron hâlâ AI_KAPALI ile kapalı.";

    if (rapor.hata) {
      return { hata: `${rapor.hata}\n${ozet}` };
    }

    return { bilgi: `Test bitti (10'luk tur).\n${ozet}` };
  } catch (hata) {
    return {
      hata: hata instanceof Error ? hata.message : "Test modu başarısız.",
    };
  }
}

/** Günlük bütçe kesmesini elle aç (limit yarın sıfırlanana kadar dikkat). */
export async function aiButceKesiminiAc(): Promise<AiSonuc> {
  await butceKesiminiAc();
  revalidatePath("/ayarlar");
  return { bilgi: "Bütçe kesmesi kaldırıldı. Günlük limit hâlâ geçerli." };
}
