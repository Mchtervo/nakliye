"use client";

import { useRef, useState, useTransition } from "react";
import { profilFotografiKaydet } from "@/app/uye-actions";

/** Telefon fotoğrafı büyük olur: yüklemeden önce 800 px JPEG'e küçült. */
export async function kucult(dosya: File): Promise<Blob> {
  try {
    const resim = await createImageBitmap(dosya);
    const oran = Math.min(1, 800 / Math.max(resim.width, resim.height));
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

/** Profil fotoğrafı: yuvarlak önizleme + seç / kaldır. Yoksa isim baş harfleri. */
export default function ProfilFotografi({ fotograf, ad }: { fotograf: string | null; ad: string }) {
  const girdi = useRef<HTMLInputElement>(null);
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const harfler =
    ad
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toLocaleUpperCase("tr-TR"))
      .join("") || "?";

  function gonder(f: FormData) {
    setHata(null);
    basla(async () => {
      const r = await profilFotografiKaydet(null, f);
      if (r?.hata) setHata(r.hata);
    });
  }

  async function secildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    e.target.value = "";
    if (!dosya) return;
    const f = new FormData();
    f.append("fotograf", await kucult(dosya), "profil.jpg");
    gonder(f);
  }

  return (
    <div className="rp-kart flex items-center gap-4 p-4">
      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full bg-[#e0e7ff]">
        {fotograf ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotograf} alt="Profil fotoğrafı" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[24px] font-extrabold text-[#3730a3]">{harfler}</span>
        )}
        {bekliyor && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[11px] font-bold text-[#3730a3]">…</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <input ref={girdi} type="file" accept="image/*" onChange={secildi} className="hidden" aria-label="Profil fotoğrafı seç" />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={bekliyor} onClick={() => girdi.current?.click()} className="ana-ana-dugme !min-h-10 !px-4 !text-[14px] disabled:opacity-60">
            {fotograf ? "Fotoğrafı değiştir" : "Fotoğraf ekle"}
          </button>
          {fotograf && (
            <button
              type="button"
              disabled={bekliyor}
              onClick={() => {
                const f = new FormData();
                f.append("kaldir", "1");
                gonder(f);
              }}
              className="sf-ikincil-dugme !min-h-10 !px-4 !text-[14px] !text-[#dc2626] disabled:opacity-60"
            >
              Kaldır
            </button>
          )}
        </div>
        {hata && (
          <p role="alert" className="text-[12.5px] font-semibold text-[#b91c1c]">
            {hata}
          </p>
        )}
      </div>
    </div>
  );
}
