"use client";

import { LazyMotion, MotionConfig, domMax } from "motion/react";
import type { ReactNode } from "react";

/**
 * Ana sayfa hareket kökü (Motion: yerleşim kayması, açılan panel, görünürken
 * dolan grafik, çıkış). Basma, giriş ve döngüler CSS’te (globals .ana-*).
 * domMax: seçim zemininin kayması (layoutId) ve liste yerleşimi (layout) için
 * gerekir; domAnimation bunları içermez. "hareketi azalt" açıksa
 * dönüşümler kapanır (reducedMotion="user").
 */
export function HareketKok({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
