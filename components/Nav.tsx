"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import NavLink from "@/components/NavLink";

const ikonSinif = "h-5 w-5";

type NavOge = {
  href: string;
  ad: string;
  aciklama?: string;
  ikon: ReactNode;
};

/** Mobil alt dock — günlük 4 iş + Daha */
const DOCK: NavOge[] = [
  {
    href: "/",
    ad: "Ana",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    href: "/ai/yukler",
    ad: "Yük bul",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
      </svg>
    ),
  },
  {
    href: "/yukler",
    ad: "Seferler",
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
    href: "/giderler",
    ad: "Gider",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
        <path d="M7 3h10v18l-2-1.4L13 21l-2-1.4L9 21l-2-1.4L5 21z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    ),
  },
];

type DahaGrup = { baslik: string; ogeler: NavOge[] };

const DAHA_GRUPLAR: DahaGrup[] = [
  {
    baslik: "Günlük iş",
    ogeler: [
      {
        href: "/plan",
        ad: "Tur planı",
        aciklama: "Dönüş yükü sırala",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
            <path d="M4 6h16M4 12h10M4 18h14" />
            <circle cx="18" cy="12" r="2" />
          </svg>
        ),
      },
      {
        href: "/giderler/yeni",
        ad: "Fiş çek",
        aciklama: "Yeni gider / foto",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
            <path d="M12 5v14M5 12h14" />
          </svg>
        ),
      },
      {
        href: "/muhasebeci",
        ad: "Muhasebeciye gönder",
        aciklama: "Fişleri paylaş",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7z" />
          </svg>
        ),
      },
    ],
  },
  {
    baslik: "Para",
    ogeler: [
      {
        href: "/kasa",
        ad: "Kasa",
        aciklama: "Nakit giriş-çıkış",
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
        ad: "Cariler",
        aciklama: "Kim ne kadar borçlu",
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
        aciklama: "Bu ay ne ödeyeceksin",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
            <path d="M5 3h14a1 1 0 0 1 1 1v17l-3-1.6-3 1.6-3-1.6L8 21l-4 0V4a1 1 0 0 1 1-1z" />
            <path d="M9 8h6M9 12h6" />
          </svg>
        ),
      },
      {
        href: "/raporlar",
        ad: "Raporlar",
        aciklama: "Aylık özet",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
            <path d="M4 19V5M4 19h16M8 16V9M12 16v-5M16 16V7" />
          </svg>
        ),
      },
    ],
  },
  {
    baslik: "Gelişmiş",
    ogeler: [
      {
        href: "/ai",
        ad: "Yük merkezi",
        aciklama: "Kaynaklar ve özet",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
            <rect x="6" y="6" width="12" height="12" rx="3" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
          </svg>
        ),
      },
      {
        href: "/ai/musteriler",
        ad: "Müşteri havuzu",
        aciklama: "Sık aranan firmalar",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="3.5" />
          </svg>
        ),
      },
      {
        href: "/ayarlar",
        ad: "Ayarlar",
        aciklama: "Koridor, Telegram, bildirim",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ikonSinif}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ),
      },
    ],
  },
];

const DAHA_DUZ = DAHA_GRUPLAR.flatMap((g) => g.ogeler);

function Logo() {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f5c14a] to-[#c97800] text-[#1a1208] shadow-[0_8px_28px_rgba(240,160,32,0.28)] transition-transform group-hover:scale-[1.03] sm:h-10 sm:w-10">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M1 9h12v7H1z" />
          <path d="M13 12h4l3 3v1h-7z" />
          <circle cx="6" cy="18.5" r="1.5" />
          <circle cx="17" cy="18.5" r="1.5" />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="font-display block truncate text-base font-bold tracking-[0.04em] text-paper sm:text-lg">
          NAKLİYE
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-amber/90 sm:text-[11px]">
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

function sayfaAktifMi(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // /ai sadece merkez; /ai/yukler ayrı dock öğesi
  if (href === "/ai") return pathname === "/ai";
  if (href === "/yukler") {
    return pathname === "/yukler" || pathname.startsWith("/yukler/");
  }
  if (href === "/giderler") {
    return pathname === "/giderler" || pathname.startsWith("/giderler/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname();
  const [dahaAcik, setDahaAcik] = useState(false);

  const aktifMi = (href: string) => sayfaAktifMi(pathname, href);
  const dahaAktif = DAHA_DUZ.some((l) => aktifMi(l.href));

  // Nerede olduğumuz — üst bar için kısa etiket
  const konumAdi =
    DOCK.find((d) => aktifMi(d.href))?.ad ||
    DAHA_DUZ.find((d) => aktifMi(d.href))?.ad ||
    "Menü";

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
    `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
      aktif
        ? "bg-amber/12 text-amber"
        : "text-fog hover:bg-white/5 hover:text-paper"
    }`;

  return (
    <div className="contents">
      {/* Masaüstü yan menü */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[16.5rem] flex-col border-r border-white/[0.07] bg-[#0e141d]/92 px-4 py-5 backdrop-blur-xl md:flex">
        <div className="mb-6 px-1">
          <Logo />
          <div className="lane-strip mt-5 opacity-60" />
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-fog/80">
            Şu an · {konumAdi}
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-fog/70">
            Ana menü
          </p>
          {DOCK.map((l) => {
            const aktif = aktifMi(l.href);
            return (
              <NavLink key={l.href} href={l.href} className={yanMenuSinifi(aktif)}>
                {aktif && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-amber" />
                )}
                <span className={aktif ? "text-amber" : "text-fog"}>{l.ikon}</span>
                {l.ad}
              </NavLink>
            );
          })}

          {DAHA_GRUPLAR.map((grup) => (
            <div key={grup.baslik} className="mt-4">
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-fog/70">
                {grup.baslik}
              </p>
              {grup.ogeler
                .filter((l) => l.href !== "/giderler/yeni")
                .map((l) => {
                  const aktif = aktifMi(l.href);
                  return (
                    <NavLink key={l.href} href={l.href} className={yanMenuSinifi(aktif)}>
                      {aktif && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-amber" />
                      )}
                      <span className={aktif ? "text-amber" : "text-fog"}>{l.ikon}</span>
                      {l.ad}
                    </NavLink>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-transparent p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fog">
            Hızlı
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link href="/yukler/yeni" className="btn btn-amber !px-2 !py-2 text-xs">
              + Sefer
            </Link>
            <Link href="/giderler/yeni" className="btn btn-ghost !px-2 !py-2 text-xs">
              + Fiş
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobil üst bar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0c1017]/90 px-3 py-2.5 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between gap-2">
          <Logo />
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden max-w-[7rem] truncate rounded-lg border border-amber/25 bg-amber/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber sm:inline">
              {konumAdi}
            </span>
            <Link
              href="/giderler/yeni"
              className="btn btn-ghost !min-h-10 !px-2.5 !py-2 text-xs"
            >
              + Fiş
            </Link>
            <Link
              href="/yukler/yeni"
              className="btn btn-amber !min-h-10 !px-2.5 !py-2 text-xs"
            >
              + Sefer
            </Link>
          </div>
        </div>
        <div className="lane-strip mt-2.5 opacity-70" />
      </header>

      {/* Mobil «Daha» sheet — gruplu */}
      {dahaAcik && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Menüyü kapat"
            onClick={() => setDahaAcik(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[1.75rem] border border-white/12 bg-[#121a26] px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            role="dialog"
            aria-label="Diğer menü"
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/25" />
            <p className="mb-1 font-display text-xl font-bold text-paper">
              Tüm menü
            </p>
            <p className="mb-4 text-xs text-fog">
              Nereye gideceğini buradan seç
            </p>

            {DAHA_GRUPLAR.map((grup) => (
              <div key={grup.baslik} className="mb-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber/80">
                  {grup.baslik}
                </p>
                <div className="space-y-1.5">
                  {grup.ogeler.map((l) => {
                    const aktif = aktifMi(l.href);
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setDahaAcik(false)}
                        className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
                          aktif
                            ? "border-amber/35 bg-amber/12"
                            : "border-white/8 bg-white/[0.03]"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            aktif ? "bg-amber/20 text-amber" : "bg-white/5 text-fog"
                          }`}
                        >
                          {l.ikon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-paper">
                            {l.ad}
                          </span>
                          {l.aciklama && (
                            <span className="block truncate text-xs text-fog">
                              {l.aciklama}
                            </span>
                          )}
                        </span>
                        <span className="text-fog">→</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobil alt dock */}
      <nav
        className="fixed inset-x-2 bottom-2 z-50 rounded-2xl border border-white/10 bg-[#121a26]/96 p-1 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="grid grid-cols-5">
          {DOCK.map((l) => {
            const aktif = aktifMi(l.href);
            return (
              <NavLink
                key={l.href}
                href={l.href}
                className={`relative flex min-h-[3.35rem] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-bold tracking-wide transition-colors ${
                  aktif ? "text-amber" : "text-fog"
                }`}
              >
                {aktif && (
                  <span className="absolute inset-x-3 top-0.5 h-0.5 rounded-full bg-amber" />
                )}
                {l.ikon}
                <span className="max-w-full truncate">{l.ad}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setDahaAcik((v) => !v)}
            className={`relative flex min-h-[3.35rem] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-bold tracking-wide transition-colors ${
              dahaAcik || dahaAktif ? "text-amber" : "text-fog"
            }`}
            aria-expanded={dahaAcik}
            aria-label="Diğer menü"
          >
            {(dahaAcik || dahaAktif) && (
              <span className="absolute inset-x-3 top-0.5 h-0.5 rounded-full bg-amber" />
            )}
            <DahaIkon acik={dahaAcik} />
            Daha
          </button>
        </div>
      </nav>
    </div>
  );
}
