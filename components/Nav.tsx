"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import NavLink from "@/components/NavLink";

const ikonSinif = "h-5 w-5";

type NavOge = {
  href: string;
  ad: string;
  ikon: ReactNode;
};

/** Mobil alt dock — 4 ana + Daha. */
const DOCK: NavOge[] = [
  {
    href: "/",
    ad: "Panel",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    href: "/ai/yukler",
    ad: "Yükler",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
        <rect x="6" y="6" width="12" height="12" rx="3" />
        <circle cx="9.5" cy="11" r="1" />
        <circle cx="14.5" cy="11" r="1" />
        <path d="M9.5 14.5h5" />
      </svg>
    ),
  },
  {
    href: "/yukler",
    ad: "Sefer",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M1 9h12v7H1z" />
        <path d="M13 12h4l3 3v1h-7z" />
        <circle cx="6" cy="18.5" r="1.5" />
        <circle cx="17" cy="18.5" r="1.5" />
      </svg>
    ),
  },
  {
    href: "/plan",
    ad: "Plan",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M4 6h16M4 12h10M4 18h14" />
        <circle cx="18" cy="12" r="2" />
      </svg>
    ),
  },
];

/** «Daha» menüsü + masaüstü yan menü. */
const DIGER: NavOge[] = [
  {
    href: "/ai",
    ad: "AI Merkez",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
        <rect x="6" y="6" width="12" height="12" rx="3" />
      </svg>
    ),
  },
  {
    href: "/ai/musteriler",
    ad: "Müşteri",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="3.5" />
        <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.3M16.5 3.6a3.5 3.5 0 0 1 0 6.8" />
      </svg>
    ),
  },
  {
    href: "/giderler",
    ad: "Giderler",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M7 3h10v18l-2-1.4L13 21l-2-1.4L9 21l-2-1.4L5 21z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    href: "/kasa",
    ad: "Kasa",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
        <circle cx="12" cy="14.5" r="1.5" />
      </svg>
    ),
  },
  {
    href: "/firmalar",
    ad: "Cari",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="3.5" />
        <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.3M16.5 3.6a3.5 3.5 0 0 1 0 6.8" />
      </svg>
    ),
  },
  {
    href: "/kdv",
    ad: "KDV",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M5 3h14a1 1 0 0 1 1 1v17l-3-1.6-3 1.6-3-1.6L8 21l-4 0V4a1 1 0 0 1 1-1z" />
        <path d="M9 8h6M9 12h6" />
      </svg>
    ),
  },
  {
    href: "/muhasebeci",
    ad: "Gönder",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22l-4-9-9-4 20-7z" />
      </svg>
    ),
  },
  {
    href: "/raporlar",
    ad: "Raporlar",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M4 19V5M4 19h16M8 16V9M12 16v-5M16 16V7" />
      </svg>
    ),
  },
  {
    href: "/ayarlar",
    ad: "Ayarlar",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    href: "/giderler/yeni",
    ad: "+ Gider",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
];

const YAN_MENU: NavOge[] = [
  ...DOCK,
  ...DIGER.filter((d) => d.href !== "/giderler/yeni"),
];

function Logo() {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-[#c97800] text-asphalt shadow-[0_8px_24px_rgba(240,160,32,0.35)] transition-transform group-hover:scale-105 sm:h-10 sm:w-10">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M1 9h12v7H1z" />
          <path d="M13 12h4l3 3v1h-7z" />
          <circle cx="6" cy="18.5" r="1.5" />
          <circle cx="17" cy="18.5" r="1.5" />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="font-display block truncate text-base font-bold tracking-wide text-paper sm:text-lg">
          NAKLİYE
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-amber sm:text-[11px] sm:tracking-[0.22em]">
          Defteri
        </span>
      </span>
    </Link>
  );
}

function DahaIkon({ acik }: { acik: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`h-5 w-5 transition-transform ${acik ? "rotate-90" : ""}`}
    >
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const [dahaAcik, setDahaAcik] = useState(false);

  const aktifMi = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const dahaAktif = DIGER.some((l) => aktifMi(l.href));

  useEffect(() => {
    setDahaAcik(false);
  }, [pathname]);

  useEffect(() => {
    if (!dahaAcik) return;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = onceki;
    };
  }, [dahaAcik]);

  const yanMenuSinifi = (aktif: boolean) =>
    `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
      aktif ? "bg-white/8 text-amber" : "text-fog hover:bg-white/5 hover:text-paper"
    }`;

  return (
    <div className="contents">
      {/* Masaüstü yan menü */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[16.5rem] flex-col border-r border-white/10 bg-asphalt-2/90 px-4 py-5 backdrop-blur-xl md:flex">
        <div className="mb-8 px-1">
          <Logo />
          <div className="lane-strip mt-5 opacity-70" />
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {YAN_MENU.map((l) => {
            const aktif = aktifMi(l.href);
            return (
              <NavLink key={l.href} href={l.href} className={yanMenuSinifi(aktif)}>
                {aktif && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-amber shadow-[0_0_12px_rgba(240,160,32,0.8)]" />
                )}
                <span className={aktif ? "text-amber" : ""}>{l.ikon}</span>
                {l.ad}
              </NavLink>
            );
          })}
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
      <header className="sticky top-0 z-30 border-b border-white/10 bg-asphalt/85 px-3 py-2.5 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between gap-2">
          <Logo />
          <div className="flex shrink-0 gap-1.5">
            <Link
              href="/ayarlar"
              className="btn btn-ghost !min-h-10 !px-2.5 !py-2 text-xs"
            >
              Ayarlar
            </Link>
            <Link
              href="/yukler/yeni"
              className="btn btn-amber !min-h-10 !px-2.5 !py-2 text-xs"
            >
              + Yük
            </Link>
          </div>
        </div>
        <div className="lane-strip mt-2.5" />
      </header>

      {/* Mobil «Daha» alt sheet */}
      {dahaAcik && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Menüyü kapat"
            onClick={() => setDahaAcik(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-3xl border border-white/12 bg-asphalt-2 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            role="dialog"
            aria-label="Diğer menü"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-fog">
              Tüm menü
            </p>
            <div className="grid grid-cols-3 gap-2 pb-2">
              {DIGER.map((l) => {
                const aktif = aktifMi(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setDahaAcik(false)}
                    className={`flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-xs font-semibold ${
                      aktif
                        ? "border-amber/40 bg-amber/12 text-amber"
                        : "border-white/10 bg-white/4 text-paper"
                    }`}
                  >
                    <span className={aktif ? "text-amber" : "text-fog"}>{l.ikon}</span>
                    {l.ad}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobil alt dock */}
      <nav
        className="fixed inset-x-2 bottom-2 z-50 rounded-2xl border border-white/10 bg-asphalt-2/95 p-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="grid grid-cols-5">
          {DOCK.map((l) => {
            const aktif = aktifMi(l.href);
            return (
              <NavLink
                key={l.href}
                href={l.href}
                className={`relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-semibold transition-all ${
                  aktif ? "text-amber" : "text-fog"
                }`}
              >
                {aktif && (
                  <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-amber shadow-[0_0_10px_rgba(240,160,32,0.9)]" />
                )}
                {l.ikon}
                <span className="max-w-full truncate">{l.ad}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setDahaAcik((v) => !v)}
            className={`relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-semibold transition-all ${
              dahaAcik || dahaAktif ? "text-amber" : "text-fog"
            }`}
            aria-expanded={dahaAcik}
            aria-label="Diğer menü"
          >
            {(dahaAcik || dahaAktif) && (
              <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-amber shadow-[0_0_10px_rgba(240,160,32,0.9)]" />
            )}
            <DahaIkon acik={dahaAcik} />
            Daha
          </button>
        </div>
      </nav>
    </div>
  );
}
