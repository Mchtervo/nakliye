import { notFound } from "next/navigation";
import AnaSayfaGorunum from "@/components/ana/AnaSayfaGorunum";
import { YaklasanlarGorunum } from "@/components/Yaklasanlar";
import { YolculukGorunum, type Yolculuk } from "@/components/YolculukKarti";

export const dynamic = "force-dynamic";

/**
 * YALNIZ yerel geliştirme: ana sayfa tasarımını ÖRNEK veriyle gösterir
 * (koşullu bölümler dahil). Canlı veritabanına dokunmaz; üretimde 404.
 */
export default function AnaOnizleme() {
  if (process.env.NODE_ENV === "production") notFound();
  const simdi = new Date();
  const ay = (anahtar: string, etiket: string, netBin: number, gelir: number, yakit: number, kredi: number, kart: number, diger: number) => ({
    anahtar,
    etiket,
    net: netBin * 100000,
    gelir: gelir * 100,
    yakit: yakit * 100,
    kredi: kredi * 100,
    kart: kart * 100,
    diger: diger * 100,
  });
  const aylar = [
    ay("2026-5", "mayıs", 35, 0, 0, 0, 0, 0),
    ay("2026-6", "haziran", 48, 0, 0, 0, 0, 0),
    ay("2026-7", "temmuz", 52, 0, 0, 0, 0, 0),
    ay("2026-8", "ağustos", 45, 0, 0, 0, 0, 0),
    ay("2026-9", "eylül", 60, 0, 0, 0, 0, 0),
    ay("2026-10", "ekim", 80, 240000, 90000, 25000, 15000, 30000),
  ];
  const once = (dk: number) => new Date(simdi.getTime() - dk * 60000);
  const yolculuk = {
    id: 999001,
    varis: "Ankara",
    cikis: "Gebze",
    cikisIl: "Kocaeli",
    varisIl: "Ankara",
    ilanlar: [{ id: 999101, nereden: "Gebze", nereye: "Ankara", cikisIl: "Kocaeli", ucret: 1800000, fiyatTon: null, createdAt: once(10) }],
  } as unknown as Yolculuk;

  return (
    <AnaSayfaGorunum
      selam="Günaydın"
      ayAdi="ekim 2026"
      aylar={aylar}
      kisayollar={[
        { href: "/ai/yukler", ad: "Yük bul", alt: "18 yeni", ikon: "/ana/k-yukbul-2.png", nokta: true },
        { href: "/yukler/yeni", ad: "Sefer yaz", ikon: "/ana/k-sefer-2.png" },
        { href: "/giderler/yeni", ad: "Fiş çek", ikon: "/ana/k-fis-2.png" },
        { href: "/para", ad: "Kasa", alt: "₺35.000", ikon: "/ana/k-kasa-2.png" },
      ]}
      yaklasanlar={
        <YaklasanlarGorunum
          satirlar={[
            { anahtar: "k", href: "#", baslik: "Kart ödemesi", deger: "₺12.000", ek: "5 gün", acil: false, tur: "kart" },
            { anahtar: "b", href: "#", baslik: "Muayene", deger: "20 gün", acil: false, tur: "belge" },
            { anahtar: "m", href: "#", baslik: "Bakım", deger: "1.400 km", acil: false, tur: "bakim" },
            { anahtar: "v", href: "#", baslik: "Veresiye", deger: "₺14.000", acil: false, tur: "veresiye" },
          ]}
        />
      }
      yolculuk={<YolculukGorunum yolculuklar={[yolculuk]} konum="Kocaeli" evde={false} yonler={["Ankara", "Bolu"]} simdi={simdi} />}
      hareketler={[
        { anahtar: "1", href: "#", baslik: "Ankara → Gebze", alt: "ABC Lojistik", tarih: "31 Ekim", tutar: 2400000, gelir: true, durum: "KISMI", kategori: null },
        { anahtar: "2", href: "#", baslik: "Yakıt", alt: "Örnek Akaryakıt", tarih: "31 Ekim", tutar: 600000, gelir: false, durum: null, kategori: "YAKIT" },
        { anahtar: "3", href: "#", baslik: "Bursa → Ankara", alt: "Örnek Nakliyat", tarih: "29 Ekim", tutar: 1800000, gelir: true, durum: "ODENDI", kategori: null },
        { anahtar: "4", href: "#", baslik: "Kredi taksiti", alt: "Araç kredisi", tarih: "28 Ekim", tutar: 500000, gelir: false, durum: null, kategori: "KREDI_ODEME" },
        { anahtar: "5", href: "#", baslik: "Bakım", alt: "Örnek Servis", tarih: "27 Ekim", tutar: 360000, gelir: false, durum: null, kategori: "BAKIM" },
        { anahtar: "6", href: "#", baslik: "Bolu → Ankara", alt: "Örnek Taşımacılık", tarih: "26 Ekim", tutar: 1200000, gelir: true, durum: "BEKLIYOR", kategori: null },
      ]}
      alacaklar={[
        { id: 1, ad: "ABC Lojistik", kalan: 3000000, telefon: "05000000001" },
        { id: 2, ad: "Örnek Nakliyat", kalan: 2000000, telefon: "05000000002" },
        { id: 3, ad: "Örnek Taşımacılık", kalan: 1000000, telefon: "05000000003" },
        { id: 4, ad: "Örnek Ticaret", kalan: 500000, telefon: "05000000004" },
      ]}
      acikAnahtar={null}
    />
  );
}
