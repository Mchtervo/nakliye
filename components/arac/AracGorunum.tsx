"use client";

import { m } from "motion/react";
import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { aracKaydet, bakimYapildi, belgeKaydet, belgeSil, type AracSonuc, type BelgeSonuc } from "@/app/actions";
import { aktifAracSec, aracBilgiKaydet, aracEkle, aracSil, type AracIslemSonuc } from "@/app/arac-actions";
import AltPanel from "@/components/ana/AltPanel";
import RaporUst from "@/components/finans/RaporUst";
import { Uyari } from "@/components/uyelik/Alanlar";
import { ARAC_SINIFLARI, uygunKasaTipleri } from "@/lib/aracTip";
import { BELGE_TURLERI } from "@/lib/belge";

export type AracOge = {
  id: number;
  etiket: string;
  plaka: string | null;
  aktif: boolean;
  sinif: string | null;
  kasaTipi: string | null;
  kapasiteTon: number | null;
  kasaUzunlukM: number | null;
};

export type AracVeri = {
  araclar: AracOge[];
  km: {
    buAy: { toplam: number; yuklu: number; bos: number };
    tahminiSayac: number | null;
    kmSayac: number | null;
    kmTarihYazi: string | null;
    sonrakiBakimKm: number | null;
    bakimaKalan: number | null;
    bakimAralikKm: number | null;
    sonBakimKm: number | null;
    bilinmeyenSefer: number;
  } | null;
  yakit: { lt100: number | null; tlKm: number | null; sonLt100: number | null; fazla: boolean; dolum: number } | null;
  belgeler: { id: number; ad: string; bitisYazi: string; bitisIso: string; kalan: number }[];
  /** Önizleme: kayıt yapılmaz */
  ornek?: boolean;
};

const km = (n: number) => `${n.toLocaleString("tr-TR")} km`;
const virgul = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

function Ok() {
  return (
    <span className="shrink-0 text-[20px] leading-none text-[var(--a-ikincil)]" aria-hidden>
      ›
    </span>
  );
}

function Ikon({ ton, children }: { ton: string; children: ReactNode }) {
  return (
    <span className={`ana-mini-ikon rp-ikon ${ton}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

type Panel = null | { tur: "km" } | { tur: "arac"; arac?: AracOge } | { tur: "belge"; belge?: AracVeri["belgeler"][number] };

/** Panel formu: başarılı olunca (gerçekten kaydedilince) kapanır. */
function useKapanan<T extends { hata: string | null; tamam: boolean }>(durum: T, kapat: () => void) {
  useEffect(() => {
    if (durum.tamam) kapat();
  }, [durum, kapat]);
}

function KmFormu({ v, kapat }: { v: AracVeri; kapat: () => void }) {
  const [durum, aksiyon, bekliyor] = useActionState<AracSonuc, FormData>(aracKaydet, { hata: null, tamam: false });
  useKapanan(durum, kapat);
  const k = v.km;
  return (
    <form action={aksiyon} className="space-y-3 px-5 pb-6 pt-1">
      <h2 className="text-[1.3rem] font-extrabold">Km güncelle</h2>
      {[
        { ad: "kmSayac", etiket: "Göstergedeki km", deger: k?.tahminiSayac ?? k?.kmSayac },
        { ad: "bakimAralikKm", etiket: "Kaç km'de bir bakım", deger: k?.bakimAralikKm },
        { ad: "sonBakimKm", etiket: "Son bakım km'si", deger: k?.sonBakimKm },
      ].map((a) => (
        <label key={a.ad} className="block">
          <span className="ana-etiket">{a.etiket}</span>
          <input name={a.ad} inputMode="numeric" defaultValue={a.deger != null ? a.deger.toLocaleString("tr-TR") : ""} className="ana-alan" placeholder="Boş bırakılabilir" />
        </label>
      ))}
      {durum.hata && <Uyari>{durum.hata}</Uyari>}
      <button type="submit" disabled={bekliyor || v.ornek} className="ana-ana-dugme w-full">
        {bekliyor ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}

function AracFormu({ arac, kapat, ornek }: { arac?: AracOge; kapat: () => void; ornek?: boolean }) {
  const [durum, aksiyon, bekliyor] = useActionState<AracIslemSonuc, FormData>(arac ? aracBilgiKaydet : aracEkle, { hata: null, tamam: false });
  useKapanan(durum, kapat);
  const [sinif, setSinif] = useState(arac?.sinif ?? "TIR");
  const [kasa, setKasa] = useState(arac?.kasaTipi ?? "");
  const [silHata, setSilHata] = useState<string | null>(null);
  const [siliniyor, sil] = useTransition();
  const kasalar = uygunKasaTipleri(sinif);
  return (
    <form action={aksiyon} className="space-y-3 px-5 pb-6 pt-1">
      <h2 className="text-[1.3rem] font-extrabold">{arac ? "Araç bilgileri" : "Araç ekle"}</h2>
      {arac && <input type="hidden" name="aracId" value={arac.id} />}
      <label className="block">
        <span className="ana-etiket">Araç tipi</span>
        <select name="sinif" value={sinif} onChange={(e) => setSinif(e.target.value)} className="ana-alan">
          {ARAC_SINIFLARI.map((s) => (
            <option key={s.kod} value={s.kod}>
              {s.ad}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="ana-etiket">Kasa / dorse</span>
        <select name="kasaTipi" value={kasalar.some((k) => k.kod === kasa) ? kasa : ""} onChange={(e) => setKasa(e.target.value)} className="ana-alan">
          <option value="">Seçilmedi</option>
          {kasalar.map((k) => (
            <option key={k.kod} value={k.kod}>
              {k.ad}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="ana-etiket">Kapasite (ton)</span>
          <input name="kapasiteTon" inputMode="decimal" defaultValue={arac?.kapasiteTon != null ? String(arac.kapasiteTon).replace(".", ",") : ""} className="ana-alan" placeholder="İsteğe bağlı" />
        </label>
        <label className="block">
          <span className="ana-etiket">Kasa uzunluğu (m)</span>
          <input name="kasaUzunlukM" inputMode="decimal" defaultValue={arac?.kasaUzunlukM != null ? String(arac.kasaUzunlukM).replace(".", ",") : ""} className="ana-alan" placeholder="İsteğe bağlı" />
        </label>
      </div>
      <label className="block">
        <span className="ana-etiket">Plaka</span>
        <input name="plaka" defaultValue={arac?.plaka ?? ""} autoCapitalize="characters" className="ana-alan" placeholder="İsteğe bağlı" />
      </label>
      {(durum.hata || silHata) && <Uyari>{durum.hata || silHata}</Uyari>}
      <button type="submit" disabled={bekliyor || ornek} className="ana-ana-dugme w-full">
        {bekliyor ? "Kaydediliyor…" : arac ? "Kaydet" : "Aracı ekle"}
      </button>
      {arac && !arac.aktif && (
        <button
          type="button"
          disabled={siliniyor || ornek}
          onClick={() =>
            confirm("Bu aracı silmek istediğine emin misin?") &&
            sil(async () => {
              const r = await aracSil(arac.id);
              if (r.tamam) kapat();
              else setSilHata(r.hata);
            })
          }
          className="w-full py-2 text-[14px] font-bold text-[#dc2626]"
        >
          {siliniyor ? "Siliniyor…" : "Aracı sil"}
        </button>
      )}
    </form>
  );
}

function BelgeFormu({ belge, kapat, ornek }: { belge?: AracVeri["belgeler"][number]; kapat: () => void; ornek?: boolean }) {
  const [durum, aksiyon, bekliyor] = useActionState<BelgeSonuc, FormData>(belgeKaydet, { hata: null, tamam: false });
  useKapanan(durum, kapat);
  const [tur, setTur] = useState<string>("MUAYENE");
  const [siliniyor, sil] = useTransition();
  return (
    <form action={aksiyon} className="space-y-3 px-5 pb-6 pt-1">
      <h2 className="text-[1.3rem] font-extrabold">{belge ? "Belge yenilendi mi?" : "Belge ekle"}</h2>
      {belge ? (
        <>
          <input type="hidden" name="belgeId" value={belge.id} />
          <p className="text-[14px] text-[#3b4262]">
            <b>{belge.ad}</b> · şu anki bitiş {belge.bitisYazi}. Yenilediysen yeni bitiş tarihini gir.
          </p>
        </>
      ) : (
        <>
          <label className="block">
            <span className="ana-etiket">Belge türü</span>
            <select name="tur" value={tur} onChange={(e) => setTur(e.target.value)} className="ana-alan">
              {BELGE_TURLERI.map((t) => (
                <option key={t.kod} value={t.kod}>
                  {t.ad}
                </option>
              ))}
            </select>
          </label>
          {tur === "DIGER" && (
            <label className="block">
              <span className="ana-etiket">Belgenin adı</span>
              <input name="ad" required className="ana-alan" />
            </label>
          )}
        </>
      )}
      <label className="block">
        <span className="ana-etiket">{belge ? "Yeni bitiş tarihi" : "Bitiş tarihi"}</span>
        <input name="bitis" type="date" required defaultValue={belge?.bitisIso} className="ana-alan" />
      </label>
      <p className="rp-not">
        <span aria-hidden>ⓘ</span>
        <span>Bitişe 30, 7 ve 1 gün kala hatırlatılır.</span>
      </p>
      {durum.hata && <Uyari>{durum.hata}</Uyari>}
      <button type="submit" disabled={bekliyor || ornek} className="ana-ana-dugme w-full">
        {bekliyor ? "Kaydediliyor…" : belge ? "Kaydet" : "Belgeyi kaydet"}
      </button>
      {belge && (
        <button
          type="button"
          disabled={siliniyor || ornek}
          onClick={() => confirm("Bu belge silinsin mi?") && sil(async () => { await belgeSil(belge.id); kapat(); })}
          className="w-full py-2 text-[14px] font-bold text-[#dc2626]"
        >
          Belgeyi sil
        </button>
      )}
    </form>
  );
}

/** Araç ve belgeler: seçili araç, km / bakım / yakıt, belgeler; çoklu araç seçimi. */
export default function AracGorunum({ v }: { v: AracVeri }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [seciliyor, sec] = useTransition();
  const aktif = v.araclar.find((a) => a.aktif) ?? v.araclar[0];
  const k = v.km;
  const oran = k?.bakimAralikKm && k.bakimaKalan !== null ? Math.min(1, Math.max(0, 1 - k.bakimaKalan / k.bakimAralikKm)) : null;
  const kapat = () => setPanel(null);

  return (
    <>
      <RaporUst gorsel={{ src: "/ana/arac/kurulum.webp", genislik: 170 }} sinif="ar-ust">
        <div className="max-w-[60%]">
          <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-white">Araç ve belgeler</h1>
          <p className="text-[13.5px] text-[#c7cffd]">Aracının durumu ve belgeleri</p>
          {aktif?.plaka && <span className="ar-plaka mt-3">{aktif.plaka}</span>}
          <p className="mt-3 text-[14px] font-semibold text-[#dfe4ff]">{k?.bakimaKalan != null && k.bakimaKalan <= 0 ? "Bakım geçti" : "Bakıma kalan"}</p>
          <p className={`text-[2.2rem] font-extrabold leading-none tracking-[-0.03em] ${k?.bakimaKalan != null && k.bakimaKalan <= 0 ? "text-[#fca5a5]" : "text-white"}`}>
            {k?.bakimaKalan != null ? (
              <>
                {Math.abs(k.bakimaKalan).toLocaleString("tr-TR")} <span className="text-[1.1rem]">km</span>
              </>
            ) : (
              <span className="text-[1.15rem]">Bakım aralığını gir</span>
            )}
          </p>
          {oran !== null && (
            <span className="mt-2 block h-[6px] w-44 overflow-hidden rounded-full bg-white/15">
              <m.span className={`block h-full rounded-full ${oran >= 1 ? "bg-[#f87171]" : "bg-gradient-to-r from-[#7dd3fc] to-[#6d74ff]"}`} initial={{ width: 0 }} animate={{ width: `${oran * 100}%` }} transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }} />
            </span>
          )}
        </div>
      </RaporUst>

      <div className="ana-ic relative z-10 -mt-10 space-y-6 pb-8">
        {/* Araç seçimi: seçili aracın zemini kayar */}
        <section aria-label="Araçlarım" className="ana-gir">
          <div className="ar-araclar">
            {v.araclar.map((a) => (
              <div key={a.id} className="relative flex shrink-0">
                <button
                  type="button"
                  disabled={seciliyor || v.ornek}
                  onClick={() => (a.aktif ? setPanel({ tur: "arac", arac: a }) : sec(() => aktifAracSec(a.id)))}
                  aria-pressed={a.aktif}
                  className={`ar-arac ${a.aktif ? "text-white" : ""}`}
                >
                  {a.aktif && <m.span layoutId="aktif-arac" className="ar-arac-zemin" transition={{ type: "spring", stiffness: 480, damping: 38 }} aria-hidden />}
                  <span className="relative block text-[13.5px] font-extrabold">{a.etiket}</span>
                  <span className={`relative block text-[11.5px] ${a.aktif ? "text-[#dfe4ff]" : "text-[var(--a-ikincil)]"}`}>{a.plaka || (a.aktif ? "Seçili · düzenle" : "Seç")}</span>
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setPanel({ tur: "arac" })} className="ar-arac ar-arac-ekle" aria-label="Araç ekle">
              <span className="text-[1.4rem] leading-none">+</span>
              <span className="text-[11.5px] font-bold">Araç ekle</span>
            </button>
          </div>
          {v.araclar.length > 1 && <p className="mt-1.5 px-1 text-[12px] text-[var(--a-ikincil)]">Yeni sefer ve giderler seçili araca yazılır; km ve bakım seçili aracındır.</p>}
        </section>

        <section className="rp-kart ana-gir grid grid-cols-2 p-2" style={{ animationDelay: "60ms" }} aria-label="Gösterge ve bakım">
          <div className="rp-hucre">
            <Ikon ton="ana-ton-indigo">
              <path d="M4 15a8 8 0 1 1 16 0" />
              <path d="M12 15l4-5" />
            </Ikon>
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold text-[var(--a-ikincil)]">Gösterge (tahmini)</span>
              <span className="block truncate text-[1.05rem] font-extrabold tabular-nums">{k?.tahminiSayac != null ? km(k.tahminiSayac) : "—"}</span>
            </span>
          </div>
          <div className="rp-hucre border-l border-[var(--a-cizgi)]">
            <Ikon ton="ana-ton-indigo">
              <path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />
            </Ikon>
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold text-[var(--a-ikincil)]">Sonraki bakım</span>
              <span className="block truncate text-[1.05rem] font-extrabold tabular-nums">{k?.sonrakiBakimKm != null ? km(k.sonrakiBakimKm) : "—"}</span>
            </span>
          </div>
          {k?.kmTarihYazi && <p className="col-span-2 px-2 pb-1 text-center text-[11.5px] text-[var(--a-ikincil)]">{k.kmTarihYazi} girişinden + seferler</p>}
        </section>

        <ul className="ana-gir px-1" style={{ animationDelay: "100ms" }}>
          <li className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-3">
            <Ikon ton="ana-ton-indigo">
              <path d="M6 20v-6M12 20V9M18 20V4" />
            </Ikon>
            <span className="flex-1 text-[15px] font-semibold">Bu ay</span>
            <span className="text-[15px] font-bold tabular-nums">{k ? km(k.buAy.toplam) : "—"}</span>
          </li>
          <li className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-3">
            <Ikon ton="ana-ton-indigo">
              <path d="M2.5 7h11v9h-11zM13.5 10h4l3 3.2V16h-7z" />
            </Ikon>
            <span className="flex-1 text-[15px] font-semibold">Yüklü / Boş</span>
            <span className="text-[14px] font-bold tabular-nums">{k ? `${km(k.buAy.yuklu)} · ${km(k.buAy.bos)}` : "—"}</span>
          </li>
          <li className="flex items-center gap-3 py-3">
            <Ikon ton="ana-ton-kirmizi">
              <path d="M5 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M4 20h12M8 9h4" />
            </Ikon>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Yakıt tüketimi</span>
              {v.yakit?.fazla && v.yakit.sonLt100 != null && <span className="block text-[12px] font-semibold text-[#dc2626]">Son dolum {virgul(v.yakit.sonLt100)} lt — normalden fazla</span>}
              {v.yakit?.lt100 == null && <span className="block text-[12px] text-[var(--a-ikincil)]">Yakıt fişine litre ve km yazınca çıkar</span>}
            </span>
            <span className="text-[14px] font-bold tabular-nums">{v.yakit?.lt100 != null ? `${virgul(v.yakit.lt100)} lt / 100 km` : "—"}</span>
          </li>
        </ul>
        {k && k.bilinmeyenSefer > 0 && <p className="rp-not -mt-3">{k.bilinmeyenSefer} seferin yeri tanınmadı, km&apos;si sayılmadı.</p>}

        <div className="ana-gir space-y-2.5" style={{ animationDelay: "140ms" }}>
          <button type="button" onClick={() => setPanel({ tur: "km" })} className="ana-ana-dugme w-full gap-2 !min-h-[3.2rem]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-5 w-5" aria-hidden>
              <path d="M4 15a8 8 0 1 1 16 0M12 15l4-5" />
            </svg>
            Km güncelle
          </button>
          {k?.sonrakiBakimKm != null && k.tahminiSayac != null && (
            <form action={bakimYapildi}>
              <button
                type="submit"
                disabled={v.ornek}
                onClick={(e) => !confirm(`Bakım ${km(k.tahminiSayac!)}'de yapıldı olarak kaydedilsin mi?`) && e.preventDefault()}
                className="kk-cerceve-dugme w-full"
              >
                Bakım yapıldı
              </button>
            </form>
          )}
        </div>

        <section className="ana-gir" style={{ animationDelay: "180ms" }} aria-labelledby="belgeler">
          <div className="flex items-baseline justify-between px-1">
            <h2 id="belgeler" className="ana-baslik">
              Belgeler
            </h2>
            <span className="text-[12px] text-[var(--a-ikincil)]">{v.belgeler.length} belge</span>
          </div>
          {v.belgeler.length === 0 ? (
            <p className="rp-bos mt-2">Muayene, sigorta, kasko… bitiş tarihini ekle, zamanında hatırlatalım.</p>
          ) : (
            <ul className="mt-1">
              {v.belgeler.map((b) => (
                <li key={b.id} className="border-b border-[var(--a-cizgi)] last:border-0">
                  <button type="button" onClick={() => setPanel({ tur: "belge", belge: b })} className="rp-satir w-full text-left">
                    <Ikon ton={b.kalan <= 7 ? "ana-ton-kirmizi" : b.kalan <= 30 ? "ana-ton-turuncu" : "ana-ton-indigo"}>
                      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
                    </Ikon>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{b.ad}</span>
                      <span className="block text-[12.5px] text-[var(--a-ikincil)]">{b.bitisYazi}</span>
                    </span>
                    <span className={`ar-gun ${b.kalan < 0 ? "ar-gun-gecti" : b.kalan <= 30 ? "ar-gun-yakin" : ""}`}>{b.kalan < 0 ? `${-b.kalan} gün geçti` : `${b.kalan} gün`}</span>
                    <Ok />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setPanel({ tur: "belge" })} className="rp-genis-dugme mt-3 w-full justify-center !text-[15px] font-extrabold text-[#3730a3]">
            + Belge ekle
          </button>
        </section>
      </div>

      <AltPanel acik={panel !== null} etiket="Araç işlemi" kapat={kapat}>
        {panel?.tur === "km" && <KmFormu v={v} kapat={kapat} />}
        {panel?.tur === "arac" && <AracFormu key={panel.arac?.id ?? "yeni"} arac={panel.arac} kapat={kapat} ornek={v.ornek} />}
        {panel?.tur === "belge" && <BelgeFormu key={panel.belge?.id ?? "yeni"} belge={panel.belge} kapat={kapat} ornek={v.ornek} />}
      </AltPanel>
    </>
  );
}
