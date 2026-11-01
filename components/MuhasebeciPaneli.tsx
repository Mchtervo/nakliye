"use client";

import { m } from "motion/react";
import {
  useActionState,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import {
  fisleriGonderildiIsaretle,
  muhasebeciNumaraKaydet,
  type FormSonuc,
} from "@/app/actions";
import { tlYazKisa } from "@/lib/para";

type FisOge = {
  id: number;
  tarihYazi: string;
  kategoriAd: string;
  aciklama: string | null;
  toplamTutar: number;
  fisResmi: string;
  gonderildi: boolean;
};

function telefonTemizle(telefon: string): string {
  let t = telefon.replace(/[\s\-()]/g, "");
  if (t.startsWith("+")) t = t.slice(1);
  return t;
}

function mobilMi(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** Fiş görselleri + giderler.xlsx + ozet.html tek ZIP olarak iner. */
async function zipIndir(
  ids: number[],
  dosyaAdi: string,
  ay?: string
): Promise<void> {
  const zipYanit = await fetch("/api/fis-zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, ay }),
  });
  if (!zipYanit.ok) {
    const j = await zipYanit.json().catch(() => null);
    throw new Error(j?.hata || "ZIP oluşturulamadı.");
  }
  const zipBlob = await zipYanit.blob();
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fisDosyalariHazirla(fisler: FisOge[]): Promise<File[]> {
  const dosyalar: File[] = [];
  for (const fis of fisler) {
    const yanit = await fetch(fis.fisResmi);
    if (!yanit.ok) throw new Error(`Fiş yüklenemedi: ${fis.fisResmi}`);
    const blob = await yanit.blob();
    const uzanti = fis.fisResmi.split(".").pop() || "jpg";
    const ad = `${fis.tarihYazi.replace(/\./g, "-")}_${fis.kategoriAd}_${fis.id}.${uzanti}`;
    dosyalar.push(new File([blob], ad, { type: blob.type || "image/jpeg" }));
  }
  return dosyalar;
}

/** Seçim kutusu: işaret çizilir, kutu kısa bir "tık" yapar. */
function Kutu({ secili }: { secili: boolean }) {
  return (
    <m.span
      className={`mh-kutu ${secili ? "mh-kutu-secili" : ""}`}
      animate={{ scale: secili ? [1, 1.18, 1] : 1 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <m.path d="M5 12.5l4.5 4.5L19 7.5" initial={false} animate={{ pathLength: secili ? 1 : 0, opacity: secili ? 1 : 0 }} transition={{ duration: 0.22 }} />
      </svg>
    </m.span>
  );
}

function PaketSatiri({ ikon, ton, ad, alt }: { ikon: ReactNode; ton: string; ad: ReactNode; alt: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className={`ana-mini-ikon ${ton}`} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {ikon}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{ad}</span>
        <span className="block truncate text-[11.5px] text-[var(--a-ikincil)]">{alt}</span>
      </span>
    </li>
  );
}

export default function MuhasebeciPaneli({
  baslangicTelefon,
  fisler,
  ayEtiket,
  seciliAy,
  ornek = false,
}: {
  baslangicTelefon: string;
  fisler: FisOge[];
  ayEtiket: string;
  seciliAy: string;
  /** Yerel önizleme: hiçbir şey kaydedilmez, indirilmez, paylaşılmaz */
  ornek?: boolean;
}) {
  const [telefonDurum, telefonAksiyon, telefonBekliyor] = useActionState<
    FormSonuc,
    FormData
  >(muhasebeciNumaraKaydet, null);

  const [telefon, setTelefon] = useState(baslangicTelefon);
  const [eposta, setEposta] = useState("");
  const [secilen, setSecilen] = useState<number[]>(() =>
    fisler.filter((f) => !f.gonderildi).map((f) => f.id)
  );
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  const mobil = useSyncExternalStore(
    () => () => {},
    mobilMi,
    () => false
  );

  const seciliFisler = useMemo(
    () => fisler.filter((f) => secilen.includes(f.id)),
    [fisler, secilen]
  );
  const seciliToplam = seciliFisler.reduce((t, f) => t + f.toplamTutar, 0);
  const hepsiSecili = fisler.length > 0 && seciliFisler.length === fisler.length;
  const gonderilenVar = fisler.some((f) => f.gonderildi);

  function toggle(id: number) {
    setSecilen((onceki) =>
      onceki.includes(id) ? onceki.filter((x) => x !== id) : [...onceki, id]
    );
  }

  function tumunuDegistir() {
    setSecilen(hepsiSecili ? [] : fisler.map((f) => f.id));
  }

  function sadeceYeni() {
    setSecilen(fisler.filter((f) => !f.gonderildi).map((f) => f.id));
  }

  /** Örnek görünümde gerçek işlem yapılmaz. */
  function ornekMi(): boolean {
    if (!ornek) return false;
    setHata(null);
    setMesaj(`Örnek görünüm: ${seciliFisler.length} fiş seçili. Paket hazırlanmadı, hiçbir şey paylaşılmadı.`);
    return true;
  }

  function onKosul(): boolean {
    setMesaj(null);
    setHata(null);
    if (!telefon.trim()) {
      setHata("Önce muhasebecinin telefon numarasını kaydet.");
      return false;
    }
    if (seciliFisler.length === 0) {
      setHata("Gönderilecek fiş seçilmedi.");
      return false;
    }
    return true;
  }

  /** Mobil: WhatsApp uygulamasına paylaş */
  async function mobilWhatsappGonder() {
    if (!onKosul() || ornekMi()) return;

    baslat(async () => {
      try {
        const dosyalar = await fisDosyalariHazirla(seciliFisler);
        const metin = `${ayEtiket} fişleri (${seciliFisler.length} adet) — Nakliye Defteri`;
        const tel = telefonTemizle(telefon);

        const nav = navigator as Navigator & {
          canShare?: (data?: ShareData) => boolean;
          share?: (data: ShareData) => Promise<void>;
        };

        // Android Chrome: dosyaları doğrudan WhatsApp'a paylaş
        if (nav.share && nav.canShare?.({ files: dosyalar })) {
          await nav.share({ files: dosyalar, title: "Fişler", text: metin });
          await fisleriGonderildiIsaretle(seciliFisler.map((f) => f.id));
          setMesaj(
            `${seciliFisler.length} fiş WhatsApp'a gönderildi olarak işaretlendi. Listeden muhasebecini seçtiysen tamamdır.`
          );
          return;
        }

        // iOS / share desteklemiyorsa: ZIP indir + WhatsApp sohbetini aç
        await zipIndir(
          seciliFisler.map((f) => f.id),
          `muhasebe-${seciliAy}.zip`,
          seciliAy
        );
        const waMetin = encodeURIComponent(
          `${metin}\nAz önce indirilen ZIP'i bu sohbete ekliyorum.`
        );
        window.location.href = `https://wa.me/${tel}?text=${waMetin}`;

        await fisleriGonderildiIsaretle(seciliFisler.map((f) => f.id));
        setMesaj(
          `ZIP indirildi, WhatsApp açılıyor. Sohbette + / ataşman ile ZIP'i ekle.`
        );
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          setHata("Paylaşım iptal edildi.");
          return;
        }
        setHata(e instanceof Error ? e.message : "Gönderim başarısız.");
      }
    });
  }

  /** Masaüstü: WhatsApp Web veya Desktop uygulaması */
  async function masaustuWhatsappGonder() {
    if (!onKosul() || ornekMi()) return;

    baslat(async () => {
      try {
        const metin = `${ayEtiket} fişleri (${seciliFisler.length} adet) — Nakliye Defteri`;
        const tel = telefonTemizle(telefon);
        const zipAdi = `muhasebe-${seciliAy}.zip`;

        await zipIndir(seciliFisler.map((f) => f.id), zipAdi, seciliAy);

        // WhatsApp Web sohbetini aç (tarayıcıda açıksa / Desktop varsa oraya düşer)
        const waMetin = encodeURIComponent(
          `${metin}\nİndirdiğim ${zipAdi} dosyasını şimdi ekliyorum.`
        );
        const webUrl = `https://web.whatsapp.com/send?phone=${tel}&text=${waMetin}`;
        window.open(webUrl, "_blank", "noopener,noreferrer");

        await fisleriGonderildiIsaretle(seciliFisler.map((f) => f.id));
        setMesaj(
          `1) ${zipAdi} indirildi (İndirilenler klasörüne bak).\n2) WhatsApp Web / Desktop açıldı.\n3) Sohbette ataşman (📎) ile ZIP'i ekleyip gönder.`
        );
      } catch (e) {
        setHata(e instanceof Error ? e.message : "Gönderim başarısız.");
      }
    });
  }

  async function sadeceZipIndir() {
    setMesaj(null);
    setHata(null);
    if (seciliFisler.length === 0) {
      setHata("İndirilecek fiş seçilmedi.");
      return;
    }
    if (ornekMi()) return;
    baslat(async () => {
      try {
        await zipIndir(
          seciliFisler.map((f) => f.id),
          `muhasebe-${seciliAy}.zip`,
          seciliAy
        );
        setMesaj(
          "Paket indirildi: fiş görselleri + giderler.xlsx + ozet.html. WhatsApp Web/Desktop'ta sohbete sürükleyip bırakabilirsin."
        );
      } catch (e) {
        setHata(e instanceof Error ? e.message : "İndirme başarısız.");
      }
    });
  }

  /** E-posta: paket indirilir, posta programı hazır metinle açılır. */
  async function epostaGonder() {
    setMesaj(null);
    setHata(null);
    if (seciliFisler.length === 0) {
      setHata("Gönderilecek fiş seçilmedi.");
      return;
    }
    if (ornekMi()) return;

    baslat(async () => {
      try {
        const zipAdi = `muhasebe-${seciliAy}.zip`;
        await zipIndir(seciliFisler.map((f) => f.id), zipAdi, seciliAy);

        const konu = encodeURIComponent(`${ayEtiket} muhasebe evrakı`);
        const govde = encodeURIComponent(
          [
            "Merhaba,",
            "",
            `${ayEtiket} dönemine ait ${seciliFisler.length} fiş, gider dökümü (giderler.xlsx) ve özet (ozet.html) ekte.`,
            "",
            `Ek: ${zipAdi}`,
            "",
            "İyi çalışmalar.",
          ].join("\n")
        );
        window.location.href = `mailto:${eposta.trim()}?subject=${konu}&body=${govde}`;

        await fisleriGonderildiIsaretle(seciliFisler.map((f) => f.id));
        setMesaj(
          `${zipAdi} indirildi ve e-posta taslağı açıldı. Dosyayı ataşman olarak ekleyip gönder.`
        );
      } catch (e) {
        setHata(e instanceof Error ? e.message : "E-posta hazırlanamadı.");
      }
    });
  }

  const bos = bekliyor || seciliFisler.length === 0;

  return (
    <div className="space-y-6">
      <section aria-labelledby="fis-secimi">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 id="fis-secimi" className="ana-baslik" aria-live="polite">
            <m.span
              key={seciliFisler.length}
              className="inline-block tabular-nums"
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.22 }}
            >
              {seciliFisler.length}
            </m.span>{" "}
            fiş seçildi
          </h2>
          {fisler.length > 0 && (
            <button type="button" onClick={tumunuDegistir} className="mh-tumu" aria-pressed={hepsiSecili}>
              <Kutu secili={hepsiSecili} />
              Tümünü seç
            </button>
          )}
        </div>
        <p className="mt-0.5 px-1 text-[12.5px] text-[var(--a-ikincil)]">
          {ayEtiket} · {fisler.length} fişli gider
          {seciliFisler.length > 0 && (
            <>
              {" "}
              · seçilen toplam <b className="tabular-nums text-[var(--a-murekkep)]">{tlYazKisa(seciliToplam)}</b>
            </>
          )}
          {gonderilenVar && (
            <>
              {" · "}
              <button type="button" onClick={sadeceYeni} className="ana-link font-bold">
                Sadece yeniler
              </button>
            </>
          )}
        </p>

        {fisler.length === 0 ? (
          <p className="rp-bos mt-3">Bu ayda fiş resmi olan gider yok. Gider eklerken fiş fotoğrafı yükle.</p>
        ) : (
          <ul className="rp-kart mt-3 px-2 py-1">
            {fisler.map((fis) => {
              const secili = secilen.includes(fis.id);
              return (
                <li key={fis.id} className="border-b border-[var(--a-cizgi)] last:border-0">
                  <label className="mh-fis" data-secili={secili ? "1" : undefined}>
                    <input type="checkbox" checked={secili} onChange={() => toggle(fis.id)} className="sr-only" />
                    <Kutu secili={secili} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fis.fisResmi} alt="" className="mh-kucuk" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold">
                        {fis.kategoriAd} <span className="font-medium text-[var(--a-ikincil)]">· {fis.tarihYazi}</span>
                      </span>
                      <span className="block text-[15.5px] font-extrabold tabular-nums">{tlYazKisa(fis.toplamTutar)}</span>
                      {(fis.aciklama || fis.gonderildi) && (
                        <span className="block truncate text-[11.5px] text-[var(--a-ikincil)]">
                          {fis.gonderildi && <span className="font-bold text-[#16a34a]">Daha önce gönderildi</span>}
                          {fis.gonderildi && fis.aciklama ? " · " : ""}
                          {fis.aciklama}
                        </span>
                      )}
                    </span>
                    <a href={fis.fisResmi} target="_blank" rel="noopener noreferrer" className="mh-buyut" aria-label={`${fis.kategoriAd} fişini büyük aç`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="6" />
                        <path d="M16 16l4 4M11 8.5v5M8.5 11h5" />
                      </svg>
                    </a>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="paket-icerigi">
        <h2 id="paket-icerigi" className="ana-baslik px-1">
          Paket içeriği
        </h2>
        <ul className="mt-2 rounded-[1.3rem] bg-[#eef1fd] px-3.5 py-1.5">
          <PaketSatiri
            ton="ana-ton-indigo"
            ikon={
              <>
                <rect x="4" y="5" width="16" height="14" rx="2.5" />
                <path d="M4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 18" />
              </>
            }
            ad={
              <>
                Fiş görselleri <span className="text-[var(--a-ikincil)]">({seciliFisler.length} adet)</span>
              </>
            }
            alt="Yalnız seçtiğin fişler"
          />
          <PaketSatiri
            ton="ana-ton-yesil"
            ikon={
              <>
                <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
                <path d="M9 9l6 6M15 9l-6 6" />
              </>
            }
            ad="Gider listesi (Excel)"
            alt={`giderler.xlsx · ${ayEtiket} kayıtları`}
          />
          <PaketSatiri
            ton="ana-ton-indigo"
            ikon={
              <>
                <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
                <path d="M9 8.5h6M9 12.5h6M9 16.5h4" />
              </>
            }
            ad={
              <>
                Dönem özeti <span className="capitalize text-[var(--a-ikincil)]">({ayEtiket})</span>
              </>
            }
            alt="ozet.html"
          />
        </ul>
      </section>

      <form
        action={telefonAksiyon}
        onSubmit={(e) => {
          if (ornek) {
            e.preventDefault();
            ornekMi();
          }
        }}
        aria-labelledby="muhasebeci-tel"
      >
        <label id="muhasebeci-tel" htmlFor="telefon" className="ana-baslik block px-1">
          Muhasebecinin telefonu
        </label>
        <div className="mt-2 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#4f46e5]" aria-hidden>
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
            </svg>
            <input
              id="telefon"
              name="telefon"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="05XX XXX XX XX"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              className="ana-alan !pl-11"
            />
          </div>
          <button type="submit" disabled={telefonBekliyor} className="ana-hap !min-h-[3rem] shrink-0 !px-4">
            {telefonBekliyor ? "…" : "Kaydet"}
          </button>
        </div>
        {telefonDurum?.hata && <p className="mt-2 px-1 text-[13px] font-semibold text-[#dc2626]">{telefonDurum.hata}</p>}
        {!telefonDurum?.hata && baslangicTelefon && telefon === baslangicTelefon && (
          <p className="mt-1.5 px-1 text-[12px] text-[var(--a-ikincil)]">Kayıtlı numara</p>
        )}
      </form>

      <div aria-live="polite">
        {(hata || mesaj) && (
          <m.p
            key={hata || mesaj}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`whitespace-pre-line rounded-[1.1rem] px-3.5 py-3 text-[13.5px] font-semibold ${
              hata ? "bg-[#fee2e2] text-[#b91c1c]" : "bg-[#dcfce7] text-[#166534]"
            }`}
          >
            {hata || mesaj}
          </m.p>
        )}
      </div>

      <section className="space-y-2.5" aria-label="Paylaşım">
        <button type="button" disabled={bos} onClick={sadeceZipIndir} className="ana-ana-dugme w-full gap-2 !min-h-[3.3rem] !text-[1rem] disabled:opacity-55">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
            <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
          {bekliyor ? "Hazırlanıyor…" : "Paketi hazırla (ZIP indir)"}
        </button>
        <button
          type="button"
          disabled={bos}
          onClick={mobil ? mobilWhatsappGonder : masaustuWhatsappGonder}
          className="kk-cerceve-dugme w-full !min-h-[3.3rem] !text-[1rem] disabled:opacity-55"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#16a34a]" aria-hidden>
            <path d="M12 2.2A9.7 9.7 0 0 0 3.6 16.8L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.5 2.5 0 0 0 1.7-1.2 2 2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3z" />
          </svg>
          WhatsApp’ta paylaş
        </button>
        <p className="px-2 text-center text-[12px] leading-relaxed text-[var(--a-ikincil)]">
          {mobil
            ? "Telefonun paylaşım ekranı açılır; muhasebecini sen seçip gönderirsin."
            : "ZIP iner ve WhatsApp Web açılır; dosyayı sohbete 📎 ile sen eklersin."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" disabled={bos} onClick={mobil ? masaustuWhatsappGonder : mobilWhatsappGonder} className="ana-hap disabled:opacity-55">
            {mobil ? "Web / Desktop yolu" : "Telefondaki gibi paylaş"}
          </button>
        </div>

        <details className="rp-kart px-4 py-3">
          <summary className="cursor-pointer text-[14px] font-extrabold">E-posta ile gönder</summary>
          <div className="mt-2.5 flex gap-2">
            <input
              id="eposta"
              type="email"
              inputMode="email"
              aria-label="Muhasebecinin e-postası"
              placeholder="muhasebeci@ornek.com"
              value={eposta}
              onChange={(e) => setEposta(e.target.value)}
              className="ana-alan min-w-0 flex-1"
            />
            <button type="button" disabled={bos || !eposta.trim()} onClick={epostaGonder} className="ana-hap !min-h-[3rem] shrink-0 disabled:opacity-55">
              Hazırla
            </button>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--a-ikincil)]">
            Paket iner ve posta programı hazır metinle açılır; dosyayı ek olarak sen eklersin.
          </p>
        </details>

        <p className="rp-not justify-center">
          <span aria-hidden>ⓘ</span>
          <span>Paylaşmadan önce kontrol et. Uygulama kendiliğinden mesaj göndermez.</span>
        </p>
      </section>
    </div>
  );
}
