import Image from "next/image";
import Link from "next/link";
import { kasaHareketSil } from "@/app/actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import BildirimZili from "@/components/BildirimZili";
import KasaForm from "@/components/KasaForm";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import KayitBildirimi from "@/components/gider/KayitBildirimi";
import CariListe, { type CariSatir } from "@/components/kasa/CariListe";
import FirmaAvatar from "@/components/kasa/FirmaAvatar";
import ParaSekmeler from "@/components/kasa/ParaSekmeler";
import AcilirSatir from "@/components/sefer/AcilirSatir";
import { tlYazKisa } from "@/lib/para";

export type KasaSatir = { id: number; tarihYazi: string; tip: string; tutar: number; aciklama: string | null };

export type ParaVeri = {
  sekme: "ozet" | "kasa" | "cari";
  /** Sekme bağlantılarının yolu (önizlemede farklı) */
  yol?: string;
  bakiye: number;
  giris: number;
  cikis: number;
  hareketler: KasaSatir[];
  /** Listede görünmeyen eski hareketlerin toplamı (yoksa null) */
  oncekiBakiye: number | null;
  /** Gösterilmeyen hareket varsa "Tümü" bağlantısı */
  tumuHref: string | null;
  cariler: CariSatir[];
  bugunTarih: string;
  kaydedildi?: boolean;
};

function KasaSatirOge({ h }: { h: KasaSatir }) {
  const giris = h.tip === "GIRIS";
  return (
    <AcilirSatir
      satir={
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className={`ks-yon-ikon ${giris ? "bg-[#dcfce7] text-[#16a34a]" : "bg-[#fee2e2] text-[#dc2626]"}`} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d={giris ? "M12 19V5M5 12l7-7 7 7" : "M12 5v14M5 12l7 7 7-7"} />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] text-[var(--a-ikincil)]">{h.tarihYazi}</span>
            <span className="block truncate text-[14.5px] font-semibold">{h.aciklama || (giris ? "Nakit giriş" : "Nakit çıkış")}</span>
          </span>
          <span className={`shrink-0 text-[15.5px] font-extrabold tabular-nums ${giris ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
            {giris ? "+" : "−"}
            {tlYazKisa(h.tutar)}
          </span>
        </div>
      }
      icerik={
        <div className="flex items-center justify-end gap-2 rounded-2xl bg-[#f6f7fb] px-3 py-2">
          <AksiyonButonu
            calistir={kasaHareketSil.bind(null, h.id)}
            etiket="Sil"
            bekleyenEtiket="…"
            onay="Bu kasa hareketini silmek istediğine emin misin?"
            sinif="ana-hap !text-[#dc2626]"
          />
        </div>
      }
    />
  );
}

/** Kasa & Cari sayfası görünümü (veri dışarıdan; yerel önizleme örnek veriyle kullanır). */
export default function ParaGorunum({ v }: { v: ParaVeri }) {
  const yol = v.yol ?? "/para";
  const cari = v.sekme === "cari";
  const toplamAlacak = v.cariler.reduce((t, c) => t + c.kalan, 0);
  const borcluFirma = v.cariler.filter((c) => c.kalan > 0).length;

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        {v.kaydedildi && <KayitBildirimi metin="Kasa hareketi kaydedildi" />}
        <header className="ana-ust ks-ust">
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

            <div className="relative mt-3">
              <div className="ana-gir relative z-10 max-w-[66%]" style={{ animationDelay: "40ms" }}>
                <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-white">{cari ? "Cari hesaplar" : "Kasa & Cari"}</h1>
                <p className="text-[13.5px] text-[#c7cffd]">{cari ? "Müşterilerinin açık hesapları" : "Nakit hareketlerini takip et"}</p>
                <p className="mt-3 text-[15px] font-semibold text-[#dfe4ff]">{cari ? "Alacağım" : "Kasada"}</p>
                <p className={`text-[2.3rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums ${!cari && v.bakiye < 0 ? "text-[#fca5a5]" : "text-white"}`}>
                  {tlYazKisa(cari ? toplamAlacak : v.bakiye)}
                </p>
                <p className="mt-1.5 text-[13px] text-[#c7cffd]">
                  {cari ? (
                    borcluFirma > 0 ? `${borcluFirma} firmada` : "Açık alacak yok"
                  ) : (
                    <>
                      Giriş <b className="text-white tabular-nums">{tlYazKisa(v.giris)}</b> • Çıkış <b className="text-white tabular-nums">{tlYazKisa(v.cikis)}</b>
                    </>
                  )}
                </p>
              </div>
              <Image src={cari ? "/ana/cari-ag.png" : "/ana/kasa-cuzdan.png"} alt="" width={160} height={160} className="ks-ust-gorsel" priority />
            </div>
          </div>
        </header>

        <div className="ana-ic relative z-10 pb-6">
          <div className="ana-gir" style={{ animationDelay: "90ms" }}>
            <ParaSekmeler aktif={v.sekme} onEk={yol} />
          </div>

          {v.sekme === "ozet" && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <Link href={`${yol}?sekme=kasa`} className="ks-ozet-kart ana-gir" style={{ animationDelay: "120ms" }}>
                  <span className="text-[12.5px] font-semibold text-[var(--a-ikincil)]">Kasada nakit</span>
                  <span className={`text-[1.35rem] font-extrabold tabular-nums ${v.bakiye < 0 ? "text-[#dc2626]" : ""}`}>{tlYazKisa(v.bakiye)}</span>
                  <span className="text-[11.5px] text-[var(--a-ikincil)]">
                    Giriş {tlYazKisa(v.giris)} · Çıkış {tlYazKisa(v.cikis)}
                  </span>
                </Link>
                <Link href={`${yol}?sekme=cari`} className="ks-ozet-kart ana-gir" style={{ animationDelay: "150ms" }}>
                  <span className="text-[12.5px] font-semibold text-[var(--a-ikincil)]">Firmalardan alacak</span>
                  <span className="text-[1.35rem] font-extrabold tabular-nums text-[#ea580c]">{tlYazKisa(toplamAlacak)}</span>
                  <span className="text-[11.5px] text-[var(--a-ikincil)]">
                    {v.cariler.length} cari · {borcluFirma} açık
                  </span>
                </Link>
              </div>
              {borcluFirma > 0 && (
                <section className="ana-gir" style={{ animationDelay: "180ms" }}>
                  <div className="flex items-baseline justify-between px-1">
                    <h2 className="ana-baslik">Açık hesaplar</h2>
                    <Link href={`${yol}?sekme=cari`} className="ana-link text-[13px]">
                      Tümü →
                    </Link>
                  </div>
                  <ul className="mt-2 space-y-2.5">
                    {v.cariler
                      .filter((c) => c.kalan > 0)
                      .slice(0, 4)
                      .map((c) => (
                        <li key={c.id}>
                          <Link href={`/firmalar/${c.id}`} className="ks-cari">
                            <FirmaAvatar id={c.id} ad={c.ad} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-extrabold">{c.ad}</span>
                              <span className="block text-[12.5px] text-[var(--a-ikincil)]">{c.acikYuk} açık sefer</span>
                            </span>
                            <span className="shrink-0 text-[15.5px] font-extrabold tabular-nums">{tlYazKisa(c.kalan)}</span>
                            <span className="shrink-0 text-[20px] leading-none text-[var(--a-ikincil)]" aria-hidden>
                              ›
                            </span>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {v.sekme === "kasa" && (
            <>
              <section className="mt-4 ana-gir" style={{ animationDelay: "120ms" }} aria-labelledby="son-hareketler">
                <div className="flex items-baseline justify-between px-1">
                  <h2 id="son-hareketler" className="ana-baslik">
                    Son hareketler
                  </h2>
                  {v.tumuHref && (
                    <Link href={v.tumuHref} className="ana-link text-[13px]">
                      Tümü →
                    </Link>
                  )}
                </div>
                {v.hareketler.length === 0 ? (
                  <div className="mt-2 rounded-[1.4rem] bg-white px-5 py-7 text-center text-[14.5px] text-[#3b4262] shadow-[var(--a-golge)]">
                    Henüz kasa hareketi yok. Aşağıdan ilk girişi yaz.
                  </div>
                ) : (
                  <ul className="mt-2 rounded-[1.4rem] bg-white px-3 pb-1 shadow-[var(--a-golge)]">
                    {v.hareketler.map((h) => (
                      <li key={h.id} className="border-b border-[var(--a-cizgi)] pb-2.5 last:border-0">
                        <KasaSatirOge h={h} />
                      </li>
                    ))}
                    {v.oncekiBakiye !== null && (
                      <li className="flex items-center gap-3 py-3">
                        <span className="ks-yon-ikon bg-[#eef0f8] text-[var(--a-ikincil)]" aria-hidden>
                          •••
                        </span>
                        <span className="min-w-0 flex-1 text-[14.5px] font-semibold">Önceki bakiye</span>
                        <span className="shrink-0 text-[15.5px] font-extrabold tabular-nums">{tlYazKisa(v.oncekiBakiye)}</span>
                      </li>
                    )}
                  </ul>
                )}
              </section>

              <section className="mt-4 rounded-[1.5rem] bg-white p-4 shadow-[var(--a-golge)] ana-gir" style={{ animationDelay: "160ms" }} aria-labelledby="yeni-hareket">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h2 id="yeni-hareket" className="ana-baslik">
                    Yeni hareket
                  </h2>
                  <span className="text-[12px] text-[var(--a-ikincil)]">Manuel nakit hareketleri</span>
                </div>
                <KasaForm bugunTarih={v.bugunTarih} />
              </section>
            </>
          )}

          {cari && (
            <div className="mt-4 ana-gir" style={{ animationDelay: "120ms" }}>
              <CariListe cariler={v.cariler} />
            </div>
          )}
        </div>
      </HareketKok>
    </div>
  );
}
