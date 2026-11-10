"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { useActionState, useRef, useState } from "react";
import { giderEkle, giderGuncelle, type FormSonuc } from "@/app/actions";
import TutarKdvGirisi from "@/components/TutarKdvGirisi";
import FisYukle from "@/components/FisYukle";
import KategoriIkon from "@/components/gider/KategoriIkon";
import { gecerliKategoriMi, giderKategoriGruplari } from "@/lib/sabitler";
import { kurustanGiris } from "@/lib/para";
import type { AracSecenek } from "@/lib/aktifArac";

type FisSonucu = {
  okunabildi: boolean;
  firmaAdi: string | null;
  tarih: string | null;
  toplamTutarTl: number | null;
  kdvTutarTl: number | null;
  kdvDahilMi: boolean;
  kategori: string;
  litre: number | null;
};

/** AI fişten okuduklarını alanlara basar; sayac artınca ilgili alanlar yeniden kurulur. */
type Doldurulan = {
  sayac: number;
  tutar?: string;
  kdvli?: boolean;
  kdvDahilMi?: boolean;
  yer?: string;
};

export type GiderFormBaslangic = {
  id: number;
  tarih: string;
  kategori: string;
  aciklama: string;
  tutarYazi: string;
  kdvli: boolean;
  kdvDahilMi: boolean;
  litre: string;
  km: string;
  fisResmi: string | null;
  odeme: string;
  veresiyeYer: string;
  /** Gideri yapan araç (boşsa ilk araç) */
  aracId?: number | null;
};

/**
 * Telefon fotoğrafı 6 MB sınırını aşıp "okunamadı" diyordu: okumaya giden
 * kopyayı uzun kenar 2000 px JPEG'e küçült. Kaydedilen fotoğrafın aslı değişmez.
 */
async function fisKucult(dosya: File): Promise<Blob> {
  try {
    const resim = await createImageBitmap(dosya);
    const oran = Math.min(1, 2000 / Math.max(resim.width, resim.height));
    const tuval = document.createElement("canvas");
    tuval.width = Math.round(resim.width * oran);
    tuval.height = Math.round(resim.height * oran);
    tuval.getContext("2d")?.drawImage(resim, 0, 0, tuval.width, tuval.height);
    const blob = await new Promise<Blob | null>((cozum) => tuval.toBlob(cozum, "image/jpeg", 0.85));
    return blob && blob.size > 0 ? blob : dosya;
  } catch {
    return dosya;
  }
}

export default function GiderForm({
  bugunTarih,
  baslangic,
  veresiyeYerleri = [],
  baslik,
  altBaslik,
  ilkVeresiye = false,
  ilkVeresiyeYer,
  araclar = [],
}: {
  /** Birden fazla araç varsa "Tır" seçimi görünür */
  araclar?: AracSecenek[];
  baslik: string;
  altBaslik: string;
  /** Veresiye defterinden "+ Veresiye gider" ile gelindi */
  ilkVeresiye?: boolean;
  ilkVeresiyeYer?: string;
  bugunTarih: string;
  baslangic?: GiderFormBaslangic;
  /** Daha önce veresiye alınan yerler (öneri listesi) */
  veresiyeYerleri?: string[];
}) {
  const duzenle = Boolean(baslangic);
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(
    duzenle ? giderGuncelle : giderEkle,
    null
  );
  const [kategori, setKategori] = useState(baslangic?.kategori || "YAKIT");
  const [fisSil, setFisSil] = useState(false);
  const [veresiye, setVeresiye] = useState(baslangic ? baslangic.odeme === "VERESIYE" : ilkVeresiye);
  const [d, setD] = useState<Doldurulan>({ sayac: 0 });
  const [okuma, setOkuma] = useState<{ durum: "okuyor" | "tamam" | "hata"; mesaj: string } | null>(null);
  const okumaNo = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);

  async function fisiOku(dosya: File | null) {
    const no = ++okumaNo.current;
    if (!dosya) return setOkuma(null);
    setOkuma({ durum: "okuyor", mesaj: "Fiş okunuyor…" });
    try {
      const form = new FormData();
      form.append("fis", await fisKucult(dosya), "fis.jpg");
      const yanit = await fetch("/api/ai/fis-oku", { method: "POST", body: form });
      const veri = (await yanit.json().catch(() => ({}))) as { sonuc?: FisSonucu; hata?: string };
      if (no !== okumaNo.current) return;
      const r = veri.sonuc;
      if (!yanit.ok || !r) return setOkuma({ durum: "hata", mesaj: veri.hata || "Fiş okunamadı, elle doldur." });
      if (!r.okunabildi || !r.toplamTutarTl) {
        return setOkuma({ durum: "hata", mesaj: "Fiş net okunamadı — tutarı elle yaz, fotoğraf yine kaydolur." });
      }
      // Yalnız boş / dokunulmamış alanları doldur; kullanıcının yazdığı kalır
      const alan = (ad: string) => formRef.current?.elements.namedItem(ad) as HTMLInputElement | null;
      const bos = (ad: string) => !alan(ad)?.value.trim();
      const yaz = (ad: string, deger: string) => {
        const el = alan(ad);
        if (el) el.value = deger;
      };
      const parca: string[] = [];
      if (bos("tutar")) {
        if (!duzenle && gecerliKategoriMi(r.kategori) && r.kategori !== "DIGER") setKategori(r.kategori);
        setD((o) => ({
          sayac: o.sayac + 1,
          tutar: kurustanGiris(Math.round(r.toplamTutarTl! * 100)),
          kdvli: r.kdvTutarTl ? true : undefined,
          kdvDahilMi: r.kdvDahilMi,
          yer: r.firmaAdi || undefined,
        }));
        parca.push("tutar");
      } else if (r.firmaAdi) {
        setD((o) => ({ ...o, yer: r.firmaAdi || undefined }));
      }
      if (r.tarih && /^\d{4}-\d{2}-\d{2}$/.test(r.tarih) && alan("tarih")?.value === (baslangic?.tarih || bugunTarih)) {
        yaz("tarih", r.tarih);
        parca.push("tarih");
      }
      if (r.litre && bos("litre")) {
        // Litre alanı yakıt dışında yok; kategori yakıta dönecekse bir tik sonra yaz
        const litre = String(r.litre).replace(".", ",");
        setTimeout(() => bos("litre") && yaz("litre", litre), 0);
        parca.push("litre");
      }
      if (r.firmaAdi && bos("aciklama")) yaz("aciklama", r.firmaAdi);
      if (r.firmaAdi && alan("veresiyeYer") && bos("veresiyeYer")) yaz("veresiyeYer", r.firmaAdi);
      setOkuma({
        durum: "tamam",
        mesaj: parca.length ? `Fişten ${parca.join(", ")} dolduruldu — kontrol et.` : "Fiş okundu; yazdıkların korunuyor.",
      });
    } catch {
      if (no === okumaNo.current) setOkuma({ durum: "hata", mesaj: "Bağlantı yok — tutarı elle yaz." });
    }
  }

  const demirbas = kategori === "DEMIRBAS";
  const kredi = kategori === "KREDI_ODEME";
  const varsayilanKdvli =
    baslangic?.kdvli !== undefined ? baslangic.kdvli : !kredi;

  return (
    <div className="sf-sayfa">
      <header className="ana-ust gd-form-ust">
        <div className="ana-ust-zemin" aria-hidden />
        <div className="ana-ic relative">
          <div className="ana-gir flex items-center gap-3 pt-3">
            <Link href="/giderler" aria-label="Giderlere dön" className="ana-zil flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </Link>
            <div className="min-w-0 flex-1 leading-tight">
              <h1 className="text-[1.6rem] font-extrabold tracking-[-0.03em] text-white">{baslik}</h1>
              <p className="text-[13.5px] text-[#b8c1f5]">{altBaslik}</p>
            </div>
            <Image src="/ana/gider-fis.png" alt="" width={150} height={140} className="h-16 w-auto shrink-0" />
          </div>
        </div>
      </header>

      <div className="ana-ic relative z-10">
        <form ref={formRef} action={aksiyon} encType="multipart/form-data" className="sf-kagit ana-gir" style={{ animationDelay: "80ms" }}>
          <span className="sf-tutamac" aria-hidden />
          {baslangic && <input type="hidden" name="giderId" value={baslangic.id} />}
          {fisSil && <input type="hidden" name="fisSil" value="1" />}

          {baslangic?.fisResmi && !fisSil && (
            <div className="flex items-center gap-3 rounded-2xl bg-[#f6f7fb] p-2.5">
              <a href={baslangic.fisResmi} target="_blank" rel="noreferrer" className="shrink-0 overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={baslangic.fisResmi} alt="Mevcut fiş" className="h-16 w-16 object-cover" />
              </a>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold">Mevcut fatura / fiş</p>
                <button type="button" onClick={() => setFisSil(true)} className="text-[13px] font-semibold text-[#dc2626]">
                  Bu fişi kaldır
                </button>
              </div>
            </div>
          )}

          <div id="fis">
            <FisYukle
              vurgulu={demirbas || kredi}
              baslik={
                baslangic?.fisResmi && !fisSil
                  ? "Yeni fiş (değiştirmek için)"
                  : demirbas
                    ? "Fatura çek / yükle (önerilir)"
                    : kredi
                      ? "Dekont / makbuz çek"
                      : "Fiş çek / yükle"
              }
              aciklama="Fotoğraf çek veya galeriden seç — AI tutarı, litreyi ve tarihi okur."
              onDosya={(f) => void fisiOku(f)}
              altBilgi={
                okuma && (
                  <p
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold ${
                      okuma.durum === "okuyor" ? "bg-[#eef0ff] text-[#4338ca]" : okuma.durum === "tamam" ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#fee2e2] text-[#b91c1c]"
                    }`}
                    aria-live="polite"
                  >
                    {okuma.durum === "okuyor" && <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[#4338ca] border-t-transparent" />}
                    {okuma.mesaj}
                  </p>
                )
              }
            />
            <p className="mt-2 flex items-center gap-2 rounded-xl bg-[#f3f5fb] px-3 py-2 text-[12px] font-semibold text-[#3b4262]">
              <span className="text-[var(--a-indigo)]" aria-hidden>
                ⓘ
              </span>
              Fişten okunan bilgileri kontrol et; kaydı sen onaylarsın.
            </p>
          </div>

          <div className="gd-satirlar">
            <label htmlFor="tarih" className="gd-satir-etiket">
              Tarih
            </label>
            <div className="sf-alan">
              <input id="tarih" name="tarih" type="date" required defaultValue={baslangic?.tarih || bugunTarih} className="sf-girdi" />
            </div>

            <label htmlFor="kategori" className="gd-satir-etiket">
              Kategori
            </label>
            <div className="sf-alan">
              <KategoriIkon kod={kategori} />
              <select id="kategori" name="kategori" required value={kategori} onChange={(e) => setKategori(e.target.value)} className="sf-girdi sf-secim">
                {giderKategoriGruplari().map((g) => (
                  <optgroup key={g.grup} label={g.ad}>
                    {g.kategoriler.map((k) => (
                      <option key={k.kod} value={k.kod}>
                        {k.ad}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {araclar.length > 1 && (
              <>
                <label htmlFor="aracId" className="gd-satir-etiket">
                  Tır / şoför
                </label>
                <div className="sf-alan">
                  <select
                    id="aracId"
                    name="aracId"
                    defaultValue={String(
                      (baslangic ? (baslangic.aracId ?? araclar[0]?.id) : araclar.find((a) => a.aktif)?.id) ?? ""
                    )}
                    className="sf-girdi sf-secim"
                  >
                    {araclar.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.etiket}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <AnimatePresence initial={false} mode="popLayout">
            {demirbas && (
              <m.p key="demirbas" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="rounded-2xl bg-[#fff8eb] px-3 py-2.5 text-[12.5px] text-[#7c2d12]">
                Tır / dorse / ekipman alımı. <b>İşletme giderine yazılmaz</b>, ama fatura KDV&apos;si panoya yansır. Açıklamaya plaka / model yaz.
              </m.p>
            )}
            {kredi && (
              <m.p key="kredi" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="rounded-2xl bg-[#f3f5fb] px-3 py-2.5 text-[12.5px] text-[#3b4262]">
                Banka / finansman taksit ödemesi. Genelde KDV&apos;sizdir; gerekirse KDV&apos;li seçebilirsin.
              </m.p>
            )}
          </AnimatePresence>

          <TutarKdvGirisi
            tema="acik"
            key={`${kategori}-${baslangic?.id || "yeni"}-${d.sayac}`}
            etiket={demirbas ? "Alım tutarı" : kredi ? "Ödeme tutarı" : "Tutar"}
            varsayilanKdvli={varsayilanKdvli}
            baslangicTutar={d.tutar || baslangic?.tutarYazi || ""}
            baslangicKdvli={d.kdvli ?? baslangic?.kdvli}
            baslangicKdvDahilMi={d.kdvDahilMi ?? baslangic?.kdvDahilMi ?? true}
            kdvEtiketi="İndirilecek KDV"
            kdvNotu="Bu KDV’yi devlete ekstra ödemezsin; yüklerden gelen KDV borcundan düşülür."
          />

          <AnimatePresence initial={false}>
            {kategori === "YAKIT" && (
              <m.div
                key="yakit"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="litre" className="sf-etiket">
                      Litre
                    </label>
                    <div className="sf-alan">
                      <input id="litre" name="litre" type="text" inputMode="decimal" placeholder="Örnek: 350" defaultValue={baslangic?.litre || ""} className="sf-girdi" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="km" className="sf-etiket">
                      Gösterge km
                    </label>
                    <div className="sf-alan">
                      <input id="km" name="km" type="text" inputMode="numeric" placeholder="Örnek: 452000" defaultValue={baslangic?.km || ""} className="sf-girdi" />
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 text-[11.5px] text-[var(--a-ikincil)]">Her dolumda ikisini de yaz: 100 km&apos;de kaç litre yaktığın ve bakım km&apos;si buradan hesaplanır.</p>
              </m.div>
            )}
          </AnimatePresence>

          {!kredi && (
            <div>
              <input type="hidden" name="odeme" value={veresiye ? "VERESIYE" : "PESIN"} />
              <span className="sf-etiket">Ödeme şekli</span>
              <div className="sf-segment" role="group" aria-label="Ödeme şekli">
                {(
                  [
                    [false, "Peşin"],
                    [true, "Veresiye"],
                  ] as const
                ).map(([deger, ad]) => {
                  const secili = veresiye === deger;
                  return (
                    <button key={ad} type="button" aria-pressed={secili} onClick={() => setVeresiye(deger)} className={`sf-segment-oge relative ${secili ? "!text-white" : ""}`}>
                      {secili && <m.span layoutId="odeme-sekli" className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6d6af8] to-[#4338ca] shadow-[0_8px_16px_-10px_rgba(79,70,229,0.9)]" transition={{ type: "spring", stiffness: 520, damping: 42 }} />}
                      <span className="relative">{secili ? `✓ ${ad}` : ad}</span>
                    </button>
                  );
                })}
              </div>
              <AnimatePresence initial={false}>
                {veresiye && (
                  <m.div
                    key="yer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 40 }}
                    className="overflow-hidden"
                  >
                    <label htmlFor="veresiyeYer" className="sf-etiket mt-3">
                      Alınan yer
                    </label>
                    <div className="sf-alan">
                      <span className="sf-alan-ikon" aria-hidden>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                          <path d="M4 10 5.5 4h13L20 10M4 10v10h16V10M4 10h16M9 20v-5h6v5" />
                        </svg>
                      </span>
                      <input
                        id="veresiyeYer"
                        name="veresiyeYer"
                        required
                        autoComplete="off"
                        defaultValue={baslangic?.veresiyeYer || d.yer || ilkVeresiyeYer || ""}
                        placeholder="Örnek: Opet Gerede"
                        className="sf-girdi"
                      />
                    </div>
                    {veresiyeYerleri.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {veresiyeYerleri.slice(0, 6).map((y) => (
                          <button
                            key={y}
                            type="button"
                            onClick={() => {
                              const el = formRef.current?.elements.namedItem("veresiyeYer") as HTMLInputElement | null;
                              if (el) el.value = y;
                            }}
                            className="ana-cip ana-cip-oneri !min-h-8 !text-[12.5px]"
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="mt-1.5 text-[11.5px] text-[var(--a-ikincil)]">Gider olarak bir kez yazılır; veresiye defterine düşer. Ödemesi ayrıca gider sayılmaz.</p>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div>
            <label htmlFor="aciklama" className="sf-etiket">
              Açıklama <span className="font-medium text-[var(--a-ikincil)]">{demirbas ? "(ör. plaka / model)" : "(isteğe bağlı)"}</span>
            </label>
            <div className="sf-alan">
              <input
                id="aciklama"
                name="aciklama"
                type="text"
                placeholder={demirbas ? "Örnek: 2020 Mercedes Actros · 34 ABC 123" : kredi ? "Örnek: Garanti — tır kredisi 3. taksit" : "Örnek: Ekim ayı yakıt alımı"}
                defaultValue={baslangic?.aciklama || ""}
                className="sf-girdi"
              />
            </div>
          </div>

          {durum?.hata && (
            <p role="alert" className="rounded-2xl bg-[#fee2e2] px-3 py-2.5 text-[13.5px] font-semibold text-[#b91c1c]">
              {durum.hata}
            </p>
          )}

          <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full !min-h-12 gap-2 !text-[15px] disabled:opacity-60">
            {bekliyor && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />}
            {bekliyor ? "Kaydediliyor…" : duzenle ? "Değişiklikleri kaydet" : "Gideri kaydet"}
          </button>
        </form>
      </div>
    </div>
  );
}
