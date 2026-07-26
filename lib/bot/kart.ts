import { htmlKacis } from "@/lib/bildirim/telegram";
import { fiyatGorunumu, gecenSure } from "@/lib/ilanGorunum";

export type KartIlan = {
  id: number;
  nereden: string | null;
  nereye: string | null;
  cikisIl: string | null;
  varisIl: string | null;
  tonaj: number | null;
  aracTipi: string | null;
  yukTipi: string | null;
  yuklemeTarihi: Date | null;
  ucret: number | null;
  fiyatTon: number | null;
  fiyatBelirsiz: boolean;
  telefon: string | null;
  firmaAdi: string | null;
  guvenSkoru: number;
  createdAt: Date;
  kaynakAd?: string | null;
};

/** FAZ 6 ilan kartı (HTML). */
export function ilanKarti(ilan: KartIlan): string {
  const rota = `${ilan.nereden || ilan.cikisIl || "?"} → ${ilan.nereye || ilan.varisIl || "?"}`;
  const detay = [
    ilan.tonaj ? `${ilan.tonaj} ton` : null,
    ilan.aracTipi,
    ilan.yukTipi,
  ]
    .filter(Boolean)
    .join(" · ");

  const fiyat = fiyatGorunumu(ilan);
  const satirlar = [
    `🚛 <b>${htmlKacis(rota)}</b>`,
    detay ? `   ${htmlKacis(detay)}` : null,
    ilan.yuklemeTarihi
      ? `📅 ${htmlKacis(ilan.yuklemeTarihi.toLocaleDateString("tr-TR"))}`
      : null,
    fiyat.ana ? `💰 ${htmlKacis(fiyat.ana)}` : null,
    ilan.telefon ? `📞 ${htmlKacis(ilan.telefon)}` : null,
    ilan.firmaAdi ? `🏢 ${htmlKacis(ilan.firmaAdi)}` : null,
    `⏱ ${htmlKacis(gecenSure(ilan.createdAt))}${
      ilan.kaynakAd ? ` · ${htmlKacis(ilan.kaynakAd)}` : ""
    } · güven %${ilan.guvenSkoru}`,
  ];

  return satirlar.filter(Boolean).join("\n");
}

export function whatsappUrl(telefon: string | null): string | null {
  if (!telefon) return null;
  const rakam = telefon.replace(/\D/g, "");
  if (rakam.length < 10) return null;
  const e164 = rakam.startsWith("90")
    ? rakam
    : rakam.startsWith("0")
      ? `90${rakam.slice(1)}`
      : `90${rakam}`;
  return `https://wa.me/${e164}`;
}
