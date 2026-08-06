/**
 * Grup mesajlarından t.me / @mention / WhatsApp link hasadı.
 * @username → ADAY yazmadan ÖNCE getEntity ile tip doğrula (Channel/Chat).
 * User/Bot / çözülemeyen → kaydetme.
 */
import type { TelegramClient } from "telegram";
import { prisma } from "@/lib/prisma";
import { illeriBul, sadelestir } from "@/lib/iller";
import {
  katilimRedSebebi,
  koridorBaslikOnceligi,
  yukBasligiMi,
} from "@/lib/bolgeler";
import { koridorIlKumesi } from "@/lib/koridor";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";
import { usernamePeerTipi } from "@/lib/kaynaklar/telegramPeerTip";

export type HasatTur = "TME_USER" | "TME_INVITE" | "MENTION" | "WHATSAPP";

export type HasatLink = {
  tur: HasatTur;
  hedef: string;
  kullaniciAdi: string | null;
  ad: string;
  kod: string | null;
};

const ATLANACAK_USER = new Set(
  [
    "telegram",
    "telegrambots",
    "botfather",
    "gif",
    "pic",
    "bing",
    "wiki",
    "imdb",
    "youtube",
    "spotify",
    "premium",
    "durov",
  ].map((s) => s.toLowerCase())
);

const YUK_IPUCU =
  /y[uü]k|nakliye|nakliyat|t[iı]r|kamyon|lojistik|parsiyel|komple|osb|ara[cç]|[sş]of[oö]r|bo[sş]\s*ara[cç]/i;

export function metindeYukIpuçuVar(metin: string): boolean {
  return YUK_IPUCU.test(sadelestir(metin) || metin);
}

/** Mesajda koridor ili/semt geçiyor mu — mention hasadı için. */
export function metindeKoridorIpuçuVar(
  metin: string,
  koridorIller: string[]
): boolean {
  if (koridorIller.length === 0) return false;
  const kume = new Set(koridorIller);
  return illeriBul(metin).some((il) => kume.has(il));
}

export function entityUrlleriEkle(
  metin: string,
  entities: unknown[] | null | undefined
): string {
  if (!entities?.length) return metin;
  const ek: string[] = [];
  for (const e of entities) {
    if (!e || typeof e !== "object") continue;
    const o = e as { url?: string };
    if (typeof o.url === "string" && o.url.trim()) ek.push(o.url.trim());
  }
  if (ek.length === 0) return metin;
  return `${metin}\n${ek.join("\n")}`;
}

/**
 * Önce t.me / davet / WA, sonra @mention.
 * Tip doğrulama kaydetmeden önce yapılır.
 */
export function linkleriHasatEt(metin: string): HasatLink[] {
  const sonuc: HasatLink[] = [];
  const gorulen = new Set<string>();

  const ekle = (l: HasatLink) => {
    if (gorulen.has(l.hedef)) return;
    gorulen.add(l.hedef);
    sonuc.push(l);
  };

  // t.me / telegram.me / telegram.dog + joinchat / +hash
  const tmeRe =
    /(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/(?:(joinchat\/|\+))?([A-Za-z0-9_\-]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = tmeRe.exec(metin)) !== null) {
    const onEk = (m[1] || "").toLowerCase();
    const kod = m[2];
    if (!kod) continue;
    if (onEk === "+" || onEk === "joinchat/") {
      const hash = kod.replace(/^\+/, "");
      ekle({
        tur: "TME_INVITE",
        hedef: `inv:${hash}`,
        kullaniciAdi: null,
        ad: `Davet +${hash.slice(0, 12)}`,
        kod: hash,
      });
      continue;
    }
    // t.me/c/123456 — private chat id, username yok
    if (kod.toLowerCase() === "c") continue;
    const user = kod.toLowerCase();
    if (ATLANACAK_USER.has(user)) continue;
    if (
      user === "share" ||
      user === "addstickers" ||
      user === "proxy" ||
      user === "s" ||
      user === "iv"
    ) {
      continue;
    }
    ekle({
      tur: "TME_USER",
      hedef: `u:${user}`,
      kullaniciAdi: user,
      ad: `@${user}`,
      kod: null,
    });
  }

  // tg://resolve?domain=foo
  const tgRe = /tg:\/\/resolve\?domain=([A-Za-z][A-Za-z0-9_]{3,31})/gi;
  while ((m = tgRe.exec(metin)) !== null) {
    const user = m[1].toLowerCase();
    if (ATLANACAK_USER.has(user)) continue;
    ekle({
      tur: "TME_USER",
      hedef: `u:${user}`,
      kullaniciAdi: user,
      ad: `@${user}`,
      kod: null,
    });
  }

  const waRe =
    /(?:https?:\/\/)?(?:chat\.whatsapp\.com|whatsapp\.com\/channel)\/([A-Za-z0-9_\-]+)/gi;
  while ((m = waRe.exec(metin)) !== null) {
    const kod = m[1];
    if (!kod) continue;
    ekle({
      tur: "WHATSAPP",
      hedef: `wa:${kod}`,
      kullaniciAdi: null,
      ad: `WA ${kod.slice(0, 10)}`,
      kod,
    });
  }

  // @mention — yük ipucu VEYA koridor ili (çağıran taraf genişletebilir;
  // burada sadece yük; mesajdanHasatEt koridor ekler)
  if (metindeYukIpuçuVar(metin)) {
    const mentionRe = /(?<![A-Za-z0-9_])@([A-Za-z][A-Za-z0-9_]{3,31})\b/g;
    while ((m = mentionRe.exec(metin)) !== null) {
      const user = m[1].toLowerCase();
      if (ATLANACAK_USER.has(user)) continue;
      ekle({
        tur: "MENTION",
        hedef: `u:${user}`,
        kullaniciAdi: user,
        ad: `@${user}`,
        kod: null,
      });
    }
  }

  const sira = (t: HasatTur) =>
    t === "TME_USER" ? 0 : t === "TME_INVITE" ? 1 : t === "WHATSAPP" ? 2 : 3;
  sonuc.sort((a, b) => sira(a.tur) - sira(b.tur));
  return sonuc;
}

/** Koridor ipucu varken mention'ları da ekle (yük kelimesi olmasa bile). */
export function mentionlariKoridorlaEkle(
  metin: string,
  mevcut: HasatLink[],
  koridorIller: string[]
): HasatLink[] {
  if (!metindeKoridorIpuçuVar(metin, koridorIller)) return mevcut;
  if (metindeYukIpuçuVar(metin)) return mevcut; // zaten eklendi
  const gorulen = new Set(mevcut.map((l) => l.hedef));
  const ekstra: HasatLink[] = [...mevcut];
  const mentionRe = /(?<![A-Za-z0-9_])@([A-Za-z][A-Za-z0-9_]{3,31})\b/g;
  let m: RegExpExecArray | null;
  while ((m = mentionRe.exec(metin)) !== null) {
    const user = m[1].toLowerCase();
    if (ATLANACAK_USER.has(user)) continue;
    const hedef = `u:${user}`;
    if (gorulen.has(hedef)) continue;
    gorulen.add(hedef);
    ekstra.push({
      tur: "MENTION",
      hedef,
      kullaniciAdi: user,
      ad: `@${user}`,
      kod: null,
    });
  }
  return ekstra;
}

export type HasatRaporu = {
  bulunan: number;
  yeni: number;
  mevcut: number;
  atlanan: number;
  /** Channel/Chat + nakliye başlığı */
  grup: number;
  /** User/Bot diye atlanan */
  kisiBot: number;
  /** getEntity başarısız — kaydedilmedi */
  cozulemedi: number;
  /** Tip OK ama başlıkta yük/nakliye yok (veya anlamsız) */
  baslikEleme: number;
  /** Katılım RED (avrupa / koridor dışı) */
  red: number;
};

type KaydetOpts = {
  client?: TelegramClient | null;
};

/**
 * Linkleri ADAY yap. Username’li olanlar client ile tip doğrulanır.
 * Client yoksa username’li linkler atlanır (çöp yazma).
 */
export async function hasatLinkleriniKaydet(
  linkler: HasatLink[],
  kaynak: { id: number; ad: string },
  opts: KaydetOpts = {}
): Promise<HasatRaporu> {
  const rapor: HasatRaporu = {
    bulunan: linkler.length,
    yeni: 0,
    mevcut: 0,
    atlanan: 0,
    grup: 0,
    kisiBot: 0,
    cozulemedi: 0,
    baslikEleme: 0,
    red: 0,
  };
  if (linkler.length === 0) return rapor;

  const kayitlar = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE },
    select: { id: true, hedef: true, kullaniciAdi: true },
  });
  const hedefSet = new Set(kayitlar.map((k) => k.hedef));
  const userSet = new Set(
    kayitlar
      .filter((k) => k.kullaniciAdi)
      .map((k) => k.kullaniciAdi!.toLowerCase())
  );

  const not = `Hasat #${kaynak.id} ${(kaynak.ad || "?").slice(0, 40)}`.slice(
    0,
    120
  );
  const client = opts.client ?? null;

  for (const l of linkler) {
    // Username’li: tip doğrula
    if (l.kullaniciAdi) {
      if (!client) {
        rapor.cozulemedi += 1;
        continue;
      }
      const tip = await usernamePeerTipi(client, l.kullaniciAdi);
      if (tip.tip !== "kanal" && tip.tip !== "sohbet") {
        if (tip.tip === "kisi" || tip.tip === "bot") rapor.kisiBot += 1;
        else rapor.cozulemedi += 1;
        continue;
      }

      const red = katilimRedSebebi(tip.baslik);
      if (red) {
        rapor.red += 1;
        continue;
      }
      if (!yukBasligiMi(tip.baslik)) {
        rapor.baslikEleme += 1;
        continue;
      }

      const hedef = tip.chatId;
      const ku = (tip.kullaniciAdi || l.kullaniciAdi).toLowerCase();
      if (hedefSet.has(hedef) || userSet.has(ku)) {
        rapor.mevcut += 1;
        continue;
      }

      const kor = koridorBaslikOnceligi(tip.baslik);
      const bazOncelik =
        l.tur === "TME_USER" ? 18 : l.tur === "MENTION" ? 14 : 12;
      const oncelik = bazOncelik + kor * 8;

      try {
        await prisma.ilanKaynagi.create({
          data: {
            tur: TELEGRAM_UYE,
            hedef,
            ad: tip.baslik.slice(0, 120),
            aktif: true,
            durum: "ADAY",
            kullaniciAdi: ku,
            uyeSayisi: tip.uyeSayisi,
            oncelik,
            hasatKaynak: not,
          },
        });
        hedefSet.add(hedef);
        userSet.add(ku);
        rapor.yeni += 1;
        rapor.grup += 1;
      } catch {
        rapor.atlanan += 1;
      }
      continue;
    }

    // Davet — otomatik katılım kuyruğuna (cron-katil ImportChatInvite)
    if (l.tur === "TME_INVITE" && l.kod) {
      if (hedefSet.has(l.hedef)) {
        rapor.mevcut += 1;
        continue;
      }
      try {
        await prisma.ilanKaynagi.create({
          data: {
            tur: TELEGRAM_UYE,
            hedef: l.hedef,
            ad: l.ad.slice(0, 120),
            aktif: true,
            durum: "ADAY",
            kullaniciAdi: null,
            uyeSayisi: null,
            oncelik: 16,
            hasatKaynak: not,
            sonHata: "Davet linki — ImportChatInvite bekliyor",
          },
        });
        hedefSet.add(l.hedef);
        rapor.yeni += 1;
        rapor.grup += 1;
      } catch {
        rapor.atlanan += 1;
      }
      continue;
    }

    // WA — şimdilik pasif
    if (hedefSet.has(l.hedef)) {
      rapor.mevcut += 1;
      continue;
    }
    try {
      await prisma.ilanKaynagi.create({
        data: {
          tur: TELEGRAM_UYE,
          hedef: l.hedef,
          ad: l.ad.slice(0, 120),
          aktif: false,
          durum: "ADAY",
          kullaniciAdi: null,
          uyeSayisi: null,
          oncelik: 1,
          hasatKaynak: not,
          sonHata: "WhatsApp link — ileride",
        },
      });
      hedefSet.add(l.hedef);
      rapor.yeni += 1;
      rapor.grup += 1;
    } catch {
      rapor.atlanan += 1;
    }
  }

  return rapor;
}

export async function mesajdanHasatEt(
  metin: string,
  kaynak: { id: number; ad: string },
  entities?: unknown[] | null,
  client?: TelegramClient | null
): Promise<HasatRaporu> {
  const birlesik = entityUrlleriEkle(metin, entities);
  let linkler = linkleriHasatEt(birlesik);
  try {
    const tercih = await aiTercihleriOku();
    const koridor = koridorIlKumesi(tercih.koridorIller);
    linkler = mentionlariKoridorlaEkle(birlesik, linkler, koridor);
  } catch {
    /* tercih yoksa sadece yük mention */
  }
  if (linkler.length === 0) {
    return {
      bulunan: 0,
      yeni: 0,
      mevcut: 0,
      atlanan: 0,
      grup: 0,
      kisiBot: 0,
      cozulemedi: 0,
      baslikEleme: 0,
      red: 0,
    };
  }
  const rapor = await hasatLinkleriniKaydet(linkler, kaynak, { client });
  try {
    const { elemeArtir } = await import("@/lib/kaynaklar/elemeSayac");
    await elemeArtir({
      HASAT_LINK: rapor.bulunan,
      HASAT_YENI: rapor.yeni,
      HASAT_MEVCUT: rapor.mevcut,
      HASAT_KISI_BOT: rapor.kisiBot,
      HASAT_GRUP: rapor.grup,
      HASAT_COZULEMEDI: rapor.cozulemedi,
      HASAT_BASLIK: rapor.baslikEleme,
      HASAT_RED: rapor.red,
    });
  } catch {
    /* sayaç opsiyonel */
  }
  return rapor;
}
