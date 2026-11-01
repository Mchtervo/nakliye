"use client";

import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { kurulumArac, kurulumKonum, kurulumSinif, type KurulumSonuc, type KurulumTaslak } from "@/app/kurulum-actions";
import { telefonDogrula, telefonKoduGonder, type KodSonuc } from "@/app/auth-actions";
import { ARAC_SINIFLARI, uygunKasaTipleri } from "@/lib/aracTip";
import { Alan, DevamDugmesi, IKONLAR, Uyari } from "@/components/uyelik/Alanlar";

const BOS: KurulumSonuc = { hata: null };
const YAY = { type: "spring", stiffness: 480, damping: 36 } as const;

const SINIF_GORSEL: Record<string, string> = {
  TIR: "/ana/arac/tir.webp",
  KAMYON: "/ana/arac/kamyon.webp",
  KAMYONET: "/ana/arac/kamyonet.webp",
  PANELVAN: "/ana/arac/panelvan.webp",
};
const KASA_GORSEL: Record<string, string> = {
  TENTELI: "/ana/arac/k-tenteli.webp",
  KAPALI_KASA: "/ana/arac/k-kapali.webp",
  FRIGO: "/ana/arac/k-frigo.webp",
  SAL_DORSE: "/ana/arac/k-acik.webp",
  DAMPER: "/ana/arac/k-damper.webp",
};

function Tik() {
  return (
    <m.span className="uy-tik" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={YAY} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </m.span>
  );
}

function YedekIkon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 text-[#6d74ff]" aria-hidden>
      <path d="M2.5 7h11v9h-11zM13.5 10h4l3 3.2V16h-7z" />
      <circle cx="6.5" cy="17.5" r="1.6" />
      <circle cx="17" cy="17.5" r="1.6" />
    </svg>
  );
}

/** Adım 0 (yalnız SMS kuruluysa): telefon doğrulama; "Sonra" ile geçilebilir. */
export function DogrulamaAdimi({ telefonMaskeli }: { telefonMaskeli: string }) {
  const [gonder, setGonder] = useState<KodSonuc | null>(null);
  const [gonderiyor, setGonderiyor] = useState(false);
  const [durum, aksiyon, bekliyor] = useActionState(telefonDogrula, { hata: null, tamam: false });
  const [kod, setKod] = useState("");

  async function kodIste() {
    setGonderiyor(true);
    setGonder(await telefonKoduGonder().catch(() => ({ hata: "Bağlantı hatası. Tekrar dene.", tamam: false })));
    setGonderiyor(false);
  }

  if (durum.tamam) {
    return (
      <div className="space-y-4">
        <Uyari ton="tamam">Telefonun doğrulandı.</Uyari>
        <Link href="/kurulum?adim=1" className="uy-devam">
          <span className="flex-1 text-center">Devam et</span>
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-[15px] text-[#3b4262]">
        <b>{telefonMaskeli}</b> numarasına 6 haneli kod göndereceğiz.
      </p>
      {!gonder?.tamam && (
        <button type="button" onClick={kodIste} disabled={gonderiyor} className="uy-devam">
          <span className="flex-1 text-center">{gonderiyor ? "Gönderiliyor…" : "Kod gönder"}</span>
        </button>
      )}
      {gonder?.hata && <Uyari ton={gonder.smsYok ? "bilgi" : "hata"}>{gonder.hata}</Uyari>}
      {gonder?.tamam && (
        <form action={aksiyon} className="space-y-3">
          <Alan etiket="SMS kodu" ikon={IKONLAR.kod}>
            <input name="kod" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={kod} onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))} className="uy-girdi tracking-[0.3em]" placeholder="••••••" />
          </Alan>
          {durum.hata && <Uyari>{durum.hata}</Uyari>}
          <DevamDugmesi bekliyor={bekliyor}>Doğrula</DevamDugmesi>
        </form>
      )}
      <Link href="/kurulum?adim=1" className="block py-2 text-center text-[14px] font-bold text-[#3730a3]">
        Sonra doğrularım
      </Link>
    </div>
  );
}

/** Adım 1: "Yol arkadaşın hangisi?" */
export function SinifAdimi({ secili }: { secili?: string }) {
  const [durum, aksiyon, bekliyor] = useActionState(kurulumSinif, BOS);
  const [sinif, setSinif] = useState(secili ?? "");
  const [digerAcik, setDigerAcik] = useState(secili === "DIGER");
  const liste = ARAC_SINIFLARI.filter((s) => s.kod !== "DIGER" || digerAcik);

  return (
    <form action={aksiyon} className="space-y-4">
      <fieldset>
        <legend className="sr-only">Araç tipi</legend>
        <div className="grid grid-cols-2 gap-3">
          {liste.map((s) => {
            const aktif = sinif === s.kod;
            return (
              <m.label key={s.kod} layout className={`uy-secim ${aktif ? "uy-secim-aktif" : ""}`} whileTap={{ scale: 0.97 }}>
                <input type="radio" name="sinif" value={s.kod} checked={aktif} onChange={() => setSinif(s.kod)} className="sr-only" />
                {aktif && <Tik />}
                <span className="flex h-[5.2rem] items-center justify-center">
                  {SINIF_GORSEL[s.kod] ? <Image src={SINIF_GORSEL[s.kod]} alt="" width={212} height={164} className="h-full w-auto object-contain" /> : <YedekIkon />}
                </span>
                <span className="mt-1 block text-[15.5px] font-extrabold">{s.ad}</span>
                <span className={`block text-[12.5px] ${aktif ? "text-[#4f46e5]" : "text-[var(--a-ikincil)]"}`}>{s.alt}</span>
              </m.label>
            );
          })}
        </div>
      </fieldset>
      {!digerAcik && (
        <button type="button" onClick={() => setDigerAcik(true)} className="mx-auto block py-1 text-[13.5px] font-bold text-[#3730a3]">
          Diğer araçlar ▾
        </button>
      )}
      {durum.hata && <Uyari>{durum.hata}</Uyari>}
      <DevamDugmesi bekliyor={bekliyor} disabled={!sinif}>
        Devam et
      </DevamDugmesi>
    </form>
  );
}

function IlSecimi({ ad, etiket, iller, deger, degis }: { ad: string; etiket: string; iller: string[]; deger: string; degis: (v: string) => void }) {
  return (
    <label className="uy-alan-kart block">
      <span className="uy-alan-etiket">{etiket}</span>
      <span className="uy-alan-satir">
        <span className="uy-alan-ikon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
        </span>
        <select name={ad} required value={deger} onChange={(e) => degis(e.target.value)} className="uy-girdi uy-secici">
          <option value="" disabled>
            Şehir seç
          </option>
          {iller.map((il) => (
            <option key={il} value={il}>
              {il}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

/** Adım 2: "Nereden yola çıkıyorsun?" (ana üs + aracın şu anki şehri) */
export function KonumAdimi({ iller, anaUs, konumIl }: { iller: string[]; anaUs?: string; konumIl?: string }) {
  const [durum, aksiyon, bekliyor] = useActionState(kurulumKonum, BOS);
  const [us, setUs] = useState(anaUs ?? "");
  const [konum, setKonum] = useState(konumIl ?? "");
  const [ayni, setAyni] = useState(!konumIl || konumIl === anaUs);

  return (
    <form action={aksiyon} className="space-y-3">
      <IlSecimi
        ad="anaUs"
        etiket="Yaşadığın şehir"
        iller={iller}
        deger={us}
        degis={(v) => {
          setUs(v);
          if (ayni) setKonum(v);
        }}
      />
      <IlSecimi
        ad="konumIl"
        etiket="Aracının bulunduğu şehir"
        iller={iller}
        deger={konum}
        degis={(v) => {
          setKonum(v);
          setAyni(v === us);
        }}
      />
      <p className="rp-not">
        <span aria-hidden>ⓘ</span>
        <span>Yükleri aracının konumuna göre gösteririz. Yola çıkınca konumu ana sayfadan değiştirebilirsin.</span>
      </p>
      {durum.hata && <Uyari>{durum.hata}</Uyari>}
      <DevamDugmesi bekliyor={bekliyor} disabled={!us || !konum}>
        Devam et
      </DevamDugmesi>
    </form>
  );
}

function OlcuAlani({ ad, etiket, birim, ipucu, deger, degis }: { ad: string; etiket: string; birim: string; ipucu: string; deger: string; degis: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block px-1 text-[13.5px] font-semibold text-[#3b4262]">{etiket}</span>
      <span className="uy-olcu">
        <input name={ad} inputMode="decimal" value={deger} onChange={(e) => degis(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))} placeholder={ipucu} className="uy-girdi" />
        <span className="text-[14px] font-semibold text-[var(--a-ikincil)]">{birim}</span>
      </span>
    </label>
  );
}

const yaz = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/** Adım 3: "Aracını tanıyalım" — kasa tipi + taşıma bilgileri + plaka */
export function AracAdimi({ taslak }: { taslak: KurulumTaslak }) {
  const [durum, aksiyon, bekliyor] = useActionState(kurulumArac, BOS);
  const kasalar = uygunKasaTipleri(taslak.sinif);
  const [kasa, setKasa] = useState(taslak.kasaTipi ?? "");
  const [kapasite, setKapasite] = useState(yaz(taslak.kapasiteTon));
  const [uzunluk, setUzunluk] = useState(yaz(taslak.kasaUzunlukM));
  const [genislik, setGenislik] = useState(yaz(taslak.kasaGenislikM));
  const [yukseklik, setYukseklik] = useState(yaz(taslak.kasaYukseklikM));
  const [plaka, setPlaka] = useState(taslak.plaka ?? "");
  const form = useRef<HTMLFormElement>(null);

  // Defter hazırlanıyorsa birkaç saniyede bir kendiliğinden yeniden dener (aynı cevaplar)
  useEffect(() => {
    if (!durum.bekliyor) return;
    const t = window.setTimeout(() => form.current?.requestSubmit(), 4000);
    return () => window.clearTimeout(t);
  }, [durum]);

  return (
    <form ref={form} action={aksiyon} className="space-y-6">
      <fieldset>
        <legend className="text-[1.35rem] font-extrabold tracking-[-0.02em]">Kasa tipi</legend>
        <p className="text-[14px] text-[#4b5375]">Aracına uygun olanı seç.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {kasalar.map((k) => {
            const aktif = kasa === k.kod;
            return (
              <m.label key={k.kod} className={`uy-secim !pb-2.5 ${aktif ? "uy-secim-aktif" : ""}`} whileTap={{ scale: 0.97 }}>
                <input type="radio" name="kasaTipi" value={k.kod} checked={aktif} onChange={() => setKasa(k.kod)} className="sr-only" />
                {aktif && <Tik />}
                <span className="flex h-[4.6rem] items-center justify-center">
                  {KASA_GORSEL[k.kod] ? <Image src={KASA_GORSEL[k.kod]} alt="" width={432} height={216} className="h-full w-auto object-contain" /> : <YedekIkon />}
                </span>
                <span className="mt-1 block text-[15px] font-extrabold">{k.ad}</span>
              </m.label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-[1.35rem] font-extrabold tracking-[-0.02em]">Taşıma bilgileri</legend>
        <div className="grid grid-cols-2 gap-3">
          <OlcuAlani ad="kapasiteTon" etiket="Taşıma kapasitesi" birim="ton" ipucu="ör. 26" deger={kapasite} degis={setKapasite} />
          <OlcuAlani ad="kasaUzunlukM" etiket="Kasa uzunluğu" birim="m" ipucu="ör. 13,6" deger={uzunluk} degis={setUzunluk} />
        </div>
        <p className="rp-not">
          <span aria-hidden>ⓘ</span>
          <span>Soluk yazılar örnektir, kaydedilmez. Bilmiyorsan boş bırak.</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <OlcuAlani ad="kasaGenislikM" etiket="Kasa genişliği" birim="m" ipucu="İsteğe bağlı" deger={genislik} degis={setGenislik} />
          <OlcuAlani ad="kasaYukseklikM" etiket="Kasa yüksekliği" birim="m" ipucu="İsteğe bağlı" deger={yukseklik} degis={setYukseklik} />
        </div>
        <label className="block">
          <span className="mb-1 block px-1 text-[13.5px] font-semibold text-[#3b4262]">Plaka</span>
          <span className="uy-olcu">
            <input name="plaka" value={plaka} onChange={(e) => setPlaka(e.target.value.toLocaleUpperCase("tr-TR").slice(0, 12))} placeholder="İsteğe bağlı" autoCapitalize="characters" className="uy-girdi" />
          </span>
        </label>
        <p className="rp-not">
          <span aria-hidden>ⓘ</span>
          <span>Bilgilerini daha sonra Araç sayfasından değiştirebilirsin.</span>
        </p>
      </fieldset>

      <AnimatePresence>
        {durum.bekliyor && (
          <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Uyari ton="bilgi">Defterin hazırlanıyor, cevapların kaydedildi. Birkaç saniye içinde kendiliğinden devam edeceğiz…</Uyari>
          </m.div>
        )}
      </AnimatePresence>
      {durum.hata && <Uyari>{durum.hata}</Uyari>}
      <DevamDugmesi bekliyor={bekliyor || durum.bekliyor} disabled={!kasa}>
        Tamamla ve yükleri gör
      </DevamDugmesi>
    </form>
  );
}
