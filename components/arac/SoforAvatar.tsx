/** Şoför profil resmi: Instagram tarzı renkli halka; fotoğraf yoksa ad baş harfleri. */
export default function SoforAvatar({
  foto,
  ad,
  boyut = 44,
  halka = true,
}: {
  foto?: string | null;
  ad?: string | null;
  boyut?: number;
  /** Renkli halka (fotoğraf varken) */
  halka?: boolean;
}) {
  const harfler =
    (ad || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toLocaleUpperCase("tr-TR"))
      .join("") || null;
  const renkli = halka && !!foto;
  return (
    <span
      className={`relative inline-flex shrink-0 rounded-full ${renkli ? "bg-[conic-gradient(from_210deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5,#feda75)] p-[2.5px]" : "bg-[#e0e7ff]"}`}
      style={{ width: boyut, height: boyut }}
      aria-hidden
    >
      <span className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#e0e7ff] ${renkli ? "ring-2 ring-white" : ""}`}>
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : harfler ? (
          <span className="font-extrabold text-[#3730a3]" style={{ fontSize: Math.round(boyut * 0.36) }}>
            {harfler}
          </span>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-[55%] w-[55%] text-[#6366f1]">
            <circle cx="12" cy="8.5" r="4" />
            <path d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5z" />
          </svg>
        )}
      </span>
    </span>
  );
}
