import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { katilimRedSebebi, koridorBaslikOnceligi } from "@/lib/bolgeler";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";

async function main() {
  const bugun0 = new Date(
    new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10) +
      "T00:00:00+03:00"
  );

  const [
    takip,
    aday,
    adayJoin,
    gunluk,
    sonKat,
    flood,
    oto,
    siradaki,
    enYeniAktif,
    redPasif,
    hasat,
  ] = await Promise.all([
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
        aktif: true,
        kullaniciAdi: { not: null },
      },
    }),
    ayarOku(AYAR_ANAHTARLARI.telegramKatilimGunluk),
    ayarOku(AYAR_ANAHTARLARI.telegramSonKatilim),
    ayarOku(AYAR_ANAHTARLARI.telegramFloodBitis),
    ayarOku(AYAR_ANAHTARLARI.telegramOtoKatilim),
    prisma.ilanKaynagi.findMany({
      where: {
        tur: TELEGRAM_UYE,
        durum: "ADAY",
        aktif: true,
        kullaniciAdi: { not: null },
        OR: [{ uyeSayisi: null }, { uyeSayisi: { gte: 50 } }],
      },
      orderBy: [{ oncelik: "desc" }, { uyeSayisi: "desc" }],
      take: 12,
      select: {
        id: true,
        ad: true,
        oncelik: true,
        uyeSayisi: true,
        kullaniciAdi: true,
        hasatKaynak: true,
        createdAt: true,
      },
    }),
    prisma.ilanKaynagi.findMany({
      where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, ad: true, createdAt: true, hasatKaynak: true },
    }),
    prisma.ilanKaynagi.count({
      where: {
        tur: TELEGRAM_UYE,
        durum: "PASIF",
        sonHata: { startsWith: "Katılım RED" },
      },
    }),
    prisma.ilanKaynagi.count({
      where: { tur: TELEGRAM_UYE, hasatKaynak: { not: null } },
    }),
  ]);

  console.log("=== DURUM ===");
  console.log(`Takipte (AKTIF): ${takip}`);
  console.log(`ADAY: ${aday} (joinable aktif+@: ${adayJoin})`);
  console.log(`Hasat kayıt: ${hasat}`);
  console.log(`RED→PASIF: ${redPasif}`);
  console.log(`oto_katilim: ${oto ?? "açık"}`);
  console.log(`katilim_gunluk: ${gunluk ?? "hiç yok — cron henüz katılmamış"}`);
  console.log(`son_katilim: ${sonKat ?? "yok"}`);
  console.log(`flood: ${flood ?? "yok"}`);

  if (sonKat) {
    const dk = Math.round((Date.now() - Date.parse(sonKat)) / 60000);
    console.log(`son katılımdan beri: ${dk} dk`);
  }

  console.log("\n=== SIRADAKİ ADAY (katılacak) ===");
  if (siradaki.length === 0) console.log("(boş)");
  for (const a of siradaki) {
    const red = katilimRedSebebi(a.ad);
    const kor = koridorBaslikOnceligi(a.ad);
    console.log(
      `#${a.id} onc=${a.oncelik} kor=${kor} uye=${a.uyeSayisi ?? "-"} ` +
        `@${a.kullaniciAdi} | ${a.ad.slice(0, 40)}` +
        (red ? ` RED=${red}` : "") +
        ` | ${a.hasatKaynak || "arama"}`
    );
  }

  console.log("\n=== EN YENİ AKTİF (ne zaman katıldık) ===");
  for (const a of enYeniAktif) {
    console.log(
      `#${a.id} ${a.createdAt.toISOString()} | ${a.ad.slice(0, 45)} | ${a.hasatKaynak || "-"}`
    );
  }

  const bugunAktif = enYeniAktif.filter((a) => a.createdAt >= bugun0);
  console.log(`\nBugün createdAt ile yeni AKTIF: ${bugunAktif.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
