/**
 * Durum raporu — hasat kolonları yoksa da çalışır.
 */
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { elemeSayaclariOku } from "@/lib/kaynaklar/elemeSayac";
import { grupOkumaToplu } from "@/lib/kaynaklar/grupOkumaSayac";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";

async function kolonVarMi(ad: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'IlanKaynagi' AND column_name = $1
    ) AS exists`,
    ad
  );
  return Boolean(rows[0]?.exists);
}

async function main() {
  const simdi = Date.now();
  const altiSaat = new Date(simdi - 6 * 60 * 60 * 1000);
  const yirmiDk = new Date(simdi - 20 * 60 * 1000);
  const birSaat = new Date(simdi - 60 * 60 * 1000);
  const tr = new Date(simdi + 3 * 60 * 60 * 1000);
  const bugunKey = tr.toISOString().slice(0, 10);
  const bugun0 = new Date(`${bugunKey}T00:00:00+03:00`);

  const hasHasat = await kolonVarMi("hasatKaynak");
  const hasOncelik = await kolonVarMi("oncelik");
  console.log(`kolon hasatKaynak=${hasHasat} oncelik=${hasOncelik}`);

  const [
    ham6s,
    ham1s,
    ham20dk,
    hamBugun,
    ilan6s,
    ilanBugun,
    kuyruk,
    takipte,
    aday,
    adayJoinable,
    bugunYeniAktif,
    eleme,
    gruplar,
  ] = await Promise.all([
    prisma.hamMesaj.count({ where: { createdAt: { gte: altiSaat } } }),
    prisma.hamMesaj.count({ where: { createdAt: { gte: birSaat } } }),
    prisma.hamMesaj.count({ where: { createdAt: { gte: yirmiDk } } }),
    prisma.hamMesaj.count({ where: { createdAt: { gte: bugun0 } } }),
    prisma.yukIlani.count({ where: { createdAt: { gte: altiSaat } } }),
    prisma.yukIlani.count({ where: { createdAt: { gte: bugun0 } } }),
    prisma.hamMesaj.count({ where: { islendi: false } }),
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
    prisma.ilanKaynagi.count({
      where: {
        tur: TELEGRAM_UYE,
        durum: "AKTIF",
        aktif: true,
        createdAt: { gte: bugun0 },
      },
    }),
    elemeSayaclariOku(),
    prisma.ilanKaynagi.findMany({
      where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
      select: {
        id: true,
        ad: true,
        sonTarama: true,
        sonMesajId: true,
        sonHata: true,
        createdAt: true,
      },
      orderBy: { sonTarama: "desc" },
    }),
  ]);

  // Hasat tahmini: hedef u:/inv:/wa: veya hasatKaynak
  let hasatBugun = 0;
  let hasatToplam = 0;
  if (hasHasat) {
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*)::bigint AS n FROM "IlanKaynagi"
       WHERE tur = 'TELEGRAM_UYE' AND "hasatKaynak" IS NOT NULL
         AND "createdAt" >= $1`,
      bugun0
    );
    hasatBugun = Number(r[0]?.n ?? 0);
    const t = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*)::bigint AS n FROM "IlanKaynagi"
       WHERE tur = 'TELEGRAM_UYE' AND "hasatKaynak" IS NOT NULL`
    );
    hasatToplam = Number(t[0]?.n ?? 0);
  } else {
    hasatBugun = await prisma.ilanKaynagi.count({
      where: {
        tur: TELEGRAM_UYE,
        createdAt: { gte: bugun0 },
        OR: [
          { hedef: { startsWith: "u:" } },
          { hedef: { startsWith: "inv:" } },
          { hedef: { startsWith: "wa:" } },
        ],
      },
    });
    hasatToplam = await prisma.ilanKaynagi.count({
      where: {
        tur: TELEGRAM_UYE,
        OR: [
          { hedef: { startsWith: "u:" } },
          { hedef: { startsWith: "inv:" } },
          { hedef: { startsWith: "wa:" } },
        ],
      },
    });
  }

  const adayKirilim = await prisma.ilanKaynagi.groupBy({
    by: ["aktif"],
    where: { tur: TELEGRAM_UYE, durum: "ADAY" },
    _count: { _all: true },
  });

  const okuma = await grupOkumaToplu(gruplar.map((g) => g.id));
  let cekilenToplam = 0;
  let kuyrukToplam = 0;
  let sessiz = 0;
  let aktifCeken = 0;
  for (const g of gruplar) {
    const o = okuma.get(g.id);
    const c = o?.cekilen ?? 0;
    cekilenToplam += c;
    kuyrukToplam += o?.kuyruk ?? 0;
    if (c === 0) sessiz += 1;
    else aktifCeken += 1;
  }

  const katilimGunluk = await ayarOku(AYAR_ANAHTARLARI.telegramKatilimGunluk);
  const sonKatilim = await ayarOku(AYAR_ANAHTARLARI.telegramSonKatilim);
  const flood = await ayarOku(AYAR_ANAHTARLARI.telegramFloodBitis);
  const otoKatilim = await ayarOku(AYAR_ANAHTARLARI.telegramOtoKatilim);

  const adayOrnek = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE, durum: "ADAY" },
    orderBy: [{ id: "desc" }],
    take: 15,
    select: {
      id: true,
      ad: true,
      aktif: true,
      kullaniciAdi: true,
      hedef: true,
      uyeSayisi: true,
      sonHata: true,
      createdAt: true,
    },
  });

  const sonHam = await prisma.hamMesaj.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      kaynakId: true,
      createdAt: true,
      islendi: true,
      metin: true,
    },
  });
  const sonIlan = await prisma.yukIlani.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      nereden: true,
      nereye: true,
      createdAt: true,
      kaynakId: true,
    },
  });

  // Tarama yaşı
  const taramaDk = gruplar
    .map((g) =>
      g.sonTarama ? Math.round((simdi - g.sonTarama.getTime()) / 60000) : 9999
    )
    .sort((a, b) => a - b);
  const medyanTarama =
    taramaDk.length > 0 ? taramaDk[Math.floor(taramaDk.length / 2)] : null;

  console.log("\n=== ZAMAN ===");
  console.log(`şimdi=${new Date(simdi).toISOString()} TR=${bugunKey}`);

  console.log("\n=== AKIŞ (6s / bugün) ===");
  console.log(`HamMesaj 20dk=${ham20dk} 1s=${ham1s} 6s=${ham6s} bugün=${hamBugun}`);
  console.log(`İlan     6s=${ilan6s} bugün=${ilanBugun}`);
  console.log(`Kuyruk bekleyen=${kuyruk}`);

  console.log("\n=== GRUPLAR ===");
  console.log(`Takipte=${takipte} (bugün çekilen>0: ${aktifCeken}, 0 çeken: ${sessiz})`);
  console.log(`Bugün okuma toplam: çekilen=${cekilenToplam} kuyruk=${kuyrukToplam}`);
  console.log(`sonTarama medyan=${medyanTarama}dk önce (en taze=${taramaDk[0]}dk)`);
  console.log(`ADAY toplam=${aday} joinable(aktif+@)=${adayJoinable}`);
  console.log("ADAY aktif kırılım:", JSON.stringify(adayKirilim));
  console.log(`Bugün createdAt ile yeni AKTIF=${bugunYeniAktif}`);
  console.log(
    `Hasat tahmin bugün=${hasatBugun} toplam=${hasatToplam}` +
      (hasHasat ? " (hasatKaynak kolonu)" : " (hedef u:/inv:/wa: — kolon henüz yok)")
  );

  console.log("\n=== KATILIM ===");
  console.log(`oto=${otoKatilim ?? "açık(yok)"} gunluk=${katilimGunluk} son=${sonKatilim}`);
  if (flood) {
    const f = Date.parse(flood);
    console.log(
      `flood=${flood} kilitli=${Number.isFinite(f) && Date.now() < f}`
    );
  } else console.log("flood=yok");
  if (sonKatilim) {
    console.log(
      `son katılımdan ${Math.round((simdi - Date.parse(sonKatilim)) / 60000)} dk`
    );
  }

  console.log("\n=== ELEME BUGÜN ===");
  console.log(JSON.stringify(eleme, null, 2));

  console.log("\n=== AKTİF GRUP (çekilen bugün) ===");
  const sirali = [...gruplar].sort((a, b) => {
    const ca = okuma.get(a.id)?.cekilen ?? 0;
    const cb = okuma.get(b.id)?.cekilen ?? 0;
    return cb - ca;
  });
  for (const g of sirali) {
    const o = okuma.get(g.id);
    const dk = g.sonTarama
      ? Math.round((simdi - g.sonTarama.getTime()) / 60000)
      : null;
    console.log(
      `#${g.id} cek=${o?.cekilen ?? 0} kuyruk=${o?.kuyruk ?? 0} tarama=${dk ?? "?"}dk ` +
        `${(g.ad || "").slice(0, 32)} hata=${(g.sonHata || "-").slice(0, 30)}`
    );
  }

  console.log("\n=== ADAY SON 15 ===");
  for (const a of adayOrnek) {
    const tip = a.hedef.startsWith("u:")
      ? "HASAT_U"
      : a.hedef.startsWith("inv:")
        ? "HASAT_INV"
        : a.hedef.startsWith("wa:")
          ? "HASAT_WA"
          : "DIGER";
    console.log(
      `#${a.id} ${tip} aktif=${a.aktif} @${a.kullaniciAdi || "-"} uye=${a.uyeSayisi ?? "-"} ` +
        `| ${(a.ad || "").slice(0, 28)} | ${(a.sonHata || "-").slice(0, 35)} | ${a.createdAt.toISOString()}`
    );
  }

  console.log("\n=== SON HAM ===");
  for (const h of sonHam) {
    console.log(
      `#${h.id} k=${h.kaynakId} ${h.createdAt.toISOString()} | ` +
        h.metin.replace(/\s+/g, " ").slice(0, 75)
    );
  }
  console.log("\n=== SON İLAN ===");
  for (const i of sonIlan) {
    console.log(
      `#${i.id} ${i.nereden}→${i.nereye} ${i.createdAt.toISOString()}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
