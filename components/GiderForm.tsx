"use client";

import { useActionState, useState } from "react";
import { giderEkle, giderGuncelle, type FormSonuc } from "@/app/actions";
import TutarKdvGirisi from "@/components/TutarKdvGirisi";
import FisYukle from "@/components/FisYukle";
import { giderKategoriGruplari, kategoriAdi } from "@/lib/sabitler";
import { gorseliKucult } from "@/lib/gorsel";
import { tlGirisBicimle } from "@/lib/para";

type OcrYanit = {
  okunabildi: boolean;
  firmaAdi: string | null;
  tarih: string | null;
  toplamTutarTl: number | null;
  kdvTutarTl: number | null;
  kdvDahilMi: boolean;
  kategori: string;
  litre: number | null;
  aciklama: string | null;
  guvenSkoru: number;
};

type OcrDegerleri = {
  tutarYazi: string;
  kdvli: boolean;
  kdvDahilMi: boolean;
  tarih: string | null;
  aciklama: string | null;
  litre: string | null;
};

type OcrDurum =
  | { hal: "bos" }
  | { hal: "okuyor" }
  | { hal: "hata"; mesaj: string }
  | { hal: "tamam"; kategori: string; guven: number };

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
};

function OcrRozeti({ durum }: { durum: OcrDurum }) {
  if (durum.hal === "bos") return null;

  if (durum.hal === "okuyor") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber/25 bg-amber/10 px-3 py-2 text-sm font-semibold text-amber">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber border-t-transparent" />
        Fiş okunuyor...
      </div>
    );
  }

  if (durum.hal === "hata") {
    return (
      <div className="rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-sm text-fog">
        {durum.mesaj}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm font-semibold text-ok">
      Fiş okundu · {kategoriAdi(durum.kategori)}
      {durum.guven < 70 && " · kontrol et"}
      <span className="ml-1 font-medium text-fog">— alanları düzeltebilirsin</span>
    </div>
  );
}

export default function GiderForm({
  bugunTarih,
  baslangic,
  aiOcr = true,
}: {
  bugunTarih: string;
  baslangic?: GiderFormBaslangic;
  /** AI_KAPALI iken false — sadece kayıt, OCR yok. */
  aiOcr?: boolean;
}) {
  const duzenle = Boolean(baslangic);
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(
    duzenle ? giderGuncelle : giderEkle,
    null
  );
  const [kategori, setKategori] = useState(baslangic?.kategori || "YAKIT");
  const [fisSil, setFisSil] = useState(false);
  const [ocrDurum, setOcrDurum] = useState<OcrDurum>({ hal: "bos" });
  const [ocr, setOcr] = useState<OcrDegerleri | null>(null);
  const [ocrSayac, setOcrSayac] = useState(0);

  const demirbas = kategori === "DEMIRBAS";
  const kredi = kategori === "KREDI_ODEME";
  const varsayilanKdvli =
    baslangic?.kdvli !== undefined ? baslangic.kdvli : !kredi;

  async function fisiOku(dosya: File | null) {
    if (!dosya) {
      setOcrDurum({ hal: "bos" });
      return;
    }

    // AI kapalıyken OCR çağırma — fotoğraf yine kayda gider.
    if (!aiOcr) {
      setOcrDurum({
        hal: "hata",
        mesaj: "AI kapalı — tutarı elle gir, fiş yine kaydolur.",
      });
      return;
    }

    setOcrDurum({ hal: "okuyor" });
    try {
      // FisYukle zaten küçülttü; yine de emniyet için.
      const kucuk = await gorseliKucult(dosya);
      const govde = new FormData();
      govde.append("fis", kucuk, "fis.jpg");

      const cevap = await fetch("/api/ai/fis-oku", {
        method: "POST",
        body: govde,
      });
      const veri = (await cevap.json().catch(() => ({}))) as {
        hata?: string;
        sonuc?: OcrYanit;
      };

      if (!cevap.ok) {
        setOcrDurum({
          hal: "hata",
          mesaj: veri?.hata || "Fiş okunamadı — elle doldur, kayıt çalışır.",
        });
        return;
      }

      const s = veri.sonuc as OcrYanit;
      if (!s?.okunabildi || s.toplamTutarTl === null) {
        setOcrDurum({
          hal: "hata",
          mesaj: "Fiş net okunamadı, bilgileri elle gir.",
        });
        return;
      }

      const degerler: OcrDegerleri = {
        tutarYazi: tlGirisBicimle(
          s.toplamTutarTl.toFixed(2).replace(".", ",").replace(/,00$/, "")
        ),
        kdvli: s.kdvTutarTl === null ? true : s.kdvTutarTl > 0,
        kdvDahilMi: s.kdvDahilMi !== false,
        tarih: s.tarih && /^\d{4}-\d{2}-\d{2}$/.test(s.tarih) ? s.tarih : null,
        aciklama: [s.firmaAdi, s.aciklama].filter(Boolean).join(" - ") || null,
        litre: s.litre ? String(s.litre).replace(".", ",") : null,
      };

      setKategori(s.kategori);
      setOcr(degerler);
      setOcrSayac((n) => n + 1);
      setOcrDurum({
        hal: "tamam",
        kategori: s.kategori,
        guven: s.guvenSkoru,
      });
    } catch {
      setOcrDurum({ hal: "hata", mesaj: "Fiş okunurken bağlantı hatası." });
    }
  }

  return (
    <form action={aksiyon} className="space-y-4" encType="multipart/form-data">
      {baslangic && <input type="hidden" name="giderId" value={baslangic.id} />}
      {fisSil && <input type="hidden" name="fisSil" value="1" />}

      <div>
        <label htmlFor="tarih" className="etiket">
          Tarih
        </label>
        <input
          key={`tarih-${ocrSayac}`}
          id="tarih"
          name="tarih"
          type="date"
          required
          defaultValue={ocr?.tarih || baslangic?.tarih || bugunTarih}
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
        key={`${kategori}-${baslangic?.id || "yeni"}-${ocrSayac}`}
        etiket={demirbas ? "Alım tutarı" : kredi ? "Ödeme tutarı" : "Gider tutarı"}
        varsayilanKdvli={varsayilanKdvli}
        baslangicTutar={ocr?.tutarYazi || baslangic?.tutarYazi || ""}
        baslangicKdvli={ocr ? ocr.kdvli : baslangic?.kdvli}
        baslangicKdvDahilMi={ocr ? ocr.kdvDahilMi : (baslangic?.kdvDahilMi ?? true)}
        kdvEtiketi="İndirilecek KDV"
        kdvNotu="Bu KDV’yi devlete ekstra ödemezsin; yüklerden gelen KDV borcundan düşülür."
      />

      {kategori === "YAKIT" && (
        <div className="grid grid-cols-2 gap-3 reveal">
          <div>
            <label htmlFor="litre" className="etiket">
              Litre (isteğe bağlı)
            </label>
            <input
              key={`litre-${ocrSayac}`}
              id="litre"
              name="litre"
              type="text"
              inputMode="decimal"
              placeholder="Örnek: 350"
              defaultValue={ocr?.litre || baslangic?.litre || ""}
              className="alan"
            />
          </div>
          <div>
            <label htmlFor="km" className="etiket">
              Araç km (isteğe bağlı)
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

      <div>
        <label htmlFor="aciklama" className="etiket">
          Açıklama {demirbas ? "(ör. plaka / model)" : "(isteğe bağlı)"}
        </label>
        <input
          key={`aciklama-${ocrSayac}`}
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
          defaultValue={ocr?.aciklama || baslangic?.aciklama || ""}
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
        onDosya={fisiOku}
        baslik={
          baslangic?.fisResmi && !fisSil
            ? "Yeni fatura / fiş (değiştirmek için)"
            : demirbas
              ? "Fatura fotoğrafı (önerilir)"
              : kredi
                ? "Dekont / makbuz fotoğrafı"
                : "Fatura / fiş fotoğrafı"
        }
        aciklama={
          demirbas
            ? "Tır faturasını çek — Muhasebeciye Gönder sayfasından iletirsin."
            : "Fotoğrafı çek, yapay zekâ tutarı ve KDV'yi kendi doldursun."
        }
        altBilgi={<OcrRozeti durum={ocrDurum} />}
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
