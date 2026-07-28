import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import PwaKayit from "@/components/PwaKayit";
import GezinmeIlerleme from "@/components/GezinmeIlerleme";

/** Tek net font — condensed display mobilde pikselleniyor / okunmuyordu */
const sans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
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
  themeColor: "#0c1017",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Suspense fallback={null}>
          <GezinmeIlerleme />
        </Suspense>
        <div className="app-shell">
          <Nav />
          <main className="app-main">
            <div className="app-main-inner mx-auto w-full">{children}</div>
          </main>
        </div>
        <PwaKayit />
      </body>
    </html>
  );
}
