import { notFound } from "next/navigation";
import KrediKartlari from "@/components/finans/KrediKartlari";
import FirmaGorunum from "@/components/kasa/FirmaGorunum";
import ParaGorunum, { type KasaSatir } from "@/components/kasa/ParaGorunum";

export const dynamic = "force-dynamic";

/**
 * YALNIZ yerel geliştirme: Kasa & Cari / firma ayrıntısı / kredi kartları
 * tasarımını ÖRNEK veriyle gösterir (?ekran=kasa|cari|ozet|firma|kart).
 * Kart ödeme paneli örnek modda kayıt yapmaz. Kasa formu, tahsilat formu,
 * kart ekleme ve sil düğmeleri gerçek işlemlere bağlıdır: basma. Üretimde 404.
 */
export default async function KasaOnizleme({ searchParams }: { searchParams: Promise<{ ekran?: string; sekme?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const ekran = sp.sekme || sp.ekran || "kasa";

  if (ekran === "firma") {
    return (
      <FirmaGorunum
        geriHref="/ana-onizleme/kasa?ekran=cari"
        v={{
          id: 990001,
          ad: "ABC Lojistik",
          telefonYazi: "0555 000 00 00",
          telHref: "tel:+905550000000",
          waHref: "https://wa.me/905550000000",
          vergiNo: null,
          ilkKayitYazi: "1 Eylül 2026",
          seferler: [
            {
              id: 990101,
              nereden: "Ankara",
              nereye: "Gebze",
              tarihYazi: "31 Ekim 2026",
              aciklama: null,
              toplam: 2_400_000,
              odenen: 1_000_000,
              odemeler: [{ id: 990201, tarihIso: "2026-10-31T10:00:00.000Z", tarihYazi: "31 Ekim 2026", tutar: 1_000_000, not: "peşinat" }],
            },
            {
              id: 990102,
              nereden: "Bursa",
              nereye: "Ankara",
              tarihYazi: "29 Ekim 2026",
              aciklama: null,
              toplam: 2_600_000,
              odenen: 1_000_000,
              odemeler: [{ id: 990202, tarihIso: "2026-10-29T10:00:00.000Z", tarihYazi: "29 Ekim 2026", tutar: 1_000_000, not: null }],
            },
            {
              id: 990103,
              nereden: "İzmir",
              nereye: "Konya",
              tarihYazi: "12 Ekim 2026",
              aciklama: null,
              toplam: 1_800_000,
              odenen: 1_800_000,
              odemeler: [{ id: 990203, tarihIso: "2026-10-14T10:00:00.000Z", tarihYazi: "14 Ekim 2026", tutar: 1_800_000, not: null }],
            },
          ],
        }}
      />
    );
  }

  if (ekran === "kart") {
    return (
      <KrediKartlari
        ornek
        kartlar={[
          {
            id: 990001,
            ad: "Örnek iş kartı",
            sonOdemeGunu: 5,
            borc: 1_800_000,
            odenen: 600_000,
            kalan: 1_200_000,
            sonOdemeIso: "2026-11-05T09:00:00.000Z",
            kalanGun: 5,
            odemeler: [{ id: 990301, tarihIso: "2026-10-30T09:00:00.000Z", tutar: 600_000 }],
          },
          {
            id: 990002,
            ad: "Örnek yakıt kartı",
            sonOdemeGunu: 20,
            borc: 500_000,
            odenen: 0,
            kalan: 500_000,
            sonOdemeIso: "2026-11-20T09:00:00.000Z",
            kalanGun: 20,
            odemeler: [],
          },
        ]}
      />
    );
  }

  // Bakiye örneği: giriş 55.000 − çıkış 20.000 = 35.000; listede son 2 hareket, kalan 25.000 "önceki bakiye"
  const hareketler: KasaSatir[] = [
    { id: 990401, tarihYazi: "31 Ekim 2026", tip: "GIRIS", tutar: 1_500_000, aciklama: "Nakit giriş" },
    { id: 990402, tarihYazi: "30 Ekim 2026", tip: "CIKIS", tutar: 500_000, aciklama: "Yakıt ödemesi" },
  ];
  const giris = 5_500_000;
  const cikis = 2_000_000;
  const gorunenNet = hareketler.reduce((t, h) => (h.tip === "GIRIS" ? t + h.tutar : t - h.tutar), 0);

  return (
    <ParaGorunum
      v={{
        sekme: ekran === "cari" || ekran === "ozet" ? ekran : "kasa",
        yol: "/ana-onizleme/kasa",
        bakiye: giris - cikis,
        giris,
        cikis,
        hareketler,
        oncekiBakiye: giris - cikis - gorunenNet,
        tumuHref: "/ana-onizleme/kasa?ekran=kasa",
        cariler: [
          { id: 990001, ad: "ABC Lojistik", anlasilan: 5_000_000, odenen: 2_000_000, kalan: 3_000_000, yukSayisi: 3, acikYuk: 2 },
          { id: 990002, ad: "Örnek Nakliyat", anlasilan: 2_000_000, odenen: 0, kalan: 2_000_000, yukSayisi: 1, acikYuk: 1 },
          { id: 990003, ad: "Örnek Taşımacılık", anlasilan: 1_500_000, odenen: 500_000, kalan: 1_000_000, yukSayisi: 1, acikYuk: 1 },
          { id: 990004, ad: "Kapalı Firma", anlasilan: 800_000, odenen: 800_000, kalan: 0, yukSayisi: 1, acikYuk: 0 },
        ],
        bugunTarih: "2026-10-31",
      }}
    />
  );
}
