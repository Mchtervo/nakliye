/**
 * Yük Bul "yakın çevre": seçilen ilin merkezinden ~70 km içindeki yükleme
 * noktaları. YALNIZ GÖRÜNTÜ içindir (ilan toplama, AI, bildirim ve koridor
 * kurallarına dokunmaz).
 *
 * Mesafe kuş uçuşudur. Yükleme noktası ilçe tablosundan tanınırsa ilçe
 * merkezine göre, ilanda yalnız il adı yazıyorsa il merkezine göre hesaplanır;
 * ikisi de değilse "belirsiz" sayılır ve kesin "70 km içinde" denmez.
 * İlçe koordinatları yaklaşıktır (ilçe merkezi, ±3–5 km).
 */
import { haversineKm, ilKoordinati } from "@/lib/ilMesafe";
import { ilBul, sadelestir } from "@/lib/iller";

export const YAKIN_CEVRE_KM = 70;

/** [ad, il, enlem, boylam] — koridordaki başlıca yükleme ilçe / OSB'leri */
const ILCELER: [string, string, number, number][] = [
  ["Sincan", "Ankara", 39.97, 32.58], ["Etimesgut", "Ankara", 39.95, 32.67], ["Polatlı", "Ankara", 39.58, 32.15],
  ["Temelli", "Ankara", 39.73, 32.37], ["Kahramankazan", "Ankara", 40.21, 32.68], ["Kazan", "Ankara", 40.21, 32.68],
  ["Gölbaşı", "Ankara", 39.79, 32.81], ["Elmadağ", "Ankara", 39.92, 33.23], ["Çubuk", "Ankara", 40.24, 33.03],
  ["Akyurt", "Ankara", 40.13, 33.09], ["Ostim", "Ankara", 39.97, 32.75], ["İvedik", "Ankara", 39.98, 32.76],
  ["Şaşmaz", "Ankara", 39.93, 32.69], ["Beypazarı", "Ankara", 40.17, 31.92], ["Ayaş", "Ankara", 40.02, 32.34],
  ["Haymana", "Ankara", 39.43, 32.5], ["Kalecik", "Ankara", 40.1, 33.41], ["Şereflikoçhisar", "Ankara", 38.94, 33.54],
  ["Nallıhan", "Ankara", 40.19, 31.35], ["Kızılcahamam", "Ankara", 40.47, 32.65],
  ["Gerede", "Bolu", 40.8, 32.2], ["Mengen", "Bolu", 40.94, 32.07], ["Mudurnu", "Bolu", 40.47, 31.21],
  ["Göynük", "Bolu", 40.4, 30.79], ["Yeniçağa", "Bolu", 40.77, 32.03], ["Dörtdivan", "Bolu", 40.72, 32.06], ["Seben", "Bolu", 40.41, 31.57],
  ["Akçakoca", "Düzce", 41.09, 31.12], ["Kaynaşlı", "Düzce", 40.78, 31.32], ["Cumayeri", "Düzce", 40.87, 30.95], ["Gölyaka", "Düzce", 40.78, 30.99],
  ["Gebze", "Kocaeli", 40.8, 29.43], ["Dilovası", "Kocaeli", 40.78, 29.54], ["Çayırova", "Kocaeli", 40.82, 29.37],
  ["Darıca", "Kocaeli", 40.77, 29.4], ["Körfez", "Kocaeli", 40.77, 29.74], ["Derince", "Kocaeli", 40.76, 29.83],
  ["İzmit", "Kocaeli", 40.77, 29.92], ["Kartepe", "Kocaeli", 40.75, 30.03], ["Gölcük", "Kocaeli", 40.72, 29.82],
  ["Başiskele", "Kocaeli", 40.72, 29.93], ["Kandıra", "Kocaeli", 41.07, 30.15], ["Karamürsel", "Kocaeli", 40.69, 29.62],
  ["Adapazarı", "Sakarya", 40.78, 30.4], ["Hendek", "Sakarya", 40.8, 30.75], ["Akyazı", "Sakarya", 40.69, 30.62],
  ["Arifiye", "Sakarya", 40.71, 30.36], ["Sapanca", "Sakarya", 40.69, 30.27], ["Pamukova", "Sakarya", 40.51, 30.17],
  ["Karasu", "Sakarya", 41.1, 30.69], ["Geyve", "Sakarya", 40.51, 30.29],
  ["Keskin", "Kırıkkale", 39.67, 33.61], ["Yahşihan", "Kırıkkale", 39.85, 33.45],
  ["Tuzla", "İstanbul", 40.82, 29.3], ["Pendik", "İstanbul", 40.88, 29.25], ["Kartal", "İstanbul", 40.89, 29.19],
  ["Ümraniye", "İstanbul", 41.02, 29.12], ["Sancaktepe", "İstanbul", 40.99, 29.23], ["Sultanbeyli", "İstanbul", 40.96, 29.27],
  ["Nilüfer", "Bursa", 40.21, 28.98], ["Osmangazi", "Bursa", 40.19, 29.06], ["Gemlik", "Bursa", 40.43, 29.15],
  ["İnegöl", "Bursa", 40.08, 29.51], ["Mustafakemalpaşa", "Bursa", 40.04, 28.41], ["Orhangazi", "Bursa", 40.49, 29.31],
  ["Kestel", "Bursa", 40.2, 29.21], ["Yenişehir", "Bursa", 40.26, 29.65],
  ["Bozüyük", "Bilecik", 39.91, 30.04], ["Osmaneli", "Bilecik", 40.36, 30.01], ["Söğüt", "Bilecik", 40.02, 30.18],
  ["İnönü", "Eskişehir", 39.82, 30.15], ["Alpu", "Eskişehir", 39.77, 30.95], ["Sivrihisar", "Eskişehir", 39.45, 31.54],
  ["Ereğli", "Konya", 37.51, 34.05], ["Akşehir", "Konya", 38.36, 31.42], ["Cihanbeyli", "Konya", 38.66, 32.92], ["Kulu", "Konya", 39.09, 33.08],
  ["Develi", "Kayseri", 38.39, 35.49], ["Talas", "Kayseri", 38.69, 35.55], ["İncesu", "Kayseri", 38.62, 35.18],
  ["Tavşanlı", "Kütahya", 39.54, 29.49],
];

const ILCE_DESEN = ILCELER.map(([ad, il, lat, lon]) => ({ ad, il, koord: [lat, lon] as [number, number], desen: new RegExp(`(^|[^a-z])${sadelestir(ad)}([^a-z]|$)`) }));

export type Yakinlik = {
  /** Kuş uçuşu km (yaklaşık); belirsizse null */
  km: number | null;
  /** Mesafe neye göre: ilçe merkezi, il merkezi ya da bilinmiyor */
  tur: "ilce" | "il" | "belirsiz";
  /** Hesapta kullanılan yer adı */
  yer: string | null;
};

/** İlanın yükleme noktasının seçilen il merkezine uzaklığı. */
export function yuklemeYakinligi(merkezIl: string, ilan: { nereden: string | null; cikisIl: string | null }): Yakinlik {
  const merkez = ilKoordinati(merkezIl);
  if (!merkez) return { km: null, tur: "belirsiz", yer: null };
  const metin = sadelestir(ilan.nereden ?? "");
  const cikis = ilBul(ilan.cikisIl);
  // Aynı adlı ilçe başka ilde olabilir: çıkış iliyle uyuşanı seç
  const ilce = ILCE_DESEN.find((d) => d.desen.test(metin) && (!cikis || d.il === cikis));
  if (ilce) return { km: Math.round(haversineKm(merkez, ilce.koord)), tur: "ilce", yer: ilce.ad };
  const yalnizIl = !metin || (cikis !== null && sadelestir(cikis) === metin.trim());
  if (cikis && yalnizIl) {
    const k = ilKoordinati(cikis);
    if (k) return { km: Math.round(haversineKm(merkez, k)), tur: "il", yer: cikis };
  }
  return { km: null, tur: "belirsiz", yer: cikis };
}

/**
 * Yakın çevrede mi? Bilinen nokta: ≤70 km. Bilinmeyen nokta yalnız seçilen
 * ilin içindeyse gösterilir (mesafe "belirsiz" diye işaretlenir), komşu ilde
 * kesin olmadığı için gösterilmez.
 */
export function yakinCevredeMi(merkezIl: string, ilan: { nereden: string | null; cikisIl: string | null }, y = yuklemeYakinligi(merkezIl, ilan)): boolean {
  if (y.km !== null) return y.km <= YAKIN_CEVRE_KM;
  return ilBul(ilan.cikisIl) === ilBul(merkezIl);
}

/** Kartta gösterilecek kısa açıklama */
export function yakinlikYazisi(merkezIl: string, y: Yakinlik): string {
  if (y.km === null) return `${y.yer ?? merkezIl} ili içinde · mesafe belirsiz`;
  if (y.km === 0) return `${merkezIl} merkez`;
  return `${merkezIl} merkezine ~${y.km} km${y.tur === "il" ? " (il merkezi)" : ` · ${y.yer}`}`;
}
