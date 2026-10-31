import Image from "next/image";
import Link from "next/link";
import { donusTalebiKapat, eveDondum, konumuKaldir } from "@/app/ai-actions";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { aracKonumu, aracYonleri } from "@/lib/konum";
import YonSecici from "@/components/YonSecici";
import AksiyonButonu from "@/components/AksiyonButonu";
import YolculukFormu from "@/components/YolculukFormu";
import { aktifYolculuklar, ilde, yakinIller } from "@/lib/donus";
import { ilMesafesiKm } from "@/lib/ilMesafe";
import { ILLER } from "@/lib/iller";
import { tlYazKisa } from "@/lib/para";

function onceYaz(t: Date, simdi: Date): string {
  const dk = Math.max(0, Math.round((simdi.getTime() - t.getTime()) / 60000));
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dakika önce`;
  return `${Math.round(dk / 60)} saat önce`;
}

function Pin({ renk }: { renk: string }) {
  return (
    <svg viewBox="0 0 24 30" className="h-8 w-7 drop-shadow-[0_0_10px_rgba(110,130,255,0.7)]" aria-hidden>
      <path d="M12 1C6 1 1.5 5.5 1.5 11.2 1.5 19 12 29 12 29s10.5-10 10.5-17.8C22.5 5.5 18 1 12 1z" fill={renk} />
      <circle cx="12" cy="11" r="4" fill="#fff" />
    </svg>
  );
}

/**
 * Ana sayfa "Yolculuğum": yükleme → boşaltma. Boşaltılan il ve 60 km
 * çevresindeki yükler burada ve bildirimde ("Düzce'de yük bulundu").
 * Altında "Ne tarafa yük arıyorsun?" ve yeni yolculuk formu.
 */
export default async function YolculukKarti() {
  const simdi = new Date();
  const [yolculuklar, konum, tercih, yonler] = await Promise.all([
    aktifYolculuklar().catch(() => []),
    aracKonumu().catch(() => null),
    aiTercihleriOku(),
    aracYonleri().catch(() => []),
  ]);
  const ev = tercih.anaUs || "Ankara";
  const evde = konum === ev && yolculuklar.length === 0;
  return <YolculukGorunum yolculuklar={yolculuklar} konum={konum} evde={evde} yonler={yonler} simdi={simdi} />;
}

export type Yolculuk = Awaited<ReturnType<typeof aktifYolculuklar>>[number];

/** Görünüm (veri dışarıdan): yerel önizleme sayfası da örnek veriyle kullanır. */
export function YolculukGorunum({
  yolculuklar,
  konum,
  evde,
  yonler,
  simdi,
}: {
  yolculuklar: Yolculuk[];
  konum: string | null;
  evde: boolean;
  yonler: string[];
  simdi: Date;
}) {
  const yonCevreleri = Object.fromEntries(yonler.map((il) => [il, yakinIller(il).slice(1)]));

  return (
    <>
      <section id="yolculuk" className="ana-yolculuk ana-gir" style={{ animationDelay: "240ms" }} aria-labelledby="yolculuk-baslik">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13.5px] font-semibold text-[#c7cffd]">Yolculuğum</p>
          {evde ? (
            <AksiyonButonu
              calistir={konumuKaldir}
              etiket="Konumu kaldır"
              bekleyenEtiket="…"
              sinif="ana-cam-dugme shrink-0"
            />
          ) : (
            <AksiyonButonu calistir={eveDondum} etiket="Eve döndüm" bekleyenEtiket="Kaydediliyor…" sinif="ana-cam-dugme ana-ev shrink-0" />
          )}
        </div>
        <h2 id="yolculuk-baslik" className="-mt-0.5 text-[1.12rem] font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-[1.25rem]">
          {yolculuklar.length > 0 ? "Vardığın yerde yük arıyorum" : "Yolculuk nereye?"}
        </h2>

        {yolculuklar.length === 0 && (
          <p className="mt-2 text-[14px] leading-snug text-[#b8c1f5]">
            {konum ? (
              <>
                Araç <b className="text-white">{konum}</b>&apos;da · sadece {konum} ve çevresinin yükleri geliyor.
              </>
            ) : (
              "Konum yok · tüm bölgenin yükleri geliyor."
            )}{" "}
            Yola çıkınca aşağıdan <b className="text-white">Yeni yolculuk</b>’a bas; vardığın yerde yük çıkınca bildirim gelsin.
          </p>
        )}

        {yolculuklar.map((y) => {
          const cevre = yakinIller(y.cikisIl).slice(1);
          return (
            <div key={y.id} className="mt-4">
              {/* Rota: yükleme ●- - - tır - - -● boşaltma */}
              <div className="ana-rota">
                <div className="flex flex-col items-center gap-1">
                  <Pin renk="#5b8cff" />
                  <span className="text-[13.5px] font-bold text-white">{y.varis}</span>
                </div>
                <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="ana-rota-yol" aria-hidden>
                  <path d="M2 30 C 50 32, 70 8, 100 14 S 160 30, 198 10" fill="none" stroke="#8fa2ff" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" />
                </svg>
                <div className="ana-rota-tir">
                  <Image src="/ana/tir.webp" alt="" width={88} height={57} className="h-auto w-[78px]" />
                  {konum && <span className="text-[12.5px] font-semibold text-[#d5dcff]">Araç: {konum}</span>}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Pin renk="#a78bfa" />
                  <span className="text-[13.5px] font-bold text-white">{y.cikis}</span>
                </div>
              </div>

              <div className="ana-tarama">
                <span className="min-w-0 truncate">
                  {cevre.length > 0 ? `${y.cikisIl} ve 60 km çevresi taranıyor` : `${ilde(y.cikisIl)} taranıyor`}
                </span>
                <AksiyonButonu
                  calistir={donusTalebiKapat.bind(null, y.id)}
                  etiket="Aramayı durdur"
                  bekleyenEtiket="Durduruluyor…"
                  sinif="shrink-0 font-semibold text-[#a5b4fc] underline-offset-2 hover:underline"
                />
              </div>

              {y.ilanlar.length === 0 ? (
                <p className="mt-3 text-center text-[13.5px] text-[#b8c1f5]">Henüz yük yok. Çıkınca bildirim gelecek.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {y.ilanlar.map((i) => {
                    const km = i.cikisIl && i.cikisIl !== y.cikisIl ? ilMesafesiKm(y.cikisIl, i.cikisIl) : null;
                    const tutar = i.ucret ?? i.fiyatTon;
                    return (
                      <li key={i.id}>
                        <Link href={`/ai/yukler?sekme=HEPSI&id=${i.id}`} className="ana-sonuc">
                          <span className="ana-mini-ikon ana-ton-indigo !h-9 !w-9" aria-hidden>
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" opacity=".35" />
                              <path d="M12 12 3.5 7.5 12 3l8.5 4.5z" />
                            </svg>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-bold">
                              {i.nereden || i.cikisIl} → {i.nereye || "?"}
                              {km !== null && <span className="ml-1 text-[12px] font-medium text-[var(--a-ikincil)]">({km} km)</span>}
                            </span>
                            <span className="block truncate text-[11.5px] text-[var(--a-ikincil)]">
                              Uygun yük bulundu • {onceYaz(i.createdAt, simdi)}
                            </span>
                          </span>
                          {tutar !== null && (
                            <span className="shrink-0 text-[15.5px] font-extrabold tabular-nums text-[#16a34a]">
                              {tlYazKisa(tutar)}
                              {i.ucret === null ? "/t" : ""}
                            </span>
                          )}
                          <span className="ana-ok" aria-hidden>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14M13 6l6 6-6 6" />
                            </svg>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section className="ana-yon ana-gir" style={{ animationDelay: "270ms" }}>
        <YonSecici yonler={yonler} iller={ILLER} cevreler={yonCevreleri} tema="acik" />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          {yolculuklar.map((y) => (
            <YolculukFormu
              key={y.id}
              tema="acik"
              ilkAcik={false}
              iller={ILLER}
              acmaEtiketi={yolculuklar.length > 1 ? `Yük aldım (${y.cikis}) → yeni yolculuk` : "Yük aldım → yeni yolculuk"}
              varsayilanYukleme={y.cikis}
              kapatId={y.id}
            />
          ))}
          <YolculukFormu tema="acik" ilkAcik={false} iller={ILLER} acmaEtiketi="+ Yeni yolculuk" />
        </div>
      </section>
    </>
  );
}
