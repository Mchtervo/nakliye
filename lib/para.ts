// Tüm para tutarları KURUŞ cinsinden tam sayı olarak tutulur (1 TL = 100 kuruş).
// Böylece ondalık sayı (float) kaynaklı kuruş hataları hiçbir zaman oluşmaz.

export const KDV_ORANI = 0.20;

export interface KdvSonuc {
  netTutar: number; // kuruş, KDV hariç
  kdvTutar: number; // kuruş
  toplamTutar: number; // kuruş, KDV dahil
}

/**
 * KDV hesabı yapar.
 * @param tutarKurus Kullanıcının girdiği tutar (kuruş)
 * @param kdvli İşlem KDV'li mi?
 * @param kdvDahilMi Girilen tutar KDV dahil mi? (kdvli=false ise önemsiz)
 */
export function kdvHesapla(
  tutarKurus: number,
  kdvli: boolean,
  kdvDahilMi: boolean
): KdvSonuc {
  if (!Number.isInteger(tutarKurus) || tutarKurus < 0) {
    throw new Error("Tutar geçersiz");
  }
  if (!kdvli) {
    return { netTutar: tutarKurus, kdvTutar: 0, toplamTutar: tutarKurus };
  }
  if (kdvDahilMi) {
    // Girilen tutar KDV dahil: net = toplam / 1.20
    const toplamTutar = tutarKurus;
    const netTutar = Math.round(toplamTutar / (1 + KDV_ORANI));
    return { netTutar, kdvTutar: toplamTutar - netTutar, toplamTutar };
  }
  // Girilen tutar KDV hariç: kdv = net * 0.20
  const netTutar = tutarKurus;
  const kdvTutar = Math.round(netTutar * KDV_ORANI);
  return { netTutar, kdvTutar, toplamTutar: netTutar + kdvTutar };
}

/**
 * Türkçe para girişini kuruşa çevirir.
 * Kabul edilen örnekler: "12000", "12.000", "12.000,50", "12000,5", "12000.50", "1.250.000"
 * Geçersiz girişte null döner.
 */
export function tlKurusaCevir(girdi: string): number | null {
  if (typeof girdi !== "string") return null;
  let s = girdi.trim().replace(/\s/g, "").replace(/(TL|tl|₺)/g, "");
  if (s.length === 0) return null;
  if (!/^[0-9.,]+$/.test(s)) return null;

  const virgul = s.includes(",");
  const nokta = s.includes(".");

  if (virgul && nokta) {
    // Son ayraç ondalıktır: "12.000,50" veya (nadiren) "12,000.50"
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (virgul) {
    if ((s.match(/,/g) || []).length > 1) return null; // "1,2,3" geçersiz
    s = s.replace(",", ".");
  } else if (nokta) {
    const parcalar = s.split(".");
    if (parcalar.length > 2) {
      // "1.250.000" -> binlik ayraç, hepsi 3 haneli olmalı
      if (parcalar.slice(1).every((p) => p.length === 3)) {
        s = parcalar.join("");
      } else {
        return null;
      }
    } else if (parcalar[1].length === 3 && parcalar[0].length > 0) {
      // "12.000" -> Türkçe'de binlik ayraçtır
      s = parcalar.join("");
    }
    // "12.5" veya "12.50" -> ondalık olarak bırakılır
  }

  const sayi = Number(s);
  if (!Number.isFinite(sayi) || sayi < 0) return null;
  const kurus = Math.round(sayi * 100);
  if (kurus > Number.MAX_SAFE_INTEGER) return null;
  return kurus;
}

/** Kuruşu "12.000,50 ₺" biçiminde yazar. */
export function tlYaz(kurus: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(kurus / 100);
}

/**
 * Yazarken binlik nokta + ondalık virgül uygular.
 * "1670000" → "1.670.000" | "1670000,5" → "1.670.000,5"
 */
export function tlGirisBicimle(girdi: string): string {
  const ham = girdi.replace(/[^\d,]/g, "");
  if (!ham) return "";

  const virgulIdx = ham.indexOf(",");
  let tam = virgulIdx === -1 ? ham : ham.slice(0, virgulIdx);
  let ondalik = virgulIdx === -1 ? null : ham.slice(virgulIdx + 1).replace(/,/g, "");

  tam = tam.replace(/^0+(?=\d)/, "");
  if (tam === "") tam = "0";

  const bicimliTam = tam.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (ondalik === null) return bicimliTam;
  ondalik = ondalik.slice(0, 2);
  return `${bicimliTam},${ondalik}`;
}

/** Kuruşu input alanına yazılacak Türkçe biçime çevirir. */
export function kurustanGiris(kurus: number): string {
  const tam = Math.trunc(kurus / 100);
  const kurusKisim = Math.abs(kurus % 100);
  const tamYazi = tlGirisBicimle(String(Math.abs(tam)));
  if (kurusKisim === 0) return tamYazi;
  return `${tamYazi},${String(kurusKisim).padStart(2, "0")}`;
}

/** Kuruşu ondalıksız kısa biçimde yazar: "12.000 ₺" (tam TL ise) */
export function tlYazKisa(kurus: number): string {
  if (kurus % 100 === 0) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(kurus / 100);
  }
  return tlYaz(kurus);
}

export function tarihYaz(tarih: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(tarih);
}
