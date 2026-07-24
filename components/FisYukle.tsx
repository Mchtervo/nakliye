"use client";

import { useEffect, useRef, useState } from "react";

export default function FisYukle({
  baslik = "Fatura / fiş fotoğrafı",
  aciklama = "Muhasebeciye göndermek için çek veya galeriden seç.",
  vurgulu = false,
}: {
  baslik?: string;
  aciklama?: string;
  vurgulu?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [dosyaAdi, setDosyaAdi] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (onizleme) URL.revokeObjectURL(onizleme);
    };
  }, [onizleme]);

  function secildi(dosya: File | undefined) {
    if (onizleme) URL.revokeObjectURL(onizleme);
    if (!dosya) {
      setOnizleme(null);
      setDosyaAdi(null);
      return;
    }
    setDosyaAdi(dosya.name);
    setOnizleme(URL.createObjectURL(dosya));
  }

  function temizle() {
    if (inputRef.current) inputRef.current.value = "";
    if (onizleme) URL.revokeObjectURL(onizleme);
    setOnizleme(null);
    setDosyaAdi(null);
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
        onChange={(e) => secildi(e.target.files?.[0])}
      />

      {!onizleme ? (
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
    </div>
  );
}
