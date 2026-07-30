/**
 * Grup mesajlarından t.me / @mention / WhatsApp link hasadı.
 * @username → ADAY yazmadan ÖNCE getEntity ile tip doğrula (Channel/Chat).
 * User/Bot / çözülemeyen → kaydetme.
 */
import type { TelegramClient } from "telegram";
import { prisma } from "@/lib/prisma";
import { sadelestir } from "@/lib/iller";
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

  const tmeRe =
    /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:(joinchat\/|\+))?([A-Za-z0-9_\-]+)/gi;
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
    const user = kod.toLowerCase();
    if (ATLANACAK_USER.has(user)) continue;
    if (user === "share" || user === "addstickers" || user === "proxy") continue;
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

  // @mention en sonda — sadece yük ipucu + tip doğrulama ile
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

  // Güvenilirlik sırası: t.me → davet/WA → mention
  const sira = (t: HasatTur) =>
    t === "TME_USER" ? 0 : t === "TME_INVITE" ? 1 : t === "WHATSAPP" ? 2 : 3;
  sonuc.sort((a, b) => sira(a.tur) - sira(b.tur));
  return sonuc;
}

export type HasatRaporu = {
  bulunan: number;
  yeni: number;
  mevcut: number;
  atlanan: number;
  /** Channel/Chat olarak kayda geçen */
  grup: number;
  /** User/Bot diye atlanan */
  kisiBot: number;
  /** getEntity başarısız — kaydedilmedi */
  cozulemedi: number;
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
      if (tip.tip === "kisi" || tip.tip === "bot") {
        rapor.kisiBot += 1;
        continue;
      }
      if (tip.tip === "bilinmiyor") {
        rapor.cozulemedi += 1;
        continue;
      }

      // Gerçek grup — chatId ile kaydet
      const hedef = tip.chatId;
      const ku = (tip.kullaniciAdi || l.kullaniciAdi).toLowerCase();
      if (hedefSet.has(hedef) || userSet.has(ku)) {
        rapor.mevcut += 1;
        continue;
      }

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
            oncelik: l.tur === "TME_USER" ? 12 : 10,
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

    // Davet / WA — username yok, tip yok; kaydet ama join yok
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
          sonHata:
            l.tur === "WHATSAPP"
              ? "WhatsApp link — ileride"
              : "Davet linki — elle katıl / ImportChatInvite",
        },
      });
      hedefSet.add(l.hedef);
      rapor.yeni += 1;
      // Davet/WA grup sayılır (kişi değil)
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
  const linkler = linkleriHasatEt(birlesik);
  if (linkler.length === 0) {
    return {
      bulunan: 0,
      yeni: 0,
      mevcut: 0,
      atlanan: 0,
      grup: 0,
      kisiBot: 0,
      cozulemedi: 0,
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
    });
  } catch {
    /* sayaç opsiyonel */
  }
  return rapor;
}
