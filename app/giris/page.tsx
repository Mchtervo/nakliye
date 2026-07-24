import GirisForm from "@/components/GirisForm";

export default async function GirisSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
      <div className="reveal text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber to-[#c97800] text-asphalt shadow-[0_8px_24px_rgba(240,160,32,0.35)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
            <path d="M1 9h12v7H1z" />
            <path d="M13 12h4l3 3v1h-7z" />
            <circle cx="6" cy="18.5" r="1.5" />
            <circle cx="17" cy="18.5" r="1.5" />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-extrabold text-paper">Nakliye Defteri</h1>
        <p className="mt-1 text-sm text-fog">Devam etmek için şifreni gir</p>
        <div className="lane-strip mx-auto mt-4 max-w-[12rem]" />
      </div>
      <div className="kart-paper mt-6 p-5 reveal reveal-d1">
        <GirisForm next={next} />
      </div>
    </div>
  );
}
