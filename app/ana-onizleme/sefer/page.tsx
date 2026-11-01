import { notFound } from "next/navigation";
import YukForm from "@/components/YukForm";
import { anaYazi } from "@/components/ana/yazi";
import PlanGorunum from "@/components/sefer/PlanGorunum";
import SeferlerGorunum from "@/components/sefer/SeferlerGorunum";
import type { PlanAdayIlan, SeferPlani } from "@/lib/seferPlan";

export const dynamic = "force-dynamic";

/**
 * YALNIZ yerel geliştirme: Seferler / Yeni sefer / Tur planı tasarımını ÖRNEK
 * veriyle gösterir (?ekran=liste|yeni|plan). Tahsilat: listede "Ödeme gir".
 * Listede kayıt düğmelerine basma: örnek kimlikler gerçek kayıtla eşleşmez,
 * ama Yeni sefer formu gerçek kayıt fonksiyonuna bağlıdır. Üretimde 404.
 */
export default async function SeferOnizleme({ searchParams }: { searchParams: Promise<{ ekran?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const ekran = (await searchParams).ekran || "liste";

  if (ekran === "yeni") {
    return (
      <div className={`ana ${anaYazi.variable}`}>
        <YukForm
          baslik="Yeni sefer"
          altBaslik="Sefer bilgilerini gir"
          firmalar={[
            { id: 990001, ad: "ABC Lojistik" },
            { id: 990002, ad: "Örnek Nakliyat" },
          ]}
          bugunTarih="2026-10-31"
          hazir={{ nereden: "Ankara", nereye: "Gebze", firmaAdi: "ABC Lojistik", tutarYazi: "20.000" }}
        />
      </div>
    );
  }

  if (ekran === "plan") {
    const ilan = (id: number, nereden: string, nereye: string, ucret: number, firmaAdi: string): PlanAdayIlan => ({
      id,
      nereden,
      nereye,
      cikisIl: nereden,
      varisIl: nereye,
      ucret,
      fiyatTon: null,
      tonaj: 24,
      firmaAdi,
      telefon: null,
      gonderenUserId: null,
      guvenSkoru: 90,
      yuklemeTarihi: null,
      createdAt: new Date(),
    });
    const plan: SeferPlani = {
      ayaklar: [
        { ilan: ilan(990201, "Ankara", "Gebze", 2000000, "ABC Lojistik"), bosKm: 0, yukluKm: 450, gun: 1 },
        { ilan: ilan(990202, "Gebze", "Bursa", 1500000, "Örnek Nakliyat"), bosKm: 0, yukluKm: 340, gun: 2 },
        { ilan: ilan(990203, "Bursa", "Ankara", 1600000, "Örnek Ticaret"), bosKm: 80, yukluKm: 310, gun: 3 },
      ],
      toplamUcret: 5100000,
      toplamKm: 1180,
      bosKm: 80,
      netTahmini: 1800000,
    };
    return <PlanGorunum neredeHam="Ankara" baslangic="Ankara" gun={3} planlar={[plan, { ...plan, netTahmini: 1500000 }]} />;
  }

  const sefer = (id: number, nereden: string, nereye: string, firma: string, gun: number, toplam: number, odenen: number) => ({
    id,
    nereden,
    nereye,
    firma,
    tarihKisa: `${gun} Ekim`,
    tarihUzun: `${gun} Ekim 2026`,
    aciklama: null,
    toplam: toplam * 100,
    odenen: odenen * 100,
    net: Math.round((toplam / 1.2) * 100),
    kdv: Math.round((toplam - toplam / 1.2) * 100),
    kdvli: true,
  });
  return (
    <SeferlerGorunum
      v={{
        ayAdi: "ekim 2026",
        oncekiHref: "#",
        sonrakiHref: "#",
        excelHref: "#",
        toplam: 24000000,
        tahsil: 18000000,
        kalan: 6000000,
        net: 20000000,
        kdv: 4000000,
        bugunKadar: 98000000,
        seferler: [
          sefer(990101, "Ankara", "Gebze", "ABC Lojistik", 31, 24000, 10000),
          sefer(990102, "Bursa", "Ankara", "Örnek Nakliyat", 29, 18000, 18000),
          sefer(990103, "İzmir", "Ankara", "Örnek Taşımacılık", 26, 22000, 0),
        ],
      }}
    />
  );
}
