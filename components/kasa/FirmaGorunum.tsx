import Link from "next/link";
import { yukOdendiIsaretle, yukSil } from "@/app/actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import OdemeGirForm from "@/components/OdemeGirForm";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import FirmaAvatar from "@/components/kasa/FirmaAvatar";
import FirmaSekmeler from "@/components/kasa/FirmaSekmeler";
import AcilirSatir from "@/components/sefer/AcilirSatir";
import { tlYazKisa } from "@/lib/para";

export type FirmaSefer = {
  id: number;
  nereden: string;
  nereye: string;
  tarihYazi: string;
  aciklama: string | null;
  toplam: number;
  odenen: number;
  odemeler: { id: number; tarihIso: string; tarihYazi: string; tutar: number; not: string | null }[];
};

export type FirmaVeri = {
  id: number;
  ad: string;
  telefonYazi: string | null;
  telHref: string | null;
  waHref: string | null;
  vergiNo: string | null;
  ilkKayitYazi: string;
  seferler: FirmaSefer[];
};

function Rozet({ odenen, kalan }: { odenen: number; kalan: number }) {
  if (kalan <= 0) return <span className="sf-rozet bg-[#dcfce7] text-[#15803d]">Ödendi</span>;
  if (odenen > 0) return <span className="sf-rozet bg-[#fff1dc] text-[#c2410c]">● Kısmi ödendi</span>;
  return <span className="sf-rozet bg-[#eef0f8] text-[#4b5375]">Bekliyor</span>;
}

function SeferKarti({ s, firma }: { s: FirmaSefer; firma: string }) {
  const kalan = Math.max(0, s.toplam - s.odenen);
  return (
    <article className="sf-kart">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--a-ikincil)]">
            {s.tarihYazi}
            <Rozet odenen={s.odenen} kalan={kalan} />
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[16px] font-extrabold tracking-[-0.01em]">
            <svg viewBox="0 0 24 24" fill="#3b82f6" className="h-4 w-4 shrink-0" aria-hidden>
              <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
            </svg>
            <span className="truncate">
              {s.nereden} <span className="text-[#4f46e5]">→</span> {s.nereye}
            </span>
          </p>
          {s.aciklama && <p className="truncate text-[12px] text-[var(--a-ikincil)]">{s.aciklama}</p>}
        </div>
        <Link href={`/yukler/${s.id}/duzenle`} className="ana-hap shrink-0 !text-[#4338ca]">
          Düzenle
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-3 border-t border-[var(--a-cizgi)] pt-2.5">
        {(
          [
            ["Toplam", s.toplam, ""],
            ["Ödenen", s.odenen, "text-[#16a34a]"],
            ["Kalan", kalan, kalan > 0 ? "text-[#dc2626]" : "text-[#16a34a]"],
          ] as const
        ).map(([ad, kurus, renk]) => (
          <div key={ad}>
            <p className="text-[12px] text-[var(--a-ikincil)]">{ad}</p>
            <p className={`text-[15.5px] font-extrabold tabular-nums ${renk}`}>{tlYazKisa(kurus)}</p>
          </div>
        ))}
      </div>

      <AcilirSatir
        satir={
          kalan > 0 ? (
            <OdemeGirForm
              tema="acik"
              yukId={s.id}
              anlasilanKurus={s.toplam}
              odenenKurus={s.odenen}
              rota={{ nereden: s.nereden, nereye: s.nereye, firma, tarih: s.tarihYazi }}
              dugmeSinif="sf-ikincil-dugme flex-1 !min-h-11"
            />
          ) : (
            <span className="sf-ikincil-dugme flex-1 !min-h-11 !text-[#15803d]">✓ Tamamı tahsil edildi</span>
          )
        }
        icerik={
          <div className="space-y-2 rounded-2xl bg-[#f6f7fb] px-3 py-2.5">
            <p className="text-[12px] font-bold text-[var(--a-ikincil)]">Bu seferin tahsilatları</p>
            {s.odemeler.length === 0 ? (
              <p className="text-[12.5px] text-[var(--a-ikincil)]">Henüz tahsilat yok.</p>
            ) : (
              <ul className="space-y-1 text-[13px]">
                {s.odemeler.map((o) => (
                  <li key={o.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {o.tarihYazi}
                      {o.not ? ` · ${o.not}` : ""}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-[#16a34a]">{tlYazKisa(o.tutar)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {kalan > 0 && (
                <AksiyonButonu
                  calistir={yukOdendiIsaretle.bind(null, s.id)}
                  etiket="Kalanı tahsil edildi say"
                  bekleyenEtiket="…"
                  onay={`${s.nereden} → ${s.nereye}: kalan ${tlYazKisa(kalan)} tahsil edildi olarak yazılsın mı?`}
                  sinif="ana-hap"
                />
              )}
              <AksiyonButonu
                calistir={yukSil.bind(null, s.id)}
                etiket="Seferi sil"
                bekleyenEtiket="…"
                onay={`${s.nereden} → ${s.nereye} seferini silmek istediğine emin misin?`}
                sinif="ana-hap !text-[#dc2626]"
              />
            </div>
          </div>
        }
      />
    </article>
  );
}

/** Firma (cari) ayrıntısı: kalan alacak, seferler, tahsilatlar, bilgiler. */
export default function FirmaGorunum({ v, geriHref = "/para?sekme=cari" }: { v: FirmaVeri; geriHref?: string }) {
  const anlasilan = v.seferler.reduce((t, s) => t + s.toplam, 0);
  const odenen = v.seferler.reduce((t, s) => t + s.odenen, 0);
  const kalan = Math.max(0, anlasilan - odenen);
  const acik = v.seferler.filter((s) => s.toplam - s.odenen > 0);
  const kapali = v.seferler.filter((s) => s.toplam - s.odenen <= 0);
  const tahsilatlar = v.seferler
    .flatMap((s) => s.odemeler.map((o) => ({ ...o, rota: `${s.nereden} → ${s.nereye}` })))
    .sort((a, b) => b.tarihIso.localeCompare(a.tarihIso) || b.id - a.id);

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <header className="ana-ust ks-ust">
          <div className="ana-ust-zemin" aria-hidden />
          <div className="ana-ic relative">
            <Link href={geriHref} aria-label="Carilere dön" className="ana-zil ana-gir mt-3 flex h-10 w-10 items-center justify-center rounded-full text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </Link>
            <div className="ana-gir mt-3 flex items-center gap-3" style={{ animationDelay: "40ms" }}>
              <FirmaAvatar id={v.id} ad={v.ad} buyuk />
              <div className="min-w-0 flex-1 leading-tight">
                <h1 className="truncate text-[1.45rem] font-extrabold tracking-[-0.02em] text-white">{v.ad}</h1>
                <p className="text-[13px] text-[#c7cffd]">Müşteri detayları</p>
              </div>
              {v.telHref && (
                <a href={v.telHref} className="ks-iletisim" aria-label={`${v.telefonYazi} numarasını ara`}>
                  <span className="ks-iletisim-ikon bg-white text-[#2563eb]">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                      <path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
                    </svg>
                  </span>
                  Ara
                </a>
              )}
              {v.waHref && (
                <a href={v.waHref} target="_blank" rel="noopener noreferrer" className="ks-iletisim" aria-label="WhatsApp'tan yaz">
                  <span className="ks-iletisim-ikon bg-[#22c55e] text-white">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 13.6c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" />
                    </svg>
                  </span>
                  WhatsApp
                </a>
              )}
            </div>

            <div className="ana-gir mt-4" style={{ animationDelay: "70ms" }}>
              <p className="text-[15px] font-semibold text-[#dfe4ff]">Kalan alacak</p>
              <p className="text-[2.3rem] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">{tlYazKisa(kalan)}</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="ks-cip-ikon bg-white/15 text-white" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M7 3h7l4 4v14H7zM10 12h5M10 16h5" />
                    </svg>
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[12.5px] text-[#c7cffd]">Anlaşılan</span>
                    <span className="block text-[1.1rem] font-extrabold tabular-nums text-white">{tlYazKisa(anlasilan)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="ks-cip-ikon bg-[#22c55e] text-white" aria-hidden>
                    ✓
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[12.5px] text-[#c7cffd]">Tahsil</span>
                    <span className="block text-[1.1rem] font-extrabold tabular-nums text-white">{tlYazKisa(odenen)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="ana-ic relative z-10 pb-6">
          <div className="ana-gir" style={{ animationDelay: "100ms" }}>
            <FirmaSekmeler
              acikSayi={acik.length}
              kapaliSayi={kapali.length}
              acikSeferler={acik.map((s) => (
                <SeferKarti key={s.id} s={s} firma={v.ad} />
              ))}
              kapaliSeferler={kapali.map((s) => (
                <SeferKarti key={s.id} s={s} firma={v.ad} />
              ))}
              odemeler={
                <section aria-labelledby="firma-odemeler">
                  <div className="flex items-baseline justify-between px-1">
                    <h2 id="firma-odemeler" className="ana-baslik">
                      Tahsilatlar
                    </h2>
                    <span className="text-[12.5px] font-semibold text-[var(--a-ikincil)]">Toplam {tlYazKisa(odenen)}</span>
                  </div>
                  {tahsilatlar.length === 0 ? (
                    <div className="mt-2 rounded-[1.4rem] bg-white px-5 py-8 text-center text-[14.5px] text-[#3b4262] shadow-[var(--a-golge)]">Henüz tahsilat yok. Seferler sekmesinden &quot;Ödeme gir&quot;.</div>
                  ) : (
                    <ul className="mt-2 rounded-[1.4rem] bg-white px-4 shadow-[var(--a-golge)]">
                      {tahsilatlar.map((o) => (
                        <li key={o.id} className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-3 last:border-0">
                          <span className="ks-yon-ikon bg-[#dcfce7] text-[#16a34a]" aria-hidden>
                            ✓
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-semibold">{o.rota}</span>
                            <span className="block truncate text-[12px] text-[var(--a-ikincil)]">
                              {o.tarihYazi}
                              {o.not ? ` · ${o.not}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-[#16a34a]">{tlYazKisa(o.tutar)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              }
              detay={
                <dl className="divide-y divide-[var(--a-cizgi)] rounded-[1.4rem] bg-white px-4 shadow-[var(--a-golge)]">
                  {(
                    [
                      ["Firma", v.ad],
                      ["Telefon", v.telefonYazi || "Yok"],
                      ["Vergi no", v.vergiNo || "Yok"],
                      ["Sefer", `${v.seferler.length} (${acik.length} açık)`],
                      ["Cariye eklendi", v.ilkKayitYazi],
                    ] as const
                  ).map(([ad, deger]) => (
                    <div key={ad} className="flex justify-between gap-3 py-3 text-[14px]">
                      <dt className="text-[var(--a-ikincil)]">{ad}</dt>
                      <dd className="min-w-0 truncate text-right font-semibold">{deger}</dd>
                    </div>
                  ))}
                </dl>
              }
            />
          </div>
        </div>
      </HareketKok>
    </div>
  );
}
