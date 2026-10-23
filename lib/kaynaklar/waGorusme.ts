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
const HATIRLAT_MS = 60 * 60 * 1000;
/** Hatırlatmadan sonra 1 saat daha sessizse cevap yok. */
const CEVAP_MS = 60 * 60 * 1000;
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

export type Gonderilecek = {
  id: number;
  e164: string;
  metin: string;
  hatirlatma: boolean;
};

type SoruIlan = {
  nereden: string | null;
  nereye: string | null;
  cikisIl: string | null;
  varisIl: string | null;
  tonaj: number | null;
  ucret: number | null;
  fiyatTon: number | null;
  yukTipi: string | null;
  koridorTipi?: string | null;
  createdAt?: Date;
};

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

function ayniYer(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.toLocaleLowerCase("tr-TR") === b.toLocaleLowerCase("tr-TR");
}

function eksikler(ilan: SoruIlan): string[] {
  const soru: string[] = [];
  if (!ilan.yukTipi) soru.push("yük ne");
  if (!ilan.tonaj) soru.push("kaç ton");
  if (ilan.ucret == null && ilan.fiyatTon == null) soru.push("navlun kaç TL");
  if (!ilan.nereden || ayniYer(ilan.nereden, ilan.cikisIl)) soru.push("nereden yüklenecek");
  if (!ilan.nereye || ayniYer(ilan.nereye, ilan.varisIl)) soru.push("nereye boşalacak");
  return soru;
}

function rotaYazi(ilan: SoruIlan): string {
  return `${ilan.nereden || ilan.cikisIl || "?"} → ${ilan.nereye || ilan.varisIl || "?"}`;
}

function soruMetni(ilanlar: SoruIlan[]): string {
  const dolu = ilanlar.filter((i) => eksikler(i).length > 0).slice(0, 4);
  if (dolu.length === 0) return "";
  if (dolu.length === 1) {
    return `Merhaba, ${rotaYazi(dolu[0])} ilanınız için.\n${eksikler(dolu[0]).join(", ")}?`;
  }
  const satir = dolu.map((i) => `${rotaYazi(i)}: ${eksikler(i).join(", ")}`);
  return `Merhaba, ilanlarınız için kısa bilgi alabilir miyim?\n${satir.join("\n")}`;
}

function hatirlatmaMetni(ilan: SoruIlan): string {
  const eksik = eksikler(ilan);
  const soru = eksik.length > 0 ? eksik.join(", ") : "hâlâ güncel mi";
  return `Tekrar rahatsız etmeyeyim. ${rotaYazi(ilan)} için kısaca: ${soru}?`;
}

function oncelik(ilan: SoruIlan): number {
  let p = 0;
  if (ilan.ucret == null && ilan.fiyatTon == null) p += 50;
  if (!ilan.tonaj) p += 20;
  if (!ilan.yukTipi) p += 10;
  if (ilan.koridorTipi === "TAM" || ilan.koridorTipi === "VARIS") p += 30;
  if (ilan.createdAt) {
    const saat = (Date.now() - ilan.createdAt.getTime()) / 3_600_000;
    p += Math.max(0, 24 - saat);
  }
  return p;
}

function yeriYaz(mevcut: string | null, il: string | null, gelen: string | null): string | null {
  if (!gelen) return null;
  const temiz = gelen.trim();
  if (temiz.length < 3) return null;
  if (mevcut && !ayniYer(mevcut, il) && mevcut.length > (il || "").length + 2) return null;
  if (il && !temiz.toLocaleLowerCase("tr-TR").includes(il.toLocaleLowerCase("tr-TR"))) {
    return `${il} ${temiz}`.slice(0, 80);
  }
  return temiz.slice(0, 80);
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
  if (eksikler(ilan).length === 0) return;

  const kendi = await prisma.whatsAppGorusme.findFirst({
    where: { ilanId },
    select: { id: true },
  });
  if (kendi) return;

  const sinir = new Date(Date.now() - KISI_MS);
  const acik = await prisma.whatsAppGorusme.findFirst({
    where: {
      telefon: tel,
      createdAt: { gte: sinir },
      durum: { not: "HATA" },
    },
    orderBy: { id: "desc" },
  });
  if (acik && acik.durum !== "BEKLIYOR") return;

  const diger = await prisma.yukIlani.findMany({
    where: {
      telefon: tel,
      sonGorulme: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      durum: { notIn: ["ELENDI", "YUKE_DONDU", "ALINDI"] },
    },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
  const metin = soruMetni(diger.length > 0 ? diger : [ilan]);
  if (!metin) return;

  if (acik?.durum === "BEKLIYOR") {
    await prisma.whatsAppGorusme.update({
      where: { id: acik.id },
      data: { gidenMetin: metin },
    });
    return;
  }

  await prisma.whatsAppGorusme.create({
    data: {
      ilanId,
      telefon: tel,
      gidenMetin: metin,
      durum: "BEKLIYOR",
    },
  });
}

async function beklemeyiKapat(): Promise<void> {
  const sinir = new Date(Date.now() - CEVAP_MS);
  const eskiler = await prisma.whatsAppGorusme.findMany({
    where: { durum: "GONDERILDI", hatirlatma: { gte: 1 }, gonderildiAt: { lt: sinir } },
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

  const hatirlat = await prisma.whatsAppGorusme.findFirst({
    where: {
      durum: "GONDERILDI",
      hatirlatma: 0,
      gonderildiAt: { lt: new Date(Date.now() - HATIRLAT_MS) },
    },
    orderBy: { gonderildiAt: "asc" },
    include: { ilan: true },
  });
  if (hatirlat) {
    const e164 = telefonWaMe(hatirlat.telefon);
    if (!e164) {
      await gorusmeHata(hatirlat.id, "Numara geçersiz");
    } else {
      return {
        id: hatirlat.id,
        e164,
        metin: hatirlatmaMetni(hatirlat.ilan),
        hatirlatma: true,
      };
    }
  }

  const bekleyen = await prisma.whatsAppGorusme.findMany({
    where: { durum: "BEKLIYOR" },
    include: { ilan: true },
    orderBy: { id: "desc" },
    take: 40,
  });
  const kayit = bekleyen.sort((a, b) => oncelik(b.ilan) - oncelik(a.ilan))[0];
  if (!kayit) return null;
  const e164 = telefonWaMe(kayit.telefon);
  if (!e164) {
    await gorusmeHata(kayit.id, "Numara geçersiz");
    return null;
  }
  return { id: kayit.id, e164, metin: kayit.gidenMetin, hatirlatma: false };
}

async function araBaslat(): Promise<void> {
  await ayarYaz(SON_ANAHTAR, new Date().toISOString());
}

export async function gorusmeGonderildi(id: number, hatirlatma = false): Promise<void> {
  const kayit = await prisma.whatsAppGorusme.update({
    where: { id },
    data: hatirlatma
      ? { hatirlatma: 1, gonderildiAt: new Date(), hata: null }
      : { durum: "GONDERILDI", gonderildiAt: new Date(), hatirlatma: 0, hata: null },
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
  const ek = [
    yukTipi ? `yük: ${yukTipi}` : null,
    cozum.yuklemeYeri ? `yükleme: ${cozum.yuklemeYeri}` : null,
    cozum.bosaltmaYeri ? `boşaltma: ${cozum.bosaltmaYeri}` : null,
  ].filter(Boolean);
  const ozet = [cozum.ozet, ...ek].filter(Boolean).join(" · ").slice(0, 240);
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
    nereden?: string;
    nereye?: string;
    durum?: string;
  } = {};
  if (ilan.tonaj == null && cozum.tonaj) data.tonaj = cozum.tonaj;
  if (ilan.ucret == null && cozum.ucretKurush) data.ucret = cozum.ucretKurush;
  if (ilan.fiyatTon == null && cozum.fiyatTonKurush) data.fiyatTon = cozum.fiyatTonKurush;
  if (!ilan.yuklemeTarihi && cozum.yuklemeTarihi) data.yuklemeTarihi = cozum.yuklemeTarihi;
  if (!ilan.yukTipi && cozum.yukTipi) data.yukTipi = cozum.yukTipi;
  const yukleme = yeriYaz(ilan.nereden, ilan.cikisIl, cozum.yuklemeYeri);
  const bosaltma = yeriYaz(ilan.nereye, ilan.varisIl, cozum.bosaltmaYeri);
  if (yukleme) data.nereden = yukleme;
  if (bosaltma) data.nereye = bosaltma;
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
  hatirlatma?: number;
}): string {
  if (g.durum === "BEKLIYOR") return "Sırada — WhatsApp'tan sorulacak";
  if (g.durum === "GONDERILDI" && (g.hatirlatma ?? 0) > 0) {
    return "Bir kez daha yazıldı, cevap bekleniyor";
  }
  if (g.durum === "GONDERILDI") return "WhatsApp'tan yazıldı, cevap bekleniyor";
  if (g.durum === "CEVAP_YOK") return "WhatsApp'tan yazıldı, cevap vermedi";
  if (g.durum === "HATA") return `WhatsApp yazılamadı: ${g.hata || "hata"}`;
  const ozet = (g.ozet || g.cevapMetin || "").trim();
  return ozet ? `Konuşuldu: ${ozet}` : "Konuşuldu, ek bilgi gelmedi";
}
