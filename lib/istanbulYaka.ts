/**
 * İstanbul yakası — Anadolu hattı (Gebze/Kocaeli tarafı).
 * Avrupa yakası yükleme/boşaltma = köprü/tünel → kayıt dışı.
 * Sadece "İstanbul" yazılmışsa (ilçe yok) bilinmiyor sayılır, elenmez.
 */
import { sadelestir } from "@/lib/iller";

export type IstanbulYaka = "ANADOLU" | "AVRUPA" | "BILINMIYOR";

/** Anadolu yakası + Gebze hattına yakın semtler (İstanbul iline bağlı). */
const ANADOLU_SEMTLER = [
  "tuzla", "orhanli", "tepeoren", "pendik", "kurtkoy", "kartal",
  "maltepe", "atasehir", "umraniye", "dudullu", "serifali",
  "sancaktepe", "sultanbeyli", "cekmekoy", "alemdag", "beykoz",
  "uskudar", "kadikoy", "kavacik", "samandira", "samandıra",
  "ist anadolu", "anadolu yakasi", "anadolu yakası",
];

/** Avrupa yakası — köprü/tünel geçiş ister. */
const AVRUPA_SEMTLER = [
  "hadimkoy", "hadımkoy", "ikitelli", "ikiteli", "esenyurt", "hosdere",
  "kirac", "akcaburgaz", "beylikduzu", "avcilar", "ambarli",
  "kucukcekmece", "sefakoy", "buyukcekmece", "basaksehir", "bagcilar",
  "gunesli", "mahmutbey", "bahcelievler", "gungoren", "esenler",
  "bayrampasa", "zeytinburnu", "topkapi", "eyupsultan", "gaziosmanpasa",
  "sultangazi", "arnavutkoy", "silivri", "catalca", "kagithane",
  "sisli", "besiktas", "sariyer", "maslak", "levent", "halkali",
  "yenibosna", "seyrantepe", "haramidere", "massit", "masit",
  "orucreis", "oruc reis", "ist avrupa", "avrupa yakasi", "avrupa yakası",
  "g o pasa", "b cekmece", "k cekmece",
];

const ANADOLU_SADE = ANADOLU_SEMTLER.map(sadelestir).filter(Boolean);
const AVRUPA_SADE = AVRUPA_SEMTLER.map(sadelestir).filter(Boolean);

/** Serbest yer metninden yaka. İlçe yok / sadece il → BILINMIYOR. */
export function istanbulYakaBul(
  yer: string | null | undefined
): IstanbulYaka {
  const sade = sadelestir(yer || "");
  if (!sade) return "BILINMIYOR";

  let anadolu = false;
  let avrupa = false;
  for (const k of ANADOLU_SADE) {
    if (k.length >= 3 && sade.includes(k)) {
      anadolu = true;
      break;
    }
  }
  for (const k of AVRUPA_SADE) {
    if (k.length >= 3 && sade.includes(k)) {
      avrupa = true;
      break;
    }
  }
  if (anadolu && !avrupa) return "ANADOLU";
  if (avrupa && !anadolu) return "AVRUPA";
  if (anadolu && avrupa) return "BILINMIYOR"; // çelişki → eleme
  return "BILINMIYOR";
}

/**
 * Köprü geçişli mi?
 * İstanbul uçlarından biri açıkça Avrupa semtiyse true.
 * Gebze/Kocaeli/Ankara/Bolu uçları yakaya bakılmaz.
 */
export function kopruGecisliMi(args: {
  cikisIl?: string | null;
  varisIl?: string | null;
  nereden?: string | null;
  nereye?: string | null;
}): boolean {
  const cikisIst = args.cikisIl === "İstanbul";
  const varisIst = args.varisIl === "İstanbul";
  if (!cikisIst && !varisIst) return false;

  if (cikisIst && istanbulYakaBul(args.nereden) === "AVRUPA") return true;
  if (varisIst && istanbulYakaBul(args.nereye) === "AVRUPA") return true;
  return false;
}

/** Kayda uygun mu? (köprü geçişli → false) */
export function yakaKaydaUygunMu(args: {
  cikisIl?: string | null;
  varisIl?: string | null;
  nereden?: string | null;
  nereye?: string | null;
}): boolean {
  return !kopruGecisliMi(args);
}
