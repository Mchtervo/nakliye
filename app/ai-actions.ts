"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, ayarYaz } from "@/lib/ayarlar";
import { aracKodlariCozumle } from "@/lib/arac";
import { bolgeCozumle } from "@/lib/bolgeler";
import { ilBul } from "@/lib/iller";
import { VARSAYILAN_KORIDOR_ILLER } from "@/lib/koridor";
import { tlKurusaCevir } from "@/lib/para";
import { kaynaklariTara } from "@/lib/kaynaklar/tarama";
import { butceKesiminiAc } from "@/lib/ai/butce";
import { adayFirmalariBul } from "@/lib/ai/firmaBul";
import { gunlukAnaliziUret } from "@/lib/ai/gunlukAnaliz";
import { testIzniDurum, testIzniVer } from "@/lib/ai/testIzin";
import { aiTestOnMesajCalistir } from "@/lib/ai/testOnMesaj";
import type { KaynakTuru } from "@/lib/kaynaklar/tip";

export type AiSonuc = { hata: string } | { bilgi: string } | null;

/** Ayarlar: Telegram test bildirimi. */
export async function testBildirimGonder(): Promise<AiSonuc> {
  const { aiTercihleriOku } = await import("@/lib/ayarlar");
  const { telegramGonder, telegramKullanilabilir, htmlKacis } = await import(
    "@/lib/bildirim/telegram"
  );
  const { bildirimSessizMi } = await import("@/lib/bildirim/gonder");
  const { prisma } = await import("@/lib/prisma");

  if (!telegramKullanilabilir()) {
    return { hata: "TELEGRAM_BOT_TOKEN yok — VPS .env kontrol et." };
  }
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramChatId) {
    return {
      hata: "telegram_chat_id yok — bota özelden /baglan yaz.",
    };
  }
  if (!tercih.telegramAcik) {
    return { hata: "Telegram bildirimi kapalı — ayarlardan aç." };
  }

  const sessiz = bildirimSessizMi();
  const metin =
    `<b>Yük Avcısı — test bildirimi</b>\n` +
    `${htmlKacis(
      new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })
    )}\n` +
    `Sessiz saat: <b>${sessiz ? "EVET (23–07)" : "hayır"}</b>\n` +
    `Bu mesajı görüyorsan bildirim yolu açık.`;

  const cevap = await telegramGonder(tercih.telegramChatId, metin);
  await prisma.bildirim.create({
    data: {
      kanal: "TELEGRAM",
      hedef: tercih.telegramChatId,
      baslik: "Test bildirimi",
      metin: "panel test",
      durum: cevap.basarili ? "GONDERILDI" : "HATA",
      hata: cevap.hata,
    },
  });

  revalidatePath("/ayarlar");
  if (!cevap.basarili) {
    return { hata: cevap.hata || "Telegram gönderilemedi." };
  }
  return {
    bilgi: "Test bildirimi Telegram'a gitti — sohbetini kontrol et.",
  };
}

/** Ayarlar: Web Push test bildirimi. */
export async function testPushGonder(): Promise<AiSonuc> {
  const { aiTercihleriOku } = await import("@/lib/ayarlar");
  const { pushGonder, pushKullanilabilir } = await import("@/lib/bildirim/push");
  const { prisma } = await import("@/lib/prisma");

  if (!pushKullanilabilir()) {
    return {
      hata: "VAPID anahtarları yok — VPS .env (npm run push:kur).",
    };
  }

  const abone = await prisma.pushAbone.count();
  if (abone === 0) {
    return {
      hata: "Kayıtlı cihaz yok — önce «Bu cihazda bildirimi aç».",
    };
  }

  const tercih = await aiTercihleriOku();
  if (!tercih.pushAcik) {
    return {
      hata: "Telefon bildirimi kapalı — ayarlardan «Telefon bildirimi (push)» aç.",
    };
  }

  const cevap = await pushGonder({
    baslik: "Yük Avcısı — test push",
    metin: new Date().toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
    }),
    url: "/ai/yukler",
  });

  revalidatePath("/ayarlar");
  if (cevap.gonderilen === 0) {
    return { hata: cevap.hata || "Push gönderilemedi." };
  }
  return {
    bilgi: `Test push ${cevap.gonderilen} cihaza gitti — bildirime dokununca Yükler açılır.`,
  };
}

/** AI_KAPALI iken 1 adet 10'luk test hakkı (30 dk). tavanUsd varsayılan $0.05. */
export async function aiTestIzniVer(tavanUsd = 0.05): Promise<AiSonuc> {
  const { bitisMs, tavanUsd: tavan } = await testIzniVer(30, tavanUsd);
  const durum = await testIzniDurum();
  revalidatePath("/ayarlar");
  return {
    bilgi:
      `1 test izni verildi (tavan $${tavan.toFixed(2)}, kalan ${durum.dakikaKalan} dk, ` +
      `bitiş ${new Date(bitisMs).toLocaleTimeString("tr-TR")}). ` +
      `Şimdi «10 mesaj işle»ye bas. Tavan aşılınca test durur; izin bitince sıfırlanır.`,
  };
}

function metinOku(deger: FormDataEntryValue | null): string {
  return typeof deger === "string" ? deger.trim() : "";
}

const ILAN_DURUMLARI = [
  "YENI",
  "ILGILENIYOR",
  "ILETISIME_GECILDI",
  "PAZARLIKTA",
  "CEVAP_YOK",
  "ELENDI",
  "YUKE_DONDU",
  "ALINDI",
  "ARSIV",
];

export async function ilanDurumGuncelle(
  id: number,
  durum: string
): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  if (!ILAN_DURUMLARI.includes(durum)) return;

  await prisma.yukIlani.update({ where: { id }, data: { durum } }).catch(() => null);

  if (durum === "ALINDI") {
    try {
      const { donusTalebiIlanAlindi } = await import("@/lib/donus");
      const { yukIlanlariniBildir } = await import("@/lib/bildirim/gonder");
      const r = await donusTalebiIlanAlindi(id);
      if (r.eslesen.length > 0) await yukIlanlariniBildir(r.eslesen);
    } catch (e) {
      console.error("[ilanDurumGuncelle] ALINDI donus", e);
    }
  }

  revalidatePath("/ai/yukler");
  revalidatePath("/ai/donus");
}

/** WhatsApp mesajı üret (cache 24s). Sadece butona basınca AI. */
export async function ilanMesajHazirla(
  id: number
): Promise<
  | { ok: true; metin: string; cache: boolean; waUrl: string | null }
  | { ok: false; hata: string }
> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, hata: "Geçersiz ilan." };
  }
  try {
    const { ilanWhatsappMesaji } = await import("@/lib/ai/whatsappMesaj");
    const r = await ilanWhatsappMesaji(id);
    return { ok: true, ...r };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : "Mesaj üretilemedi.",
    };
  }
}

/** Panel / bildirim: Bilgi Sor — Telegram kuyruk veya WhatsApp link. Modal yok. */
export async function ilanBilgiSor(id: number): Promise<
  | { ok: true; kanal: "telegram"; mesaj: string }
  | { ok: true; kanal: "whatsapp"; mesaj: string; waUrl: string }
  | { ok: false; mesaj: string; kanal?: undefined; waUrl?: undefined }
> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, mesaj: "Geçersiz ilan." };
  }
  try {
    const ilan = await prisma.yukIlani.findUnique({
      where: { id },
      select: { gonderenUserId: true, telefon: true },
    });
    if (!ilan) return { ok: false, mesaj: "İlan yok." };

    if (ilan.gonderenUserId) {
      const { tdmBilgiSor } = await import("@/lib/kaynaklar/telegramDm");
      const r = await tdmBilgiSor(id);
      if (r.ok) {
        // Client toast'ı silmesin diye revalidatePath burada yok;
        // durum DB'de güncellenir, sayfa yenilenince görünür.
      }
      return r.ok
        ? { ok: true, kanal: "telegram", mesaj: r.mesaj || "✅ Gönderildi" }
        : { ok: false, mesaj: r.mesaj || "Gönderilemedi" };
    }

    if (ilan.telefon) {
      const { ilanIletisimMesaji } = await import("@/lib/ai/whatsappMesaj");
      const r = await ilanIletisimMesaji(id);
      if (!r.waUrl) {
        return {
          ok: false,
          mesaj: "Telegram kimliği yok; telefon WhatsApp için geçersiz.",
        };
      }
      await prisma.yukIlani
        .update({ where: { id }, data: { durum: "ILETISIME_GECILDI" } })
        .catch(() => null);
      return {
        ok: true,
        kanal: "whatsapp",
        mesaj: "Telegram kimliği yok, WhatsApp açılıyor",
        waUrl: r.waUrl,
      };
    }

    return { ok: false, mesaj: "İletişim bilgisi bulunamadı" };
  } catch (e) {
    console.error("[ilanBilgiSor]", e);
    return {
      ok: false,
      mesaj: e instanceof Error ? e.message : "Bilgi sorulamadı.",
    };
  }
}

/** @deprecated — ilanBilgiSor kullan */
export async function ilanTelegramDmGonder(
  id: number
): Promise<{ ok: boolean; mesaj: string }> {
  const r = await ilanBilgiSor(id);
  return { ok: r.ok, mesaj: r.mesaj };
}

/** WhatsApp açıldı / kopyalandı → ILETISIME_GECILDI */
export async function ilanIletisimeGecildi(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  await prisma.yukIlani
    .update({ where: { id }, data: { durum: "ILETISIME_GECILDI" } })
    .catch(() => null);
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
  // Silme yok — 48s arşiv cron'u (eskiIlanlariArsivle)
  const { eskiIlanlariArsivle } = await import("@/lib/ilanTazelik");
  await eskiIlanlariArsivle();
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
  /** Hepsi ya hiçbiri — hata varsa DB'ye hiç yazma. */
  const kaydedilmedi = (alan: string) =>
    `${alan} hatalı — hiçbir ayar kaydedilmedi.`;

  const sehirHam = metinOku(formData.get("sehir"));
  const sehir = sehirHam ? ilBul(sehirHam) : null;
  if (sehirHam && !sehir) {
    return { hata: kaydedilmedi("Şehir alanı") };
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
    return { hata: kaydedilmedi("Alt ücret sınırı") };
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
    return { hata: kaydedilmedi("Max tonaj (1–50 olmalı)") };
  }

  const anaUsHam = metinOku(formData.get("anaUs"));
  const anaUs = anaUsHam ? ilBul(anaUsHam) : null;
  if (anaUsHam && !anaUs) {
    return { hata: kaydedilmedi("Ana üs") };
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
    if (!il) {
      return { hata: kaydedilmedi(`Ek il («${p}»)`) };
    }
    ekIllerCozulmus.push(il);
  }

  const koridorHam = metinOku(formData.get("koridorIller"));
  const koridorParca = koridorHam
    .split(/[,\n;]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 40);
  const koridorCozulmus: string[] = [];
  if (koridorParca.length === 0) {
    koridorCozulmus.push(...VARSAYILAN_KORIDOR_ILLER);
  } else {
    for (const p of koridorParca) {
      const il = ilBul(p);
      if (!il) {
        return { hata: kaydedilmedi(`Koridor alanı («${p}»)`) };
      }
      if (!koridorCozulmus.includes(il)) koridorCozulmus.push(il);
    }
  }

  const tdmLimitHam = metinOku(formData.get("tdmGunlukLimit"));
  const tdmLimit = tdmLimitHam ? Number(tdmLimitHam.replace(/\D/g, "")) : 10;
  if (!Number.isFinite(tdmLimit) || tdmLimit < 1 || tdmLimit > 30) {
    return { hata: kaydedilmedi("Günlük DM limiti (1–30)") };
  }

  const minUyeHam = metinOku(formData.get("katilimMinUye"));
  const katilimMinUye = minUyeHam
    ? Number(minUyeHam.replace(/\D/g, ""))
    : 15;
  if (
    !Number.isFinite(katilimMinUye) ||
    katilimMinUye < 1 ||
    katilimMinUye > 5000
  ) {
    return { hata: kaydedilmedi("Min üye (1–5000)") };
  }

  const autoDeployAcik =
    formData.get("autoDeploy") === "1" ||
    formData.getAll("autoDeploy").includes("1");

  function maliyetSayi(
    alan: string,
    varsayilan: number,
    min: number,
    max: number
  ): number | { hata: string } {
    const ham = metinOku(formData.get(alan));
    if (!ham) return varsayilan;
    const n = Number(ham.replace(",", "."));
    if (!Number.isFinite(n) || n < min || n > max) {
      return { hata: kaydedilmedi(`${alan} (${min}–${max})`) };
    }
    return n;
  }

  const { VARSAYILAN_MALIYET } = await import("@/lib/karHesap");
  const yakitLt = maliyetSayi(
    "yakitLt100",
    VARSAYILAN_MALIYET.yakitLt100,
    5,
    80
  );
  if (typeof yakitLt === "object") return yakitLt;
  const motorin = maliyetSayi(
    "motorinTl",
    VARSAYILAN_MALIYET.motorinTl,
    10,
    200
  );
  if (typeof motorin === "object") return motorin;
  const sabitKm = maliyetSayi(
    "sabitTlKm",
    VARSAYILAN_MALIYET.sabitTlKm,
    0,
    50
  );
  if (typeof sabitKm === "object") return sabitKm;
  const hgsKm = maliyetSayi("hgsTlKm", VARSAYILAN_MALIYET.hgsTlKm, 0, 10);
  if (typeof hgsKm === "object") return hgsKm;
  const maliyetTonaj = maliyetSayi(
    "maliyetTonaj",
    VARSAYILAN_MALIYET.tonaj,
    1,
    50
  );
  if (typeof maliyetTonaj === "object") return maliyetTonaj;

  function gunSayi(alan: string, varsayilan: number): number | { hata: string } {
    const ham = metinOku(formData.get(alan));
    if (!ham) return varsayilan;
    const n = Number(ham.replace(/\D/g, ""));
    if (!Number.isFinite(n) || n < 1 || n > 30) {
      return { hata: kaydedilmedi(`${alan} (1–30 gün)`) };
    }
    return Math.round(n);
  }
  const budamaSessiz = gunSayi("budamaSessizGun", 4);
  if (typeof budamaSessiz === "object") return budamaSessiz;
  const budamaSifir = gunSayi("budamaSifirIlanGun", 5);
  if (typeof budamaSifir === "object") return budamaSifir;
  const budamaIsabet = gunSayi("budamaIsabetGun", 7);
  if (typeof budamaIsabet === "object") return budamaIsabet;
  const budamaKoruma = gunSayi("budamaKorumaGun", 4);
  if (typeof budamaKoruma === "object") return budamaKoruma;

  const sayacHam = metinOku(formData.get("sayacBaslangic"));
  let sayacBaslangic = sayacHam;
  if (sayacBaslangic && !/^\d{4}-\d{2}-\d{2}$/.test(sayacBaslangic)) {
    return { hata: kaydedilmedi("sayacBaslangic (YYYY-MM-DD)") };
  }
  if (!sayacBaslangic) {
    const { sayacBaslangicGaranti } = await import("@/lib/ayarlar");
    sayacBaslangic = await sayacBaslangicGaranti();
  }

  const { kesifKelimeleriCozumle } = await import("@/lib/bolgeler");
  const kesifHam = metinOku(formData.get("kesifKoridorKelimeler"));
  const kesifKelimeler = kesifKelimeleriCozumle(kesifHam);
  // Boş bırakılırsa varsayılan listeye dön (DB’de boş = varsayılan)
  const kesifKayit = kesifKelimeler.join("\n");

  // Max tonaj formu: boşsa istiap (maliyetTonaj) kullan
  const efektifMaxTonaj = maxTonaj || maliyetTonaj;

  // Tüm doğrulamalar geçti — tek transaction (hepsi ya hiçbiri)
  const kayitlar: { anahtar: string; deger: string }[] = [
    { anahtar: AYAR_ANAHTARLARI.aiSehir, deger: sehir || "" },
    { anahtar: AYAR_ANAHTARLARI.aiRotalar, deger: rotalar },
    { anahtar: AYAR_ANAHTARLARI.aiMinUcret, deger: String(minUcret ?? 0) },
    { anahtar: AYAR_ANAHTARLARI.aiBolgeler, deger: bolgeler },
    { anahtar: AYAR_ANAHTARLARI.aiAracTipleri, deger: aracTipleri },
    { anahtar: AYAR_ANAHTARLARI.aiMaxTonaj, deger: String(efektifMaxTonaj) },
    { anahtar: AYAR_ANAHTARLARI.aiAnaUs, deger: anaUs || "" },
    {
      anahtar: AYAR_ANAHTARLARI.aiEkIller,
      deger: [...new Set(ekIllerCozulmus)].join(","),
    },
    {
      anahtar: AYAR_ANAHTARLARI.aiKoridorIller,
      deger: koridorCozulmus.join(","),
    },
    {
      anahtar: AYAR_ANAHTARLARI.bildirimTelegram,
      deger: formData.get("bildirimTelegram") === "1" ? "1" : "0",
    },
    {
      anahtar: AYAR_ANAHTARLARI.bildirimPush,
      deger: formData.get("bildirimPush") === "1" ? "1" : "0",
    },
    {
      anahtar: AYAR_ANAHTARLARI.telegramUyeAktif,
      deger: formData.get("telegramUye") === "1" ? "1" : "0",
    },
    {
      anahtar: AYAR_ANAHTARLARI.autoDeploy,
      deger: autoDeployAcik ? "1" : "0",
    },
    { anahtar: AYAR_ANAHTARLARI.waSablonAd, deger: metinOku(formData.get("waAd")) },
    {
      anahtar: AYAR_ANAHTARLARI.waSablonFirma,
      deger: metinOku(formData.get("waFirma")),
    },
    {
      anahtar: AYAR_ANAHTARLARI.waSablonArac,
      deger: metinOku(formData.get("waArac")),
    },
    {
      anahtar: AYAR_ANAHTARLARI.waSablonTonaj,
      deger: metinOku(formData.get("waTonaj")),
    },
    {
      anahtar: AYAR_ANAHTARLARI.waSablonMusaitlik,
      deger: metinOku(formData.get("waMusaitlik")),
    },
    {
      anahtar: AYAR_ANAHTARLARI.waSablonTonTercih,
      deger: metinOku(formData.get("waTonTercih")),
    },
    {
      anahtar: AYAR_ANAHTARLARI.waSablonImza,
      deger: metinOku(formData.get("waImza")),
    },
    {
      anahtar: AYAR_ANAHTARLARI.tdmKaraListe,
      deger: metinOku(formData.get("tdmKaraListe")),
    },
    { anahtar: AYAR_ANAHTARLARI.tdmGunlukLimit, deger: String(tdmLimit) },
    {
      anahtar: AYAR_ANAHTARLARI.telegramKatilimMinUye,
      deger: String(katilimMinUye),
    },
    { anahtar: AYAR_ANAHTARLARI.tdmOtomatik, deger: "0" },
    {
      anahtar: AYAR_ANAHTARLARI.waMesajSablon,
      deger: metinOku(formData.get("waMesajSablon")),
    },
    {
      anahtar: AYAR_ANAHTARLARI.maliyetYakitLt100,
      deger: String(yakitLt),
    },
    {
      anahtar: AYAR_ANAHTARLARI.maliyetMotorinTl,
      deger: String(motorin),
    },
    {
      anahtar: AYAR_ANAHTARLARI.maliyetSabitTlKm,
      deger: String(sabitKm),
    },
    {
      anahtar: AYAR_ANAHTARLARI.maliyetHgsTlKm,
      deger: String(hgsKm),
    },
    {
      anahtar: AYAR_ANAHTARLARI.maliyetTonaj,
      deger: String(maliyetTonaj),
    },
    {
      anahtar: AYAR_ANAHTARLARI.budamaSessizGun,
      deger: String(budamaSessiz),
    },
    {
      anahtar: AYAR_ANAHTARLARI.budamaSifirIlanGun,
      deger: String(budamaSifir),
    },
    {
      anahtar: AYAR_ANAHTARLARI.budamaIsabetGun,
      deger: String(budamaIsabet),
    },
    {
      anahtar: AYAR_ANAHTARLARI.budamaKorumaGun,
      deger: String(budamaKoruma),
    },
    {
      anahtar: AYAR_ANAHTARLARI.sayacBaslangic,
      deger: sayacBaslangic,
    },
    {
      anahtar: AYAR_ANAHTARLARI.kesifKoridorKelimeler,
      deger: kesifKayit,
    },
  ];

  try {
    await prisma.$transaction(
      kayitlar.map((k) =>
        prisma.ayar.upsert({
          where: { anahtar: k.anahtar },
          create: { anahtar: k.anahtar, deger: k.deger },
          update: { deger: k.deger },
        })
      )
    );
  } catch (e) {
    console.error("[aiTercihKaydet] transaction", e);
    return {
      hata:
        "Kayıt sırasında hata oluştu — hiçbir ayar kaydedilmedi. Tekrar dene.",
    };
  }

  revalidatePath("/ayarlar");
  revalidatePath("/ai/yukler");
  return { bilgi: "Tüm tercihler kaydedildi." };
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

/** Eski server action — uzun sürerse sayfa düşer; panel artık API kullanır. */
export async function aiTestOnMesaj(): Promise<AiSonuc> {
  const sonuc = await aiTestOnMesajCalistir();
  revalidatePath("/ayarlar");
  revalidatePath("/ai/yukler");
  return sonuc;
}

/** Günlük bütçe kesmesini elle aç (limit yarın sıfırlanana kadar dikkat). */
export async function aiButceKesiminiAc(): Promise<AiSonuc> {
  await butceKesiminiAc();
  revalidatePath("/ayarlar");
  return { bilgi: "Bütçe kesmesi kaldırıldı. Günlük limit hâlâ geçerli." };
}
