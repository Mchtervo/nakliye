"use client";

import { useId } from "react";

/**
 * Marka işareti: başlangıç halkasından varış pinine kıvrılan rota.
 * Hareketli: rota kendini çizer, üstünde yük noktası akar, pin nabız atar,
 * yüzeyden ışık geçer. Hareket azaltma açıksa sabit durur (globals.css).
 * Aynı geometri public/icon.svg'de (statik) — ikisi birlikte değişir.
 */
export const ROTA_YOLU = "M34 88 C34 62 83 76 83 56";
const PIN = "M83 60 C76 51 68 44 68 34 A15 15 0 1 1 98 34 C98 44 90 51 83 60 Z";

export default function Logo({
  boyut = 40,
  hareketli = true,
  className = "",
}: {
  boyut?: number;
  hareketli?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const zemin = `lz-${id}`;
  const parilti = `lp-${id}`;
  const isik = `li-${id}`;
  const yol = `ly-${id}`;
  const kirp = `lk-${id}`;

  return (
    <svg
      viewBox="0 0 120 120"
      width={boyut}
      height={boyut}
      role="img"
      aria-label="Nakliye Defteri"
      className={`logo ${hareketli ? "logo-hareketli" : ""} shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={zemin} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB84D" />
          <stop offset="0.55" stopColor="#FF9500" />
          <stop offset="1" stopColor="#F26B00" />
        </linearGradient>
        <radialGradient id={parilti} cx="0.3" cy="0.12" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={isik} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={kirp}>
          <rect width="120" height="120" rx="27" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${kirp})`}>
        <rect width="120" height="120" fill={`url(#${zemin})`} />
        <rect width="120" height="120" fill={`url(#${parilti})`} />
        {hareketli && (
          <rect className="logo-isik" x="-60" y="-20" width="40" height="160" fill={`url(#${isik})`} />
        )}
        {/* İnce üst kenar: cam hissi */}
        <rect x="0.75" y="0.75" width="118.5" height="118.5" rx="26.4" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.5" />
      </g>

      {/* Gölgeler önce: beyaz şekillerin üstüne binmesin */}
      <path className="logo-rota" d={ROTA_YOLU} pathLength={1} fill="none" stroke="#9A3F00" strokeOpacity="0.28" strokeWidth="11" strokeLinecap="round" transform="translate(0 2.5)" />
      <g className="logo-pin">
        <path d={PIN} fill="#9A3F00" fillOpacity="0.28" transform="translate(0 2.5)" />
      </g>
      <path id={yol} className="logo-rota" d={ROTA_YOLU} pathLength={1} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" />

      {/* Çıkış noktası */}
      <circle cx="34" cy="88" r="8.5" fill="#fff" />

      {/* Varış pini + nabız */}
      {hareketli && <circle className="logo-nabiz" cx="83" cy="34" r="15" fill="none" stroke="#fff" strokeWidth="3" />}
      <g className="logo-pin">
        <path d={PIN} fill="#fff" />
        <circle cx="83" cy="34" r="6" fill="#FF7A00" />
      </g>

      {/* Rotada akan yük */}
      {hareketli && (
        <circle className="logo-yuk" r="4.2" fill="#1d1d1f">
          <animateMotion dur="3.2s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.7;1" calcMode="spline" keySplines="0.45 0 0.2 1;0 0 1 1">
            <mpath href={`#${yol}`} />
          </animateMotion>
        </circle>
      )}
    </svg>
  );
}
