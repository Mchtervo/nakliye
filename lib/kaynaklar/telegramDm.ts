/**
 * Telegram DM — sadece kullanıcı [Bilgi Sor] basınca kuyruk.
 * Limit: varsayılan 10/gün, ≥2 dk ara, aynı kişi 24s 1,
 * FloodWait→24s dur + bildir, kara liste. Otomatik yok.
 */
import { prisma } from "@/lib/prisma";
import {
  AYAR_ANAHTARLARI,
  aiTercihleriOku,
  ayarOku,
} from "@/lib/ayarlar";
import { bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";
import { ilanIletisimMesaji } from "@/lib/ai/whatsappMesaj";
import { whatsappMesajUrl } from "@/lib/whatsapp";
import {
  htmlKacis,
  telegramGonder,
  type InlineButon,
} from "@/lib/bildirim/telegram";
import { tlYazKisa } from "@/lib/para";
import {
  cevapAiCozumle,
  cevapParseRegex,
} from "@/lib/kaynaklar/tdmCevap";

export const TDM_GUNLUK_LIMIT_VARSAYILAN = 10;
export const TDM_ARA_MS = 2 * 60 * 1000;
export const TDM_KISI_MS = 24 * 60 * 60 * 1000;

export const TDM_GUNLUK_ANAHTAR = "tdm_gunluk";
export const TDM_SON_ANAHTAR = "tdm_son";
export const TDM_DUZENLE_ANAHTAR = "tdm_duzenle_ilan";

export type TdmDurum =
  | "ONAY_BEKLIYOR"
  | "KUYRUK"
  | "GONDERILDI"
  | "CEVAP_YOK"
  | "ATLANDI"
  | "HATA";

function telefonNormalize(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let r = tel.replace(/\D/g, "");
  if (r.startsWith("90") && r.length >= 12) r = `0${r.slice(2)}`;
  if (r.length === 10) r = `0${r}`;
  return r.length >= 11 ? r.slice(0, 11) : null;
}

export async function tdmKaraListeOku(): Promise<Set<string>> {
  const ham = (await ayarOku(AYAR_ANAHTARLARI.tdmKaraListe)) || "";
  const set = new Set<string>();
  for (const p of ham.split(/[,\n;]/)) {
    const t = telefonNormalize(p.trim());
    if (t) set.add(t);
    const sade = p.trim().replace(/\D/g, "");
    if (sade.length >= 5) set.add(sade);
  }
  return set;
}

export function fiyatTonajEksikMi(ilan: {
  tonaj: number | null;
  ucret: number | null;
  fiyatTon: number | null;
}): boolean {
  const fiyatYok = ilan.ucret === null && ilan.fiyatTon === null;
  return !ilan.tonaj || fiyatYok;
}

function gunlukOku(ham: string | null): { gun: string; adet: number } {
  const gun = bugunAnahtar();
  if (!ham) return { gun, adet: 0 };
  const [g, a] = ham.split(":");
  if (g !== gun) return { gun, adet: 0 };
  const adet = Number(a);
  return { gun, adet: Number.isFinite(adet) ? adet : 0 };
}

/** Ayarlar'dan günlük DM limiti (1–30). Varsayılan 10. */
export async function tdmGunlukLimitOku(): Promise<number> {
  const ham = await ayarOku(AYAR_ANAHTARLARI.tdmGunlukLimit);
  const n = Number(ham);
  if (!Number.isFinite(n) || n < 1) return TDM_GUNLUK_LIMIT_VARSAYILAN;
  return Math.min(30, Math.round(n));
}

export async function tdmLimitKontrol(hedefUserId: string | null): Promise<{
  ok: boolean;
  sebep?: string;
  limitMi?: boolean;
}> {
  const flood = Date.parse(
    (await ayarOku(AYAR_ANAHTARLARI.telegramFloodBitis)) || ""
  );
  if (Number.isFinite(flood) && Date.now() < flood) {
    return { ok: false, sebep: "FloodWait kilitli (24s)" };
  }

  const limit = await tdmGunlukLimitOku();
  const sayac = gunlukOku(
    (await prisma.ayar.findUnique({ where: { anahtar: TDM_GUNLUK_ANAHTAR } }))
      ?.deger ?? null
  );
  if (sayac.adet >= limit) {
    return { ok: false, sebep: `Günlük limit ${limit}`, limitMi: true };
  }

  const sonHam = (
    await prisma.ayar.findUnique({ where: { anahtar: TDM_SON_ANAHTAR } })
  )?.deger;
  const sonMs = Date.parse(sonHam || "");
  if (Number.isFinite(sonMs) && Date.now() - sonMs < TDM_ARA_MS) {
    const kalanSn = Math.ceil((TDM_ARA_MS - (Date.now() - sonMs)) / 1000);
    const kalan =
      kalanSn >= 60 ? `${Math.ceil(kalanSn / 60)} dk` : `${kalanSn} sn`;
    return { ok: false, sebep: `Ara: ${kalan} sonra` };
  }

  if (hedefUserId) {
    const sinir = new Date(Date.now() - TDM_KISI_MS);
    const once = await prisma.telegramDm.findFirst({
      where: {
        hedefUserId,
        durum: "GONDERILDI",
        gonderildiAt: { gte: sinir },
      },
      select: { id: true },
    });
    if (once) {
      return { ok: false, sebep: "Bu kişiye 24s içinde mesaj atıldı" };
    }
  }

  return { ok: true };
}

export async function tdmKaraKontrol(
  telefon: string | null,
  hedefUserId: string | null
): Promise<boolean> {
  const kara = await tdmKaraListeOku();
  const tel = telefonNormalize(telefon);
  if (tel && kara.has(tel)) return true;
  if (hedefUserId && kara.has(hedefUserId)) return true;
  return false;
}

/** Bildirim kartı: [Bilgi Sor] (+ Panelde Aç gonder.ts'te) — tel: yasak (TG 400). */
export async function tdmKartButonlari(ilan: {
  id: number;
  gonderenUserId: string | null;
  telefon: string | null;
}): Promise<InlineButon[][] | null> {
  if (!ilan.gonderenUserId && !ilan.telefon) return null;

  const satir: InlineButon[] = [];

  if (ilan.gonderenUserId) {
    satir.push({ metin: "Bilgi Sor", callback: `tdm:s:${ilan.id}` });
  } else if (ilan.telefon) {
    let metin = "";
    try {
      metin = (await ilanIletisimMesaji(ilan.id)).metin;
    } catch {
      /* boş wa linki */
    }
    const wa = whatsappMesajUrl(ilan.telefon, metin);
    if (wa) satir.push({ metin: "Bilgi Sor", url: wa });
  }

  // Ara/tel: KALDIRILDI — Telegram inline keyboard tel: kabul etmiyor (Wrong port).
  // Telefon mesaj metninde; kullanıcı kopyala/tıkla yapar.

  return satir.length > 0 ? [satir] : null;
}

/**
 * [Bilgi Sor] — mesajı hemen kuyruğa al (daemon saniyeler içinde gönderir).
 * Onay / modal / düzenleme yok.
 */
export async function tdmBilgiSor(ilanId: number): Promise<{
  ok: boolean;
  mesaj: string;
}> {
  const ilan = await prisma.yukIlani.findUnique({ where: { id: ilanId } });
  if (!ilan) return { ok: false, mesaj: "İlan yok." };
  if (!ilan.gonderenUserId) {
    return { ok: false, mesaj: "Telegram id yok." };
  }
  if (await tdmKaraKontrol(ilan.telefon, ilan.gonderenUserId)) {
    return { ok: false, mesaj: "Kara liste." };
  }

  const limit = await tdmLimitKontrol(ilan.gonderenUserId);
  if (!limit.ok) return { ok: false, mesaj: limit.sebep || "Limit" };

  const yakin = await prisma.telegramDm.findFirst({
    where: {
      ilanId,
      durum: { in: ["KUYRUK", "GONDERILDI"] },
      createdAt: { gte: new Date(Date.now() - TDM_KISI_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (yakin?.durum === "KUYRUK") {
    return { ok: true, mesaj: "✅ Gönderildi" };
  }
  if (yakin?.durum === "GONDERILDI") {
    return { ok: false, mesaj: "Zaten soruldu (24s)." };
  }

  let metin: string;
  try {
    metin = (await ilanIletisimMesaji(ilanId, { zorlaYenile: true })).metin;
  } catch {
    const rota = `${ilan.nereden || ilan.cikisIl || "?"}→${ilan.nereye || ilan.varisIl || "?"}`;
    metin =
      `Merhaba, ${rota} işiniz için bilgi alabilir miyim?\n` +
      `Kaç ton, navlun ne kadar, yükleme ne zaman ve tam adres neresi?`;
  }

  const onayBekleyen = await prisma.telegramDm.findFirst({
    where: { ilanId, durum: "ONAY_BEKLIYOR" },
    orderBy: { createdAt: "desc" },
  });

  let dmId: number;
  if (onayBekleyen) {
    await prisma.telegramDm.update({
      where: { id: onayBekleyen.id },
      data: {
        metin,
        hedefUserId: ilan.gonderenUserId,
        telefon: ilan.telefon,
        durum: "KUYRUK",
        hata: null,
      },
    });
    dmId = onayBekleyen.id;
  } else {
    const dm = await prisma.telegramDm.create({
      data: {
        ilanId,
        hedefUserId: ilan.gonderenUserId,
        telefon: ilan.telefon,
        metin,
        durum: "KUYRUK",
      },
    });
    dmId = dm.id;
  }

  await prisma.yukIlani.update({
    where: { id: ilanId },
    data: { durum: "ILETISIME_GECILDI" },
  });

  void dmId;
  return { ok: true, mesaj: "✅ Gönderildi" };
}

/** Eski bildirimler: tdm:g:dmId — kuyruğa al. */
export async function tdmGonderOnayla(dmId: number): Promise<{
  ok: boolean;
  mesaj: string;
}> {
  const dm = await prisma.telegramDm.findUnique({
    where: { id: dmId },
    include: { ilan: { select: { id: true, durum: true } } },
  });
  if (!dm) return { ok: false, mesaj: "Kayıt yok." };
  if (dm.durum === "GONDERILDI") {
    return { ok: false, mesaj: "Zaten gönderildi." };
  }
  if (dm.durum === "ATLANDI") return { ok: false, mesaj: "Atlanmış." };
  if (!dm.hedefUserId) {
    return { ok: false, mesaj: "Telegram id yok." };
  }
  if (await tdmKaraKontrol(dm.telefon, dm.hedefUserId)) {
    await prisma.telegramDm.update({
      where: { id: dmId },
      data: { durum: "HATA", hata: "Kara liste" },
    });
    return { ok: false, mesaj: "Kara liste." };
  }

  const limit = await tdmLimitKontrol(dm.hedefUserId);
  if (!limit.ok) return { ok: false, mesaj: limit.sebep || "Limit" };

  await prisma.telegramDm.update({
    where: { id: dmId },
    data: { durum: "KUYRUK", hata: null },
  });
  await prisma.yukIlani.update({
    where: { id: dm.ilanId },
    data: { durum: "ILETISIME_GECILDI" },
  });

  return { ok: true, mesaj: "✅ Gönderildi" };
}

export async function tdmAtla(dmId: number): Promise<{ ok: boolean; mesaj: string }> {
  const dm = await prisma.telegramDm.findUnique({ where: { id: dmId } });
  if (!dm) return { ok: false, mesaj: "Kayıt yok." };
  await prisma.telegramDm.update({
    where: { id: dmId },
    data: { durum: "ATLANDI" },
  });
  return { ok: true, mesaj: "Geçildi." };
}

export async function tdmDuzenleBaslat(
  dmId: number,
  chatId: string
): Promise<{ ok: boolean; mesaj: string }> {
  const dm = await prisma.telegramDm.findUnique({ where: { id: dmId } });
  if (!dm) return { ok: false, mesaj: "Kayıt yok." };
  if (dm.durum === "GONDERILDI") {
    return { ok: false, mesaj: "Gönderilmiş mesaj düzenlenemez." };
  }

  await prisma.ayar.upsert({
    where: { anahtar: TDM_DUZENLE_ANAHTAR },
    create: {
      anahtar: TDM_DUZENLE_ANAHTAR,
      deger: JSON.stringify({ dmId, chatId }),
    },
    update: { deger: JSON.stringify({ dmId, chatId }) },
  });

  await telegramGonder(
    chatId,
    `<b>Düzenle</b>\n\nMevcut taslak:\n<code>${htmlKacis(dm.metin)}</code>\n\n` +
      `Yeni metni bu sohbete yaz (tek mesaj).`
  );

  return { ok: true, mesaj: "Yeni metni yaz." };
}

/** Sahip sohbetinden gelen düzenleme metni. */
export async function tdmDuzenleMetinIsle(
  chatId: string,
  metin: string
): Promise<{ islendi: boolean; mesaj?: string }> {
  const ham = (
    await prisma.ayar.findUnique({ where: { anahtar: TDM_DUZENLE_ANAHTAR } })
  )?.deger;
  if (!ham) return { islendi: false };
  try {
    const j = JSON.parse(ham) as { dmId?: number; chatId?: string };
    if (String(j.chatId) !== String(chatId) || !j.dmId) {
      return { islendi: false };
    }
    const dm = await prisma.telegramDm.findUnique({ where: { id: j.dmId } });
    if (!dm || dm.durum === "GONDERILDI") {
      await prisma.ayar.delete({ where: { anahtar: TDM_DUZENLE_ANAHTAR } }).catch(() => null);
      return { islendi: true, mesaj: "Düzenleme iptal." };
    }

    const temiz = metin.trim().slice(0, 2000);
    await prisma.telegramDm.update({
      where: { id: dm.id },
      data: { metin: temiz, durum: "ONAY_BEKLIYOR" },
    });
    await prisma.ayar.delete({ where: { anahtar: TDM_DUZENLE_ANAHTAR } }).catch(() => null);

    const tercih = await aiTercihleriOku();
    const butonlar: InlineButon[][] = [
      [
        { metin: "Bilgi Sor", callback: `tdm:g:${dm.id}` },
        { metin: "Geç", callback: `tdm:x:${dm.id}` },
      ],
    ];
    if (tercih.telegramChatId) {
      await telegramGonder(
        tercih.telegramChatId,
        `<b>Taslak güncellendi</b>\n\n${htmlKacis(temiz)}`,
        butonlar
      );
    }
    return { islendi: true, mesaj: "Taslak güncellendi." };
  } catch {
    return { islendi: false };
  }
}

/** Daemon: kuyruktan bir DM al. */
export async function tdmKuyruktanAl(): Promise<{
  id: number;
  hedefUserId: string;
  metin: string;
  ilanId: number;
} | null> {
  const aday = await prisma.telegramDm.findFirst({
    where: { durum: "KUYRUK", hedefUserId: { not: null } },
    orderBy: { createdAt: "asc" },
  });
  if (!aday?.hedefUserId) return null;

  const limit = await tdmLimitKontrol(aday.hedefUserId);
  if (!limit.ok) {
    // Limit / FloodWait / kişi limiti — kuyrukta beklesin, hata yazma
    return null;
  }

  if (await tdmKaraKontrol(aday.telefon, aday.hedefUserId)) {
    await prisma.telegramDm.update({
      where: { id: aday.id },
      data: { durum: "HATA", hata: "Kara liste" },
    });
    return null;
  }

  return {
    id: aday.id,
    hedefUserId: aday.hedefUserId,
    metin: aday.metin,
    ilanId: aday.ilanId,
  };
}

export async function tdmGonderildiIsaretle(
  dmId: number,
  outboundMesajId: number | null
): Promise<void> {
  const sayac = gunlukOku(
    (await prisma.ayar.findUnique({ where: { anahtar: TDM_GUNLUK_ANAHTAR } }))
      ?.deger ?? null
  );
  const limit = await tdmGunlukLimitOku();
  const yeniAdet = sayac.adet + 1;

  await prisma.telegramDm.update({
    where: { id: dmId },
    data: {
      durum: "GONDERILDI",
      gonderildiAt: new Date(),
      outboundMesajId: outboundMesajId ?? undefined,
      hata: null,
    },
  });
  await prisma.ayar.upsert({
    where: { anahtar: TDM_SON_ANAHTAR },
    create: { anahtar: TDM_SON_ANAHTAR, deger: new Date().toISOString() },
    update: { deger: new Date().toISOString() },
  });
  await prisma.ayar.upsert({
    where: { anahtar: TDM_GUNLUK_ANAHTAR },
    create: {
      anahtar: TDM_GUNLUK_ANAHTAR,
      deger: `${sayac.gun}:${yeniAdet}`,
    },
    update: { deger: `${sayac.gun}:${yeniAdet}` },
  });

  const dm = await prisma.telegramDm.findUnique({
    where: { id: dmId },
    include: {
      ilan: {
        select: {
          nereden: true,
          nereye: true,
          cikisIl: true,
          varisIl: true,
          firmaAdi: true,
          ilgiliKisi: true,
        },
      },
    },
  });
  const tercih = await aiTercihleriOku();
  if (tercih.telegramChatId && dm) {
    const rota = `${dm.ilan.nereden || dm.ilan.cikisIl || "?"}→${dm.ilan.nereye || dm.ilan.varisIl || "?"}`;
    const kim = dm.ilan.firmaAdi || dm.ilan.ilgiliKisi || "";
    await telegramGonder(
      tercih.telegramChatId,
      `✅ <b>Gönderildi:</b> ${htmlKacis(rota)}` +
        (kim ? ` · ${htmlKacis(kim)}` : "") +
        `\nBugün ${yeniAdet}/${limit}`
    );
  }
}

export async function tdmHataIsaretle(dmId: number, hata: string): Promise<void> {
  await prisma.telegramDm.update({
    where: { id: dmId },
    data: { durum: "HATA", hata: hata.slice(0, 300) },
  });
}

export async function tdmFloodBildir(saniye: number): Promise<void> {
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramChatId) return;
  await telegramGonder(
    tercih.telegramChatId,
    `⛔ <b>Telegram FloodWait</b> (${saniye}s)\n` +
      `DM + katılım 24 saat durdu. Okuyucu hesabı korunuyor.`
  );
}

/** Gelen özel mesaj → son gönderilen DM cevabı mı? */
export async function tdmCevapIsle(
  fromUserId: string,
  metin: string
): Promise<{ islendi: boolean }> {
  const sinir = new Date(Date.now() - TDM_KISI_MS);
  const dm = await prisma.telegramDm.findFirst({
    where: {
      hedefUserId: fromUserId,
      durum: "GONDERILDI",
      gonderildiAt: { gte: sinir },
      cevapAt: null,
    },
    orderBy: { gonderildiAt: "desc" },
    include: {
      ilan: {
        select: {
          id: true,
          firmaAdi: true,
          ilgiliKisi: true,
          nereden: true,
          nereye: true,
          cikisIl: true,
          varisIl: true,
          tonaj: true,
          ucret: true,
          fiyatTon: true,
          hamMetin: true,
        },
      },
    },
  });
  if (!dm) return { islendi: false };

  const rota = `${dm.ilan.nereden || dm.ilan.cikisIl || "?"}→${dm.ilan.nereye || dm.ilan.varisIl || "?"}`;
  const bugun = new Date().toISOString().slice(0, 10);
  const cozum = await cevapAiCozumle(metin, { rota, bugun });

  await prisma.telegramDm.update({
    where: { id: dm.id },
    data: { cevapMetin: metin.slice(0, 2000), cevapAt: new Date() },
  });

  const guncelle: {
    tonaj?: number;
    ucret?: number | null;
    fiyatTon?: number | null;
    yuklemeTarihi?: Date | null;
    nereden?: string;
    durum: string;
  } = { durum: "PAZARLIKTA" };

  if (cozum.tonaj) guncelle.tonaj = cozum.tonaj;
  if (cozum.ucretKurush) {
    guncelle.ucret = cozum.ucretKurush;
    guncelle.fiyatTon = null;
  } else if (cozum.fiyatTonKurush) {
    guncelle.fiyatTon = cozum.fiyatTonKurush;
  }
  if (cozum.yuklemeTarihi) guncelle.yuklemeTarihi = cozum.yuklemeTarihi;
  if (cozum.adres && cozum.adres.length >= 3) {
    // Adresi nereden alanına ekle (kısa not) — var olan ili bozma
    const mevcut = dm.ilan.nereden || dm.ilan.cikisIl || "";
    if (!mevcut.toLocaleLowerCase("tr-TR").includes(cozum.adres.slice(0, 12).toLocaleLowerCase("tr-TR"))) {
      guncelle.nereden = `${mevcut} (${cozum.adres})`.slice(0, 120);
    }
  }

  await prisma.yukIlani.update({
    where: { id: dm.ilanId },
    data: guncelle,
  });

  const guncel = await prisma.yukIlani.findUnique({
    where: { id: dm.ilanId },
    select: { tonaj: true, ucret: true, fiyatTon: true, yuklemeTarihi: true },
  });

  const kim =
    dm.ilan.firmaAdi || dm.ilan.ilgiliKisi || `İlan #${dm.ilanId}`;
  const zamanParca = [
    guncel?.yuklemeTarihi
      ? guncel.yuklemeTarihi.toLocaleDateString("tr-TR")
      : null,
    cozum.yuklemeSaati,
  ]
    .filter(Boolean)
    .join(" ");

  const ozetSatir = [
    guncel?.tonaj ? `${guncel.tonaj} ton` : null,
    guncel?.ucret
      ? tlYazKisa(guncel.ucret)
      : guncel?.fiyatTon
        ? `${tlYazKisa(guncel.fiyatTon)}/ton`
        : null,
    zamanParca || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const tercih = await aiTercihleriOku();
  if (tercih.telegramChatId) {
    await telegramGonder(
      tercih.telegramChatId,
      `✅ <b>${htmlKacis(kim)} cevap verdi:</b> ` +
        `${htmlKacis(ozetSatir || cozum.ozet || rota)}` +
        `\n<i>${htmlKacis(metin.slice(0, 300))}</i>`
    );
  }

  return { islendi: true };
}

/** 24s cevap gelmeyen DM → CEVAP_YOK. */
export async function tdmCevapYokIsle(): Promise<number> {
  const sinir = new Date(Date.now() - TDM_KISI_MS);
  const bekleyen = await prisma.telegramDm.findMany({
    where: {
      durum: "GONDERILDI",
      cevapAt: null,
      gonderildiAt: { lt: sinir },
    },
    take: 40,
    select: { id: true, ilanId: true },
  });
  if (bekleyen.length === 0) return 0;

  for (const d of bekleyen) {
    await prisma.telegramDm.update({
      where: { id: d.id },
      data: { durum: "CEVAP_YOK", hata: "24s cevap yok" },
    });
    await prisma.yukIlani.updateMany({
      where: {
        id: d.ilanId,
        durum: { in: ["ILETISIME_GECILDI", "YENI", "ILGILENIYOR"] },
      },
      data: { durum: "CEVAP_YOK" },
    });
  }
  return bekleyen.length;
}

/** @deprecated — tdmCevap.ts regex; geriye uyum */
export function cevapParse(metin: string) {
  const c = cevapParseRegex(metin);
  return {
    tonaj: c.tonaj,
    ucretKurush: c.ucretKurush,
    fiyatTonKurush: c.fiyatTonKurush,
    ozet: c.ozet,
  };
}
