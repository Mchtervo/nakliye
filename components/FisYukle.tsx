"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { gorseliKucult } from "@/lib/gorsel";

/** Input'a sıkıştırılmış dosyayı yazar (form submit de küçük gider). */
function inputaDosyaKoy(input: HTMLInputElement, dosya: File) {
  const dt = new DataTransfer();
  dt.items.add(dosya);
  input.files = dt.files;
}

export default function FisYukle({
  baslik = "Fatura / fiş fotoğrafı",
  aciklama = "Muhasebeciye göndermek için çek veya galeriden seç.",
  vurgulu = false,
  onDosya,
  altBilgi,
}: {
  baslik?: string;
  aciklama?: string;
  vurgulu?: boolean;
  /** Dosya seçildiğinde/kaldırıldığında haber verir (OCR için). */
  onDosya?: (dosya: File | null) => void;
  /** Önizlemenin altında gösterilecek ek içerik (OCR durumu gibi). */
  altBilgi?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [dosyaAdi, setDosyaAdi] = useState<string | null>(null);
  const [hazirlaniyor, setHazirlaniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (onizleme) URL.revokeObjectURL(onizleme);
    };
  }, [onizleme]);

  async function secildi(ham: File | undefined) {
    if (onizleme) URL.revokeObjectURL(onizleme);
    setHata(null);

    if (!ham) {
      setOnizleme(null);
      setDosyaAdi(null);
      setHazirlaniyor(false);
      onDosya?.(null);
      return;
    }

    setHazirlaniyor(true);
    try {
      // Büyük telefon fotoğrafı sekme çökertmesin: küçültmeyi dene.
      // Başarısız olursa orijinal dosyayı olduğu gibi kullan (AI yok).
      let dosya: File = ham;
      try {
        const blob = await gorseliKucult(ham, 1920, 0.85);
        dosya = new File(
          [blob],
          ham.name.replace(/\.[^.]+$/, "") + ".jpg",
          { type: "image/jpeg" }
        );
      } catch (e) {
        console.warn("[fis-yukle] kucultme atlandi", e);
        dosya = ham;
      }

      if (inputRef.current) inputaDosyaKoy(inputRef.current, dosya);

      setDosyaAdi(dosya.name);
      setOnizleme(URL.createObjectURL(dosya));
      onDosya?.(dosya);
    } catch (e) {
      console.error("[fis-yukle]", e);
      // Son çare: ham dosyayı doğrudan koy
      try {
        if (inputRef.current) inputaDosyaKoy(inputRef.current, ham);
        setDosyaAdi(ham.name);
        setOnizleme(URL.createObjectURL(ham));
        onDosya?.(ham);
        setHata(null);
      } catch {
        setOnizleme(null);
        setDosyaAdi(null);
        setHata("Fotoğraf yüklenemedi. Tekrar dene veya JPG olarak kaydet.");
        if (inputRef.current) inputRef.current.value = "";
        onDosya?.(null);
      }
    } finally {
      setHazirlaniyor(false);
    }
  }

  function temizle() {
    if (inputRef.current) inputRef.current.value = "";
    if (onizleme) URL.revokeObjectURL(onizleme);
    setOnizleme(null);
    setDosyaAdi(null);
    setHata(null);
    onDosya?.(null);
  }

  return (
    <div className={`gd-fis ${vurgulu ? "gd-fis-vurgu" : ""}`}>
      <input
        ref={inputRef}
        id="fisResmi"
        name="fisResmi"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic"
        capture="environment"
        className="hidden"
        onChange={(e) => void secildi(e.target.files?.[0])}
      />

      {hazirlaniyor ? (
        <div className="flex items-center justify-center gap-2 py-5 text-[13.5px] font-semibold text-[#4338ca]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#4338ca] border-t-transparent" />
          Fotoğraf hazırlanıyor…
        </div>
      ) : !onizleme ? (
        <div>
          <div className="flex items-center gap-3">
            <Image src="/ana/fis-kamera.png" alt="" width={64} height={64} className="h-14 w-14 shrink-0" />
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold">{baslik}</p>
              <p className="text-[12px] text-[var(--a-ikincil)]">{aciklama}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                if (!inputRef.current) return;
                inputRef.current.setAttribute("capture", "environment");
                inputRef.current.click();
              }}
              className="ana-ana-dugme !min-h-10 !text-[13.5px]"
            >
              Kamerayla çek
            </button>
            <button
              type="button"
              onClick={() => {
                if (!inputRef.current) return;
                inputRef.current.removeAttribute("capture");
                inputRef.current.click();
              }}
              className="sf-ikincil-dugme !min-h-10"
            >
              Galeriden seç
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-[#f3f5fb]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={onizleme} alt="Fiş önizleme" className="max-h-56 w-full bg-[#e8ebf5] object-contain" />
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="truncate text-[12px] text-[var(--a-ikincil)]">{dosyaAdi}</span>
            <button type="button" onClick={temizle} className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-[#dc2626]">
              Kaldır
            </button>
          </div>
        </div>
      )}

      {hata && <p className="mt-2 rounded-xl bg-[#fee2e2] px-3 py-2 text-[13px] text-[#7f1d1d]">{hata}</p>}

      {altBilgi && <div className="mt-2">{altBilgi}</div>}
    </div>
  );
}
