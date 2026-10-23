/**
 * Numarası olan ilana sanal WhatsApp'tan tek soru.
 * Günde 12, gönderiler arası 8 dk, aynı numaraya 24 saatte bir.
 * Cevap önce regex; tutmazsa günde en fazla 15 ucuz AI okuması.
 */
import { prisma } from "@/lib/prisma";
import { butceKesildiMi } from "@/lib/ai/butce";
import { sadelestir } from "@/lib/iller";
import { bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";
import { cevapAiCozumle, cevapParseRegex, type CevapCozum } from "@/lib/kaynaklar/tdmCevap";
import { telefonWaMe } from "@/lib/whatsapp";

const GUNLUK = 12;
const ARA_MS = 8 * 60 * 1000;
const KISI_MS = 24 * 60 * 60 * 1000;
const CEVAP_MS = 3 * 60 * 60 * 1000;
const AI_GUNLUK = 15;
const SAYAC_ANAHTAR = "wa_gorusme_gunluk";
const SON_ANAHTAR = "wa_gorusme_son";
const AI_ANAHTAR = "wa_cevap_ai";

const YUK_TIPLERI: [RegExp, string][] = [
  [/\b(un|bugday|arpa|misir|hububat)\b/, "hububat"],
  [/\bmermer\b/, "mermer"],
  [/\b(demir|hurda|sac)\b/, "demir"],
  [/\bpalet\b/, "paletli"],
  [/\b(meyve|sebze|gida)\b/, "gıda"],
  [/\b(tekstil|kumas)\b/, "tekstil"],
  [/\bmobilya\b/, "mobilya"],
  [/\b(cimento|insaat|tugla)\b/, "inşaat"],
  [/\byem\b/, "yem"],
  [/\bparsiyel\b/, "parsiyel"],
];

export type Gonderilecek = { id: number; e164: string; metin: string };

type Cozum = CevapCozum & { yukTipi: string | null };

function tel05(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const son = tel.replace(/\D/g, "").slice(-10);
  if (!/^5\d{9}$/.test(son)) return null;
  return `0${son}`;
}

async function ayarYaz(anahtar: string, deger: string): Promise<void> {
  await prisma.ayar.upsert({
    where: { anahtar },
    create: { anahtar, deger },
    update: { deger },
  });
}

async function ayarOkuHam(anahtar: string): Promise<string | null> {
  const k = await prisma.ayar.findUnique({ where: { anahtar } });
  return k?.deger ?? null;
}

function gunlukOku(ham: string | null): { gun: string; adet: number } {
  const gun = bugunAnahtar();
  if (!ham) return { gun, adet: 0 };
  const [g, a] = ham.split(":");
  if (g !== gun) return { gun, adet: 0 };
  const adet = Number(a);
  return { gun, adet: Number.isFinite(adet) ? adet : 0 };
}

function yukTipiBul(metin: string): string | null {
  const sade = sadelestir(metin);
  for (const [kalip, ad] of YUK_TIPLERI) {
    if (kalip.test(sade)) return ad;
  }
  return null;
}

function soruMetni(ilan: {
  nereden: string | null;
  nereye: string | null;
  cikisIl: string | null;
  varisIl: string | null;
}): string {
  const rota = `${ilan.nereden || ilan.cikisIl || "?"} → ${ilan.nereye || ilan.varisIl || "?"}`;
  return (
    `Merhaba, ${rota} ilanınız için yazıyorum.\n` +
    "Yük ne, kaç ton, navlun kaç TL, nereden yüklenecek, nereye inecek?"
  );
}

/** Yeni veya yenilenen numaralı ilanı soru kuyruğuna alır. Aynı ilana / aynı güne ikinci yok. */
export async function gorusmeKuyrugaAl(ilanId: number): Promise<void> {
  const ilan = await prisma.yukIlani.findUnique({ where: { id: ilanId } });
  if (!ilan) return;
  if (ilan.durum === "ELENDI" || ilan.durum === "YUKE_DONDU" || ilan.durum === "ALINDI") {
    return;
  }
  const tel = tel05(ilan.telefon);
  if (!tel) return;

  const kendi = await prisma.whatsAppGorusme.findFirst({
    where: { ilanId },
    select: { id: true },
  });
  if (kendi) return;

  const sinir = new Date(Date.now() - KISI_MS);
  const ayniNumara = await prisma.whatsAppGorusme.findFirst({
    where: {
      telefon: tel,
      createdAt: { gte: sinir },
      durum: { not: "HATA" },
    },
    select: { id: true },
  });
  if (ayniNumara) return;

  await prisma.whatsAppGorusme.create({
    data: {
      ilanId,
      telefon: tel,
      gidenMetin: soruMetni(ilan),
      durum: "BEKLIYOR",
    },
  });
}

async function beklemeyiKapat(): Promise<void> {
  const sinir = new Date(Date.now() - CEVAP_MS);
  const eskiler = await prisma.whatsAppGorusme.findMany({
    where: { durum: "GONDERILDI", gonderildiAt: { lt: sinir } },
    select: { id: true, ilanId: true },
    take: 30,
  });
  if (eskiler.length === 0) return;
  await prisma.whatsAppGorusme.updateMany({
    where: { id: { in: eskiler.map((e) => e.id) } },
    data: { durum: "CEVAP_YOK" },
  });
  await prisma.yukIlani.updateMany({
    where: {
      id: { in: eskiler.map((e) => e.ilanId) },
      durum: { in: ["YENI", "ILETISIME_GECILDI"] },
    },
    data: { durum: "CEVAP_YOK" },
  });
}

/** Kota ve ara uygunsa sıradaki soruyu döndürür. Gönderimi daemon yapar. */
export async function siradakiGorusme(): Promise<Gonderilecek | null> {
  await beklemeyiKapat();
  const sayac = gunlukOku(await ayarOkuHam(SAYAC_ANAHTAR));
  if (sayac.adet >= GUNLUK) return null;
  const sonMs = Date.parse((await ayarOkuHam(SON_ANAHTAR)) || "");
  if (Number.isFinite(sonMs) && Date.now() - sonMs < ARA_MS) return null;

  const kayit = await prisma.whatsAppGorusme.findFirst({
    where: { durum: "BEKLIYOR" },
    orderBy: { id: "asc" },
  });
  if (!kayit) return null;
  const e164 = telefonWaMe(kayit.telefon);
  if (!e164) {
    await gorusmeHata(kayit.id, "Numara geçersiz");
    return null;
  }
  return { id: kayit.id, e164, metin: kayit.gidenMetin };
}

async function araBaslat(): Promise<void> {
  await ayarYaz(SON_ANAHTAR, new Date().toISOString());
}

export async function gorusmeGonderildi(id: number): Promise<void> {
  const kayit = await prisma.whatsAppGorusme.update({
    where: { id },
    data: { durum: "GONDERILDI", gonderildiAt: new Date(), hata: null },
  });
  await prisma.yukIlani.updateMany({
    where: { id: kayit.ilanId, durum: "YENI" },
    data: { durum: "ILETISIME_GECILDI" },
  });
  const sayac = gunlukOku(await ayarOkuHam(SAYAC_ANAHTAR));
  await ayarYaz(SAYAC_ANAHTAR, `${sayac.gun}:${sayac.adet + 1}`);
  await araBaslat();
}

export async function gorusmeHata(id: number, hata: string): Promise<void> {
  await prisma.whatsAppGorusme.update({
    where: { id },
    data: { durum: "HATA", hata: hata.slice(0, 180) },
  });
  await araBaslat();
}

async function aiHakkiVarMi(): Promise<boolean> {
  if (await butceKesildiMi()) return false;
  const sayac = gunlukOku(await ayarOkuHam(AI_ANAHTAR));
  if (sayac.adet >= AI_GUNLUK) return false;
  await ayarYaz(AI_ANAHTAR, `${sayac.gun}:${sayac.adet + 1}`);
  return true;
}

async function cevabiOku(
  metin: string,
  ilan: { cikisIl: string | null; varisIl: string | null; nereden: string | null; nereye: string | null }
): Promise<Cozum> {
  const yukTipi = yukTipiBul(metin);
  let cozum = cevapParseRegex(metin);
  const bos = !cozum.tonaj && !cozum.ucretKurush && !cozum.fiyatTonKurush;
  if (bos && metin.trim().length >= 8 && (await aiHakkiVarMi())) {
    const rota = `${ilan.nereden || ilan.cikisIl || "?"}→${ilan.nereye || ilan.varisIl || "?"}`;
    cozum = await cevapAiCozumle(metin, {
      rota,
      bugun: bugunAnahtar(),
    });
  }
  const ek = yukTipi ? `yük: ${yukTipi}` : null;
  const ozet = [cozum.ozet, ek].filter(Boolean).join(" · ").slice(0, 240);
  return { ...cozum, yukTipi, ozet };
}

async function ilanaYaz(ilanId: number, cozum: Cozum): Promise<void> {
  const ilan = await prisma.yukIlani.findUnique({ where: { id: ilanId } });
  if (!ilan) return;
  const data: {
    tonaj?: number;
    ucret?: number;
    fiyatTon?: number;
    yuklemeTarihi?: Date;
    yukTipi?: string;
    durum?: string;
  } = {};
  if (ilan.tonaj == null && cozum.tonaj) data.tonaj = cozum.tonaj;
  if (ilan.ucret == null && cozum.ucretKurush) data.ucret = cozum.ucretKurush;
  if (ilan.fiyatTon == null && cozum.fiyatTonKurush) data.fiyatTon = cozum.fiyatTonKurush;
  if (!ilan.yuklemeTarihi && cozum.yuklemeTarihi) data.yuklemeTarihi = cozum.yuklemeTarihi;
  if (!ilan.yukTipi && cozum.yukTipi) data.yukTipi = cozum.yukTipi;
  if (ilan.durum === "YENI" || ilan.durum === "CEVAP_YOK") data.durum = "ILETISIME_GECILDI";
  if (Object.keys(data).length === 0) return;
  await prisma.yukIlani.update({ where: { id: ilanId }, data });
}

/** Gelen özel mesaj, son 24 saatte yazılan numarayla eşleşirse ilana işlenir. */
export async function gelenOzelMesajiIsle(jid: string, metin: string): Promise<void> {
  const numara = jid.split("@")[0]?.split(":")[0] ?? "";
  const tel = tel05(numara);
  const yazi = metin.trim();
  if (!tel || yazi.length < 2) return;

  const sinir = new Date(Date.now() - KISI_MS);
  const gorusme = await prisma.whatsAppGorusme.findFirst({
    where: {
      telefon: tel,
      createdAt: { gte: sinir },
      durum: { in: ["GONDERILDI", "KONUSULDU", "CEVAP_YOK"] },
    },
    orderBy: { id: "desc" },
    include: {
      ilan: {
        select: { cikisIl: true, varisIl: true, nereden: true, nereye: true },
      },
    },
  });
  if (!gorusme) return;

  const birlesik = [gorusme.cevapMetin, yazi].filter(Boolean).join("\n").slice(0, 2000);
  const cozum = await cevabiOku(birlesik, gorusme.ilan);
  await ilanaYaz(gorusme.ilanId, cozum);

  const diger = await prisma.yukIlani.findMany({
    where: {
      telefon: tel,
      id: { not: gorusme.ilanId },
      sonGorulme: { gte: sinir },
      durum: { notIn: ["YUKE_DONDU", "ALINDI", "ELENDI"] },
    },
    select: { id: true },
    take: 8,
  });
  for (const d of diger) await ilanaYaz(d.id, cozum);

  await prisma.whatsAppGorusme.update({
    where: { id: gorusme.id },
    data: {
      durum: "KONUSULDU",
      cevapMetin: birlesik,
      cevapAt: new Date(),
      ozet: cozum.ozet,
    },
  });
}

export function gorusmeSatiri(g: {
  durum: string;
  ozet: string | null;
  cevapMetin: string | null;
  hata: string | null;
}): string {
  if (g.durum === "BEKLIYOR") return "Sırada — WhatsApp'tan sorulacak";
  if (g.durum === "GONDERILDI") return "WhatsApp'tan yazıldı, cevap bekleniyor";
  if (g.durum === "CEVAP_YOK") return "WhatsApp'tan yazıldı, cevap vermedi";
  if (g.durum === "HATA") return `WhatsApp yazılamadı: ${g.hata || "hata"}`;
  const ozet = (g.ozet || g.cevapMetin || "").trim();
  return ozet ? `Konuşuldu: ${ozet}` : "Konuşuldu, ek bilgi gelmedi";
}
