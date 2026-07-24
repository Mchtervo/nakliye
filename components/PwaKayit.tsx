"use client";

import { useEffect } from "react";

export default function PwaKayit() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // sessizce geç
    });
  }, []);
  return null;
}
