import Image from "next/image";

function Pin({ renk }: { renk: string }) {
  return (
    <svg viewBox="0 0 24 30" className="h-9 w-7 drop-shadow-[0_0_12px_rgba(110,140,255,0.8)]" aria-hidden>
      <path d="M12 1C6 1 1.5 5.5 1.5 11.2 1.5 19 12 29 12 29s10.5-10 10.5-17.8C22.5 5.5 18 1 12 1z" fill={renk} />
      <circle cx="12" cy="11" r="4" fill="#fff" />
    </svg>
  );
}

/**
 * Lacivert başlıktaki rota: yükleme iğnesi – kesikli yol – tır – boşaltma iğnesi.
 * Sağ uç boşsa yalnız sol iğne + "Her yön".
 */
export default function RotaCizgi({ sol, sag }: { sol: string | null; sag: string | null }) {
  return (
    <div className="yuk-rota" aria-label={`${sol ?? "Konum yok"} → ${sag ?? "her yön"}`}>
      <div className="yuk-rota-uc">
        <Pin renk="#5b8cff" />
        <span>{sol ?? "Konum yok"}</span>
      </div>
      <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="yuk-rota-yol" aria-hidden>
        <path d="M4 44 C 40 50, 60 26, 96 34 S 160 50, 196 12" fill="none" stroke="#8fa2ff" strokeWidth="2.2" strokeDasharray="5 7" strokeLinecap="round" />
      </svg>
      <Image src="/ana/tir.webp" alt="" width={140} height={91} className="yuk-rota-tir" />
      <div className="yuk-rota-uc yuk-rota-sag">
        <Pin renk="#a78bfa" />
        <span>{sag ?? "Her yön"}</span>
      </div>
    </div>
  );
}
