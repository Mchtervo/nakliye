/**
 * Eksik / sessiz grup teşhisi — OpenAI çağrısı YOK.
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const ARANAN = ["grupajkargo", "eskisehirnakliyeciler", "guneymarmara"];

try {
  const tum = await p.ilanKaynagi.findMany({
    where: { tur: "TELEGRAM_UYE" },
    orderBy: { ad: "asc" },
  });

  const eslesen = [];
  for (const k of tum) {
    const ad = (k.ad || "").toLowerCase();
    const ku = (k.kullaniciAdi || "").toLowerCase();
    const hedef = (k.hedef || "").toLowerCase();
    for (const a of ARANAN) {
      if (ad.includes(a) || ku.includes(a) || hedef.includes(a)) {
        eslesen.push({ aranan: a, kayit: k });
      }
    }
  }

  const dun = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const grupIds = tum.map((k) => k.id);

  const [mesaj24, bekleyen, ilanlar, eleme] = await Promise.all([
    p.hamMesaj.groupBy({
      by: ["kaynakId"],
      where: { createdAt: { gte: dun }, kaynakId: { in: grupIds } },
      _count: { _all: true },
    }),
    p.hamMesaj.groupBy({
      by: ["kaynakId"],
      where: { islendi: false, kaynakId: { in: grupIds } },
      _count: { _all: true },
    }),
    p.yukIlani.groupBy({
      by: ["kaynakId"],
      where: { kaynakId: { in: grupIds } },
      _count: { _all: true },
    }),
    p.ayar.findMany({
      where: { anahtar: { startsWith: "eleme_" } },
    }),
  ]);

  const m24 = new Map(mesaj24.map((x) => [x.kaynakId, x._count._all]));
  const bek = new Map(bekleyen.map((x) => [x.kaynakId, x._count._all]));
  const ilan = new Map(ilanlar.map((x) => [x.kaynakId, x._count._all]));

  const rapor = tum.map((k) => ({
    id: k.id,
    ad: k.ad,
    kullaniciAdi: k.kullaniciAdi,
    hedef: k.hedef,
    durum: k.durum,
    aktif: k.aktif,
    sonMesajId: k.sonMesajId,
    sonTarama: k.sonTarama,
    sonHata: k.sonHata,
    mesaj24s: m24.get(k.id) ?? 0,
    bekleyen: bek.get(k.id) ?? 0,
    ilanAdedi: ilan.get(k.id) ?? 0,
  }));

  const kesifAyar = await p.ayar.findMany({
    where: {
      anahtar: {
        in: [
          "telegram_uye_son_kesif",
          "telegram_son_kesif",
          "ai_telegram_uye_son_kesif",
        ],
      },
    },
  });

  // Tüm ayar anahtarlarında kesif/uye geçenler
  const ilgiliAyar = await p.ayar.findMany({
    where: {
      OR: [
        { anahtar: { contains: "kesif" } },
        { anahtar: { contains: "uye" } },
        { anahtar: { contains: "telegram" } },
        { anahtar: { contains: "eleme" } },
      ],
    },
  });

  console.log(
    JSON.stringify(
      {
        arananUc: ARANAN,
        eslesenAdet: eslesen.length,
        eslesen: eslesen.map((e) => ({
          aranan: e.aranan,
          id: e.kayit.id,
          ad: e.kayit.ad,
          kullaniciAdi: e.kayit.kullaniciAdi,
          durum: e.kayit.durum,
          aktif: e.kayit.aktif,
          hedef: e.kayit.hedef,
        })),
        toplamTelegramKaynak: tum.length,
        gruplar: rapor,
        sessizSifirIlan: rapor.filter(
          (g) => g.durum === "AKTIF" && g.aktif && g.ilanAdedi === 0
        ),
        kesifAyar,
        ilgiliAyar: ilgiliAyar.map((a) => ({
          anahtar: a.anahtar,
          deger: String(a.deger).slice(0, 200),
        })),
        elemeSayaclari: eleme.map((a) => ({
          anahtar: a.anahtar,
          deger: a.deger,
        })),
      },
      null,
      2
    )
  );
} finally {
  await p.$disconnect();
}
