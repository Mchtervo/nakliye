/**
 * Telegram peer tip kontrolü — User/Bot ≠ grup.
 * Hasat ve keşif aynı fonksiyonu kullanır.
 */
import { Api, TelegramClient, utils } from "telegram";

export type PeerTipSonuc =
  | {
      tip: "kanal" | "sohbet";
      baslik: string;
      kullaniciAdi: string | null;
      uyeSayisi: number | null;
      chatId: string;
    }
  | { tip: "kisi" | "bot" | "bilinmiyor" };

/**
 * @username → Channel/Chat mi, User/Bot mu?
 * Çözülemezse bilinmiyor (kaydetme).
 */
export async function usernamePeerTipi(
  client: TelegramClient,
  username: string
): Promise<PeerTipSonuc> {
  const user = username.replace(/^@/, "").trim();
  if (!user) return { tip: "bilinmiyor" };

  try {
    const entity = await client.getEntity(user);
    if (entity instanceof Api.User) {
      return { tip: entity.bot ? "bot" : "kisi" };
    }
    if (entity instanceof Api.Channel) {
      return {
        tip: "kanal",
        baslik: (entity.title || `@${user}`).slice(0, 120),
        kullaniciAdi: entity.username || user,
        uyeSayisi:
          typeof entity.participantsCount === "number"
            ? entity.participantsCount
            : null,
        chatId: String(utils.getPeerId(entity)),
      };
    }
    if (entity instanceof Api.Chat) {
      return {
        tip: "sohbet",
        baslik: (entity.title || `@${user}`).slice(0, 120),
        kullaniciAdi: null,
        uyeSayisi:
          typeof entity.participantsCount === "number"
            ? entity.participantsCount
            : null,
        chatId: String(utils.getPeerId(entity)),
      };
    }
    return { tip: "bilinmiyor" };
  } catch {
    return { tip: "bilinmiyor" };
  }
}

/** Api.TypeChat / entity — User ise false. */
export function entityGrupMu(entity: unknown): boolean {
  if (entity instanceof Api.Channel) return true;
  if (entity instanceof Api.Chat) return true;
  if (entity instanceof Api.User) return false;
  return false;
}
