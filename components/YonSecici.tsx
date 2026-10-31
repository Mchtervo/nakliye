"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { yonleriKaydet } from "@/app/ai-actions";

/**
 * "Ne tarafa yük arıyoruz" — istediğin kadar il/ilçe. Gerede yazılırsa
 * Bolu olarak eklenir; her il 60 km çevresiyle birlikte aranır.
 */
export default function YonSecici({
  yonler,
  iller,
  cevreler,
}: {
  yonler: string[];
  iller: readonly string[];
  /** il → çevresindeki iller (bilgi satırı için) */
  cevreler: Record<string, string[]>;
}) {
  const router = useRouter();
  const [liste, setListe] = useState(yonler);
  const [yazi, setYazi] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();

  function kaydet(yeni: string[], eklenen?: string) {
    setHata(null);
    baslat(async () => {
      const kayitli = await yonleriKaydet(yeni);
      if (eklenen && kayitli.length === liste.length) {
        setHata(`"${eklenen}" tanınmadı ya da zaten listede — il ya da ilçe yaz (örn. Bolu, Gerede).`);
      } else {
        setYazi("");
      }
      setListe(kayitli);
      router.refresh();
    });
  }

  function ekle() {
    const y = yazi.trim();
    if (!y) return;
    kaydet([...liste, y], y);
  }

  // Yazdıkça eşleşen iller (Türkçe harf duyarsız), en fazla 6
  const kucuk = (s: string) => s.toLocaleLowerCase("tr-TR");
  const aranan = kucuk(yazi.trim());
  const oneriler = aranan
    ? iller.filter((il) => kucuk(il).startsWith(aranan) && !liste.includes(il) && kucuk(il) !== aranan).slice(0, 6)
    : [];

  const cevre = liste.flatMap((il) => cevreler[il] ?? []).filter((x) => !liste.includes(x));

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-paper">Ne tarafa yük arıyorsun?</p>
      {liste.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {liste.map((il) => (
            <span key={il} className="inline-flex items-center gap-1 rounded-full bg-amber/15 py-1 pl-3 pr-1 text-sm text-paper">
              {il}
              <button
                type="button"
                disabled={bekliyor}
                onClick={() => kaydet(liste.filter((x) => x !== il))}
                aria-label={`${il} çıkar`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-fog hover:bg-white/10 hover:text-paper"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ekle();
        }}
        className="flex gap-2"
      >
        {/* datalist yok: iPad Safari'de klavye yerine liste açıyordu */}
        <input
          value={yazi}
          onChange={(e) => setYazi(e.target.value)}
          type="text"
          inputMode="text"
          placeholder={liste.length ? "Bir şehir daha ekle" : "Bolu, Gerede, İstanbul…"}
          className="alan min-w-0 flex-1"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          enterKeyHint="done"
        />
        <button type="submit" disabled={bekliyor || !yazi.trim()} className="btn btn-amber shrink-0 !px-4 disabled:opacity-50">
          Ekle
        </button>
      </form>
      {oneriler.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {oneriler.map((il) => (
            <button
              key={il}
              type="button"
              disabled={bekliyor}
              onClick={() => kaydet([...liste, il], il)}
              className="rounded-full border border-white/12 px-3 py-1 text-sm text-paper active:scale-95"
            >
              + {il}
            </button>
          ))}
        </div>
      )}
      {hata && <p className="text-sm font-semibold text-ember">{hata}</p>}
      <p className="text-xs text-fog">
        {liste.length === 0
          ? "Boş: her yöne giden yükler gelir."
          : `Sadece bu şehirlere${cevre.length ? ` (ve yakını: ${[...new Set(cevre)].join(", ")})` : ""} giden yükler gelir.`}
      </p>
    </div>
  );
}
