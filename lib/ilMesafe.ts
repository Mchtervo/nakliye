import { ilBul } from "@/lib/iller";

/**
 * İl merkezleri yaklaşık enlem/boylam (karayolu değil kuş uçuşu).
 * Ana üsse uzak varış elemesi için yeterli.
 */
const IL_KOORD: Record<string, [number, number]> = {
  Adana: [37.0, 35.32],
  Adıyaman: [37.76, 38.28],
  Afyonkarahisar: [38.76, 30.54],
  Ağrı: [39.72, 43.05],
  Aksaray: [38.37, 34.03],
  Amasya: [40.65, 35.83],
  Ankara: [39.93, 32.86],
  Antalya: [36.9, 30.7],
  Ardahan: [41.11, 42.7],
  Artvin: [41.18, 41.82],
  Aydın: [37.84, 27.85],
  Balıkesir: [39.65, 27.89],
  Bartın: [41.63, 32.34],
  Batman: [37.89, 41.13],
  Bayburt: [40.26, 40.22],
  Bilecik: [40.14, 29.98],
  Bingöl: [38.89, 40.5],
  Bitlis: [38.4, 42.11],
  Bolu: [40.73, 31.61],
  Burdur: [37.72, 30.29],
  Bursa: [40.19, 29.06],
  Çanakkale: [40.15, 26.41],
  Çankırı: [40.6, 33.62],
  Çorum: [40.55, 34.95],
  Denizli: [37.78, 29.09],
  Diyarbakır: [37.91, 40.24],
  Düzce: [40.84, 31.16],
  Edirne: [41.68, 26.56],
  Elazığ: [38.68, 39.23],
  Erzincan: [39.75, 39.49],
  Erzurum: [39.9, 41.27],
  Eskişehir: [39.78, 30.52],
  Gaziantep: [37.07, 37.38],
  Giresun: [40.91, 38.39],
  Gümüşhane: [40.46, 39.48],
  Hakkari: [37.57, 43.74],
  Hatay: [36.4, 36.35],
  Iğdır: [39.92, 44.05],
  Isparta: [37.76, 30.55],
  İstanbul: [41.01, 28.98],
  İzmir: [38.42, 27.14],
  Kahramanmaraş: [37.59, 36.92],
  Karabük: [41.2, 32.62],
  Karaman: [37.18, 33.22],
  Kars: [40.6, 43.1],
  Kastamonu: [41.39, 33.78],
  Kayseri: [38.73, 35.48],
  Kırıkkale: [39.85, 33.51],
  Kırklareli: [41.74, 27.23],
  Kırşehir: [39.15, 34.16],
  Kilis: [36.72, 37.12],
  Kocaeli: [40.77, 29.92],
  Konya: [37.87, 32.48],
  Kütahya: [39.42, 29.98],
  Malatya: [38.36, 38.31],
  Manisa: [38.62, 27.43],
  Mardin: [37.31, 40.73],
  Mersin: [36.81, 34.63],
  Muğla: [37.22, 28.37],
  Muş: [38.74, 41.51],
  Nevşehir: [38.62, 34.71],
  Niğde: [37.97, 34.68],
  Ordu: [40.98, 37.88],
  Osmaniye: [37.07, 36.25],
  Rize: [41.02, 40.52],
  Sakarya: [40.77, 30.4],
  Samsun: [41.29, 36.33],
  Siirt: [37.93, 41.94],
  Sinop: [42.03, 35.15],
  Sivas: [39.75, 37.02],
  Şanlıurfa: [37.17, 38.79],
  Şırnak: [37.52, 42.46],
  Tekirdağ: [40.98, 27.51],
  Tokat: [40.32, 36.55],
  Trabzon: [41.0, 39.72],
  Tunceli: [39.11, 39.54],
  Uşak: [38.68, 29.41],
  Van: [38.5, 43.37],
  Yalova: [40.65, 29.28],
  Yozgat: [39.82, 34.81],
  Zonguldak: [41.46, 31.8],
};

function haversineKm(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** İki il arası kuş uçuşu km; bilinmeyen ilde null. */
export function ilMesafesiKm(
  a: string | null | undefined,
  b: string | null | undefined
): number | null {
  const ia = ilBul(a);
  const ib = ilBul(b);
  if (!ia || !ib) return null;
  if (ia === ib) return 0;
  const ka = IL_KOORD[ia];
  const kb = IL_KOORD[ib];
  if (!ka || !kb) return null;
  return Math.round(haversineKm(ka, kb));
}

/**
 * Kabaca karayolu km (kuş × 1.3). Ankara–Malatya kuş 500 / yol ~650.
 */
export function yaklasikKarayoluKm(
  a: string | null | undefined,
  b: string | null | undefined
): number | null {
  const k = ilMesafesiKm(a, b);
  if (k === null) return null;
  return Math.round(k * 1.3);
}

/** Ana üsse bu (karayolu) mesafeden uzak varış → düşük skor / eleme. */
export const VARIS_UZA_KM = 600;
