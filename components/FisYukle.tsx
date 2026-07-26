"use client";

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
      // Büyük telefon fotoğrafı / HEIC sekme çökertmesin: önce küçült.
      const blob = await gorseliKucult(ham, 1600, 0.8);
      const dosya = new File(
        [blob],
        ham.name.replace(/\.[^.]+$/, "") + ".jpg",
        { type: "image/jpeg" }
      );

      if (inputRef.current) inputaDosyaKoy(inputRef.current, dosya);

      setDosyaAdi(dosya.name);
      setOnizleme(URL.createObjectURL(dosya));
      onDosya?.(dosya);
    } catch (e) {
      console.error("[fis-yukle]", e);
      setOnizleme(null);
      setDosyaAdi(null);
      setHata("Fotoğraf işlenemedi. Daha küçük bir görsel dene veya tekrar çek.");
      if (inputRef.current) inputRef.current.value = "";
      onDosya?.(null);
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
    <div
      className={`space-y-2 rounded-xl border p-3 ${
        vurgulu
          ? "border-amber/35 bg-amber/8"
          : "border-white/12 bg-white/4"
      }`}
    >
      <div>
        <span className="etiket !text-fog">{baslik}</span>
        <p className="mt-0.5 text-xs text-fog">{aciklama}</p>
      </div>

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
        <div className="flex items-center gap-2 rounded-xl border border-amber/25 bg-amber/10 px-3 py-5 text-sm font-semibold text-amber">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber border-t-transparent" />
          Fotoğraf küçültülüyor...
        </div>
      ) : !onizleme ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              if (!inputRef.current) return;
              inputRef.current.setAttribute("capture", "environment");
              inputRef.current.click();
            }}
            className="rounded-xl border border-dashed border-amber/40 bg-asphalt/60 px-3 py-5 text-sm font-semibold text-amber transition-colors hover:bg-amber/10"
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
            className="rounded-xl border border-dashed border-white/25 bg-asphalt/60 px-3 py-5 text-sm font-semibold text-paper transition-colors hover:border-amber/40 hover:text-amber"
          >
            Galeriden seç
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/12 bg-asphalt/80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={onizleme}
            alt="Fatura önizleme"
            className="max-h-56 w-full object-contain bg-black/30"
          />
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
            <span className="truncate text-xs text-fog">{dosyaAdi}</span>
            <button
              type="button"
              onClick={temizle}
              className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-ember hover:bg-ember/10"
            >
              Kaldır
            </button>
          </div>
        </div>
      )}

      {hata && (
        <p className="rounded-lg border border-ember/30 bg-ember/10 px-3 py-2 text-sm text-paper">
          {hata}
        </p>
      )}

      {altBilgi}
    </div>
  );
}
