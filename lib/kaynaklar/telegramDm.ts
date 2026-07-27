/**
 * Onaylı Telegram DM — otomatik gönderim YOK.
 * Limit: 15/gün, ≥2 dk ara, aynı kişiye 24s 1 kez, FloodWait→24s dur,
 * kara liste.
 */
import { prisma } from "@/lib/prisma";
import {
  AYAR_ANAHTARLARI,
  aiTercihleriOku,
  ayarOku,
  ayarYaz,
} from "@/lib/ayarlar";
import { bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";
import { ilanIletisimMesaji } from "@/lib/ai/whatsappMesaj";
import { whatsappMesajUrl } from "@/lib/whatsapp";
import {
  htmlKacis,
  telegramGonder,
  type InlineButon,
} from "@/lib/bildirim/telegram";

export const TDM_GUNLUK_LIMIT_VARSAYILAN = 5;
export const TDM_ARA_MS = 2 * 60 * 1000;
export const TDM_KISI_MS = 24 * 60 * 60 * 1000;

export const TDM_GUNLUK_ANAHTAR = "tdm_gunluk";
export const TDM_SON_ANAHTAR = "tdm_son";
export const TDM_DUZENLE_ANAHTAR = "tdm_duzenle_ilan";
export const TDM_KARA_ANAHTAR = "tdm_kara_liste";

export type TdmDurum =
  | "ONAY_BEKLIYOR"
  | "KUYRUK"
  | "GONDERILDI"
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

/** Ayarlar'dan günlük DM limiti (1–30). Varsayılan 5. */
export async function tdmGunlukLimitOku(): Promise<number> {
  const ham = await ayarOku(AYAR_ANAHTARLARI.tdmGunlukLimit);
  const n = Number(ham);
  if (!Number.isFinite(n) || n < 1) return TDM_GUNLUK_LIMIT_VARSAYILAN;
  return Math.min(30, Math.round(n));
}

export async function tdmLimitKontrol(hedefUserId: string | null): Promise<{
  ok: boolean;
  sebep?: string;
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
    return { ok: false, sebep: `Günlük limit ${limit}` };
  }

  const sonHam = (
    await prisma.ayar.findUnique({ where: { anahtar: TDM_SON_ANAHTAR } })
  )?.deger;
  const sonMs = Date.parse(sonHam || "");
  if (Number.isFinite(sonMs) && Date.now() - sonMs < TDM_ARA_MS) {
    const kalan = Math.ceil((TDM_ARA_MS - (Date.now() - sonMs)) / 60000);
    return { ok: false, sebep: `Ara: ${kalan} dk sonra` };
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

/** Eksik fiyat/tonaj ilanı için DM kaydı + hazır mesaj. */
export async function tdmHazirla(ilanId: number): Promise<{
  dmId: number;
  metin: string;
  hedefUserId: string | null;
  telefon: string | null;
} | null> {
  const ilan = await prisma.yukIlani.findUnique({ where: { id: ilanId } });
  if (!ilan) return null;
  if (!fiyatTonajEksikMi(ilan)) return null;
  if (!ilan.gonderenUserId && !ilan.telefon) return null;

  if (await tdmKaraKontrol(ilan.telefon, ilan.gonderenUserId)) {
    return null;
  }

  const mevcut = await prisma.telegramDm.findFirst({
    where: {
      ilanId,
      durum: { in: ["ONAY_BEKLIYOR", "KUYRUK", "GONDERILDI"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (mevcut) {
    return {
      dmId: mevcut.id,
      metin: mevcut.metin,
      hedefUserId: mevcut.hedefUserId,
      telefon: mevcut.telefon,
    };
  }

  let metin: string;
  try {
    const r = await ilanIletisimMesaji(ilanId);
    metin = r.metin;
  } catch (e) {
    console.warn(
      "[tdm] mesaj üretilemedi",
      e instanceof Error ? e.message : e
    );
    const rota = `${ilan.nereden || ilan.cikisIl || "?"} → ${ilan.nereye || ilan.varisIl || "?"}`;
    metin =
      `Merhaba, ${rota} yükünüz için tenteli TIR ile ilgileniyorum. ` +
      `Net tonaj, yükleme adresi/saati ve navlun bilgisini yazar mısınız?`;
  }

  const dm = await prisma.telegramDm.create({
    data: {
      ilanId,
      hedefUserId: ilan.gonderenUserId,
      telefon: ilan.telefon,
      metin,
      durum: "ONAY_BEKLIYOR",
    },
  });

  return {
    dmId: dm.id,
    metin: dm.metin,
    hedefUserId: dm.hedefUserId,
    telefon: dm.telefon,
  };
}

export function tdmBildirimButonlari(secenek: {
  dmId: number;
  ilanId: number;
  hedefUserId: string | null;
  telefon: string | null;
  metin: string;
  detayUrl?: string | null;
}): InlineButon[][] {
  const satir1: InlineButon[] = [];
  if (secenek.hedefUserId) {
    satir1.push({ metin: "Gönder", callback: `tdm:g:${secenek.dmId}` });
  }
  satir1.push({ metin: "Düzenle", callback: `tdm:e:${secenek.dmId}` });
  satir1.push({ metin: "Geç", callback: `tdm:x:${secenek.dmId}` });

  const satir2: InlineButon[] = [];
  if (secenek.telefon) {
    const wa = whatsappMesajUrl(secenek.telefon, secenek.metin);
    if (wa) satir2.push({ metin: "WhatsApp", url: wa });
  }
  if (secenek.detayUrl) {
    satir2.push({ metin: "Detay", url: secenek.detayUrl });
  }

  return [satir1, ...(satir2.length ? [satir2] : [])];
}

/** [Gönder] — kuyruğa al (GramJS daemon gönderir). */
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
    return { ok: false, mesaj: "Telegram kullanıcı id yok — WhatsApp kullan." };
  }
  if (await tdmKaraKontrol(dm.telefon, dm.hedefUserId)) {
    await prisma.telegramDm.update({
      where: { id: dmId },
      data: { durum: "HATA", hata: "Kara liste" },
    });
    return { ok: false, mesaj: "Kara listede — gönderilmedi." };
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

  return {
    ok: true,
    mesaj: "Kuyruğa alındı — hesabınla DM atılacak (limitlere uygun).",
  };
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
    const butonlar = tdmBildirimButonlari({
      dmId: dm.id,
      ilanId: dm.ilanId,
      hedefUserId: dm.hedefUserId,
      telefon: dm.telefon,
      metin: temiz,
    });
    if (tercih.telegramChatId) {
      await telegramGonder(
        tercih.telegramChatId,
        `<b>Taslak güncellendi</b>\n\n${htmlKacis(temiz)}`,
        butonlar
      );
    }
    return { islendi: true, mesaj: "Taslak güncellendi — Gönder / Geç." };
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
  if (!limit.ok) return null;

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
      deger: `${sayac.gun}:${sayac.adet + 1}`,
    },
    update: { deger: `${sayac.gun}:${sayac.adet + 1}` },
  });
}

export async function tdmHataIsaretle(dmId: number, hata: string): Promise<void> {
  await prisma.telegramDm.update({
    where: { id: dmId },
    data: { durum: "HATA", hata: hata.slice(0, 300) },
  });
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
        },
      },
    },
  });
  if (!dm) return { islendi: false };

  const { tonaj, ucretKurush, fiyatTonKurush, ozet } = cevapParse(metin);

  await prisma.telegramDm.update({
    where: { id: dm.id },
    data: { cevapMetin: metin.slice(0, 2000), cevapAt: new Date() },
  });

  const guncelle: {
    tonaj?: number;
    ucret?: number | null;
    fiyatTon?: number | null;
  } = {};
  if (tonaj && !dm.ilan.tonaj) guncelle.tonaj = tonaj;
  if (ucretKurush && !dm.ilan.ucret && !dm.ilan.fiyatTon) {
    guncelle.ucret = ucretKurush;
  } else if (fiyatTonKurush && !dm.ilan.fiyatTon && !dm.ilan.ucret) {
    guncelle.fiyatTon = fiyatTonKurush;
  }
  if (Object.keys(guncelle).length > 0) {
    await prisma.yukIlani.update({
      where: { id: dm.ilanId },
      data: guncelle,
    });
  }

  const kim =
    dm.ilan.firmaAdi ||
    dm.ilan.ilgiliKisi ||
    `İlan #${dm.ilanId}`;
  const tercih = await aiTercihleriOku();
  if (tercih.telegramChatId) {
    await telegramGonder(
      tercih.telegramChatId,
      `<b>${htmlKacis(kim)} cevap verdi:</b> ${htmlKacis(ozet)}\n\n` +
        `<i>${htmlKacis(metin.slice(0, 500))}</i>`
    );
  }

  return { islendi: true };
}

/** Cevaptan tonaj / fiyat çıkar (AI yok). */
export function cevapParse(metin: string): {
  tonaj: number | null;
  ucretKurush: number | null;
  fiyatTonKurush: number | null;
  ozet: string;
} {
  const sade = metin.toLocaleLowerCase("tr-TR");
  let tonaj: number | null = null;
  const tonM = sade.match(/(\d{1,2})\s*ton/);
  if (tonM) {
    const t = Number(tonM[1]);
    if (t >= 1 && t <= 50) tonaj = t;
  }

  let ucretKurush: number | null = null;
  let fiyatTonKurush: number | null = null;
  // 19.000 / 19000 / 19 bin
  const fiyatM = sade.match(
    /(\d{1,3}(?:[.\s]\d{3})+|\d{4,6}|\d{1,2}\s*bin)\s*(?:tl|₺|lira)?/
  );
  if (fiyatM) {
    let ham = fiyatM[1].replace(/\s/g, "");
    if (/bin$/.test(ham)) {
      ham = String(Number(ham.replace(/bin$/, "")) * 1000);
    } else {
      ham = ham.replace(/\./g, "");
    }
    const tl = Number(ham);
    if (Number.isFinite(tl) && tl >= 500 && tl <= 5_000_000) {
      if (/ton|\/ton|kdv/.test(sade) && tl < 8000) {
        fiyatTonKurush = Math.round(tl * 100);
      } else {
        ucretKurush = Math.round(tl * 100);
      }
    }
  }

  const parcalar = [
    tonaj ? `${tonaj} ton` : null,
    ucretKurush
      ? `${(ucretKurush / 100).toLocaleString("tr-TR")} TL`
      : fiyatTonKurush
        ? `₺${(fiyatTonKurush / 100).toLocaleString("tr-TR")}/ton`
        : null,
  ].filter(Boolean);
  const ozet = parcalar.length > 0 ? parcalar.join(", ") : metin.slice(0, 80);

  return { tonaj, ucretKurush, fiyatTonKurush, ozet };
}
