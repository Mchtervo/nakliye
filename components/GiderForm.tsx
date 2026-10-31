"use client";

import { useActionState, useRef, useState } from "react";
import { giderEkle, giderGuncelle, type FormSonuc } from "@/app/actions";
import TutarKdvGirisi from "@/components/TutarKdvGirisi";
import FisYukle from "@/components/FisYukle";
import { gecerliKategoriMi, giderKategoriGruplari } from "@/lib/sabitler";
import { kurustanGiris } from "@/lib/para";

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
};

export default function GiderForm({
  bugunTarih,
  baslangic,
  veresiyeYerleri = [],
}: {
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
  const [veresiye, setVeresiye] = useState(baslangic?.odeme === "VERESIYE");
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
      form.append("fis", dosya);
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
    <form ref={formRef} action={aksiyon} className="space-y-4" encType="multipart/form-data">
      {baslangic && <input type="hidden" name="giderId" value={baslangic.id} />}
      {fisSil && <input type="hidden" name="fisSil" value="1" />}

      <div>
        <label htmlFor="tarih" className="etiket">
          Tarih
        </label>
        <input
          id="tarih"
          name="tarih"
          type="date"
          required
          defaultValue={baslangic?.tarih || bugunTarih}
          className="alan"
        />
      </div>

      <div>
        <label htmlFor="kategori" className="etiket">
          Kategori
        </label>
        <select
          id="kategori"
          name="kategori"
          required
          value={kategori}
          onChange={(e) => setKategori(e.target.value)}
          className="alan"
        >
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

      {demirbas && (
        <div className="rounded-xl border border-amber/25 bg-amber/10 px-3 py-2.5 text-sm text-paper">
          Tır / dorse / ekipman alımı. <strong>İşletme giderine yazılmaz</strong>,
          ama fatura KDV&apos;si panoya yansır. Açıklamaya plaka / model yaz.
        </div>
      )}
      {kredi && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-fog">
          Banka / finansman taksit ödemesi. Genelde KDV&apos;sizdir; gerekirse
          aşağıdan KDV&apos;li seçebilirsin.
        </div>
      )}

      <TutarKdvGirisi
        key={`${kategori}-${baslangic?.id || "yeni"}-${d.sayac}`}
        etiket={demirbas ? "Alım tutarı" : kredi ? "Ödeme tutarı" : "Gider tutarı"}
        varsayilanKdvli={varsayilanKdvli}
        baslangicTutar={d.tutar || baslangic?.tutarYazi || ""}
        baslangicKdvli={d.kdvli ?? baslangic?.kdvli}
        baslangicKdvDahilMi={d.kdvDahilMi ?? baslangic?.kdvDahilMi ?? true}
        kdvEtiketi="İndirilecek KDV"
        kdvNotu="Bu KDV’yi devlete ekstra ödemezsin; yüklerden gelen KDV borcundan düşülür."
      />

      {kategori === "YAKIT" && (
        <div className="grid grid-cols-2 gap-3 reveal">
          <p className="col-span-2 text-xs text-fog">
            Her dolumda ikisini de yaz: 100 km&apos;de kaç litre yaktığın ve bakım km&apos;si buradan hesaplanır.
          </p>
          <div>
            <label htmlFor="litre" className="etiket">
              Alınan litre
            </label>
            <input
              id="litre"
              name="litre"
              type="text"
              inputMode="decimal"
              placeholder="Örnek: 350"
              defaultValue={baslangic?.litre || ""}
              className="alan"
            />
          </div>
          <div>
            <label htmlFor="km" className="etiket">
              Göstergedeki km
            </label>
            <input
              id="km"
              name="km"
              type="text"
              inputMode="numeric"
              placeholder="Örnek: 452000"
              defaultValue={baslangic?.km || ""}
              className="alan"
            />
          </div>
        </div>
      )}

      {!kredi && (
        <div>
          <input type="hidden" name="odeme" value={veresiye ? "VERESIYE" : "PESIN"} />
          <span className="etiket">Ödeme</span>
          <div className="secenek-grup">
            <button type="button" className={`secenek ${!veresiye ? "aktif" : ""}`} onClick={() => setVeresiye(false)}>
              Peşin ödendi
            </button>
            <button type="button" className={`secenek ${veresiye ? "aktif" : ""}`} onClick={() => setVeresiye(true)}>
              Veresiye alındı
            </button>
          </div>
          {veresiye && (
            <div className="mt-3 reveal">
              <label htmlFor="veresiyeYer" className="etiket">
                Nereden? (istasyon / dükkân)
              </label>
              <input
                id="veresiyeYer"
                name="veresiyeYer"
                required
                autoComplete="off"
                defaultValue={baslangic?.veresiyeYer || d.yer || ""}
                placeholder="Örnek: Opet Gerede"
                className="alan"
              />
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
                      className="rounded-full border border-white/12 px-3 py-1 text-sm text-paper active:scale-95"
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-xs text-fog">Veresiye defterine yazılır; ödedikçe oradan düşersin.</p>
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="aciklama" className="etiket">
          Açıklama {demirbas ? "(ör. plaka / model)" : "(isteğe bağlı)"}
        </label>
        <input
          id="aciklama"
          name="aciklama"
          type="text"
          placeholder={
            demirbas
              ? "Örnek: 2020 Mercedes Actros · 34 ABC 123"
              : kredi
                ? "Örnek: Garanti — tır kredisi 3. taksit"
                : "Örnek: Opet - E5 üzeri"
          }
          defaultValue={baslangic?.aciklama || ""}
          className="alan"
        />
      </div>

      {baslangic?.fisResmi && !fisSil && (
        <div className="space-y-2 rounded-xl border border-white/12 bg-white/4 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Mevcut fatura / fiş
          </div>
          <a href={baslangic.fisResmi} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={baslangic.fisResmi}
              alt="Mevcut fiş"
              className="max-h-40 w-full rounded-lg object-contain bg-black/30"
            />
          </a>
          <button
            type="button"
            onClick={() => setFisSil(true)}
            className="text-sm font-semibold text-ember hover:underline"
          >
            Bu fişi kaldır
          </button>
        </div>
      )}

      <FisYukle
        vurgulu={demirbas || kredi}
        baslik={
          baslangic?.fisResmi && !fisSil
            ? "Yeni fatura / fiş (değiştirmek için)"
            : demirbas
              ? "Fatura fotoğrafı (önerilir)"
              : kredi
                ? "Dekont / makbuz fotoğrafı"
                : "Fatura / fiş fotoğrafı"
        }
        aciklama="Çek veya seç — AI tutarı, litreyi ve tarihi okuyup doldurur. Sen kontrol edip kaydet."
        onDosya={(f) => void fisiOku(f)}
        altBilgi={
          okuma && (
            <p
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                okuma.durum === "okuyor"
                  ? "bg-amber/10 text-amber"
                  : okuma.durum === "tamam"
                    ? "bg-teal/10 text-teal"
                    : "bg-ember/10 text-ember"
              }`}
              aria-live="polite"
            >
              {okuma.durum === "okuyor" && (
                <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-amber border-t-transparent" />
              )}
              {okuma.mesaj}
            </p>
          )
        }
      />

      {durum?.hata && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm font-semibold text-ember">
          {durum.hata}
        </div>
      )}

      <button type="submit" disabled={bekliyor} className="btn btn-amber btn-block">
        {bekliyor
          ? "Kaydediliyor..."
          : duzenle
            ? "Değişiklikleri Kaydet"
            : "Gideri Kaydet"}
      </button>
    </form>
  );
}
