import GirisForm from "@/components/GirisForm";

export default async function GirisSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/";

  return (
    <div className="mx-auto flex min-h-[85vh] max-w-md flex-col justify-center px-2">
      <div className="reveal text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-gradient-to-b from-[#ffb340] to-[#ff8a00] text-black shadow-[inset_0_0.5px_0_rgba(255,255,255,0.4),0_12px_40px_rgba(255,159,10,0.3)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-10 w-10">
            <path d="M1 9h12v7H1z" />
            <path d="M13 12h4l3 3v1h-7z" />
            <circle cx="6" cy="18.5" r="1.5" />
            <circle cx="17" cy="18.5" r="1.5" />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-extrabold text-paper">Nakliye Defteri</h1>
        <p className="mt-1 text-[15px] text-fog">Devam etmek için şifreni gir</p>
      </div>
      <div className="kart-paper mt-8 p-5 reveal reveal-d1">
        <GirisForm next={next} />
      </div>
    </div>
  );
}
