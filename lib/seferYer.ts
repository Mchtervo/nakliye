/**
 * Sefer yerini il'e çevirme ve tahmini km — saf, istemcide de çalışır
 * (sefer formundaki canlı "≈ 229 km").
 */
import { ILLER, ilBul, sadelestir } from "@/lib/iller";
import { ilMesafesiKm, yaklasikKarayoluKm } from "@/lib/ilMesafe";

/** iller.ts'de bilinçli olarak tanınmayan, iki ilde birden bulunan yer adları. */
const IKI_ILDE: Record<string, string[]> = {
  golbasi: ["Ankara", "Adıyaman"],
  eregli: ["Konya", "Zonguldak"],
  pinarbasi: ["Kayseri", "Kastamonu"],
  yenisehir: ["Bursa", "Diyarbakır"],
  yenice: ["Karabük", "Çanakkale"],
  pazar: ["Tokat", "Rize"],
  ovacik: ["Karabük", "Tunceli"],
};

function harfFarki(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/**
 * Sefer yerini ile çevirir. ilBul bulamazsa: iki ilde birden olan adda ana
 * üsse yakın il; küçük yazım hatasında ("kırkkale") en yakın il adı.
 */
export function seferIl(yer: string | null | undefined, anaUs: string | null = "Ankara"): string | null {
  const dogrudan = ilBul(yer);
  if (dogrudan) return dogrudan;
  const kelimeler = sadelestir(yer || "").split(" ").filter(Boolean);
  for (const k of kelimeler) {
    const adaylar = IKI_ILDE[k];
    if (adaylar) {
      return [...adaylar].sort(
        (a, b) => (ilMesafesiKm(anaUs, a) ?? 9999) - (ilMesafesiKm(anaUs, b) ?? 9999)
      )[0];
    }
  }
  for (const k of kelimeler) {
    if (k.length < 5) continue;
    const yakin = ILLER.find((il) => harfFarki(k, sadelestir(il)) <= 2);
    if (yakin) return yakin;
  }
  return null;
}

/** Nereden → nereye tahmini km; yer tanınmazsa null. */
export function seferKmTahmini(nereden: string, nereye: string, anaUs: string | null = "Ankara"): number | null {
  const a = seferIl(nereden, anaUs);
  const b = seferIl(nereye, anaUs);
  if (!a || !b) return null;
  return a === b ? 0 : yaklasikKarayoluKm(a, b);
}
