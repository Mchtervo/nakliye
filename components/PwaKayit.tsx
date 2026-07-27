"use client";

import { useEffect } from "react";

export default function PwaKayit() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((kayit) => {
        // Yeni sw.js (push tıklama) hemen aktif olsun
        kayit.update().catch(() => {});
      })
      .catch(() => {
        // sessizce geç
      });
  }, []);
  return null;
}
