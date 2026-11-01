import { notFound } from "next/navigation";
import GiderForm from "@/components/GiderForm";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import VeresiyeDefteri from "@/components/finans/VeresiyeDefteri";
import GiderlerGorunum, { type GiderSatir } from "@/components/gider/GiderlerGorunum";

export const dynamic = "force-dynamic";

/**
 * YALNIZ yerel geliştirme: Giderler / Yeni gider / Veresiye defteri tasarımını
 * ÖRNEK veriyle gösterir (?ekran=liste|yeni|veresiye). Veresiye ödeme paneli
 * örnek modda kayıt yapmaz. Yeni gider formu gerçek kayda bağlıdır: kaydetme.
 * Üretimde 404.
 */
export default async function GiderOnizleme({ searchParams }: { searchParams: Promise<{ ekran?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const ekran = (await searchParams).ekran || "liste";

  if (ekran === "yeni") {
    return (
      <div className={`ana ${anaYazi.variable}`}>
        <HareketKok>
          <GiderForm baslik="Yeni gider" altBaslik="Gider kaydı oluştur" bugunTarih="2026-10-31" veresiyeYerleri={["Örnek Akaryakıt", "Örnek Servis"]} />
        </HareketKok>
      </div>
    );
  }

  if (ekran === "veresiye") {
    return (
      <VeresiyeDefteri
        ornek
        yerler={[
          {
            yer: "Örnek Akaryakıt",
            kategori: "YAKIT",
            alinan: 2_000_000,
            odenen: 800_000,
            kalan: 1_200_000,
            hareketler: [
              { anahtar: "a1", tarihIso: "2026-10-31T09:00:00.000Z", ad: "Yakıt alımı", tutar: 600_000, odeme: false },
              { anahtar: "a2", tarihIso: "2026-10-28T09:00:00.000Z", ad: "Ödeme", tutar: 800_000, odeme: true },
              { anahtar: "a3", tarihIso: "2026-10-15T09:00:00.000Z", ad: "Yakıt alımı", tutar: 1_400_000, odeme: false },
            ],
          },
          {
            yer: "Örnek Servis",
            kategori: "BAKIM",
            alinan: 200_000,
            odenen: 0,
            kalan: 200_000,
            hareketler: [{ anahtar: "b1", tarihIso: "2026-10-20T09:00:00.000Z", ad: "Bakım alımı", tutar: 200_000, odeme: false }],
          },
        ]}
      />
    );
  }

  const satir = (id: number, gun: string, kategori: string, kategoriAd: string, alt: string, toplam: number, veresiye: boolean, ek: string | null = null): GiderSatir => ({
    id,
    gun,
    ayKisa: "Eki",
    kategori,
    kategoriAd,
    alt,
    ek,
    toplam,
    net: Math.round(toplam / 1.2),
    kdv: toplam - Math.round(toplam / 1.2),
    kdvli: true,
    veresiye,
    gonderildi: false,
    demirbas: false,
    fisResmi: null,
  });

  return (
    <GiderlerGorunum
      v={{
        ayAdi: "Ekim 2026",
        oncekiHref: "/ana-onizleme/gider",
        sonrakiHref: "/ana-onizleme/gider",
        excelHref: "#",
        toplam: 12_000_000,
        net: 10_000_000,
        kdv: 2_000_000,
        bugunKadar: 12_000_000,
        kategoriler: [
          { kod: "YAKIT", ad: "Yakıt", tutar: 7_200_000, adet: 9 },
          { kod: "BAKIM", ad: "Bakım", tutar: 3_000_000, adet: 2 },
          { kod: "DIGER", ad: "Diğer giderler", tutar: 1_800_000, adet: 4 },
        ],
        demirbas: null,
        giderler: [
          satir(990001, "31", "YAKIT", "Yakıt", "Örnek Akaryakıt", 600_000, true, "100 lt"),
          satir(990002, "28", "BAKIM", "Bakım", "Örnek Servis", 360_000, false),
        ],
      }}
    />
  );
}
