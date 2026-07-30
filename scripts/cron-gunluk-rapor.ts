/**
 * 20:30 TR — OpenAI'siz operasyon özeti → Telegram.
 * Ağ büyütme + hasat + ADAY havuz + servis.
 */
import { execFileSync } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { telegramGonder, htmlKacis } from "@/lib/bildirim/telegram";
import {
  bugunAnahtar,
  elemeSayaclariOku,
} from "@/lib/kaynaklar/elemeSayac";
import {
  GRUP_CIKIS_GUNLUK_ANAHTAR,
  cikisGunlukOku,
} from "@/lib/kaynaklar/grupTemizlik";
import { adayHavuzOzeti } from "@/lib/kaynaklar/adayHavuz";
import { grupDurumlari, TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";
import { KATILIM_GUNLUK_LIMIT } from "@/lib/kaynaklar/katilimLimit";

function guvenliKomut(cmd: string, args: string[]): string {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      timeout: 8000,
    }).trim();
  } catch {
    return "bilinmiyor";
  }
}

function diskOzet(): string {
  try {
    const out = execFileSync("df", ["-P", "/"], { encoding: "utf8" });
    const satir = out.trim().split("\n").at(-1) || "";
    const yuzde = String(satir.split(/\s+/)[4] || "?");
    return yuzde;
  } catch {
    return "?";
  }
}

function katilimAdet(ham: string | null, gun: string): number {
  if (!ham) return 0;
  const [g, a] = ham.split(":");
  if (g !== gun) return 0;
  const n = Number(a);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const gun = bugunAnahtar();
  const bas = new Date(`${gun}T00:00:00+03:00`);

  const [
    eleme,
    hamBugun,
    hamBekleyen,
    ilanBugun,
    aktifGrup,
    adayGrup,
    bulunanBugun,
    hasatKayitBugun,
    katilimHam,
    cikisHam,
    aiKesilme,
    aiCagriBugun,
    aiKesilmeMaliyet,
    gruplar,
    havuz,
  ] = await Promise.all([
    elemeSayaclariOku(gun),
    prisma.hamMesaj.count({ where: { createdAt: { gte: bas } } }),
    prisma.hamMesaj.count({ where: { islendi: false } }),
    prisma.yukIlani.count({ where: { createdAt: { gte: bas } } }),
    prisma.ilanKaynagi.count({
      where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
    }),
    prisma.ilanKaynagi.count({
      where: { tur: TELEGRAM_UYE, durum: "ADAY" },
    }),
    prisma.ilanKaynagi.count({
      where: {
        tur: TELEGRAM_UYE,
        durum: "ADAY",
        createdAt: { gte: bas },
      },
    }),
    prisma.ilanKaynagi.count({
      where: {
        tur: TELEGRAM_UYE,
        hasatKaynak: { not: null },
        createdAt: { gte: bas },
      },
    }),
    ayarOku(AYAR_ANAHTARLARI.telegramKatilimGunluk),
    prisma.ayar.findUnique({ where: { anahtar: GRUP_CIKIS_GUNLUK_ANAHTAR } }),
    prisma.aiCagri.count({
      where: { zaman: { gte: bas }, hata: { startsWith: "KESILDI" } },
    }),
    prisma.aiCagri.count({ where: { zaman: { gte: bas } } }),
    prisma.aiCagri.aggregate({
      where: { zaman: { gte: bas }, hata: { startsWith: "KESILDI" } },
      _sum: { maliyetMikro: true },
    }),
    grupDurumlari(),
    adayHavuzOzeti(),
  ]);

  const katilan = katilimAdet(katilimHam, gun);
  const cikilan = cikisGunlukOku(cikisHam?.deger ?? null).adet;
  const hasatLink = eleme.HASAT_LINK ?? 0;
  const hasatYeni = eleme.HASAT_YENI ?? hasatKayitBugun;
  const hasatMevcut = eleme.HASAT_MEVCUT ?? 0;

  const takip = gruplar.filter((g) => g.durum === "AKTIF" && g.aktif);
  const enVerimli = [...takip].sort(
    (a, b) => b.ilanHafta - a.ilanHafta || b.ilanAdedi - a.ilanAdedi
  )[0];
  const enKotuler = takip
    .filter((g) => g.koridorIsabet !== null && g.mesajHafta >= 5)
    .sort(
      (a, b) =>
        (a.koridorIsabet ?? 999) - (b.koridorIsabet ?? 999) ||
        b.mesajHafta - a.mesajHafta
    );
  const enKotu = enKotuler[0];

  const elemeSatir =
    Object.keys(eleme).length === 0
      ? "eleme yok"
      : Object.entries(eleme)
          .filter(([k]) => !k.startsWith("HASAT_"))
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ") || "eleme yok";

  const pm2Pid = guvenliKomut("pm2", ["pid", "yukavci"]).split(/\s+/)[0];
  const pm2Ok = /^[0-9]+$/.test(pm2Pid) && Number(pm2Pid) > 0;
  const tg = guvenliKomut("systemctl", ["is-active", "yukavci-telegram"]);
  const disk = diskOzet();

  const agSatir =
    `Ağ: Bulunan ${bulunanBugun} · Katılınan ${katilan} (${katilan}/${KATILIM_GUNLUK_LIMIT}) · Çıkılan ${cikilan}` +
    `\nHasat: ${hasatLink} link tarandı · ${hasatYeni} yeni ADAY · ${hasatMevcut} zaten vardı` +
    `\nADAY havuz: ${havuz.toplam} · katılıma uygun ${havuz.katilimaUygun}` +
    ` · RED ${havuz.red} · başlık elendi ${havuz.baslikEleme}` +
    ` · @yok ${havuz.usernameYok} · üye az ${havuz.uyeAz}` +
    `\nTakipte: ${aktifGrup}` +
    (enVerimli
      ? ` · En verimli: ${htmlKacis(enVerimli.ad)} (${enVerimli.ilanHafta} ilan/7g)`
      : "") +
    (enKotu && enKotu.koridorIsabet !== null
      ? ` · En kötü: ${htmlKacis(enKotu.ad)} (%${enKotu.koridorIsabet})`
      : "");

  const metin = [
    `<b>Yük Avcısı — günlük rapor</b> (${htmlKacis(gun)})`,
    agSatir,
    `Ham mesaj bugün: ${hamBugun}`,
    `Kuyruk bekleyen: ${hamBekleyen}`,
    `İlan bugün: ${ilanBugun}`,
    `Grup AKTİF / ADAY: ${aktifGrup} / ${adayGrup}`,
    `Ön filtre: ${htmlKacis(elemeSatir)}`,
    `AI çağrı bugün: ${aiCagriBugun} · kesilme: ${aiKesilme}` +
      (aiKesilme > 0
        ? ` · israf ~$${((aiKesilmeMaliyet._sum.maliyetMikro ?? 0) / 1e6).toFixed(3)}`
        : ""),
    `pm2 yukavci: ${pm2Ok ? `online pid ${pm2Pid}` : "SORUN"}`,
    `daemon: ${htmlKacis(tg)}`,
    `disk / : ${htmlKacis(disk)}`,
  ].join("\n");

  const chatId = await ayarOku(AYAR_ANAHTARLARI.telegramChatId);
  if (!chatId) {
    console.log(metin.replace(/<[^>]+>/g, ""));
    console.warn("[cron-gunluk-rapor] telegram_chat_id yok — sadece log");
    return;
  }

  const sonuc = await telegramGonder(chatId, metin);
  if (!sonuc.basarili) throw new Error(sonuc.hata || "telegram hata");
  console.log("[cron-gunluk-rapor] gönderildi");

  try {
    const { bildirimHataOzetiGonder } = await import("@/lib/bildirim/gonder");
    const h = await bildirimHataOzetiGonder();
    if (h.gonderildi) {
      console.log(`[cron-gunluk-rapor] bildirim hata özeti: ${h.adet}`);
    }
  } catch (e) {
    console.warn(
      "[cron-gunluk-rapor] bildirim hata özeti",
      e instanceof Error ? e.message : e
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
