"use client";

import { useEffect } from "react";
import type { KurPrompt } from "@/lib/pwaKur";

export default function PwaKayit() {
  useEffect(() => {
    const yakala = (e: Event) => {
      e.preventDefault();
      window.__ndKur = e as KurPrompt;
      window.__ndKurDinle?.(window.__ndKur);
    };
    window.addEventListener("beforeinstallprompt", yakala);
    if (!("serviceWorker" in navigator)) {
      return () => window.removeEventListener("beforeinstallprompt", yakala);
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((kayit) => {
        kayit.update().catch(() => {});
      })
      .catch(() => {});
    return () => window.removeEventListener("beforeinstallprompt", yakala);
  }, []);
  return null;
}
