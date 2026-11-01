import Image from "next/image";
import Link from "next/link";
import { giderSil } from "@/app/actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import BildirimZili from "@/components/BildirimZili";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import KategoriIkon from "@/components/gider/KategoriIkon";
import AcilirSatir from "@/components/sefer/AcilirSatir";
import KayitBildirimi from "@/components/gider/KayitBildirimi";
import { tlYazKisa } from "@/lib/para";

export type GiderSatir = {
  id: number;
  gun: string;
  ayKisa: string;
  kategori: string;
  kategoriAd: string;
  alt: string;
  ek: string | null;
  toplam: number;
  net: number;
  kdv: number;
  kdvli: boolean;
  veresiye: boolean;
  gonderildi: boolean;
  demirbas: boolean;
  fisResmi: string | null;
};

export type GiderlerVeri = {
  ayAdi: string;
  oncekiHref: string;
  sonrakiHref: string;
  excelHref: string;
  /** İşletme gideri toplamı (demirbaş hariç), KDV dahil */
  toplam: number;
  net: number;
  kdv: number;
  bugunKadar: number;
  kategoriler: { kod: string; ad: string; tutar: number; adet: number }[];
  demirbas: { toplam: number; kdv: number; adet: number } | null;
  giderler: GiderSatir[];
  /** Kayıt bitip listeye dönüldü (?kayit=1) */
  kaydedildi?: boolean;
};

/** Giderler sayfası görünümü (veri dışarıdan; yerel önizleme örnek veriyle kullanır). */
export default function GiderlerGorunum({ v }: { v: GiderlerVeri }) {
  const enBuyuk = Math.max(1, ...v.kategoriler.map((k) => k.tutar));
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        {v.kaydedildi && <KayitBildirimi metin="Gider kaydedildi" />}
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

            <div className="relative mt-3">
              <div className="ana-gir relative z-10 max-w-[64%]" style={{ animationDelay: "40ms" }}>
                <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-white">Giderler</h1>
                <div className="flex items-center gap-1 text-[14px] font-semibold text-[#c7cffd]">
                  <Link href={v.oncekiHref} aria-label="Önceki ay" className="sf-ay-ok">
                    ‹
                  </Link>
                  <span className="min-w-[6.5rem] text-center capitalize">{v.ayAdi}</span>
                  <Link href={v.sonrakiHref} aria-label="Sonraki ay" className="sf-ay-ok">
                    ›
                  </Link>
                </div>
                <p className="mt-3 text-[14px] text-[#c7cffd]">Toplam gider</p>
                <p className="text-[2.3rem] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">{tlYazKisa(v.toplam)}</p>
                <p className="mt-1.5 text-[12.5px] text-[#aab4ee]">İşletme giderleri • KDV dahil</p>
              </div>
              <Image src="/ana/gider-fis.png" alt="" width={150} height={140} className="gd-ust-gorsel" priority />
            </div>
            <div className="ana-gir mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/12 pt-2.5 text-[13.5px]" style={{ animationDelay: "60ms" }}>
              <span className="text-[#c7cffd]">
                Net <b className="ml-1 text-white tabular-nums">{tlYazKisa(v.net)}</b>
              </span>
              <span className="text-[#c7cffd]">
                KDV <b className="ml-1 text-white tabular-nums">{tlYazKisa(v.kdv)}</b>
              </span>
              <span className="text-[11.5px] text-[#9aa6e8]">Bugüne kadar {tlYazKisa(v.bugunKadar)}</span>
            </div>
          </div>
        </header>

        <div className="ana-ic relative z-10 pb-6">
          <div className="gd-kisayol ana-gir" style={{ animationDelay: "100ms" }}>
            <Link href="/giderler/yeni" className="gd-kisayol-oge">
              <span className="gd-kisayol-ikon bg-gradient-to-br from-[#6d6af8] to-[#4338ca] text-white" aria-hidden>
                +
              </span>
              <span>+ Gider</span>
            </Link>
            <Link href="/giderler/yeni#fis" className="gd-kisayol-oge">
              <Image src="/ana/fis-kamera.png" alt="" width={48} height={48} className="h-12 w-12" />
              <span>Fiş çek</span>
            </Link>
          </div>

          {v.kategoriler.length > 0 && (
            <section className="mt-5 ana-gir" style={{ animationDelay: "140ms" }} aria-labelledby="kategori-dagilimi">
              <h2 id="kategori-dagilimi" className="ana-baslik px-1">
                Kategori dağılımı
              </h2>
              <ul className="mt-2 rounded-[1.4rem] bg-white px-3 shadow-[var(--a-golge)]">
                {v.kategoriler.map((k) => (
                  <li key={k.kod} className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-2.5 last:border-0">
                    <KategoriIkon kod={k.kod} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14.5px] font-semibold">
                          {k.ad}
                          <span className="ml-1.5 text-[11.5px] font-medium text-[var(--a-ikincil)]">{k.adet} adet</span>
                        </span>
                        <span className="shrink-0 text-[14.5px] font-bold tabular-nums">{tlYazKisa(k.tutar)}</span>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#eef0f7]">
                        <span className="bar-anim block h-full rounded-full bg-[#f87171]" style={{ width: `${Math.round((k.tutar / enBuyuk) * 100)}%` }} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {v.demirbas && (
            <section className="mt-4 rounded-[1.4rem] bg-[#fff8eb] px-4 py-3 ana-gir" style={{ animationDelay: "160ms" }}>
              <p className="text-[12px] font-bold text-[#b45309]">Demirbaş özeti</p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[1.3rem] font-extrabold tabular-nums">{tlYazKisa(v.demirbas.toplam)}</p>
                  <p className="text-[11.5px] text-[#92400e]">{v.demirbas.adet} alım · işletme giderine yazılmadı</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[#92400e]">İndirilecek KDV</p>
                  <p className="text-[1.05rem] font-extrabold tabular-nums text-[#b45309]">{tlYazKisa(v.demirbas.kdv)}</p>
                </div>
              </div>
            </section>
          )}

          <section className="mt-5" aria-labelledby="bu-ay-giderler">
            <div className="flex items-baseline justify-between px-1">
              <h2 id="bu-ay-giderler" className="ana-baslik">
                Son giderler
              </h2>
              <span className="text-[12.5px] font-semibold text-[var(--a-ikincil)]">{v.giderler.length} kayıt</span>
            </div>
            {v.giderler.length === 0 ? (
              <div className="mt-2 rounded-[1.4rem] bg-white px-5 py-8 text-center text-[14.5px] text-[#3b4262] shadow-[var(--a-golge)]">
                <span className="capitalize">{v.ayAdi}</span> ayında gider yok. &quot;+ Gider&quot; ile ekle ya da başka ay seç.
              </div>
            ) : (
              <ul className="mt-2 rounded-[1.4rem] bg-white px-3 pb-1 shadow-[var(--a-golge)]">
                {v.giderler.map((g, i) => (
                  <li key={g.id} className="ana-gir border-b border-[var(--a-cizgi)] pb-2.5 last:border-0" style={{ animationDelay: `${Math.min(180 + i * 30, 360)}ms` }}>
                    <AcilirSatir
                      satir={
                        <Link href={`/giderler/${g.id}/duzenle`} className="gd-satir">
                          <span className="gd-tarih" aria-hidden>
                            <b>{g.gun}</b>
                            {g.ayKisa}
                          </span>
                          <KategoriIkon kod={g.kategori} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-bold">{g.kategoriAd}</span>
                            <span className="block truncate text-[12px] text-[var(--a-ikincil)]">
                              {g.alt}
                              {g.ek ? ` · ${g.ek}` : ""}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-[14.5px] font-extrabold tabular-nums">{tlYazKisa(g.toplam)}</span>
                            <span className={`sf-rozet ${g.veresiye ? "bg-[#fff1dc] text-[#c2410c]" : g.demirbas ? "bg-[#fef3c7] text-[#92400e]" : "bg-[#dcfce7] text-[#15803d]"}`}>
                              {g.veresiye ? "Veresiye" : g.demirbas ? "Demirbaş" : "Peşin"}
                            </span>
                          </span>
                        </Link>
                      }
                      icerik={
                        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#f6f7fb] px-3 py-2.5">
                          <p className="w-full text-[12px] text-[var(--a-ikincil)]">
                            {g.kdvli ? `Net ${tlYazKisa(g.net)} + KDV ${tlYazKisa(g.kdv)}` : "KDV'siz"}
                            {g.gonderildi ? " · muhasebeciye gönderildi" : ""}
                          </p>
                          {g.fisResmi ? (
                            <a href={g.fisResmi} target="_blank" rel="noreferrer" className="ana-hap">
                              Fişi gör
                            </a>
                          ) : (
                            <span className="text-[12px] text-[var(--a-ikincil)]">Fiş yok</span>
                          )}
                          <Link href={`/giderler/${g.id}/duzenle`} className="ana-hap">
                            Düzenle
                          </Link>
                          <AksiyonButonu
                            calistir={giderSil.bind(null, g.id)}
                            etiket="Sil"
                            bekleyenEtiket="…"
                            onay={`${g.kategoriAd} giderini (${tlYazKisa(g.toplam)}) silmek istediğine emin misin?`}
                            sinif="ana-hap !text-[#dc2626]"
                          />
                        </div>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <a href={v.excelHref} className="sf-beyaz-dugme !min-h-12 !text-[13.5px]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#16a34a] text-[12px] font-extrabold text-white" aria-hidden>
                X
              </span>
              Excel indir
            </a>
            <Link href="/muhasebeci" className="sf-beyaz-dugme !min-h-12 !text-[13.5px]">
              <svg viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z" />
              </svg>
              Muhasebeciye gönder
            </Link>
          </div>
        </div>
      </HareketKok>
    </div>
  );
}
