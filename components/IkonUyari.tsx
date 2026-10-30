"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { safariLinki, simgeEskiMi } from "@/components/AnaEkranRehber";

/**
 * Ana ekran simgesi eski iPhone'da üstte kalıcı çubuk.
 * Simge yenilenince eski uygulama silinir; çubuk kendiliğinden biter.
 */
export default function IkonUyari() {
  const yol = usePathname();
  const [eski, setEski] = useState(false);

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!ios || !standalone) return;
    let iptal = false;
    void simgeEskiMi().then((e) => !iptal && setEski(e));
    return () => {
      iptal = true;
    };
  }, []);

  if (!eski || yol === "/ana-ekran") return null;

  return (
    <a
      href={safariLinki()}
      className="mx-3 mt-2 flex items-center gap-3 rounded-2xl bg-amber/15 px-4 py-3 text-sm text-paper"
    >
      <span className="text-lg">✨</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block font-semibold">Yeni logo geldi</span>
        <span className="block text-xs text-fog">Ana ekran simgesini yenilemek için dokun</span>
      </span>
      <span className="text-amber">›</span>
    </a>
  );
}
