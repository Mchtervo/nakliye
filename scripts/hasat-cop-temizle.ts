/**
 * Hasat çöpü temizle: ADAY/PASIF @username kayıtlarını getEntity ile doğrula.
 * User/Bot → SİL. Channel/Chat → başlığı güncelle, ADAY tut.
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { prisma } from "@/lib/prisma";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";
import { usernamePeerTipi } from "@/lib/kaynaklar/telegramPeerTip";

async function main() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const oturum = process.env.TELEGRAM_SESSION || "";
  if (!apiId || !apiHash || !oturum) {
    throw new Error("TELEGRAM_API_ID/HASH/SESSION eksik");
  }

  const adaylar = await prisma.ilanKaynagi.findMany({
    where: {
      tur: TELEGRAM_UYE,
      durum: { in: ["ADAY", "PASIF"] },
      OR: [
        { hedef: { startsWith: "u:" } },
        { ad: { startsWith: "@" } },
        {
          AND: [
            { hasatKaynak: { startsWith: "Hasat" } },
            { kullaniciAdi: { not: null } },
          ],
        },
      ],
    },
    select: {
      id: true,
      ad: true,
      hedef: true,
      kullaniciAdi: true,
      durum: true,
      hasatKaynak: true,
    },
  });

  console.log(`kontrol edilecek: ${adaylar.length}`);

  const client = new TelegramClient(new StringSession(oturum), apiId, apiHash, {
    connectionRetries: 3,
    autoReconnect: false,
  });
  await client.connect();

  let silinen = 0;
  let grup = 0;
  let cozulemedi = 0;
  const silinenListe: string[] = [];

  try {
    for (const a of adaylar) {
      const user =
        a.kullaniciAdi ||
        (a.hedef.startsWith("u:") ? a.hedef.slice(2) : null) ||
        (a.ad.startsWith("@") ? a.ad.slice(1) : null);
      if (!user) {
        // Username yok, @ ad — şüpheli hasat; hedef u: değilse dokunma
        if (a.hedef.startsWith("u:") || a.ad.startsWith("@")) {
          await prisma.ilanKaynagi.delete({ where: { id: a.id } });
          silinen += 1;
          silinenListe.push(`#${a.id} ${a.ad} (username yok)`);
        }
        continue;
      }

      const tip = await usernamePeerTipi(client, user);
      if (tip.tip === "kisi" || tip.tip === "bot") {
        await prisma.ilanKaynagi.delete({ where: { id: a.id } });
        silinen += 1;
        silinenListe.push(`#${a.id} @${user} (${tip.tip})`);
        continue;
      }
      if (tip.tip === "bilinmiyor") {
        // Kullanıcı istedi: çözülemezse kaydetme → mevcut çöpü de sil
        await prisma.ilanKaynagi.delete({ where: { id: a.id } });
        silinen += 1;
        cozulemedi += 1;
        silinenListe.push(`#${a.id} @${user} (cozulemedi→sil)`);
        continue;
      }

      // Gerçek grup — chatId + başlık düzelt
      await prisma.ilanKaynagi.update({
        where: { id: a.id },
        data: {
          hedef: tip.chatId,
          ad: tip.baslik,
          kullaniciAdi: tip.kullaniciAdi,
          uyeSayisi: tip.uyeSayisi,
          aktif: true,
          durum: "ADAY",
          sonHata: null,
        },
      });
      grup += 1;
      // Flood nazik
      await new Promise((r) => setTimeout(r, 400));
    }
  } finally {
    try {
      await Promise.race([
        client.disconnect(),
        new Promise<void>((r) => setTimeout(r, 3000)),
      ]);
    } catch {
      /* TIMEOUT yut */
    }
  }

  console.log(
    JSON.stringify(
      { silinen, grupGuncellenen: grup, cozulemediSilinen: cozulemedi },
      null,
      2
    )
  );
  for (const s of silinenListe) console.log("  SIL", s);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
