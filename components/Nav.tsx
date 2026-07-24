"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKLER = [
  {
    href: "/",
    ad: "Panel",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    href: "/yukler",
    ad: "Yükler",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M1 9h12v7H1z" />
        <path d="M13 12h4l3 3v1h-7z" />
        <circle cx="6" cy="18.5" r="1.5" />
        <circle cx="17" cy="18.5" r="1.5" />
      </svg>
    ),
  },
  {
    href: "/giderler",
    ad: "Giderler",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M7 3h10v18l-2-1.4L13 21l-2-1.4L9 21l-2-1.4L5 21z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    href: "/firmalar",
    ad: "Cari",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="3.5" />
        <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.3M16.5 3.6a3.5 3.5 0 0 1 0 6.8" />
      </svg>
    ),
  },
  {
    href: "/muhasebeci",
    ad: "Gönder",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22l-4-9-9-4 20-7z" />
      </svg>
    ),
  },
] as const;

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-[#c97800] text-asphalt shadow-[0_8px_24px_rgba(240,160,32,0.35)] transition-transform group-hover:scale-105">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M1 9h12v7H1z" />
          <path d="M13 12h4l3 3v1h-7z" />
          <circle cx="6" cy="18.5" r="1.5" />
          <circle cx="17" cy="18.5" r="1.5" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="font-display block text-lg font-bold tracking-wide text-paper">
          NAKLİYE
        </span>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-amber">
          Defteri
        </span>
      </span>
    </Link>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const aktifMi = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="contents">
      {/* Masaüstü yan menü */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[16.5rem] flex-col border-r border-white/10 bg-asphalt-2/90 px-4 py-5 backdrop-blur-xl md:flex">
        <div className="mb-8 px-1">
          <Logo />
          <div className="lane-strip mt-5 opacity-70" />
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {LINKLER.map((l) => {
            const aktif = aktifMi(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  aktif
                    ? "bg-white/8 text-amber"
                    : "text-fog hover:bg-white/5 hover:text-paper"
                }`}
              >
                {aktif && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-amber shadow-[0_0_12px_rgba(240,160,32,0.8)]" />
                )}
                <span className={aktif ? "text-amber" : ""}>{l.ikon}</span>
                {l.ad}
              </Link>
            );
          })}
          <Link
            href="/raporlar"
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
              pathname.startsWith("/raporlar")
                ? "bg-white/8 text-amber"
                : "text-fog hover:bg-white/5 hover:text-paper"
            }`}
          >
            {pathname.startsWith("/raporlar") && (
              <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-amber shadow-[0_0_12px_rgba(240,160,32,0.8)]" />
            )}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="M4 19V5M4 19h16M8 16V9M12 16v-5M16 16V7" />
            </svg>
            Raporlar
          </Link>
          <Link
            href="/ayarlar"
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
              pathname.startsWith("/ayarlar")
                ? "bg-white/8 text-amber"
                : "text-fog hover:bg-white/5 hover:text-paper"
            }`}
          >
            {pathname.startsWith("/ayarlar") && (
              <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-amber shadow-[0_0_12px_rgba(240,160,32,0.8)]" />
            )}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            Ayarlar
          </Link>
        </nav>

        <div className="mt-auto rounded-2xl border border-white/8 bg-white/4 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fog">
            Hızlı işlem
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link href="/yukler/yeni" className="btn btn-amber !px-2 !py-2 text-xs">
              + Yük
            </Link>
            <Link href="/giderler/yeni" className="btn btn-ghost !px-2 !py-2 text-xs">
              + Gider
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobil üst bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-asphalt/85 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex gap-2">
            <Link href="/ayarlar" className="btn btn-ghost !px-3 !py-2 text-xs">
              Ayarlar
            </Link>
            <Link href="/yukler/yeni" className="btn btn-amber !px-3 !py-2 text-xs">
              + Yük
            </Link>
          </div>
        </div>
        <div className="lane-strip mt-3" />
      </header>

      {/* Mobil alt dock */}
      <nav className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-white/10 bg-asphalt-2/95 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {LINKLER.map((l) => {
            const aktif = aktifMi(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold transition-all ${
                  aktif ? "text-amber" : "text-fog"
                }`}
              >
                {aktif && (
                  <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-amber shadow-[0_0_10px_rgba(240,160,32,0.9)]" />
                )}
                {l.ikon}
                {l.ad}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
