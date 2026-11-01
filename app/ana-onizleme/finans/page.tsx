import { notFound } from "next/navigation";
import FinansOzetGorunum from "@/components/finans/FinansOzetGorunum";
import KdvGorunum from "@/components/finans/KdvGorunum";
import MuhasebeciGorunum from "@/components/finans/MuhasebeciGorunum";
import RaporGorunum from "@/components/finans/RaporGorunum";

export const dynamic = "force-dynamic";

const TL = 100;
const yol = (ekran: string) => ({
  etiket: "Ekim 2026",
  oncekiHref: `/ana-onizleme/finans?ekran=${ekran}&ay=2026-09`,
  sonrakiHref: `/ana-onizleme/finans?ekran=${ekran}&ay=2026-11`,
});

/**
 * YALNIZ yerel geliştirme: finans özeti / raporlar / KDV / muhasebeci
 * tasarımını ÖRNEK veriyle gösterir (?ekran=ozet|rapor|kdv|muhasebeci).
 * Muhasebeci paneli örnek modda hiçbir şey kaydetmez, indirmez, paylaşmaz.
 * Üretimde 404.
 */
export default async function FinansOnizleme({ searchParams }: { searchParams: Promise<{ ekran?: string; ay?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const ekran = sp.ekran || "ozet";
  const anahtar = sp.ay || "2026-10";

  if (ekran === "rapor") {
    return (
      <RaporGorunum
        v={{
          anahtar,
          donem: yol("rapor"),
          gelirNet: 200_000 * TL,
          giderNet: 120_000 * TL,
          gelirToplam: 240_000 * TL,
          giderToplam: 141_600 * TL,
          yukAdet: 9,
          giderAdet: 14,
          hesaplananKdv: 40_000 * TL,
          indirilecekKdv: 24_000 * TL,
          kategoriler: [
            { kod: "YAKIT", ad: "Yakıt", tutar: 86_400 * TL },
            { kod: "BAKIM", ad: "Bakım / Onarım", tutar: 36_000 * TL },
            { kod: "DIGER", ad: "Diğer", tutar: 19_200 * TL },
          ],
          firmalar: [
            { id: 990001, ad: "ABC Lojistik", tutar: 144_000 * TL, adet: 5 },
            { id: 990002, ad: "Örnek Nakliyat", tutar: 96_000 * TL, adet: 4 },
          ],
          excelHref: "#excel-ornek",
        }}
      />
    );
  }

  if (ekran === "kdv") {
    return (
      <KdvGorunum
        v={{
          anahtar,
          donem: yol("kdv"),
          hesaplananKdv: 40_000 * TL,
          indirilecekKdv: 24_000 * TL,
          demirbasKdv: 0,
          devredenKdv: 0,
          yukAdet: 9,
          giderAdet: 14,
          kdvsizYukAdet: 0,
          kdvsizGiderAdet: 0,
          kategoriler: [
            { kod: "YAKIT", ad: "Yakıt", kdv: 14_400 * TL, adet: 8 },
            { kod: "BAKIM", ad: "Bakım / Onarım", kdv: 6_000 * TL, adet: 3 },
            { kod: "DIGER", ad: "Diğer", kdv: 3_600 * TL, adet: 3 },
          ],
          trend: [
            { anahtar: "2026-05", etiket: "May", a: 30_000 * TL, b: 21_000 * TL },
            { anahtar: "2026-06", etiket: "Haz", a: 26_000 * TL, b: 19_000 * TL },
            { anahtar: "2026-07", etiket: "Tem", a: 34_000 * TL, b: 30_000 * TL },
            { anahtar: "2026-08", etiket: "Ağu", a: 28_000 * TL, b: 18_000 * TL },
            { anahtar: "2026-09", etiket: "Eyl", a: 32_000 * TL, b: 22_000 * TL },
            { anahtar: "2026-10", etiket: "Eki", a: 40_000 * TL, b: 24_000 * TL },
          ],
          excelHref: "#excel-ornek",
        }}
      />
    );
  }

  if (ekran === "muhasebeci") {
    return (
      <MuhasebeciGorunum
        donem={yol("muhasebeci")}
        panel={{
          ornek: true,
          baslangicTelefon: "",
          ayEtiket: "Ekim 2026",
          seciliAy: anahtar,
          fisler: [
            { id: 990301, tarihYazi: "31.10.2026", kategoriAd: "Yakıt", aciklama: null, toplamTutar: 6_000 * TL, fisResmi: "/ana/gider-fis.png", gonderildi: false },
            { id: 990302, tarihYazi: "28.10.2026", kategoriAd: "Bakım / Onarım", aciklama: "Yağ değişimi", toplamTutar: 3_600 * TL, fisResmi: "/ana/fis-kamera.png", gonderildi: false },
            { id: 990303, tarihYazi: "26.10.2026", kategoriAd: "HGS", aciklama: null, toplamTutar: 1_200 * TL, fisResmi: "/ana/k-fis-2.png", gonderildi: false },
            { id: 990304, tarihYazi: "12.10.2026", kategoriAd: "Yemek", aciklama: "Önceki gönderim", toplamTutar: 450 * TL, fisResmi: "/ana/gider-fis.png", gonderildi: true },
          ],
        }}
      />
    );
  }

  return (
    <FinansOzetGorunum
      v={{
        ayEtiket: "Ekim 2026",
        netGelir: 200_000 * TL,
        netGider: 120_000 * TL,
        sonuc: 80_000 * TL,
        gecenSonuc: 60_000 * TL,
        gelirKdvli: 240_000 * TL,
        giderKdvli: 141_600 * TL,
        aylar: [
          { anahtar: "2026-05", etiket: "May", deger: 35_000 * TL },
          { anahtar: "2026-06", etiket: "Haz", deger: 48_000 * TL },
          { anahtar: "2026-07", etiket: "Tem", deger: 52_000 * TL },
          { anahtar: "2026-08", etiket: "Ağu", deger: 45_000 * TL },
          { anahtar: "2026-09", etiket: "Eyl", deger: 60_000 * TL },
          { anahtar: "2026-10", etiket: "Eki", deger: 80_000 * TL },
        ],
        tahsil: 180_000 * TL,
        tahsilToplam: 240_000 * TL,
        alacak: 60_000 * TL,
        alacakFirma: 2,
        kasa: 35_000 * TL,
        bugune: { gelir: 1_420_000 * TL, gider: 905_000 * TL, kdv: 98_000 * TL },
        excelHref: "#excel-ornek",
        hizliAraTel: "",
        muhasebeciTel: "",
      }}
    />
  );
}
