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
import { AI_MAX_DENEME } from "@/lib/ai/modeller";
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

/** ADAY / PASIF grubu elle takibe al. */
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

  const ekIllerHam = metinOku(formData.get("ekIller"));
  const ekIllerParca = ekIllerHam
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 40);
  const ekIllerCozulmus: string[] = [];
  for (const p of ekIllerParca) {
    const il = ilBul(p);
    if (!il) return { hata: `Ek ili tanıyamadım: ${p}` };
    ekIllerCozulmus.push(il);
  }

  await ayarYaz(AYAR_ANAHTARLARI.aiSehir, sehir || "");
  await ayarYaz(AYAR_ANAHTARLARI.aiRotalar, rotalar);
  await ayarYaz(AYAR_ANAHTARLARI.aiMinUcret, String(minUcret ?? 0));
  await ayarYaz(AYAR_ANAHTARLARI.aiBolgeler, bolgeler);
  await ayarYaz(AYAR_ANAHTARLARI.aiAracTipleri, aracTipleri);
  await ayarYaz(AYAR_ANAHTARLARI.aiMaxTonaj, String(maxTonaj || 0));
  await ayarYaz(AYAR_ANAHTARLARI.aiAnaUs, anaUs || "");
  await ayarYaz(
    AYAR_ANAHTARLARI.aiEkIller,
    [...new Set(ekIllerCozulmus)].join(",")
  );
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
 * Son 7 günlük ham mesajları yeniden kuyruğa alır (bölge/araç ayarı değişince).
 * AI_KAPALI ise kuyrukta bekler; OpenAI çağrısı yapmaz.
 */
export async function eskiHamMesajlariYenidenIsle(): Promise<AiSonuc> {
  const sinir = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sonuc = await prisma.hamMesaj.updateMany({
    where: {
      createdAt: { gte: sinir },
      OR: [{ islendi: true }, { denemeSayisi: { gt: 0 } }],
    },
    data: { islendi: false, denemeSayisi: 0, hata: null },
  });

  const bekleyen = await prisma.hamMesaj.count({ where: { islendi: false } });
  revalidatePath("/ayarlar");
  revalidatePath("/ai/yukler");

  if (sonuc.count === 0) {
    return {
      bilgi: `Yeniden işlenecek ham mesaj yok (son 7 gün). Kuyrukta bekleyen: ${bekleyen}.`,
    };
  }

  return {
    bilgi: `${sonuc.count} ham mesaj yeniden kuyruğa alındı (toplam bekleyen ${bekleyen}). AI açıksa sırayla işlenir; kapalıysa önce test modu veya AI_KAPALI=false.`,
  };
}

const TEST_IDLER_ANAHTAR = "ai_test_son_idler";
const TEST_OZET_ANAHTAR = "ai_test_son_ozet";

type TestOzetKayit = {
  cagri: number;
  girdi: number;
  cikti: number;
  reasoning: number;
  maliyetMikro: number;
  kesilen: number;
  yuksekCikti: number;
  modelOrnek: string | null;
};

async function testAyarOku(anahtar: string): Promise<string | null> {
  const k = await prisma.ayar.findUnique({ where: { anahtar } });
  return k?.deger ?? null;
}

async function testAyarYaz(anahtar: string, deger: string): Promise<void> {
  await prisma.ayar.upsert({
    where: { anahtar },
    create: { anahtar, deger },
    update: { deger },
  });
}

/**
 * Test modu: tam 10 mesaj işle ve dur.
 * AI_KAPALI=true iken bile çalışır (cron'lar kapalı kalır).
 * Aynı 10 mesajı tekrar işler (karşılaştırma için).
 */
export async function aiTestOnMesaj(): Promise<AiSonuc> {
  if (!process.env.OPENAI_API_KEY) {
    return { hata: "OPENAI_API_KEY yok — VPS .env'ye key ekle." };
  }

  const oncekiOzetHam = await testAyarOku(TEST_OZET_ANAHTAR);
  let oncekiOzet: TestOzetKayit | null = null;
  if (oncekiOzetHam) {
    try {
      oncekiOzet = JSON.parse(oncekiOzetHam) as TestOzetKayit;
    } catch {
      oncekiOzet = null;
    }
  }
  // Kayıt yoksa paneldeki son ilanCozumle kümesini "önce" kabul et.
  if (!oncekiOzet) {
    const son = await prisma.aiCagri.findMany({
      where: { kaynak: { contains: "ilanCozumle" } },
      orderBy: { zaman: "desc" },
      take: 20,
      select: {
        zaman: true,
        girdiToken: true,
        ciktiToken: true,
        reasoningToken: true,
        maliyetMikro: true,
        hata: true,
        model: true,
      },
    });
    if (son.length > 0) {
      const t0 = son[0].zaman.getTime();
      const kume = son.filter((c) => t0 - c.zaman.getTime() < 180_000);
      oncekiOzet = {
        cagri: kume.length,
        girdi: kume.reduce((t, c) => t + c.girdiToken, 0),
        cikti: kume.reduce((t, c) => t + c.ciktiToken, 0),
        reasoning: kume.reduce((t, c) => t + c.reasoningToken, 0),
        maliyetMikro: kume.reduce((t, c) => t + c.maliyetMikro, 0),
        kesilen: kume.filter((c) => (c.hata || "").startsWith("KESILDI"))
          .length,
        yuksekCikti: kume.filter((c) => c.ciktiToken >= 500).length,
        modelOrnek: kume[0]?.model ?? null,
      };
    }
  }

  // Tam 10 mesaj: kayıtlı ≥10 ise onu kullan; eksikse bekleyen + eski ile doldur.
  // (Önceki turda 5 id kaydı kalmıştı → hep 5/10 işleniyordu.)
  let hedefIdler: number[] = [];
  const kayitli = await testAyarOku(TEST_IDLER_ANAHTAR);
  if (kayitli) {
    try {
      hedefIdler = (JSON.parse(kayitli) as number[])
        .filter((n) => Number.isFinite(n) && n > 0)
        .slice(0, 10);
    } catch {
      hedefIdler = [];
    }
  }
  if (hedefIdler.length < 10) {
    const eksik = 10 - hedefIdler.length;
    const bekleyen = await prisma.hamMesaj.findMany({
      where: {
        islendi: false,
        denemeSayisi: { lt: AI_MAX_DENEME },
        ...(hedefIdler.length
          ? { id: { notIn: hedefIdler } }
          : {}),
      },
      orderBy: { createdAt: "asc" },
      take: eksik,
      select: { id: true },
    });
    hedefIdler.push(...bekleyen.map((m) => m.id));
  }
  if (hedefIdler.length < 10) {
    const eksik = 10 - hedefIdler.length;
    const eski = await prisma.hamMesaj.findMany({
      where: {
        id: { notIn: hedefIdler.length ? hedefIdler : [-1] },
      },
      orderBy: { createdAt: "asc" },
      take: eksik,
      select: { id: true },
    });
    hedefIdler.push(...eski.map((m) => m.id));
  }
  hedefIdler = [...new Set(hedefIdler)].slice(0, 10);

  if (hedefIdler.length > 0) {
    await prisma.hamMesaj.updateMany({
      where: { id: { in: hedefIdler } },
      data: { islendi: false, denemeSayisi: 0, hata: null },
    });
  }

  const baslangic = new Date();
  try {
    const rapor = await aiTestBypassIle(() =>
      kuyrugunuCoz(10, {
        testModu: true,
        mesajIdler: hedefIdler.length > 0 ? hedefIdler : undefined,
      })
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
        hata: true,
      },
    });
    const maliyet = cagrilar.reduce((t, c) => t + c.maliyetMikro, 0);
    const girdi = cagrilar.reduce((t, c) => t + c.girdiToken, 0);
    const cikti = cagrilar.reduce((t, c) => t + c.ciktiToken, 0);
    const reasoning = cagrilar.reduce((t, c) => t + c.reasoningToken, 0);
    const yuksekCikti = cagrilar.filter((c) => c.ciktiToken >= 500).length;
    const kesilen = cagrilar.filter((c) =>
      (c.hata || "").startsWith("KESILDI")
    ).length;
    const ortCikti =
      cagrilar.length > 0 ? Math.round(cikti / cagrilar.length) : 0;
    const ortMaliyet =
      cagrilar.length > 0 ? Math.round(maliyet / cagrilar.length) : 0;

    const yeniOzet: TestOzetKayit = {
      cagri: cagrilar.length,
      girdi,
      cikti,
      reasoning,
      maliyetMikro: maliyet,
      kesilen,
      yuksekCikti,
      modelOrnek: cagrilar[0]?.model ?? null,
    };

    // Her zaman hedef 10'u sakla (kısmi parti kaydı bir sonraki turu küçültmesin).
    const idler = hedefIdler.length >= 10 ? hedefIdler : rapor.mesajIdler || hedefIdler;
    if (idler.length > 0) {
      await testAyarYaz(TEST_IDLER_ANAHTAR, JSON.stringify(idler.slice(0, 10)));
    }
    await testAyarYaz(TEST_OZET_ANAHTAR, JSON.stringify(yeniOzet));

    const satirlar = cagrilar
      .map(
        (c, i) =>
          `${i + 1}) ${c.kaynak} · ${c.model} · in ${c.girdiToken} / out ${c.ciktiToken}` +
          (c.reasoningToken > 0 ? ` / reason ${c.reasoningToken}` : "") +
          ` · ${mikrodolarYaz(c.maliyetMikro)}` +
          (c.basarili ? "" : c.hata ? ` · ${c.hata}` : " · HATA")
      )
      .join("\n");

    let karsilastirma = "";
    if (oncekiOzet && oncekiOzet.maliyetMikro > 0) {
      const dMaliyet = yeniOzet.maliyetMikro - oncekiOzet.maliyetMikro;
      const dCikti = yeniOzet.cikti - oncekiOzet.cikti;
      const dReason = yeniOzet.reasoning - oncekiOzet.reasoning;
      karsilastirma =
        `\n── ÖNCE / SONRA ──\n` +
        `Önce: ${oncekiOzet.cagri} çağrı · in ${oncekiOzet.girdi} / out ${oncekiOzet.cikti} / r ${oncekiOzet.reasoning} · ${mikrodolarYaz(oncekiOzet.maliyetMikro)} · kesilme ${oncekiOzet.kesilen}\n` +
        `Sonra: ${yeniOzet.cagri} çağrı · in ${yeniOzet.girdi} / out ${yeniOzet.cikti} / r ${yeniOzet.reasoning} · ${mikrodolarYaz(yeniOzet.maliyetMikro)} · kesilme ${yeniOzet.kesilen}\n` +
        `Fark: maliyet ${mikrodolarYaz(dMaliyet)} · out ${dCikti >= 0 ? "+" : ""}${dCikti} · reason ${dReason >= 0 ? "+" : ""}${dReason}\n`;
    }

    const { testKaliteRaporu } = await import("@/lib/ai/testKalite");
    const kalite = await testKaliteRaporu(idler);

    revalidatePath("/ayarlar");
    revalidatePath("/ai/yukler");

    const ozet =
      `Hedef mesaj: ${hedefIdler.length}, işlenen: ${rapor.islenen}, yeni ilan: ${rapor.yeniIlan}, çağrı: ${cagrilar.length}\n` +
      `Toplam in ${girdi} / out ${cikti} / reason ${reasoning} · ${mikrodolarYaz(maliyet)}\n` +
      `Çağrı ort. out ${ortCikti} · ort. ${mikrodolarYaz(ortMaliyet)} · kesilme ${kesilen}\n` +
      (yuksekCikti > 0
        ? `⚠ ${yuksekCikti} çağrıda çıktı ≥500 token (hedef: altı).\n`
        : `✓ Tüm çağrılarda çıktı <500 token.\n`) +
      (ortMaliyet > 2000
        ? `⚠ Çağrı ort. ≥ $0.002 (hedef: altı).\n`
        : `✓ Çağrı ort. < $0.002.\n`) +
      (rapor.islenen < 10
        ? `⚠ Tam 10 işlenmedi (${rapor.islenen}/10) — log/deneme kontrol et.\n`
        : `✓ Tam 10 mesaj işlendi.\n`) +
      (satirlar ? `Çağrılar:\n${satirlar}\n` : "Çağrı yok.\n") +
      karsilastirma +
      `\n${kalite}\n` +
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
