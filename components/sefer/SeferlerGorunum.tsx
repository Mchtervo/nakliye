import Image from "next/image";
import Link from "next/link";
import { yukOdendiIsaretle, yukSil } from "@/app/actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import BildirimZili from "@/components/BildirimZili";
import OdemeGirForm from "@/components/OdemeGirForm";
import AcilirSatir from "@/components/sefer/AcilirSatir";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import { tlYazKisa } from "@/lib/para";

export type SeferSatir = {
  id: number;
  nereden: string;
  nereye: string;
  firma: string;
  tarihKisa: string;
  tarihUzun: string;
  aciklama: string | null;
  /** Hangi tır / şoför (tek araçta boş) */
  arac?: string | null;
  /** Müşteri telefonu varsa "Ara" bağlantısı (tel:) */
  telHref?: string | null;
  toplam: number;
  odenen: number;
  net: number;
  kdv: number;
  kdvli: boolean;
};

export type SeferlerVeri = {
  ayAdi: string;
  oncekiHref: string;
  sonrakiHref: string;
  excelHref: string;
  toplam: number;
  tahsil: number;
  kalan: number;
  net: number;
  kdv: number;
  bugunKadar: number;
  seferler: SeferSatir[];
};

function Rozet({ odenen, kalan }: { odenen: number; kalan: number }) {
  if (kalan <= 0) return <span className="sf-rozet bg-[#dcfce7] text-[#15803d]">Ödendi</span>;
  if (odenen > 0) return <span className="sf-rozet bg-[#fff1dc] text-[#c2410c]">Kısmi</span>;
  return <span className="sf-rozet bg-[#eef0f8] text-[#4b5375]">Bekliyor</span>;
}

/** Seferler sayfası görünümü (veri dışarıdan; yerel önizleme örnek veriyle kullanır). */
export default function SeferlerGorunum({ v }: { v: SeferlerVeri }) {
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <header className="ana-ust sf-liste-ust">
          <div className="ana-ust-zemin" aria-hidden />
          <div className="ana-ic relative">
            <div className="ana-gir flex items-center justify-between gap-3 pt-3">
              <div className="flex min-w-0 items-center gap-2">
                <Image src="/ana/logo-2.png" alt="" width={40} height={36} className="h-9 w-10 shrink-0" />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-white">Nakliye Defteri</p>
                  <p className="text-[12px] font-semibold text-[#9fb0ff]">Yük Avcısı</p>
                </div>
              </div>
              <BildirimZili tema="cam" />
            </div>

            <div className="relative mt-3 min-h-[8.8rem]">
              <div className="ana-gir relative z-10" style={{ animationDelay: "40ms" }}>
                <div className="flex items-center gap-1 text-[14px] font-semibold text-[#c7cffd]">
                  <Link href={v.oncekiHref} aria-label="Önceki ay" className="sf-ay-ok">
                    ‹
                  </Link>
                  <span className="min-w-[6.5rem] text-center capitalize">{v.ayAdi}</span>
                  <Link href={v.sonrakiHref} aria-label="Sonraki ay" className="sf-ay-ok">
                    ›
                  </Link>
                </div>
                <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-[-0.03em] text-white">Seferler</h1>
              </div>
              <Image src="/ana/tir.webp" alt="" width={300} height={194} className="sf-liste-tir" priority />
            </div>

            <div className="sf-ozet ana-gir" style={{ animationDelay: "80ms" }}>
              <p className="text-[13px] text-[#c7cffd]">Toplam</p>
              <p className="text-[2.1rem] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">{tlYazKisa(v.toplam)}</p>
              <div className="mt-3 grid grid-cols-2 border-t border-white/15 pt-2.5">
                <div>
                  <p className="text-[12.5px] text-[#c7cffd]">Tahsil</p>
                  <p className="text-[1.25rem] font-extrabold tabular-nums text-[#4ade80]">{tlYazKisa(v.tahsil)}</p>
                </div>
                <div className="border-l border-white/15 pl-4">
                  <p className="text-[12.5px] text-[#c7cffd]">Alacak</p>
                  <p className="text-[1.25rem] font-extrabold tabular-nums text-[#fb923c]">{tlYazKisa(v.kalan)}</p>
                </div>
              </div>
              <p className="mt-2 text-[11.5px] text-[#aab4ee]">
                Net {tlYazKisa(v.net)} · KDV {tlYazKisa(v.kdv)} · Bugüne kadar {tlYazKisa(v.bugunKadar)}
              </p>
            </div>
          </div>
        </header>

        <div className="ana-ic relative z-10">
          <div className="ana-gir -mt-7 grid grid-cols-[1.4fr_1fr] gap-2.5" style={{ animationDelay: "120ms" }}>
            <Link href="/yukler/yeni" className="ana-ana-dugme !min-h-12 gap-2 !text-[15px]">
              <span className="text-[1.3rem] leading-none" aria-hidden>
                +
              </span>
              Yeni sefer
            </Link>
            <a href={v.excelHref} className="sf-beyaz-dugme">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-[#4f46e5]" aria-hidden>
                <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 13h5M10 17h3" />
              </svg>
              Excel
            </a>
          </div>

          <div className="mt-5 flex items-baseline justify-between px-1">
            <h2 className="ana-baslik">Seferlerim</h2>
            <span className="text-[12.5px] font-semibold text-[var(--a-ikincil)]">{v.seferler.length} sefer</span>
          </div>

          {v.seferler.length === 0 ? (
            <div className="mt-3 rounded-[1.4rem] bg-white px-5 py-8 text-center text-[14.5px] text-[#3b4262] shadow-[var(--a-golge)]">
              <span className="capitalize">{v.ayAdi}</span> ayında sefer yok. &quot;Yeni sefer&quot; ile ekle ya da başka ay seç.
            </div>
          ) : (
            <div className="mt-3 space-y-3 pb-6">
              {v.seferler.map((s, i) => {
                const kalan = Math.max(0, s.toplam - s.odenen);
                return (
                  <article key={s.id} className="sf-kart ana-gir" style={{ animationDelay: `${Math.min(160 + i * 40, 360)}ms` }}>
                    <div className="flex items-start gap-3">
                      <span className="yuk-ikon !h-11 !w-11" aria-hidden>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M2 7.5A1.5 1.5 0 0 1 3.5 6h9A1.5 1.5 0 0 1 14 7.5V16H2z" />
                          <path d="M14 10h3.6a1.5 1.5 0 0 1 1.2.6l2.2 2.9V16h-7z" opacity=".85" />
                          <circle cx="6" cy="17" r="2" fill="#fff" />
                          <circle cx="17.5" cy="17" r="2" fill="#fff" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-[16px] font-extrabold tracking-[-0.01em]">
                            {s.nereden} <span className="text-[#8a90ad]">→</span> {s.nereye}
                          </p>
                          <Rozet odenen={s.odenen} kalan={kalan} />
                        </div>
                        <p className="truncate text-[12.5px] text-[var(--a-ikincil)]">
                          {s.firma} • {s.tarihKisa}
                          {s.arac ? ` • ${s.arac}` : ""}
                          {s.aciklama ? ` • ${s.aciklama}` : ""}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-3 space-y-1 border-t border-[var(--a-cizgi)] pt-2.5 text-[13.5px]">
                      <div className="flex justify-between">
                        <dt className="text-[#3b4262]">Toplam</dt>
                        <dd className="font-bold tabular-nums">{tlYazKisa(s.toplam)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#3b4262]">Ödenen</dt>
                        <dd className="font-bold tabular-nums text-[#16a34a]">{tlYazKisa(s.odenen)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#3b4262]">Kalan</dt>
                        <dd className={`font-bold tabular-nums ${kalan > 0 ? "text-[#ea580c]" : "text-[#16a34a]"}`}>{tlYazKisa(kalan)}</dd>
                      </div>
                    </dl>

                    <AcilirSatir
                      satir={
                        <>
                        {kalan > 0 ? (
                          <OdemeGirForm
                            tema="acik"
                            yukId={s.id}
                            anlasilanKurus={s.toplam}
                            odenenKurus={s.odenen}
                            rota={{ nereden: s.nereden, nereye: s.nereye, firma: s.firma, tarih: s.tarihUzun }}
                            dugmeSinif="ana-ana-dugme !min-h-10 flex-1 gap-1.5 !text-[14px]"
                          />
                        ) : (
                          <span className="sf-ikincil-dugme flex-1">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                              <path d="M5 12l5 5 9-10" />
                            </svg>
                            Tamamı tahsil edildi
                          </span>
                        )}
                        {s.telHref && (
                          <a href={s.telHref} className="sf-ikincil-dugme flex-1" aria-label={`${s.firma} firmasını ara`}>
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                              <path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
                            </svg>
                            Ara
                          </a>
                        )}
                        <Link href={`/yukler/${s.id}/duzenle`} className="sf-ikincil-dugme flex-1">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                            <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
                          </svg>
                          Düzenle
                        </Link>
                        </>
                      }
                      icerik={
                      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#f6f7fb] px-3 py-2.5">
                        <p className="w-full text-[12px] text-[var(--a-ikincil)]">
                          {s.kdvli ? `Net ${tlYazKisa(s.net)} + KDV ${tlYazKisa(s.kdv)}` : "KDV'siz iş"}
                        </p>
                        {kalan > 0 && (
                          <AksiyonButonu calistir={yukOdendiIsaretle.bind(null, s.id)} etiket="Kalanı kapat" bekleyenEtiket="…" sinif="ana-hap" />
                        )}
                        <AksiyonButonu
                          calistir={yukSil.bind(null, s.id)}
                          etiket="Sil"
                          bekleyenEtiket="…"
                          onay={`${s.nereden} → ${s.nereye} seferini silmek istediğine emin misin?`}
                          sinif="ana-hap !text-[#dc2626]"
                        />
                      </div>
                    }
                    />
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </HareketKok>
    </div>
  );
}
