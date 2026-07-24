"use client";

import { useEffect, useRef, useState } from "react";

export default function FisYukle() {
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
    <div className="space-y-2">
      <span className="etiket">Fiş / fatura resmi (isteğe bağlı)</span>

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
            className="rounded-xl border border-dashed border-black/15 bg-white px-3 py-5 text-sm font-semibold text-ink transition-all hover:border-amber hover:bg-amber/5"
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
            className="rounded-xl border border-dashed border-black/15 bg-white px-3 py-5 text-sm font-semibold text-ink transition-all hover:border-amber hover:bg-amber/5"
          >
            Galeriden seç
          </button>
        </div>
      ) : (
        <div className="reveal overflow-hidden rounded-xl border border-black/10 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={onizleme}
            alt="Fiş önizleme"
            className="max-h-56 w-full object-contain bg-[#f3f5f8]"
          />
          <div className="flex items-center justify-between gap-2 border-t border-black/5 px-3 py-2">
            <span className="truncate text-xs text-[#5a6a80]">{dosyaAdi}</span>
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
