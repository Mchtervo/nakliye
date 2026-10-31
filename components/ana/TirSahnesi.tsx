"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Başlıktaki tır + platform. Yalnız ekrandayken çok hafif süzülür ve
 * platform ışığı nefes alır; ekran dışına çıkınca durur (pil yemesin).
 */
export default function TirSahnesi() {
  const kutu = useRef<HTMLDivElement>(null);
  const [gorunur, setGorunur] = useState(false);

  useEffect(() => {
    const el = kutu.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([g]) => setGorunur(g.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={kutu} className="ana-tir" data-gorunur={gorunur ? "1" : "0"} aria-hidden>
      <span className="ana-tir-isik" />
      <Image
        src="/ana/tir.webp"
        alt=""
        width={510}
        height={330}
        sizes="(max-width: 640px) 62vw, 340px"
        fetchPriority="high"
        loading="eager"
        className="ana-tir-gorsel"
      />
    </div>
  );
}
