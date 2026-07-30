import { prisma } from "@/lib/prisma";
import { katilimRedSebebi, yukBasligiMi } from "@/lib/bolgeler";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";
import {
  KATILIM_MIN_UYE_VARSAYILAN,
  katilimMinUyeOku,
} from "@/lib/kaynaklar/katilimLimit";

export type AdayHavuzOzeti = {
  toplam: number;
  aktif: number;
  /** cron-katil'in deneyeceği (username + üye≥eşik/null + RED yok + yük başlığı) */
  katilimaUygun: number;
  red: number;
  baslikEleme: number;
  usernameYok: number;
  uyeAz: number;
  hasatli: number;
  minUye: number;
};

/**
 * ADAY havuz kırılımı — katılım kuyruğu neden ince?
 */
export async function adayHavuzOzeti(
  minUyeArg?: number
): Promise<AdayHavuzOzeti> {
  const minUye = minUyeArg ?? (await katilimMinUyeOku());
  const adaylar = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE, durum: "ADAY" },
    select: {
      ad: true,
      aktif: true,
      kullaniciAdi: true,
      uyeSayisi: true,
      hasatKaynak: true,
    },
  });

  const ozet: AdayHavuzOzeti = {
    toplam: adaylar.length,
    aktif: 0,
    katilimaUygun: 0,
    red: 0,
    baslikEleme: 0,
    usernameYok: 0,
    uyeAz: 0,
    hasatli: 0,
    minUye,
  };

  for (const a of adaylar) {
    if (a.hasatKaynak) ozet.hasatli += 1;
    if (!a.aktif) continue;
    ozet.aktif += 1;

    const red = katilimRedSebebi(a.ad);
    if (red) {
      ozet.red += 1;
      continue;
    }
    if (!yukBasligiMi(a.ad)) {
      ozet.baslikEleme += 1;
      continue;
    }
    if (!a.kullaniciAdi) {
      ozet.usernameYok += 1;
      continue;
    }
    if (a.uyeSayisi !== null && a.uyeSayisi < minUye) {
      ozet.uyeAz += 1;
      continue;
    }
    ozet.katilimaUygun += 1;
  }

  return ozet;
}

export { KATILIM_MIN_UYE_VARSAYILAN };
