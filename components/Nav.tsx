"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import BildirimZili from "@/components/BildirimZili";
import { GuncelleDugmesi } from "@/components/Guncelleme";
import Logo from "@/components/Logo";
import NavLink from "@/components/NavLink";

const ikonSinif = "h-6 w-6";

type NavOge = {
  href: string;
  ad: string;
  aciklama?: string;
  /** iOS Ayarlar tarzı renkli ikon kutusu */
  renk?: string;
  ikon: ReactNode;
};

/** Mobil alt sekme çubuğu — günlük 4 iş + Daha */
const DOCK: NavOge[] = [
  {
    href: "/",
    ad: "Ana",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={ikonSinif}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    href: "/ai/yukler",
    ad: "Yük bul",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={ikonSinif}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
      </svg>
    ),
  },
  {
    href: "/yukler",
    ad: "Seferler",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className={ikonSinif}>
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={ikonSinif}>
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
        renk: "#5e5ce6",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M4 6h16M4 12h10M4 18h14" />
            <circle cx="18" cy="12" r="2" />
          </svg>
        ),
      },
      {
        href: "/arac",
        ad: "Araç ve belgeler",
        aciklama: "Km, bakım, yakıt, muayene",
        renk: "#30d158",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
            <path d="M1 9h12v7H1z" />
            <path d="M13 12h4l3 3v1h-7z" />
            <circle cx="6" cy="18.5" r="1.5" />
            <circle cx="17" cy="18.5" r="1.5" />
          </svg>
        ),
      },
      {
        href: "/giderler/yeni",
        ad: "Fiş çek",
        aciklama: "Yeni gider / foto",
        renk: "#ff453a",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        ),
      },
      {
        href: "/muhasebeci",
        ad: "Muhasebeciye gönder",
        aciklama: "Fişleri paylaş",
        renk: "#0a84ff",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
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
        href: "/ozet",
        ad: "Finans özeti",
        aciklama: "Gelir, gider, kasa, grafik",
        renk: "#5e5ce6",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M14 7h7v7" />
          </svg>
        ),
      },
      {
        href: "/para",
        ad: "Kasa & Cari",
        aciklama: "Nakit + kim ne borçlu",
        renk: "#30d158",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="6" width="18" height="13" rx="2" />
            <path d="M3 10h18" />
            <circle cx="12" cy="14.5" r="1.5" />
          </svg>
        ),
      },
      {
        href: "/kartlar",
        ad: "Kredi kartları",
        aciklama: "Borç, son ödeme, ödeme yap",
        renk: "#0a84ff",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="M2.5 10h19M6 15h4" />
          </svg>
        ),
      },
      {
        href: "/veresiye",
        ad: "Veresiye defteri",
        aciklama: "İstasyon borçları",
        renk: "#bf5af2",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
            <path d="M5 17a3 3 0 0 1 3-3h11M9 8h6" />
          </svg>
        ),
      },
      {
        href: "/kdv",
        ad: "KDV",
        aciklama: "Bu ay ne ödeyeceksin",
        renk: "#ff9f0a",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M19 5 5 19" />
            <circle cx="7" cy="7" r="2.5" />
            <circle cx="17" cy="17" r="2.5" />
          </svg>
        ),
      },
      {
        href: "/api/excel",
        ad: "Excel indir",
        aciklama: "Bu ayın sefer ve gideri",
        renk: "#30d158",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
            <path d="M14 3v5h5" />
            <path d="M8 13h8M8 17h5" />
          </svg>
        ),
      },
      {
        href: "/ayarlar#telefon-tuslari",
        ad: "Ana ekrana ekle",
        aciklama: "Telefon ikonu + bildirim",
        renk: "#ff9f0a",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <rect x="7" y="2" width="10" height="20" rx="2" />
            <path d="M12 18h.01" />
          </svg>
        ),
      },
      {
        href: "/raporlar",
        ad: "Raporlar",
        aciklama: "Aylık özet",
        renk: "#bf5af2",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
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
        renk: "#ff375f",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <rect x="6" y="6" width="12" height="12" rx="3" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
          </svg>
        ),
      },
      {
        href: "/ai/musteriler",
        ad: "Müşteri havuzu",
        aciklama: "Sık aranan firmalar",
        renk: "#64d2ff",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="3.5" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
          </svg>
        ),
      },
      {
        href: "/ayarlar",
        ad: "Ayarlar",
        aciklama: "Koridor, Telegram, bildirim",
        renk: "#8e8e93",
        ikon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ),
      },
    ],
  },
];

const DAHA_DUZ = DAHA_GRUPLAR.flatMap((g) => g.ogeler);

const EKLE_OGELERI: NavOge[] = [
  {
    href: "/yukler/yeni",
    ad: "Yeni sefer",
    aciklama: "Taşıdığın yükü kaydet",
    renk: "#ff9f0a",
    ikon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M1 9h12v7H1z" />
        <path d="M13 12h4l3 3v1h-7z" />
        <circle cx="6" cy="18.5" r="1.5" />
        <circle cx="17" cy="18.5" r="1.5" />
      </svg>
    ),
  },
  DAHA_DUZ.find((o) => o.href === "/giderler/yeni")!,
];

function LogoIkon({ kucuk = false }: { kucuk?: boolean }) {
  return <Logo boyut={kucuk ? 32 : 40} />;
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-white/30">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function sayfaAktifMi(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // /ai sadece merkez; /ai/yukler ayrı sekme
  if (href === "/ai") return pathname === "/ai";
  if (href === "/yukler") {
    return pathname === "/yukler" || pathname.startsWith("/yukler/");
  }
  if (href === "/giderler") {
    return pathname === "/giderler" || pathname.startsWith("/giderler/");
  }
  if (href === "/para") {
    return (
      pathname === "/para" ||
      pathname === "/kasa" ||
      pathname === "/firmalar" ||
      pathname.startsWith("/firmalar/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SheetTuru = "daha" | "ekle";

/** iOS alttan açılan sayfa: tutamaçtan aşağı çekince kapanır. */
function IosSheet({
  etiket,
  kapaniyor,
  kapat,
  children,
}: {
  etiket: string;
  kapaniyor: boolean;
  kapat: () => void;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const surukle = useRef<{ y: number; dy: number } | null>(null);

  function basla(e: React.PointerEvent) {
    surukle.current = { y: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  }

  function hareket(e: React.PointerEvent) {
    const s = surukle.current;
    if (!s || !sheetRef.current) return;
    const dy = e.clientY - s.y;
    // Yukarı çekişte iOS gibi direnç
    s.dy = dy > 0 ? dy : dy / 6;
    sheetRef.current.style.transform = `translateY(${s.dy}px)`;
  }

  function birak() {
    const s = surukle.current;
    surukle.current = null;
    const el = sheetRef.current;
    if (!s || !el) return;
    el.style.transition = "transform 0.45s cubic-bezier(0.32, 0.72, 0, 1)";
    if (s.dy > 110) {
      kapat();
    } else {
      el.style.transform = "";
    }
  }

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <button
        type="button"
        className={`ios-perde absolute inset-0 bg-black/55 ${kapaniyor ? "kapaniyor" : ""}`}
        aria-label="Kapat"
        onClick={kapat}
      />
      <div
        ref={sheetRef}
        className={`ios-sheet absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[2rem] bg-[#1c1c1e] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${
          kapaniyor ? "kapaniyor" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={etiket}
      >
        <div
          className="sticky top-0 z-10 -mx-4 cursor-grab touch-none bg-[#1c1c1e] px-4 pb-2 pt-2.5 active:cursor-grabbing"
          onPointerDown={basla}
          onPointerMove={hareket}
          onPointerUp={birak}
          onPointerCancel={birak}
        >
          <div className="mx-auto h-[5px] w-9 rounded-full bg-white/25" />
          <div className="mt-3 flex items-center justify-between">
            <p className="font-display text-[1.375rem] font-bold">{etiket}</p>
            <button
              type="button"
              onClick={kapat}
              onPointerDown={(e) => e.stopPropagation()}
              className="dokun flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70"
              aria-label="Kapat"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="h-3.5 w-3.5">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function HucreListesi({
  ogeler,
  aktifMi,
  kapat,
}: {
  ogeler: NavOge[];
  aktifMi: (href: string) => boolean;
  kapat: () => void;
}) {
  return (
    <div className="ios-liste !bg-[#2c2c2e]">
      {ogeler.map((l) => {
        const aktif = aktifMi(l.href);
        return (
          <Link key={l.href} href={l.href} onClick={kapat} className="ios-hucre active:!bg-[#3a3a3c]">
            <span className="ios-ikon" style={{ background: l.renk }}>
              {l.ikon}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[17px] font-normal ${aktif ? "text-amber" : "text-white"}`}>
                {l.ad}
              </span>
              {l.aciklama && (
                <span className="block truncate text-[13px] text-fog">{l.aciklama}</span>
              )}
            </span>
            <Chevron />
          </Link>
        );
      })}
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<SheetTuru | null>(null);
  const [kapaniyor, setKapaniyor] = useState(false);
  const [kaydi, setKaydi] = useState(false);
  const [oncekiYol, setOncekiYol] = useState(pathname);
  const kapatZamanlayici = useRef<number | null>(null);

  // Sayfa değişince açık menüyü kapat (efekt yerine render sırasında)
  if (pathname !== oncekiYol) {
    setOncekiYol(pathname);
    setSheet(null);
    setKapaniyor(false);
  }

  const aktifMi = (href: string) => sayfaAktifMi(pathname, href);
  const dahaAktif = DAHA_DUZ.some((l) => aktifMi(l.href));
  const dockIndeks = DOCK.findIndex((d) => aktifMi(d.href));
  const gostergeIndeks = sheet === "daha" || (dockIndeks < 0 && dahaAktif) ? 4 : dockIndeks;

  const konumAdi =
    DOCK.find((d) => aktifMi(d.href))?.ad ||
    DAHA_DUZ.find((d) => aktifMi(d.href))?.ad ||
    "Nakliye Defteri";

  const kapat = useCallback(() => {
    setKapaniyor(true);
    if (kapatZamanlayici.current) window.clearTimeout(kapatZamanlayici.current);
    kapatZamanlayici.current = window.setTimeout(() => {
      setSheet(null);
      setKapaniyor(false);
    }, 280);
  }, []);

  const ac = (tur: SheetTuru) => {
    if (kapatZamanlayici.current) window.clearTimeout(kapatZamanlayici.current);
    setKapaniyor(false);
    setSheet(tur);
  };

  useEffect(() => {
    const kontrol = () => setKaydi(window.scrollY > 24);
    kontrol();
    window.addEventListener("scroll", kontrol, { passive: true });
    return () => window.removeEventListener("scroll", kontrol);
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") kapat();
    };
    window.addEventListener("keydown", tus);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", tus);
    };
  }, [sheet, kapat]);

  useEffect(
    () => () => {
      if (kapatZamanlayici.current) window.clearTimeout(kapatZamanlayici.current);
    },
    []
  );

  // Giriş ekranında menü yok: oturum olmadan her bağlantı tekrar girişe döner.
  if (pathname === "/giris" || pathname.startsWith("/giris/")) return null;

  const yanMenuSinifi = (aktif: boolean) =>
    `dokun relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors duration-200 ${
      aktif
        ? "bg-white/[0.08] font-semibold text-white before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-amber"
        : "text-white/60 hover:bg-white/[0.05] hover:text-white"
    }`;

  return (
    <div className="contents">
      {/* Masaüstü / iPad yan menü */}
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-[16rem] flex-col rounded-[1.4rem] bg-[#1c1c1e]/90 px-3 py-4 backdrop-blur-2xl md:flex">
        <div className="mb-5 flex items-center justify-between gap-2 px-2">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <LogoIkon />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[17px] font-semibold">Nakliye Defteri</span>
              <span className="block truncate text-[13px] text-fog">{konumAdi}</span>
            </span>
          </Link>
          <BildirimZili />
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {DOCK.map((l) => {
            const aktif = aktifMi(l.href);
            return (
              <NavLink key={l.href} href={l.href} className={yanMenuSinifi(aktif)}>
                <span className={`[&_svg]:h-5 [&_svg]:w-5 ${aktif ? "text-amber" : "text-white/50"}`}>{l.ikon}</span>
                {l.ad}
              </NavLink>
            );
          })}

          {DAHA_GRUPLAR.map((grup) => (
            <div key={grup.baslik} className="mt-4">
              <p className="mb-1 px-2.5 text-[13px] font-semibold text-fog">{grup.baslik}</p>
              {grup.ogeler
                .filter((l) => l.href !== "/giderler/yeni")
                .map((l) => {
                  const aktif = aktifMi(l.href);
                  return (
                    <NavLink key={l.href} href={l.href} className={yanMenuSinifi(aktif)}>
                      <span className={`[&_svg]:h-5 [&_svg]:w-5 ${aktif ? "text-amber" : "text-white/50"}`}>{l.ikon}</span>
                      {l.ad}
                    </NavLink>
                  );
                })}
            </div>
          ))}
          <div className="mt-4">
            <GuncelleDugmesi className="!px-2.5 !text-[15px]" />
          </div>
        </nav>

        <div className="mt-3 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3.5">
          <span className="ikon-kare ikon-turuncu !h-9 !w-9 !rounded-xl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" />
            </svg>
          </span>
          <p className="mt-2.5 text-[15px] font-semibold">Yük Avcısı açık</p>
          <p className="text-[12.5px] leading-snug text-fog">Telegram ve ilan siteleri senin için taranıyor.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/yukler/yeni" className="btn btn-amber !min-h-9 !px-2 text-sm">
              + Sefer
            </Link>
            <Link href="/giderler/yeni" className="btn btn-ghost !min-h-9 !px-2 text-sm">
              + Fiş
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobil üst bar — kaydırınca buzlu cam + başlık belirir */}
      <header
        className={`ust-bar sticky top-0 z-30 md:hidden ${kaydi ? "kaydi" : ""}`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="relative flex h-12 items-center justify-between px-4">
          <Link href="/" className="dokun" aria-label="Ana sayfa">
            <LogoIkon kucuk />
          </Link>
          <p className="ust-baslik pointer-events-none absolute inset-x-24 truncate text-center text-[17px] font-semibold">
            {konumAdi}
          </p>
          <div className="flex items-center gap-2">
            <BildirimZili />
            <button
              type="button"
              onClick={() => ac("ekle")}
              className="dokun flex h-8 w-8 items-center justify-center rounded-full bg-amber text-black"
              aria-label="Yeni kayıt ekle"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" className="h-4 w-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {sheet === "ekle" && (
        <IosSheet etiket="Yeni kayıt" kapaniyor={kapaniyor} kapat={kapat}>
          <div className="mt-2">
            <HucreListesi ogeler={EKLE_OGELERI} aktifMi={aktifMi} kapat={kapat} />
          </div>
        </IosSheet>
      )}

      {sheet === "daha" && (
        <IosSheet etiket="Tüm menü" kapaniyor={kapaniyor} kapat={kapat}>
          {DAHA_GRUPLAR.map((grup) => (
            <div key={grup.baslik} className="mt-4">
              <p className="mb-1.5 px-4 text-[13px] uppercase text-fog">{grup.baslik}</p>
              <HucreListesi ogeler={grup.ogeler} aktifMi={aktifMi} kapat={kapat} />
            </div>
          ))}
          <div className="mx-4 mt-4 rounded-xl bg-[#2c2c2e]">
            <GuncelleDugmesi className="!px-4 !py-3" />
          </div>
        </IosSheet>
      )}

      {/* Mobil alt sekme çubuğu — Liquid Glass */}
      <nav
        className="fixed inset-x-3 z-50 md:hidden"
        style={{ bottom: "max(0.6rem, env(safe-area-inset-bottom))" }}
        aria-label="Ana menü"
      >
        <div className="sivi-cam relative grid grid-cols-5 rounded-full p-1">
          {gostergeIndeks >= 0 && (
            <span
              aria-hidden
              className="tab-gosterge pointer-events-none absolute inset-y-1 left-1 rounded-full bg-white/[0.13] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.25)]"
              style={{
                width: "calc((100% - 0.5rem) / 5)",
                transform: `translateX(${gostergeIndeks * 100}%)`,
              }}
            />
          )}
          {DOCK.map((l, i) => {
            const aktif = i === gostergeIndeks;
            return (
              <NavLink
                key={l.href}
                href={l.href}
                className={`dokun flex min-h-[3.3rem] flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-medium ${
                  aktif ? "text-amber" : "text-white/75"
                }`}
              >
                <span key={aktif ? "a" : "p"} className={aktif ? "tab-ikon-aktif" : ""}>
                  {l.ikon}
                </span>
                <span className="max-w-full truncate">{l.ad}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => (sheet === "daha" ? kapat() : ac("daha"))}
            className={`dokun flex min-h-[3.3rem] flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-medium ${
              gostergeIndeks === 4 ? "text-amber" : "text-white/75"
            }`}
            aria-expanded={sheet === "daha"}
            aria-label="Diğer menü"
          >
            <span key={gostergeIndeks === 4 ? "a" : "p"} className={gostergeIndeks === 4 ? "tab-ikon-aktif" : ""}>
              <svg viewBox="0 0 24 24" fill="currentColor" className={ikonSinif}>
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </span>
            Daha
          </button>
        </div>
      </nav>
    </div>
  );
}
