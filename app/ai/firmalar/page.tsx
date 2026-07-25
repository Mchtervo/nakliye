import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import {
  adayFirmaDurumGuncelle,
  adayFirmaSil,
  adayFirmayiCariyeEkle,
} from "@/app/ai-actions";
import AdayFirmaAra from "@/components/AdayFirmaAra";
import AksiyonButonu from "@/components/AksiyonButonu";

export const dynamic = "force-dynamic";

const SEKMELER = [
  { kod: "YENI", ad: "Yeni" },
  { kod: "ARANDI", ad: "Arandı" },
  { kod: "MUSTERI", ad: "Müşteri" },
  { kod: "HEPSI", ad: "Hepsi" },
] as const;

function whatsappLinki(telefon: string): string | null {
  const rakam = telefon.replace(/\D/g, "");
  if (rakam.length < 10) return null;
  const tam = rakam.startsWith("90") ? rakam : `90${rakam.replace(/^0/, "")}`;
  return `https://wa.me/${tam}`;
}

export default async function AdayFirmalarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string }>;
}) {
  const sp = await searchParams;
  const sekme = SEKMELER.some((s) => s.kod === sp.sekme) ? sp.sekme! : "YENI";

  const [firmalar, tercih, sayilar] = await Promise.all([
    prisma.adayFirma.findMany({
      where: sekme === "HEPSI" ? {} : { durum: sekme },
      orderBy: [{ skor: "desc" }, { createdAt: "desc" }],
      take: 80,
    }),
    aiTercihleriOku(),
    prisma.adayFirma.groupBy({ by: ["durum"], _count: true }),
  ]);

  const sayiHarita = new Map(sayilar.map((s) => [s.durum, s._count]));

  return (
    <div className="space-y-5">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Yapay zekâ
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
          Aday Firmalar
        </h1>
        <p className="mt-1 text-sm text-fog">
          Sanayi bölgelerinden çıkarılan, yük çıkarma ihtimali olan işletmeler.
        </p>
      </div>

      <div className="reveal reveal-d1">
        <AdayFirmaAra sehir={tercih.sehir} />
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-asphalt-2 p-1 reveal reveal-d2">
        {SEKMELER.map((s) => {
          const aktif = s.kod === sekme;
          const sayi = s.kod === "HEPSI" ? null : sayiHarita.get(s.kod);
          return (
            <Link
              key={s.kod}
              href={`/ai/firmalar?sekme=${s.kod}`}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors ${
                aktif ? "bg-white/10 text-amber" : "text-fog hover:text-paper"
              }`}
            >
              {s.ad}
              {sayi ? <span className="ml-1.5 text-xs text-amber">{sayi}</span> : null}
            </Link>
          );
        })}
      </div>

      {firmalar.length === 0 ? (
        <div className="bos-durum">
          Bu listede firma yok. Yukarıdan şehir yazıp arama başlat.
        </div>
      ) : (
        <div className="space-y-3">
          {firmalar.map((firma, i) => {
            const wa = firma.telefon ? whatsappLinki(firma.telefon) : null;
            return (
              <div
                key={firma.id}
                className={`kart space-y-3 p-4 sm:p-5 reveal reveal-d${Math.min(i + 1, 6)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-bold text-paper">
                        {firma.ad}
                      </span>
                      {firma.durum === "MUSTERI" && (
                        <span className="rozet rozet-odendi">Müşteri</span>
                      )}
                      {firma.durum === "ARANDI" && (
                        <span className="rounded-full border border-amber/40 bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber">
                          Arandı
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-fog">
                      {[firma.sektor, firma.ilce, firma.sehir]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {firma.adres && (
                      <div className="mt-0.5 text-xs text-fog">{firma.adres}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
                      Potansiyel
                    </div>
                    <div className="font-display text-xl font-extrabold text-amber">
                      %{firma.skor}
                    </div>
                  </div>
                </div>

                {firma.neden && (
                  <p className="rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-sm text-fog">
                    {firma.neden}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                  {firma.telefon && (
                    <a
                      href={`tel:${firma.telefon}`}
                      className="btn btn-teal !px-3 !py-1.5 text-xs"
                    >
                      Ara
                    </a>
                  )}
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-ok/35 px-2.5 py-1.5 text-xs font-semibold text-ok transition-colors hover:bg-ok/10"
                    >
                      WhatsApp
                    </a>
                  )}
                  {firma.web && (
                    <a
                      href={firma.web.startsWith("http") ? firma.web : `https://${firma.web}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-paper transition-colors hover:border-amber/40 hover:text-amber"
                    >
                      Site
                    </a>
                  )}
                  {firma.durum !== "ARANDI" && firma.durum !== "MUSTERI" && (
                    <AksiyonButonu
                      calistir={adayFirmaDurumGuncelle.bind(null, firma.id, "ARANDI")}
                      etiket="Aradım"
                      bekleyenEtiket="..."
                      sinif="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-paper hover:border-amber/40 hover:text-amber"
                    />
                  )}
                  {firma.durum !== "MUSTERI" && (
                    <AksiyonButonu
                      calistir={adayFirmayiCariyeEkle.bind(null, firma.id)}
                      etiket="Cariye ekle"
                      bekleyenEtiket="Ekleniyor..."
                      sinif="btn btn-amber !px-3 !py-1.5 text-xs"
                    />
                  )}
                  <AksiyonButonu
                    calistir={adayFirmaSil.bind(null, firma.id)}
                    etiket="Sil"
                    bekleyenEtiket="..."
                    onay={`${firma.ad} listeden silinsin mi?`}
                    sinif="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ember/90 hover:bg-ember/10"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
