import { notFound } from "next/navigation";
import YukBulGorunum from "@/components/yuk/YukBulGorunum";
import type { IlanKartVeri } from "@/components/yuk/YukKart";

export const dynamic = "force-dynamic";

/**
 * YALNIZ yerel geliştirme: Yük bul tasarımını ÖRNEK veriyle gösterir
 * (?sekme=YENI|ILGILENIYOR|DONUS, ?detay=1 ilk ilanın detayı açık).
 * Canlı veritabanına dokunmaz; üretimde 404.
 */
export default async function YukOnizleme({ searchParams }: { searchParams: Promise<{ sekme?: string; detay?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const sekme = ["YENI", "ILGILENIYOR", "DONUS", "HEPSI"].includes(sp.sekme || "") ? sp.sekme! : "YENI";
  const simdi = new Date().getTime();
  const once = (dk: number) => new Date(simdi - dk * 60000);
  const temel = (o: Partial<IlanKartVeri> & { id: number }): IlanKartVeri => ({
    durum: "YENI",
    nereden: null,
    nereye: null,
    cikisIl: null,
    varisIl: null,
    tonaj: null,
    aracTipi: "TENTELI",
    aracTipiKod: "TENTELI",
    ucret: null,
    fiyatTon: null,
    fiyatBelirsiz: false,
    firmaAdi: null,
    telefon: "05000000000",
    gonderenUserId: null,
    guvenSkoru: 90,
    hamMetin: "Örnek ilan metni.",
    createdAt: once(8),
    sonGorulme: once(8),
    donusTalebiId: null,
    kaynakAd: "Örnek grup",
    ucretYazi: null,
    ...o,
  });
  const kar = { mesafe: "352 km", yakit: "₺6.900", hgs: "₺2.600", net: "₺8.500", tlKm: null, uyari: null, netPozitif: true };
  const gebze = temel({ id: 990001, nereden: "Gebze", nereye: "Ankara", cikisIl: "Kocaeli", varisIl: "Ankara", tonaj: 24, aracUzunluk: 13.6, ucret: 1800000, firmaAdi: "ABC Lojistik", ucretYazi: "18.000", kar, odakli: sp.detay === "1" });
  const izmit = temel({ id: 990002, nereden: "İzmit", nereye: "Ankara", cikisIl: "Kocaeli", varisIl: "Ankara", tonaj: 22, createdAt: once(32), sonGorulme: once(32), firmaAdi: "Örnek Nakliyat" });
  const ilanlar =
    sekme === "ILGILENIYOR"
      ? [
          { ...gebze, durum: "ILETISIME_GECILDI", odakli: false },
          { ...temel({ id: 990003, nereden: "Bolu", nereye: "Ankara", cikisIl: "Bolu", varisIl: "Ankara", tonaj: 22, createdAt: once(60), sonGorulme: once(60), firmaAdi: "Örnek Nakliyat" }), durum: "PAZARLIKTA" },
          { ...temel({ id: 990004, nereden: "Düzce", nereye: "Ankara", cikisIl: "Düzce", varisIl: "Ankara", tonaj: 20, ucret: 1500000, firmaAdi: "Örnek Ticaret" }), durum: "ILGILENIYOR" },
        ]
      : sekme === "DONUS"
        ? [{ ...gebze, donusTalebiId: 1 }]
        : [gebze, izmit];

  const sekmeler = [
    { kod: "YENI", ad: "Yeni", rozet: 18 },
    { kod: "ILGILENIYOR", ad: "Takip", rozet: null },
    { kod: "DONUS", ad: "Dönüş", rozet: 1 },
    { kod: "HEPSI", ad: "Hepsi", rozet: null },
  ].map((s) => ({ ...s, href: `/ana-onizleme/yuk?sekme=${s.kod}` }));

  return (
    <YukBulGorunum
      v={{
        sekme,
        nereden: sekme === "YENI" ? "Kocaeli" : "",
        nereye: sekme === "YENI" ? "Ankara" : "",
        cipler: [],
        sekmeler,
        konum: "Kocaeli",
        yonler: ["Ankara"],
        yonCevreleri: { Ankara: ["Kırıkkale"] },
        konumFiltresi: true,
        konumLink: "#",
        aracFiltreYazi: "Tenteli · ≤26t",
        yonSeciciGoster: false,
        durumSatiri: "18 yeni ilan",
        bildirimler: null,
        ilanlar,
        supheli: { sayi: 0, href: "#" },
        bosMesaj: "Şu an yeni ilan yok.",
        filtreKaldirHref: null,
        filtreOzet: null,
        yerHatasi: null,
        arsiv: { goster: false, href: "#" },
        yolculuk: sekme === "DONUS" ? { id: 990100, cikis: "Gebze", varis: "Ankara", cikisIl: "Kocaeli", cevre: ["İstanbul", "Sakarya"] } : null,
      }}
    />
  );
}
