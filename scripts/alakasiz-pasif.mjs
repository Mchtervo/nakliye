/**
 * AKTİF ama nakliye başlığı olmayan grupları PASIF'e çeker (silmez).
 * OpenAI yok.
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const TERIMLER = [
  "yuk", "nakliye", "nakliyat", "nakliyeci", "tir", "lojistik", "kamyon",
  "dorse", "borsa", "tasima", "sevkiyat", "filo", "navlun", "kamyonet",
];

function sade(m) {
  return m
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function yukBasligiMi(baslik) {
  const s = sade(baslik || "");
  return TERIMLER.some((t) => s.includes(t));
}

try {
  const aktifler = await p.ilanKaynagi.findMany({
    where: { tur: "TELEGRAM_UYE", durum: "AKTIF", aktif: true },
    select: { id: true, ad: true, kullaniciAdi: true },
  });

  const dusurulecek = aktifler.filter((g) => !yukBasligiMi(g.ad));
  for (const g of dusurulecek) {
    await p.ilanKaynagi.update({
      where: { id: g.id },
      data: {
        aktif: false,
        durum: "PASIF",
        sonHata:
          "Takip edilmiyor — başlıkta nakliye terimi yok (elle Takibe al).",
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        aktifOnce: aktifler.length,
        pasifeCekilen: dusurulecek.length,
        liste: dusurulecek.map((g) => ({
          id: g.id,
          ad: g.ad,
          kullaniciAdi: g.kullaniciAdi,
        })),
        kalanAktif: aktifler.length - dusurulecek.length,
      },
      null,
      2
    )
  );
} finally {
  await p.$disconnect();
}
