"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";

/**
 * Ana sayfa hareket kökü (Motion: yerleşim kayması, açılan panel, görünürken
 * dolan grafik, çıkış). Basma, giriş ve döngüler CSS’te (globals .ana-*).
 * Yalnız gereken özellikler yüklenir (LazyMotion); "hareketi azalt" açıksa
 * dönüşümler kapanır (reducedMotion="user").
 */
export function HareketKok({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
