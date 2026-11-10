import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import UyeSeridi from "@/components/uye/UyeSeridi";
import { aktifBaglam } from "@/lib/baglam";
import { yuklerAcikMi } from "@/lib/uyeIlan";
import PwaKayit from "@/components/PwaKayit";
import Guncelleme from "@/components/Guncelleme";
import IkonUyari from "@/components/IkonUyari";
import GezinmeIlerleme from "@/components/GezinmeIlerleme";

/** IBM Plex Sans — net rakam, Türkçe, yuvarlak “dandik” değil */
const sans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Nakliye Defteri",
  description: "Tır gelir-gider ve KDV takip uygulaması",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nakliye Defteri",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Menü üyeye yönetici bölümlerini göstermez (sayfalar middleware ile de kapalı)
  // Hata olursa kısıtlı menü (güvenli taraf)
  const b = await aktifBaglam().catch((e) => {
    unstable_rethrow(e); // kapanmış oturum: giriş ekranına yönlendirme yutulmasın
    return null;
  });
  const rol = b === null || b.uyeId !== null ? "uye" : "admin";
  // Üye "Yük bul"u kapattıysa menüde görünmez
  const yukler = b !== null && b.uyeId !== null ? await yuklerAcikMi() : true;
  return (
    <html lang="tr" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__ndKur=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__ndKur=e;if(window.__ndKurDinle)window.__ndKurDinle(e);});",
          }}
        />
        <Suspense fallback={null}>
          <GezinmeIlerleme />
        </Suspense>
        <div className="app-shell">
          <Nav rol={rol} yukler={yukler} />
          <main className="app-main">
            <div className="app-main-inner mx-auto w-full">
              <Suspense fallback={null}>
                <UyeSeridi />
              </Suspense>
              <IkonUyari />
              {children}
            </div>
          </main>
        </div>
        <PwaKayit />
        <Guncelleme />
      </body>
    </html>
  );
}
