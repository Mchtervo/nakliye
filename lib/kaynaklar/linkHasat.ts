/**
 * Grup mesajlarından t.me / @mention / WhatsApp link hasadı.
 * OpenAI yok — regex + ADAY kaydı.
 */
import { prisma } from "@/lib/prisma";
import { yukBasligiMi } from "@/lib/bolgeler";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";

export type HasatTur = "TME_USER" | "TME_INVITE" | "MENTION" | "WHATSAPP";

export type HasatLink = {
  tur: HasatTur;
  /** Dedup anahtarı → IlanKaynagi.hedef */
  hedef: string;
  /** JoinChannel için (sadece public username). */
  kullaniciAdi: string | null;
  /** Panelde görünen ad. */
  ad: string;
  /** Davet hash / WA kodu (ileride). */
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

/** t.me/xxx, t.me/+xxx, t.me/joinchat/xxx, @xxx, chat.whatsapp.com/xxx */
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

  const waRe = /(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9]+)/gi;
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

  return sonuc;
}

export type HasatRaporu = { yeni: number; mevcut: number; atlanan: number };

/**
 * Hasat edilen linkleri ADAY olarak kaydeder.
 * Nakliyeci grubundan gelenlere yüksek öncelik (oncelik=10).
 */
export async function hasatLinkleriniKaydet(
  linkler: HasatLink[],
  kaynak: { id: number; ad: string }
): Promise<HasatRaporu> {
  const rapor: HasatRaporu = { yeni: 0, mevcut: 0, atlanan: 0 };
  if (linkler.length === 0) return rapor;

  const kayitlar = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE },
    select: { id: true, hedef: true, kullaniciAdi: true, durum: true },
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

  for (const l of linkler) {
    if (hedefSet.has(l.hedef)) {
      rapor.mevcut += 1;
      continue;
    }
    if (l.kullaniciAdi && userSet.has(l.kullaniciAdi)) {
      rapor.mevcut += 1;
      continue;
    }

    // WhatsApp / invite: kaydet ama otomatik katılma (aktif=false).
    // Public username: ADAY + aktif → cron-katil öncelikli.
    const joinable = l.tur === "TME_USER" || l.tur === "MENTION";
    if (joinable && l.ad.startsWith("@") && !yukBasligiMi(l.ad)) {
      // @spam123 gibi — yine kaydet; katılırken başlık kontrolü yapılır.
      // Çok kısa / sayısal username'leri atlama.
    }

    const oncelik = joinable ? 10 : 1;

    try {
      await prisma.ilanKaynagi.create({
        data: {
          tur: TELEGRAM_UYE,
          hedef: l.hedef,
          ad: l.ad.slice(0, 120),
          aktif: joinable,
          durum: "ADAY",
          kullaniciAdi: l.kullaniciAdi,
          uyeSayisi: null,
          oncelik,
          hasatKaynak: not,
          sonHata:
            l.tur === "WHATSAPP"
              ? "WhatsApp link — ileride"
              : l.tur === "TME_INVITE"
                ? "Davet linki — elle katıl / ImportChatInvite"
                : null,
        },
      });
      hedefSet.add(l.hedef);
      if (l.kullaniciAdi) userSet.add(l.kullaniciAdi);
      rapor.yeni += 1;
    } catch {
      rapor.atlanan += 1;
    }
  }

  return rapor;
}

/** Daemon / catch-up: metinden hasat et ve kaydet. */
export async function mesajdanHasatEt(
  metin: string,
  kaynak: { id: number; ad: string }
): Promise<HasatRaporu> {
  const linkler = linkleriHasatEt(metin);
  if (linkler.length === 0) return { yeni: 0, mevcut: 0, atlanan: 0 };
  return hasatLinkleriniKaydet(linkler, kaynak);
}
